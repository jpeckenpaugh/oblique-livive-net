import { getSettings } from './settings.js';

export const MESHY_BASE_URL = 'https://api.meshy.ai/openapi';

const DEFAULT_POLL_MS = 5000;
const DEFAULT_MAX_WAIT_MS = 15 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
const SUCCEEDED = new Set(['SUCCEEDED', 'SUCCESS', 'COMPLETED']);
const FAILED = new Set(['FAILED', 'ERROR', 'CANCELED', 'CANCELLED']);
const TASK_PATHS = {
  'text-to-image': '/v1/text-to-image',
  'text-to-3d': '/v2/text-to-3d',
  'image-to-3d': '/v1/image-to-3d'
};

export class MeshyError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'MeshyError';
    this.code = code;
    this.status = options.status ?? null;
    this.retryAfter = options.retryAfter ?? null;
    this.action = options.action || '';
    this.details = options.details ?? null;
  }
}

function redact(value) {
  return String(value ?? '')
    .replace(/msy_[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
}

function parseRetryAfter(header) {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

function messageFromBody(body, fallback) {
  if (typeof body === 'string' && body.trim()) return redact(body.trim()).slice(0, 300);
  if (!body || typeof body !== 'object') return fallback;
  const candidates = [
    body.message,
    body.error?.message,
    body.task_error?.message,
    typeof body.error === 'string' ? body.error : null
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return redact(candidate.trim()).slice(0, 300);
  }
  return fallback;
}

function currentApiKey(explicit) {
  const key = typeof explicit === 'string' && explicit.trim() ? explicit.trim() : getSettings().meshy.apiKey;
  if (!key) {
    throw new MeshyError('MESHY_MISSING_KEY', 'No Meshy API key is configured.', {
      action: 'Add a Meshy API key in AI settings.'
    });
  }
  return key;
}

function errorFromResponse(response, body) {
  const status = response.status;
  const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
  const providerMessage = messageFromBody(body, `Meshy request failed with HTTP ${status}.`);
  if (status === 401 || status === 403) {
    return new MeshyError('MESHY_UNAUTHORIZED', 'Meshy rejected the API key.', {
      status,
      details: { providerMessage },
      action: 'Check the key at meshy.ai/developers/keys and save it again.'
    });
  }
  if (status === 402) {
    return new MeshyError('MESHY_PAYMENT_REQUIRED', 'Meshy has no credits available for this request.', {
      status,
      details: { providerMessage },
      action: 'Open Meshy billing or use a key with available credits.'
    });
  }
  if (status === 429) {
    return new MeshyError('MESHY_RATE_LIMITED', 'Meshy rate limit reached.', {
      status,
      retryAfter,
      details: { providerMessage },
      action: 'Wait for the retry window and try again.'
    });
  }
  if (status === 400 || status === 422) {
    return new MeshyError('MESHY_INVALID_REQUEST', providerMessage, {
      status,
      details: { providerMessage },
      action: 'Check the model, prompt, and request options.'
    });
  }
  return new MeshyError('MESHY_HTTP_ERROR', providerMessage, {
    status,
    retryAfter,
    details: { providerMessage },
    action: 'Try again. If the problem persists, check the Meshy service status.'
  });
}

function abortError(signal, timedOut) {
  if (timedOut) {
    return new MeshyError('MESHY_TIMEOUT', 'The Meshy request timed out.', {
      action: 'Try again with a shorter request.'
    });
  }
  return new MeshyError('MESHY_ABORTED', 'The Meshy request was cancelled.', {
    action: 'Start a new generation when you are ready.'
  });
}

async function request(path, options = {}) {
  const apiKey = currentApiKey(options.apiKey);
  const controller = new AbortController();
  const externalSignal = options.signal;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1, options.timeoutMs) : DEFAULT_REQUEST_TIMEOUT_MS;
  let timedOut = false;
  let abortListener = null;

  if (externalSignal) {
    if (externalSignal.aborted) throw abortError(externalSignal, false);
    abortListener = () => controller.abort();
    externalSignal.addEventListener('abort', abortListener, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
  const init = {
    method: options.method || 'GET',
    headers,
    signal: controller.signal,
    mode: 'cors',
    credentials: 'omit'
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${MESHY_BASE_URL}${path}`, init);
    const raw = await response.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }
    if (!response.ok) throw errorFromResponse(response, data);
    return {
      data,
      retryAfter: parseRetryAfter(response.headers.get('retry-after'))
    };
  } catch (error) {
    if (error instanceof MeshyError) throw error;
    if (controller.signal.aborted) throw abortError(externalSignal, timedOut);
    if (error instanceof TypeError) {
      throw new MeshyError('MESHY_NETWORK', 'Could not reach the Meshy API from this browser.', {
        action: 'Check your connection and whether this browser can access api.meshy.ai.'
      });
    }
    throw new MeshyError('MESHY_ERROR', redact(error?.message || 'Meshy request failed.'), {
      action: 'Try again.'
    });
  } finally {
    clearTimeout(timer);
    if (externalSignal && abortListener) externalSignal.removeEventListener('abort', abortListener);
  }
}

function normalizeKind(kind) {
  const value = String(kind || '').toLowerCase();
  if (value === 'text-to-image' || value === 'image') return 'text-to-image';
  if (value === 'text-to-3d' || value === '3d') return 'text-to-3d';
  if (value === 'image-to-3d') return 'image-to-3d';
  throw new MeshyError('MESHY_INVALID_KIND', `Unsupported Meshy task kind: ${kind}`, {
    action: 'Use text-to-image, text-to-3d, or image-to-3d.'
  });
}

function normalizeModelUrls(modelUrls) {
  if (!modelUrls || typeof modelUrls !== 'object') return null;
  return {
    glb: typeof modelUrls.glb === 'string' ? modelUrls.glb : null,
    fbx: typeof modelUrls.fbx === 'string' ? modelUrls.fbx : null,
    obj: typeof modelUrls.obj === 'string' ? modelUrls.obj : null,
    usdz: typeof modelUrls.usdz === 'string' ? modelUrls.usdz : null
  };
}

function normalizeTask(kind, data) {
  const task = data && typeof data === 'object' ? data : {};
  const imageUrls = Array.isArray(task.image_urls)
    ? task.image_urls.filter(url => typeof url === 'string')
    : (typeof task.image_url === 'string' ? [task.image_url] : []);
  const errorMessage = task.task_error?.message || task.error?.message || (typeof task.error === 'string' ? task.error : null);
  return {
    id: task.id ?? task.task_id ?? null,
    kind,
    status: typeof task.status === 'string' ? task.status.toUpperCase() : '',
    progress: Number.isFinite(Number(task.progress)) ? Number(task.progress) : 0,
    imageUrls,
    modelUrls: normalizeModelUrls(task.model_urls),
    thumbnailUrl: typeof task.thumbnail_url === 'string' ? task.thumbnail_url : null,
    error: errorMessage ? { message: redact(errorMessage) } : null,
    createdAt: task.created_at ?? null,
    finishedAt: task.finished_at ?? null,
    raw: task
  };
}

function taskIdFrom(data) {
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (!data || typeof data !== 'object') return null;
  for (const candidate of [data.result, data.id, data.task_id]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

async function fetchTask(kind, taskId, signal) {
  const normalized = normalizeKind(kind);
  if (!taskId) {
    throw new MeshyError('MESHY_INVALID_TASK_ID', 'A Meshy task id is required.', {
      action: 'Create a task first, then poll it.'
    });
  }
  const { data, retryAfter } = await request(`${TASK_PATHS[normalized]}/${encodeURIComponent(taskId)}`, { signal });
  return { task: normalizeTask(normalized, data), retryAfter };
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new MeshyError('MESHY_ABORTED', 'The Meshy request was cancelled.', {
        action: 'Start a new generation when you are ready.'
      }));
      return;
    }
    let timer = null;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new MeshyError('MESHY_ABORTED', 'The Meshy request was cancelled.', {
        action: 'Start a new generation when you are ready.'
      }));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function testKey() {
  try {
    const { data } = await request('/v1/balance');
    return {
      ok: true,
      balance: data?.credits ?? data?.balance ?? null,
      plan: data?.plan ?? null,
      raw: data
    };
  } catch (error) {
    return {
      ok: false,
      balance: null,
      plan: null,
      error: describeError(error)
    };
  }
}

export async function createTextToImage({ prompt, aiModel = 'nano-banana', aspectRatio = '1:1', removeBackground = false, signal } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new MeshyError('MESHY_INVALID_REQUEST', 'A prompt is required.', {
      action: 'Describe the image you want to generate.'
    });
  }
  const { data } = await request('/v1/text-to-image', {
    method: 'POST',
    body: {
      ai_model: aiModel,
      prompt: prompt.trim(),
      aspect_ratio: aspectRatio,
      remove_background: !!removeBackground
    },
    signal
  });
  const taskId = taskIdFrom(data);
  if (!taskId) {
    throw new MeshyError('MESHY_INVALID_RESPONSE', 'Meshy did not return an image task id.', {
      action: 'Try again.'
    });
  }
  return { taskId, task: data };
}

export async function getTextToImage(taskId, options = {}) {
  const { task } = await fetchTask('text-to-image', taskId, options.signal);
  return task;
}

export async function createTextTo3D({ prompt, aiModel, mode = 'preview', previewTaskId, options = {}, signal } = {}) {
  const normalizedMode = mode === 'refine' ? 'refine' : 'preview';
  const body = {};
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) body[key] = value;
  }
  body.mode = normalizedMode;
  if (normalizedMode === 'refine') {
    if (!previewTaskId) {
      throw new MeshyError('MESHY_INVALID_REQUEST', 'A preview task id is required before refining a 3D model.', {
        action: 'Finish a preview task first, then refine it.'
      });
    }
    body.preview_task_id = previewTaskId;
  } else {
    if (typeof prompt !== 'string' || !prompt.trim()) {
      throw new MeshyError('MESHY_INVALID_REQUEST', 'A prompt is required.', {
        action: 'Describe the 3D model you want to generate.'
      });
    }
    body.prompt = prompt.trim();
    body.ai_model = aiModel || 'meshy-5';
  }
  const { data } = await request('/v2/text-to-3d', { method: 'POST', body, signal });
  const taskId = taskIdFrom(data);
  if (!taskId) {
    throw new MeshyError('MESHY_INVALID_RESPONSE', 'Meshy did not return a 3D task id.', {
      action: 'Try again.'
    });
  }
  return { taskId, task: data };
}

export async function get3D(taskId, options = {}) {
  const { task } = await fetchTask('text-to-3d', taskId, options.signal);
  return task;
}

export async function createImageTo3D({ imageUrl, inputTaskId, aiModel = 'meshy-5', options = {}, signal } = {}) {
  if (!imageUrl && !inputTaskId) {
    throw new MeshyError('MESHY_INVALID_REQUEST', 'An image URL or text-to-image task id is required.', {
      action: 'Provide an image or a completed image task.'
    });
  }
  const body = {};
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) body[key] = value;
  }
  body.ai_model = aiModel || 'meshy-5';
  if (inputTaskId) body.input_task_id = inputTaskId;
  else body.image_url = imageUrl;
  const { data } = await request('/v1/image-to-3d', { method: 'POST', body, signal });
  const taskId = taskIdFrom(data);
  if (!taskId) {
    throw new MeshyError('MESHY_INVALID_RESPONSE', 'Meshy did not return an image-to-3D task id.', {
      action: 'Try again.'
    });
  }
  return { taskId, task: data };
}

export async function getImageTo3D(taskId, options = {}) {
  const { task } = await fetchTask('image-to-3d', taskId, options.signal);
  return task;
}

export async function waitForTask(kind, taskId, onProgress, options = {}) {
  const normalizedKind = normalizeKind(kind);
  const signal = options.signal;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1, options.timeoutMs) : DEFAULT_MAX_WAIT_MS;
  const intervalMs = Number.isFinite(options.intervalMs) ? Math.max(0, options.intervalMs) : DEFAULT_POLL_MS;
  const started = Date.now();
  let attempts = 0;

  while (true) {
    if (signal?.aborted) {
      throw new MeshyError('MESHY_ABORTED', 'The Meshy task wait was cancelled.', {
        action: 'Start a new generation when you are ready.'
      });
    }
    let result;
    try {
      result = await fetchTask(normalizedKind, taskId, signal);
    } catch (error) {
      if (error instanceof MeshyError && error.code === 'MESHY_RATE_LIMITED' && Date.now() - started < timeoutMs) {
        const delay = Number.isFinite(error.retryAfter) && error.retryAfter > 0 ? error.retryAfter : intervalMs;
        await sleep(Math.min(delay, Math.max(0, timeoutMs - (Date.now() - started))), signal);
        continue;
      }
      throw error;
    }
    attempts += 1;
    const { task, retryAfter } = result;
    if (typeof onProgress === 'function') {
      try {
        onProgress(task, { attempts, elapsedMs: Date.now() - started });
      } catch {
      }
    }
    if (SUCCEEDED.has(task.status)) return task;
    if (FAILED.has(task.status)) {
      throw new MeshyError('MESHY_TASK_FAILED', redact(task.error?.message || `Meshy task ${task.status.toLowerCase()}.`), {
        details: { taskId, status: task.status },
        action: 'Adjust the prompt or options and generate again.'
      });
    }
    const elapsed = Date.now() - started;
    if (elapsed >= timeoutMs) {
      throw new MeshyError('MESHY_TIMEOUT', 'The Meshy task did not finish in time.', {
        details: { taskId, status: task.status },
        action: 'Check the task in Meshy or try again.'
      });
    }
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : intervalMs;
    await sleep(Math.min(delay, Math.max(0, timeoutMs - elapsed)), signal);
  }
}

export function describeError(error) {
  if (error?.code && typeof error.code === 'string') {
    const code = error.code;
    const fallbackMessage = redact(error.message || 'Meshy request failed.');
    const actions = {
      MESHY_MISSING_KEY: 'Add a Meshy API key in AI settings.',
      MESHY_UNAUTHORIZED: 'Check the key at meshy.ai/developers/keys and save it again.',
      MESHY_PAYMENT_REQUIRED: 'Open Meshy billing or use a key with available credits.',
      MESHY_RATE_LIMITED: 'Wait for the retry window and try again.',
      MESHY_TASK_FAILED: 'Adjust the prompt or options and generate again.',
      MESHY_ABORTED: 'Start a new generation when you are ready.',
      MESHY_TIMEOUT: 'Check the task in Meshy or try again.',
      MESHY_NETWORK: 'Check your connection and whether this browser can access api.meshy.ai.',
      MESHY_INVALID_REQUEST: 'Check the model, prompt, and request options.',
      MESHY_INVALID_RESPONSE: 'Try again.',
      MESHY_INVALID_KIND: 'Use text-to-image, text-to-3d, or image-to-3d.',
      MESHY_INVALID_TASK_ID: 'Create a task first, then poll it.',
      MESHY_HTTP_ERROR: 'Try again. If the problem persists, check the Meshy service status.'
    };
    return {
      code,
      message: fallbackMessage,
      action: error.action || actions[code] || 'Try again.'
    };
  }
  if (error instanceof TypeError) {
    return {
      code: 'MESHY_NETWORK',
      message: 'Could not reach the Meshy API from this browser.',
      action: 'Check your connection and whether this browser can access api.meshy.ai.'
    };
  }
  return {
    code: 'MESHY_ERROR',
    message: redact(error?.message || 'Meshy request failed.'),
    action: 'Try again.'
  };
}

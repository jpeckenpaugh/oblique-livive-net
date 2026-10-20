import { getSettings, DEFAULT_OPENCODE_BASE_URL, DEFAULT_OPENCODE_MODEL } from './settings.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_IMAGE_TIMEOUT_MS = 120000;
const IMAGE_NAME_PATTERN = /(?:^|[-_/.])(?:image|images|imagen|dall-?e|gpt-image|flux|stable-diffusion|sdxl|sd3|ideogram|recraft|seedream|nano-banana|photon|kolors|qwen-image|playground)(?:[-_/.]|$)/i;

export class OpenCodeError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'OpenCodeError';
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

function normalizeBaseUrl(value) {
  const base = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_OPENCODE_BASE_URL;
  return base.replace(/\/+$/, '');
}

function configFor(overrides = {}) {
  const settings = getSettings().opencode;
  return {
    baseUrl: normalizeBaseUrl(overrides.baseUrl ?? settings.baseUrl),
    apiKey: typeof overrides.apiKey === 'string' ? overrides.apiKey.trim() : settings.apiKey,
    model: typeof overrides.model === 'string' ? overrides.model.trim() : settings.model
  };
}

function officialCatalogUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (url.protocol === 'https:' && url.hostname === 'opencode.ai' && url.pathname.replace(/\/+$/, '') === '/inference/openai/v1') {
      return 'https://opencode.ai/inference/v1/models';
    }
  } catch {
    return null;
  }
  return null;
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
  const candidates = [body.message, body.error?.message, typeof body.error === 'string' ? body.error : null];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return redact(candidate.trim()).slice(0, 300);
  }
  return fallback;
}

function networkError(error) {
  if (error instanceof OpenCodeError) return error;
  if (error?.name === 'AbortError') {
    return new OpenCodeError('OPENCODE_ABORTED', 'The OpenCode request was cancelled.', {
      action: 'Start a new generation when you are ready.'
    });
  }
  return new OpenCodeError('OPENCODE_CORS_BLOCKED', 'The browser could not call this OpenCode endpoint.', {
    action: 'Use a CORS-enabled OpenCode-compatible base URL, or run the request through a gateway that sends CORS headers.',
    details: { reason: redact(error?.message || 'Network or CORS failure') }
  });
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1, options.timeoutMs) : DEFAULT_REQUEST_TIMEOUT_MS;
  const headers = { Accept: 'application/json' };
  if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;
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
  let timedOut = false;
  let abortListener = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      throw new OpenCodeError('OPENCODE_ABORTED', 'The OpenCode request was cancelled.', {
        action: 'Start a new generation when you are ready.'
      });
    }
    abortListener = () => controller.abort();
    externalSignal.addEventListener('abort', abortListener, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, init);
    const raw = await response.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }
    return { response, data, retryAfter: parseRetryAfter(response.headers.get('retry-after')) };
  } catch (error) {
    if (error instanceof OpenCodeError) throw error;
    if (controller.signal.aborted) {
      if (timedOut) {
        throw new OpenCodeError('OPENCODE_TIMEOUT', 'The OpenCode request timed out.', {
          action: 'Try again with a shorter request.'
        });
      }
      throw new OpenCodeError('OPENCODE_ABORTED', 'The OpenCode request was cancelled.', {
        action: 'Start a new generation when you are ready.'
      });
    }
    throw networkError(error);
  } finally {
    clearTimeout(timer);
    if (externalSignal && abortListener) externalSignal.removeEventListener('abort', abortListener);
  }
}

function modelId(entry) {
  if (typeof entry === 'string') return entry.trim();
  if (!entry || typeof entry !== 'object') return '';
  for (const value of [entry.id, entry.name, entry.model]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function isImageModel(entry) {
  if (!entry || typeof entry !== 'object') return IMAGE_NAME_PATTERN.test(String(entry || ''));
  const id = modelId(entry);
  if (id && IMAGE_NAME_PATTERN.test(id)) return true;
  const outputs = entry.architecture?.output_modalities || entry.output_modalities || entry.modalities || entry.architecture?.modality;
  if (Array.isArray(outputs) && outputs.some(value => String(value).toLowerCase().includes('image'))) return true;
  if (typeof outputs === 'string' && outputs.toLowerCase().includes('image')) return true;
  const capabilities = entry.capabilities;
  if (capabilities && typeof capabilities === 'object') {
    if (capabilities.image_generation === true || capabilities.images === true) return true;
  }
  return false;
}

function extractModels(data) {
  const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : (Array.isArray(data?.models) ? data.models : []));
  return list.map(entry => ({ id: modelId(entry), entry })).filter(item => item.id);
}

function errorFromResponse(response, body, retryAfter) {
  const status = response.status;
  const providerMessage = messageFromBody(body, `OpenCode request failed with HTTP ${status}.`);
  if (status === 401 || status === 403) {
    return new OpenCodeError('OPENCODE_UNAUTHORIZED', 'OpenCode rejected the API key.', {
      status,
      details: { providerMessage },
      action: 'Check the OpenCode key and save it again.'
    });
  }
  if (status === 402) {
    return new OpenCodeError('OPENCODE_PAYMENT_REQUIRED', 'OpenCode has no paid credits for this request.', {
      status,
      details: { providerMessage },
      action: 'Use a key with available paid credits or choose another image provider.'
    });
  }
  if (status === 429) {
    return new OpenCodeError('OPENCODE_RATE_LIMITED', 'OpenCode rate limit reached.', {
      status,
      retryAfter,
      details: { providerMessage },
      action: 'Wait for the retry window and try again.'
    });
  }
  if (status === 404 || /model is unavailable|no image|not found|unsupported model/i.test(providerMessage)) {
    return new OpenCodeError('OPENCODE_NO_IMAGE_MODEL', providerMessage, {
      status,
      details: { providerMessage },
      action: 'Point the base URL at a CORS-enabled OpenAI-compatible provider that serves an image model.'
    });
  }
  if (status === 400 || status === 422) {
    return new OpenCodeError('OPENCODE_INVALID_REQUEST', providerMessage, {
      status,
      details: { providerMessage },
      action: 'Check the model, size, prompt, and response format.'
    });
  }
  return new OpenCodeError('OPENCODE_HTTP_ERROR', providerMessage, {
    status,
    retryAfter,
    details: { providerMessage },
    action: 'Try again. If the problem persists, check the endpoint status.'
  });
}

function decodeBase64(value) {
  const raw = String(value || '').replace(/\s+/g, '');
  if (!raw) throw new OpenCodeError('OPENCODE_INVALID_RESPONSE', 'The image response was empty.', {
    action: 'Try again.'
  });
  if (typeof atob === 'function') {
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(raw, 'base64'));
  throw new OpenCodeError('OPENCODE_INVALID_RESPONSE', 'This browser cannot decode the generated image.', {
    action: 'Use a browser with base64 support.'
  });
}

function mimeFromData(entry, fallback = 'image/png') {
  const value = entry?.mime_type || entry?.mimeType;
  if (typeof value === 'string' && value.startsWith('image/')) return value;
  return fallback;
}

async function blobFromUrl(url, signal) {
  if (typeof url !== 'string' || !url) {
    throw new OpenCodeError('OPENCODE_INVALID_RESPONSE', 'The image response did not include image data.', {
      action: 'Try again.'
    });
  }
  if (url.startsWith('data:')) {
    const [header, payload] = url.split(',', 2);
    const mimeMatch = /^data:([^;]+)/.exec(header || '');
    const mime = mimeMatch?.[1] || 'image/png';
    if (header?.includes(';base64')) return { blob: new Blob([decodeBase64(payload)], { type: mime }), mime };
    return { blob: new Blob([decodeURIComponent(payload || '')], { type: mime }), mime };
  }
  let response;
  try {
    response = await fetch(url, { signal, mode: 'cors', credentials: 'omit' });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new OpenCodeError('OPENCODE_ABORTED', 'The image download was cancelled.', {
        action: 'Start a new generation when you are ready.'
      });
    }
    throw new OpenCodeError('OPENCODE_ASSET_FETCH_FAILED', 'The generated image could not be downloaded by this browser.', {
      action: 'The image host may not allow browser downloads. Try another provider or open the image URL directly.',
      details: { reason: redact(error?.message || 'Network or CORS failure') }
    });
  }
  if (!response.ok) {
    throw new OpenCodeError('OPENCODE_ASSET_FETCH_FAILED', `The image host returned HTTP ${response.status}.`, {
      status: response.status,
      action: 'Try another provider or download the image directly.'
    });
  }
  const type = response.headers.get('content-type') || 'image/png';
  const mime = type.startsWith('image/') ? type.split(';')[0] : 'image/png';
  return { blob: await response.blob(), mime };
}

export async function testConnection(overrides = {}) {
  const config = configFor(overrides);
  const officialCatalog = officialCatalogUrl(config.baseUrl);
  let catalogUrl = officialCatalog || `${config.baseUrl}/models`;
  try {
    let result = await fetchJson(catalogUrl, {
      apiKey: config.apiKey,
      signal: overrides.signal,
      timeoutMs: overrides.timeoutMs
    });
    if (result.response.status === 404 && catalogUrl !== `${config.baseUrl}/models`) {
      catalogUrl = `${config.baseUrl}/models`;
      result = await fetchJson(catalogUrl, {
        apiKey: config.apiKey,
        signal: overrides.signal,
        timeoutMs: overrides.timeoutMs
      });
    }
    const { response, data } = result;
    if (!response.ok) {
      const error = errorFromResponse(response, data, parseRetryAfter(response.headers.get('retry-after')));
      const catalogMissing = response.status === 404 || response.status === 410;
      return {
        ok: false,
        baseUrl: config.baseUrl,
        catalogUrl,
        models: [],
        imageModels: [],
        corsBlocked: false,
        reason: catalogMissing ? 'OPENCODE_CATALOG_UNAVAILABLE' : error.code,
        message: catalogMissing ? 'The endpoint does not expose an OpenAI-compatible /models catalog.' : error.message
      };
    }
    const found = extractModels(data);
    const models = found.map(item => item.id);
    const imageModels = found.filter(item => isImageModel(item.entry)).map(item => item.id);
    return {
      ok: true,
      baseUrl: config.baseUrl,
      catalogUrl,
      models,
      imageModels,
      corsBlocked: false,
      reason: imageModels.length ? null : 'OPENCODE_NO_IMAGE_MODEL',
      message: imageModels.length
        ? `Found ${imageModels.length} image model${imageModels.length === 1 ? '' : 's'}.`
        : 'The endpoint is reachable but its model catalog has no image-generation model.',
      modelDetails: found.map(item => item.entry)
    };
  } catch (error) {
    const described = describeError(error);
    return {
      ok: false,
      baseUrl: config.baseUrl,
      catalogUrl,
      models: [],
      imageModels: [],
      corsBlocked: described.code === 'OPENCODE_CORS_BLOCKED',
      reason: described.code,
      message: described.message
    };
  }
}

export async function generateImage({ prompt, model, size = '1024x1024', n = 1, signal, baseUrl, apiKey, timeoutMs } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new OpenCodeError('OPENCODE_INVALID_REQUEST', 'A prompt is required.', {
      action: 'Describe the image you want to generate.'
    });
  }
  const config = configFor({ baseUrl, apiKey, model });
  if (!config.apiKey) {
    throw new OpenCodeError('OPENCODE_MISSING_KEY', 'No OpenCode API key is configured.', {
      action: 'Add an OpenCode API key in AI settings.'
    });
  }
  let chosenModel = config.model;
  if (!chosenModel) {
    const capability = await testConnection({ baseUrl: config.baseUrl, apiKey: config.apiKey, signal });
    chosenModel = capability.imageModels[0] || '';
    if (!chosenModel) {
      throw new OpenCodeError('OPENCODE_NO_IMAGE_MODEL', 'The endpoint catalog has no image-generation model.', {
        action: 'Point the base URL at a CORS-enabled OpenAI-compatible provider that serves an image model.'
      });
    }
  }
  const payload = {
    model: chosenModel || DEFAULT_OPENCODE_MODEL,
    prompt: prompt.trim(),
    n: Math.max(1, Math.min(4, Math.round(Number(n) || 1))),
    size: typeof size === 'string' && size ? size : '1024x1024',
    response_format: 'b64_json'
  };
  const { response, data, retryAfter } = await fetchJson(`${config.baseUrl}/images/generations`, {
    method: 'POST',
    apiKey: config.apiKey,
    body: payload,
    signal,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_IMAGE_TIMEOUT_MS
  });
  if (!response.ok) throw errorFromResponse(response, data, retryAfter);

  const entries = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  const entry = entries.find(item => item && (item.b64_json || item.url));
  if (!entry) {
    throw new OpenCodeError('OPENCODE_NO_IMAGE_MODEL', 'The endpoint returned no image data.', {
      action: 'Use a CORS-enabled OpenAI-compatible image endpoint or choose another provider.',
      details: { providerMessage: messageFromBody(data, 'No image data in the response.') }
    });
  }

  let blob;
  let mime = mimeFromData(entry);
  if (entry.b64_json) {
    blob = new Blob([decodeBase64(entry.b64_json)], { type: mime });
  } else {
    const downloaded = await blobFromUrl(entry.url, signal);
    blob = downloaded.blob;
    mime = downloaded.mime;
  }
  return {
    blob,
    mime,
    model: payload.model,
    revisedPrompt: typeof entry.revised_prompt === 'string' ? entry.revised_prompt : null
  };
}

export function describeError(error) {
  if (error?.code && typeof error.code === 'string') {
    const code = error.code;
    const actions = {
      OPENCODE_CORS_BLOCKED: 'Use a CORS-enabled OpenCode-compatible base URL, or run the request through a gateway that sends CORS headers.',
      OPENCODE_NO_IMAGE_MODEL: 'Point the base URL at a CORS-enabled OpenAI-compatible provider that serves an image model.',
      OPENCODE_MISSING_KEY: 'Add an OpenCode API key in AI settings.',
      OPENCODE_UNAUTHORIZED: 'Check the OpenCode key and save it again.',
      OPENCODE_PAYMENT_REQUIRED: 'Use a key with available paid credits or choose another image provider.',
      OPENCODE_RATE_LIMITED: 'Wait for the retry window and try again.',
      OPENCODE_INVALID_REQUEST: 'Check the model, size, prompt, and response format.',
      OPENCODE_INVALID_RESPONSE: 'Try again.',
      OPENCODE_ASSET_FETCH_FAILED: 'The image host may not allow browser downloads. Try another provider or open the image URL directly.',
      OPENCODE_ABORTED: 'Start a new generation when you are ready.',
      OPENCODE_TIMEOUT: 'Try again with a shorter request.',
      OPENCODE_CATALOG_UNAVAILABLE: 'Use a base URL that exposes an OpenAI-compatible /models catalog.',
      OPENCODE_HTTP_ERROR: 'Try again. If the problem persists, check the endpoint status.'
    };
    return {
      code,
      message: redact(error.message || 'OpenCode request failed.'),
      action: error.action || actions[code] || 'Try again.'
    };
  }
  if (error instanceof TypeError) {
    return {
      code: 'OPENCODE_CORS_BLOCKED',
      message: 'The browser could not call this OpenCode endpoint.',
      action: 'Use a CORS-enabled OpenCode-compatible base URL, or run the request through a gateway that sends CORS headers.'
    };
  }
  return {
    code: 'OPENCODE_ERROR',
    message: redact(error?.message || 'OpenCode request failed.'),
    action: 'Try again.'
  };
}

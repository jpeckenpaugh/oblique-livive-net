export const SETTINGS_STORAGE_KEY = 'oblique.ai.settings.v1';
export const DEFAULT_OPENCODE_BASE_URL = 'https://opencode.ai/inference/openai/v1';
export const DEFAULT_OPENCODE_MODEL = 'gpt-image-1';

const STORAGE_VERSION = 1;
const IMAGE_PROVIDERS = new Set(['meshy', 'opencode', 'custom']);
const listeners = new Set();
let storageListenerBound = false;

function storageFor(kind) {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function readStorage(kind) {
  const storage = storageFor(kind);
  if (!storage) return {};
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStorage(kind, value) {
  const storage = storageFor(kind);
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeStorage(kind) {
  const storage = storageFor(kind);
  if (!storage) return;
  try {
    storage.removeItem(SETTINGS_STORAGE_KEY);
  } catch {
  }
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function providerSettings(raw, provider) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) && raw[provider] && typeof raw[provider] === 'object'
    ? raw[provider]
    : {};
  const value = {
    apiKey: Object.prototype.hasOwnProperty.call(source, 'apiKey') ? text(source.apiKey) : undefined,
    remember: typeof source.remember === 'boolean' ? source.remember : undefined
  };
  if (provider === 'opencode') {
    value.baseUrl = typeof source.baseUrl === 'string' && source.baseUrl.trim() ? source.baseUrl.trim() : undefined;
    value.model = typeof source.model === 'string' && source.model.trim() ? source.model.trim() : undefined;
  }
  return value;
}

function mergeProvider(local, session, provider, defaults) {
  const merged = providerSettings(local, provider);
  const hasSessionProvider = session && typeof session === 'object' && session[provider] && typeof session[provider] === 'object';
  if (hasSessionProvider) {
    const sessionValue = providerSettings(session, provider);
    for (const [key, value] of Object.entries(sessionValue)) {
      if (value !== undefined) merged[key] = value;
    }
  }
  if (provider === 'meshy') {
    return {
      apiKey: merged.apiKey || '',
      remember: merged.remember ?? defaults.remember
    };
  }
  return {
    baseUrl: merged.baseUrl || defaults.baseUrl,
    apiKey: merged.apiKey || '',
    model: merged.model || defaults.model,
    remember: merged.remember ?? defaults.remember
  };
}

export function getSettings() {
  const local = readStorage('local');
  const session = readStorage('session');
  const meshyDefaults = { remember: true };
  const opencodeDefaults = { baseUrl: DEFAULT_OPENCODE_BASE_URL, model: DEFAULT_OPENCODE_MODEL, remember: true };
  const meshy = mergeProvider(local, session, 'meshy', meshyDefaults);
  const opencode = mergeProvider(local, session, 'opencode', opencodeDefaults);
  const imageProvider = IMAGE_PROVIDERS.has(local.imageProvider)
    ? local.imageProvider
    : (IMAGE_PROVIDERS.has(session.imageProvider) ? session.imageProvider : 'meshy');
  const updatedAt = text(session.updatedAt, text(local.updatedAt)) || null;
  return {
    version: STORAGE_VERSION,
    meshy,
    opencode,
    imageProvider,
    updatedAt
  };
}

function notify(settings) {
  for (const listener of [...listeners]) {
    try {
      listener(settings);
    } catch {
    }
  }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('oblique:ai-settings-change', { detail: settings }));
    }
  } catch {
  }
}

function bindStorageListener() {
  if (storageListenerBound || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  storageListenerBound = true;
  window.addEventListener('storage', event => {
    if (event.key === SETTINGS_STORAGE_KEY) notify(getSettings());
  });
}

export function saveSettings(partial = {}) {
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) throw new TypeError('saveSettings expects an object.');
  const previous = getSettings();
  const next = {
    version: STORAGE_VERSION,
    meshy: { ...previous.meshy, ...(partial.meshy && typeof partial.meshy === 'object' ? partial.meshy : {}) },
    opencode: { ...previous.opencode, ...(partial.opencode && typeof partial.opencode === 'object' ? partial.opencode : {}) },
    imageProvider: IMAGE_PROVIDERS.has(partial.imageProvider) ? partial.imageProvider : previous.imageProvider,
    updatedAt: new Date().toISOString()
  };
  next.meshy.apiKey = text(next.meshy.apiKey);
  next.meshy.remember = bool(next.meshy.remember, true);
  next.opencode.baseUrl = text(next.opencode.baseUrl, DEFAULT_OPENCODE_BASE_URL) || DEFAULT_OPENCODE_BASE_URL;
  next.opencode.apiKey = text(next.opencode.apiKey);
  next.opencode.model = text(next.opencode.model, DEFAULT_OPENCODE_MODEL) || DEFAULT_OPENCODE_MODEL;
  next.opencode.remember = bool(next.opencode.remember, true);

  const local = {
    version: STORAGE_VERSION,
    meshy: { remember: next.meshy.remember },
    opencode: {
      baseUrl: next.opencode.baseUrl,
      model: next.opencode.model,
      remember: next.opencode.remember
    },
    imageProvider: next.imageProvider,
    updatedAt: next.updatedAt
  };
  const session = { version: STORAGE_VERSION, updatedAt: next.updatedAt };
  let sessionHasSecrets = false;

  if (next.meshy.remember) {
    local.meshy.apiKey = next.meshy.apiKey;
  } else {
    session.meshy = { apiKey: next.meshy.apiKey, remember: false };
    sessionHasSecrets = true;
  }
  if (next.opencode.remember) {
    local.opencode.apiKey = next.opencode.apiKey;
  } else {
    session.opencode = { apiKey: next.opencode.apiKey, remember: false };
    sessionHasSecrets = true;
  }

  writeStorage('local', local);
  if (sessionHasSecrets) writeStorage('session', session);
  else removeStorage('session');

  const saved = getSettings();
  notify(saved);
  return saved;
}

export function clearAllSecrets() {
  removeStorage('local');
  removeStorage('session');
  notify(getSettings());
}

export function onSettingsChange(listener) {
  if (typeof listener !== 'function') throw new TypeError('onSettingsChange expects a function.');
  bindStorageListener();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== 'undefined') {
  bindStorageListener();
}

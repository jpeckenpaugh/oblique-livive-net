export const ASSET_DB_NAME = 'oblique-ai';
export const ASSET_DB_VERSION = 1;
export const ASSET_STORE_NAME = 'assets';
export const MAX_ASSET_BYTES = 50 * 1024 * 1024;

const objectUrls = new Map();
const pendingObjectUrls = new Map();
let databasePromise = null;

export class AssetStoreError extends Error {
  constructor(code, message, action = '') {
    super(message);
    this.name = 'AssetStoreError';
    this.code = code;
    this.action = action;
  }
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new AssetStoreError(
      'ASSET_STORAGE_UNAVAILABLE',
      'IndexedDB is not available in this browser.',
      'Use a browser that allows local storage for this site.'
    ));
  }
  databasePromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(ASSET_DB_NAME, ASSET_DB_VERSION);
    } catch (error) {
      reject(new AssetStoreError('ASSET_STORAGE_UNAVAILABLE', 'IndexedDB could not be opened.', error?.message || ''));
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSET_STORE_NAME)) {
        const store = database.createObjectStore(ASSET_STORE_NAME, { keyPath: 'id' });
        store.createIndex('kind', 'kind', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(new AssetStoreError(
        'ASSET_STORAGE_UNAVAILABLE',
        'IndexedDB could not be opened.',
        'Check that this site is allowed to store data.'
      ));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new AssetStoreError(
        'ASSET_STORAGE_BLOCKED',
        'IndexedDB is blocked by another tab.',
        'Close other Oblique tabs and try again.'
      ));
    };
  });
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new AssetStoreError('ASSET_STORAGE_ERROR', 'An asset storage request failed.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new AssetStoreError('ASSET_STORAGE_ERROR', 'An asset storage transaction failed.'));
    transaction.onabort = () => reject(new AssetStoreError('ASSET_STORAGE_ERROR', 'An asset storage transaction was aborted.'));
  });
}

function metadataOf(record) {
  const { blob, ...meta } = record;
  return meta;
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value, limit = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function normalizeBlob(blob, mime) {
  if (typeof Blob !== 'undefined' && blob instanceof Blob) return blob;
  if (blob instanceof ArrayBuffer) return new Blob([blob], { type: mime || 'application/octet-stream' });
  if (ArrayBuffer.isView(blob)) return new Blob([blob], { type: mime || 'application/octet-stream' });
  throw new AssetStoreError('ASSET_INVALID_BLOB', 'The asset must be a Blob.', 'Provide binary asset data.');
}

export async function putAsset({ kind = 'image', blob, mime = '', width = null, height = null, provider = '', prompt = '', name = '' } = {}) {
  const value = normalizeBlob(blob, mime);
  const size = Number(value.size) || 0;
  if (size > MAX_ASSET_BYTES) {
    throw new AssetStoreError(
      'ASSET_TOO_LARGE',
      `The asset is ${(size / (1024 * 1024)).toFixed(1)} MB; the limit is ${MAX_ASSET_BYTES / (1024 * 1024)} MB.`,
      'Generate a smaller asset or download it instead of storing it.'
    );
  }
  const id = makeId();
  const meta = {
    id,
    kind: normalizeText(kind, 32) || 'image',
    mime: normalizeText(mime || value.type || 'application/octet-stream', 120),
    size,
    width: normalizeNumber(width),
    height: normalizeNumber(height),
    provider: normalizeText(provider, 32),
    prompt: normalizeText(prompt, 1000),
    name: normalizeText(name, 120),
    createdAt: new Date().toISOString()
  };
  const database = await openDatabase();
  const transaction = database.transaction(ASSET_STORE_NAME, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(ASSET_STORE_NAME).put({ ...meta, blob: value });
  await done;
  return meta;
}

export async function getAsset(id) {
  if (typeof id !== 'string' || !id) throw new AssetStoreError('ASSET_NOT_FOUND', 'An asset id is required.');
  const database = await openDatabase();
  const transaction = database.transaction(ASSET_STORE_NAME, 'readonly');
  const done = transactionDone(transaction);
  const record = await requestResult(transaction.objectStore(ASSET_STORE_NAME).get(id));
  await done;
  if (!record) throw new AssetStoreError('ASSET_NOT_FOUND', 'The saved asset could not be found.', 'Generate the asset again.');
  return { ...metadataOf(record), blob: record.blob };
}

export async function listAssets(kind) {
  const database = await openDatabase();
  const transaction = database.transaction(ASSET_STORE_NAME, 'readonly');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(ASSET_STORE_NAME);
  const records = [];
  await new Promise((resolve, reject) => {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const record = cursor.value;
      if (!kind || record.kind === kind) records.push(metadataOf(record));
      cursor.continue();
    };
    request.onerror = () => reject(new AssetStoreError('ASSET_STORAGE_ERROR', 'Saved assets could not be listed.'));
  });
  await done;
  return records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function deleteAsset(id) {
  if (typeof id !== 'string' || !id) return;
  const cached = objectUrls.get(id);
  if (cached) {
    try {
      URL.revokeObjectURL(cached);
    } catch {
    }
    objectUrls.delete(id);
  }
  const database = await openDatabase();
  const transaction = database.transaction(ASSET_STORE_NAME, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(ASSET_STORE_NAME).delete(id);
  await done;
}

export async function objectUrlFor(id) {
  if (objectUrls.has(id)) return objectUrls.get(id);
  if (pendingObjectUrls.has(id)) return pendingObjectUrls.get(id);
  const pending = getAsset(id).then(asset => {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      throw new AssetStoreError('ASSET_STORAGE_UNAVAILABLE', 'Object URLs are not available in this browser.');
    }
    const url = URL.createObjectURL(asset.blob);
    objectUrls.set(id, url);
    pendingObjectUrls.delete(id);
    return url;
  }).catch(error => {
    pendingObjectUrls.delete(id);
    throw error;
  });
  pendingObjectUrls.set(id, pending);
  return pending;
}

export function revokeObjectUrl(id) {
  const url = objectUrls.get(id);
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
  }
  objectUrls.delete(id);
}

export async function clearAssets() {
  for (const id of [...objectUrls.keys()]) revokeObjectUrl(id);
  const database = await openDatabase();
  const transaction = database.transaction(ASSET_STORE_NAME, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(ASSET_STORE_NAME).clear();
  await done;
}

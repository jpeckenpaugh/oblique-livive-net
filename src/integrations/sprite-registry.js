import { getAsset, objectUrlFor, deleteAsset } from './asset-store.js';

export const SPRITE_STORAGE_KEY = 'oblique.ai.sprites.v1';
const TILE_PX = 64;
const MAX_TILE_SPAN = 6;

let spriteRegistrar = null;
let spriteUnregistrar = null;

export class SpriteRegistryError extends Error {
  constructor(code, message, action = '') {
    super(message);
    this.name = 'SpriteRegistryError';
    this.code = code;
    this.action = action;
  }
}

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function clampSpan(value) {
  return Math.max(.5, Math.min(MAX_TILE_SPAN, Math.round(value * 100) / 100));
}

function readRecords() {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(SPRITE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.sprites) ? parsed.sprites : []);
    return list.filter(record => record
      && typeof record.id === 'string'
      && typeof record.assetId === 'string'
      && record.id
      && record.assetId);
  } catch {
    return [];
  }
}

function writeRecords(records) {
  const store = storage();
  if (!store) {
    throw new SpriteRegistryError(
      'SPRITE_STORAGE_UNAVAILABLE',
      'Custom sprite metadata cannot be saved in this browser.',
      'Check that this site is allowed to store data.'
    );
  }
  try {
    store.setItem(SPRITE_STORAGE_KEY, JSON.stringify(records));
  } catch {
    throw new SpriteRegistryError(
      'SPRITE_STORAGE_ERROR',
      'Custom sprite metadata could not be saved.',
      'Free some browser storage and try again.'
    );
  }
}

function recordMeta(record) {
  return {
    id: record.id,
    assetId: record.assetId,
    name: record.name,
    fw: record.fw,
    fh: record.fh,
    width: record.width,
    height: record.height,
    defaultScale: record.defaultScale,
    createdAt: record.createdAt
  };
}

function footprint(width, height) {
  const longest = Math.max(width, height);
  if (!longest) return { width: 1, height: 1 };
  const scale = 2 / longest;
  return {
    width: clampSpan(width * scale),
    height: clampSpan(height * scale)
  };
}

function nameFromPrompt(prompt, id) {
  const text = typeof prompt === 'string' ? prompt.replace(/\s+/g, ' ').trim() : '';
  if (text) return text.length > 40 ? `${text.slice(0, 37)}…` : text;
  return `AI image ${String(id).slice(0, 6)}`;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new SpriteRegistryError(
      'SPRITE_IMAGE_LOAD_FAILED',
      'A saved sprite image could not be loaded.',
      'Remove the sprite and generate it again.'
    )), { once: true });
    image.src = url;
  });
}

async function resolvePixelSize(assetId, meta) {
  let width = positive(meta?.width);
  let height = positive(meta?.height);
  if (width && height) return { width, height };
  const url = await objectUrlFor(assetId);
  const image = await loadImage(url);
  width = width || image.naturalWidth;
  height = height || image.naturalHeight;
  return { width, height };
}

function buildType(record, url, image) {
  return {
    id: record.id,
    assetId: record.assetId,
    name: record.name,
    image: url,
    img: image,
    fw: positive(record.fw) || positive(image?.naturalWidth) || 0,
    fh: positive(record.fh) || positive(image?.naturalHeight) || 0,
    cols: 1,
    frames: 1,
    animated: false,
    width: positive(record.width) || 1,
    height: positive(record.height) || 1,
    defaultScale: positive(record.defaultScale) || 1,
    aiDefault: false,
    custom: true
  };
}

async function registerType(type) {
  if (spriteRegistrar) {
    await spriteRegistrar(type);
    return;
  }
  if (typeof window !== 'undefined' && typeof window.ObliqueAI?.registerSpriteType === 'function') {
    window.ObliqueAI.registerSpriteType(type);
  }
}

function emit(name, detail) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
  } catch {
  }
}

export function setSpriteRegistrar(registerFn, unregisterFn = null) {
  spriteRegistrar = typeof registerFn === 'function' ? registerFn : null;
  spriteUnregistrar = typeof unregisterFn === 'function' ? unregisterFn : null;
}

export async function registerImageAsset(assetMeta, options = {}) {
  const source = typeof assetMeta === 'string' ? await getAsset(assetMeta) : assetMeta;
  const sourceId = source?.assetId ?? source?.id;
  if (typeof sourceId !== 'string' || !sourceId) {
    throw new SpriteRegistryError('SPRITE_INVALID_ASSET', 'A saved image asset is required.', 'Store the image before registering it as a sprite.');
  }
  const assetId = String(sourceId);
  const existing = readRecords().find(record => record.assetId === assetId);
  if (existing && !options.replace) {
    const url = await objectUrlFor(assetId);
    const image = await loadImage(url);
    const type = buildType(existing, url, image);
    await registerType(type);
    return type;
  }

  const pixels = await resolvePixelSize(assetId, source);
  const tiles = footprint(pixels.width, pixels.height);
  const record = {
    id: `custom-${assetId}`,
    assetId,
    name: typeof options.name === 'string' && options.name.trim()
      ? options.name.trim().slice(0, 120)
      : (typeof source.name === 'string' && source.name.trim() ? source.name.trim().slice(0, 120) : nameFromPrompt(source.prompt, assetId)),
    fw: pixels.width,
    fh: pixels.height,
    width: positive(options.width) || tiles.width,
    height: positive(options.height) || tiles.height,
    defaultScale: positive(options.defaultScale) || 1,
    createdAt: source.createdAt || new Date().toISOString()
  };
  const records = readRecords().filter(item => item.assetId !== assetId && item.id !== record.id);
  records.push(record);
  writeRecords(records);

  const url = await objectUrlFor(assetId);
  const image = await loadImage(url);
  const type = buildType(record, url, image);
  await registerType(type);
  emit('oblique:ai-sprite-added', { type: recordMeta(record) });
  return type;
}

export async function listCustomSprites() {
  const records = readRecords();
  const types = [];
  const kept = [];
  for (const record of records) {
    try {
      const url = await objectUrlFor(record.assetId);
      const image = await loadImage(url);
      types.push(buildType(record, url, image));
      kept.push(record);
    } catch (error) {
      if (error?.code !== 'ASSET_NOT_FOUND') kept.push(record);
    }
  }
  if (kept.length !== records.length) {
    try {
      writeRecords(kept);
    } catch {
    }
  }
  return types;
}

export async function restoreCustomSprites() {
  const types = await listCustomSprites();
  for (const type of types) await registerType(type);
  emit('oblique:ai-sprites-restored', { sprites: types.map(type => ({ id: type.id, assetId: type.assetId, name: type.name })) });
  return types;
}

export async function removeCustomSprite(id) {
  const records = readRecords();
  const record = records.find(item => item.id === id || item.assetId === id);
  if (!record) return false;
  writeRecords(records.filter(item => item !== record));
  if (spriteUnregistrar) {
    try {
      await spriteUnregistrar(record.id);
    } catch {
    }
  }
  try {
    await deleteAsset(record.assetId);
  } catch {
  }
  emit('oblique:ai-sprite-removed', { type: recordMeta(record) });
  return true;
}

export { TILE_PX };

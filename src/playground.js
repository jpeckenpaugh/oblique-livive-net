import { restoreCustomSprites, setSpriteRegistrar } from './integrations/sprite-registry.js';

const SIZE = 64;
const GRID = 16;
const PAD = 0;
const PLAY_SIZE = 16;
const canvas = document.getElementById('playground');
const ctx = canvas.getContext('2d');

const terrain = Array.from({ length: GRID }, () => Array(GRID).fill('grass'));
const player = { x: PAD + 5, y: PAD + 5, fromX: PAD + 5, fromY: PAD + 5, toX: PAD + 5, toY: PAD + 5, moving: false, elapsed: 0, direction: 0, anim: 0 };
const sprite = new Image();
sprite.src = 'rukiya-walking-walking-animation-palette.webp';
let brush = 'walk';
let rukiyaSelected = false;
let last = performance.now();
let paintDown = false;
const colors = { grass: '#4e8950', dirt: '#98704a', sand: '#d0b876', water: '#347da0', field: '#82934b' };
const spriteTypes = [
  { id: 'palm', name: 'Palm tree', image: 'tropical-palm-tree-turntable-palette.webp', fw: 512, fh: 512, cols: 4, frames: 8, width: 2.5, height: 2.5, defaultScale: 1.5 },
  { id: 'hut-turntable', name: 'Fisherman hut · turntable', image: 'fisherman-hut-turntable-palette.webp', fw: 512, fh: 512, cols: 4, frames: 8, width: 2.5, height: 2.5, defaultScale: 2 },
  { id: 'hut-single', name: 'Fisherman hut · single view', image: 'fisherman-hut-0deg-single.webp', width: 1.55, height: 2.4, defaultScale: 2 },
  { id: 'house-turntable', name: 'Fisher’s cottage · turntable', image: 'fishers-house-turntable-palette.webp', fw: 128, fh: 128, cols: 4, frames: 4, width: 2.5, height: 2.5, defaultScale: 2 },
  { id: 'house-single', name: 'Fisher’s cottage · single view', image: 'fishers-house-0deg-single.webp', width: 2.23, height: 2.5, defaultScale: 2 },
  { id: 'longhouse-turntable', name: 'Longhouse · turntable', image: 'longhouse-turntable-palette.webp', fw: 1280, fh: 720, cols: 4, frames: 8, width: 3.5, height: 1.97, defaultScale: 3 },
  { id: 'longhouse-single', name: 'Longhouse · single view', image: 'longhouse-0deg-single.webp', width: 3.5, height: 1.66, defaultScale: 3 },
  { id: 'barrel', name: 'Wooden barrel', image: 'wooden-barrel-turntable-palette.webp', fw: 128, fh: 128, cols: 4, frames: 8, width: .85, height: .85 },
  { id: 'rock', name: 'Rock pile', image: 'rock-pile-turntable-palette.webp', fw: 64, fh: 64, cols: 4, frames: 8, width: .9, height: .9 },
  { id: 'net', name: 'Fisher’s net', image: 'fishers-net-turntable-palette.webp', fw: 128, fh: 128, cols: 4, frames: 12, width: 1.2, height: 1.1 },
  { id: 'dock', name: 'Wooden dock', image: 'wooden-dock-turntable-palette.webp', fw: 128, fh: 128, cols: 4, frames: 12, width: 1.3, height: 1.2 },
  { id: 'piranha', name: 'Piranha', image: 'piranha-turntable-palette.webp', fw: 128, fh: 128, cols: 4, frames: 12, width: 1.2, height: 1.2, aiDefault: true },
  { id: 'eel', name: 'River eel', image: 'river-eel-turntable-palette.webp', fw: 128, fh: 128, cols: 4, frames: 8, width: 1.2, height: 1.2, aiDefault: true },
  { id: 'rat', name: 'River rat', image: 'river-rat-walking-armature-unreal-take-baselayer-animation-palette.webp', fw: 128, fh: 128, cols: 8, frames: 4, animated: true, width: 1.25, height: 1.25, aiDefault: true },
  { id: 'shuppy', name: 'Shuppy', image: 'shuppy-walking-armature-unreal-take-baselayer-animation-palette.webp', fw: 128, fh: 128, cols: 8, frames: 4, animated: true, width: 1.25, height: 1.25, aiDefault: true },
  { id: 'picken', name: 'Picken', image: 'pig-chicken-walking-armature-unreal-take-baselayer-animation-palette.webp', fw: 128, fh: 128, cols: 8, frames: 4, animated: true, width: 1.25, height: 1.25, aiDefault: true }
].map(type => {
  const img = new Image();
  img.src = type.image;
  const entry = { ...type, cols: type.cols || 1, frames: type.frames || 1, fw: type.fw || 0, fh: type.fh || 0, img };
  img.addEventListener('load', () => {
    entry.fw ||= img.naturalWidth;
    entry.fh ||= img.naturalHeight;
  });
  return entry;
});
const placedSprites = [];
let armedSprite = null;
let selectedSprite = null;
let nextSpriteId = 1;
let aiPlaying = false;
let lastPaintCell = null;
const SCENE_STORAGE_KEY = 'oblique.playground.scenes.v1';
let savedScenes = [];
let activeLayoutId = null;
let readOnlyView = false;
let editorBeforeView = null;
let eventSceneId = null;
let editingEventIndex = null;
let sequencePlayback = null;
let activeMessage = null;
try {
  const stored = JSON.parse(localStorage.getItem(SCENE_STORAGE_KEY) || '[]');
  if (Array.isArray(stored)) savedScenes = stored.filter(scene => scene && typeof scene.id === 'string' && typeof scene.name === 'string');
} catch {
  savedScenes = [];
}

function loadScene(name) {
  placedSprites.length = 0;
  selectedSprite = null;
  armedSprite = null;
  activeLayoutId = null;
  sequencePlayback = null;
  activeMessage = null;
  document.getElementById('scene-name').value = '';
  document.getElementById('placed-controls').hidden = true;
  showRukiyaControls(false);
  selectWalkTool();
  aiPlaying = false;
  const playButton = document.getElementById('ai-toggle');
  playButton.textContent = 'Play NPCs';
  playButton.setAttribute('aria-pressed', 'false');
  for (const row of terrain) row.fill('grass');
  const set = (x, y, type) => {
    if (x >= 0 && y >= 0 && x < GRID && y < GRID) terrain[y][x] = type;
  };
  if (name === 'fields') {
    // Broad cultivated blocks separated by grassy edges and dirt tracks.
    for (let y = 2; y < 14; y++) for (let x = 1; x < 15; x++) {
      if ((x < 5 || x > 10) && y > 2 && y < 13) set(x, y, 'field');
    }
    for (let x = 0; x < GRID; x++) { set(x, 7, 'dirt'); set(x, 8, 'dirt'); }
  } else if (name === 'beach') {
    for (let y = 0; y < GRID; y++) {
      const shore = Math.round(9 + Math.sin(y * .48) * 1.5);
      for (let x = shore - 1; x < GRID; x++) set(x, y, x < shore + 1 ? 'sand' : 'water');
    }
  } else if (name === 'island') {
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      const d = Math.hypot((x - 7.5) / 1.03, (y - 7.5) / .82);
      if (d < 6.2) set(x, y, d > 4.8 ? 'sand' : 'grass');
      else set(x, y, 'water');
    }
  } else if (name === 'underwater') {
    for (const row of terrain) row.fill('water');
    for (let y = 11; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      if (y > 12 || ((x * 7 + y * 3) % 9 < 5)) set(x, y, 'sand');
    }
    // Submerged grass patches suggest kelp beds.
    for (const [x, y] of [[2,10],[3,9],[4,10],[10,8],[11,9],[12,8],[7,12],[8,11]]) set(x,y,'grass');
  } else if (name === 'river') {
    for (let y = 0; y < GRID; y++) {
      const center = 8 + Math.sin(y * .42) * 2;
      for (let x = 0; x < GRID; x++) {
        const distance = Math.abs(x - center);
        if (distance < 2.5) set(x, y, 'water');
        else if (distance < 3.5) set(x, y, 'sand');
      }
    }
  } else if (name === 'stream') {
    for (let x = 0; x < GRID; x++) {
      const center = 8 + Math.sin(x * .55) * 2;
      for (let y = 0; y < GRID; y++) {
        const distance = Math.abs(y - center);
        if (distance < .9) set(x, y, 'water');
        else if (distance < 1.9) set(x, y, 'sand');
      }
    }
  }
  const preferred = { x: 5, y: 5 };
  let safe = preferred;
  if (terrain[safe.y][safe.x] === 'water') {
    let bestDistance = Infinity;
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      const distance = Math.abs(x - preferred.x) + Math.abs(y - preferred.y);
      if (terrain[y][x] !== 'water' && distance < bestDistance) { safe = { x, y }; bestDistance = distance; }
    }
  }
  player.x = player.fromX = player.toX = safe.x;
  player.y = player.fromY = player.toY = safe.y;
  player.moving = false;
  player.anim = 0;
  player.direction = 0;
  player.visible = true;
  renderSavedScenes();
  document.querySelectorAll('.scene').forEach(button => button.classList.toggle('active', button.dataset.scene === name));
}

function makeSceneId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function sceneSnapshot() {
  const playerProgress = player.moving ? Math.min(1, player.elapsed / .18) : 1;
  return {
    version: 1,
    terrain: terrain.map(row => [...row]),
    player: {
      x: Math.round(player.fromX + (player.toX - player.fromX) * playerProgress),
      y: Math.round(player.fromY + (player.toY - player.fromY) * playerProgress),
      direction: player.direction,
      visible: player.visible !== false
    },
    sprites: placedSprites.map(object => {
      const progress = object.aiMoving ? Math.min(1, object.aiElapsed / object.aiDuration) : 1;
      return {
        id: object.id,
        type: object.type.id,
        x: Math.round(object.aiMoving ? object.fromX + (object.toX - object.fromX) * progress : object.x),
        y: Math.round(object.aiMoving ? object.fromY + (object.toY - object.fromY) * progress : object.y),
        frame: object.frame,
        scale: object.scale,
        aiEnabled: object.aiEnabled,
        visible: object.visible !== false
      };
    })
  };
}
function persistScenes() {
  try {
    localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(savedScenes));
    return true;
  } catch {
    setSceneMessage('Could not save to browser storage.');
    return false;
  }
}
function setSceneMessage(message = '') {
  document.getElementById('scene-message').textContent = message;
}
function saveCurrentScene() {
  const input = document.getElementById('scene-name');
  const name = input.value.trim();
  if (!name) { setSceneMessage('Enter a name for this scene.'); input.focus(); return; }
  const matching = savedScenes.find(scene => scene.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  const record = { ...(matching || {}), id: matching?.id || makeSceneId(), name, layout: sceneSnapshot(), events: matching?.events || [] };
  if (matching) savedScenes[savedScenes.indexOf(matching)] = record;
  else savedScenes.push(record);
  activeLayoutId = record.id;
  if (!persistScenes()) return;
  renderSavedScenes();
  setSceneMessage(matching ? `Updated “${name}”.` : `Saved “${name}”.`);
}
function exportDocument() {
  for (const scene of savedScenes) {
    ensureSceneSpriteIds(scene);
    scene.events ||= [];
  }
  persistScenes();
  const documentData = {
    format: 'oblique-playground-document',
    version: 1,
    exportedAt: new Date().toISOString(),
    scenes: savedScenes,
    workspace: {
      layout: sceneSnapshot(),
      sceneName: document.getElementById('scene-name').value,
      activeSceneId: activeLayoutId,
      activeTemplate: document.querySelector('.scene.active')?.dataset.scene || null,
      aiPlaying
    }
  };
  const blob = new Blob([JSON.stringify(documentData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `playground-document-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setSceneMessage('Document exported.');
}
function normalizeImportedLayout(layout) {
  if (!layout || !Array.isArray(layout.terrain) || layout.terrain.length !== GRID) throw new Error('A scene must have a 16 × 16 terrain map.');
  const terrainTypes = new Set(['grass', 'dirt', 'sand', 'water', 'field']);
  const terrainData = layout.terrain.map(row => {
    if (!Array.isArray(row) || row.length !== GRID || row.some(type => !terrainTypes.has(type))) throw new Error('The document contains an invalid terrain map.');
    return [...row];
  });
  if (!Array.isArray(layout.sprites)) throw new Error('The document is missing scene sprites.');
  const ids = new Set();
  const sprites = layout.sprites.map(item => {
    const type = spriteTypes.find(entry => entry.id === item.type);
    if (!type || !Number.isInteger(item.id) || ids.has(item.id)) throw new Error('The document contains an invalid sprite or duplicate sprite ID.');
    ids.add(item.id);
    return {
      id: item.id, type: item.type,
      x: Math.max(0, Math.min(GRID - 1, Math.round(Number(item.x) || 0))),
      y: Math.max(0, Math.min(GRID - 1, Math.round(Number(item.y) || 0))),
      frame: Math.max(0, Math.floor(Number(item.frame) || 0)) % type.frames,
      scale: Math.max(.5, Math.min(4, Number(item.scale) || type.defaultScale || 1)),
      aiEnabled: type.aiDefault ? item.aiEnabled !== false : false,
      visible: item.visible !== false
    };
  });
  const savedPlayer = layout.player || {};
  return {
    version: 1,
    terrain: terrainData,
    sprites,
    player: {
      x: Math.max(0, Math.min(GRID - 1, Math.round(Number(savedPlayer.x) || 0))),
      y: Math.max(0, Math.min(GRID - 1, Math.round(Number(savedPlayer.y) || 0))),
      direction: Math.max(0, Math.min(3, Math.floor(Number(savedPlayer.direction) || 0))),
      visible: savedPlayer.visible !== false
    }
  };
}
function normalizeImportedScenes(data) {
  if (data?.format !== 'oblique-playground-document' || data.version !== 1 || !Array.isArray(data.scenes)) {
    throw new Error('This file is not a supported Playground document.');
  }
  const ids = new Set(), names = new Set();
  const scenes = data.scenes.map(scene => {
    const name = typeof scene.name === 'string' ? scene.name.trim() : '';
    const id = typeof scene.id === 'string' ? scene.id : '';
    if (!name || !id || ids.has(id) || names.has(name.toLocaleLowerCase())) throw new Error('Scene names and IDs must be present and unique.');
    ids.add(id); names.add(name.toLocaleLowerCase());
    const layout = normalizeImportedLayout(scene.layout);
    return { id, name: name.slice(0, 48), layout, events: [] };
  });
  for (let i = 0; i < scenes.length; i++) {
    const sourceEvents = data.scenes[i].events || [];
    if (!Array.isArray(sourceEvents)) throw new Error(`Events for “${scenes[i].name}” are invalid.`);
    const sprites = new Set(scenes[i].layout.sprites.map(sprite => String(sprite.id)));
    scenes[i].events = sourceEvents.map(event => {
      if (!event || typeof event !== 'object') throw new Error('The document contains an invalid event.');
      const type = event.type;
      if (type === 'move' || type === 'visibility' || type === 'dialogue') {
        if (event.target !== 'player' && !sprites.has(String(event.target))) throw new Error(`An event in “${scenes[i].name}” points to a missing sprite.`);
      }
      if (type === 'move') return {
        type, target: String(event.target),
        x: Math.max(0, Math.min(GRID - 1, Math.round(Number(event.x) || 0))),
        y: Math.max(0, Math.min(GRID - 1, Math.round(Number(event.y) || 0))),
        duration: Math.max(.1, Math.min(120, Number(event.duration) || 1))
      };
      if (type === 'visibility') return { type, target: String(event.target), visible: event.visible !== false };
      if (type === 'narration' || type === 'dialogue') {
        const text = typeof event.text === 'string' ? event.text.trim() : '';
        if (!text) throw new Error('Narration and dialogue events need text.');
        return { type, ...(type === 'dialogue' ? { target: String(event.target) } : {}), text: text.slice(0, 240), duration: Math.max(.1, Math.min(120, Number(event.duration) || 2)) };
      }
      if (type === 'wait') return { type, duration: Math.max(.1, Math.min(120, Number(event.duration) || 1)) };
      if (type === 'transition') {
        if (typeof event.sceneId !== 'string' || !ids.has(event.sceneId) && !data.scenes.some(item => item.id === event.sceneId)) throw new Error('A transition points to a missing scene.');
        return { type, sceneId: event.sceneId };
      }
      throw new Error(`Unsupported event type: ${type}`);
    });
  }
  const workspace = data.workspace && typeof data.workspace === 'object' ? {
    layout: normalizeImportedLayout(data.workspace.layout),
    sceneName: typeof data.workspace.sceneName === 'string' ? data.workspace.sceneName : '',
    activeSceneId: typeof data.workspace.activeSceneId === 'string' && ids.has(data.workspace.activeSceneId) ? data.workspace.activeSceneId : null,
    activeTemplate: typeof data.workspace.activeTemplate === 'string' ? data.workspace.activeTemplate : null,
    aiPlaying: data.workspace.aiPlaying === true
  } : null;
  return { scenes, workspace };
}
async function importDocument(file) {
  if (!file || readOnlyView) return;
  try {
    const parsed = JSON.parse(await file.text());
    const imported = normalizeImportedScenes(parsed);
    if (!window.confirm(`Replace the current saved scenes and workspace with ${imported.scenes.length} imported scene${imported.scenes.length === 1 ? '' : 's'}?`)) return;
    const previousScenes = savedScenes;
    savedScenes = imported.scenes;
    for (const scene of savedScenes) for (const item of scene.layout.sprites) nextSpriteId = Math.max(nextSpriteId, item.id + 1);
    if (!persistScenes()) { savedScenes = previousScenes; renderSavedScenes(); return; }
    if (imported.workspace) {
      applyLayout(imported.workspace.layout);
      activeLayoutId = imported.workspace.activeSceneId;
      document.getElementById('scene-name').value = imported.workspace.sceneName;
      document.querySelectorAll('.scene').forEach(button => button.classList.toggle('active', button.dataset.scene === imported.workspace.activeTemplate));
      aiPlaying = imported.workspace.aiPlaying;
      const playButton = document.getElementById('ai-toggle');
      playButton.textContent = aiPlaying ? 'Pause NPCs' : 'Play NPCs';
      playButton.setAttribute('aria-pressed', String(aiPlaying));
    }
    eventSceneId = null;
    editingEventIndex = null;
    document.getElementById('event-editor').hidden = true;
    renderSavedScenes();
    setSceneMessage(`Imported ${savedScenes.length} scene${savedScenes.length === 1 ? '' : 's'}.`);
  } catch (error) {
    setSceneMessage(`Import failed: ${error.message || 'invalid document'}`);
  }
}
function applyLayout(layout) {
  activeMessage = null;
  const validTerrain = new Set(['grass', 'dirt', 'sand', 'water', 'field']);
  if (Array.isArray(layout.terrain)) {
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      const value = layout.terrain[y]?.[x];
      terrain[y][x] = validTerrain.has(value) ? value : 'grass';
    }
  }
  placedSprites.length = 0;
  for (const saved of Array.isArray(layout.sprites) ? layout.sprites : []) {
    const type = spriteTypes.find(item => item.id === saved.type);
    if (!type) continue;
    const x = Math.max(0, Math.min(GRID - 1, Math.round(Number(saved.x) || 0)));
    const y = Math.max(0, Math.min(GRID - 1, Math.round(Number(saved.y) || 0)));
    const id = Number.isInteger(saved.id) ? saved.id : nextSpriteId++;
    nextSpriteId = Math.max(nextSpriteId, Number(id) + 1);
    placedSprites.push({
      id, type, x, y,
      frame: Math.max(0, Math.floor(Number(saved.frame) || 0)) % type.frames,
      scale: Math.max(.5, Math.min(4, Number(saved.scale) || type.defaultScale || 1)),
      aiEnabled: type.aiDefault ? saved.aiEnabled !== false : false,
      visible: saved.visible !== false,
      aiMoving: false, aiWait: .4 + Math.random() * 1.2, aiElapsed: 0, aiDuration: .32,
      fromX: x, fromY: y, toX: x, toY: y
    });
  }
  const savedPlayer = layout.player || {};
  setLocation(Number(savedPlayer.x) || 0, Number(savedPlayer.y) || 0);
  player.direction = Math.max(0, Math.min(3, Math.floor(Number(savedPlayer.direction) || 0)));
  player.visible = savedPlayer.visible !== false;
  player.anim = 0;
  selectedSprite = null; armedSprite = null;
  document.getElementById('placed-controls').hidden = true;
  showRukiyaControls(false);
  selectWalkTool();
  aiPlaying = false;
  const playButton = document.getElementById('ai-toggle');
  playButton.textContent = 'Play NPCs';
  playButton.setAttribute('aria-pressed', 'false');
  document.querySelectorAll('.scene').forEach(button => button.classList.remove('active'));
}
function loadSavedScene(id) {
  const record = savedScenes.find(scene => scene.id === id);
  if (!record?.layout) return;
  if (readOnlyView) returnToEditor();
  applyLayout(record.layout);
  activeLayoutId = record.id;
  document.getElementById('scene-name').value = record.name;
  renderSavedScenes();
  setSceneMessage(`Loaded “${record.name}”.`);
}
function viewSavedScene(id) {
  const record = savedScenes.find(scene => scene.id === id);
  if (!record?.layout || readOnlyView) return;
  editorBeforeView = {
    layout: sceneSnapshot(),
    activeLayoutId,
    sceneName: document.getElementById('scene-name').value,
    activeTemplate: document.querySelector('.scene.active')?.dataset.scene || null,
    aiPlaying,
    panels: {
      paint: document.getElementById('paint-hud').hidden,
      picker: document.getElementById('sprite-picker').hidden,
      manager: document.getElementById('scene-manager').hidden,
      events: document.getElementById('event-editor').hidden
    }
  };
  applyLayout(record.layout);
  readOnlyView = true;
  document.body.classList.add('readonly');
  canvas.style.pointerEvents = 'none';
  document.getElementById('paint-hud').hidden = true;
  document.getElementById('sprite-picker').hidden = true;
  document.getElementById('scene-manager').hidden = true;
  document.getElementById('event-editor').hidden = true;
  document.getElementById('placed-controls').hidden = true;
  document.getElementById('rukiya-controls').hidden = true;
  document.getElementById('readonly-name').textContent = record.name;
  document.getElementById('readonly-mode').textContent = 'Viewing';
  document.getElementById('return-to-editor').hidden = false;
  document.getElementById('pause-sequence').hidden = true;
  document.getElementById('stop-sequence').hidden = true;
  document.getElementById('readonly-bar').hidden = false;
  document.getElementById('layout-toggle').setAttribute('aria-expanded', 'false');
  document.getElementById('sprite-toggle').setAttribute('aria-expanded', 'false');
  activeLayoutId = record.id;
  renderSavedScenes();
}
function returnToEditor() {
  if (!readOnlyView || !editorBeforeView) return;
  const state = editorBeforeView;
  applyLayout(state.layout);
  activeLayoutId = state.activeLayoutId;
  document.getElementById('scene-name').value = state.sceneName;
  document.querySelectorAll('.scene').forEach(button => button.classList.toggle('active', button.dataset.scene === state.activeTemplate));
  readOnlyView = false;
  editorBeforeView = null;
  document.body.classList.remove('readonly');
  canvas.style.pointerEvents = '';
  document.getElementById('readonly-bar').hidden = true;
  document.getElementById('paint-hud').hidden = state.panels.paint;
  document.getElementById('sprite-picker').hidden = state.panels.picker;
  document.getElementById('scene-manager').hidden = state.panels.manager;
  document.getElementById('event-editor').hidden = state.panels.events;
  document.getElementById('layout-toggle').setAttribute('aria-expanded', String(!state.panels.manager));
  document.getElementById('sprite-toggle').setAttribute('aria-expanded', String(!state.panels.picker));
  aiPlaying = state.aiPlaying;
  const playButton = document.getElementById('ai-toggle');
  playButton.textContent = aiPlaying ? 'Pause NPCs' : 'Play NPCs';
  playButton.setAttribute('aria-pressed', String(aiPlaying));
  document.getElementById('pause-sequence').hidden = true;
  document.getElementById('stop-sequence').hidden = true;
  document.getElementById('return-to-editor').hidden = false;
  document.getElementById('readonly-bar').hidden = true;
  document.getElementById('readonly-mode').textContent = 'Viewing';
  activeMessage = null;
  sequencePlayback = null;
  renderSavedScenes();
}
function renderSavedScenes() {
  const list = document.getElementById('saved-scenes');
  if (!list) return;
  list.replaceChildren();
  savedScenes.forEach((scene, index) => {
    const row = document.createElement('div');
    row.className = `saved-scene${scene.id === activeLayoutId ? ' active' : ''}`;
    row.setAttribute('role', 'listitem');
    row.draggable = true;
    row.dataset.id = scene.id;
    const load = document.createElement('button');
    load.type = 'button'; load.className = 'load-scene'; load.textContent = `View: ${scene.name}`;
    load.title = `View ${scene.name} without editing`;
    load.addEventListener('click', () => viewSavedScene(scene.id));
    const actions = document.createElement('div'); actions.className = 'scene-actions';
    const actionButton = (text, label, action, disabled = false) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = text; button.title = label; button.setAttribute('aria-label', `${label}: ${scene.name}`); button.disabled = disabled;
      button.addEventListener('click', action);
      actions.append(button);
    };
    actionButton('Load', 'Load saved scene into editor', () => loadSavedScene(scene.id));
    actionButton('Events', 'Edit this scene’s events', () => openEventEditor(scene.id));
    actionButton('↑', 'Move up', () => moveSavedScene(index, index - 1), index === 0);
    actionButton('↓', 'Move down', () => moveSavedScene(index, index + 1), index === savedScenes.length - 1);
    actionButton('✎', 'Rename', () => renameSavedScene(scene.id));
    actionButton('×', 'Delete', () => deleteSavedScene(scene.id));
    row.append(load, actions);
    row.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/plain', scene.id);
      event.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', event => { event.preventDefault(); row.classList.add('over'); });
    row.addEventListener('dragleave', () => row.classList.remove('over'));
    row.addEventListener('drop', event => {
      event.preventDefault(); row.classList.remove('over');
      const from = savedScenes.findIndex(item => item.id === event.dataTransfer.getData('text/plain'));
      const to = savedScenes.findIndex(item => item.id === scene.id);
      if (from < 0 || to < 0 || from === to) return;
      const [moved] = savedScenes.splice(from, 1);
      const rect = row.getBoundingClientRect();
      const insertAt = event.clientY > rect.top + rect.height / 2 ? to + (from < to ? 0 : 1) : to - (from < to ? 1 : 0);
      savedScenes.splice(Math.max(0, Math.min(savedScenes.length, insertAt)), 0, moved);
      persistScenes(); renderSavedScenes();
    });
    list.append(row);
  });
  if (!savedScenes.length) {
    const empty = document.createElement('small'); empty.textContent = 'No saved scenes yet.'; list.append(empty);
  }
}
function moveSavedScene(from, to) {
  if (to < 0 || to >= savedScenes.length) return;
  const [scene] = savedScenes.splice(from, 1);
  savedScenes.splice(to, 0, scene);
  persistScenes(); renderSavedScenes();
}
function renameSavedScene(id) {
  const scene = savedScenes.find(item => item.id === id);
  if (!scene) return;
  const name = window.prompt('Rename scene', scene.name)?.trim();
  if (!name || savedScenes.some(item => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
  scene.name = name;
  persistScenes(); renderSavedScenes();
}
function deleteSavedScene(id) {
  const scene = savedScenes.find(item => item.id === id);
  if (!scene || !window.confirm(`Delete “${scene.name}”?`)) return;
  for (const saved of savedScenes) {
    saved.events = (saved.events || []).filter(event => event.type !== 'transition' || event.sceneId !== id);
  }
  savedScenes = savedScenes.filter(item => item.id !== id);
  if (activeLayoutId === id) activeLayoutId = null;
  persistScenes(); renderSavedScenes();
  setSceneMessage(`Deleted “${scene.name}”.`);
}
function ensureSceneSpriteIds(scene) {
  if (!scene.layout || !Array.isArray(scene.layout.sprites)) return;
  for (const item of scene.layout.sprites) {
    if (!Number.isInteger(item.id)) item.id = nextSpriteId++;
    else nextSpriteId = Math.max(nextSpriteId, item.id + 1);
  }
}
function populateEventTargets(scene) {
  const select = document.getElementById('event-target');
  select.replaceChildren();
  const playerOption = document.createElement('option');
  playerOption.value = 'player'; playerOption.textContent = 'Rukiya'; select.append(playerOption);
  for (const item of scene.layout?.sprites || []) {
    const type = spriteTypes.find(value => value.id === item.type);
    if (!type) continue;
    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = `${type.name} · #${item.id}`;
    select.append(option);
  }
}
function openEventEditor(id) {
  if (readOnlyView) return;
  const scene = savedScenes.find(item => item.id === id);
  if (!scene) return;
  ensureSceneSpriteIds(scene);
  eventSceneId = id;
  editingEventIndex = null;
  document.getElementById('add-event').textContent = 'Add event';
  document.getElementById('event-scene-name').textContent = `Events · ${scene.name}`;
  populateEventTargets(scene);
  const nextScene = document.getElementById('event-next-scene');
  nextScene.replaceChildren();
  for (const item of savedScenes.filter(item => item.id !== id)) {
    const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; nextScene.append(option);
  }
  document.getElementById('scene-manager').hidden = true;
  document.getElementById('event-editor').hidden = false;
  document.getElementById('layout-toggle').setAttribute('aria-expanded', 'false');
  syncEventForm();
  renderSceneEvents(scene);
  persistScenes();
}
function syncEventForm() {
  const type = document.getElementById('event-type').value;
  const fields = {
    target: ['move', 'visibility', 'dialogue'].includes(type),
    move: type === 'move',
    visibility: type === 'visibility',
    text: type === 'narration' || type === 'dialogue',
    duration: ['move', 'narration', 'dialogue', 'wait'].includes(type),
    transition: type === 'transition'
  };
  document.querySelectorAll('[data-event-field]').forEach(field => {
    field.hidden = !fields[field.dataset.eventField];
  });
}
function eventDescription(event) {
  const targetName = event.target === 'player' ? 'Rukiya' : (() => {
    const saved = savedScenes.find(scene => scene.id === eventSceneId)?.layout?.sprites?.find(sprite => String(sprite.id) === String(event.target));
    return spriteTypes.find(type => type.id === saved?.type)?.name || 'Sprite';
  })();
  if (event.type === 'move') return `Move ${targetName} to (${event.x}, ${event.y}) · ${event.duration}s`;
  if (event.type === 'visibility') return `${event.visible ? 'Show' : 'Hide'} ${targetName}`;
  if (event.type === 'narration') return `Narration · “${event.text}” · ${event.duration}s`;
  if (event.type === 'dialogue') return `${targetName} says · “${event.text}” · ${event.duration}s`;
  if (event.type === 'wait') return `Pause · ${event.duration}s`;
  if (event.type === 'transition') return `Transition to ${savedScenes.find(scene => scene.id === event.sceneId)?.name || 'missing scene'}`;
  return 'Event';
}
function renderSceneEvents(scene) {
  const list = document.getElementById('scene-events');
  list.replaceChildren();
  const events = Array.isArray(scene.events) ? scene.events : (scene.events = []);
  events.forEach((event, index) => {
    const item = document.createElement('li'); item.className = 'scene-event';
    const row = document.createElement('div'); row.className = 'scene-event-row';
    const label = document.createElement('span'); label.textContent = eventDescription(event); row.append(label);
    const action = (text, title, callback, disabled = false) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.title = title; button.disabled = disabled; button.addEventListener('click', callback); row.append(button);
    };
    action('↑', 'Move event up', () => reorderSceneEvent(index, index - 1), index === 0);
    action('↓', 'Move event down', () => reorderSceneEvent(index, index + 1), index === events.length - 1);
    action('✎', 'Edit event', () => editSceneEvent(index));
    action('×', 'Remove event', () => {
      if (editingEventIndex === index) { editingEventIndex = null; document.getElementById('add-event').textContent = 'Add event'; }
      events.splice(index, 1); persistScenes(); renderSceneEvents(scene);
    });
    item.append(row); list.append(item);
  });
  if (!events.length) { const empty = document.createElement('small'); empty.textContent = 'No events yet.'; list.append(empty); }
}
function reorderSceneEvent(from, to) {
  const events = savedScenes.find(scene => scene.id === eventSceneId)?.events;
  if (!events || to < 0 || to >= events.length) return;
  const [event] = events.splice(from, 1); events.splice(to, 0, event);
  editingEventIndex = null;
  document.getElementById('add-event').textContent = 'Add event';
  persistScenes(); renderSceneEvents(savedScenes.find(scene => scene.id === eventSceneId));
}
function editSceneEvent(index) {
  const scene = savedScenes.find(item => item.id === eventSceneId);
  const event = scene?.events?.[index];
  if (!event) return;
  editingEventIndex = index;
  document.getElementById('event-type').value = event.type;
  syncEventForm();
  if (event.target !== undefined) document.getElementById('event-target').value = String(event.target);
  if (event.x !== undefined) document.getElementById('event-x').value = event.x;
  if (event.y !== undefined) document.getElementById('event-y').value = event.y;
  if (event.visible !== undefined) document.getElementById('event-visible').value = String(event.visible);
  if (event.text !== undefined) document.getElementById('event-text').value = event.text;
  if (event.duration !== undefined) document.getElementById('event-duration').value = event.duration;
  if (event.sceneId) document.getElementById('event-next-scene').value = event.sceneId;
  document.getElementById('add-event').textContent = 'Update event';
}
function addSceneEvent() {
  const scene = savedScenes.find(item => item.id === eventSceneId);
  if (!scene) return;
  const type = document.getElementById('event-type').value;
  const duration = Math.max(.1, Math.min(120, Number(document.getElementById('event-duration').value) || 2));
  const event = { type };
  if (['move', 'visibility', 'dialogue'].includes(type)) event.target = document.getElementById('event-target').value;
  if (type === 'move') {
    event.x = Math.max(0, Math.min(GRID - 1, Number(document.getElementById('event-x').value) || 0));
    event.y = Math.max(0, Math.min(GRID - 1, Number(document.getElementById('event-y').value) || 0));
    event.duration = duration;
  } else if (type === 'visibility') {
    event.visible = document.getElementById('event-visible').value === 'true';
  } else if (type === 'narration' || type === 'dialogue') {
    event.text = document.getElementById('event-text').value.trim();
    if (!event.text) { document.getElementById('event-text').focus(); return; }
    event.duration = duration;
  } else if (type === 'wait') {
    event.duration = duration;
  } else if (type === 'transition') {
    event.sceneId = document.getElementById('event-next-scene').value;
    if (!event.sceneId) return;
  }
  scene.events ||= [];
  if (editingEventIndex !== null && scene.events[editingEventIndex]) {
    scene.events[editingEventIndex] = event;
    editingEventIndex = null;
    document.getElementById('add-event').textContent = 'Add event';
  } else scene.events.push(event);
  persistScenes(); renderSceneEvents(scene);
}
function eventTarget(id) {
  return id === 'player' ? player : placedSprites.find(object => String(object.id) === String(id));
}
function setEventTargetPosition(target, x, y) {
  target.x = x; target.y = y;
  target.fromX = target.toX = x; target.fromY = target.toY = y;
  if (target === player) target.moving = false;
  if (target.type) target.aiMoving = false;
}
function startSceneSequence(id) {
  const scene = savedScenes.find(item => item.id === id);
  if (!scene?.layout) return;
  viewSavedScene(id);
  if (!readOnlyView) return;
  sequencePlayback = { sceneId: id, eventIndex: 0, waitRemaining: 0, motion: null, paused: false, active: true };
  activeMessage = null;
  document.getElementById('readonly-mode').textContent = 'Playing';
  document.getElementById('readonly-name').textContent = scene.name;
  document.getElementById('return-to-editor').hidden = false;
  document.getElementById('pause-sequence').hidden = false;
  document.getElementById('pause-sequence').textContent = 'Pause';
  document.getElementById('stop-sequence').hidden = false;
}
function tickSceneSequence(dt) {
  const playback = sequencePlayback;
  if (!playback?.active || playback.paused) return;
  if (playback.motion) {
    playback.motion.elapsed += dt;
    if (playback.motion.elapsed >= playback.motion.duration) {
      const motion = playback.motion;
      const target = eventTarget(motion.target);
      if (target) setEventTargetPosition(target, motion.toX, motion.toY);
      playback.motion = null;
      playback.eventIndex++;
    }
    return;
  }
  if (playback.waitRemaining > 0) {
    playback.waitRemaining = Math.max(0, playback.waitRemaining - dt);
    if (!playback.waitRemaining) activeMessage = null;
    return;
  }
  const scene = savedScenes.find(item => item.id === playback.sceneId);
  const events = scene?.events || [];
  if (playback.eventIndex >= events.length) {
    playback.active = false;
    activeMessage = null;
    document.getElementById('readonly-mode').textContent = 'Finished';
    document.getElementById('pause-sequence').hidden = true;
    document.getElementById('stop-sequence').hidden = true;
    return;
  }
  const event = events[playback.eventIndex];
  if (event.type === 'move') {
    const target = eventTarget(event.target);
    if (!target) { playback.eventIndex++; return; }
    const from = entityPosition(target);
    playback.motion = {
      target: event.target, fromX: from.x, fromY: from.y,
      toX: Math.max(0, Math.min(GRID - 1, event.x)),
      toY: Math.max(0, Math.min(GRID - 1, event.y)),
      duration: Math.max(.1, event.duration || 1), elapsed: 0
    };
    const dx = playback.motion.toX - from.x, dy = playback.motion.toY - from.y;
    const direction = Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? 1 : 3) : (dy >= 0 ? 0 : 2);
    if (target === player) player.direction = direction;
    else if (target.type) target.frame = target.type.animated ? direction : Math.round(direction * target.type.frames / 4) % target.type.frames;
    return;
  }
  if (event.type === 'visibility') {
    const target = eventTarget(event.target);
    if (target) target.visible = event.visible !== false;
    playback.eventIndex++;
    return;
  }
  if (event.type === 'wait') {
    playback.eventIndex++;
    playback.waitRemaining = Math.max(.1, event.duration || 1);
    return;
  }
  if (event.type === 'narration' || event.type === 'dialogue') {
    playback.eventIndex++;
    activeMessage = { kind: event.type, text: event.text || '', target: event.target || null };
    playback.waitRemaining = Math.max(.1, event.duration || 2);
    return;
  }
  if (event.type === 'transition') {
    const next = savedScenes.find(item => item.id === event.sceneId);
    playback.eventIndex++;
    if (!next?.layout) return;
    applyLayout(next.layout);
    activeMessage = null;
    playback.sceneId = next.id;
    playback.eventIndex = 0;
    activeLayoutId = next.id;
    document.getElementById('readonly-name').textContent = next.name;
    renderSavedScenes();
    return;
  }
  playback.eventIndex++;
}
function entityPosition(target) {
  const motion = sequencePlayback?.motion;
  if (motion && String(motion.target) === String(target === player ? 'player' : target.id)) {
    const progress = Math.min(1, motion.elapsed / motion.duration);
    return { x: motion.fromX + (motion.toX - motion.fromX) * progress, y: motion.fromY + (motion.toY - motion.fromY) * progress };
  }
  if (target === player && player.moving) {
    const progress = Math.min(1, player.elapsed / .18);
    return { x: player.fromX + (player.toX - player.fromX) * progress, y: player.fromY + (player.toY - player.fromY) * progress };
  }
  if (target.type && target.aiMoving) {
    const progress = Math.min(1, target.aiElapsed / target.aiDuration);
    return { x: target.fromX + (target.toX - target.fromX) * progress, y: target.fromY + (target.toY - target.fromY) * progress };
  }
  return { x: target.x, y: target.y };
}
function drawActiveMessage(view) {
  if (!activeMessage?.text) return;
  ctx.save();
  ctx.font = '14px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  const maxWidth = Math.max(160, Math.min(340, window.innerWidth - 32));
  const padding = 11, lineHeight = 19;
  const words = activeMessage.text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth - padding * 2) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  const textWidth = Math.min(maxWidth - padding * 2, Math.max(...lines.map(text => ctx.measureText(text).width), 0));
  const width = textWidth + padding * 2;
  const height = lines.length * lineHeight + padding * 2;
  let centerX = window.innerWidth / 2;
  let top = 62;
  if (activeMessage.kind === 'dialogue') {
    const target = eventTarget(activeMessage.target);
    if (target) {
      const position = entityPosition(target);
      centerX = view.left + (position.x + .5) * view.size;
      const targetHeight = target === player ? 1.5 : target.type.height * target.scale;
      top = view.top + (position.y + 1 - targetHeight) * view.size - height - 8;
    }
  }
  const x = Math.max(8, Math.min(window.innerWidth - width - 8, centerX - width / 2));
  top = Math.max(8, Math.min(window.innerHeight - height - 8, top));
  ctx.fillStyle = 'rgba(14, 22, 17, 0.94)'; ctx.strokeStyle = '#c7d8c8'; ctx.lineWidth = 1;
  ctx.fillRect(x, top, width, height); ctx.strokeRect(x + .5, top + .5, width - 1, height - 1);
  ctx.fillStyle = '#f2f5ef';
  lines.forEach((text, index) => ctx.fillText(text, x + padding, top + padding + index * lineHeight, maxWidth - padding * 2));
  ctx.restore();
}

function getViewport() {
  const side = Math.min(window.innerWidth, window.innerHeight);
  const size = side / GRID;
  return { size, left: (window.innerWidth - side) / 2, top: (window.innerHeight - side) / 2 };
}
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function cellAt(event) {
  const rect = canvas.getBoundingClientRect();
  const view = getViewport();
  return { x: Math.floor((event.clientX - rect.left - view.left) / view.size), y: Math.floor((event.clientY - rect.top - view.top) / view.size) };
}
function pointAt(event) {
  const rect = canvas.getBoundingClientRect();
  const view = getViewport();
  return { x: event.clientX - rect.left - view.left, y: event.clientY - rect.top - view.top, tile: view.size };
}
function drawSpriteFrame(context, type, frame, x, y, width, height, animationFrame = 0) {
  if (!type.img.complete || !type.img.naturalWidth || !type.fw || !type.fh) return false;
  const frameX = type.animated ? animationFrame * type.fw : (frame % type.cols) * type.fw;
  const frameY = type.animated ? frame * type.fh : Math.floor(frame / type.cols) * type.fh;
  context.drawImage(type.img, frameX, frameY, type.fw, type.fh, x, y, width, height);
  return true;
}
function addSpritePickerButton(type) {
  const list = document.getElementById('sprite-list');
  if (!list) return null;
  if ([...list.querySelectorAll('.sprite-choice')].some(item => item.dataset.sprite === type.id)) return null;
  const button = document.createElement('button');
  button.className = 'sprite-choice';
  button.type = 'button';
  button.dataset.sprite = type.id;
  const preview = document.createElement('canvas');
  preview.width = preview.height = 56;
  const label = document.createElement('span');
  label.textContent = type.name;
  button.append(preview, label);
  list.append(button);
  const paintPreview = () => {
    if (!type.img || !type.fw || !type.fh) return;
    const pctx = preview.getContext('2d');
    pctx.clearRect(0, 0, preview.width, preview.height);
    const scale = Math.min(48 / type.fw, 48 / type.fh);
    drawSpriteFrame(pctx, type, 0, (56 - type.fw * scale) / 2, (56 - type.fh * scale) / 2, type.fw * scale, type.fh * scale);
  };
  if (type.img?.addEventListener) type.img.addEventListener('load', paintPreview);
  if (type.img?.complete) paintPreview();
  button.addEventListener('click', () => {
    armedSprite = type;
    selectedSprite = null;
    showRukiyaControls(false);
    document.getElementById('placed-controls').hidden = true;
    document.querySelectorAll('.sprite-choice').forEach(item => item.classList.toggle('active', item === button));
    document.querySelectorAll('.brush').forEach(item => {
      const active = item.dataset.tool === 'walk';
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    brush = 'walk';
    canvas.style.cursor = 'copy';
  });
  return button;
}
function buildSpritePicker() {
  for (const type of spriteTypes) addSpritePickerButton(type);
}
function showPlacedControls(object) {
  if (object) selectWalkTool();
  selectedSprite = object;
  armedSprite = null;
  showRukiyaControls(false);
  document.getElementById('placed-controls').hidden = !object;
  if (!object) {
    document.querySelectorAll('.sprite-choice').forEach(button => button.classList.remove('active'));
    return;
  }
  document.getElementById('placed-name').textContent = object.type.name;
  document.getElementById('sprite-x').value = object.x;
  document.getElementById('sprite-y').value = object.y;
  document.getElementById('sprite-scale').value = object.scale;
  document.getElementById('sprite-scale-value').textContent = `${object.scale.toFixed(1)}×`;
  const aiSetting = document.getElementById('ai-setting');
  aiSetting.hidden = !object.type.aiDefault;
  document.getElementById('sprite-ai').checked = !!object.aiEnabled;
  document.getElementById('orientation-label').textContent = object.type.frames > 1 ? `${Math.round(object.frame * 360 / object.type.frames)}°` : 'Fixed';
  document.getElementById('rotate-left').disabled = object.type.frames <= 1;
  document.getElementById('rotate-right').disabled = object.type.frames <= 1;
  document.querySelectorAll('.sprite-choice').forEach(button => button.classList.toggle('active', button.dataset.sprite === object.type.id));
}
function placeSprite(type, x, y) {
  const existing = placedSprites.find(object => object.x === x && object.y === y && object.type.id === type.id);
  if (existing) return existing;
  const object = {
    id: nextSpriteId++, type, x, y, frame: 0,
    scale: type.defaultScale || 1,
    aiEnabled: !!type.aiDefault,
    aiMoving: false,
    aiWait: .4 + Math.random() * 1.2,
    aiElapsed: 0,
    aiDuration: .32,
    fromX: x, fromY: y, toX: x, toY: y
  };
  placedSprites.push(object);
  // Keep the picker armed so repeated clicks or drags can paint more copies.
  selectedSprite = null;
  document.getElementById('placed-controls').hidden = true;
  return object;
}
function registerSpriteType(type) {
  if (!type || typeof type.id !== 'string' || !type.id) throw new TypeError('A sprite type needs an id.');
  const existing = spriteTypes.find(item => item.id === type.id);
  if (existing) {
    Object.assign(existing, type, {
      cols: Math.max(1, Math.floor(Number(type.cols ?? existing.cols) || 1)),
      frames: Math.max(1, Math.floor(Number(type.frames ?? existing.frames) || 1)),
      fw: Math.max(0, Number(type.fw ?? existing.fw) || 0),
      fh: Math.max(0, Number(type.fh ?? existing.fh) || 0),
      width: Number(type.width ?? existing.width) > 0 ? Number(type.width ?? existing.width) : 1,
      height: Number(type.height ?? existing.height) > 0 ? Number(type.height ?? existing.height) : 1,
      defaultScale: Number(type.defaultScale ?? existing.defaultScale) > 0 ? Number(type.defaultScale ?? existing.defaultScale) : 1,
      animated: type.animated ?? existing.animated
    });
    addSpritePickerButton(existing);
    return existing;
  }
  const entry = { ...type };
  entry.cols = Math.max(1, Math.floor(Number(entry.cols) || 1));
  entry.frames = Math.max(1, Math.floor(Number(entry.frames) || 1));
  entry.fw = Math.max(0, Number(entry.fw) || 0);
  entry.fh = Math.max(0, Number(entry.fh) || 0);
  entry.width = Number(entry.width) > 0 ? Number(entry.width) : 1;
  entry.height = Number(entry.height) > 0 ? Number(entry.height) : 1;
  entry.defaultScale = Number(entry.defaultScale) > 0 ? Number(entry.defaultScale) : 1;
  entry.animated = !!entry.animated;
  if (!entry.img) {
    entry.img = new Image();
    if (typeof entry.image === 'string') entry.img.src = entry.image;
  }
  spriteTypes.push(entry);
  addSpritePickerButton(entry);
  return entry;
}
function unregisterSpriteType(typeId) {
  const index = spriteTypes.findIndex(item => item.id === typeId);
  if (index < 0) return false;
  const [type] = spriteTypes.splice(index, 1);
  if (armedSprite === type) armedSprite = null;
  for (let i = placedSprites.length - 1; i >= 0; i--) {
    if (placedSprites[i].type.id === typeId) placedSprites.splice(i, 1);
  }
  if (selectedSprite?.type?.id === typeId) {
    selectedSprite = null;
    document.getElementById('placed-controls').hidden = true;
  }
  document.querySelectorAll('.sprite-choice').forEach(item => {
    if (item.dataset.sprite === typeId) item.remove();
  });
  canvas.style.cursor = armedSprite ? 'copy' : 'default';
  return true;
}
function placeSpriteAt(typeId, x, y) {
  if (readOnlyView) return null;
  const type = spriteTypes.find(item => item.id === typeId);
  if (!type) throw new TypeError(`Unknown sprite type: ${typeId}`);
  const column = Math.round(Number(x));
  const row = Math.round(Number(y));
  if (!Number.isFinite(column) || !Number.isFinite(row)) throw new TypeError('placeSpriteAt needs numeric tile coordinates.');
  if (column < 0 || row < 0 || column >= GRID || row >= GRID) return null;
  return placeSprite(type, column, row);
}
function listSpriteTypes() {
  return spriteTypes.map(({ id, name, width, height, defaultScale, custom, assetId, animated, frames }) => ({
    id, name, width, height, defaultScale, custom: !!custom, assetId: assetId || null, animated: !!animated, frames
  }));
}
function setLocation(x, y) {
  x = Math.max(0, Math.min(GRID - 1, Math.round(x)));
  y = Math.max(0, Math.min(GRID - 1, Math.round(y)));
  player.x = player.fromX = player.toX = x;
  player.y = player.fromY = player.toY = y;
  player.moving = false;
  document.getElementById('location-x').value = x;
  document.getElementById('location-y').value = y;
}
function selectWalkTool() {
  brush = 'walk';
  armedSprite = null;
  canvas.style.cursor = 'default';
  document.querySelectorAll('.sprite-choice').forEach(button => button.classList.remove('active'));
  document.querySelectorAll('.brush').forEach(button => {
    const active = button.dataset.tool === 'walk';
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function showRukiyaControls(show) {
  if (show) {
    selectWalkTool();
    selectedSprite = null;
    document.getElementById('placed-controls').hidden = true;
  }
  rukiyaSelected = show;
  document.getElementById('rukiya-controls').hidden = !show;
  document.getElementById('location-x').value = player.x;
  document.getElementById('location-y').value = player.y;
  document.querySelectorAll('[data-facing]').forEach(button => {
    const active = Number(button.dataset.facing) === player.direction;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function syncRukiyaControls() {
  if (!rukiyaSelected) return;
  for (const [id, value] of [['location-x', player.x], ['location-y', player.y]]) {
    const input = document.getElementById(id);
    if (document.activeElement !== input) input.value = value;
  }
  document.querySelectorAll('[data-facing]').forEach(button => {
    const active = Number(button.dataset.facing) === player.direction;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function syncPlacedControls() {
  if (!selectedSprite) return;
  const progress = selectedSprite.aiMoving ? Math.min(1, selectedSprite.aiElapsed / selectedSprite.aiDuration) : 1;
  const x = selectedSprite.aiMoving ? selectedSprite.fromX + (selectedSprite.toX - selectedSprite.fromX) * progress : selectedSprite.x;
  const y = selectedSprite.aiMoving ? selectedSprite.fromY + (selectedSprite.toY - selectedSprite.fromY) * progress : selectedSprite.y;
  for (const [id, value] of [['sprite-x', Math.round(x)], ['sprite-y', Math.round(y)]]) {
    const input = document.getElementById(id);
    if (document.activeElement !== input) input.value = value;
  }
}
function paint(event) {
  const { x, y } = cellAt(event);
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
  if (brush !== 'walk') {
    terrain[y][x] = brush;
    return;
  }
  if (player.moving || x < PAD || y < PAD || x >= PAD + PLAY_SIZE || y >= PAD + PLAY_SIZE || terrain[y][x] === 'water') return;
  const dx = x - player.x, dy = y - player.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return;
  startStep(dx, dy);
}
function startStep(dx, dy) {
  const nx = player.x + dx, ny = player.y + dy;
  if (nx < PAD || ny < PAD || nx >= PAD + PLAY_SIZE || ny >= PAD + PLAY_SIZE || terrain[ny][nx] === 'water') return;
  player.fromX = player.x; player.fromY = player.y; player.toX = nx; player.toY = ny;
  player.direction = dy > 0 ? 0 : dx > 0 ? 1 : dy < 0 ? 2 : 3;
  player.moving = true; player.elapsed = 0;
}
function updateAIs(dt) {
  if (!aiPlaying) return;
  for (const object of placedSprites) {
    if (!object.aiEnabled) continue;
    if (object.aiMoving) {
      object.aiElapsed += dt;
      if (object.aiElapsed >= object.aiDuration) {
        object.x = object.toX; object.y = object.toY;
        object.aiMoving = false;
        object.aiWait = .45 + Math.random() * 1.4;
      }
      continue;
    }
    object.aiWait -= dt;
    if (object.aiWait > 0) continue;
    const directions = [[0, 1, 0], [1, 0, 1], [0, -1, 2], [-1, 0, 3]].sort(() => Math.random() - .5);
    const swims = object.type.id === 'piranha' || object.type.id === 'eel';
    const move = directions.find(([dx, dy]) => {
      const x = object.x + dx, y = object.y + dy;
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) return false;
      if ((terrain[y][x] === 'water') !== swims) return false;
      return !placedSprites.some(other => other !== object && other.x === x && other.y === y);
    });
    if (!move) { object.aiWait = .5; continue; }
    const [dx, dy, direction] = move;
    object.fromX = object.x; object.fromY = object.y;
    object.toX = object.x + dx; object.toY = object.y + dy;
    object.frame = object.type.animated ? direction : Math.round(direction * object.type.frames / 4) % object.type.frames;
    object.aiElapsed = 0;
    object.aiMoving = true;
  }
}
function drawTile(x, y, type, tile) {
  const px = x * tile, py = y * tile;
  ctx.fillStyle = colors[type]; ctx.fillRect(px, py, tile, tile);
  // Deterministic little flecks give each square a textured, grass-like finish.
  for (let i = 0; i < 11; i++) {
    const seed = ((x * 92821 + y * 68917 + i * 3571) >>> 0);
    const rx = ((seed * 16807 % 2147483647) % 57 + 3) / SIZE * tile;
    const ry = ((seed * 48271 % 2147483647) % 57 + 3) / SIZE * tile;
    ctx.fillStyle = type === 'grass' ? (i % 2 ? '#c0df7850' : '#244d3450') : type === 'dirt' ? '#543c3438' : type === 'sand' ? '#fff0a840' : '#c4f5ff48';
    ctx.fillRect(px + rx, py + ry, Math.max(1, tile * .04), Math.max(1, tile * .03));
  }
  if (type === 'water') {
    ctx.fillStyle = '#d5f5ff70';
    ctx.fillRect(px + tile * .16 + ((x * 7 + y * 13) % 22) / SIZE * tile, py + tile * .28, tile * .27, Math.max(1, tile * .03));
    ctx.fillRect(px + tile * .53, py + tile * .67, tile * .22, Math.max(1, tile * .03));
  }
  if (type === 'field') {
    ctx.strokeStyle = '#d5b85b90';
    ctx.lineWidth = Math.max(1, tile * .035);
    for (let i = 1; i < 5; i++) {
      const yy = py + tile * i / 5;
      ctx.beginPath(); ctx.moveTo(px + tile * .08, yy); ctx.lineTo(px + tile * .92, yy); ctx.stroke();
    }
    ctx.fillStyle = '#d8ca6680';
    for (let i = 0; i < 4; i++) ctx.fillRect(px + tile * (.15 + i * .2), py + tile * .17, Math.max(1, tile * .035), tile * .66);
  }
  ctx.strokeStyle = '#e8f5df26';
  ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, tile - 1, tile - 1);
}
function render(now) {
  const dt = Math.min((now - last) / 1000, .1); last = now;
  if (player.moving) {
    player.elapsed += dt; player.anim += dt;
    if (player.elapsed >= .18) { player.x = player.toX; player.y = player.toY; player.moving = false; }
  }
  updateAIs(dt);
  tickSceneSequence(dt);
  syncRukiyaControls();
  syncPlacedControls();
  const view = getViewport();
  const tile = view.size;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.save();
  ctx.translate(view.left, view.top);
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) drawTile(x, y, terrain[y][x], tile);
  const playerPosition = entityPosition(player);
  const footX = playerPosition.x * tile + tile / 2;
  const footY = (playerPosition.y + 1) * tile;
  const drawPlayer = () => {
    if (player.visible === false) return;
    const scriptedWalk = sequencePlayback?.motion?.target === 'player';
    const walkFrame = player.moving || scriptedWalk ? Math.floor(performance.now() / 110) % 8 : 0;
    if (sprite.complete && sprite.naturalWidth) {
      ctx.drawImage(sprite, walkFrame * 128, player.direction * 128, 128, 128, footX - tile * .75, footY - tile * 1.5, tile * 1.5, tile * 1.5);
    } else {
      ctx.fillStyle = '#e6c29b'; ctx.beginPath(); ctx.arc(footX, footY - tile * .9, tile * .2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#596f9c'; ctx.fillRect(footX - tile * .2, footY - tile * .75, tile * .4, tile * .65);
    }
  };
  const drawPlaced = object => {
    if (object.visible === false) return;
    const position = entityPosition(object);
    const tileX = position.x;
    const tileY = position.y;
    const w = object.type.width * object.scale * tile, h = object.type.height * object.scale * tile;
    const x = (tileX + .5) * tile - w / 2, y = (tileY + 1) * tile - h;
    const scriptedWalk = String(sequencePlayback?.motion?.target) === String(object.id);
    const walkFrame = (object.aiMoving || scriptedWalk) && object.type.animated ? Math.floor(performance.now() / 110) % 8 : 0;
    drawSpriteFrame(ctx, object.type, object.frame, x, y, w, h, walkFrame);
    if (selectedSprite === object) {
      ctx.strokeStyle = '#e5f4a5'; ctx.lineWidth = 1.5;
      ctx.strokeRect(object.x * tile + 3, object.y * tile + 3, tile - 6, tile - 6);
    }
  };
  const renderOrder = [...placedSprites.filter(object => object.visible !== false).map(object => ({ y: entityPosition(object).y + 1, draw: () => drawPlaced(object) }))];
  if (player.visible !== false) renderOrder.push({ y: playerPosition.y + 1, draw: drawPlayer });
  renderOrder.sort((a, b) => a.y - b.y).forEach(item => item.draw());
  ctx.restore();
  drawActiveMessage(view);
  requestAnimationFrame(render);
}

document.querySelectorAll('.brush').forEach(button => button.addEventListener('click', () => {
  brush = button.dataset.tool;
  armedSprite = null;
  canvas.style.cursor = brush === 'walk' ? 'default' : 'crosshair';
  document.querySelectorAll('.brush').forEach(item => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
}));
const hud = document.getElementById('paint-hud');
document.getElementById('hud-toggle').addEventListener('click', event => {
  hud.hidden = !hud.hidden;
  event.currentTarget.textContent = hud.hidden ? 'Show paint tools' : 'Hide paint tools';
  event.currentTarget.setAttribute('aria-expanded', String(!hud.hidden));
});
document.querySelectorAll('.scene').forEach(button => button.addEventListener('click', () => loadScene(button.dataset.scene)));
buildSpritePicker();
const picker = document.getElementById('sprite-picker');
document.getElementById('sprite-toggle').addEventListener('click', event => {
  picker.hidden = !picker.hidden;
  if (!picker.hidden) {
    sceneManager.hidden = true;
    document.getElementById('event-editor').hidden = true;
    document.getElementById('layout-toggle').setAttribute('aria-expanded', 'false');
  }
  event.currentTarget.setAttribute('aria-expanded', String(!picker.hidden));
});
const sceneManager = document.getElementById('scene-manager');
document.getElementById('layout-toggle').addEventListener('click', event => {
  sceneManager.hidden = !sceneManager.hidden;
  if (!sceneManager.hidden) {
    picker.hidden = true;
    document.getElementById('event-editor').hidden = true;
    document.getElementById('sprite-toggle').setAttribute('aria-expanded', 'false');
  }
  event.currentTarget.setAttribute('aria-expanded', String(!sceneManager.hidden));
});
document.getElementById('save-scene').addEventListener('click', saveCurrentScene);
document.getElementById('export-document').addEventListener('click', exportDocument);
const documentFile = document.getElementById('document-file');
document.getElementById('import-document').addEventListener('click', () => documentFile.click());
documentFile.addEventListener('change', async () => {
  const file = documentFile.files?.[0];
  await importDocument(file);
  documentFile.value = '';
});
document.getElementById('scene-name').addEventListener('keydown', event => {
  if (event.key === 'Enter') saveCurrentScene();
});
renderSavedScenes();
document.getElementById('event-type').addEventListener('change', syncEventForm);
document.getElementById('add-event').addEventListener('click', addSceneEvent);
document.getElementById('play-sequence').addEventListener('click', () => startSceneSequence(eventSceneId));
document.getElementById('close-events').addEventListener('click', () => {
  document.getElementById('event-editor').hidden = true;
  sceneManager.hidden = false;
  document.getElementById('layout-toggle').setAttribute('aria-expanded', 'true');
});
document.getElementById('pause-sequence').addEventListener('click', event => {
  if (!sequencePlayback?.active) return;
  sequencePlayback.paused = !sequencePlayback.paused;
  event.currentTarget.textContent = sequencePlayback.paused ? 'Resume' : 'Pause';
});
document.getElementById('stop-sequence').addEventListener('click', returnToEditor);
document.querySelectorAll('[data-facing]').forEach(button => button.addEventListener('click', () => {
  player.direction = Number(button.dataset.facing);
  showRukiyaControls(true);
}));
document.getElementById('close-rukiya').addEventListener('click', () => showRukiyaControls(false));
document.getElementById('close-placed').addEventListener('click', () => showPlacedControls(null));
function rotateSelectedSprite(amount) {
  if (!selectedSprite) return;
  const count = selectedSprite.type.frames;
  selectedSprite.frame = (selectedSprite.frame + amount + count) % count;
  showPlacedControls(selectedSprite);
}
document.getElementById('rotate-left').addEventListener('click', () => rotateSelectedSprite(-1));
document.getElementById('rotate-right').addEventListener('click', () => rotateSelectedSprite(1));
document.getElementById('set-sprite-location').addEventListener('click', () => {
  if (!selectedSprite) return;
  selectedSprite.x = Math.max(0, Math.min(GRID - 1, Number(document.getElementById('sprite-x').value) || 0));
  selectedSprite.y = Math.max(0, Math.min(GRID - 1, Number(document.getElementById('sprite-y').value) || 0));
  selectedSprite.fromX = selectedSprite.toX = selectedSprite.x;
  selectedSprite.fromY = selectedSprite.toY = selectedSprite.y;
  selectedSprite.aiMoving = false;
  showPlacedControls(selectedSprite);
});
document.getElementById('sprite-scale').addEventListener('input', event => {
  if (!selectedSprite) return;
  selectedSprite.scale = Number(event.currentTarget.value);
  document.getElementById('sprite-scale-value').textContent = `${selectedSprite.scale.toFixed(1)}×`;
});
document.getElementById('sprite-ai').addEventListener('change', event => {
  if (!selectedSprite) return;
  selectedSprite.aiEnabled = event.currentTarget.checked;
  if (!selectedSprite.aiEnabled && selectedSprite.aiMoving) {
    selectedSprite.x = selectedSprite.toX; selectedSprite.y = selectedSprite.toY;
    selectedSprite.aiMoving = false;
  }
  selectedSprite.aiWait = .5;
});
document.getElementById('ai-toggle').addEventListener('click', event => {
  aiPlaying = !aiPlaying;
  event.currentTarget.textContent = aiPlaying ? 'Pause NPCs' : 'Play NPCs';
  event.currentTarget.setAttribute('aria-pressed', String(aiPlaying));
});
for (const id of ['sprite-x', 'sprite-y']) document.getElementById(id).addEventListener('keydown', event => {
  if (event.key === 'Enter') document.getElementById('set-sprite-location').click();
});
document.getElementById('set-location').addEventListener('click', () => {
  setLocation(Number(document.getElementById('location-x').value) || 0, Number(document.getElementById('location-y').value) || 0);
});
for (const id of ['location-x', 'location-y']) document.getElementById(id).addEventListener('keydown', event => {
  if (event.key === 'Enter') document.getElementById('set-location').click();
});
canvas.addEventListener('pointerdown', event => {
  paintDown = true;
  lastPaintCell = null;
  canvas.setPointerCapture(event.pointerId);
  const point = pointAt(event);
  const hitSprite = [...placedSprites].reverse().find(object => {
    if (object.visible === false) return false;
    const width = object.type.width * object.scale * point.tile, height = object.type.height * object.scale * point.tile;
    const left = (object.x + .5) * point.tile - width / 2;
    const bottom = (object.y + 1) * point.tile;
    return point.x >= left && point.x <= left + width && point.y >= bottom - height && point.y <= bottom;
  });
  if (hitSprite) {
    showPlacedControls(hitSprite);
    return;
  }
  const t = player.moving ? Math.min(1, player.elapsed / .18) : 1;
  const playerX = (player.fromX + (player.toX - player.fromX) * t) * point.tile + point.tile / 2;
  const playerY = (player.fromY + (player.toY - player.fromY) * t) * point.tile + point.tile;
  if (Math.abs(point.x - playerX) <= point.tile * .75 && point.y >= playerY - point.tile * 1.5 && point.y <= playerY) {
    showRukiyaControls(true);
    return;
  }
  if (armedSprite) {
    const { x, y } = cellAt(event);
    if (x >= 0 && y >= 0 && x < GRID && y < GRID) {
      placeSprite(armedSprite, x, y);
      lastPaintCell = `${x},${y}`;
    }
    return;
  }
  if (selectedSprite && brush === 'walk') {
    const { x, y } = cellAt(event);
    if (x >= 0 && y >= 0 && x < GRID && y < GRID) {
      selectedSprite.x = x; selectedSprite.y = y;
      showPlacedControls(selectedSprite);
    }
    return;
  }
  if (rukiyaSelected && brush === 'walk') {
    const { x, y } = cellAt(event);
    if (x >= 0 && y >= 0 && x < GRID && y < GRID) setLocation(x, y);
    return;
  }
  paint(event);
});
canvas.addEventListener('pointermove', event => {
  if (!paintDown) return;
  const { x, y } = cellAt(event);
  const key = `${x},${y}`;
  if (armedSprite) {
    if (x >= 0 && y >= 0 && x < GRID && y < GRID && key !== lastPaintCell) placeSprite(armedSprite, x, y);
    lastPaintCell = key;
  } else if (brush !== 'walk') paint(event);
});
canvas.addEventListener('pointerup', () => { paintDown = false; lastPaintCell = null; });
canvas.addEventListener('pointercancel', () => { paintDown = false; lastPaintCell = null; });
window.addEventListener('keydown', event => {
  if (readOnlyView) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (brush !== 'walk' || player.moving || event.repeat) return;
  const key = event.key.toLowerCase();
  const direction = ({ w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] })[key];
  if (direction) { event.preventDefault(); startStep(...direction); }
});
window.addEventListener('resize', resize);
window.addEventListener('keydown', event => {
  if (readOnlyView && event.key === 'Escape') { returnToEditor(); return; }
  if (event.key === 'Escape' && armedSprite) {
    armedSprite = null;
    document.querySelectorAll('.sprite-choice').forEach(button => button.classList.remove('active'));
    canvas.style.cursor = 'default';
  }
});
document.getElementById('return-to-editor').addEventListener('click', returnToEditor);
resize();
requestAnimationFrame(render);

const aiReadyCallbacks = new Set();
let aiReady = false;
let resolveAiReady;
const aiReadyPromise = new Promise(resolve => { resolveAiReady = resolve; });
function onAiReady(callback) {
  if (typeof callback !== 'function') throw new TypeError('onReady expects a function.');
  if (aiReady) {
    queueMicrotask(() => callback(window.ObliqueAI));
    return () => {};
  }
  aiReadyCallbacks.add(callback);
  return () => aiReadyCallbacks.delete(callback);
}
function markAiReady() {
  if (aiReady) return;
  aiReady = true;
  const api = window.ObliqueAI;
  resolveAiReady(api);
  for (const callback of [...aiReadyCallbacks]) {
    try {
      callback(api);
    } catch {
    }
  }
  aiReadyCallbacks.clear();
  window.dispatchEvent(new CustomEvent('oblique:ai-ready', { detail: api }));
}
const obliqueAI = {
  version: 1,
  registerSpriteType,
  unregisterSpriteType,
  placeSpriteAt,
  listSpriteTypes,
  onReady: onAiReady,
  ready: aiReadyPromise
};
setSpriteRegistrar(registerSpriteType, unregisterSpriteType);
window.ObliqueAI = obliqueAI;
restoreCustomSprites().catch(() => null).finally(markAiReady);

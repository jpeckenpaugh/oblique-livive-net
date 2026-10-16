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

function loadScene(name) {
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
  if (rukiyaSelected) showRukiyaControls(true);
  document.querySelectorAll('.scene').forEach(button => button.classList.toggle('active', button.dataset.scene === name));
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
function buildSpritePicker() {
  const list = document.getElementById('sprite-list');
  for (const type of spriteTypes) {
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
      const pctx = preview.getContext('2d');
      pctx.clearRect(0, 0, preview.width, preview.height);
      const scale = Math.min(48 / type.fw, 48 / type.fh);
      drawSpriteFrame(pctx, type, 0, (56 - type.fw * scale) / 2, (56 - type.fh * scale) / 2, type.fw * scale, type.fh * scale);
    };
    type.img.addEventListener('load', paintPreview);
    paintPreview();
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
  }
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
  if (placedSprites.some(object => object.x === x && object.y === y && object.type.id === type.id)) return;
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
  syncRukiyaControls();
  syncPlacedControls();
  const view = getViewport();
  const tile = view.size;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.save();
  ctx.translate(view.left, view.top);
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) drawTile(x, y, terrain[y][x], tile);
  const t = player.moving ? Math.min(1, player.elapsed / .18) : 1;
  const footX = (player.fromX + (player.toX - player.fromX) * t) * tile + tile / 2;
  const footY = (player.fromY + (player.toY - player.fromY) * t) * tile + tile;
  const drawPlayer = () => {
    const walkFrame = player.moving ? Math.floor(player.anim * 8) % 8 : 0;
    if (sprite.complete && sprite.naturalWidth) {
      ctx.drawImage(sprite, walkFrame * 128, player.direction * 128, 128, 128, footX - tile * .75, footY - tile * 1.5, tile * 1.5, tile * 1.5);
    } else {
      ctx.fillStyle = '#e6c29b'; ctx.beginPath(); ctx.arc(footX, footY - tile * .9, tile * .2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#596f9c'; ctx.fillRect(footX - tile * .2, footY - tile * .75, tile * .4, tile * .65);
    }
  };
  const drawPlaced = object => {
    const progress = object.aiMoving ? Math.min(1, object.aiElapsed / object.aiDuration) : 1;
    const tileX = object.aiMoving ? object.fromX + (object.toX - object.fromX) * progress : object.x;
    const tileY = object.aiMoving ? object.fromY + (object.toY - object.fromY) * progress : object.y;
    const w = object.type.width * object.scale * tile, h = object.type.height * object.scale * tile;
    const x = (tileX + .5) * tile - w / 2, y = (tileY + 1) * tile - h;
    const walkFrame = object.aiMoving && object.type.animated ? Math.floor(object.aiElapsed * 12) % 8 : 0;
    drawSpriteFrame(ctx, object.type, object.frame, x, y, w, h, walkFrame);
    if (selectedSprite === object) {
      ctx.strokeStyle = '#e5f4a5'; ctx.lineWidth = 1.5;
      ctx.strokeRect(object.x * tile + 3, object.y * tile + 3, tile - 6, tile - 6);
    }
  };
  const renderOrder = [...placedSprites.map(object => {
    const progress = object.aiMoving ? Math.min(1, object.aiElapsed / object.aiDuration) : 1;
    return { y: (object.aiMoving ? object.fromY + (object.toY - object.fromY) * progress : object.y) + 1, draw: () => drawPlaced(object) };
  }), { y: player.fromY + (player.toY - player.fromY) * t + 1, draw: drawPlayer }];
  renderOrder.sort((a, b) => a.y - b.y).forEach(item => item.draw());
  ctx.restore();
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
  event.currentTarget.setAttribute('aria-expanded', String(!picker.hidden));
});
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
  if (brush !== 'walk' || player.moving || event.repeat) return;
  const key = event.key.toLowerCase();
  const direction = ({ w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] })[key];
  if (direction) { event.preventDefault(); startStep(...direction); }
});
window.addEventListener('resize', resize);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && armedSprite) {
    armedSprite = null;
    document.querySelectorAll('.sprite-choice').forEach(button => button.classList.remove('active'));
    canvas.style.cursor = 'default';
  }
});
resize();
requestAnimationFrame(render);

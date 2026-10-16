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
function setLocation(x, y) {
  x = Math.max(0, Math.min(GRID - 1, Math.round(x)));
  y = Math.max(0, Math.min(GRID - 1, Math.round(y)));
  player.x = player.fromX = player.toX = x;
  player.y = player.fromY = player.toY = y;
  player.moving = false;
  document.getElementById('location-x').value = x;
  document.getElementById('location-y').value = y;
}
function showRukiyaControls(show) {
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
  syncRukiyaControls();
  const view = getViewport();
  const tile = view.size;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.save();
  ctx.translate(view.left, view.top);
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) drawTile(x, y, terrain[y][x], tile);
  const t = player.moving ? Math.min(1, player.elapsed / .18) : 1;
  const footX = (player.fromX + (player.toX - player.fromX) * t) * tile + tile / 2;
  const footY = (player.fromY + (player.toY - player.fromY) * t) * tile + tile;
  const walkFrame = player.moving ? Math.floor(player.anim * 8) % 8 : 0;
  if (sprite.complete && sprite.naturalWidth) {
    ctx.drawImage(sprite, walkFrame * 128, player.direction * 128, 128, 128, footX - tile * .75, footY - tile * 1.5, tile * 1.5, tile * 1.5);
  } else {
    ctx.fillStyle = '#e6c29b'; ctx.beginPath(); ctx.arc(footX, footY - tile * .9, tile * .2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#596f9c'; ctx.fillRect(footX - tile * .2, footY - tile * .75, tile * .4, tile * .65);
  }
  ctx.restore();
  requestAnimationFrame(render);
}

document.querySelectorAll('.brush').forEach(button => button.addEventListener('click', () => {
  brush = button.dataset.tool;
  document.querySelectorAll('.brush').forEach(item => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  canvas.style.cursor = brush === 'walk' ? 'default' : 'crosshair';
}));
const hud = document.getElementById('paint-hud');
document.getElementById('hud-toggle').addEventListener('click', event => {
  hud.hidden = !hud.hidden;
  event.currentTarget.textContent = hud.hidden ? 'Show paint tools' : 'Hide paint tools';
  event.currentTarget.setAttribute('aria-expanded', String(!hud.hidden));
});
document.querySelectorAll('.scene').forEach(button => button.addEventListener('click', () => loadScene(button.dataset.scene)));
document.querySelectorAll('[data-facing]').forEach(button => button.addEventListener('click', () => {
  player.direction = Number(button.dataset.facing);
  showRukiyaControls(true);
}));
document.getElementById('close-rukiya').addEventListener('click', () => showRukiyaControls(false));
document.getElementById('set-location').addEventListener('click', () => {
  setLocation(Number(document.getElementById('location-x').value) || 0, Number(document.getElementById('location-y').value) || 0);
});
for (const id of ['location-x', 'location-y']) document.getElementById(id).addEventListener('keydown', event => {
  if (event.key === 'Enter') document.getElementById('set-location').click();
});
canvas.addEventListener('pointerdown', event => {
  paintDown = true;
  canvas.setPointerCapture(event.pointerId);
  const point = pointAt(event);
  const t = player.moving ? Math.min(1, player.elapsed / .18) : 1;
  const playerX = (player.fromX + (player.toX - player.fromX) * t) * point.tile + point.tile / 2;
  const playerY = (player.fromY + (player.toY - player.fromY) * t) * point.tile + point.tile;
  if (Math.abs(point.x - playerX) <= point.tile * .75 && point.y >= playerY - point.tile * 1.5 && point.y <= playerY) {
    showRukiyaControls(true);
    return;
  }
  if (rukiyaSelected && brush === 'walk') {
    const { x, y } = cellAt(event);
    if (x >= 0 && y >= 0 && x < GRID && y < GRID) setLocation(x, y);
    return;
  }
  paint(event);
});
canvas.addEventListener('pointermove', event => { if (paintDown && brush !== 'walk') paint(event); });
canvas.addEventListener('pointerup', () => { paintDown = false; });
canvas.addEventListener('pointercancel', () => { paintDown = false; });
window.addEventListener('keydown', event => {
  if (brush !== 'walk' || player.moving || event.repeat) return;
  const key = event.key.toLowerCase();
  const direction = ({ w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] })[key];
  if (direction) { event.preventDefault(); startStep(...direction); }
});
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(render);

/**
 * Interactive Real-Time Terrain Painter Brush.
 */
import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  TERRAIN_GRASS,
  TERRAIN_DIRT,
  TERRAIN_WATER,
  TERRAIN_SAND
} from '../core/constants.js';
import { editorState, resetTerrainMap, setTileTerrain } from '../core/state.js';

export function initTerrainPainter(canvas) {
  const brushButtons = {
    none: document.getElementById('brush-none'),
    grass: document.getElementById('brush-grass'),
    dirt: document.getElementById('brush-dirt'),
    sand: document.getElementById('brush-sand'),
    water: document.getElementById('brush-water')
  };

  function setActiveBrush(brush, btnKey) {
    editorState.activeBrush = brush;
    Object.keys(brushButtons).forEach(k => {
      if (brushButtons[k]) brushButtons[k].classList.toggle('active', k === btnKey);
    });
    canvas.style.cursor = brush === null ? 'default' : 'crosshair';
  }

  if (brushButtons.none) brushButtons.none.addEventListener('click', () => setActiveBrush(null, 'none'));
  if (brushButtons.grass) brushButtons.grass.addEventListener('click', () => setActiveBrush(TERRAIN_GRASS, 'grass'));
  if (brushButtons.dirt) brushButtons.dirt.addEventListener('click', () => setActiveBrush(TERRAIN_DIRT, 'dirt'));
  if (brushButtons.sand) brushButtons.sand.addEventListener('click', () => setActiveBrush(TERRAIN_SAND, 'sand'));
  if (brushButtons.water) brushButtons.water.addEventListener('click', () => setActiveBrush(TERRAIN_WATER, 'water'));

  const btnResetTerrain = document.getElementById('btn-reset-terrain');
  if (btnResetTerrain) {
    btnResetTerrain.addEventListener('click', () => {
      const btnPureGrass = document.getElementById('btn-toggle-pure-grass');
      const isPure = btnPureGrass ? btnPureGrass.classList.contains('active') : true;
      resetTerrainMap(isPure);
    });
  }

  let isPainting = false;

  function paintAtEvent(e) {
    if (editorState.activeBrush === null) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    const tx = Math.floor(canvasX / TILE_SIZE);
    const ty = Math.floor(canvasY / TILE_SIZE);
    if (tx >= 0 && tx < GRID_COLS && ty >= 0 && ty < GRID_ROWS) {
      setTileTerrain(tx, ty, editorState.activeBrush);
    }
  }

  canvas.addEventListener('mousedown', (e) => {
    if (editorState.activeBrush !== null) {
      isPainting = true;
      paintAtEvent(e);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isPainting && editorState.activeBrush !== null) {
      paintAtEvent(e);
    }
  });

  window.addEventListener('mouseup', () => {
    isPainting = false;
  });
}

/**
 * Oblique 2.5D Model Sandbox Entrypoint.
 * Bootstraps systems, assets, UI bindings, and launches the engine loop.
 */
import { WORLD_WIDTH, WORLD_HEIGHT } from './core/constants.js';
import { initAssets } from './core/assets.js';
import { initInput } from './core/input.js';
import { startEngineLoop } from './core/loop.js';
import { updateGrassFlowCanvas } from './terrain/grass-flow.js';
import { initCamera } from './render/camera.js';
import { initEditor } from './ui/editor.js';
import { initTerrainPainter } from './ui/terrain-painter.js';
import { initControls } from './ui/controls.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  canvas.width = WORLD_WIDTH;
  canvas.height = WORLD_HEIGHT;

  // Initialize Subsystems
  initCamera(canvas);
  initAssets();
  initInput();
  initEditor(canvas);
  initTerrainPainter(canvas);
  initControls();

  // Initial immediate compute of procedural grass flow field (sync for instant first frame)
  updateGrassFlowCanvas(true);

  // Start Main Loop
  startEngineLoop(canvas, ctx);
});

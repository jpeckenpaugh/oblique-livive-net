/**
 * Main game loop and engine orchestrator.
 */
import { debug, editorState } from './state.js';
import { entities } from '../entities/manifest.js';
import { player, updatePlayer } from '../entities/player.js';
import { updateRatNPC } from '../entities/rat-npc.js';
import { updatePiranhaNPC } from '../entities/piranha-npc.js';
import { centerCameraOn, resizeCanvasToViewport } from '../render/camera.js';
import { renderGroundGrid } from '../terrain/terrain-renderer.js';
import { renderAllShadows } from '../render/shadows.js';
import { renderSortedEntities } from '../render/entity-renderer.js';

let lastTime = performance.now();
let frameCounter = 0;
let fpsTimer = 0;
let currentFps = 60;
let isLoopRunning = false;

/**
 * Start the requestAnimationFrame game loop.
 * @param {HTMLCanvasElement} canvas 
 * @param {CanvasRenderingContext2D} ctx 
 */
export function startEngineLoop(canvas, ctx) {
  if (isLoopRunning) return;
  isLoopRunning = true;
  lastTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Update FPS counter
    frameCounter++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      currentFps = Math.round(frameCounter / fpsTimer);
      const fpsEl = document.getElementById('stat-fps');
      if (fpsEl) fpsEl.textContent = `FPS: ${currentFps}`;
      frameCounter = 0;
      fpsTimer = 0;
    }

    // Update positions
    updatePlayer(dt);
    for (const ent of entities) {
      if (ent.type === 'npc') {
        if (ent.npcType === 'rat') {
          updateRatNPC(ent, dt);
        } else if (ent.npcType === 'piranha') {
          updatePiranhaNPC(ent, dt);
        }
      }
    }

    // Auto-Center Camera on Player if enabled and nothing currently selected in Sprite Editor
    if (debug.cameraFollow && !editorState.selectedEntity) {
      centerCameraOn(player.x + 32, player.y + 32);
    }

    // Ensure canvas matches viewport size
    resizeCanvasToViewport(canvas);

    const zoom = editorState.currentZoom || 1.0;
    const wrapper = document.getElementById('canvas-wrapper');
    const scrollX = wrapper ? Math.round(wrapper.scrollLeft) : 0;
    const scrollY = wrapper ? Math.round(wrapper.scrollTop) : 0;
    const cameraX = scrollX / zoom;
    const cameraY = scrollY / zoom;
    const viewW = canvas.width / zoom;
    const viewH = canvas.height / zoom;
    const camera = { x: cameraX, y: cameraY, w: viewW, h: viewH, zoom };

    // Clear canvas
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-Math.round(cameraX), -Math.round(cameraY));

    // 1. Draw Background Ground Tiles
    renderGroundGrid(ctx, canvas, now, camera);

    // 2. Draw Directional Silhouette Shadows (on top of terrain, under all items)
    if (debug.shadows) {
      renderAllShadows(ctx, now, camera);
    }

    // 3. Draw Depth-Sorted Entities (Props, NPCs, Player)
    renderSortedEntities(ctx, now, camera);

    ctx.restore();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

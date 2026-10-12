/**
 * Main game loop and engine orchestrator.
 */
import { debug, editorState } from './state.js';
import { entities } from '../entities/manifest.js';
import { player, updatePlayer } from '../entities/player.js';
import { updateRatNPC } from '../entities/rat-npc.js';
import { updatePiranhaNPC } from '../entities/piranha-npc.js';
import { centerCameraOn } from '../render/camera.js';
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

    // Clear canvas
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Background Ground Tiles
    renderGroundGrid(ctx, canvas, now);

    // 2. Draw Directional Silhouette Shadows (on top of terrain, under all items)
    if (debug.shadows) {
      renderAllShadows(ctx, now);
    }

    // 3. Draw Depth-Sorted Entities (Props, NPCs, Player)
    renderSortedEntities(ctx, now);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

/**
 * Player Entity state, movement, and animation updates.
 */
import {
  TILE_SIZE,
  DIR_DOWN,
  DIR_RIGHT,
  DIR_UP,
  DIR_LEFT
} from '../core/constants.js';
import { debug } from '../core/state.js';
import { keys } from '../core/input.js';
import { isTileWalkable, checkCollision } from './collision.js';

export const player = {
  id: 'player',
  name: 'Player (Rukiya)',
  tileX: 7,
  tileY: 6,
  x: 7 * TILE_SIZE, // Footprint top-left X in pixels
  y: 6 * TILE_SIZE, // Footprint top-left Y in pixels
  startTileX: 7,
  startTileY: 6,
  targetTileX: 7,
  targetTileY: 6,
  isStepping: false,
  stepTime: 0,
  stepDuration: 0.18, // 0.18s per tile step
  width: 64,       // Footprint width
  height: 64,      // Footprint height
  speed: 160,      // Pixels per second (free movement fallback)
  dir: DIR_DOWN,
  isMoving: false,
  animTime: 0,
  activeModel: 'rukiya',
  // Custom config support
  customImg: null,
  customConfig: null,
  // Sprite Frame Specs
  frameWidth: 128,
  frameHeight: 128,
  renderWidth: 128,
  renderHeight: 128,
  anchorX: 64,
  anchorY: 128,
  anchorPreset: 'bottom-center',
  fps: 8,
  totalWalkFrames: 8
};

/**
 * Attempt to initiate a grid step in the pressed direction.
 * @returns {boolean}
 */
export function tryStartPlayerGridStep() {
  let dx = 0;
  let dy = 0;
  if (keys['w'] || keys['arrowup']) dy = -1;
  else if (keys['s'] || keys['arrowdown']) dy = 1;
  else if (keys['a'] || keys['arrowleft']) dx = -1;
  else if (keys['d'] || keys['arrowright']) dx = 1;

  if (dx === 0 && dy === 0) return false;

  // Turn to face the direction
  if (dy > 0) player.dir = DIR_DOWN;
  else if (dy < 0) player.dir = DIR_UP;
  else if (dx > 0) player.dir = DIR_RIGHT;
  else if (dx < 0) player.dir = DIR_LEFT;

  const nextTx = player.tileX + dx;
  const nextTy = player.tileY + dy;

  if (isTileWalkable(nextTx, nextTy, false)) {
    player.isStepping = true;
    player.stepTime = 0;
    player.startTileX = player.tileX;
    player.startTileY = player.tileY;
    player.targetTileX = nextTx;
    player.targetTileY = nextTy;
    player.isMoving = true;
    return true;
  }
  return false;
}

/**
 * Update player position, stepping interpolation, or continuous movement fallback.
 * @param {number} dt Delta time in seconds
 */
export function updatePlayer(dt) {
  if (debug.snapToGrid) {
    // --- Snap To Grid Movement (1 Tile per Step) ---
    if (player.isStepping) {
      player.stepTime += dt;
      const t = Math.min(1, player.stepTime / player.stepDuration);
      player.x = Math.round((player.startTileX + (player.targetTileX - player.startTileX) * t) * TILE_SIZE);
      player.y = Math.round((player.startTileY + (player.targetTileY - player.startTileY) * t) * TILE_SIZE);
      player.animTime += dt;
      player.isMoving = true;

      if (t >= 1) {
        // Strictly snap to destination tile
        player.tileX = player.targetTileX;
        player.tileY = player.targetTileY;
        player.x = player.tileX * TILE_SIZE;
        player.y = player.tileY * TILE_SIZE;
        player.isStepping = false;

        // Immediately check for next step if key is held down
        const chained = tryStartPlayerGridStep();
        if (!chained) {
          player.isMoving = false;
          player.animTime = 0;
        }
      }
    } else {
      const started = tryStartPlayerGridStep();
      if (!started) {
        player.isMoving = false;
        player.animTime = 0;
      }
    }
  } else {
    // --- Free Continuous Movement Fallback ---
    let vx = 0;
    let vy = 0;

    if (keys['w'] || keys['arrowup']) vy -= 1;
    if (keys['s'] || keys['arrowdown']) vy += 1;
    if (keys['a'] || keys['arrowleft']) vx -= 1;
    if (keys['d'] || keys['arrowright']) vx += 1;

    if (vx !== 0 || vy !== 0) {
      player.isMoving = true;
      player.animTime += dt;

      if (vy > 0) player.dir = DIR_DOWN;
      else if (vy < 0) player.dir = DIR_UP;
      else if (vx > 0) player.dir = DIR_RIGHT;
      else if (vx < 0) player.dir = DIR_LEFT;

      let moveDist = player.speed * dt;
      if (vx !== 0 && vy !== 0) moveDist *= 0.7071;

      const nextX = player.x + vx * moveDist;
      const nextY = player.y + vy * moveDist;

      if (!checkCollision(nextX, player.y, player.width, player.height, false)) {
        player.x = nextX;
      }
      if (!checkCollision(player.x, nextY, player.width, player.height, false)) {
        player.y = nextY;
      }
      player.tileX = Math.round(player.x / TILE_SIZE);
      player.tileY = Math.round(player.y / TILE_SIZE);
    } else {
      player.isMoving = false;
      player.animTime = 0;
    }
  }
}

/**
 * Reset player to default spawn tile.
 */
export function resetPlayer() {
  player.tileX = 7;
  player.tileY = 6;
  player.startTileX = 7;
  player.startTileY = 6;
  player.targetTileX = 7;
  player.targetTileY = 6;
  player.x = 7 * TILE_SIZE;
  player.y = 6 * TILE_SIZE;
  player.dir = DIR_DOWN;
  player.isStepping = false;
  player.isMoving = false;
  player.animTime = 0;
}

/**
 * Rat NPC autonomous wandering state machine (Brown & Black Rats).
 */
import {
  TILE_SIZE,
  DIR_DOWN,
  DIR_RIGHT,
  DIR_UP,
  DIR_LEFT
} from '../core/constants.js';
import { debug } from '../core/state.js';
import { isTileWalkable, checkCollision } from './collision.js';

/**
 * Helper to get Rat turn head angles from Row 4 (Still views).
 * Row 4 turntable angles: 0: 30°, 1: 60°, 2: 120°, 3: 150°, 4: 210°, 5: 240°, 6: 300°, 7: 330°
 * @param {number} dir 
 * @param {'right'|'left'} side 
 * @returns {{ col: number, row: number }}
 */
export function getRatLookFrame(dir, side) {
  if (dir === DIR_DOWN) return side === 'right' ? { col: 0, row: 4 } : { col: 7, row: 4 };
  if (dir === DIR_RIGHT) return side === 'right' ? { col: 2, row: 4 } : { col: 1, row: 4 };
  if (dir === DIR_UP) return side === 'right' ? { col: 4, row: 4 } : { col: 3, row: 4 };
  if (dir === DIR_LEFT) return side === 'right' ? { col: 6, row: 4 } : { col: 5, row: 4 };
  return { col: 0, row: 4 };
}

/**
 * Generic Rat NPC wandering state machine (Brown and Black rat).
 * @param {Object} rat Entity definition
 * @param {number} dt Delta time in seconds
 */
export function updateRatNPC(rat, dt) {
  if (debug.snapToGrid) {
    // --- Snap-to-Grid Rat Movement ---
    if (rat.isStepping) {
      rat.stepTime += dt;
      const t = Math.min(1, rat.stepTime / rat.stepDuration);
      rat.x = Math.round((rat.startTileX + (rat.targetTileX - rat.startTileX) * t) * TILE_SIZE);
      rat.y = Math.round((rat.startTileY + (rat.targetTileY - rat.startTileY) * t) * TILE_SIZE);
      rat.animTime += dt;
      rat.isMoving = true;

      if (t >= 1) {
        rat.tileX = rat.targetTileX;
        rat.tileY = rat.targetTileY;
        rat.x = rat.tileX * TILE_SIZE;
        rat.y = rat.tileY * TILE_SIZE;
        rat.isStepping = false;
        rat.stepsRemaining = (rat.stepsRemaining || 1) - 1;

        if (rat.stepsRemaining <= 0) {
          rat.isMoving = false;
          rat.animTime = 0;
          rat.wanderState = 'idle_center';
          rat.stateTimer = 0.8 + Math.random() * 0.9;
        }
      }
    } else if (rat.wanderState === 'walking') {
      let dx = 0, dy = 0;
      if (rat.dir === DIR_DOWN) dy = 1;
      else if (rat.dir === DIR_UP) dy = -1;
      else if (rat.dir === DIR_RIGHT) dx = 1;
      else if (rat.dir === DIR_LEFT) dx = -1;

      const nextTx = rat.tileX + dx;
      const nextTy = rat.tileY + dy;

      if (isTileWalkable(nextTx, nextTy, false)) {
        rat.isStepping = true;
        rat.stepTime = 0;
        rat.startTileX = rat.tileX;
        rat.startTileY = rat.tileY;
        rat.targetTileX = nextTx;
        rat.targetTileY = nextTy;
        rat.isMoving = true;
      } else {
        rat.isMoving = false;
        rat.animTime = 0;
        rat.wanderState = 'idle_center';
        rat.stateTimer = 0.6;
      }
    } else if (rat.wanderState === 'idle_center') {
      rat.isMoving = false;
      rat.stateTimer -= dt;
      if (rat.stateTimer <= 0) {
        rat.wanderState = Math.random() < 0.5 ? 'look_right' : 'look_left';
        rat.stateTimer = 0.6 + Math.random() * 0.5;
      }
    } else if (rat.wanderState === 'look_right') {
      rat.isMoving = false;
      rat.stateTimer -= dt;
      if (rat.stateTimer <= 0) {
        rat.wanderState = 'look_left';
        rat.stateTimer = 0.6 + Math.random() * 0.5;
      }
    } else if (rat.wanderState === 'look_left') {
      rat.isMoving = false;
      rat.stateTimer -= dt;
      if (rat.stateTimer <= 0) {
        const candidates = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];
        candidates.sort(() => Math.random() - 0.5);

        let chosenDir = candidates[0];
        for (const d of candidates) {
          let tdx = 0, tdy = 0;
          if (d === DIR_DOWN) tdy = 1;
          else if (d === DIR_UP) tdy = -1;
          else if (d === DIR_RIGHT) tdx = 1;
          else if (d === DIR_LEFT) tdx = -1;

          if (isTileWalkable(rat.tileX + tdx, rat.tileY + tdy, false)) {
            chosenDir = d;
            break;
          }
        }

        rat.dir = chosenDir;
        rat.wanderState = 'walking';
        rat.stepsRemaining = 1 + Math.floor(Math.random() * 3);
      }
    }
  } else {
    // Free movement fallback for rat
    rat.stateTimer -= dt;
    if (rat.wanderState === 'walking') {
      rat.isMoving = true;
      rat.animTime += dt;
      let vx = 0, vy = 0;
      if (rat.dir === DIR_DOWN) vy = 1;
      else if (rat.dir === DIR_UP) vy = -1;
      else if (rat.dir === DIR_RIGHT) vx = 1;
      else if (rat.dir === DIR_LEFT) vx = -1;

      const nextX = rat.x + vx * rat.speed * dt;
      const nextY = rat.y + vy * rat.speed * dt;

      if (!checkCollision(nextX, nextY, rat.width, rat.height, false)) {
        rat.x = nextX;
        rat.y = nextY;
        rat.tileX = Math.round(rat.x / TILE_SIZE);
        rat.tileY = Math.round(rat.y / TILE_SIZE);
      } else {
        rat.stateTimer = 0;
      }

      if (rat.stateTimer <= 0) {
        rat.isMoving = false;
        rat.animTime = 0;
        rat.wanderState = 'idle_center';
        rat.stateTimer = 0.8 + Math.random() * 0.9;
      }
    } else if (rat.wanderState === 'idle_center') {
      rat.isMoving = false;
      if (rat.stateTimer <= 0) {
        rat.wanderState = Math.random() < 0.5 ? 'look_right' : 'look_left';
        rat.stateTimer = 0.6 + Math.random() * 0.5;
      }
    } else if (rat.wanderState === 'look_right') {
      rat.isMoving = false;
      if (rat.stateTimer <= 0) {
        rat.wanderState = 'look_left';
        rat.stateTimer = 0.6 + Math.random() * 0.5;
      }
    } else if (rat.wanderState === 'look_left') {
      rat.isMoving = false;
      if (rat.stateTimer <= 0) {
        rat.dir = Math.floor(Math.random() * 4);
        rat.wanderState = 'walking';
        rat.stateTimer = 1.1 + Math.random() * 1.5;
      }
    }
  }
}

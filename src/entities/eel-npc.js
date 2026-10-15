/**
 * River Eel Water NPC autonomous swimming state machine and serpentine undulation logic.
 */
import {
  TILE_SIZE,
  DIR_DOWN,
  DIR_RIGHT,
  DIR_UP,
  DIR_LEFT
} from '../core/constants.js';
import { debug } from '../core/state.js';
import { setEntityFrame } from '../core/assets.js';
import { isTileWalkable, checkCollision } from './collision.js';

/**
 * Update river eel swimming, serpentine undulation wiggle, and water navigation.
 * River eel uses an 8-view turntable (45° increments, 4 cols x 2 rows).
 * @param {Object} eel Entity definition
 * @param {number} dt Delta time in seconds
 */
export function updateEelNPC(eel, dt) {
  eel.animTime = (eel.animTime || 0) + dt;

  // Base turntable frame according to swimming direction (8 frames at 45° increments):
  // 0: Down (0°), 2: Right (90°), 4: Up (180°), 6: Left (270°)
  const baseFrame = eel.dir === DIR_DOWN ? 0 :
                    (eel.dir === DIR_RIGHT ? 2 :
                    (eel.dir === DIR_UP ? 4 : 6));

  // Serpentine swimming undulation: oscillate ±1 turntable angle (45° waviness)
  const wiggleSpeed = eel.isMoving ? 8.5 : 4.0;
  const wiggle = Math.round(Math.sin(eel.animTime * wiggleSpeed) * 0.85);
  eel.swimFrame = (baseFrame + wiggle + 8) % 8;
  eel.frameIndex = eel.swimFrame;
  setEntityFrame(eel, eel.swimFrame);

  if (debug.snapToGrid) {
    if (eel.isStepping) {
      eel.stepTime += dt;
      const t = Math.min(1, eel.stepTime / (eel.stepDuration || 0.35));
      eel.x = Math.round((eel.startTileX + (eel.targetTileX - eel.startTileX) * t) * TILE_SIZE);
      eel.y = Math.round((eel.startTileY + (eel.targetTileY - eel.startTileY) * t) * TILE_SIZE);
      eel.isMoving = true;

      if (t >= 1) {
        eel.tileX = eel.targetTileX;
        eel.tileY = eel.targetTileY;
        eel.x = eel.tileX * TILE_SIZE;
        eel.y = eel.tileY * TILE_SIZE;
        eel.isStepping = false;
        eel.stepsRemaining = (eel.stepsRemaining || 1) - 1;

        if (eel.stepsRemaining <= 0) {
          eel.isMoving = false;
          eel.wanderState = 'hover';
          eel.stateTimer = 1.0 + Math.random() * 1.5; // Hover gently undulating
        }
      }
    } else if (eel.wanderState === 'swimming') {
      let dx = 0, dy = 0;
      if (eel.dir === DIR_DOWN) dy = 1;
      else if (eel.dir === DIR_UP) dy = -1;
      else if (eel.dir === DIR_RIGHT) dx = 1;
      else if (eel.dir === DIR_LEFT) dx = -1;

      const nextTx = eel.tileX + dx;
      const nextTy = eel.tileY + dy;

      if (isTileWalkable(nextTx, nextTy, true)) {
        eel.isStepping = true;
        eel.stepTime = 0;
        eel.startTileX = eel.tileX;
        eel.startTileY = eel.tileY;
        eel.targetTileX = nextTx;
        eel.targetTileY = nextTy;
        eel.isMoving = true;
      } else {
        eel.isMoving = false;
        eel.wanderState = 'hover';
        eel.stateTimer = 0.8;
      }
    } else if (eel.wanderState === 'hover' || !eel.wanderState) {
      eel.isMoving = false;
      eel.stateTimer = (eel.stateTimer || 1.0) - dt;
      if (eel.stateTimer <= 0) {
        // Pick an open water tile direction
        const directions = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];
        directions.sort(() => Math.random() - 0.5);

        let chosenDir = null;
        for (const d of directions) {
          let tdx = 0, tdy = 0;
          if (d === DIR_DOWN) tdy = 1;
          else if (d === DIR_UP) tdy = -1;
          else if (d === DIR_RIGHT) tdx = 1;
          else if (d === DIR_LEFT) tdx = -1;

          if (isTileWalkable(eel.tileX + tdx, eel.tileY + tdy, true)) {
            chosenDir = d;
            break;
          }
        }

        if (chosenDir !== null) {
          eel.dir = chosenDir;
          eel.wanderState = 'swimming';
          eel.stepsRemaining = 1 + Math.floor(Math.random() * 4); // Cruise 1 to 4 water tiles
        } else {
          eel.stateTimer = 1.0;
        }
      }
    }
  } else {
    // Continuous free swim fallback
    eel.stateTimer = (eel.stateTimer || 1.0) - dt;
    if (eel.wanderState === 'swimming') {
      eel.isMoving = true;
      let vx = 0, vy = 0;
      if (eel.dir === DIR_DOWN) vy = 1;
      else if (eel.dir === DIR_UP) vy = -1;
      else if (eel.dir === DIR_RIGHT) vx = 1;
      else if (eel.dir === DIR_LEFT) vx = -1;

      const nextX = eel.x + vx * (eel.speed || 60) * dt;
      const nextY = eel.y + vy * (eel.speed || 60) * dt;

      if (!checkCollision(nextX, nextY, eel.width, eel.height, true)) {
        eel.x = nextX;
        eel.y = nextY;
        eel.tileX = Math.round(eel.x / TILE_SIZE);
        eel.tileY = Math.round(eel.y / TILE_SIZE);
      } else {
        eel.stateTimer = 0;
      }

      if (eel.stateTimer <= 0) {
        eel.isMoving = false;
        eel.wanderState = 'hover';
        eel.stateTimer = 1.0 + Math.random() * 1.5;
      }
    } else {
      eel.isMoving = false;
      if (eel.stateTimer <= 0) {
        eel.dir = Math.floor(Math.random() * 4);
        eel.wanderState = 'swimming';
        eel.stateTimer = 1.5 + Math.random() * 2.0;
      }
    }
  }
}

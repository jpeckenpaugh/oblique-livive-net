/**
 * Piranha Water NPC autonomous swimming state machine and tail wiggle turntable logic.
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
 * Update piranha swimming, tail oscillation wiggle, and water navigation.
 * @param {Object} piranha Entity definition
 * @param {number} dt Delta time in seconds
 */
export function updatePiranhaNPC(piranha, dt) {
  piranha.animTime += dt;

  // Base turntable frame according to swimming direction
  // 0: Down (0°), 3: Right (90°), 6: Up (180°), 9: Left (270°)
  const baseFrame = piranha.dir === DIR_DOWN ? 0 :
                    (piranha.dir === DIR_RIGHT ? 3 :
                    (piranha.dir === DIR_UP ? 6 : 9));

  // Lifelike swimming tail wiggle: oscillate ±1 turntable angle
  const wiggleSpeed = piranha.isMoving ? 10 : 5;
  const wiggle = Math.round(Math.sin(piranha.animTime * wiggleSpeed) * 0.8);
  piranha.swimFrame = (baseFrame + wiggle + 12) % 12;
  piranha.frameIndex = piranha.swimFrame;
  setEntityFrame(piranha, piranha.swimFrame);

  if (debug.snapToGrid) {
    if (piranha.isStepping) {
      piranha.stepTime += dt;
      const t = Math.min(1, piranha.stepTime / piranha.stepDuration);
      piranha.x = Math.round((piranha.startTileX + (piranha.targetTileX - piranha.startTileX) * t) * TILE_SIZE);
      piranha.y = Math.round((piranha.startTileY + (piranha.targetTileY - piranha.startTileY) * t) * TILE_SIZE);
      piranha.isMoving = true;

      if (t >= 1) {
        piranha.tileX = piranha.targetTileX;
        piranha.tileY = piranha.targetTileY;
        piranha.x = piranha.tileX * TILE_SIZE;
        piranha.y = piranha.tileY * TILE_SIZE;
        piranha.isStepping = false;
        piranha.stepsRemaining = (piranha.stepsRemaining || 1) - 1;

        if (piranha.stepsRemaining <= 0) {
          piranha.isMoving = false;
          piranha.wanderState = 'hover';
          piranha.stateTimer = 1.2 + Math.random() * 1.5; // Hover gently
        }
      }
    } else if (piranha.wanderState === 'swimming') {
      let dx = 0, dy = 0;
      if (piranha.dir === DIR_DOWN) dy = 1;
      else if (piranha.dir === DIR_UP) dy = -1;
      else if (piranha.dir === DIR_RIGHT) dx = 1;
      else if (piranha.dir === DIR_LEFT) dx = -1;

      const nextTx = piranha.tileX + dx;
      const nextTy = piranha.tileY + dy;

      if (isTileWalkable(nextTx, nextTy, true)) {
        piranha.isStepping = true;
        piranha.stepTime = 0;
        piranha.startTileX = piranha.tileX;
        piranha.startTileY = piranha.tileY;
        piranha.targetTileX = nextTx;
        piranha.targetTileY = nextTy;
        piranha.isMoving = true;
      } else {
        piranha.isMoving = false;
        piranha.wanderState = 'hover';
        piranha.stateTimer = 0.8;
      }
    } else if (piranha.wanderState === 'hover') {
      piranha.isMoving = false;
      piranha.stateTimer -= dt;
      if (piranha.stateTimer <= 0) {
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

          if (isTileWalkable(piranha.tileX + tdx, piranha.tileY + tdy, true)) {
            chosenDir = d;
            break;
          }
        }

        if (chosenDir !== null) {
          piranha.dir = chosenDir;
          piranha.wanderState = 'swimming';
          piranha.stepsRemaining = 1 + Math.floor(Math.random() * 4); // Cruise 1 to 4 tiles
        } else {
          piranha.stateTimer = 1.0;
        }
      }
    }
  } else {
    // Continuous free swim
    piranha.stateTimer -= dt;
    if (piranha.wanderState === 'swimming') {
      piranha.isMoving = true;
      let vx = 0, vy = 0;
      if (piranha.dir === DIR_DOWN) vy = 1;
      else if (piranha.dir === DIR_UP) vy = -1;
      else if (piranha.dir === DIR_RIGHT) vx = 1;
      else if (piranha.dir === DIR_LEFT) vx = -1;

      const nextX = piranha.x + vx * piranha.speed * dt;
      const nextY = piranha.y + vy * piranha.speed * dt;

      if (!checkCollision(nextX, nextY, piranha.width, piranha.height, true)) {
        piranha.x = nextX;
        piranha.y = nextY;
        piranha.tileX = Math.round(piranha.x / TILE_SIZE);
        piranha.tileY = Math.round(piranha.y / TILE_SIZE);
      } else {
        piranha.stateTimer = 0;
      }

      if (piranha.stateTimer <= 0) {
        piranha.isMoving = false;
        piranha.wanderState = 'hover';
        piranha.stateTimer = 1.0 + Math.random() * 1.5;
      }
    } else {
      piranha.isMoving = false;
      if (piranha.stateTimer <= 0) {
        piranha.dir = Math.floor(Math.random() * 4);
        piranha.wanderState = 'swimming';
        piranha.stateTimer = 1.5 + Math.random() * 2.0;
      }
    }
  }
}

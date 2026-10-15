/**
 * Picken NPC (Pig + Chicken) autonomous AI state machine.
 * Erratic farmyard forager: rapid ground pecks, jerky monocular head snaps, and sudden double-speed flurry dashes.
 */
import {
  TILE_SIZE,
  DIR_DOWN,
  DIR_RIGHT,
  DIR_UP,
  DIR_LEFT,
  DIR_TO_ANGLE,
  ANGLE_TO_DIR,
  TURNTABLE_12_FRAMES
} from '../core/constants.js';
import { debug } from '../core/state.js';
import { isTileWalkable, checkCollision } from './collision.js';
import { calculateTurnPath } from './player.js';

/**
 * Initiate a quick snappy turn for Picken.
 */
function startPickenTurn(picken, targetAngle, nextState, pendingDir = null) {
  if (debug.turnSmoothing && picken.facingAngle !== targetAngle) {
    const path = calculateTurnPath(picken.facingAngle, targetAngle);
    if (path.length > 0) {
      picken.wanderState = 'turning';
      picken.turnPath = path;
      picken.turnStepIndex = 0;
      picken.turnTimer = 0;
      picken.facingAngle = path[0];
      picken.nextStateAfterTurn = nextState;
      picken.pendingDir = pendingDir;
      if (picken.facingAngle in ANGLE_TO_DIR) {
        picken.dir = ANGLE_TO_DIR[picken.facingAngle];
      }
      return true;
    }
  }

  picken.facingAngle = targetAngle;
  if (targetAngle in ANGLE_TO_DIR) {
    picken.dir = ANGLE_TO_DIR[targetAngle];
  }
  if (pendingDir !== null) {
    picken.dir = pendingDir;
  }
  picken.wanderState = nextState;
  return false;
}

/**
 * Update Picken autonomous erratic AI.
 * @param {Object} picken Entity definition
 * @param {number} dt Delta time in seconds
 */
export function updatePickenNPC(picken, dt) {
  if (picken.facingAngle === undefined) {
    picken.facingAngle = DIR_TO_ANGLE[picken.dir] !== undefined ? DIR_TO_ANGLE[picken.dir] : 0;
  }
  if (!picken.turnPath) picken.turnPath = [];
  if (picken.turnStepIndex === undefined) picken.turnStepIndex = 0;
  if (picken.turnTimer === undefined) picken.turnTimer = 0;

  if (debug.snapToGrid) {
    // --- Grid Stepping Movement ---
    if (picken.isStepping) {
      picken.stepTime += dt;
      const stepDuration = picken.isFlurrying ? 0.14 : (picken.stepDuration || 0.24);
      const t = Math.min(1, picken.stepTime / stepDuration);
      picken.x = Math.round((picken.startTileX + (picken.targetTileX - picken.startTileX) * t) * TILE_SIZE);
      picken.y = Math.round((picken.startTileY + (picken.targetTileY - picken.startTileY) * t) * TILE_SIZE);
      picken.animTime = (picken.animTime || 0) + (dt * (picken.isFlurrying ? 1.6 : 1.0));
      picken.isMoving = true;

      if (t >= 1) {
        picken.tileX = picken.targetTileX;
        picken.tileY = picken.targetTileY;
        picken.x = picken.tileX * TILE_SIZE;
        picken.y = picken.tileY * TILE_SIZE;
        picken.isStepping = false;
        picken.stepsRemaining = (picken.stepsRemaining || 1) - 1;

        if (picken.stepsRemaining <= 0) {
          picken.isMoving = false;
          picken.isFlurrying = false;
          picken.animTime = 0;
          // Chickens almost always peck the ground immediately after a run!
          picken.wanderState = 'pecking';
          picken.peckCount = 4 + Math.floor(Math.random() * 4); // 4-7 pecks
          picken.peckTimer = 0;
          picken.peckSide = 0;
        }
      }
    } else if (picken.wanderState === 'pecking') {
      // Rapid ground-pecking and snuffling behavior!
      picken.isMoving = false;
      picken.peckTimer = (picken.peckTimer || 0) + dt;
      const peckSpeed = 0.085; // 85ms per peck bob

      if (picken.peckTimer >= peckSpeed) {
        picken.peckTimer = 0;
        picken.peckCount--;
        // Alternate between front view and slight 30° head-down tilt
        picken.peckSide = picken.peckSide === 0 ? (Math.random() < 0.5 ? 30 : 330) : 0;
        picken.facingAngle = picken.peckSide;

        if (picken.peckCount <= 0) {
          // Finished foraging! Stand up and do a jerky check
          picken.facingAngle = DIR_TO_ANGLE[picken.dir] || 0;
          picken.wanderState = 'jerky_look';
          picken.stateTimer = 0.4 + Math.random() * 0.4;
        }
      }
    } else if (picken.wanderState === 'jerky_look') {
      // Sharp monocular side-glance freeze
      picken.isMoving = false;
      picken.stateTimer -= dt;

      if (picken.stateTimer <= 0) {
        const roll = Math.random();

        if (roll < 0.40) {
          // Snap head to the other side sharply!
          const cardinalAngle = DIR_TO_ANGLE[picken.dir] || 0;
          const otherSide = picken.facingAngle === (cardinalAngle + 90) % 360 ? -90 : 90;
          picken.facingAngle = (cardinalAngle + otherSide + 360) % 360;
          picken.stateTimer = 0.35 + Math.random() * 0.35;
        } else {
          // Ready to waddle or dash!
          choosePickenWalkDirection(picken);
        }
      }
    } else if (picken.wanderState === 'turning') {
      picken.isMoving = false;
      picken.turnTimer += dt;
      const stepDuration = 0.040; // Chickens turn rapidly!

      while (picken.turnTimer >= stepDuration && picken.wanderState === 'turning') {
        picken.turnTimer -= stepDuration;
        picken.turnStepIndex++;
        if (picken.turnStepIndex < picken.turnPath.length) {
          picken.facingAngle = picken.turnPath[picken.turnStepIndex];
          if (picken.facingAngle in ANGLE_TO_DIR) {
            picken.dir = ANGLE_TO_DIR[picken.facingAngle];
          }
        } else {
          if (picken.turnPath.length > 0) {
            picken.facingAngle = picken.turnPath[picken.turnPath.length - 1];
            if (picken.facingAngle in ANGLE_TO_DIR) {
              picken.dir = ANGLE_TO_DIR[picken.facingAngle];
            }
          }
          picken.turnPath = [];
          picken.turnTimer = 0;

          const nextState = picken.nextStateAfterTurn || 'walking';
          picken.wanderState = nextState;

          if (nextState === 'walking') {
            if (picken.pendingDir !== null) {
              picken.dir = picken.pendingDir;
              picken.facingAngle = DIR_TO_ANGLE[picken.dir];
            }
            // 20% chance of sudden double-speed flurry dash!
            picken.isFlurrying = Math.random() < 0.20;
            picken.stepsRemaining = picken.isFlurrying ? 2 : (1 + Math.floor(Math.random() * 2));
          }
          break;
        }
      }
    } else if (picken.wanderState === 'walking') {
      let dx = 0, dy = 0;
      if (picken.dir === DIR_DOWN) dy = 1;
      else if (picken.dir === DIR_UP) dy = -1;
      else if (picken.dir === DIR_RIGHT) dx = 1;
      else if (picken.dir === DIR_LEFT) dx = -1;

      const nextTx = picken.tileX + dx;
      const nextTy = picken.tileY + dy;

      if (isTileWalkable(nextTx, nextTy, false)) {
        picken.isStepping = true;
        picken.stepTime = 0;
        picken.startTileX = picken.tileX;
        picken.startTileY = picken.tileY;
        picken.targetTileX = nextTx;
        picken.targetTileY = nextTy;
        picken.isMoving = true;
      } else {
        picken.isMoving = false;
        picken.isFlurrying = false;
        picken.animTime = 0;
        picken.wanderState = 'pecking';
        picken.peckCount = 3;
        picken.peckTimer = 0;
      }
    } else {
      // Idle fallback
      picken.wanderState = 'pecking';
      picken.peckCount = 4;
      picken.peckTimer = 0;
    }
  } else {
    // Free movement fallback
    picken.stateTimer = (picken.stateTimer || 1.0) - dt;
    if (picken.wanderState === 'walking') {
      picken.isMoving = true;
      picken.animTime = (picken.animTime || 0) + dt;
      let vx = 0, vy = 0;
      if (picken.dir === DIR_DOWN) vy = 1;
      else if (picken.dir === DIR_UP) vy = -1;
      else if (picken.dir === DIR_RIGHT) vx = 1;
      else if (picken.dir === DIR_LEFT) vx = -1;
      picken.facingAngle = DIR_TO_ANGLE[picken.dir] || 0;

      const nextX = picken.x + vx * (picken.speed || 78) * dt;
      const nextY = picken.y + vy * (picken.speed || 78) * dt;

      if (!checkCollision(nextX, nextY, picken.width, picken.height, false)) {
        picken.x = nextX;
        picken.y = nextY;
        picken.tileX = Math.round(picken.x / TILE_SIZE);
        picken.tileY = Math.round(picken.y / TILE_SIZE);
      } else {
        picken.stateTimer = 0;
      }

      if (picken.stateTimer <= 0) {
        picken.isMoving = false;
        picken.wanderState = 'pecking';
        picken.peckCount = 4;
        picken.peckTimer = 0;
      }
    } else {
      picken.isMoving = false;
      if (picken.stateTimer <= 0) {
        picken.dir = Math.floor(Math.random() * 4);
        picken.wanderState = 'walking';
        picken.stateTimer = 1.0 + Math.random() * 1.2;
      }
    }
  }
}

/**
 * Helper to select Picken's next waddle direction.
 */
function choosePickenWalkDirection(picken) {
  const candidates = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];
  candidates.sort(() => Math.random() - 0.5);

  let chosenDir = candidates[0];
  for (const d of candidates) {
    let tdx = 0, tdy = 0;
    if (d === DIR_DOWN) tdy = 1;
    else if (d === DIR_UP) tdy = -1;
    else if (d === DIR_RIGHT) tdx = 1;
    else if (d === DIR_LEFT) tdx = -1;

    if (isTileWalkable(picken.tileX + tdx, picken.tileY + tdy, false)) {
      chosenDir = d;
      break;
    }
  }

  const targetAngle = DIR_TO_ANGLE[chosenDir];
  startPickenTurn(picken, targetAngle, 'walking', chosenDir);
}

/**
 * Shuppy NPC (Sheep + Puppy) autonomous AI state machine.
 * Playful companion behavior: curious head tilts, tail-chasing 360° zoomie spins, and bounding trots.
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
import { calculateTurnPath, player } from './player.js';

/**
 * Initiate a smooth turntable turn for Shuppy toward a target angle.
 */
function startShuppyTurn(shuppy, targetAngle, nextState, pendingDir = null) {
  if (debug.turnSmoothing && shuppy.facingAngle !== targetAngle) {
    const path = calculateTurnPath(shuppy.facingAngle, targetAngle);
    if (path.length > 0) {
      shuppy.wanderState = 'turning';
      shuppy.turnPath = path;
      shuppy.turnStepIndex = 0;
      shuppy.turnTimer = 0;
      shuppy.facingAngle = path[0];
      shuppy.nextStateAfterTurn = nextState;
      shuppy.pendingDir = pendingDir;
      if (shuppy.facingAngle in ANGLE_TO_DIR) {
        shuppy.dir = ANGLE_TO_DIR[shuppy.facingAngle];
      }
      return true;
    }
  }

  shuppy.facingAngle = targetAngle;
  if (targetAngle in ANGLE_TO_DIR) {
    shuppy.dir = ANGLE_TO_DIR[targetAngle];
  }
  if (pendingDir !== null) {
    shuppy.dir = pendingDir;
  }
  shuppy.wanderState = nextState;
  return false;
}

/**
 * Update Shuppy autonomous playful AI.
 * @param {Object} shuppy Entity definition
 * @param {number} dt Delta time in seconds
 */
export function updateShuppyNPC(shuppy, dt) {
  if (shuppy.facingAngle === undefined) {
    shuppy.facingAngle = DIR_TO_ANGLE[shuppy.dir] !== undefined ? DIR_TO_ANGLE[shuppy.dir] : 0;
  }
  if (!shuppy.turnPath) shuppy.turnPath = [];
  if (shuppy.turnStepIndex === undefined) shuppy.turnStepIndex = 0;
  if (shuppy.turnTimer === undefined) shuppy.turnTimer = 0;

  if (debug.snapToGrid) {
    // --- Grid Stepping Movement ---
    if (shuppy.isStepping) {
      shuppy.stepTime += dt;
      const t = Math.min(1, shuppy.stepTime / (shuppy.stepDuration || 0.28));
      shuppy.x = Math.round((shuppy.startTileX + (shuppy.targetTileX - shuppy.startTileX) * t) * TILE_SIZE);
      shuppy.y = Math.round((shuppy.startTileY + (shuppy.targetTileY - shuppy.startTileY) * t) * TILE_SIZE);
      shuppy.animTime = (shuppy.animTime || 0) + dt;
      shuppy.isMoving = true;

      if (t >= 1) {
        shuppy.tileX = shuppy.targetTileX;
        shuppy.tileY = shuppy.targetTileY;
        shuppy.x = shuppy.tileX * TILE_SIZE;
        shuppy.y = shuppy.tileY * TILE_SIZE;
        shuppy.isStepping = false;
        shuppy.stepsRemaining = (shuppy.stepsRemaining || 1) - 1;

        if (shuppy.stepsRemaining <= 0) {
          shuppy.isMoving = false;
          shuppy.animTime = 0;
          shuppy.wanderState = 'idle_pant';
          shuppy.stateTimer = 1.0 + Math.random() * 1.2;
        }
      }
    } else if (shuppy.wanderState === 'turning') {
      shuppy.isMoving = false;
      shuppy.turnTimer += dt;
      const stepDuration = shuppy.turnStepDuration || debug.turnStepDuration || 0.055;

      while (shuppy.turnTimer >= stepDuration && shuppy.wanderState === 'turning') {
        shuppy.turnTimer -= stepDuration;
        shuppy.turnStepIndex++;
        if (shuppy.turnStepIndex < shuppy.turnPath.length) {
          shuppy.facingAngle = shuppy.turnPath[shuppy.turnStepIndex];
          if (shuppy.facingAngle in ANGLE_TO_DIR) {
            shuppy.dir = ANGLE_TO_DIR[shuppy.facingAngle];
          }
        } else {
          if (shuppy.turnPath.length > 0) {
            shuppy.facingAngle = shuppy.turnPath[shuppy.turnPath.length - 1];
            if (shuppy.facingAngle in ANGLE_TO_DIR) {
              shuppy.dir = ANGLE_TO_DIR[shuppy.facingAngle];
            }
          }
          shuppy.turnPath = [];
          shuppy.turnTimer = 0;

          const nextState = shuppy.nextStateAfterTurn || 'idle_pant';
          shuppy.wanderState = nextState;

          if (nextState === 'walking') {
            if (shuppy.pendingDir !== null) {
              shuppy.dir = shuppy.pendingDir;
              shuppy.facingAngle = DIR_TO_ANGLE[shuppy.dir];
            }
            shuppy.stepsRemaining = 1 + Math.floor(Math.random() * 3);
          } else if (nextState === 'head_tilt') {
            shuppy.stateTimer = 1.2 + Math.random() * 0.8; // Hold curious head tilt
          } else if (nextState === 'idle_pant') {
            shuppy.stateTimer = 0.8 + Math.random() * 0.8;
          }
          break;
        }
      }
    } else if (shuppy.wanderState === 'tail_chase') {
      // Zoomies! Fast 360° spin chasing its own tail
      shuppy.isMoving = false;
      shuppy.turnTimer += dt;
      const spinStepDuration = 0.040; // 40ms per 30° step = ~0.48s full circle

      while (shuppy.turnTimer >= spinStepDuration && shuppy.wanderState === 'tail_chase') {
        shuppy.turnTimer -= spinStepDuration;
        shuppy.turnStepIndex++;
        if (shuppy.turnStepIndex < shuppy.turnPath.length) {
          shuppy.facingAngle = shuppy.turnPath[shuppy.turnStepIndex];
          if (shuppy.facingAngle in ANGLE_TO_DIR) {
            shuppy.dir = ANGLE_TO_DIR[shuppy.facingAngle];
          }
        } else {
          // Completed 360° puppy spin!
          shuppy.facingAngle = shuppy.turnPath[shuppy.turnPath.length - 1] || shuppy.facingAngle;
          if (shuppy.facingAngle in ANGLE_TO_DIR) {
            shuppy.dir = ANGLE_TO_DIR[shuppy.facingAngle];
          }
          shuppy.turnPath = [];
          shuppy.turnTimer = 0;
          shuppy.wanderState = 'idle_pant';
          shuppy.stateTimer = 0.8 + Math.random() * 0.6; // Happy pant after spinning
          break;
        }
      }
    } else if (shuppy.wanderState === 'walking') {
      let dx = 0, dy = 0;
      if (shuppy.dir === DIR_DOWN) dy = 1;
      else if (shuppy.dir === DIR_UP) dy = -1;
      else if (shuppy.dir === DIR_RIGHT) dx = 1;
      else if (shuppy.dir === DIR_LEFT) dx = -1;

      const nextTx = shuppy.tileX + dx;
      const nextTy = shuppy.tileY + dy;

      if (isTileWalkable(nextTx, nextTy, false)) {
        shuppy.isStepping = true;
        shuppy.stepTime = 0;
        shuppy.startTileX = shuppy.tileX;
        shuppy.startTileY = shuppy.tileY;
        shuppy.targetTileX = nextTx;
        shuppy.targetTileY = nextTy;
        shuppy.isMoving = true;
      } else {
        shuppy.isMoving = false;
        shuppy.animTime = 0;
        shuppy.wanderState = 'idle_pant';
        shuppy.stateTimer = 0.8;
      }
    } else if (shuppy.wanderState === 'idle_pant' || shuppy.wanderState === 'idle_center' || !shuppy.wanderState) {
      shuppy.isMoving = false;
      shuppy.stateTimer = (shuppy.stateTimer || 1.0) - dt;

      if (shuppy.stateTimer <= 0) {
        const roll = Math.random();

        if (roll < 0.28) {
          // 28% chance: Zoomies / Tail Chase 360° Spin!
          const startIdx = Math.round(shuppy.facingAngle / 30) % 12;
          const spinPath = [];
          for (let step = 1; step <= 12; step++) {
            spinPath.push(((startIdx + step) % 12) * 30);
          }
          shuppy.wanderState = 'tail_chase';
          shuppy.turnPath = spinPath;
          shuppy.turnStepIndex = 0;
          shuppy.turnTimer = 0;
          shuppy.facingAngle = spinPath[0];
        } else if (roll < 0.65) {
          // 37% chance: Curious Puppy Head Tilt
          const cardinalAngle = DIR_TO_ANGLE[shuppy.dir] || 0;
          const tiltSide = Math.random() < 0.5 ? 30 : -30;
          const targetTilt = (cardinalAngle + tiltSide + 360) % 360;
          startShuppyTurn(shuppy, targetTilt, 'head_tilt');
        } else {
          // 35% chance: Pick new direction and bounding trot
          chooseShuppyWalkDirection(shuppy);
        }
      }
    } else if (shuppy.wanderState === 'head_tilt') {
      shuppy.isMoving = false;
      shuppy.stateTimer -= dt;

      if (shuppy.stateTimer <= 0) {
        // After tilting head curiously, choose where to trot next
        chooseShuppyWalkDirection(shuppy);
      }
    }
  } else {
    // Free movement fallback
    shuppy.stateTimer = (shuppy.stateTimer || 1.0) - dt;
    if (shuppy.wanderState === 'walking') {
      shuppy.isMoving = true;
      shuppy.animTime = (shuppy.animTime || 0) + dt;
      let vx = 0, vy = 0;
      if (shuppy.dir === DIR_DOWN) vy = 1;
      else if (shuppy.dir === DIR_UP) vy = -1;
      else if (shuppy.dir === DIR_RIGHT) vx = 1;
      else if (shuppy.dir === DIR_LEFT) vx = -1;
      shuppy.facingAngle = DIR_TO_ANGLE[shuppy.dir] || 0;

      const nextX = shuppy.x + vx * (shuppy.speed || 72) * dt;
      const nextY = shuppy.y + vy * (shuppy.speed || 72) * dt;

      if (!checkCollision(nextX, nextY, shuppy.width, shuppy.height, false)) {
        shuppy.x = nextX;
        shuppy.y = nextY;
        shuppy.tileX = Math.round(shuppy.x / TILE_SIZE);
        shuppy.tileY = Math.round(shuppy.y / TILE_SIZE);
      } else {
        shuppy.stateTimer = 0;
      }

      if (shuppy.stateTimer <= 0) {
        shuppy.isMoving = false;
        shuppy.wanderState = 'idle_pant';
        shuppy.stateTimer = 1.0 + Math.random() * 1.0;
      }
    } else {
      shuppy.isMoving = false;
      if (shuppy.stateTimer <= 0) {
        shuppy.dir = Math.floor(Math.random() * 4);
        shuppy.wanderState = 'walking';
        shuppy.stateTimer = 1.2 + Math.random() * 1.5;
      }
    }
  }
}

/**
 * Helper to select Shuppy's next bounding trot direction.
 * Inclined to trot toward the player if nearby!
 */
function chooseShuppyWalkDirection(shuppy) {
  const pDist = Math.hypot(player.tileX - shuppy.tileX, player.tileY - shuppy.tileY);
  let candidates = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];

  // Friendly puppy attraction: 40% chance to bias toward player if within 5 tiles
  if (pDist <= 5 && Math.random() < 0.40) {
    const dX = player.tileX - shuppy.tileX;
    const dY = player.tileY - shuppy.tileY;
    const preferred = [];
    if (Math.abs(dX) > Math.abs(dY)) {
      preferred.push(dX > 0 ? DIR_RIGHT : DIR_LEFT);
      preferred.push(dY > 0 ? DIR_DOWN : DIR_UP);
    } else {
      preferred.push(dY > 0 ? DIR_DOWN : DIR_UP);
      preferred.push(dX > 0 ? DIR_RIGHT : DIR_LEFT);
    }
    candidates = [...preferred, ...candidates.filter(c => !preferred.includes(c))];
  } else {
    candidates.sort(() => Math.random() - 0.5);
  }

  let chosenDir = candidates[0];
  for (const d of candidates) {
    let tdx = 0, tdy = 0;
    if (d === DIR_DOWN) tdy = 1;
    else if (d === DIR_UP) tdy = -1;
    else if (d === DIR_RIGHT) tdx = 1;
    else if (d === DIR_LEFT) tdx = -1;

    if (isTileWalkable(shuppy.tileX + tdx, shuppy.tileY + tdy, false)) {
      chosenDir = d;
      break;
    }
  }

  const targetAngle = DIR_TO_ANGLE[chosenDir];
  startShuppyTurn(shuppy, targetAngle, 'walking', chosenDir);
}

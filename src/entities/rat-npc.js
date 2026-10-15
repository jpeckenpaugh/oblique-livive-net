/**
 * Rat NPC autonomous wandering state machine (Brown & Black Rats).
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
 * Helper to get Rat turn head angles from Row 4 (Still views).
 * Maintained for backward compatibility.
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
 * Get sprite sheet clipping coordinates (srcX, srcY, fw, fh) for rat NPC rendering and shadow projection.
 * Coordinates automatically sync between 8-frame walk cycles and 12-angle turntable poses.
 * @param {Object} rat 
 * @returns {{ srcX: number, srcY: number, fw: number, fh: number }}
 */
export function getRatFrameCoords(rat) {
  const fw = rat.frameWidth || 128;
  const fh = rat.frameHeight || 128;

  // 1. If actively taking a step or walking: use walk animation cycle
  if (rat.isStepping || (rat.isMoving && rat.wanderState === 'walking')) {
    const frameIndex = Math.floor((rat.animTime || 0) * (rat.fps || 8)) % (rat.totalWalkFrames || 8);
    return {
      srcX: frameIndex * fw,
      srcY: (rat.dir || 0) * fh,
      fw,
      fh
    };
  }

  // 2. If turning, sniffing, or idle: use exact 12-angle turntable frame
  const angle = (rat.facingAngle !== undefined) ? rat.facingAngle : (DIR_TO_ANGLE[rat.dir] || 0);
  const angleIdx = (Math.round(angle / 30) % 12 + 12) % 12;
  const frameInfo = TURNTABLE_12_FRAMES[angleIdx] || TURNTABLE_12_FRAMES[0];

  return {
    srcX: frameInfo.col * fw,
    srcY: frameInfo.row * fh,
    fw,
    fh
  };
}

/**
 * Initiate a smooth turntable turn for an NPC rat toward a target angle.
 * @param {Object} rat 
 * @param {number} targetAngle 
 * @param {string} nextState 
 * @param {number|null} pendingDir 
 * @returns {boolean} Whether a turn sequence was started
 */
function startRatTurn(rat, targetAngle, nextState, pendingDir = null) {
  if (debug.turnSmoothing && rat.facingAngle !== targetAngle) {
    const path = calculateTurnPath(rat.facingAngle, targetAngle);
    if (path.length > 0) {
      rat.wanderState = 'turning';
      rat.turnPath = path;
      rat.turnStepIndex = 0;
      rat.turnTimer = 0;
      rat.facingAngle = path[0];
      rat.nextStateAfterTurn = nextState;
      rat.pendingDir = pendingDir;
      if (rat.facingAngle in ANGLE_TO_DIR) {
        rat.dir = ANGLE_TO_DIR[rat.facingAngle];
      }
      return true;
    }
  }

  // Instant snap fallback
  rat.facingAngle = targetAngle;
  if (targetAngle in ANGLE_TO_DIR) {
    rat.dir = ANGLE_TO_DIR[targetAngle];
  }
  if (pendingDir !== null) {
    rat.dir = pendingDir;
  }
  rat.wanderState = nextState;
  return false;
}

/**
 * Generic Rat NPC wandering state machine (Brown and Black rat).
 * @param {Object} rat Entity definition
 * @param {number} dt Delta time in seconds
 */
export function updateRatNPC(rat, dt) {
  // Ensure required rotation and turn fields exist
  if (rat.facingAngle === undefined) {
    rat.facingAngle = DIR_TO_ANGLE[rat.dir] !== undefined ? DIR_TO_ANGLE[rat.dir] : 0;
  }
  if (!rat.turnPath) rat.turnPath = [];
  if (rat.turnStepIndex === undefined) rat.turnStepIndex = 0;
  if (rat.turnTimer === undefined) rat.turnTimer = 0;

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
    } else if (rat.wanderState === 'turning') {
      rat.isMoving = false;
      rat.turnTimer += dt;
      const stepDuration = rat.turnStepDuration || debug.turnStepDuration || 0.055;

      while (rat.turnTimer >= stepDuration && rat.wanderState === 'turning') {
        rat.turnTimer -= stepDuration;
        rat.turnStepIndex++;
        if (rat.turnStepIndex < rat.turnPath.length) {
          rat.facingAngle = rat.turnPath[rat.turnStepIndex];
          if (rat.facingAngle in ANGLE_TO_DIR) {
            rat.dir = ANGLE_TO_DIR[rat.facingAngle];
          }
        } else {
          // Completed the turn!
          if (rat.turnPath.length > 0) {
            rat.facingAngle = rat.turnPath[rat.turnPath.length - 1];
            if (rat.facingAngle in ANGLE_TO_DIR) {
              rat.dir = ANGLE_TO_DIR[rat.facingAngle];
            }
          }
          rat.turnPath = [];
          rat.turnTimer = 0;

          const nextState = rat.nextStateAfterTurn || 'idle_center';
          rat.wanderState = nextState;

          if (nextState === 'walking') {
            if (rat.pendingDir !== null) {
              rat.dir = rat.pendingDir;
              rat.facingAngle = DIR_TO_ANGLE[rat.dir];
            }
            rat.stepsRemaining = 1 + Math.floor(Math.random() * 3);
          } else if (nextState === 'looking') {
            rat.stateTimer = 0.5 + Math.random() * 0.4;
          } else if (nextState === 'idle_center') {
            rat.stateTimer = 0.6 + Math.random() * 0.6;
          }
          break;
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

      // Skittish rat startle reflex: if player approaches within 2.5 tiles, scurry away!
      const pDist = Math.hypot(player.tileX - rat.tileX, player.tileY - rat.tileY);
      if (pDist <= 2.5) {
        const dX = rat.tileX - player.tileX;
        const dY = rat.tileY - player.tileY;
        const fleeDir = Math.abs(dX) > Math.abs(dY)
          ? (dX >= 0 ? DIR_RIGHT : DIR_LEFT)
          : (dY >= 0 ? DIR_DOWN : DIR_UP);
        let fdx = fleeDir === DIR_RIGHT ? 1 : fleeDir === DIR_LEFT ? -1 : 0;
        let fdy = fleeDir === DIR_DOWN ? 1 : fleeDir === DIR_UP ? -1 : 0;
        if (isTileWalkable(rat.tileX + fdx, rat.tileY + fdy, false)) {
          startRatTurn(rat, DIR_TO_ANGLE[fleeDir], 'walking', fleeDir);
          rat.stepsRemaining = 2 + Math.floor(Math.random() * 2);
          return;
        }
      }

      if (rat.stateTimer <= 0) {
        // Start curiosity sniff cycle: choose random side to look at first
        const cardinalAngle = DIR_TO_ANGLE[rat.dir] || 0;
        rat.lookSide = Math.random() < 0.5 ? 'right' : 'left';
        rat.lookCount = 0;
        const targetLookAngle = rat.lookSide === 'right'
          ? (cardinalAngle + 30) % 360
          : (cardinalAngle - 30 + 360) % 360;

        startRatTurn(rat, targetLookAngle, 'looking');
      }
    } else if (rat.wanderState === 'looking') {
      rat.isMoving = false;
      rat.stateTimer -= dt;
      if (rat.stateTimer <= 0) {
        rat.lookCount = (rat.lookCount || 0) + 1;
        const cardinalAngle = DIR_TO_ANGLE[rat.dir] || 0;

        if (rat.lookCount < 2) {
          // Switch to the opposite side (e.g. was right, now look left across center)
          rat.lookSide = rat.lookSide === 'right' ? 'left' : 'right';
          const targetLookAngle = rat.lookSide === 'right'
            ? (cardinalAngle + 30) % 360
            : (cardinalAngle - 30 + 360) % 360;

          startRatTurn(rat, targetLookAngle, 'looking');
        } else {
          // Both curiosity looks completed. Pick a new walkable direction:
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

          const targetWalkAngle = DIR_TO_ANGLE[chosenDir];
          startRatTurn(rat, targetWalkAngle, 'walking', chosenDir);
        }
      }
    } else if (rat.wanderState === 'look_right' || rat.wanderState === 'look_left') {
      // Backward compatibility hook
      rat.wanderState = 'looking';
      rat.stateTimer = 0.5;
    }
  } else {
    // --- Free Continuous Movement Fallback ---
    rat.stateTimer -= dt;
    if (rat.wanderState === 'walking') {
      rat.isMoving = true;
      rat.animTime += dt;
      let vx = 0, vy = 0;
      if (rat.dir === DIR_DOWN) vy = 1;
      else if (rat.dir === DIR_UP) vy = -1;
      else if (rat.dir === DIR_RIGHT) vx = 1;
      else if (rat.dir === DIR_LEFT) vx = -1;

      rat.facingAngle = DIR_TO_ANGLE[rat.dir] || 0;

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
    } else if (rat.wanderState === 'turning') {
      rat.isMoving = false;
      rat.turnTimer += dt;
      const stepDuration = rat.turnStepDuration || debug.turnStepDuration || 0.055;
      while (rat.turnTimer >= stepDuration && rat.wanderState === 'turning') {
        rat.turnTimer -= stepDuration;
        rat.turnStepIndex++;
        if (rat.turnStepIndex < rat.turnPath.length) {
          rat.facingAngle = rat.turnPath[rat.turnStepIndex];
          if (rat.facingAngle in ANGLE_TO_DIR) {
            rat.dir = ANGLE_TO_DIR[rat.facingAngle];
          }
        } else {
          if (rat.turnPath.length > 0) {
            rat.facingAngle = rat.turnPath[rat.turnPath.length - 1];
            if (rat.facingAngle in ANGLE_TO_DIR) {
              rat.dir = ANGLE_TO_DIR[rat.facingAngle];
            }
          }
          rat.turnPath = [];
          rat.turnTimer = 0;
          rat.wanderState = rat.nextStateAfterTurn || 'idle_center';
          if (rat.wanderState === 'walking') {
            if (rat.pendingDir !== null) {
              rat.dir = rat.pendingDir;
              rat.facingAngle = DIR_TO_ANGLE[rat.dir];
            }
            rat.stateTimer = 1.1 + Math.random() * 1.5;
          } else {
            rat.stateTimer = 0.6 + Math.random() * 0.5;
          }
          break;
        }
      }
    } else if (rat.wanderState === 'idle_center') {
      rat.isMoving = false;
      if (rat.stateTimer <= 0) {
        const cardinalAngle = DIR_TO_ANGLE[rat.dir] || 0;
        rat.lookSide = Math.random() < 0.5 ? 'right' : 'left';
        rat.lookCount = 0;
        const targetLookAngle = rat.lookSide === 'right'
          ? (cardinalAngle + 30) % 360
          : (cardinalAngle - 30 + 360) % 360;
        startRatTurn(rat, targetLookAngle, 'looking');
      }
    } else if (rat.wanderState === 'looking') {
      rat.isMoving = false;
      if (rat.stateTimer <= 0) {
        rat.lookCount = (rat.lookCount || 0) + 1;
        const cardinalAngle = DIR_TO_ANGLE[rat.dir] || 0;
        if (rat.lookCount < 2) {
          rat.lookSide = rat.lookSide === 'right' ? 'left' : 'right';
          const targetLookAngle = rat.lookSide === 'right'
            ? (cardinalAngle + 30) % 360
            : (cardinalAngle - 30 + 360) % 360;
          startRatTurn(rat, targetLookAngle, 'looking');
        } else {
          const chosenDir = Math.floor(Math.random() * 4);
          const targetWalkAngle = DIR_TO_ANGLE[chosenDir];
          startRatTurn(rat, targetWalkAngle, 'walking', chosenDir);
        }
      }
    }
  }
}

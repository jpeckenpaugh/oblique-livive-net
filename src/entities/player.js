/**
 * Player Entity state, movement, and animation updates.
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
import { keys } from '../core/input.js';
import { isTileWalkable, checkCollision } from './collision.js';

export const player = {
  id: 'player',
  name: 'Player (Rukiya)',
  tileX: 24,
  tileY: 26,
  x: 24 * TILE_SIZE, // Footprint top-left X in pixels
  y: 26 * TILE_SIZE, // Footprint top-left Y in pixels
  startTileX: 24,
  startTileY: 26,
  targetTileX: 24,
  targetTileY: 26,
  isStepping: false,
  stepTime: 0,
  stepDuration: 0.18, // 0.18s per tile step
  width: 64,       // Footprint width
  height: 64,      // Footprint height
  speed: 160,      // Pixels per second (free movement fallback)
  dir: DIR_DOWN,
  facingAngle: 0,   // Current facing angle (0, 30, 60, ..., 330)
  isTurning: false, // Whether player is currently pivoting between turntable angles
  turnTimer: 0,     // Time elapsed in current turntable step
  turnPath: [],     // Array of intermediate turntable angles to pivot through
  turnStepIndex: 0, // Current index in turnPath
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
 * Calculate the shortest-arc intermediate turntable angles between two facing angles.
 * Returns an array of angles (excluding fromAngle, ending at toAngle).
 * @param {number} fromAngle 
 * @param {number} toAngle 
 * @returns {number[]}
 */
export function calculateTurnPath(fromAngle, toAngle) {
  const fromIdx = (Math.round((fromAngle || 0) / 30) % 12 + 12) % 12;
  const toIdx = (Math.round((toAngle || 0) / 30) % 12 + 12) % 12;
  if (fromIdx === toIdx) return [];

  const diff = (toIdx - fromIdx + 12) % 12;
  const step = diff <= 6 ? 1 : -1;
  const count = diff <= 6 ? diff : 12 - diff;

  const path = [];
  let curr = fromIdx;
  for (let i = 0; i < count; i++) {
    curr = (curr + step + 12) % 12;
    path.push(curr * 30);
  }
  return path;
}

/**
 * Get sprite sheet clipping coordinates (srcX, srcY, fw, fh) for player rendering and shadow projection.
 * Coordinates automatically sync between 8-frame walk cycles and 12-angle turntable poses.
 * @param {typeof player} p 
 * @returns {{ srcX: number, srcY: number, fw: number, fh: number }}
 */
export function getPlayerFrameCoords(p) {
  const fw = p.frameWidth || 128;
  const fh = p.frameHeight || 128;

  // If actively stepping across tiles or moving without turning, display walk animation cycle
  if (p.isStepping || (p.isMoving && !p.isTurning)) {
    const frameIndex = Math.floor(p.animTime * (p.fps || 8)) % (p.totalWalkFrames || 8);
    return {
      srcX: frameIndex * fw,
      srcY: p.dir * fh,
      fw,
      fh
    };
  }

  // When pivoting or idle, display the exact 12-angle turntable frame
  const angle = (p.facingAngle !== undefined) ? p.facingAngle : (DIR_TO_ANGLE[p.dir] || 0);
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
 * Attempt to initiate a grid step or turn in the pressed direction.
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

  let targetDir = DIR_DOWN;
  if (dy > 0) targetDir = DIR_DOWN;
  else if (dy < 0) targetDir = DIR_UP;
  else if (dx > 0) targetDir = DIR_RIGHT;
  else if (dx < 0) targetDir = DIR_LEFT;

  const targetAngle = DIR_TO_ANGLE[targetDir];

  // If turn smoothing is enabled and player is not yet facing target direction:
  // Smoothly pivot across intermediate turntable poses before walking
  if (debug.turnSmoothing && player.facingAngle !== targetAngle) {
    player.turnPath = calculateTurnPath(player.facingAngle, targetAngle);
    if (player.turnPath.length > 0) {
      player.isTurning = true;
      player.turnTimer = 0;
      player.turnStepIndex = 0;
      player.facingAngle = player.turnPath[0];
      if (player.facingAngle in ANGLE_TO_DIR) {
        player.dir = ANGLE_TO_DIR[player.facingAngle];
      }
      return true;
    }
  }

  // Already facing target direction or turn smoothing disabled:
  player.dir = targetDir;
  player.facingAngle = targetAngle;

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

        // Immediately check for next step or turn if key is held down
        const chained = tryStartPlayerGridStep();
        if (!chained && !player.isTurning) {
          player.isMoving = false;
          player.animTime = 0;
        }
      }
    } else if (player.isTurning) {
      // Actively rotating across turntable frames in place
      player.turnTimer += dt;
      const stepDuration = debug.turnStepDuration || 0.05;

      // Allow changing turn direction if user presses a different key mid-turn
      let inputDx = 0;
      let inputDy = 0;
      if (keys['w'] || keys['arrowup']) inputDy = -1;
      else if (keys['s'] || keys['arrowdown']) inputDy = 1;
      else if (keys['a'] || keys['arrowleft']) inputDx = -1;
      else if (keys['d'] || keys['arrowright']) inputDx = 1;

      if (inputDx !== 0 || inputDy !== 0) {
        let inputDir = DIR_DOWN;
        if (inputDy > 0) inputDir = DIR_DOWN;
        else if (inputDy < 0) inputDir = DIR_UP;
        else if (inputDx > 0) inputDir = DIR_RIGHT;
        else if (inputDx < 0) inputDir = DIR_LEFT;
        const inputAngle = DIR_TO_ANGLE[inputDir];
        const destAngle = player.turnPath[player.turnPath.length - 1];
        if (inputAngle !== destAngle) {
          player.turnPath = calculateTurnPath(player.facingAngle, inputAngle);
          player.turnStepIndex = 0;
          player.turnTimer = 0;
          if (player.turnPath.length > 0) {
            player.facingAngle = player.turnPath[0];
            if (player.facingAngle in ANGLE_TO_DIR) {
              player.dir = ANGLE_TO_DIR[player.facingAngle];
            }
          }
        }
      }

      while (player.turnTimer >= stepDuration && player.isTurning) {
        player.turnTimer -= stepDuration;
        player.turnStepIndex++;
        if (player.turnStepIndex < player.turnPath.length) {
          player.facingAngle = player.turnPath[player.turnStepIndex];
          if (player.facingAngle in ANGLE_TO_DIR) {
            player.dir = ANGLE_TO_DIR[player.facingAngle];
          }
        } else {
          // Completed the turn
          if (player.turnPath.length > 0) {
            player.facingAngle = player.turnPath[player.turnPath.length - 1];
            if (player.facingAngle in ANGLE_TO_DIR) {
              player.dir = ANGLE_TO_DIR[player.facingAngle];
            }
          }
          player.isTurning = false;
          player.turnTimer = 0;
          player.turnPath = [];

          // Try stepping immediately if directional key is still held down
          const startedStep = tryStartPlayerGridStep();
          if (!startedStep && !player.isTurning) {
            player.isMoving = false;
            player.animTime = 0;
          }
          break;
        }
      }
    } else {
      const started = tryStartPlayerGridStep();
      if (!started && !player.isTurning) {
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
      player.facingAngle = DIR_TO_ANGLE[player.dir];

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
  player.tileX = 24;
  player.tileY = 26;
  player.startTileX = 24;
  player.startTileY = 26;
  player.targetTileX = 24;
  player.targetTileY = 26;
  player.x = 24 * TILE_SIZE;
  player.y = 26 * TILE_SIZE;
  player.dir = DIR_DOWN;
  player.facingAngle = 0;
  player.isStepping = false;
  player.isMoving = false;
  player.isTurning = false;
  player.turnTimer = 0;
  player.turnPath = [];
  player.turnStepIndex = 0;
  player.animTime = 0;
}

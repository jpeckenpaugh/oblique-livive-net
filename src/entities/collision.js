/**
 * World collision and walkability detection.
 */
import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  TERRAIN_WATER
} from '../core/constants.js';
import { debug, terrainMap } from '../core/state.js';
import { entities } from './manifest.js';

/**
 * Check if a tile is a wooden dock pier.
 * @param {number} tx 
 * @param {number} ty 
 * @returns {boolean}
 */
export function isTileDock(tx, ty) {
  return entities.some(e => e.isDock && e.tileX === tx && e.tileY === ty);
}

/**
 * Discrete tile walkability check for grid-aligned movement.
 * @param {number} tx 
 * @param {number} ty 
 * @param {boolean} isWaterCreature 
 * @returns {boolean}
 */
export function isTileWalkable(tx, ty, isWaterCreature = false) {
  // Map boundary check
  if (tx < 0 || tx >= GRID_COLS || ty < 0 || ty >= GRID_ROWS) return false;

  // Solid obstacle collisions
  for (const ent of entities) {
    if (!ent.solid) continue;
    if (ent.id === 'house') {
      // Fisher's cottage footprint: 2x2 tiles
      if (tx >= ent.tileX && tx < ent.tileX + 2 && ty >= ent.tileY && ty < ent.tileY + 2) {
        return false;
      }
    } else {
      if (ent.tileX === tx && ent.tileY === ty) {
        return false;
      }
    }
  }

  const terrain = terrainMap[ty][tx];

  if (isWaterCreature) {
    // Piranhas must stay in water!
    return terrain === TERRAIN_WATER;
  } else {
    // Land creatures (Player & Rats)
    if (debug.waterSolid && terrain === TERRAIN_WATER) {
      // Wooden dock sections over water are walkable!
      return isTileDock(tx, ty);
    }
    return true;
  }
}

/**
 * Continuous AABB collision detection (used for free-movement fallback).
 * @param {number} targetX 
 * @param {number} targetY 
 * @param {number} selfWidth 
 * @param {number} selfHeight 
 * @param {boolean} isWaterCreature 
 * @returns {boolean}
 */
export function checkCollision(targetX, targetY, selfWidth, selfHeight, isWaterCreature = false) {
  if (!debug.collision) return false;

  // Map boundary collision
  if (targetX < 0 || targetX + selfWidth > WORLD_WIDTH) return true;
  if (targetY < 0 || targetY + selfHeight > WORLD_HEIGHT) return true;

  // Obstacle collision (using a 48x48 core box)
  const pad = 8;
  const box = {
    left: targetX + pad,
    right: targetX + selfWidth - pad,
    top: targetY + pad,
    bottom: targetY + selfHeight - pad
  };

  for (const ent of entities) {
    if (!ent.solid) continue;
    const entBox = {
      left: ent.x + pad,
      right: ent.x + ent.width - pad,
      top: ent.y + pad,
      bottom: ent.y + ent.height - pad
    };

    if (box.left < entBox.right &&
        box.right > entBox.left &&
        box.top < entBox.bottom &&
        box.bottom > entBox.top) {
      return true;
    }
  }

  // Water collision
  if (debug.waterSolid) {
    const minTx = Math.max(0, Math.floor(box.left / TILE_SIZE));
    const maxTx = Math.min(GRID_COLS - 1, Math.floor(box.right / TILE_SIZE));
    const minTy = Math.max(0, Math.floor(box.top / TILE_SIZE));
    const maxTy = Math.min(GRID_ROWS - 1, Math.floor(box.bottom / TILE_SIZE));

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (isWaterCreature) {
          if (terrainMap[ty][tx] !== TERRAIN_WATER) return true;
        } else {
          if (terrainMap[ty][tx] === TERRAIN_WATER && !isTileDock(tx, ty)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

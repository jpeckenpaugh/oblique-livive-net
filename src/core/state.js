/**
 * Central game and editor state store for the Oblique 2.5D sandbox.
 */
import { DEFAULT_TERRAIN_MAP, PURE_GRASS_TERRAIN_MAP, DIRT_TRAIL_TERRAIN_MAP } from '../terrain/terrain-maps.js';

export const debug = {
  snapToGrid: true,
  cameraFollow: true,
  turnSmoothing: true,
  turnStepDuration: 0.05,
  grid: false,
  hitbox: false,
  anchor: false,
  bounds: false,
  collision: true,
  waterSolid: true,
  shadows: true,
  shadowFeather: 0.40
};

export const grassParams = {
  mode: 'meander',      // 'meander' | 'smudge' | 'ribbons' | 'biome'
  meanderAmp: 35,       // Wave displacement amplitude (0 to 80 px)
  waveFreq: 1.0,        // Wavelength multiplier (0.3 to 2.5)
  seamSmudge: 12        // Cross-tile bleed & seam blade smudge in pixels (0 to 24)
};

// 64x64 mutable 2D terrain grid
export let terrainMap = DEFAULT_TERRAIN_MAP.map(row => [...row]);

// Active terrain painter brush: null = Play Mode, 0 = Grass, 1 = Dirt, 2 = Water, 3 = Sand
export const editorState = {
  selectedEntity: null,
  activeBrush: null,
  currentZoom: 1.0
};

const terrainChangeListeners = new Set();

/**
 * Register a listener invoked whenever the terrain map is updated or reset.
 * @param {Function} callback 
 */
export function onTerrainChange(callback) {
  terrainChangeListeners.add(callback);
  return () => terrainChangeListeners.delete(callback);
}

/**
 * Notify all registered terrain listeners (e.g. grass flow re-bake).
 */
export function notifyTerrainChange() {
  for (const listener of terrainChangeListeners) {
    listener(terrainMap);
  }
}

/**
 * Reset the terrain map to either pure grass or dirt trail preset.
 * @param {boolean} isPure 
 */
export function resetTerrainMap(isPure = true) {
  const src = isPure ? PURE_GRASS_TERRAIN_MAP : DIRT_TRAIL_TERRAIN_MAP;
  terrainMap = src.map(r => [...r]);
  notifyTerrainChange();
}

/**
 * Set a specific tile's terrain type.
 * @param {number} tx 
 * @param {number} ty 
 * @param {number} type 
 */
export function setTileTerrain(tx, ty, type) {
  if (terrainMap[ty] && terrainMap[ty][tx] !== undefined) {
    if (terrainMap[ty][tx] !== type) {
      terrainMap[ty][tx] = type;
      notifyTerrainChange();
    }
  }
}

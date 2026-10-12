/**
 * Core engine constants for the Oblique 2.5D Model Sandbox.
 */

// Grid & World Dimensions
export const TILE_SIZE = 64;
export const GRID_COLS = 30;
export const GRID_ROWS = 24;
export const WORLD_WIDTH = GRID_COLS * TILE_SIZE;   // 1920 px
export const WORLD_HEIGHT = GRID_ROWS * TILE_SIZE; // 1536 px

// Terrain Types
export const TERRAIN_GRASS = 0;
export const TERRAIN_DIRT = 1;
export const TERRAIN_WATER = 2;
export const TERRAIN_SAND = 3;

// Grass Flow Resolution
export const FLOW_W = 480;
export const FLOW_H = 384;

// 4-Directional Facing
export const DIR_DOWN = 0;
export const DIR_RIGHT = 1;
export const DIR_UP = 2;
export const DIR_LEFT = 3;

// Oblique Directional Shadow Constants (Sun at East, 20° CCW tilt)
export const SHADOW_SHEAR_X = 0.19;
export const SHADOW_SCALE_Y = 0.52;
export const SHADOW_COLOR = 'rgba(20, 28, 40, 0.40)';

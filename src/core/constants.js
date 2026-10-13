/**
 * Core engine constants for the Oblique 2.5D Model Sandbox.
 */

// Grid & World Dimensions
export const TILE_SIZE = 64;
export const GRID_COLS = 64;
export const GRID_ROWS = 64;
export const WORLD_WIDTH = GRID_COLS * TILE_SIZE;   // 4096 px
export const WORLD_HEIGHT = GRID_ROWS * TILE_SIZE; // 4096 px

// Terrain Types
export const TERRAIN_GRASS = 0;
export const TERRAIN_DIRT = 1;
export const TERRAIN_WATER = 2;
export const TERRAIN_SAND = 3;

// Grass Flow Resolution
export const FLOW_W = 256;
export const FLOW_H = 256;

// 4-Directional Facing
export const DIR_DOWN = 0;
export const DIR_RIGHT = 1;
export const DIR_UP = 2;
export const DIR_LEFT = 3;

// Direction to Angular Degrees Mapping
export const DIR_TO_ANGLE = {
  [DIR_DOWN]: 0,
  [DIR_RIGHT]: 90,
  [DIR_UP]: 180,
  [DIR_LEFT]: 270
};

// Cardinal Angle to Direction Mapping
export const ANGLE_TO_DIR = {
  0: DIR_DOWN,
  90: DIR_RIGHT,
  180: DIR_UP,
  270: DIR_LEFT
};

// 12-Angle Turntable Pose Index (30° increments)
// Columns/Rows mapped from 8x5 sprite sheets: Rows 0..3 are cardinals, Row 4 contains 8 intermediate stills
export const TURNTABLE_12_FRAMES = [
  { angle: 0, row: 0, col: 0 },    // Front / Down
  { angle: 30, row: 4, col: 0 },   // Still 30°
  { angle: 60, row: 4, col: 1 },   // Still 60°
  { angle: 90, row: 1, col: 0 },   // Right
  { angle: 120, row: 4, col: 2 },  // Still 120°
  { angle: 150, row: 4, col: 3 },  // Still 150°
  { angle: 180, row: 2, col: 0 },  // Back / Up
  { angle: 210, row: 4, col: 4 },  // Still 210°
  { angle: 240, row: 4, col: 5 },  // Still 240°
  { angle: 270, row: 3, col: 0 },  // Left
  { angle: 300, row: 4, col: 6 },  // Still 300°
  { angle: 330, row: 4, col: 7 }   // Still 330°
];

// Oblique Directional Shadow Constants (Sun at East, 20° CCW tilt)
export const SHADOW_SHEAR_X = 0.19;
export const SHADOW_SCALE_Y = 0.52;
export const SHADOW_COLOR = 'rgba(20, 28, 40, 0.40)';

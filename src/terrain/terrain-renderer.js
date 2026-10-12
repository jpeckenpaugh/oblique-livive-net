/**
 * Ground grid and terrain renderer.
 * 4-Pass rendering: Base texture tiles, seam smudging, continuous grass flow, coastal sand & surf foam.
 */
import {
  TILE_SIZE,
  GRID_ROWS,
  GRID_COLS,
  TERRAIN_GRASS,
  TERRAIN_DIRT,
  TERRAIN_WATER,
  TERRAIN_SAND
} from '../core/constants.js';
import { debug, grassParams, terrainMap } from '../core/state.js';
import { tileCanvases, makePrng } from './tile-textures.js';
import { grassFlowCanvas } from './grass-flow.js';

/**
 * Render cross-tile grass blade smudging to eliminate hard rectangular box borders.
 * @param {CanvasRenderingContext2D} ctx 
 */
export function renderTileSeamSmudge(ctx) {
  const bleed = grassParams.seamSmudge;
  if (bleed <= 0) return;

  const bladeColors = ['#2d5e38', '#387848', '#469156', '#244d2e'];

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (terrainMap[r][c] !== TERRAIN_GRASS) continue;

      const gx = c * TILE_SIZE;
      const gy = r * TILE_SIZE;

      // 1. Vertical seam with eastern grass neighbor (x = gx + TILE_SIZE)
      if (c < GRID_COLS - 1 && terrainMap[r][c + 1] === TERRAIN_GRASS) {
        const seamX = gx + TILE_SIZE;
        const rand = makePrng(c * 7919 + r * 104729);

        // Sprinkle organic cross-seam grass blade tufts
        const numTufts = 4 + Math.floor(rand() * 3);
        for (let i = 0; i < numTufts; i++) {
          const ty = gy + Math.floor(rand() * (TILE_SIZE - 8)) + 4;
          const ox = Math.floor((rand() - 0.5) * bleed);
          const color = bladeColors[Math.floor(rand() * bladeColors.length)];
          const bladeH = 3 + Math.floor(rand() * 4);

          ctx.fillStyle = color;
          ctx.fillRect(seamX + ox, ty, 2, bladeH);
          ctx.fillRect(seamX + ox + 1, ty - 1, 1, bladeH + 1);
        }
      }

      // 2. Horizontal seam with southern grass neighbor (y = gy + TILE_SIZE)
      if (r < GRID_ROWS - 1 && terrainMap[r + 1][c] === TERRAIN_GRASS) {
        const seamY = gy + TILE_SIZE;
        const rand = makePrng(c * 65537 + r * 131071);

        const numTufts = 4 + Math.floor(rand() * 3);
        for (let i = 0; i < numTufts; i++) {
          const tx = gx + Math.floor(rand() * (TILE_SIZE - 8)) + 4;
          const oy = Math.floor((rand() - 0.5) * bleed);
          const color = bladeColors[Math.floor(rand() * bladeColors.length)];
          const bladeH = 3 + Math.floor(rand() * 4);

          ctx.fillStyle = color;
          ctx.fillRect(tx, seamY + oy, 2, bladeH);
          ctx.fillRect(tx + 1, seamY + oy - 1, 1, bladeH + 1);
        }
      }

      // 3. Diagonal 4-way corner junction smudging
      if (c < GRID_COLS - 1 && r < GRID_ROWS - 1 &&
          terrainMap[r][c + 1] === TERRAIN_GRASS &&
          terrainMap[r + 1][c] === TERRAIN_GRASS &&
          terrainMap[r + 1][c + 1] === TERRAIN_GRASS) {
        const jx = gx + TILE_SIZE;
        const jy = gy + TILE_SIZE;
        ctx.fillStyle = '#367746';
        ctx.fillRect(jx - 2, jy - 3, 4, 6);
        ctx.fillRect(jx - 3, jy - 2, 6, 4);
        ctx.fillStyle = '#4ea05f';
        ctx.fillRect(jx - 1, jy - 4, 2, 3);
        ctx.fillRect(jx + 1, jy - 2, 2, 4);
      }
    }
  }
}

/**
 * Render floor grid with procedural terrain, unboxed continuous grass flow, seam smudges & surf.
 * @param {CanvasRenderingContext2D} ctx 
 * @param {HTMLCanvasElement} canvas 
 * @param {number} now 
 */
export function renderGroundGrid(ctx, canvas, now) {
  const timeSec = (now || 0) * 0.001;

  // --- Pass 1: Render Base Terrain Texture Tiles ---
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const gx = c * TILE_SIZE;
      const gy = r * TILE_SIZE;
      const type = terrainMap[r][c];

      if (type === TERRAIN_GRASS) {
        const variant = (c * 7 + r * 13) % 3;
        ctx.drawImage(tileCanvases.grass[variant], gx, gy);
      } else if (type === TERRAIN_DIRT) {
        const variant = (c * 5 + r * 11) % 2;
        ctx.drawImage(tileCanvases.dirt[variant], gx, gy);
      } else if (type === TERRAIN_SAND) {
        const variant = (c * 3 + r * 7) % 2;
        ctx.drawImage(tileCanvases.sand[variant], gx, gy);
      } else if (type === TERRAIN_WATER) {
        // Deep ocean/river base
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(gx, gy, TILE_SIZE, TILE_SIZE);

        // Animated wave currents
        ctx.fillStyle = '#2563eb';
        const waveY1 = gy + 14 + Math.sin(timeSec * 2.8 + c * 0.7 + r * 0.4) * 3;
        const waveY2 = gy + 38 + Math.sin(timeSec * 2.8 + c * 0.7 + r * 0.4 + 2.1) * 3;
        ctx.fillRect(gx + 4, waveY1, 26, 2.5);
        ctx.fillRect(gx + 32, waveY2, 24, 2.5);

        // Specular highlights
        ctx.fillStyle = 'rgba(219, 234, 254, 0.55)';
        ctx.fillRect(gx + 10, waveY1 + 1, 14, 1.5);
        ctx.fillRect(gx + 38, waveY2 + 1, 12, 1.5);
      }
    }
  }

  // --- Pass 2: Cross-Tile Seam Smudging (Dissolves Hard Tile Box Edges) ---
  renderTileSeamSmudge(ctx);

  // --- Pass 3: Continuous Out-of-Sync Sine Wave Flow Gradient (Hardware Bilinear Smooth) ---
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(grassFlowCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // --- Pass 4: Sand & Coastal Fringe Transitions & Dynamic Surf Foam ---
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const gx = c * TILE_SIZE;
      const gy = r * TILE_SIZE;
      const type = terrainMap[r][c];

      if (type === TERRAIN_DIRT || type === TERRAIN_SAND) {
        // Soft organic grass fringe transitions if bordering grass
        const hasNorthGrass = r > 0 && terrainMap[r - 1][c] === TERRAIN_GRASS;
        const hasSouthGrass = r < GRID_ROWS - 1 && terrainMap[r + 1][c] === TERRAIN_GRASS;
        const hasWestGrass = c > 0 && terrainMap[r][c - 1] === TERRAIN_GRASS;
        const hasEastGrass = c < GRID_COLS - 1 && terrainMap[r][c + 1] === TERRAIN_GRASS;

        ctx.fillStyle = '#2d5e38';
        if (hasNorthGrass) {
          for (let i = 0; i < TILE_SIZE; i += 4) {
            const len = (i * 7 + c * 3) % 4 + 2;
            ctx.fillRect(gx + i, gy, 3, len);
          }
        }
        if (hasSouthGrass) {
          for (let i = 0; i < TILE_SIZE; i += 4) {
            const len = (i * 7 + c * 5) % 4 + 2;
            ctx.fillRect(gx + i, gy + TILE_SIZE - len, 3, len);
          }
        }
        if (hasWestGrass) {
          for (let i = 0; i < TILE_SIZE; i += 4) {
            const len = (i * 7 + r * 3) % 4 + 2;
            ctx.fillRect(gx, gy + i, len, 3);
          }
        }
        if (hasEastGrass) {
          for (let i = 0; i < TILE_SIZE; i += 4) {
            const len = (i * 7 + r * 5) % 4 + 2;
            ctx.fillRect(gx + TILE_SIZE - len, gy + i, len, 3);
          }
        }
      } else if (type === TERRAIN_WATER) {
        // Shoreline transitions if adjacent to land
        const isWestLand = c > 0 && terrainMap[r][c - 1] !== TERRAIN_WATER;
        const isEastLand = c < GRID_COLS - 1 && terrainMap[r][c + 1] !== TERRAIN_WATER;
        const isNorthLand = r > 0 && terrainMap[r - 1][c] !== TERRAIN_WATER;
        const isSouthLand = r < GRID_ROWS - 1 && terrainMap[r + 1][c] !== TERRAIN_WATER;
        const isNWLand = (r > 0 && c > 0) && terrainMap[r - 1][c - 1] !== TERRAIN_WATER;
        const isSWLand = (r < GRID_ROWS - 1 && c > 0) && terrainMap[r + 1][c - 1] !== TERRAIN_WATER;

        // Shoreline sand buffer
        ctx.fillStyle = 'rgba(212, 163, 115, 0.85)';
        if (isWestLand) ctx.fillRect(gx, gy, 4, TILE_SIZE);
        if (isEastLand) ctx.fillRect(gx + TILE_SIZE - 4, gy, 4, TILE_SIZE);
        if (isNorthLand) ctx.fillRect(gx, gy, TILE_SIZE, 4);
        if (isSouthLand) ctx.fillRect(gx, gy + TILE_SIZE - 4, TILE_SIZE, 4);

        // Dynamic rounded surf foam with breathing wave effect
        const surfBreath = Math.sin(timeSec * 2.8 + (r + c) * 0.5) * 1.5;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        if (isWestLand) ctx.fillRect(gx + 4, gy, 3 + surfBreath, TILE_SIZE);
        if (isEastLand) ctx.fillRect(gx + TILE_SIZE - 7 - surfBreath, gy, 3 + surfBreath, TILE_SIZE);
        if (isNorthLand) ctx.fillRect(gx, gy + 4, TILE_SIZE, 3 + surfBreath);
        if (isSouthLand) ctx.fillRect(gx, gy + TILE_SIZE - 7 - surfBreath, TILE_SIZE, 3 + surfBreath);

        // Diagonal corner rounding if meeting land diagonally
        if (!isWestLand && !isNorthLand && isNWLand) {
          ctx.fillStyle = 'rgba(212, 163, 115, 0.85)';
          ctx.fillRect(gx, gy, 5, 5);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.fillRect(gx + 2, gy + 2, 4, 4);
        }
        if (!isWestLand && !isSouthLand && isSWLand) {
          ctx.fillStyle = 'rgba(212, 163, 115, 0.85)';
          ctx.fillRect(gx, gy + TILE_SIZE - 5, 5, 5);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.fillRect(gx + 2, gy + TILE_SIZE - 6, 4, 4);
        }
      }

      // Grid lines overlay (only if checked)
      if (debug.grid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(gx + 0.5, gy + 0.5, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}

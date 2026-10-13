/**
 * Web Worker for off-thread 4-harmonic grass flow field computation.
 * Pure mathematical computation with zero DOM dependencies.
 */

export function computeGrassFlowBuffer({
  FLOW_W,
  FLOW_H,
  GRID_ROWS,
  GRID_COLS,
  TILE_SIZE,
  TERRAIN_GRASS,
  terrainMap,
  grassParams
}) {
  const cos30 = 0.866025;
  const sin30 = 0.5;
  const fScale = grassParams.waveFreq;
  const amp = grassParams.meanderAmp;
  const buffer = new Uint8ClampedArray(FLOW_W * FLOW_H * 4);

  const worldW = GRID_COLS * TILE_SIZE;
  const worldH = GRID_ROWS * TILE_SIZE;
  const stepX = worldW / FLOW_W;
  const stepY = worldH / FLOW_H;
  const worldMaxDim = Math.max(worldW, worldH);

  let idx = 0;
  for (let sy = 0; sy < FLOW_H; sy++) {
    const wy = sy * stepY;
    const r = Math.floor(wy / TILE_SIZE);

    // Out-of-sync vertical / rolling waves
    const w1 = Math.sin(wy * 0.0055 * fScale + 1.25) * amp;
    const w2 = Math.cos(wy * 0.0135 * fScale + 3.41) * (amp * 0.55);

    for (let sx = 0; sx < FLOW_W; sx++) {
      const wx = sx * stepX;
      const c = Math.floor(wx / TILE_SIZE);

      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS || !terrainMap[r] || terrainMap[r][c] !== TERRAIN_GRASS) {
        buffer[idx + 3] = 0;
        idx += 4;
        continue;
      }

      // Out-of-sync cross-axis and diagonal waves
      const w3 = Math.sin(wx * 0.0082 * fScale + wy * 0.0068 * fScale + 0.85) * (amp * 0.45);
      const w4 = Math.cos(wx * 0.0185 * fScale - wy * 0.0125 * fScale + 2.15) * (amp * 0.30);

      const px = wx + w1 + w4;
      const py = wy + w2 + w3;

      // 30 degree linear projection in warped coordinate space
      const proj30 = px * cos30 + py * sin30;
      const tLinear = proj30 / (worldMaxDim * 0.9);

      // Large radial forest core
      const distInland = Math.hypot(px - (worldW * 0.25), py - (worldH * 0.25)) / (worldMaxDim * 0.5);

      let factor = Math.min(1, Math.max(0, tLinear * 0.70 + distInland * 0.30));

      // Mode-specific contour shaping
      if (grassParams.mode === 'ribbons') {
        const ribbon = Math.sin(factor * Math.PI * 10) * 0.09;
        factor = Math.min(1, Math.max(0, factor + ribbon));
      } else if (grassParams.mode === 'biome') {
        const micro = Math.sin(wx * 0.022 * fScale) * Math.cos(wy * 0.022 * fScale) * 0.07;
        factor = Math.min(1, Math.max(0, factor + micro));
      } else if (grassParams.mode === 'smudge') {
        const smudgeDrift = Math.sin((wx + wy) * 0.003 * fScale) * 0.04;
        factor = Math.min(1, Math.max(0, factor + smudgeDrift));
      }

      // Map continuous factor to organic, unboxed tints:
      if (factor < 0.48) {
        // Deep inland emerald forest shade
        const alpha = Math.min(255, Math.round((0.48 - factor) * 0.65 * 255));
        buffer[idx] = 16;
        buffer[idx + 1] = 56;
        buffer[idx + 2] = 26;
        buffer[idx + 3] = alpha;
      } else if (factor > 0.32) {
        // Sunny coastal lime tint
        const alpha = Math.min(255, Math.round((factor - 0.32) * 0.48 * 255));
        buffer[idx] = 215;
        buffer[idx + 1] = 235;
        buffer[idx + 2] = 105;
        buffer[idx + 3] = alpha;
      } else {
        buffer[idx + 3] = 0;
      }

      idx += 4;
    }
  }
  return buffer;
}

// In Worker context, listen to compute messages
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = function (e) {
    const { id, params } = e.data;
    const buffer = computeGrassFlowBuffer(params);
    self.postMessage({ id, buffer }, [buffer.buffer]);
  };
}

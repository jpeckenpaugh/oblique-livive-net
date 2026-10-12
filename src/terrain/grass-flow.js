/**
 * Continuous Smooth Out-of-Sync Sine Wave Flow Field Manager.
 * Orchestrates worker computation with synchronous fallback.
 */
import {
  FLOW_W,
  FLOW_H,
  GRID_ROWS,
  GRID_COLS,
  TILE_SIZE,
  TERRAIN_GRASS
} from '../core/constants.js';
import { grassParams, terrainMap, onTerrainChange } from '../core/state.js';
import { computeGrassFlowBuffer } from './grass-flow.worker.js';

export const grassFlowCanvas = document.createElement('canvas');
grassFlowCanvas.width = FLOW_W;
grassFlowCanvas.height = FLOW_H;
export const grassFlowCtx = grassFlowCanvas.getContext('2d');
export const flowImageData = grassFlowCtx.createImageData(FLOW_W, FLOW_H);

let flowWorker = null;
let currentJobId = 0;
let workerSupported = true;

// Initialize Worker if available
try {
  if (typeof Worker !== 'undefined') {
    flowWorker = new Worker(new URL('./grass-flow.worker.js', import.meta.url), { type: 'module' });
    flowWorker.onmessage = function (e) {
      const { id, buffer } = e.data;
      if (id === currentJobId) {
        flowImageData.data.set(buffer);
        grassFlowCtx.putImageData(flowImageData, 0, 0);
      }
    };
    flowWorker.onerror = function () {
      workerSupported = false;
      flowWorker = null;
    };
  }
} catch {
  workerSupported = false;
  flowWorker = null;
}

/**
 * Recomputes the harmonic grass flow field.
 * Uses worker if available, or synchronous calculation immediately.
 * @param {boolean} immediateSync Force synchronous computation
 */
export function updateGrassFlowCanvas(immediateSync = false) {
  const params = {
    FLOW_W,
    FLOW_H,
    GRID_ROWS,
    GRID_COLS,
    TILE_SIZE,
    TERRAIN_GRASS,
    terrainMap,
    grassParams: { ...grassParams }
  };

  currentJobId++;

  if (!immediateSync && workerSupported && flowWorker) {
    try {
      flowWorker.postMessage({ id: currentJobId, params });
      return;
    } catch {
      // Fall through to synchronous fallback if postMessage fails
    }
  }

  // Synchronous compute fallback
  const buffer = computeGrassFlowBuffer(params);
  flowImageData.data.set(buffer);
  grassFlowCtx.putImageData(flowImageData, 0, 0);
}

// Automatically re-bake grass flow when terrainMap changes
onTerrainChange(() => {
  updateGrassFlowCanvas();
});

/**
 * Camera Viewport & Zoom Controller.
 */
import { editorState } from '../core/state.js';

let cachedCanvas = null;

export function initCamera(canvas) {
  cachedCanvas = canvas;
}

/**
 * Set pixel zoom scale (0.5x, 1x, 1.5x) and toggle UI buttons.
 * @param {number} scale 
 */
export function setZoom(scale) {
  editorState.currentZoom = scale;
  if (cachedCanvas) {
    cachedCanvas.style.transform = `scale(${scale})`;
  }
  const z05 = document.getElementById('zoom-05x');
  const z1 = document.getElementById('zoom-1x');
  const z15 = document.getElementById('zoom-15x');
  if (z05) z05.classList.toggle('active', scale === 0.5);
  if (z1) z1.classList.toggle('active', scale === 1.0);
  if (z15) z15.classList.toggle('active', scale === 1.5);
}

/**
 * Smoothly scroll viewport container to center on a target world coordinate.
 * @param {number} canvasX 
 * @param {number} canvasY 
 */
export function centerCameraOn(canvasX, canvasY) {
  const wrapper = document.getElementById('canvas-wrapper');
  if (!wrapper) return;
  const targetScrollLeft = (canvasX * editorState.currentZoom) - (wrapper.clientWidth / 2);
  const targetScrollTop = (canvasY * editorState.currentZoom) - (wrapper.clientHeight / 2);
  wrapper.scrollLeft = Math.max(0, targetScrollLeft);
  wrapper.scrollTop = Math.max(0, targetScrollTop);
}

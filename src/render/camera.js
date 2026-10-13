/**
 * Camera Viewport & Zoom Controller for 64x64 World.
 */
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';
import { editorState } from '../core/state.js';

let cachedCanvas = null;

export function updateWorldSpacer() {
  const spacer = document.getElementById('world-sizer');
  if (spacer) {
    const zoom = editorState.currentZoom || 1.0;
    spacer.style.width = `${Math.round(WORLD_WIDTH * zoom)}px`;
    spacer.style.height = `${Math.round(WORLD_HEIGHT * zoom)}px`;
  }
}

export function resizeCanvasToViewport(canvas) {
  const wrapper = document.getElementById('canvas-wrapper');
  if (!wrapper || !canvas) return;
  const w = Math.max(320, wrapper.clientWidth);
  const h = Math.max(240, wrapper.clientHeight);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
}

export function initCamera(canvas) {
  cachedCanvas = canvas;
  updateWorldSpacer();
  resizeCanvasToViewport(canvas);

  window.addEventListener('resize', () => {
    resizeCanvasToViewport(canvas);
  });

  const wrapper = document.getElementById('canvas-wrapper');
  if (wrapper) {
    // Mouse middle-click or right-click drag-to-pan
    let isPanning = false;
    let startPanX = 0;
    let startPanY = 0;
    let startScrollX = 0;
    let startScrollY = 0;

    wrapper.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 2 && editorState.activeBrush === null)) {
        isPanning = true;
        startPanX = e.clientX;
        startPanY = e.clientY;
        startScrollX = wrapper.scrollLeft;
        startScrollY = wrapper.scrollTop;
        wrapper.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isPanning) {
        const dx = e.clientX - startPanX;
        const dy = e.clientY - startPanY;
        wrapper.scrollLeft = startScrollX - dx;
        wrapper.scrollTop = startScrollY - dy;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (isPanning) {
        isPanning = false;
        wrapper.style.cursor = 'default';
      }
    });

    wrapper.addEventListener('contextmenu', (e) => {
      if (e.button === 2) e.preventDefault();
    });
  }
}

/**
 * Set pixel zoom scale (0.5x, 1x, 1.5x) and toggle UI buttons.
 * @param {number} scale 
 */
export function setZoom(scale) {
  editorState.currentZoom = scale;
  updateWorldSpacer();
  if (cachedCanvas) {
    resizeCanvasToViewport(cachedCanvas);
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
  const zoom = editorState.currentZoom || 1.0;
  const targetScrollLeft = Math.round((canvasX * zoom) - (wrapper.clientWidth / 2));
  const targetScrollTop = Math.round((canvasY * zoom) - (wrapper.clientHeight / 2));
  wrapper.scrollLeft = Math.max(0, targetScrollLeft);
  wrapper.scrollTop = Math.max(0, targetScrollTop);
}

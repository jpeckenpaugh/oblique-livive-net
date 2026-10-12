/**
 * Asset Manager & Image Preloader for the sandbox.
 */

export const assets = {};

/**
 * Load an image asset and cache it in the assets dictionary.
 * @param {string} name 
 * @param {string} src 
 * @returns {HTMLImageElement}
 */
export function loadImage(name, src) {
  const img = new Image();
  img.src = src;
  assets[name] = img;
  return img;
}

/**
 * Check if an asset image or canvas is loaded and ready for rendering.
 * @param {HTMLImageElement|HTMLCanvasElement} img 
 * @returns {boolean}
 */
export function isAssetReady(img) {
  return !!(img && ((img.complete && img.naturalWidth > 0) || (img.width > 0 && img.height > 0)));
}

// Cached shaded bitmap for Black Rat created directly from regular river-rat image
let shadedBlackRatCanvas = null;

/**
 * Retrieve or generate the desaturated, high-contrast black rat canvas.
 * @param {HTMLImageElement} srcImg 
 * @returns {HTMLCanvasElement|null}
 */
export function getShadedBlackRatCanvas(srcImg) {
  if (shadedBlackRatCanvas) return shadedBlackRatCanvas;
  if (!srcImg || !srcImg.naturalWidth) return null;

  const oc = document.createElement('canvas');
  oc.width = srcImg.naturalWidth;
  oc.height = srcImg.naturalHeight;
  const octx = oc.getContext('2d');
  // Tint bitmap to black: full desaturation, deep shadowing, high contrast
  octx.filter = 'grayscale(100%) brightness(0.38) contrast(1.3)';
  octx.drawImage(srcImg, 0, 0);
  shadedBlackRatCanvas = oc;
  return oc;
}

/**
 * Helper to update frame coordinates for turntable/sheet entities.
 * @param {Object} ent 
 * @param {number} frameIdx 
 */
export function setEntityFrame(ent, frameIdx) {
  ent.frameIndex = frameIdx;
  const fw = ent.frameWidth || 128;
  const fh = ent.frameHeight || 128;
  const cols = ent.asset === 'rock-pile' ? 4 : 4;
  ent.frameX = (frameIdx % cols) * fw;
  ent.frameY = Math.floor(frameIdx / cols) * fh;
}

/**
 * Preload all default sandbox assets.
 */
export function initAssets() {
  loadImage('rukiya', 'rukiya-walking-walking-animation-palette.webp');
  
  const ratImg = loadImage('river-rat', 'river-rat-walking-armature-unreal-take-baselayer-animation-palette.webp');
  ratImg.onload = () => {
    getShadedBlackRatCanvas(ratImg);
  };
  if (ratImg.complete && ratImg.naturalWidth > 0) {
    getShadedBlackRatCanvas(ratImg);
  }

  loadImage('palm-tree', 'tropical-palm-tree-turntable-palette.webp');
  loadImage('house', 'fishers-house-turntable-palette.webp');
  loadImage('barrel', 'wooden-barrel-turntable-palette.webp');
  loadImage('wooden-dock', 'wooden-dock-turntable-palette.webp');
  loadImage('fishers-net', 'fishers-net-turntable-palette.webp');
  loadImage('rock-pile', 'rock-pile-turntable-palette.webp');
  loadImage('piranha', 'piranha-turntable-palette.webp');
}

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

  try {
    // 1. Draw base sprite unshaded
    octx.drawImage(srcImg, 0, 0);
    // 2. Direct pixel shader for guaranteed cross-browser shading (immune to WebKit ctx.filter bugs)
    const imgData = octx.getImageData(0, 0, oc.width, oc.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) {
        const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        // Deep sleek charcoal/black fur curve with crisp highlight retention
        const gray = Math.round(Math.pow(lum, 1.2) * 85 + 12);
        d[i] = gray;
        d[i + 1] = gray;
        d[i + 2] = Math.min(255, gray + 4); // subtle cool charcoal sheen
      }
    }
    octx.putImageData(imgData, 0, 0);
  } catch {
    // Fallback via standard canvas composite operations if getImageData is restricted
    octx.clearRect(0, 0, oc.width, oc.height);
    octx.drawImage(srcImg, 0, 0);
    octx.globalCompositeOperation = 'multiply';
    octx.fillStyle = '#28282c';
    octx.fillRect(0, 0, oc.width, oc.height);
    octx.globalCompositeOperation = 'destination-in';
    octx.drawImage(srcImg, 0, 0);
    octx.globalCompositeOperation = 'source-over';
  }

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
  loadImage('house', 'fishers-house-0deg-single.webp');
  loadImage('barrel', 'wooden-barrel-turntable-palette.webp');
  loadImage('wooden-dock', 'wooden-dock-turntable-palette.webp');
  loadImage('fishers-net', 'fishers-net-turntable-palette.webp');
  loadImage('rock-pile', 'rock-pile-turntable-palette.webp');
  loadImage('piranha', 'piranha-turntable-palette.webp');
  loadImage('river-eel', 'river-eel-turntable-palette.webp');
  loadImage('shuppy', 'shuppy-walking-armature-unreal-take-baselayer-animation-palette.webp');
  loadImage('picken', 'pig-chicken-walking-armature-unreal-take-baselayer-animation-palette.webp');
  loadImage('fisherman-hut', 'fisherman-hut-0deg-single.webp');
  loadImage('longhouse', 'longhouse-0deg-single.webp');
}

/**
 * Directional Silhouette Shadow Rasterizer.
 * Shears, squashes, and projects dark object silhouettes onto the ground with baseline feathering.
 */
import {
  SHADOW_SHEAR_X,
  SHADOW_SCALE_Y,
  SHADOW_COLOR
} from '../core/constants.js';
import { debug } from '../core/state.js';
import { assets, isAssetReady } from '../core/assets.js';
import { entities } from '../entities/manifest.js';
import { player, getPlayerFrameCoords } from '../entities/player.js';
import { getRatFrameCoords } from '../entities/rat-npc.js';

// Reusable offscreen scratch canvas for rendering directional silhouette shadows
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = 256;
shadowCanvas.height = 256;
const shadowCtx = shadowCanvas.getContext('2d');

/**
 * Draw a single object's directional silhouette shadow onto the destination canvas.
 */
export function drawObjectSilhouetteShadow(
  ctx,
  img,
  srcX,
  srcY,
  fw,
  fh,
  rw,
  rh,
  Gx,
  Gy,
  localX,
  localY,
  isCenterAnchor
) {
  if (!img || !isAssetReady(img)) return;

  if (shadowCanvas.width < fw || shadowCanvas.height < fh) {
    shadowCanvas.width = Math.max(shadowCanvas.width, fw);
    shadowCanvas.height = Math.max(shadowCanvas.height, fh);
  }

  // Step 1: Draw source frame onto shadow scratch canvas
  shadowCtx.clearRect(0, 0, fw, fh);
  shadowCtx.drawImage(img, srcX, srcY, fw, fh, 0, 0, fw, fh);

  // Step 2: Mask with uniform dark grey silhouette & feather in the contact baseline
  shadowCtx.globalCompositeOperation = 'source-in';

  const featherRatio = debug.shadowFeather !== undefined ? debug.shadowFeather : 0.40;
  if (featherRatio > 0.005) {
    // Vertical gradient feathering across the contact baseline
    const grad = shadowCtx.createLinearGradient(0, 0, 0, fh);
    const contactStop = isCenterAnchor ? 0.72 : 1.0;
    const fadeStartStop = Math.max(0.05, contactStop - featherRatio);

    grad.addColorStop(0.0, SHADOW_COLOR);
    grad.addColorStop(fadeStartStop, SHADOW_COLOR);
    grad.addColorStop(contactStop, 'rgba(20, 28, 40, 0.00)');
    if (contactStop < 1.0) {
      grad.addColorStop(1.0, 'rgba(20, 28, 40, 0.00)');
    }

    shadowCtx.fillStyle = grad;
  } else {
    shadowCtx.fillStyle = SHADOW_COLOR;
  }

  shadowCtx.fillRect(0, 0, fw, fh);
  shadowCtx.globalCompositeOperation = 'source-over';

  // Step 3: Draw transformed silhouette onto the ground plane (sheared & tilted 20° CCW)
  ctx.save();
  ctx.translate(Gx, Gy);
  ctx.transform(1, 0, SHADOW_SHEAR_X, SHADOW_SCALE_Y, 0, 0);
  ctx.drawImage(shadowCanvas, 0, 0, fw, fh, localX, localY, rw, rh);
  ctx.restore();
}

/**
 * Render all scene shadows (placed on top of terrain, under all props & characters).
 * @param {CanvasRenderingContext2D} ctx Destination canvas 2D context
 * @param {number} now Timestamp in ms
 * @param {Object} camera Viewport bounds
 */
export function renderAllShadows(ctx, now, camera) {
  const nowSec = (now || 0) * 0.001;
  const viewLeft = camera ? camera.x - 300 : -10000;
  const viewTop = camera ? camera.y - 300 : -10000;
  const viewRight = camera ? camera.x + camera.w + 300 : 100000;
  const viewBottom = camera ? camera.y + camera.h + 300 : 100000;

  // 1. Static Props & NPC Shadows
  for (const ent of entities) {
    const rw = ent.renderWidth || ent.frameWidth || 128;
    const rh = ent.renderHeight || ent.frameHeight || 128;
    if (ent.x + rw < viewLeft || ent.x > viewRight ||
        ent.y + rh < viewTop || ent.y > viewBottom) {
      continue;
    }
    const img = assets[ent.asset];
    const fw = ent.frameWidth || 128;
    const fh = ent.frameHeight || 128;
    const anchorX = ent.anchorX !== undefined ? ent.anchorX : rw / 2;
    const anchorY = ent.anchorY !== undefined ? ent.anchorY : (ent.anchorPreset === 'center' ? rh / 2 : rh);
    const isCenter = ent.anchorPreset === 'center';

    let screenX, screenY, Gx, Gy;
    if (isCenter) {
      screenX = Math.round(ent.x + (ent.width / 2) - anchorX);
      screenY = Math.round(ent.y + (ent.height / 2) - anchorY);
      Gx = screenX + anchorX;
      Gy = screenY + anchorY + Math.round(rh * 0.14);
    } else {
      screenX = Math.round(ent.x + (ent.width / 2) - anchorX);
      screenY = Math.round(ent.y + ent.height - anchorY);
      Gx = screenX + anchorX;
      const contactOffset = ent.id === 'house' ? 12 : (ent.asset === 'palm-tree' ? 8 : 4);
      Gy = screenY + anchorY - contactOffset;
    }

    // Piranha NPCs cast soft, diffused underwater shadows directly on the seabed
    if (ent.npcType === 'piranha') {
      ctx.save();
      const bob = Math.sin((nowSec * 3.2) + (ent.bobOffset || 0)) * 2;
      ctx.fillStyle = 'rgba(10, 24, 60, 0.35)';
      ctx.beginPath();
      ctx.ellipse(screenX + anchorX, screenY + anchorY + 12 - bob, rw * 0.28, rh * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    const localX = screenX - Gx;
    const localY = screenY - Gy;

    // Frame selection for NPCs
    let srcX = ent.frameX || 0;
    let srcY = ent.frameY || 0;
    if (ent.type === 'npc' && ent.npcType === 'rat') {
      const coords = getRatFrameCoords(ent);
      srcX = coords.srcX;
      srcY = coords.srcY;
    }

    drawObjectSilhouetteShadow(ctx, img, srcX, srcY, fw, fh, rw, rh, Gx, Gy, localX, localY, isCenter);
  }

  // 2. Player Shadow
  const p = player;
  const pImg = p.customImg || assets[p.activeModel];
  const pFw = p.frameWidth;
  const pFh = p.frameHeight;
  const pRw = p.renderWidth || pFw;
  const pRh = p.renderHeight || pFh;
  const pAnchorX = p.anchorX;
  const pAnchorY = p.anchorY;
  const pIsCenter = p.anchorPreset === 'center';

  let pScreenX, pScreenY, pGx, pGy;
  if (pIsCenter) {
    pScreenX = Math.round(p.x + (p.width / 2) - pAnchorX);
    pScreenY = Math.round(p.y + (p.height / 2) - pAnchorY);
    pGx = pScreenX + pAnchorX;
    pGy = pScreenY + pAnchorY + Math.round(pRh * 0.14);
  } else {
    pScreenX = Math.round(p.x + (p.width / 2) - pAnchorX);
    pScreenY = Math.round(p.y + p.height - pAnchorY);
    pGx = pScreenX + pAnchorX;
    pGy = pScreenY + pAnchorY - 6; // Soles of shoes
  }

  const pLocalX = pScreenX - pGx;
  const pLocalY = pScreenY - pGy;
  const { srcX: pSrcX, srcY: pSrcY } = getPlayerFrameCoords(p);

  drawObjectSilhouetteShadow(ctx, pImg, pSrcX, pSrcY, pFw, pFh, pRw, pRh, pGx, pGy, pLocalX, pLocalY, pIsCenter);
}

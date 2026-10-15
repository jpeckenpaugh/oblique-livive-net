/**
 * Entity & Player sprite renderer with continuous Y-depth sorting.
 */
import { TILE_SIZE, DOCK_ELEVATION_OFFSET_Y } from '../core/constants.js';
import { editorState } from '../core/state.js';
import { assets, isAssetReady, getShadedBlackRatCanvas } from '../core/assets.js';
import { entities } from '../entities/manifest.js';
import { player, getPlayerFrameCoords } from '../entities/player.js';
import { getRatFrameCoords } from '../entities/rat-npc.js';
import { drawEntitySelectionOverlay, drawDebugVisuals } from './debug-renderer.js';

// Reusable scratch canvas for aquatic entities (piranha, eel) to apply feathered water transparency
const aquaticScratchCanvas = document.createElement('canvas');
aquaticScratchCanvas.width = 256;
aquaticScratchCanvas.height = 256;
const aquaticScratchCtx = aquaticScratchCanvas.getContext('2d');

/**
 * Render aquatic entities (piranha, eel) with feathered underwater transparency and depth absorption.
 * Keeps transparent margins untouched (no rectangular color bleed), while fading the lower parts
 * of the animal from ~80% height down to 0% height (bottom) into the water.
 */
export function renderAquaticEntitySprite(ctx, img, srcX, srcY, fw, fh, screenX, screenY, rw, rh) {
  if (aquaticScratchCanvas.width < fw || aquaticScratchCanvas.height < fh) {
    aquaticScratchCanvas.width = Math.max(aquaticScratchCanvas.width, fw);
    aquaticScratchCanvas.height = Math.max(aquaticScratchCanvas.height, fh);
  }

  // 1. Draw source frame onto scratch canvas
  aquaticScratchCtx.clearRect(0, 0, fw, fh);
  aquaticScratchCtx.drawImage(img, srcX, srcY, fw, fh, 0, 0, fw, fh);

  // 2. Subtle underwater color absorption/scatter tint applied strictly to opaque sprite pixels (source-atop)
  aquaticScratchCtx.globalCompositeOperation = 'source-atop';
  const tintGrad = aquaticScratchCtx.createLinearGradient(0, 0, 0, fh);
  tintGrad.addColorStop(0.0, 'rgba(20, 60, 130, 0.0)');
  tintGrad.addColorStop(0.20, 'rgba(20, 60, 130, 0.0)');
  tintGrad.addColorStop(0.60, 'rgba(20, 60, 130, 0.18)');
  tintGrad.addColorStop(1.0, 'rgba(15, 45, 100, 0.32)');
  aquaticScratchCtx.fillStyle = tintGrad;
  aquaticScratchCtx.fillRect(0, 0, fw, fh);

  // 3. Feathered fade-to-transparency on the lower parts of the sprite
  // From 80% of height down to the bottom (0% of height), opacity smoothly diminishes to transparent
  aquaticScratchCtx.globalCompositeOperation = 'destination-in';
  const fadeGrad = aquaticScratchCtx.createLinearGradient(0, 0, 0, fh);
  // Upper portion at water surface (100% to ~80% height): full opacity
  fadeGrad.addColorStop(0.0, 'rgba(0, 0, 0, 1.0)');
  fadeGrad.addColorStop(0.20, 'rgba(0, 0, 0, 1.0)');
  // Lower portion: feathered fade into water depth down to bottom
  fadeGrad.addColorStop(0.48, 'rgba(0, 0, 0, 0.82)');
  fadeGrad.addColorStop(0.72, 'rgba(0, 0, 0, 0.44)');
  fadeGrad.addColorStop(0.90, 'rgba(0, 0, 0, 0.12)');
  fadeGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  aquaticScratchCtx.fillStyle = fadeGrad;
  aquaticScratchCtx.fillRect(0, 0, fw, fh);

  // Restore default composite mode
  aquaticScratchCtx.globalCompositeOperation = 'source-over';

  // 4. Draw composite onto main scene
  ctx.drawImage(aquaticScratchCanvas, 0, 0, fw, fh, screenX, screenY, rw, rh);
}

/**
 * Render a single prop or NPC sprite with anchor offsets and custom shaders.
 */
export function renderEntitySprite(ctx, ent, now) {
  const nowSec = (now || 0) * 0.001;
  const img = assets[ent.asset];
  const fw = ent.frameWidth || 128;
  const fh = ent.frameHeight || 128;
  const rw = ent.renderWidth || fw;
  const rh = ent.renderHeight || fh;
  const anchorX = ent.anchorX !== undefined ? ent.anchorX : rw / 2;
  const anchorY = ent.anchorY !== undefined ? ent.anchorY : (ent.anchorPreset === 'center' ? rh / 2 : rh);

  let screenX, screenY;
  if (ent.anchorPreset === 'center') {
    screenX = Math.round(ent.x + (ent.width / 2) - anchorX);
    screenY = Math.round(ent.y + (ent.height / 2) - anchorY);
  } else {
    screenX = Math.round(ent.x + (ent.width / 2) - anchorX);
    screenY = Math.round(ent.y + ent.height - anchorY);
  }

  // Dock elevation rule: negatively bump dock sprites down 75% of their tile (48px)
  // so the walking plank deck aligns with the player footstep path across the pier.
  if (ent.isDock || ent.asset === 'wooden-dock') {
    screenY += DOCK_ELEVATION_OFFSET_Y;
  }

  // Piranhas & Eels have floating bobbing motion in water
  let bobY = 0;
  if (ent.npcType === 'piranha' || ent.npcType === 'eel') {
    bobY = Math.sin((nowSec * 3.2) + (ent.bobOffset || 0)) * 2.5;
    screenY += Math.round(bobY);
  }

  // Determine frame coordinates in sprite sheet
  let srcX = ent.frameX || 0;
  let srcY = ent.frameY || 0;

  if (ent.type === 'npc') {
    if (ent.npcType === 'rat' || ent.npcType === 'shuppy' || ent.npcType === 'picken') {
      const coords = getRatFrameCoords(ent);
      srcX = coords.srcX;
      srcY = coords.srcY;
    } else if (ent.npcType === 'piranha' || ent.npcType === 'eel') {
      srcX = ent.frameX || 0;
      srcY = ent.frameY || 0;
    }
  }

  // Draw sprite image or fallback placeholder
  if (isAssetReady(img)) {
    if (ent.tint === 'black') {
      const shadedRat = getShadedBlackRatCanvas(img);
      ctx.drawImage(shadedRat || img, srcX, srcY, fw, fh, screenX, screenY, rw, rh);
    } else if (ent.npcType === 'piranha' || ent.npcType === 'eel') {
      renderAquaticEntitySprite(ctx, img, srcX, srcY, fw, fh, screenX, screenY, rw, rh);
    } else {
      ctx.drawImage(img, srcX, srcY, fw, fh, screenX, screenY, rw, rh);
    }
  } else {
    // Fallback placeholder
    ctx.fillStyle = ent.solid ? '#ca8a04' : '#16a34a';
    ctx.fillRect(screenX + 8, screenY + 8, rw - 16, rh - 16);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ent.name, screenX + rw / 2, screenY + rh / 2);
  }

  // Selection Overlay if selected in Sprite Editor
  if (editorState.selectedEntity === ent) {
    drawEntitySelectionOverlay(ctx, ent, ent.x, ent.y, ent.width, ent.height, screenX, screenY, rw, rh, anchorX, anchorY);
  }

  // Debug Overlays
  drawDebugVisuals(ctx, ent.x, ent.y, ent.width, ent.height, screenX, screenY, rw, rh, anchorX, anchorY);
}

/**
 * Render the player character sprite.
 */
export function renderPlayerSprite(ctx, footX, footY, now) {
  const p = player;
  let img = p.customImg || assets[p.activeModel];

  const fw = p.frameWidth;
  const fh = p.frameHeight;
  const rw = p.renderWidth || fw;
  const rh = p.renderHeight || fh;
  const anchorX = p.anchorX;
  const anchorY = p.anchorY;

  let screenX, screenY;
  if (p.anchorPreset === 'center') {
    screenX = Math.round(footX + (p.width / 2) - anchorX);
    screenY = Math.round(footY + (p.height / 2) - anchorY);
  } else {
    screenX = Math.round(footX + (p.width / 2) - anchorX);
    screenY = Math.round(footY + p.height - anchorY);
  }

  // Frame selection (synchronized across walking cycles and 12-angle turntable poses):
  const { srcX, srcY } = getPlayerFrameCoords(p);

  if (isAssetReady(img)) {
    ctx.drawImage(img, srcX, srcY, fw, fh, screenX, screenY, rw, rh);
  } else {
    // Fallback procedural player
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(screenX + 16, screenY + 16, rw - 32, rh - 32);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Player', screenX + rw / 2, screenY + rh / 2);
  }

  // Selection Overlay if player is selected in Sprite Editor
  if (editorState.selectedEntity === player) {
    drawEntitySelectionOverlay(ctx, player, footX, footY, p.width, p.height, screenX, screenY, rw, rh, anchorX, anchorY);
  }

  // Debug Overlays
  drawDebugVisuals(ctx, footX, footY, p.width, p.height, screenX, screenY, rw, rh, anchorX, anchorY);
}

/**
 * Gather all renderable entities, sort continuously by foot Y-depth, and render bottom-to-top.
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} now 
 * @param {Object} camera Viewport bounds
 */
export function renderSortedEntities(ctx, now, camera) {
  const renderList = [];
  const viewLeft = camera ? camera.x - 300 : -10000;
  const viewTop = camera ? camera.y - 300 : -10000;
  const viewRight = camera ? camera.x + camera.w + 300 : 100000;
  const viewBottom = camera ? camera.y + camera.h + 300 : 100000;

  // Add static props and NPCs
  for (const ent of entities) {
    const rw = ent.renderWidth || ent.frameWidth || 128;
    const rh = ent.renderHeight || ent.frameHeight || 128;
    if (ent.x + rw < viewLeft || ent.x > viewRight ||
        ent.y + rh < viewTop || ent.y > viewBottom) {
      continue;
    }
    renderList.push({
      entity: ent,
      footX: ent.x,
      footY: ent.y,
      depthY: (ent.isDock || ent.asset === 'wooden-dock') ? ent.y + ent.height - 1 : ent.y + ent.height
    });
  }

  // Add Player
  if (player.x + 128 >= viewLeft && player.x <= viewRight &&
      player.y + 128 >= viewTop && player.y <= viewBottom) {
    renderList.push({
      entity: player,
      isPlayer: true,
      footX: player.x,
      footY: player.y,
      depthY: player.y + player.height
    });
  }

  // Continuous Y-Sorting (Lowest Y rendered first, Highest Y rendered last on top)
  renderList.sort((a, b) => a.depthY - b.depthY);

  const depthStat = document.getElementById('stat-depth-count');
  if (depthStat) depthStat.textContent = `Renderables: ${renderList.length}`;

  const currentTileX = Math.floor((player.x + 32) / TILE_SIZE);
  const currentTileY = Math.floor((player.y + 32) / TILE_SIZE);
  const playerTileStat = document.getElementById('stat-player-tile');
  if (playerTileStat) playerTileStat.textContent = `Tile: (${currentTileX}, ${currentTileY})`;

  // Render in sorted order
  for (const item of renderList) {
    if (item.isPlayer) {
      renderPlayerSprite(ctx, item.footX, item.footY, now);
    } else {
      renderEntitySprite(ctx, item.entity, now);
    }
  }
}

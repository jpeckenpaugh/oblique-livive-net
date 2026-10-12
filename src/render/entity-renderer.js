/**
 * Entity & Player sprite renderer with continuous Y-depth sorting.
 */
import { TILE_SIZE } from '../core/constants.js';
import { editorState } from '../core/state.js';
import { assets, isAssetReady, getShadedBlackRatCanvas } from '../core/assets.js';
import { entities } from '../entities/manifest.js';
import { player } from '../entities/player.js';
import { getRatLookFrame } from '../entities/rat-npc.js';
import { drawEntitySelectionOverlay, drawDebugVisuals } from './debug-renderer.js';

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

  // Piranhas have floating bobbing motion in water
  let bobY = 0;
  if (ent.npcType === 'piranha') {
    bobY = Math.sin((nowSec * 3.2) + (ent.bobOffset || 0)) * 2.5;
    screenY += Math.round(bobY);
  }

  // Determine frame coordinates in sprite sheet
  let srcX = ent.frameX || 0;
  let srcY = ent.frameY || 0;

  if (ent.type === 'npc') {
    if (ent.npcType === 'rat') {
      if (ent.wanderState === 'walking') {
        const frameIndex = Math.floor(ent.animTime * (ent.fps || 8)) % 8;
        srcX = frameIndex * fw;
        srcY = ent.dir * fh;
      } else if (ent.wanderState === 'look_right') {
        const look = getRatLookFrame(ent.dir, 'right');
        srcX = look.col * fw;
        srcY = look.row * fh;
      } else if (ent.wanderState === 'look_left') {
        const look = getRatLookFrame(ent.dir, 'left');
        srcX = look.col * fw;
        srcY = look.row * fh;
      } else {
        srcX = 0;
        srcY = ent.dir * fh;
      }
    } else if (ent.npcType === 'piranha') {
      srcX = ent.frameX || 0;
      srcY = ent.frameY || 0;
    }
  }

  // Draw sprite image or fallback placeholder
  if (isAssetReady(img)) {
    if (ent.tint === 'black') {
      const shadedRat = getShadedBlackRatCanvas(img);
      if (shadedRat) {
        ctx.drawImage(shadedRat, srcX, srcY, fw, fh, screenX, screenY, rw, rh);
      } else {
        ctx.save();
        ctx.filter = 'grayscale(100%) brightness(0.38) contrast(1.3)';
        ctx.drawImage(img, srcX, srcY, fw, fh, screenX, screenY, rw, rh);
        ctx.restore();
      }
    } else {
      ctx.drawImage(img, srcX, srcY, fw, fh, screenX, screenY, rw, rh);
    }

    // Half-Submerged Water Effects for Piranha
    if (ent.npcType === 'piranha') {
      ctx.save();
      // 1. Translucent underwater body wash tint (submerges lower 65% of the fish body)
      ctx.fillStyle = 'rgba(30, 75, 175, 0.45)';
      ctx.fillRect(screenX, screenY + Math.round(rh * 0.36), rw, Math.round(rh * 0.64));

      // 2. Surface water ripple ellipse surrounding the dorsal water plane
      const rippleBreath = Math.sin((nowSec * 4.0) + (ent.bobOffset || 0)) * 2.5;
      ctx.strokeStyle = 'rgba(219, 234, 254, 0.60)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(screenX + anchorX, screenY + anchorY + 4, Math.max(10, rw * 0.32 + rippleBreath), Math.max(4, rh * 0.14 + (rippleBreath * 0.4)), 0, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Specular water caustics / surface foam line
      ctx.fillStyle = 'rgba(255, 255, 255, 0.50)';
      ctx.fillRect(screenX + Math.round(rw * 0.18), screenY + Math.round(rh * 0.36), Math.round(rw * 0.64), 1.5);
      ctx.restore();
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

  // Frame selection:
  const frameIndex = p.isMoving ? Math.floor(p.animTime * p.fps) % p.totalWalkFrames : 0;
  const srcX = frameIndex * fw;
  const srcY = p.dir * fh;

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
 */
export function renderSortedEntities(ctx, now) {
  const renderList = [];

  // Add static props and NPCs
  for (const ent of entities) {
    renderList.push({
      entity: ent,
      footX: ent.x,
      footY: ent.y,
      depthY: ent.y + ent.height
    });
  }

  // Add Player
  renderList.push({
    entity: player,
    isPlayer: true,
    footX: player.x,
    footY: player.y,
    depthY: player.y + player.height
  });

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

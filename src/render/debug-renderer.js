/**
 * Debug visualizers and Sprite Editor selection overlay rendering.
 */
import { debug } from '../core/state.js';

/**
 * Render animated selection brackets and live anchor coordinate badges for selected entities.
 */
export function drawEntitySelectionOverlay(ctx, ent, footX, footY, footW, footH, screenX, screenY, rw, rh, anchorX, anchorY) {
  ctx.save();

  // 1. Animated marching dashed gold bounding box
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.lineDashOffset = -performance.now() * 0.025;
  ctx.strokeRect(screenX - 1.5, screenY - 1.5, rw + 3, rh + 3);
  ctx.setLineDash([]);

  // 2. Solid corner brackets
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  const bLen = Math.min(14, rw / 4);
  // Top-left
  ctx.beginPath();
  ctx.moveTo(screenX - 3, screenY + bLen);
  ctx.lineTo(screenX - 3, screenY - 3);
  ctx.lineTo(screenX + bLen, screenY - 3);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(screenX + rw + 3 - bLen, screenY - 3);
  ctx.lineTo(screenX + rw + 3, screenY - 3);
  ctx.lineTo(screenX + rw + 3, screenY + bLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(screenX - 3, screenY + rh + 3 - bLen);
  ctx.lineTo(screenX - 3, screenY + rh + 3);
  ctx.lineTo(screenX + bLen, screenY + rh + 3);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(screenX + rw + 3 - bLen, screenY + rh + 3);
  ctx.lineTo(screenX + rw + 3, screenY + rh + 3);
  ctx.lineTo(screenX + rw + 3, screenY + rh + 3 - bLen);
  ctx.stroke();

  // 3. Highlighted ground footprint
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.strokeRect(footX + 0.5, footY + 0.5, footW - 1, footH - 1);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
  ctx.fillRect(footX + 1, footY + 1, footW - 2, footH - 2);

  // 4. Anchor Point Crosshair & Live Coordinates Label
  const ax = screenX + anchorX;
  const ay = screenY + anchorY;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax - 9, ay);
  ctx.lineTo(ax + 9, ay);
  ctx.moveTo(ax, ay - 9);
  ctx.lineTo(ax, ay + 9);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(ax + 8, ay - 16, 110, 15);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.strokeRect(ax + 8, ay - 16, 110, 15);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(`Anchor: ${Math.round(anchorX)}, ${Math.round(anchorY)}`, ax + 12, ay - 5);

  ctx.restore();
}

/**
 * Render footprint hitboxes (red), bounding boxes (cyan), and anchor points (yellow).
 */
export function drawDebugVisuals(ctx, footX, footY, footW, footH, screenX, screenY, rw, rh, anchorX, anchorY) {
  // 1. Footprint Hitbox (Red outline around ground tile footprint)
  if (debug.hitbox) {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(footX + 0.5, footY + 0.5, footW - 1, footH - 1);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.fillRect(footX + 1, footY + 1, footW - 2, footH - 2);
  }

  // 2. Sprite Bounding Box (Cyan outline around entire rendered frame)
  if (debug.bounds) {
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, rw - 1, rh - 1);
  }

  // 3. Sprite Registration Anchor Point (Yellow dot)
  if (debug.anchor) {
    const ax = screenX + anchorX;
    const ay = screenY + anchorY;
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

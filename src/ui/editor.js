/**
 * Interactive In-Sandbox Sprite & Prop Editor.
 * Provides canvas click picking, live frame/anchor adjustment, and 2-way UI synchronization.
 */
import { TILE_SIZE, GRID_COLS, GRID_ROWS } from '../core/constants.js';
import { editorState } from '../core/state.js';
import { setEntityFrame } from '../core/assets.js';
import { entities } from '../entities/manifest.js';
import { player } from '../entities/player.js';
import { centerCameraOn } from '../render/camera.js';

export function updateFrameLabel(ent) {
  const idx = ent.frameIndex || 0;
  const angle = (idx * 30) % 360;
  const lbl = document.getElementById('ed-frame-label');
  if (lbl) lbl.textContent = `Frame ${idx} (${angle}°)`;
}

export function selectEntity(ent) {
  editorState.selectedEntity = ent;
  const selectBox = document.getElementById('editor-entity-select');
  const controlsPanel = document.getElementById('editor-controls-panel');

  if (!ent) {
    if (selectBox) selectBox.value = '';
    if (controlsPanel) controlsPanel.style.display = 'none';
    return;
  }

  if (controlsPanel) controlsPanel.style.display = 'block';
  if (selectBox) selectBox.value = ent.id;

  // Populate UI values
  const nameEl = document.getElementById('ed-entity-name');
  const idEl = document.getElementById('ed-entity-id');
  const tileXEl = document.getElementById('ed-tile-x');
  const tileYEl = document.getElementById('ed-tile-y');
  const frameSlider = document.getElementById('ed-frame-slider');
  const anchorPresetEl = document.getElementById('ed-anchor-preset');
  const anchorXEl = document.getElementById('ed-anchor-x');
  const anchorYEl = document.getElementById('ed-anchor-y');
  const renderWEl = document.getElementById('ed-render-w');
  const renderHEl = document.getElementById('ed-render-h');

  if (nameEl) nameEl.textContent = ent.name || ent.id;
  if (idEl) idEl.textContent = ent.id;
  if (tileXEl) tileXEl.value = ent.tileX !== undefined ? ent.tileX : Math.floor(ent.x / TILE_SIZE);
  if (tileYEl) tileYEl.value = ent.tileY !== undefined ? ent.tileY : Math.floor(ent.y / TILE_SIZE);

  const maxFrames = (ent.asset === 'rock-pile' ? 8 : 12) - 1;
  if (frameSlider) {
    frameSlider.max = maxFrames;
    frameSlider.value = ent.frameIndex || 0;
  }
  updateFrameLabel(ent);

  const rw = ent.renderWidth || ent.frameWidth || 128;
  const rh = ent.renderHeight || ent.frameHeight || 128;
  if (anchorPresetEl) anchorPresetEl.value = ent.anchorPreset || 'bottom-center';
  if (anchorXEl) anchorXEl.value = ent.anchorX !== undefined ? ent.anchorX : rw / 2;
  if (anchorYEl) anchorYEl.value = ent.anchorY !== undefined ? ent.anchorY : (ent.anchorPreset === 'center' ? rh / 2 : rh);
  if (renderWEl) renderWEl.value = rw;
  if (renderHEl) renderHEl.value = rh;
}

export function populateEntitySelect() {
  const select = document.getElementById('editor-entity-select');
  if (!select) return;
  select.innerHTML = '<option value="">-- Click Sprite or Select --</option>';

  // Player
  const optP = document.createElement('option');
  optP.value = player.id;
  optP.textContent = `★ ${player.name}`;
  select.appendChild(optP);

  // Entities
  for (const ent of entities) {
    const opt = document.createElement('option');
    opt.value = ent.id;
    const icon = ent.npcType ? '🐾 ' : (ent.isDock ? '⚓ ' : '📦 ');
    opt.textContent = `${icon}${ent.name}`;
    select.appendChild(opt);
  }
}

export function initEditor(canvas) {
  populateEntitySelect();

  // Canvas click to select entity
  canvas.addEventListener('click', (e) => {
    // If painting terrain, do not trigger sprite selection
    if (editorState.activeBrush !== null) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const hitCandidates = [];

    // Check player
    const pRw = player.renderWidth || player.frameWidth;
    const pRh = player.renderHeight || player.frameHeight;
    const pAnchorX = player.anchorX;
    const pAnchorY = player.anchorY;
    const pScreenX = Math.round(player.x + (player.width / 2) - pAnchorX);
    const pScreenY = player.anchorPreset === 'center'
      ? Math.round(player.y + (player.height / 2) - pAnchorY)
      : Math.round(player.y + player.height - pAnchorY);

    if (clickX >= pScreenX && clickX <= pScreenX + pRw && clickY >= pScreenY && clickY <= pScreenY + pRh) {
      hitCandidates.push({ ent: player, depth: player.y + player.height });
    }

    // Check entities
    for (const ent of entities) {
      const rw = ent.renderWidth || ent.frameWidth || 128;
      const rh = ent.renderHeight || ent.frameHeight || 128;
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

      const inBounds = (clickX >= screenX && clickX <= screenX + rw && clickY >= screenY && clickY <= screenY + rh);
      const inFootprint = (clickX >= ent.x && clickX <= ent.x + ent.width && clickY >= ent.y && clickY <= ent.y + ent.height);

      if (inBounds || inFootprint) {
        hitCandidates.push({ ent, depth: ent.y + ent.height });
      }
    }

    if (hitCandidates.length > 0) {
      hitCandidates.sort((a, b) => b.depth - a.depth);
      selectEntity(hitCandidates[0].ent);
    }
  });

  // Wire up Sprite Editor event controls
  const entitySelect = document.getElementById('editor-entity-select');
  if (entitySelect) {
    entitySelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) {
        selectEntity(null);
      } else if (val === 'player') {
        selectEntity(player);
      } else {
        const found = entities.find(x => x.id === val);
        selectEntity(found || null);
      }
    });
  }

  const tileXInput = document.getElementById('ed-tile-x');
  if (tileXInput) {
    tileXInput.addEventListener('input', (e) => {
      const ent = editorState.selectedEntity;
      if (!ent) return;
      const tx = Math.max(0, Math.min(GRID_COLS - 1, parseInt(e.target.value) || 0));
      ent.tileX = tx;
      ent.startTileX = tx;
      ent.targetTileX = tx;
      ent.x = tx * TILE_SIZE;
    });
  }

  const tileYInput = document.getElementById('ed-tile-y');
  if (tileYInput) {
    tileYInput.addEventListener('input', (e) => {
      const ent = editorState.selectedEntity;
      if (!ent) return;
      const ty = Math.max(0, Math.min(GRID_ROWS - 1, parseInt(e.target.value) || 0));
      ent.tileY = ty;
      ent.startTileY = ty;
      ent.targetTileY = ty;
      ent.y = ty * TILE_SIZE;
    });
  }

  const frameSlider = document.getElementById('ed-frame-slider');
  if (frameSlider) {
    frameSlider.addEventListener('input', (e) => {
      const ent = editorState.selectedEntity;
      if (!ent) return;
      const f = parseInt(e.target.value);
      setEntityFrame(ent, f);
      updateFrameLabel(ent);
    });
  }

  const prevFrameBtn = document.getElementById('ed-prev-frame');
  if (prevFrameBtn) {
    prevFrameBtn.addEventListener('click', () => {
      const ent = editorState.selectedEntity;
      if (!ent) return;
      const slider = document.getElementById('ed-frame-slider');
      let f = (ent.frameIndex || 0) - 1;
      if (f < 0) f = parseInt(slider.max);
      slider.value = f;
      setEntityFrame(ent, f);
      updateFrameLabel(ent);
    });
  }

  const nextFrameBtn = document.getElementById('ed-next-frame');
  if (nextFrameBtn) {
    nextFrameBtn.addEventListener('click', () => {
      const ent = editorState.selectedEntity;
      if (!ent) return;
      const slider = document.getElementById('ed-frame-slider');
      let f = (ent.frameIndex || 0) + 1;
      if (f > parseInt(slider.max)) f = 0;
      slider.value = f;
      setEntityFrame(ent, f);
      updateFrameLabel(ent);
    });
  }

  const anchorPresetEl = document.getElementById('ed-anchor-preset');
  if (anchorPresetEl) {
    anchorPresetEl.addEventListener('change', (e) => {
      const ent = editorState.selectedEntity;
      if (!ent) return;
      const preset = e.target.value;
      ent.anchorPreset = preset;
      const rw = ent.renderWidth || ent.frameWidth || 128;
      const rh = ent.renderHeight || ent.frameHeight || 128;

      if (preset === 'bottom-center') {
        ent.anchorX = rw / 2;
        ent.anchorY = rh;
      } else if (preset === 'center') {
        ent.anchorX = rw / 2;
        ent.anchorY = rh / 2;
      }
      document.getElementById('ed-anchor-x').value = ent.anchorX;
      document.getElementById('ed-anchor-y').value = ent.anchorY;
    });
  }

  const anchorXInput = document.getElementById('ed-anchor-x');
  if (anchorXInput) {
    anchorXInput.addEventListener('input', (e) => {
      const ent = editorState.selectedEntity;
      if (!ent) return;
      ent.anchorX = parseFloat(e.target.value) || 0;
      ent.anchorPreset = 'custom';
      document.getElementById('ed-anchor-preset').value = 'custom';
    });
  }

  const anchorYInput = document.getElementById('ed-anchor-y');
  if (anchorYInput) {
    anchorYInput.addEventListener('input', (e) => {
      const ent = editorState.selectedEntity;
      if (!ent) return;
      ent.anchorY = parseFloat(e.target.value) || 0;
      ent.anchorPreset = 'custom';
      document.getElementById('ed-anchor-preset').value = 'custom';
    });
  }

  const renderWInput = document.getElementById('ed-render-w');
  if (renderWInput) {
    renderWInput.addEventListener('input', (e) => {
      const ent = editorState.selectedEntity;
      if (!ent) return;
      ent.renderWidth = parseFloat(e.target.value) || 64;
    });
  }

  const renderHInput = document.getElementById('ed-render-h');
  if (renderHInput) {
    renderHInput.addEventListener('input', (e) => {
      const ent = editorState.selectedEntity;
      if (!ent) return;
      ent.renderHeight = parseFloat(e.target.value) || 64;
    });
  }

  const centerCamBtn = document.getElementById('ed-btn-center-cam');
  if (centerCamBtn) {
    centerCamBtn.addEventListener('click', () => {
      const ent = editorState.selectedEntity;
      if (!ent) return;
      centerCameraOn(ent.x + (ent.width / 2), ent.y + (ent.height / 2));
    });
  }

  const deselectBtn = document.getElementById('ed-btn-deselect');
  if (deselectBtn) {
    deselectBtn.addEventListener('click', () => {
      selectEntity(null);
    });
  }
}

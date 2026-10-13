/**
 * UI controls, debug overlay toggles, grass mode presets, and sprite uploader.
 */
import {
  TILE_SIZE,
  DIR_DOWN,
  DIR_RIGHT,
  DIR_UP,
  DIR_LEFT
} from '../core/constants.js';
import { debug, grassParams, editorState, resetTerrainMap } from '../core/state.js';
import { updateGrassFlowCanvas } from '../terrain/grass-flow.js';
import { entities } from '../entities/manifest.js';
import { player } from '../entities/player.js';
import { setZoom, centerCameraOn } from '../render/camera.js';
import { selectEntity } from './editor.js';

/**
 * Switch active player sprite model preset ('rukiya' vs 'river-rat').
 * @param {'rukiya'|'river-rat'} modelName 
 */
export function setPlayerModel(modelName) {
  player.activeModel = modelName;
  player.customImg = null;
  player.frameWidth = 128;
  player.frameHeight = 128;
  player.renderWidth = 128;
  player.renderHeight = 128;
  player.fps = 8;
  player.totalWalkFrames = 8;

  if (modelName === 'river-rat') {
    player.anchorX = 64;
    player.anchorY = 64; // Centered mid-body anchor for quadruped
    player.anchorPreset = 'center';
  } else {
    player.anchorX = 64;
    player.anchorY = 128; // Bottom-center anchor for humanoid
    player.anchorPreset = 'bottom-center';
  }

  const cardRukiya = document.getElementById('card-rukiya');
  const cardRat = document.getElementById('card-river-rat');
  if (cardRukiya) cardRukiya.classList.toggle('active', modelName === 'rukiya');
  if (cardRat) cardRat.classList.toggle('active', modelName === 'river-rat');

  if (editorState.selectedEntity === player) {
    selectEntity(player);
  }
}

/**
 * Switch grass harmonic smoothing mode and recompute flow field.
 * @param {'meander'|'smudge'|'ribbons'|'biome'} mode 
 */
export function setGrassMode(mode) {
  grassParams.mode = mode;
  const modes = ['meander', 'smudge', 'ribbons', 'biome'];
  modes.forEach(k => {
    const btn = document.getElementById(`btn-grass-mode-${k}`);
    if (btn) btn.classList.toggle('active', k === mode);
  });

  if (mode === 'meander') {
    grassParams.meanderAmp = 35;
    grassParams.waveFreq = 1.0;
    grassParams.seamSmudge = 12;
  } else if (mode === 'smudge') {
    grassParams.meanderAmp = 20;
    grassParams.waveFreq = 0.8;
    grassParams.seamSmudge = 20;
  } else if (mode === 'ribbons') {
    grassParams.meanderAmp = 50;
    grassParams.waveFreq = 1.3;
    grassParams.seamSmudge = 10;
  } else if (mode === 'biome') {
    grassParams.meanderAmp = 30;
    grassParams.waveFreq = 1.8;
    grassParams.seamSmudge = 14;
  }

  const ampInput = document.getElementById('rng-meander-amp');
  const ampLbl = document.getElementById('lbl-meander-amp');
  const freqInput = document.getElementById('rng-meander-freq');
  const freqLbl = document.getElementById('lbl-meander-freq');
  const smudgeInput = document.getElementById('rng-seam-smudge');
  const smudgeLbl = document.getElementById('lbl-seam-smudge');

  if (ampInput) ampInput.value = grassParams.meanderAmp;
  if (ampLbl) ampLbl.textContent = `${grassParams.meanderAmp}px`;
  if (freqInput) freqInput.value = Math.round(grassParams.waveFreq * 100);
  if (freqLbl) freqLbl.textContent = `${grassParams.waveFreq.toFixed(1)}x`;
  if (smudgeInput) smudgeInput.value = grassParams.seamSmudge;
  if (smudgeLbl) smudgeLbl.textContent = `${grassParams.seamSmudge}px`;

  updateGrassFlowCanvas();
}

/**
 * Initialize all sidebar controls and DOM listeners.
 */
export function initControls() {
  // Attach setPlayerModel to window for backward compatibility with inline onclick
  window.setPlayerModel = setPlayerModel;

  const cardRukiya = document.getElementById('card-rukiya');
  if (cardRukiya) cardRukiya.addEventListener('click', () => setPlayerModel('rukiya'));
  const cardRat = document.getElementById('card-river-rat');
  if (cardRat) cardRat.addEventListener('click', () => setPlayerModel('river-rat'));

  // Debug Checkboxes
  const chkSnap = document.getElementById('chk-snap-grid');
  if (chkSnap) chkSnap.addEventListener('change', (e) => debug.snapToGrid = e.target.checked);

  const chkTurnPivot = document.getElementById('chk-turn-pivot');
  if (chkTurnPivot) {
    chkTurnPivot.checked = debug.turnSmoothing;
    chkTurnPivot.addEventListener('change', (e) => debug.turnSmoothing = e.target.checked);
  }

  const chkCamFollow = document.getElementById('chk-camera-follow');
  if (chkCamFollow) chkCamFollow.addEventListener('change', (e) => debug.cameraFollow = e.target.checked);

  const chkGrid = document.getElementById('chk-grid');
  if (chkGrid) {
    chkGrid.checked = debug.grid;
    chkGrid.addEventListener('change', (e) => debug.grid = e.target.checked);
  }

  const chkHitbox = document.getElementById('chk-hitbox');
  if (chkHitbox) {
    chkHitbox.checked = debug.hitbox;
    chkHitbox.addEventListener('change', (e) => debug.hitbox = e.target.checked);
  }

  const chkAnchor = document.getElementById('chk-anchor');
  if (chkAnchor) {
    chkAnchor.checked = debug.anchor;
    chkAnchor.addEventListener('change', (e) => debug.anchor = e.target.checked);
  }

  const chkBounds = document.getElementById('chk-bounds');
  if (chkBounds) {
    chkBounds.checked = debug.bounds;
    chkBounds.addEventListener('change', (e) => debug.bounds = e.target.checked);
  }

  const chkCollision = document.getElementById('chk-collision');
  if (chkCollision) chkCollision.addEventListener('change', (e) => debug.collision = e.target.checked);

  const chkWater = document.getElementById('chk-water-solid');
  if (chkWater) chkWater.addEventListener('change', (e) => debug.waterSolid = e.target.checked);

  const chkShadows = document.getElementById('chk-shadows');
  if (chkShadows) chkShadows.addEventListener('change', (e) => debug.shadows = e.target.checked);

  const rngFeather = document.getElementById('rng-shadow-feather');
  if (rngFeather) {
    rngFeather.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      debug.shadowFeather = val / 100;
      const lbl = document.getElementById('lbl-shadow-feather');
      if (lbl) lbl.textContent = `${val}%`;
    });
  }

  // Grass Mode Preset Buttons
  const btnMeander = document.getElementById('btn-grass-mode-meander');
  const btnSmudge = document.getElementById('btn-grass-mode-smudge');
  const btnRibbons = document.getElementById('btn-grass-mode-ribbons');
  const btnBiome = document.getElementById('btn-grass-mode-biome');

  if (btnMeander) btnMeander.addEventListener('click', () => setGrassMode('meander'));
  if (btnSmudge) btnSmudge.addEventListener('click', () => setGrassMode('smudge'));
  if (btnRibbons) btnRibbons.addEventListener('click', () => setGrassMode('ribbons'));
  if (btnBiome) btnBiome.addEventListener('click', () => setGrassMode('biome'));

  // Grass Sliders
  const rngMeanderAmp = document.getElementById('rng-meander-amp');
  if (rngMeanderAmp) {
    rngMeanderAmp.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      grassParams.meanderAmp = val;
      const lbl = document.getElementById('lbl-meander-amp');
      if (lbl) lbl.textContent = `${val}px`;
      updateGrassFlowCanvas();
    });
  }

  const rngMeanderFreq = document.getElementById('rng-meander-freq');
  if (rngMeanderFreq) {
    rngMeanderFreq.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      grassParams.waveFreq = val / 100;
      const lbl = document.getElementById('lbl-meander-freq');
      if (lbl) lbl.textContent = `${(val / 100).toFixed(1)}x`;
      updateGrassFlowCanvas();
    });
  }

  const rngSeamSmudge = document.getElementById('rng-seam-smudge');
  if (rngSeamSmudge) {
    rngSeamSmudge.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      grassParams.seamSmudge = val;
      const lbl = document.getElementById('lbl-seam-smudge');
      if (lbl) lbl.textContent = `${val}px`;
    });
  }

  // Preset Map Toggles
  const btnPureGrass = document.getElementById('btn-toggle-pure-grass');
  const btnDirtPath = document.getElementById('btn-toggle-dirt-path');

  if (btnPureGrass) {
    btnPureGrass.addEventListener('click', () => {
      resetTerrainMap(true);
      btnPureGrass.classList.add('active');
      if (btnDirtPath) btnDirtPath.classList.remove('active');
    });
  }

  if (btnDirtPath) {
    btnDirtPath.addEventListener('click', () => {
      resetTerrainMap(false);
      btnDirtPath.classList.add('active');
      if (btnPureGrass) btnPureGrass.classList.remove('active');
    });
  }

  // Zoom Controls
  const z05 = document.getElementById('zoom-05x');
  const z1 = document.getElementById('zoom-1x');
  const z15 = document.getElementById('zoom-15x');
  if (z05) z05.addEventListener('click', () => setZoom(0.5));
  if (z1) z1.addEventListener('click', () => setZoom(1.0));
  if (z15) z15.addEventListener('click', () => setZoom(1.5));

  // Reset Positions Button
  const btnResetPos = document.getElementById('btn-reset-pos');
  if (btnResetPos) {
    btnResetPos.addEventListener('click', () => {
      player.tileX = 24;
      player.tileY = 26;
      player.startTileX = 24;
      player.startTileY = 26;
      player.targetTileX = 24;
      player.targetTileY = 26;
      player.x = 24 * TILE_SIZE;
      player.y = 26 * TILE_SIZE;
      player.dir = DIR_DOWN;
      player.facingAngle = 0;
      player.isStepping = false;
      player.isMoving = false;
      player.isTurning = false;
      player.turnTimer = 0;
      player.turnPath = [];
      player.turnStepIndex = 0;
      player.animTime = 0;

      const rat = entities.find(e => e.id === 'river-rat-npc');
      if (rat) {
        rat.tileX = 26;
        rat.tileY = 28;
        rat.startTileX = 26;
        rat.startTileY = 28;
        rat.targetTileX = 26;
        rat.targetTileY = 28;
        rat.x = 26 * TILE_SIZE;
        rat.y = 28 * TILE_SIZE;
        rat.dir = DIR_DOWN;
        rat.facingAngle = 0;
        rat.turnPath = [];
        rat.turnTimer = 0;
        rat.turnStepIndex = 0;
        rat.wanderState = 'idle_center';
        rat.stateTimer = 1.0;
        rat.isStepping = false;
        rat.isMoving = false;
        rat.animTime = 0;
      }

      const blackRat = entities.find(e => e.id === 'black-rat-npc');
      if (blackRat) {
        blackRat.tileX = 20;
        blackRat.tileY = 28;
        blackRat.startTileX = 20;
        blackRat.startTileY = 28;
        blackRat.targetTileX = 20;
        blackRat.targetTileY = 28;
        blackRat.x = 20 * TILE_SIZE;
        blackRat.y = 28 * TILE_SIZE;
        blackRat.dir = DIR_RIGHT;
        blackRat.facingAngle = 90;
        blackRat.turnPath = [];
        blackRat.turnTimer = 0;
        blackRat.turnStepIndex = 0;
        blackRat.wanderState = 'idle_center';
        blackRat.stateTimer = 0.8;
        blackRat.isStepping = false;
        blackRat.isMoving = false;
        blackRat.animTime = 0;
      }

      const p1 = entities.find(e => e.id === 'piranha-npc-1');
      if (p1) {
        p1.tileX = 42;
        p1.tileY = 27;
        p1.startTileX = 42;
        p1.startTileY = 27;
        p1.targetTileX = 42;
        p1.targetTileY = 27;
        p1.x = 42 * TILE_SIZE;
        p1.y = 27 * TILE_SIZE;
        p1.dir = DIR_LEFT;
        p1.isStepping = false;
        p1.wanderState = 'swimming';
      }

      const p2 = entities.find(e => e.id === 'piranha-npc-2');
      if (p2) {
        p2.tileX = 43;
        p2.tileY = 35;
        p2.startTileX = 43;
        p2.startTileY = 35;
        p2.targetTileX = 43;
        p2.targetTileY = 35;
        p2.x = 43 * TILE_SIZE;
        p2.y = 35 * TILE_SIZE;
        p2.dir = DIR_UP;
        p2.isStepping = false;
        p2.wanderState = 'swimming';
      }

      centerCameraOn(player.x + 32, player.y + 32);
    });
  }

  // Custom Sprite Injector
  const fileUploader = document.getElementById('file-uploader');
  const inputUrl = document.getElementById('input-url');
  const btnApplyCustom = document.getElementById('btn-apply-custom');

  if (btnApplyCustom) {
    btnApplyCustom.addEventListener('click', () => {
      const fw = parseInt(document.getElementById('cfg-frame-w').value) || 128;
      const fh = parseInt(document.getElementById('cfg-frame-h').value) || 128;
      const fps = parseInt(document.getElementById('cfg-fps').value) || 8;

      function applyImage(img) {
        player.customImg = img;
        player.frameWidth = fw;
        player.frameHeight = fh;
        player.anchorX = fw / 2;
        player.anchorY = fh;
        player.fps = fps;
        if (cardRukiya) cardRukiya.classList.remove('active');
        if (cardRat) cardRat.classList.remove('active');
        if (editorState.selectedEntity === player) {
          selectEntity(player);
        }
      }

      if (fileUploader && fileUploader.files && fileUploader.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => applyImage(img);
          img.src = e.target.result;
        };
        reader.readAsDataURL(fileUploader.files[0]);
      } else if (inputUrl && inputUrl.value.trim()) {
        const img = new Image();
        img.onload = () => applyImage(img);
        img.src = inputUrl.value.trim();
      }
    });
  }
}

import {
  getSettings,
  saveSettings,
  clearAllSecrets,
  DEFAULT_OPENCODE_BASE_URL,
  DEFAULT_OPENCODE_MODEL
} from './settings.js';
import {
  testKey as testMeshyKey,
  createTextToImage,
  createTextTo3D,
  waitForTask as waitForMeshyTask,
  describeError as describeMeshyError
} from './meshy.js';
import {
  testConnection as testOpenCodeConnection,
  generateImage as generateOpenCodeImage,
  describeError as describeOpenCodeError
} from './opencode.js';
import { putAsset } from './asset-store.js';
import { registerImageAsset } from './sprite-registry.js';

const GRID = 16;
const DEFAULT_PLAYER = { x: 5, y: 5 };
const OPENCODE_LIMITATION = 'The official OpenCode API currently has no image models, locks free models to the OpenCode client, and does not send CORS headers.';

function el(id) {
  return document.getElementById(id);
}

const toggle = el('ai-studio-toggle');
const drawer = el('ai-studio');
if (toggle && drawer) initStudio();

function initStudio() {
  const closeButton = el('ai-studio-close');
  const tabs = [
    { name: 'image', tab: el('ai-tab-image'), panel: el('ai-panel-image') },
    { name: '3d', tab: el('ai-tab-3d'), panel: el('ai-panel-3d') },
    { name: 'settings', tab: el('ai-tab-settings'), panel: el('ai-panel-settings') }
  ];

  const imageProvider = el('ai-image-provider');
  const imageOpenCodeNote = el('ai-image-opencode-note');
  const imageOpenCodeDetail = el('ai-image-opencode-detail');
  const imageOpenSettings = el('ai-image-open-settings');
  const imagePrompt = el('ai-image-prompt');
  const imageMeshyModelField = el('ai-image-meshy-model-field');
  const imageMeshyModel = el('ai-image-meshy-model');
  const imageOpenCodeModelField = el('ai-image-opencode-model-field');
  const imageOpenCodeModel = el('ai-image-opencode-model');
  const imageOpenCodeModels = el('ai-image-opencode-models');
  const imageAspect = el('ai-image-aspect');
  const imageRemoveBgField = el('ai-image-remove-bg-field');
  const imageRemoveBg = el('ai-image-remove-bg');
  const imageGenerate = el('ai-image-generate');
  const imageCost = el('ai-image-cost');
  const imageProgress = el('ai-image-progress');
  const imageStatus = el('ai-image-status');
  const imageEmpty = el('ai-image-empty');
  const imageResult = el('ai-image-result');
  const imagePreview = el('ai-image-preview');
  const imageDimensions = el('ai-image-dimensions');
  const imageMetaProvider = el('ai-image-meta-provider');
  const imageAdd = el('ai-image-add');
  const imageDownload = el('ai-image-download');
  const imageRegenerate = el('ai-image-regenerate');
  const imageNote = el('ai-image-note');

  const threePrompt = el('ai-3d-prompt');
  const threeModel = el('ai-3d-model');
  const threeMode = el('ai-3d-mode');
  const threeRefineHint = el('ai-3d-refine-hint');
  const threeGenerate = el('ai-3d-generate');
  const threeProgress = el('ai-3d-progress');
  const threeStatus = el('ai-3d-status');
  const threeEmpty = el('ai-3d-empty');
  const threeResult = el('ai-3d-result');
  const threePreview = el('ai-3d-preview');
  const threeMetaStage = el('ai-3d-meta-stage');
  const threeMetaModel = el('ai-3d-meta-model');
  const threeDownload = el('ai-3d-download');
  const threeOpen = el('ai-3d-open');
  const threeRefine = el('ai-3d-refine');
  const threeNote = el('ai-3d-note');

  const meshyKey = el('ai-meshy-key');
  const meshyReveal = el('ai-meshy-reveal');
  const meshyRemember = el('ai-meshy-remember');
  const meshyTestButton = el('ai-meshy-test');
  const meshyClear = el('ai-meshy-clear');
  const meshyStatus = el('ai-meshy-status');

  const openCodeBaseUrl = el('ai-opencode-base-url');
  const openCodeKey = el('ai-opencode-key');
  const openCodeReveal = el('ai-opencode-reveal');
  const openCodeModel = el('ai-opencode-model');
  const openCodeRemember = el('ai-opencode-remember');
  const openCodeTestButton = el('ai-opencode-test');
  const openCodeClear = el('ai-opencode-clear');
  const openCodeStatus = el('ai-opencode-status');
  const forgetAll = el('ai-forget-all');

  const state = {
    open: false,
    activeTab: 'image',
    lastFocus: null,
    imageBusy: false,
    imageRun: 0,
    image: null,
    threeBusy: false,
    threeRun: 0,
    three: { result: null, lastPreviewTaskId: null },
    openCodeChecking: false,
    openCodeStatus: null
  };

  function setStatus(element, message = '', tone = '') {
    if (!element) return;
    element.textContent = message;
    if (tone) element.dataset.tone = tone;
    else delete element.dataset.tone;
  }

  function setProgress(element, value, visible) {
    if (!element) return;
    element.hidden = !visible;
    if (visible) element.value = Math.max(0, Math.min(100, Number(value) || 0));
  }

  function formatError(described) {
    const parts = [described?.message || 'The request failed.'];
    if (described?.code) parts.push(`(${described.code})`);
    if (described?.action) parts.push(described.action);
    return parts.join(' ');
  }

  function displayUrl(value) {
    try {
      const url = new URL(value);
      url.username = '';
      url.password = '';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return String(value || '');
    }
  }

  function stamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  function extensionFor(mime) {
    if (/jpe?g/i.test(mime || '')) return 'jpg';
    if (/webp/i.test(mime || '')) return 'webp';
    return 'png';
  }

  function triggerDownload(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
  }

  function measureImage(source) {
    return new Promise(resolve => {
      const image = new Image();
      let settled = false;
      const done = (width, height) => {
        if (settled) return;
        settled = true;
        resolve({ width: width || null, height: height || null });
      };
      image.addEventListener('load', () => done(image.naturalWidth, image.naturalHeight), { once: true });
      image.addEventListener('error', () => done(null, null), { once: true });
      image.src = source;
    });
  }

  function loadSettingsForm() {
    const settings = getSettings();
    meshyKey.value = settings.meshy.apiKey;
    meshyRemember.checked = settings.meshy.remember;
    openCodeBaseUrl.value = settings.opencode.baseUrl || DEFAULT_OPENCODE_BASE_URL;
    openCodeKey.value = settings.opencode.apiKey;
    openCodeModel.value = settings.opencode.model || DEFAULT_OPENCODE_MODEL;
    openCodeRemember.checked = settings.opencode.remember;
    imageProvider.value = settings.imageProvider === 'opencode' ? 'opencode' : 'meshy';
    imageOpenCodeModel.value = settings.opencode.model || DEFAULT_OPENCODE_MODEL;
    updateProviderFields();
  }

  function persistMeshy() {
    saveSettings({ meshy: { apiKey: meshyKey.value, remember: meshyRemember.checked } });
  }

  function persistOpenCode() {
    saveSettings({
      opencode: {
        baseUrl: openCodeBaseUrl.value,
        apiKey: openCodeKey.value,
        model: openCodeModel.value,
        remember: openCodeRemember.checked
      }
    });
  }

  function bindReveal(input, button, label) {
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.textContent = show ? 'Hide' : 'Show';
      button.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} ${label}`);
      input.focus();
    });
  }

  function activateTab(name, focus = false) {
    const selected = tabs.find(item => item.name === name) || tabs[0];
    for (const item of tabs) {
      const active = item === selected;
      item.tab.setAttribute('aria-selected', String(active));
      item.tab.tabIndex = active ? 0 : -1;
      item.panel.hidden = !active;
    }
    state.activeTab = selected.name;
    if (focus) selected.tab.focus();
  }

  function focusableWithin(root) {
    const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return [...root.querySelectorAll(selector)].filter(node => !node.closest('[hidden]') && node.getClientRects().length > 0);
  }

  function openDrawer(name) {
    if (!state.open) {
      state.open = true;
      state.lastFocus = document.activeElement;
      drawer.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }
    activateTab(name || state.activeTab, true);
    const settings = getSettings();
    if (imageProvider.value === 'opencode' && settings.opencode.apiKey && !state.openCodeStatus) {
      checkOpenCode({ manual: false });
    }
  }

  function closeDrawer({ restoreFocus = true } = {}) {
    if (!state.open) return;
    state.open = false;
    drawer.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  }

  function onDocumentKeydown(event) {
    if (!state.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = focusableWithin(drawer);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;
    if (!drawer.contains(current)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function updateProviderFields() {
    const provider = imageProvider.value === 'opencode' ? 'opencode' : 'meshy';
    const isMeshy = provider === 'meshy';
    imageMeshyModelField.hidden = !isMeshy;
    imageOpenCodeModelField.hidden = isMeshy;
    imageRemoveBgField.hidden = !isMeshy;
    imageCost.textContent = isMeshy
      ? 'Meshy image generations spend credits from your Meshy account.'
      : 'OpenCode-compatible endpoints may bill tokens or request costs to your account.';
    imageOpenCodeNote.hidden = isMeshy;
    updateOpenCodeNote();
    updateImageGenerateState();
  }

  function openCodeImageBlocked() {
    const status = state.openCodeStatus;
    if (!status) return false;
    if (status.corsBlocked) return true;
    if (status.ok && !(status.imageModels?.length)) return true;
    if (!status.ok && !status.corsBlocked && status.reason === 'OPENCODE_CATALOG_UNAVAILABLE') return true;
    return false;
  }

  function updateImageGenerateState() {
    const blocked = imageProvider.value === 'opencode' && openCodeImageBlocked();
    imageGenerate.disabled = state.imageBusy || blocked;
    imageGenerate.textContent = state.imageBusy ? 'Generating…' : 'Generate image';
    imageRegenerate.disabled = state.imageBusy || !state.image;
    imageAdd.disabled = !state.image?.blob || state.image?.added === true;
  }

  function updateOpenCodeNote() {
    if (imageProvider.value !== 'opencode') return;
    const settings = getSettings();
    const base = displayUrl(settings.opencode.baseUrl || DEFAULT_OPENCODE_BASE_URL);
    const status = state.openCodeStatus;
    if (!settings.opencode.apiKey) {
      imageOpenCodeDetail.textContent = `${OPENCODE_LIMITATION} Add an OpenCode key in Settings and point the base URL at a CORS-enabled OpenAI-compatible image endpoint.`;
      imageOpenCodeModels.textContent = '';
      return;
    }
    if (!status) {
      imageOpenCodeDetail.textContent = `Using ${base}. Run Test connection in the Settings tab to check for image models. ${OPENCODE_LIMITATION}`;
      imageOpenCodeModels.textContent = '';
      return;
    }
    if (status.ok && status.imageModels?.length) {
      const models = status.imageModels.slice(0, 8).join(', ');
      imageOpenCodeDetail.textContent = `Using ${base}. The endpoint is reachable and exposes ${status.imageModels.length} image model${status.imageModels.length === 1 ? '' : 's'}.`;
      imageOpenCodeModels.textContent = `Detected models: ${models}`;
      if (!imageOpenCodeModel.value.trim()) imageOpenCodeModel.value = status.imageModels[0];
      return;
    }
    imageOpenCodeModels.textContent = '';
    if (status.ok) {
      imageOpenCodeDetail.textContent = `Using ${base}. The endpoint is reachable but returned no image models (${status.reason || 'OPENCODE_NO_IMAGE_MODEL'}). Use a CORS-enabled OpenAI-compatible image endpoint.`;
      return;
    }
    if (status.corsBlocked) {
      imageOpenCodeDetail.textContent = `Using ${base}. The browser could not call this endpoint (${status.reason || 'OPENCODE_CORS_BLOCKED'}). Use a CORS-enabled OpenAI-compatible base URL.`;
      return;
    }
    imageOpenCodeDetail.textContent = `Using ${base}. ${status.message || 'The endpoint is not usable for images.'} (${status.reason || 'OPENCODE_ERROR'})`;
  }

  function applyOpenCodeStatus(result) {
    state.openCodeStatus = result;
    if (result?.ok && result.imageModels?.length && !imageOpenCodeModel.value.trim()) {
      imageOpenCodeModel.value = result.imageModels[0];
    }
    updateOpenCodeNote();
    updateImageGenerateState();
  }

  function describeOpenCodeResult(result) {
    if (result.ok && result.imageModels?.length) {
      return `Endpoint reachable. Image models: ${result.imageModels.slice(0, 8).join(', ')}.`;
    }
    if (result.ok) {
      return `Endpoint reachable, but no image model was found (${result.reason || 'OPENCODE_NO_IMAGE_MODEL'}). ${result.message || ''} Point the base URL at a CORS-enabled OpenAI-compatible image endpoint.`;
    }
    if (result.corsBlocked) {
      return `Browser blocked (${result.reason || 'OPENCODE_CORS_BLOCKED'}): ${result.message || 'The browser could not call this endpoint.'} Use a CORS-enabled base URL.`;
    }
    if (result.reason === 'OPENCODE_CATALOG_UNAVAILABLE') {
      return `The endpoint is reachable but has no /models catalog (${result.reason}). ${result.message || ''}`;
    }
    return `${result.message || 'The OpenCode test failed.'} (${result.reason || 'OPENCODE_ERROR'})`;
  }

  async function testMeshy() {
    persistMeshy();
    if (!meshyKey.value.trim()) {
      setStatus(meshyStatus, 'Enter a Meshy API key first.', 'error');
      meshyKey.focus();
      return;
    }
    meshyTestButton.disabled = true;
    setStatus(meshyStatus, 'Checking the Meshy key…');
    try {
      const result = await testMeshyKey();
      if (result.ok) {
        const parts = [];
        if (result.balance !== null && result.balance !== undefined) parts.push(`${result.balance} credits available`);
        if (result.plan) parts.push(`plan ${result.plan}`);
        setStatus(meshyStatus, parts.length ? `Meshy key works. ${parts.join(' · ')}.` : 'Meshy key works.', 'success');
      } else {
        setStatus(meshyStatus, formatError(result.error || { message: 'The Meshy key test failed.' }), 'error');
      }
    } catch (error) {
      setStatus(meshyStatus, formatError(describeMeshyError(error)), 'error');
    } finally {
      meshyTestButton.disabled = false;
    }
  }

  async function checkOpenCode({ manual = false } = {}) {
    if (state.openCodeChecking) return;
    persistOpenCode();
    const settings = getSettings();
    if (!settings.opencode.apiKey) {
      state.openCodeStatus = null;
      setStatus(openCodeStatus, manual ? 'Add an OpenCode API key to test the endpoint.' : '', manual ? 'error' : '');
      updateOpenCodeNote();
      updateImageGenerateState();
      return;
    }
    state.openCodeChecking = true;
    openCodeTestButton.disabled = true;
    if (manual) setStatus(openCodeStatus, 'Checking the OpenCode-compatible endpoint…');
    try {
      const result = await testOpenCodeConnection();
      applyOpenCodeStatus(result);
      const good = result.ok && result.imageModels?.length > 0;
      setStatus(openCodeStatus, describeOpenCodeResult(result), good ? 'success' : (result.ok ? 'warning' : 'error'));
    } catch (error) {
      const described = describeOpenCodeError(error);
      applyOpenCodeStatus({
        ok: false,
        corsBlocked: described.code === 'OPENCODE_CORS_BLOCKED',
        reason: described.code,
        message: described.message,
        imageModels: []
      });
      setStatus(openCodeStatus, formatError(described), 'error');
    } finally {
      state.openCodeChecking = false;
      openCodeTestButton.disabled = false;
      updateOpenCodeNote();
      updateImageGenerateState();
    }
  }

  function sizeForAspect(aspect) {
    switch (aspect) {
      case '16:9':
      case '4:3':
        return '1536x1024';
      case '9:16':
      case '3:4':
        return '1024x1536';
      default:
        return '1024x1024';
    }
  }

  function revokeImageUrl(result) {
    if (result?.objectUrl && result.url?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(result.url);
      } catch {
      }
    }
  }

  function setImageResult(result) {
    revokeImageUrl(state.image);
    state.image = result;
    imagePreview.hidden = false;
    imagePreview.src = result.url;
    imagePreview.alt = `Generated image preview: ${result.prompt.slice(0, 80)}`;
    imageDimensions.textContent = result.width && result.height ? `${result.width} × ${result.height} px` : 'Unknown';
    const label = result.provider === 'opencode' ? 'OpenCode-compatible' : 'Meshy';
    imageMetaProvider.textContent = result.model ? `${label} · ${result.model}` : label;
    imageAdd.disabled = !result.blob;
    imageAdd.textContent = 'Add to scene';
    imageAdd.title = result.blob ? '' : 'This image host blocked the browser download needed to store the blob.';
    imageDownload.disabled = false;
    imageRegenerate.disabled = false;
    imageNote.textContent = result.note || (result.blob ? 'Stored in this browser only when you add it to the scene.' : '');
    imageEmpty.hidden = true;
    imageResult.hidden = false;
    updateImageGenerateState();
    setStatus(imageStatus, result.blob ? 'Image ready.' : 'Image ready, but the host did not allow a browser download.', result.blob ? 'success' : 'warning');
  }

  async function finishMeshyImage(task, prompt, model) {
    const url = task.imageUrls?.[0];
    if (!url) throw new Error('Meshy finished without an image URL.');
    let blob = null;
    let mime = 'image/png';
    let note = '';
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`Image download failed with HTTP ${response.status}.`);
      blob = await response.blob();
      mime = blob.type || 'image/png';
    } catch {
      note = 'The image host did not allow a browser download, so the preview uses its temporary URL. Add to scene is disabled; download the image or generate again.';
    }
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      const size = await measureImage(objectUrl);
      setImageResult({
        blob,
        mime,
        width: size.width,
        height: size.height,
        url: objectUrl,
        objectUrl: true,
        provider: 'meshy',
        model,
        prompt,
        note
      });
    } else {
      const size = await measureImage(url);
      setImageResult({
        blob: null,
        mime: null,
        width: size.width,
        height: size.height,
        url,
        provider: 'meshy',
        model,
        prompt,
        note
      });
    }
  }

  async function generateImageFlow() {
    if (state.imageBusy) return;
    const prompt = imagePrompt.value.trim();
    if (!prompt) {
      setStatus(imageStatus, 'Enter a prompt before generating an image.', 'error');
      imagePrompt.focus();
      return;
    }
    const settings = getSettings();
    const provider = imageProvider.value === 'opencode' ? 'opencode' : 'meshy';
    if (provider === 'meshy' && !settings.meshy.apiKey) {
      setStatus(imageStatus, 'Add a Meshy API key in the Settings tab before generating images.', 'error');
      return;
    }
    if (provider === 'opencode' && !settings.opencode.apiKey) {
      setStatus(imageStatus, 'Add an OpenCode API key in the Settings tab, or choose Meshy.', 'error');
      return;
    }

    state.imageBusy = true;
    state.imageRun += 1;
    const run = state.imageRun;
    updateImageGenerateState();
    setProgress(imageProgress, 0, true);
    setStatus(imageStatus, provider === 'meshy' ? 'Starting a Meshy image task…' : 'Requesting an image from the OpenCode-compatible endpoint…');

    try {
      if (provider === 'meshy') {
        const model = imageMeshyModel.value;
        const created = await createTextToImage({
          prompt,
          aiModel: model,
          aspectRatio: imageAspect.value,
          removeBackground: imageRemoveBg.checked
        });
        if (run !== state.imageRun) return;
        setStatus(imageStatus, 'Meshy image task queued. Polling for progress…');
        const task = await waitForMeshyTask('text-to-image', created.taskId, update => {
          if (run !== state.imageRun) return;
          const progress = Math.max(0, Math.min(100, Number(update.progress) || 0));
          setProgress(imageProgress, progress, true);
          setStatus(imageStatus, `Meshy ${String(update.status || 'working').toLowerCase()}… ${progress}%`);
        });
        if (run !== state.imageRun) return;
        setProgress(imageProgress, 100, true);
        await finishMeshyImage(task, prompt, model);
      } else {
        const model = imageOpenCodeModel.value.trim() || settings.opencode.model || DEFAULT_OPENCODE_MODEL;
        const result = await generateOpenCodeImage({
          prompt,
          model,
          size: sizeForAspect(imageAspect.value),
          n: 1
        });
        if (run !== state.imageRun) return;
        setProgress(imageProgress, 100, true);
        const objectUrl = URL.createObjectURL(result.blob);
        const size = await measureImage(objectUrl);
        setImageResult({
          blob: result.blob,
          mime: result.mime || result.blob.type || 'image/png',
          width: size.width,
          height: size.height,
          url: objectUrl,
          objectUrl: true,
          provider: 'opencode',
          model: result.model || model,
          prompt,
          note: result.revisedPrompt ? `Revised prompt: ${result.revisedPrompt}` : ''
        });
      }
    } catch (error) {
      if (run !== state.imageRun) return;
      const described = provider === 'meshy' ? describeMeshyError(error) : describeOpenCodeError(error);
      setStatus(imageStatus, formatError(described), 'error');
      if (provider === 'opencode' && described.code) {
        state.openCodeStatus = {
          ok: false,
          corsBlocked: described.code === 'OPENCODE_CORS_BLOCKED',
          reason: described.code,
          message: described.message,
          imageModels: []
        };
        updateOpenCodeNote();
      }
    } finally {
      if (run === state.imageRun) {
        state.imageBusy = false;
        setProgress(imageProgress, imageProgress.value, false);
        updateImageGenerateState();
      }
    }
  }

  function playerPositionGuess() {
    const x = Number.parseInt(el('location-x')?.value, 10);
    const y = Number.parseInt(el('location-y')?.value, 10);
    if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < GRID && y < GRID) {
      return { x, y };
    }
    return { ...DEFAULT_PLAYER };
  }

  function nearbyTile() {
    const start = playerPositionGuess();
    const seen = new Set();
    for (let radius = 1; radius <= GRID; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = start.x + dx;
          const y = start.y + dy;
          if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
          const key = `${x},${y}`;
          if (seen.has(key)) continue;
          seen.add(key);
          return { x, y };
        }
      }
    }
    return { ...DEFAULT_PLAYER };
  }

  async function waitForPlayground() {
    const api = window.ObliqueAI;
    if (!api) throw new Error('The playground is still loading. Try again in a moment.');
    if (api.ready && typeof api.ready.then === 'function') await api.ready;
    if (typeof api.placeSpriteAt !== 'function') throw new Error('The playground sprite API is unavailable.');
    return api;
  }

  function spriteName(prompt) {
    const text = prompt.replace(/\s+/g, ' ').trim();
    if (!text) return 'AI image';
    return text.length > 40 ? `${text.slice(0, 37)}…` : text;
  }

  async function addImageToScene() {
    const result = state.image;
    if (!result?.blob) return;
    imageAdd.disabled = true;
    imageAdd.textContent = 'Saving…';
    setStatus(imageStatus, 'Saving the image in this browser and registering a sprite…');
    try {
      const api = await waitForPlayground();
      const name = spriteName(result.prompt);
      const asset = await putAsset({
        kind: 'image',
        blob: result.blob,
        mime: result.mime,
        width: result.width,
        height: result.height,
        provider: result.provider,
        prompt: result.prompt,
        name
      });
      const type = await registerImageAsset(asset, { name });
      const spot = nearbyTile();
      const placed = api.placeSpriteAt(type.id, spot.x, spot.y);
      if (!placed) throw new Error('The playground could not place the sprite in the scene.');
      result.added = true;
      imageAdd.disabled = true;
      imageAdd.textContent = 'Added to scene';
      imageNote.textContent = `“${type.name}” is in the sprite picker and placed at column ${spot.x}, row ${spot.y}. Save the scene to keep this arrangement.`;
      setStatus(imageStatus, `Added “${type.name}” to the scene. Save the scene to keep it in saved layouts.`, 'success');
    } catch (error) {
      imageAdd.disabled = false;
      imageAdd.textContent = 'Add to scene';
      setStatus(imageStatus, error?.message || 'The image could not be added to the scene.', 'error');
    }
  }

  function downloadImage() {
    const result = state.image;
    if (!result) return;
    if (result.blob) {
      const url = URL.createObjectURL(result.blob);
      triggerDownload(url, `ai-image-${stamp()}.${extensionFor(result.mime)}`);
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setStatus(imageStatus, 'Image download started.', 'success');
    } else {
      window.open(result.url, '_blank', 'noopener');
      setStatus(imageStatus, 'The image host blocked a browser download, so the image was opened in a new tab.', 'warning');
    }
  }

  function updateThreeGenerateState() {
    const refine = threeMode.value === 'refine';
    const missingPreview = refine && !state.three.lastPreviewTaskId;
    threeGenerate.disabled = state.threeBusy || missingPreview;
    threeGenerate.textContent = state.threeBusy ? 'Generating…' : (refine ? 'Refine 3D model' : 'Generate 3D model');
    threeRefineHint.hidden = !refine;
    if (refine) {
      threeRefineHint.textContent = missingPreview
        ? 'Refine needs a successful preview first. Generate a preview, then switch to Refine.'
        : 'Refine will reuse the last successful preview task.';
    }
    threeDownload.disabled = !state.three.result?.glb;
    threeOpen.disabled = !state.three.result?.glb;
    if (threeRefine) threeRefine.hidden = state.three.result?.mode !== 'preview';
  }

  function setThreeResult(task, meta) {
    const glb = task.modelUrls?.glb || null;
    const thumbnail = task.thumbnailUrl || null;
    state.three.result = {
      glb,
      glbBlob: null,
      thumbnail,
      prompt: meta.prompt,
      model: meta.model,
      mode: meta.mode,
      taskId: meta.taskId
    };
    if (thumbnail) {
      threePreview.src = thumbnail;
      threePreview.hidden = false;
    } else {
      threePreview.hidden = true;
      threePreview.removeAttribute('src');
    }
    threeMetaStage.textContent = meta.mode === 'refine' ? 'Refined model' : 'Preview';
    threeMetaModel.textContent = meta.model || '—';
    threeNote.textContent = glb
      ? (meta.mode === 'preview' ? 'Preview complete. Refine it for more detail or download the GLB.' : 'Refined model ready to download as GLB.')
      : 'The task finished without a GLB URL. Generate again.';
    threeEmpty.hidden = true;
    threeResult.hidden = false;
    updateThreeGenerateState();
    setStatus(threeStatus, glb ? '3D model ready.' : '3D task finished without a GLB file.', glb ? 'success' : 'warning');
  }

  async function generateThreeFlow() {
    if (state.threeBusy) return;
    const mode = threeMode.value === 'refine' ? 'refine' : 'preview';
    const prompt = threePrompt.value.trim();
    if (mode === 'preview' && !prompt) {
      setStatus(threeStatus, 'Enter a prompt before generating a 3D model.', 'error');
      threePrompt.focus();
      return;
    }
    if (mode === 'refine' && !state.three.lastPreviewTaskId) {
      setStatus(threeStatus, 'Generate a preview first, then refine it.', 'error');
      return;
    }
    const settings = getSettings();
    if (!settings.meshy.apiKey) {
      setStatus(threeStatus, 'Add a Meshy API key in the Settings tab before generating 3D models.', 'error');
      return;
    }

    state.threeBusy = true;
    state.threeRun += 1;
    const run = state.threeRun;
    updateThreeGenerateState();
    setProgress(threeProgress, 0, true);
    setStatus(threeStatus, mode === 'refine' ? 'Starting a Meshy 3D refine task…' : 'Starting a Meshy 3D preview task…');

    try {
      const model = threeModel.value;
      const created = await createTextTo3D({
        prompt,
        aiModel: model,
        mode,
        previewTaskId: mode === 'refine' ? state.three.lastPreviewTaskId : undefined
      });
      if (run !== state.threeRun) return;
      setStatus(threeStatus, '3D task queued. Polling for progress…');
      const task = await waitForMeshyTask('text-to-3d', created.taskId, update => {
        if (run !== state.threeRun) return;
        const progress = Math.max(0, Math.min(100, Number(update.progress) || 0));
        setProgress(threeProgress, progress, true);
        setStatus(threeStatus, `Meshy 3D ${String(update.status || 'working').toLowerCase()}… ${progress}%`);
      });
      if (run !== state.threeRun) return;
      setProgress(threeProgress, 100, true);
      if (mode === 'preview') state.three.lastPreviewTaskId = created.taskId;
      setThreeResult(task, { prompt, model, mode, taskId: created.taskId });
    } catch (error) {
      if (run !== state.threeRun) return;
      setStatus(threeStatus, formatError(describeMeshyError(error)), 'error');
    } finally {
      if (run === state.threeRun) {
        state.threeBusy = false;
        setProgress(threeProgress, threeProgress.value, false);
        updateThreeGenerateState();
      }
    }
  }

  async function downloadGlb() {
    const result = state.three.result;
    if (!result?.glb) return;
    threeDownload.disabled = true;
    setStatus(threeStatus, 'Downloading the GLB…');
    try {
      let blob = result.glbBlob;
      if (!blob) {
        const response = await fetch(result.glb, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`GLB download failed with HTTP ${response.status}.`);
        blob = await response.blob();
        result.glbBlob = blob;
      }
      if (!blob.size) throw new Error('The GLB download was empty.');
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `ai-model-${stamp()}.glb`);
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setStatus(threeStatus, 'GLB download started.', 'success');
    } catch {
      window.open(result.glb, '_blank', 'noopener');
      setStatus(threeStatus, 'The file host blocked a browser download, so the GLB link was opened in a new tab. Save it from there.', 'warning');
    } finally {
      threeDownload.disabled = !state.three.result?.glb;
    }
  }

  function openGlb() {
    const result = state.three.result;
    if (result?.glb) window.open(result.glb, '_blank', 'noopener');
  }

  toggle.addEventListener('click', () => {
    if (state.open) closeDrawer();
    else openDrawer('image');
  });
  closeButton.addEventListener('click', () => closeDrawer());
  document.addEventListener('keydown', onDocumentKeydown, true);

  for (const item of tabs) {
    item.tab.addEventListener('click', () => activateTab(item.name));
    item.tab.addEventListener('keydown', event => {
      const index = tabs.indexOf(item);
      let next = null;
      if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      else if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === 'Home') next = tabs[0];
      else if (event.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      activateTab(next.name, true);
    });
  }

  bindReveal(meshyKey, meshyReveal, 'Meshy API key');
  bindReveal(openCodeKey, openCodeReveal, 'OpenCode API key');

  meshyKey.addEventListener('input', persistMeshy);
  meshyRemember.addEventListener('change', persistMeshy);
  meshyTestButton.addEventListener('click', () => { testMeshy(); });
  meshyClear.addEventListener('click', () => {
    meshyKey.value = '';
    persistMeshy();
    setStatus(meshyStatus, 'Meshy key cleared from this browser.', 'success');
    meshyKey.focus();
  });

  openCodeBaseUrl.addEventListener('input', () => {
    persistOpenCode();
    state.openCodeStatus = null;
    updateOpenCodeNote();
    updateImageGenerateState();
  });
  openCodeBaseUrl.addEventListener('change', () => {
    if (getSettings().opencode.apiKey) checkOpenCode({ manual: false });
  });
  openCodeKey.addEventListener('input', () => {
    persistOpenCode();
    state.openCodeStatus = null;
    updateOpenCodeNote();
    updateImageGenerateState();
  });
  openCodeKey.addEventListener('change', () => {
    if (openCodeKey.value.trim()) checkOpenCode({ manual: false });
  });
  openCodeModel.addEventListener('input', () => {
    persistOpenCode();
    imageOpenCodeModel.value = openCodeModel.value;
  });
  openCodeRemember.addEventListener('change', persistOpenCode);
  openCodeTestButton.addEventListener('click', () => { checkOpenCode({ manual: true }); });
  openCodeClear.addEventListener('click', () => {
    openCodeKey.value = '';
    saveSettings({ opencode: { apiKey: '' } });
    state.openCodeStatus = null;
    setStatus(openCodeStatus, 'OpenCode key cleared from this browser.', 'success');
    updateOpenCodeNote();
    updateImageGenerateState();
    openCodeKey.focus();
  });

  forgetAll.addEventListener('click', () => {
    const confirmed = window.confirm('Forget every AI key stored in this browser? This cannot be undone.');
    if (!confirmed) return;
    clearAllSecrets();
    loadSettingsForm();
    state.openCodeStatus = null;
    setStatus(meshyStatus, 'All AI keys were removed from this browser.', 'success');
    setStatus(openCodeStatus, 'All AI keys were removed from this browser.', 'success');
    updateOpenCodeNote();
    updateImageGenerateState();
  });

  imageProvider.addEventListener('change', () => {
    saveSettings({ imageProvider: imageProvider.value });
    updateProviderFields();
    if (imageProvider.value === 'opencode' && getSettings().opencode.apiKey) {
      checkOpenCode({ manual: false });
    }
  });

  imageGenerate.addEventListener('click', () => { generateImageFlow(); });
  imageRegenerate.addEventListener('click', () => { generateImageFlow(); });
  imageAdd.addEventListener('click', () => { addImageToScene(); });
  imageDownload.addEventListener('click', downloadImage);
  imageOpenSettings.addEventListener('click', () => {
    activateTab('settings', true);
    openCodeBaseUrl.focus();
    openCodeBaseUrl.select?.();
  });
  imageOpenCodeModel.addEventListener('input', () => {
    openCodeModel.value = imageOpenCodeModel.value;
    saveSettings({ opencode: { model: imageOpenCodeModel.value } });
  });

  threeMode.addEventListener('change', updateThreeGenerateState);
  threeGenerate.addEventListener('click', () => { generateThreeFlow(); });
  threeDownload.addEventListener('click', downloadGlb);
  threeOpen.addEventListener('click', openGlb);
  threeRefine.addEventListener('click', () => {
    if (!state.three.lastPreviewTaskId) return;
    threeMode.value = 'refine';
    updateThreeGenerateState();
    setStatus(threeStatus, 'Refine will reuse the last successful preview. Adjust the model if needed, then refine.', '');
    threeMode.focus();
  });

  const observer = new MutationObserver(() => {
    if (document.body.classList.contains('readonly')) closeDrawer({ restoreFocus: false });
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  loadSettingsForm();
  activateTab('image');
  updateThreeGenerateState();
}

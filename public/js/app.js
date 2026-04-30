/* ═══════════════════════════════════════════════════════════════════
   app.js — Sticker Placement Planner
   Features: Undo/Redo, Layers, Save, Flip, Tint, Swap Device,
             Multi-select, Snap-to-grid, Share link, Packs, Export
   Backend: Node.js + Express (in-memory)
   ═══════════════════════════════════════════════════════════════════ */

/* ── API CONFIG ────────────────────────────────────────────────────── */
const API = '/api';

/* ── ELEMENTS ──────────────────────────────────────────────────────── */
const tray = document.getElementById('tray');
const stage = document.getElementById('stage');
const stickerLayer = document.getElementById('stickerLayer');
const laptop = document.getElementById('laptop');
const dropOverlay = document.getElementById('dropOverlay');
const autoInput = document.getElementById('autoInput');
const precutInput = document.getElementById('precutInput');
const autoZone = document.getElementById('autoZone');
const precutZone = document.getElementById('precutZone');
const exportBtn = document.getElementById('exportBtn');
const deselectBtn = document.getElementById('deselectBtn');
const clearBtn = document.getElementById('clearBtn');
const toastStack = document.getElementById('toastStack');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const layerUpBtn = document.getElementById('layerUpBtn');
const layerDownBtn = document.getElementById('layerDownBtn');
const flipHBtn = document.getElementById('flipHBtn');
const flipVBtn = document.getElementById('flipVBtn');
const snapToggle = document.getElementById('snapToggle');
const shareLinkBtn = document.getElementById('shareLinkBtn');
const deviceInput = document.getElementById('deviceInput');
const selectionBox = document.getElementById('selectionBox');
const tintPanel = document.getElementById('tintPanel');
const hueSlider = document.getElementById('hueSlider');
const satSlider = document.getElementById('satSlider');
const brSlider = document.getElementById('brSlider');
const hueVal = document.getElementById('hueVal');
const satVal = document.getElementById('satVal');
const brVal = document.getElementById('brVal');
const packGrid = document.getElementById('packGrid');
const backendDot = document.getElementById('backendDot');
const backendStatusText = document.getElementById('backendStatusText');
const canvasHint = document.getElementById('canvasHint');

/* ── STATE ─────────────────────────────────────────────────────────── */
let removeBgKey = '';
let trayItems = [];
let stickers = [];
let selectedId = null;
let multiSelected = new Set();
let dragGhost = null;
let dropDepth = 0;
let stickerCounter = 1;
let trayCounter = 1;
let snapToGrid = false;
let undoStack = [];
let redoStack = [];
let backendOnline = false;
const GRID = 24;

function setBackendStatus(online) {
  if (!backendDot || !backendStatusText) return;
  backendDot.classList.remove('online', 'offline');
  backendDot.classList.add(online ? 'online' : 'offline');
  backendStatusText.textContent = online
    ? 'Backend connected. In-memory API active.'
    : 'Backend offline. Running local fallback mode.';
}
function updateCanvasHint() {
  if (!canvasHint) return;
  if (!stickers.length) {
    canvasHint.classList.add('empty');
    canvasHint.textContent = 'Canvas is empty. Drag from tray or drop files to start.';
    return;
  }
  canvasHint.classList.remove('empty');
  canvasHint.textContent = 'Drop stickers here - Shift+click to multi-select';
}

/* ════════════════════════════════════════════════════════════════════
   BACKEND API LAYER
   ════════════════════════════════════════════════════════════════════ */
async function apiGet(path) {
  const res = await fetch(API + path);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `GET ${path} -> ${res.status}`);
  return payload;
}
async function apiPost(path, body) {
  const res = await fetch(API + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `POST ${path} -> ${res.status}`);
  return payload;
}
async function apiPut(path, body) {
  const res = await fetch(API + path, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `PUT ${path} -> ${res.status}`);
  return payload;
}
async function apiDelete(path) {
  const res = await fetch(API + path, { method: 'DELETE' });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `DELETE ${path} -> ${res.status}`);
  return payload;
}

async function checkBackend() {
  try {
    await apiGet('/health');
    backendOnline = true;
    setBackendStatus(true);
    toast('Backend connected', 'ok');
  } catch (_) {
    backendOnline = false;
    setBackendStatus(false);
    toast('Backend connection failed. Start the server with npm run dev.', 'err');
  }
}

async function loadFromBackend() {
  if (!backendOnline) { loadLayout(); renderStickers(); return; }
  try {
    const data = await apiGet('/stickers');
    stickers = data.stickers.map(s => ({
      id: s.id, dbId: s.id,
      name: s.name, category: s.category, src: s.src,
      x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot,
      flipH: s.flipH, flipV: s.flipV,
      hue: s.hue, sat: s.sat, br: s.br
    })).filter(s => s.src);
    stickerCounter = stickers.length + 1;
    renderStickers();
  } catch (err) {
    toast('Backend sync failed. Using local fallback data.', 'err');
    loadLayout();
  }
}

async function apiSaveSticker(s) {
  if (!backendOnline) return null;
  try {
    const res = await apiPost('/stickers', {
      name: s.name, category: s.category || 'custom',
      src: s.src, x: s.x, y: s.y, w: s.w, h: s.h,
      rot: s.rot, flipH: s.flipH, flipV: s.flipV,
      hue: s.hue, sat: s.sat, br: s.br
    });
    return res.id;
  } catch (err) { console.error('Save sticker failed:', err); return null; }
}

async function apiUpdateSticker(s) {
  if (!backendOnline || !s.dbId) return;
  try {
    await apiPut(`/stickers/${s.dbId}`, {
      x: s.x, y: s.y, w: s.w, h: s.h,
      rot: s.rot, flipH: s.flipH, flipV: s.flipV,
      hue: s.hue, sat: s.sat, br: s.br
    });
  } catch (err) { console.error('Update sticker failed:', err); }
}

async function apiDeleteSticker(s) {
  if (!backendOnline || !s.dbId) return;
  try { await apiDelete(`/stickers/${s.dbId}`); }
  catch (err) { console.error('Delete sticker failed:', err); }
}

async function apiClearStickers() {
  if (!backendOnline) return;
  try { await apiDelete('/stickers'); } catch (_) { }
}

/* ════════════════════════════════════════════════════════════════════
   UNDO / REDO
   ════════════════════════════════════════════════════════════════════ */
function saveState() {
  undoStack.push(JSON.stringify(stickers));
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(stickers));
  stickers = JSON.parse(undoStack.pop());
  selectedId = null; multiSelected.clear();
  renderStickers(); saveLayout();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(stickers));
  stickers = JSON.parse(redoStack.pop());
  selectedId = null; multiSelected.clear();
  renderStickers(); saveLayout();
}

/* ════════════════════════════════════════════════════════════════════
   LOCALSTORAGE (fallback / mirror)
   ════════════════════════════════════════════════════════════════════ */
function saveLayout() {
  localStorage.setItem('sticker_layout', JSON.stringify(stickers));
}
function loadLayout() {
  try {
    const raw = localStorage.getItem('sticker_layout');
    if (!raw) return;
    const data = JSON.parse(raw);
    stickers = data.map(s => ({
      ...s,
      flipH: s.flipH || false, flipV: s.flipV || false,
      hue: s.hue || 0, sat: s.sat || 100, br: s.br || 100
    }));
    stickerCounter = stickers.length + 1;
    renderStickers();
  } catch (_) { }
}

/* ════════════════════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════════════════════ */
function toast(message, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.textContent = message;
  toastStack.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
    el.style.opacity = '0'; el.style.transform = 'translateY(10px)';
    setTimeout(() => el.remove(), 220);
  }, 2200);
}

/* ════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════ */
function isPrecut(f) { return ['image/png', 'image/webp'].includes(f.type); }
function isImage(f) { return f.type.startsWith('image/'); }
function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function snap(n) { return snapToGrid ? Math.round(n / GRID) * GRID : n; }

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = rej; img.src = src;
  });
}
async function fileToImageData(file) {
  const src = await fileToDataURL(file);
  const img = await loadImage(src);
  return { src, width: img.naturalWidth, height: img.naturalHeight };
}
function fitSize(w, h, max = 120) {
  const r = w / h;
  if (w >= h) { w = Math.min(max, w); h = w / r; }
  else { h = Math.min(max, h); w = h * r; }
  return { w: Math.max(28, w), h: Math.max(28, h) };
}
function stickerFilter(s) {
  return `hue-rotate(${s.hue || 0}deg) saturate(${s.sat || 100}%) brightness(${s.br || 100}%)`;
}
function stickerTransform(s) {
  return `rotate(${s.rot || 0}rad) scale(${s.flipH ? -1 : 1},${s.flipV ? -1 : 1})`;
}

/* ════════════════════════════════════════════════════════════════════
   REMOVE.BG API
   ════════════════════════════════════════════════════════════════════ */
async function removeBg(file) {
  if (!removeBgKey) throw new Error('No API key saved.');
  const fd = new FormData();
  fd.append('image_file', file, file.name || 'image');
  fd.append('size', 'auto');
  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST', headers: { 'X-Api-Key': removeBgKey }, body: fd
  });
  if (!res.ok) {
    let msg = `remove.bg error (${res.status})`;
    try {
      const d = await res.json();
      const t = d?.errors?.[0]?.title || d?.errors?.[0]?.detail;
      if (t) msg = t;
    } catch (_) { }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const src = URL.createObjectURL(blob);
  const img = await loadImage(src);
  return { src, width: img.naturalWidth, height: img.naturalHeight };
}

/* ════════════════════════════════════════════════════════════════════
   TRAY
   ════════════════════════════════════════════════════════════════════ */
function addTrayItem(src, meta = {}) {
  const item = {
    id: `tray-${trayCounter++}`, src,
    name: meta.name || 'sticker', width: meta.width || 256, height: meta.height || 256
  };
  trayItems.push(item); renderTray(); return item;
}
function removeTrayItem(id) { trayItems = trayItems.filter(t => t.id !== id); renderTray(); }

function renderTray() {
  tray.innerHTML = '';
  if (!trayItems.length) {
    const empty = document.createElement('div');
    empty.className = 'tray-empty';
    empty.textContent = 'No stickers yet. Upload one to fill your tray.';
    tray.appendChild(empty);
    return;
  }
  trayItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'tray-item'; el.draggable = true; el.dataset.id = item.id;
    const img = document.createElement('img'); img.src = item.src; img.alt = item.name;
    el.appendChild(img);
    const del = document.createElement('button');
    del.className = 'tray-delete'; del.type = 'button'; del.textContent = '×';
    del.addEventListener('click', e => { e.stopPropagation(); removeTrayItem(item.id); });
    el.appendChild(del);
    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', item.id);
      e.dataTransfer.effectAllowed = 'copy';
      const tiny = document.createElement('canvas'); tiny.width = 1; tiny.height = 1;
      e.dataTransfer.setDragImage(tiny, 0, 0);
      createGhost(item.src, e.clientX, e.clientY); showDropOverlay(true);
    });
    el.addEventListener('dragend', () => { destroyGhost(); showDropOverlay(false); });
    tray.appendChild(el);
  });
}

/* ════════════════════════════════════════════════════════════════════
   GHOST
   ════════════════════════════════════════════════════════════════════ */
function createGhost(src, x, y) {
  destroyGhost();
  dragGhost = document.createElement('img');
  dragGhost.className = 'ghost'; dragGhost.src = src;
  document.body.appendChild(dragGhost); moveGhost(x, y);
}
function moveGhost(x, y) { if (!dragGhost) return; dragGhost.style.left = `${x}px`; dragGhost.style.top = `${y}px`; }
function destroyGhost() { if (dragGhost) { dragGhost.remove(); dragGhost = null; } }
function showDropOverlay(show) { dropOverlay.classList.toggle('visible', !!show); }

/* ════════════════════════════════════════════════════════════════════
   PLACE / SELECT / REMOVE STICKERS
   ════════════════════════════════════════════════════════════════════ */
function placeStickerFromTray(item, clientX, clientY) {
  const rect = laptop.getBoundingClientRect();
  placeSticker({
    src: item.src, width: item.width, height: item.height,
    x: clientX - rect.left, y: clientY - rect.top, name: item.name
  });
}

async function placeSticker({ src, width, height, x, y, name }) {
  const size = fitSize(width || 256, height || 256, 120);
  const s = {
    id: `sticker-${stickerCounter++}`, dbId: null,
    name: name || 'sticker', category: 'custom', src,
    x: snap(clamp(x - size.w / 2, 0, laptop.clientWidth - size.w)),
    y: snap(clamp(y - size.h / 2, 0, laptop.clientHeight - size.h)),
    w: size.w, h: size.h, rot: 0,
    flipH: false, flipV: false, hue: 0, sat: 100, br: 100
  };
  saveState(); stickers.push(s); renderStickers(); selectSticker(s.id); saveLayout();
  const dbId = await apiSaveSticker(s); if (dbId) s.dbId = dbId;
  return s;
}

function selectSticker(id) { selectedId = id; multiSelected.clear(); renderStickers(); updateTintPanel(); }
function deselectSticker() { selectedId = null; multiSelected.clear(); renderStickers(); updateTintPanel(); }

async function removeSticker(id) {
  const s = getSticker(id); saveState();
  stickers = stickers.filter(s => s.id !== id);
  if (selectedId === id) selectedId = null;
  multiSelected.delete(id); renderStickers(); saveLayout();
  if (s) await apiDeleteSticker(s);
}

async function clearLaptop() {
  saveState(); stickers = []; selectedId = null; multiSelected.clear();
  renderStickers(); saveLayout(); await apiClearStickers();
}

function getSticker(id) { return stickers.find(s => s.id === id); }

/* ════════════════════════════════════════════════════════════════════
   PHASE 1 — LAYER CONTROLS
   ════════════════════════════════════════════════════════════════════ */
function bringForward(id) {
  const i = stickers.findIndex(s => s.id === id);
  if (i < stickers.length - 1) {
    saveState();[stickers[i], stickers[i + 1]] = [stickers[i + 1], stickers[i]];
    renderStickers(); saveLayout();
  }
}
function sendBackward(id) {
  const i = stickers.findIndex(s => s.id === id);
  if (i > 0) {
    saveState();[stickers[i], stickers[i - 1]] = [stickers[i - 1], stickers[i]];
    renderStickers(); saveLayout();
  }
}

/* ════════════════════════════════════════════════════════════════════
   PHASE 1 — FLIP
   ════════════════════════════════════════════════════════════════════ */
async function flipSticker(id, axis) {
  const s = getSticker(id); if (!s) return; saveState();
  if (axis === 'H') s.flipH = !s.flipH; else s.flipV = !s.flipV;
  renderStickers(); saveLayout(); await apiUpdateSticker(s);
}

/* ════════════════════════════════════════════════════════════════════
   PHASE 2 — TINT
   ════════════════════════════════════════════════════════════════════ */
function updateTintPanel() {
  const s = getSticker(selectedId);
  if (!s) { tintPanel.classList.remove('visible'); return; }
  tintPanel.classList.add('visible');
  hueSlider.value = s.hue || 0; satSlider.value = s.sat || 100; brSlider.value = s.br || 100;
  hueVal.textContent = `${s.hue || 0}°`;
  satVal.textContent = `${s.sat || 100}%`;
  brVal.textContent = `${s.br || 100}%`;
}
async function applyTint(prop, val) {
  const s = getSticker(selectedId); if (!s) return;
  s[prop] = +val; renderStickers(); saveLayout(); await apiUpdateSticker(s);
}

/* ════════════════════════════════════════════════════════════════════
   RENDER STICKERS
   ════════════════════════════════════════════════════════════════════ */
function renderStickers() {
  stickerLayer.querySelectorAll('.canvas-sticker').forEach(el => el.remove());
  updateCanvasHint();
  stickers.forEach(sticker => {
    const isSelected = sticker.id === selectedId;
    const isMulti = multiSelected.has(sticker.id);
    const el = document.createElement('div');
    el.className = 'canvas-sticker' + (isSelected ? ' selected' : '') + (isMulti ? ' multi-selected' : '');
    el.dataset.id = sticker.id;
    el.style.cssText = `left:${sticker.x}px;top:${sticker.y}px;width:${sticker.w}px;height:${sticker.h}px;transform:${stickerTransform(sticker)};`;
    const img = document.createElement('img');
    img.src = sticker.src; img.alt = sticker.name; img.style.filter = stickerFilter(sticker);
    el.appendChild(img);
    if (isSelected) {
      const hRot = document.createElement('div'); hRot.className = 'handle rotate';
      const hRes = document.createElement('div'); hRes.className = 'handle resize';
      const hDel = document.createElement('div'); hDel.className = 'handle delete'; hDel.textContent = '×';
      el.append(hRot, hRes, hDel);
      hRot.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); startRotate(e, sticker.id); });
      hRes.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); startResize(e, sticker.id); });
      hDel.addEventListener('pointerdown', e => { e.stopPropagation(); removeSticker(sticker.id); });
    }
    el.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('handle')) return;
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) {
        if (multiSelected.has(sticker.id)) multiSelected.delete(sticker.id);
        else { multiSelected.add(sticker.id); if (selectedId) multiSelected.add(selectedId); selectedId = null; }
        renderStickers(); return;
      }
      selectSticker(sticker.id); startMove(e, sticker.id);
    });
    el.addEventListener('click', e => { e.stopPropagation(); if (!e.shiftKey) selectSticker(sticker.id); });
    stickerLayer.appendChild(el);
  });
}

/* ════════════════════════════════════════════════════════════════════
   INTERACTIONS
   ════════════════════════════════════════════════════════════════════ */
function startMove(e, id) {
  const s = getSticker(id); if (!s) return;
  const lr = laptop.getBoundingClientRect();
  const sx = e.clientX - lr.left - s.x, sy = e.clientY - lr.top - s.y;
  const onMove = ev => {
    ev.preventDefault();
    const nx = snap(clamp(ev.clientX - lr.left - sx, -s.w * 0.5, laptop.clientWidth - s.w * 0.5));
    const ny = snap(clamp(ev.clientY - lr.top - sy, -s.h * 0.5, laptop.clientHeight - s.h * 0.5));
    if (multiSelected.size > 0 && multiSelected.has(id)) {
      const dx = nx - s.x, dy = ny - s.y;
      multiSelected.forEach(sid => { const ms = getSticker(sid); if (ms) { ms.x = snap(ms.x + dx); ms.y = snap(ms.y + dy); } });
    }
    s.x = nx; s.y = ny; renderStickers();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    saveState(); saveLayout();
    if (multiSelected.size > 0) multiSelected.forEach(sid => { const ms = getSticker(sid); if (ms) apiUpdateSticker(ms); });
    else apiUpdateSticker(s);
  };
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
}

function startRotate(e, id) {
  const s = getSticker(id); if (!s) return;
  const onMove = ev => {
    const rect = laptop.getBoundingClientRect();
    const cx = rect.left + s.x + s.w / 2, cy = rect.top + s.y + s.h / 2;
    s.rot = Math.atan2(ev.clientY - cy, ev.clientX - cx) + Math.PI / 2;
    renderStickers();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    saveState(); saveLayout(); apiUpdateSticker(s);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function startResize(e, id) {
  const s = getSticker(id); if (!s) return;
  const sx = e.clientX, sy = e.clientY, sw = s.w, sh = s.h, asp = sw / sh;
  const onMove = ev => {
    const delta = Math.max(ev.clientX - sx, ev.clientY - sy);
    let nw = Math.max(24, sw + delta), nh = nw / asp;
    if (s.x + nw > laptop.clientWidth) { nw = laptop.clientWidth - s.x; nh = nw / asp; }
    if (s.y + nh > laptop.clientHeight) { nh = laptop.clientHeight - s.y; nw = nh * asp; }
    s.w = Math.max(24, nw); s.h = Math.max(24, nh); renderStickers();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    saveState(); saveLayout(); apiUpdateSticker(s);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

/* ════════════════════════════════════════════════════════════════════
   PHASE 2 — DRAG-BOX MULTI-SELECT
   ════════════════════════════════════════════════════════════════════ */
let boxStart = { x: 0, y: 0 };

stickerLayer.addEventListener('pointerdown', e => {
  if (e.target !== stickerLayer) return;
  e.preventDefault();
  const lr = laptop.getBoundingClientRect();
  boxStart = { x: e.clientX - lr.left, y: e.clientY - lr.top };
  selectionBox.style.cssText = `left:${boxStart.x}px;top:${boxStart.y}px;width:0;height:0;`;
  selectionBox.classList.add('visible');
  const onMove = ev => {
    const lr2 = laptop.getBoundingClientRect();
    const cx = ev.clientX - lr2.left, cy = ev.clientY - lr2.top;
    const x = Math.min(cx, boxStart.x), y = Math.min(cy, boxStart.y);
    const w = Math.abs(cx - boxStart.x), h = Math.abs(cy - boxStart.y);
    selectionBox.style.left = x + 'px'; selectionBox.style.top = y + 'px';
    selectionBox.style.width = w + 'px'; selectionBox.style.height = h + 'px';
    multiSelected.clear(); selectedId = null;
    stickers.forEach(s => { if (s.x + s.w > x && s.x < x + w && s.y + s.h > y && s.y < y + h) multiSelected.add(s.id); });
    renderStickers();
  };
  const onUp = () => {
    selectionBox.classList.remove('visible');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
});

/* ════════════════════════════════════════════════════════════════════
   FILE HANDLING
   ════════════════════════════════════════════════════════════════════ */
function makeSpinner() {
  const tile = document.createElement('div');
  tile.className = 'tray-item'; tile.innerHTML = '<div class="spinner"></div>';
  tray.appendChild(tile); return tile;
}
async function handleAutoFiles(fileList) {
  const files = Array.from(fileList || []).filter(isImage);
  for (const file of files) {
    const sp = makeSpinner();
    try { const r = await removeBg(file); addTrayItem(r.src, { width: r.width, height: r.height, name: file.name }); toast(`Processed: ${file.name}`, 'ok'); }
    catch (err) { toast(`${file.name}: ${err.message}`, 'err'); }
    finally { sp.remove(); }
  }
}
async function handlePrecutFiles(fileList) {
  const files = Array.from(fileList || []).filter(isPrecut);
  for (const file of files) {
    const sp = makeSpinner();
    try { const d = await fileToImageData(file); addTrayItem(d.src, { width: d.width, height: d.height, name: file.name }); toast(`Added: ${file.name}`, 'ok'); }
    catch (err) { toast(`Failed: ${file.name}`, 'err'); }
    finally { sp.remove(); }
  }
}
async function handleOSDrop(files, clientX, clientY) {
  const list = Array.from(files || []).filter(isImage); if (!list.length) return;
  const rect = laptop.getBoundingClientRect();
  const dx = clientX - rect.left, dy = clientY - rect.top;
  for (const file of list) {
    try {
      if (isPrecut(file)) { const d = await fileToImageData(file); placeSticker({ src: d.src, width: d.width, height: d.height, x: dx, y: dy, name: file.name }); toast(`Placed: ${file.name}`, 'ok'); }
      else { const r = await removeBg(file); placeSticker({ src: r.src, width: r.width, height: r.height, x: dx, y: dy, name: file.name }); toast(`Placed: ${file.name}`, 'ok'); }
    } catch (err) { toast(`${file.name}: ${err.message}`, 'err'); }
  }
}

/* ════════════════════════════════════════════════════════════════════
   PHASE 3 — SHARE LINK
   ════════════════════════════════════════════════════════════════════ */
function encodeLayout() {
  const payload = stickers.map(s => ({
    src: s.src.startsWith('blob:') ? null : s.src,
    name: s.name, x: Math.round(s.x), y: Math.round(s.y),
    w: Math.round(s.w), h: Math.round(s.h), rot: +s.rot.toFixed(4),
    flipH: s.flipH, flipV: s.flipV, hue: s.hue, sat: s.sat, br: s.br
  })).filter(s => s.src);
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}
function loadFromHash() {
  try {
    const hash = location.hash.slice(1); if (!hash) return;
    const data = JSON.parse(decodeURIComponent(atob(hash)));
    data.forEach(s => {
      if (s.src) stickers.push({
        id: `sticker-${stickerCounter++}`, dbId: null,
        src: s.src, name: s.name || 'sticker', category: 'custom',
        x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot || 0,
        flipH: s.flipH || false, flipV: s.flipV || false,
        hue: s.hue || 0, sat: s.sat || 100, br: s.br || 100
      });
    });
    renderStickers(); toast('Layout loaded from share link ✓', 'ok');
  } catch (_) { }
}
shareLinkBtn.addEventListener('click', () => {
  const encoded = encodeLayout();
  if (!encoded) { toast('No shareable stickers (local images only work locally)', 'err'); return; }
  const url = `${location.origin}${location.pathname}#${encoded}`;
  navigator.clipboard.writeText(url)
    .then(() => toast('Share link copied ✓', 'ok'))
    .catch(() => prompt('Copy this share link:', url));
});

/* ════════════════════════════════════════════════════════════════════
   PHASE 2 — SWAP DEVICE
   ════════════════════════════════════════════════════════════════════ */
deviceInput.addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file || !isImage(file)) return;
  const data = await fileToImageData(file);
  laptop.querySelectorAll('.laptop-custom-img').forEach(el => el.remove());
  laptop.classList.add('custom-bg');
  const logo = laptop.querySelector('.asus-logo'); if (logo) logo.style.display = 'none';
  const img = document.createElement('img');
  img.className = 'laptop-custom-img'; img.src = data.src;
  laptop.insertBefore(img, laptop.firstChild);
  toast('Device background updated ✓', 'ok');
});

/* ════════════════════════════════════════════════════════════════════
   PHASE 3 — STICKER PACKS
   ════════════════════════════════════════════════════════════════════ */
const PACK_URLS = [];  // Add raw GitHub PNG URLs here

async function loadPacks() {
  if (!PACK_URLS.length) {
    packGrid.innerHTML = '<div class="pack-loading">Add URLs to PACK_URLS in app.js to load packs.</div>';
    return;
  }
  packGrid.innerHTML = '';
  PACK_URLS.forEach(url => {
    const item = document.createElement('div'); item.className = 'pack-item';
    const img = document.createElement('img'); img.src = url; img.crossOrigin = 'anonymous';
    img.onerror = () => item.remove();
    item.appendChild(img);
    item.addEventListener('click', () => { addTrayItem(url, { name: url.split('/').pop() }); toast('Added to tray ✓', 'ok'); });
    packGrid.appendChild(item);
  });
}

/* ════════════════════════════════════════════════════════════════════
   PHASE 3 — EXPORT (3× high-DPI, shadows, reflections)
   ════════════════════════════════════════════════════════════════════ */
async function exportComposition() {
  exportBtn.textContent = 'Exporting…'; exportBtn.disabled = true;
  const scale = 3, W = 620, H = 400;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale; canvas.height = H * scale;
  const ctx = canvas.getContext('2d'); ctx.scale(scale, scale);
  const customImg = laptop.querySelector('.laptop-custom-img');
  if (customImg) {
    const ci = await loadImage(customImg.src);
    ctx.save(); roundRectPath(ctx, 0, 0, W, H, 28); ctx.clip();
    ctx.drawImage(ci, 0, 0, W, H); ctx.restore();
  } else { drawLaptopBg(ctx, W, H); drawAsusText(ctx, W, H); }
  for (const s of stickers) {
    const img = await loadImage(s.src);
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2); ctx.rotate(s.rot || 0);
    if (s.flipH) ctx.scale(-1, 1); if (s.flipV) ctx.scale(1, -1);
    ctx.filter = stickerFilter(s);
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 4;
    ctx.drawImage(img, -s.w / 2, -s.h / 2, s.w, s.h); ctx.restore();
  }
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.06)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; roundRectPath(ctx, 0, 0, W, H, 28); ctx.fill();
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png'); a.download = 'sticker-layout.png'; a.click();
  toast('Exported at 3× resolution ✓', 'ok');
  exportBtn.textContent = '⬇ Export as PNG'; exportBtn.disabled = false;
}

function drawLaptopBg(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#777'); g.addColorStop(0.15, '#5d5d5d'); g.addColorStop(0.34, '#9a9a9a');
  g.addColorStop(0.54, '#626262'); g.addColorStop(0.7, '#8b8b8b'); g.addColorStop(1, '#535353');
  ctx.fillStyle = g; roundRectPath(ctx, 0, 0, w, h, 28); ctx.fill();
  const hl = ctx.createRadialGradient(w * 0.3, h * 0.18, 10, w * 0.3, h * 0.18, w * 0.46);
  hl.addColorStop(0, 'rgba(255,255,255,0.28)'); hl.addColorStop(0.3, 'rgba(255,255,255,0.06)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; roundRectPath(ctx, 0, 0, w, h, 28); ctx.fill();
  ctx.save(); roundRectPath(ctx, 0, 0, w, h, 28); ctx.clip();
  for (let y = 0; y < h; y += 6) { ctx.fillStyle = y % 12 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; ctx.fillRect(0, y, w, 2); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; roundRectPath(ctx, 0.5, 0.5, w - 1, h - 1, 28); ctx.stroke();
}
function drawAsusText(ctx, w, h) {
  ctx.save(); ctx.translate(w / 2, h / 2); ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.font = 'italic 700 62px "IBM Plex Mono",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ASUS', 0, 0); ctx.restore();
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ════════════════════════════════════════════════════════════════════
   UPLOAD ZONE EVENTS
   ════════════════════════════════════════════════════════════════════ */
function setupZoneHover(zone) {
  zone.addEventListener('dragenter', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', () => zone.classList.remove('dragover'));
}
autoInput.addEventListener('change', e => handleAutoFiles(e.target.files));
precutInput.addEventListener('change', e => handlePrecutFiles(e.target.files));
autoZone.addEventListener('drop', e => { e.preventDefault(); autoZone.classList.remove('dragover'); handleAutoFiles(e.dataTransfer.files); });
precutZone.addEventListener('drop', e => { e.preventDefault(); precutZone.classList.remove('dragover'); handlePrecutFiles(e.dataTransfer.files); });
setupZoneHover(autoZone); setupZoneHover(precutZone);

/* ════════════════════════════════════════════════════════════════════
   STAGE DRAG & DROP
   ════════════════════════════════════════════════════════════════════ */
stage.addEventListener('click', e => {
  const ignore = [stage, stickerLayer, laptop,
    document.querySelector('.asus-logo'), document.querySelector('.laptop-hint')];
  if (ignore.includes(e.target)) deselectSticker();
});
stage.addEventListener('dragenter', e => { e.preventDefault(); dropDepth++; showDropOverlay(true); });
stage.addEventListener('dragover', e => { e.preventDefault(); moveGhost(e.clientX, e.clientY); });
stage.addEventListener('dragleave', e => { e.preventDefault(); dropDepth = Math.max(0, dropDepth - 1); if (!dropDepth) showDropOverlay(false); });
stage.addEventListener('drop', async e => {
  e.preventDefault(); dropDepth = 0; showDropOverlay(false); destroyGhost();
  const trayId = e.dataTransfer.getData('text/plain');
  const trayItem = trayItems.find(t => t.id === trayId);
  if (trayItem) { placeStickerFromTray(trayItem, e.clientX, e.clientY); return; }
  if (e.dataTransfer.files?.length) await handleOSDrop(e.dataTransfer.files, e.clientX, e.clientY);
});
document.addEventListener('dragover', e => { if (dragGhost) moveGhost(e.clientX, e.clientY); });

/* ════════════════════════════════════════════════════════════════════
   KEYBOARD
   ════════════════════════════════════════════════════════════════════ */
window.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement?.isContentEditable);
  if (e.key === 'Escape') {
    const modal = document.getElementById('apiModal');
    if (modal && !modal.classList.contains('hidden')) modal.classList.add('hidden');
    deselectSticker();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !typing) removeSticker(selectedId);
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !typing) { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !typing) { e.preventDefault(); redo(); }
});

/* ════════════════════════════════════════════════════════════════════
   BUTTON EVENTS
   ════════════════════════════════════════════════════════════════════ */
deselectBtn.addEventListener('click', deselectSticker);
clearBtn.addEventListener('click', async () => {
  const confirmed = window.confirm('Clear all stickers from the laptop?');
  if (!confirmed) return;
  await clearLaptop();
  toast('All stickers cleared.', 'ok');
});
exportBtn.addEventListener('click', exportComposition);
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
layerUpBtn.addEventListener('click', () => { if (selectedId) bringForward(selectedId); });
layerDownBtn.addEventListener('click', () => { if (selectedId) sendBackward(selectedId); });
flipHBtn.addEventListener('click', () => { if (selectedId) flipSticker(selectedId, 'H'); });
flipVBtn.addEventListener('click', () => { if (selectedId) flipSticker(selectedId, 'V'); });
snapToggle.addEventListener('click', () => {
  snapToGrid = !snapToGrid;
  snapToggle.classList.toggle('active-btn', snapToGrid);
  toast(snapToGrid ? 'Snap to grid ON' : 'Snap to grid OFF', 'ok');
});
hueSlider.addEventListener('input', () => { hueVal.textContent = hueSlider.value + '°'; applyTint('hue', hueSlider.value); });
satSlider.addEventListener('input', () => { satVal.textContent = satSlider.value + '%'; applyTint('sat', satSlider.value); });
brSlider.addEventListener('input', () => { brVal.textContent = brSlider.value + '%'; applyTint('br', brSlider.value); });

/* ════════════════════════════════════════════════════════════════════
   API KEY MODAL (remove.bg)
   — Uses /account endpoint: 200 = valid key, 401 = invalid key
   — No image upload needed, no false rejections
   ════════════════════════════════════════════════════════════════════ */
(function initApiModal() {
  const saved = localStorage.getItem('rbg_key');
  const backdrop = document.getElementById('apiModal');
  const input = document.getElementById('modalKeyInput');
  const btn = document.getElementById('modalSubmit');
  const status = document.getElementById('modalStatus');

  function setStatus(msg, cls) {
    status.className = 'modal-status ' + (cls || '');
    status.innerHTML = cls === 'validating'
      ? '<div class="spin-sm"></div>' + msg
      : msg;
  }

  async function validate(key) {
    // /account returns 200 for valid keys, 401 for invalid — no image needed
    const res = await fetch('https://api.remove.bg/v1.0/account', {
      method: 'GET',
      headers: { 'X-Api-Key': key }
    });
    return res.status === 200;
  }

  async function submit() {
    const val = input.value.trim();
    if (!val) {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      setStatus('Paste your API key first.', 'err');
      return;
    }
    btn.disabled = true;
    setStatus('Validating key…', 'validating');
    try {
      const ok = await validate(val);
      if (ok) {
        removeBgKey = val;
        localStorage.setItem('rbg_key', val);
        backdrop.classList.add('hidden');
        setStatus('', '');
        toast('API key saved ✓', 'ok');
      } else {
        setStatus('Invalid key — check and try again.', 'err');
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 400);
      }
    } catch (e) {
      // If CORS blocks /account, skip validation and trust the key
      // It will fail naturally when processing an image
      removeBgKey = val;
      localStorage.setItem('rbg_key', val);
      backdrop.classList.add('hidden');
      setStatus('', '');
      toast('API key saved (validation skipped — CORS)', 'ok');
    }
    btn.disabled = false;
  }

  if (saved) { removeBgKey = saved; backdrop.classList.add('hidden'); }
  else { backdrop.classList.remove('hidden'); }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
})();

/* ════════════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════════════ */
(async function init() {
  await checkBackend();
  loadFromHash();
  await loadFromBackend();
  loadPacks();
  renderTray();
})();


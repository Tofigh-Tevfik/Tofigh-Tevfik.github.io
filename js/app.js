/* =====================================================================
   APP: UI glue (loading, intro, input, HUD, map, panels, index, sound)
   ===================================================================== */
(function () {
  'use strict';

  const DATA = window.PORTFOLIO;
  const ZD = DATA.zones;
  const byId = {};
  ZD.forEach((z) => { byId[z.id] = z; });
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const params = new URLSearchParams(location.search);
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  if (isTouch) body.classList.add('touch');
  const isFile = location.protocol === 'file:';

  // ---------- error capture (shown with ?debug) ----------
  const errors = [];
  window.addEventListener('error', (e) => { errors.push(String(e.message || e)); showDebug(); });
  window.addEventListener('unhandledrejection', (e) => { errors.push('Promise: ' + String(e.reason && e.reason.message || e.reason)); showDebug(); });
  function showDebug() {
    if (!params.has('debug')) return;
    let d = $('debug');
    if (!d) { d = document.createElement('pre'); d.id = 'debug'; d.style.cssText = 'position:fixed;left:8px;top:60px;z-index:999;max-width:60vw;white-space:pre-wrap;background:#300;color:#fdd;padding:8px;font:12px monospace;border-radius:6px'; document.body.appendChild(d); }
    d.textContent = errors.join('\n');
  }

  // ---------- storage (per-viewer conveniences only) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  const visited = new Set((store.get('tofigh.visited', []) || []).filter((id) => byId[id]));

  const S = {
    world: null, ready: false, started: false, panel: null, indexOpen: false, mapBig: false,
    lb: null, sound: false, quality: params.get('quality') || store.get('tofigh.quality', isTouch ? 'low' : 'high'),
    lastAutoZone: 'hq', helpTimer: 0
  };

  // ---------- small DOM helper ----------
  function h(tag, attrs, kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    (Array.isArray(kids) ? kids : kids != null ? [kids] : []).forEach((c) => {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  // ---------- toasts ----------
  function toast(html, color, ms) {
    const t = h('div', { class: 'toast' });
    t.innerHTML = html;
    if (color) t.style.setProperty('--t', color);
    $('toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms || 3400);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- loading ----------
  const loaderFill = $('loader-fill');
  function setLoad(p) { loaderFill.style.width = Math.round(p * 100) + '%'; }
  setLoad(0.12);

  function waitThree() {
    return new Promise((resolve, reject) => {
      if (window.THREE && window.THREE_ADDONS) return resolve();
      if (window.THREE_FAILED) return reject(new Error('three failed'));
      const to = setTimeout(() => reject(new Error('timeout loading 3D engine')), 25000);
      window.addEventListener('three-ready', () => { clearTimeout(to); resolve(); }, { once: true });
      window.addEventListener('three-failed', () => { clearTimeout(to); reject(new Error('three failed')); }, { once: true });
    });
  }
  function waitFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([
      Promise.all([document.fonts.load("700 96px 'Space Grotesk'"), document.fonts.load("600 12px 'JetBrains Mono'")]).catch(() => {}),
      new Promise((r) => setTimeout(r, 2500))
    ]);
  }

  Promise.all([waitFonts().then(() => setLoad(0.3)), waitThree().then(() => setLoad(0.65))])
    .then(() => new Promise((r) => requestAnimationFrame(r)))
    .then(initWorld)
    .catch((err) => { console.error(err); fail(err); });

  function fail(err) {
    errors.push(String(err && err.message || err)); showDebug();
    body.classList.add('no3d');
    $('btn-start').disabled = true;
    $('btn-start-label').textContent = '3D unavailable';
    $('loader').classList.add('done');
    $('fatal').hidden = false;
    buildIndex();
    S.ready = true;
    handleHash();
  }

  function initWorld() {
    const canvas = $('scene');
    canvas.setAttribute('tabindex', '-1');
    let world;
    try {
      world = window.createWorld(canvas, DATA, { quality: S.quality, isTouch });
    } catch (err) {
      console.error(err);
      fail(err);
      return;
    }
    S.world = world;
    setLoad(1);
    $('loader').classList.add('done');
    $('btn-start').disabled = false;
    $('btn-start-label').textContent = 'Take off';
    $('quality-label').textContent = S.quality === 'high' ? 'High' : 'Low';
    buildLabels();
    buildIndex();
    bindWorldEvents();
    S.ready = true;
    window.addEventListener('resize', () => { world.resize(); sizeMap(); });
    requestAnimationFrame(loop);
    handleHash();
    if (params.has('autostart')) startFlight();
  }

  // ---------- intro / start ----------
  $('btn-start').addEventListener('click', startFlight);
  $('btn-browse').addEventListener('click', () => openIndex());
  $('fatal-browse').addEventListener('click', () => openIndex());

  function startFlight() {
    if (S.started || !S.world) return;
    S.started = true;
    S.world.start();
    $('intro').classList.add('gone');
    body.classList.remove('is-intro');
    $('scene').focus({ preventScroll: true });
    if (!isTouch) {
      $('controls-card').classList.remove('hidden');
      clearTimeout(S.helpTimer);
      S.helpTimer = setTimeout(() => $('controls-card').classList.add('hidden'), 18000);
    }
    setTimeout(() => toast(isTouch ? 'Tap a building name to fly there on autopilot, or use the sticks.' : 'Follow a glowing beacon. Land on the <b>H</b> pad or press <b>Enter</b> nearby to go inside.', null, 5200), 1400);
    updatePanelFoot();
  }

  // ---------- world events ----------
  function bindWorldEvents() {
    const w = S.world;
    w.on('arrive', (id) => { S.lastAutoZone = id; openPanel(id); });
    w.on('ring', (d) => toast(`Ring <b>${d.count}/${d.total}</b>`, byId.minsnap && byId.minsnap.accent, 1400));
    w.on('ringsComplete', (d) => toast(`Course complete in <b>${d.time.toFixed(1)} s</b>. Smooth as minimum snap!`, '#7dffb0', 5000));
  }

  // ---------- 3D labels ----------
  const labels = [];
  function buildLabels() {
    const wrap = $('labels');
    S.world.zones.forEach((z) => {
      const el = h('button', { class: 'zlabel' + (visited.has(z.id) ? ' visited' : ''), type: 'button', style: { '--c': z.accent }, title: 'Fly to ' + z.name },
        [z.name + ' ', h('span', { class: 'chk', text: '✓' })]);
      el.style.setProperty('--c', z.accent);
      el.addEventListener('click', () => { if (S.started) flyTo(z.id); });
      wrap.appendChild(el);
      labels.push({ el, z, o: { x: 0, y: 0, visible: false, dist: 0 } });
    });
  }
  function updateLabels() {
    if (!S.started) return;
    const near = S.world.nearZone();
    for (const L of labels) {
      const o = S.world.project(L.z.labelPos, L.o);
      const hide = !o.visible || (S.panel === L.z.id) || o.x < -100 || o.x > innerWidth + 100 || o.y < -50 || o.y > innerHeight + 50;
      if (hide) { if (L.el.style.display !== 'none') L.el.style.display = 'none'; continue; }
      if (L.el.style.display === 'none') L.el.style.display = '';
      const s = clamp(1.15 - o.dist / 520, 0.62, 1.1);
      const op = (near && near.id === L.z.id) ? 0.35 : clamp((o.dist - 12) / 30, 0, 1);
      L.el.style.opacity = op.toFixed(2);
      L.el.style.pointerEvents = op < 0.2 ? 'none' : 'auto';
      L.el.style.transform = `translate(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px) translate(-50%, -100%) scale(${s.toFixed(3)})`;
      L.el.style.zIndex = String(10000 - Math.round(o.dist));
    }
  }

  // ---------- visited progress ----------
  function updateProgress() {
    $('progress-count').textContent = visited.size;
    $('progress-total').textContent = ZD.length;
    $('progress-fill').style.width = (visited.size / ZD.length * 100) + '%';
    labels.forEach((L) => L.el.classList.toggle('visited', visited.has(L.z.id)));
    document.querySelectorAll('.card[data-id]').forEach((c) => c.classList.toggle('visited', visited.has(c.dataset.id)));
  }
  function markVisited(id) {
    if (visited.has(id)) return;
    visited.add(id);
    store.set('tofigh.visited', Array.from(visited));
    updateProgress();
    if (visited.size === ZD.length) setTimeout(() => toast('You explored <b>every building</b>. Thanks for flying by!', '#7dffb0', 5200), 600);
  }
  updateProgress();

  // ---------- flying helpers ----------
  function flyTo(id) {
    if (!S.world) { openPanel(id); return; }
    if (!S.started) startFlight();
    closeIndex(); closeMap(); closePanel(true);
    if (S.world.flyTo(id)) {
      S.lastAutoZone = null;
      const z = byId[id];
      toast(`Autopilot: flying to <b>${esc(z.name)}</b>. Touch the controls to take over.`, z.accent, 3000);
    }
  }

  // ---------- input ----------
  const keys = new Set();
  const FLIGHT = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyR', 'KeyC']);
  const stickL = { x: 0, y: 0 }, stickR = { x: 0, y: 0 };
  const ZERO = { fwd: 0, strafe: 0, up: 0, yaw: 0 };
  function readInput() {
    if (!S.started || S.panel || S.indexOpen || S.lb || S.mapBig) return ZERO;
    let fwd = 0, strafe = 0, up = 0, yaw = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) yaw += 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) yaw -= 1;
    if (keys.has('KeyQ')) strafe -= 1;
    if (keys.has('KeyE')) strafe += 1;
    if (keys.has('Space') || keys.has('KeyR')) up += 1;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyC')) up -= 1;
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
    fwd += dz(stickR.y); strafe += dz(stickR.x); up += dz(stickL.y); yaw -= dz(stickL.x);
    return { fwd: clamp(fwd, -1, 1), strafe: clamp(strafe, -1, 1), up: clamp(up, -1, 1), yaw: clamp(yaw, -1, 1) };
  }

  window.addEventListener('keydown', (e) => {
    const k = e.code;
    if (k === 'Escape') { closeTop(); return; }
    if (S.lb) {
      if (k === 'ArrowLeft') lbStep(-1);
      if (k === 'ArrowRight') lbStep(1);
      return;
    }
    if (S.panel || S.indexOpen) return;
    if (!S.started) {
      if ((k === 'Enter' || k === 'Space') && S.world && document.activeElement === document.body) { e.preventDefault(); startFlight(); }
      return;
    }
    if (FLIGHT.has(k)) {
      e.preventDefault();
      keys.add(k);
      if (document.activeElement && document.activeElement !== document.body && document.activeElement !== $('scene')) document.activeElement.blur();
      return;
    }
    if (e.repeat) return;
    if (k === 'Enter' || k === 'KeyF') { const z = S.world && S.world.nearZone(); if (z) { e.preventDefault(); openPanel(z.id); } }
    else if (k === 'KeyM') toggleMap();
    else if (k === 'KeyI') openIndex();
    else if (k === 'KeyH') toggleHelp();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // mouse look / zoom
  (function bindPointer() {
    const c = $('scene');
    let drag = null;
    c.addEventListener('pointerdown', (e) => {
      if (!S.started || e.pointerType === 'touch' || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      c.setPointerCapture(e.pointerId);
      c.classList.add('dragging');
      S.world.setDragging(true);
    });
    c.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      S.world.orbit(e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const end = () => { if (!drag) return; drag = null; c.classList.remove('dragging'); S.world && S.world.setDragging(false); };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => { if (!S.started) return; e.preventDefault(); S.world.zoom(e.deltaY > 0 ? 1.08 : 0.93); }, { passive: false });
  })();

  // touch sticks (Mode 2: left = throttle/yaw, right = pitch/roll)
  function makeStick(zone, target) {
    const base = zone.querySelector('.stick-base'), knob = zone.querySelector('.stick-knob');
    const R = 50;
    let id = null, cx = 0, cy = 0;
    const move = (e) => {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      target.x = dx / R; target.y = -dy / R;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      zone.setPointerCapture(id);
      const r = zone.getBoundingClientRect();
      base.style.left = (e.clientX - r.left) + 'px';
      base.style.top = (e.clientY - r.top) + 'px';
      base.style.right = 'auto';
      base.style.margin = '-56px 0 0 -56px';
      cx = e.clientX; cy = e.clientY;
      zone.classList.add('active');
      move(e);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; target.x = 0; target.y = 0;
      knob.style.transform = '';
      base.removeAttribute('style');
      zone.classList.remove('active');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }
  makeStick($('stick-left'), stickL);
  makeStick($('stick-right'), stickR);

  // ---------- HUD ----------
  const adi = $('adi'), adiCtx = adi.getContext('2d');
  function drawADI(pitch, roll) {
    const x = adiCtx, W = adi.width, r = W / 2;
    x.clearRect(0, 0, W, W);
    x.save();
    x.beginPath(); x.arc(r, r, r - 3, 0, TAU); x.clip();
    x.translate(r, r);
    x.rotate(roll);
    const off = clamp(pitch * 150, -r, r);
    x.fillStyle = '#2f7fc6'; x.fillRect(-W, -W * 2 + off, W * 2, W * 2);
    x.fillStyle = '#7a5530'; x.fillRect(-W, off, W * 2, W * 2);
    x.strokeStyle = '#ffffff'; x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(-W, off); x.lineTo(W, off); x.stroke();
    x.lineWidth = 1.5; x.strokeStyle = 'rgba(255,255,255,.75)';
    for (let d = -20; d <= 20; d += 10) {
      if (!d) continue;
      const y = off - d * (Math.PI / 180) * 150;
      const half = Math.abs(d) === 10 ? 18 : 28;
      x.beginPath(); x.moveTo(-half, y); x.lineTo(half, y); x.stroke();
    }
    x.restore();
    // aircraft symbol
    x.strokeStyle = '#f5b942'; x.lineWidth = 4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(r - 44, r); x.lineTo(r - 16, r); x.lineTo(r - 8, r + 9); x.moveTo(r + 44, r); x.lineTo(r + 16, r); x.lineTo(r + 8, r + 9); x.stroke();
    x.fillStyle = '#f5b942'; x.beginPath(); x.arc(r, r, 4, 0, TAU); x.fill();
    // bezel + roll pointer
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 3; x.beginPath(); x.arc(r, r, r - 2, 0, TAU); x.stroke();
    x.save(); x.translate(r, r); x.rotate(roll);
    x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(0, -r + 6); x.lineTo(-7, -r + 18); x.lineTo(7, -r + 18); x.closePath(); x.fill();
    x.restore();
  }
  const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  let hudAcc = 0, lastMode = '';
  function updateHUD(dt) {
    hudAcc += dt;
    const t = S.world.telemetry();
    drawADI(t.pitch, t.roll);
    if (hudAcc < 0.08) return t;
    hudAcc = 0;
    $('t-alt').textContent = Math.max(0, t.alt).toFixed(1);
    $('t-spd').textContent = t.speed.toFixed(1);
    $('t-hdg').textContent = String(Math.round(t.heading) % 360).padStart(3, '0');
    $('t-card').textContent = CARD[Math.round(t.heading / 45) % 8];
    if (t.mode !== lastMode) {
      lastMode = t.mode;
      $('t-mode').textContent = t.mode;
      $('t-mode').parentElement.classList.toggle('auto', t.mode.startsWith('AUTO'));
    }
    $('geofence').classList.toggle('on', !!t.geofence);
    return t;
  }

  // ---------- prompt + auto-open on landing ----------
  let promptZone = null;
  function updatePrompt(t) {
    const near = S.world.nearZone();
    const show = near && S.started && !S.panel && !S.indexOpen && !(t && t.auto);
    if (!near) S.lastAutoZone = null;
    if (show) {
      if (promptZone !== near.id) {
        promptZone = near.id;
        const z = byId[near.id];
        const p = $('prompt');
        p.style.setProperty('--acc', z.accent);
        $('prompt-kicker').textContent = z.name;
        $('prompt-title').textContent = z.title;
      }
      $('prompt').classList.add('show');
      if (t && t.mode === 'LANDED' && S.lastAutoZone !== near.id) { S.lastAutoZone = near.id; openPanel(near.id); }
    } else {
      $('prompt').classList.remove('show');
      promptZone = show ? promptZone : null;
    }
  }
  $('prompt-btn').addEventListener('click', () => { const z = S.world && S.world.nearZone(); if (z) openPanel(z.id); });

  // ---------- minimap ----------
  const mm = $('minimap'), mmCtx = mm.getContext('2d'), mmWrap = $('minimap-wrap'), mmTip = $('minimap-tip');
  let mmHover = null, mmAcc = 1;
  function sizeMap() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(mmWrap.clientWidth * dpr);
    if (w && mm.width !== w) { mm.width = w; mm.height = w; }
    mmAcc = 1;
  }
  function mapScale() { const W = mm.width; return { cx: W / 2, cy: W / 2, s: (W / 2 - (S.mapBig ? W * 0.1 : W * 0.05)) / (S.mapBig ? 240 : 200) }; }
  mmWrap.addEventListener('transitionend', (e) => { if (e.target === mmWrap) sizeMap(); });
  function drawMap(t) {
    const x = mmCtx, W = mm.width, { cx, cy, s } = mapScale();
    const k = W / 360;
    x.clearRect(0, 0, W, W);
    const bg = x.createRadialGradient(cx, cy, 0, cx, cy, W * 0.7);
    bg.addColorStop(0, '#16222f'); bg.addColorStop(1, '#0b121b');
    x.fillStyle = bg; x.fillRect(0, 0, W, W);
    x.strokeStyle = 'rgba(125,211,252,.08)'; x.lineWidth = 1 * k;
    for (let r = 50; r <= 300; r += 50) { x.beginPath(); x.arc(cx, cy, r * s, 0, TAU); x.stroke(); }
    x.setLineDash([6 * k, 6 * k]); x.strokeStyle = 'rgba(251,113,133,.45)';
    x.beginPath(); x.arc(cx, cy, 300 * s, 0, TAU); x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(221,212,196,.25)'; x.beginPath(); x.arc(cx, cy, 32 * s, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(200,205,215,.28)'; x.lineWidth = Math.max(2 * k, 7 * s);
    S.world.zones.forEach((z) => {
      if (z.id === 'hq') return;
      const d = Math.hypot(z.pad.x, z.pad.z);
      x.beginPath(); x.moveTo(cx + z.pad.x / d * 31 * s, cy + z.pad.z / d * 31 * s); x.lineTo(cx + z.pad.x * s, cy + z.pad.z * s); x.stroke();
    });
    S.world.zones.forEach((z) => {
      const px = cx + z.center.x * s, py = cy + z.center.z * s;
      const rr = (S.mapBig ? 9 : 6) * k * (mmHover === z.id ? 1.35 : 1);
      x.fillStyle = z.accent; x.globalAlpha = 0.95;
      x.beginPath(); x.arc(px, py, rr, 0, TAU); x.fill();
      x.globalAlpha = 1;
      if (visited.has(z.id)) { x.strokeStyle = '#ffffff'; x.lineWidth = 2 * k; x.beginPath(); x.arc(px, py, rr + 3 * k, 0, TAU); x.stroke(); }
      if (S.mapBig) {
        // push labels radially outward so the inner ring doesn't overlap
        const r0 = Math.hypot(z.center.x, z.center.z);
        const ux = r0 > 1 ? z.center.x / r0 : 0, uy = r0 > 1 ? z.center.z / r0 : 1;
        const off = rr + 6 * k;
        x.font = `600 ${10.5 * k}px 'Space Grotesk', sans-serif`;
        x.textAlign = ux > 0.35 ? 'left' : ux < -0.35 ? 'right' : 'center';
        x.textBaseline = uy > 0.35 ? 'top' : uy < -0.35 ? 'bottom' : 'middle';
        x.lineWidth = 4 * k; x.strokeStyle = 'rgba(11,18,27,.9)'; x.fillStyle = '#e9eef6';
        x.strokeText(z.name, px + ux * off, py + uy * off);
        x.fillText(z.name, px + ux * off, py + uy * off);
        x.textBaseline = 'alphabetic';
      }
    });
    if (t) {
      let mx = t.x * s, my = t.z * s;
      const lim = W / 2 - 12 * k, ml = Math.hypot(mx, my);
      if (ml > lim) { mx *= lim / ml; my *= lim / ml; }
      const dx = cx + mx, dy = cy + my;
      x.save(); x.translate(dx, dy); x.rotate(-t.yaw);
      const fov = x.createRadialGradient(0, 0, 0, 0, 0, 60 * k);
      fov.addColorStop(0, 'rgba(125,211,252,.35)'); fov.addColorStop(1, 'rgba(125,211,252,0)');
      x.fillStyle = fov; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 60 * k, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); x.closePath(); x.fill();
      x.fillStyle = '#7dd3fc'; x.strokeStyle = '#0b111b'; x.lineWidth = 1.5 * k;
      x.beginPath(); x.moveTo(0, -9 * k); x.lineTo(6.5 * k, 7 * k); x.lineTo(0, 3.5 * k); x.lineTo(-6.5 * k, 7 * k); x.closePath(); x.fill(); x.stroke();
      x.restore();
    }
    x.fillStyle = 'rgba(233,238,246,.6)'; x.font = `600 ${11 * k}px 'JetBrains Mono', monospace`; x.textAlign = 'center';
    x.fillText('N', cx, 14 * k);
  }
  function mapHit(e) {
    const r = mm.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * mm.width, py = (e.clientY - r.top) / r.height * mm.height;
    const { cx, cy, s } = mapScale();
    let best = null, bd = 1e9;
    S.world.zones.forEach((z) => {
      const d = Math.hypot(cx + z.center.x * s - px, cy + z.center.z * s - py);
      if (d < bd) { bd = d; best = z; }
    });
    const lim = (S.mapBig ? 26 : 16) * (mm.width / 360);
    return bd < lim ? { z: best, x: e.clientX - r.left, y: e.clientY - r.top } : null;
  }
  mm.addEventListener('pointermove', (e) => {
    if (!S.world) return;
    const hit = mapHit(e);
    mmHover = hit ? hit.z.id : null;
    if (hit && !isTouch) { mmTip.textContent = hit.z.name; mmTip.style.left = hit.x + 'px'; mmTip.style.top = hit.y + 'px'; mmTip.classList.add('on'); }
    else mmTip.classList.remove('on');
  });
  mm.addEventListener('pointerleave', () => { mmHover = null; mmTip.classList.remove('on'); });
  mm.addEventListener('click', (e) => {
    if (!S.world || !S.started) return;
    const hit = mapHit(e);
    if (!S.mapBig) { if (hit && !isTouch) flyTo(hit.z.id); else openMap(); return; }
    if (hit) flyTo(hit.z.id);
  });
  $('minimap-close').addEventListener('click', closeMap);
  function openMap() { S.mapBig = true; mmWrap.classList.add('big'); setTimeout(sizeMap, 380); sizeMap(); }
  function closeMap() { if (!S.mapBig) return; S.mapBig = false; mmWrap.classList.remove('big'); setTimeout(sizeMap, 380); }
  function toggleMap() { S.mapBig ? closeMap() : openMap(); }
  $('btn-map').addEventListener('click', (e) => { e.currentTarget.blur(); if (!S.started) startFlight(); toggleMap(); });

  // ---------- panel ----------
  const panel = $('panel'), pbody = $('panel-body');
  const order = ZD.map((z) => z.id);
  const isPhoto = (src) => /\/(kaaf|team|edu|about)\/|f450|board/.test(src);

  function mediaEl(m, z, idx) {
    if (m.type === 'video') {
      return h('figure', { class: 'media-item wide' }, [
        h('video', { src: m.src, poster: m.poster, controls: true, preload: 'none', playsinline: true }),
        m.caption ? h('figcaption', { text: m.caption }) : null
      ]);
    }
    if (m.type === 'youtube') {
      const poster = m.poster || `https://i.ytimg.com/vi/${m.id}/hqdefault.jpg`;
      const btn = h('button', { class: 'yt', type: 'button', 'aria-label': 'Play video: ' + (m.caption || 'YouTube'), style: { backgroundImage: `url("${poster}")` } }, [
        h('span', { class: 'play', 'aria-hidden': 'true' }), h('span', { class: 'yt-label', text: 'YouTube' })
      ]);
      btn.addEventListener('click', () => {
        if (isFile) { window.open('https://youtu.be/' + m.id, '_blank', 'noopener'); return; }
        const f = h('iframe', { class: 'yt-frame', src: `https://www.youtube-nocookie.com/embed/${m.id}?autoplay=1&rel=0&modestbranding=1`, title: m.caption || 'YouTube video', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' });
        btn.replaceWith(f);
      });
      return h('figure', { class: 'media-item wide' }, [btn, m.caption ? h('figcaption', { text: m.caption }) : null]);
    }
    const img = h('img', { src: m.src, alt: m.caption || '', loading: 'lazy', decoding: 'async' });
    const fig = h('figure', { class: 'media-item' + (isPhoto(m.src) ? ' photo' : '') }, [img, m.caption ? h('figcaption', { text: m.caption }) : null]);
    img.addEventListener('load', () => { if (img.naturalWidth / img.naturalHeight > 1.9) fig.classList.add('wide'); });
    img.addEventListener('click', () => openLightbox(z, m.src));
    return fig;
  }

  function sec(title, kids) { return h('section', { class: 'sec' }, [title ? h('h3', { text: title }) : null].concat(kids)); }
  function tags(list) { return list && list.length ? h('div', { class: 'tags' }, list.map((t) => h('span', { class: 'tag', text: t }))) : null; }
  function linkBtns(list) {
    if (!list || !list.length) return null;
    return h('div', { class: 'links' }, list.map((l, i) => {
      const ext = /^https?:/.test(l.url);
      return h('a', { class: 'link-btn' + (i === 0 ? ' primary' : ''), href: l.url, target: ext || l.kind === 'download' ? '_blank' : null, rel: ext ? 'noopener' : null }, l.label);
    }));
  }
  function pubCard(p) {
    const kids = [h('p', { class: 'pub-title', text: p.title }), h('p', { class: 'pub-meta', text: p.authors || '' }), p.status ? h('span', { class: 'pub-status', text: p.status }) : null];
    if (p.zone && byId[p.zone] && S.panel !== p.zone) {
      kids.push(h('div', null, h('button', { class: 'pub-go', type: 'button', onclick: () => goZone(p.zone) }, (S.started ? 'Fly to ' : 'Open ') + byId[p.zone].name + ' →')));
    }
    return h('div', { class: 'pub' }, kids);
  }
  function chartEl(c) {
    const max = Math.max.apply(null, c.groups.flatMap((g) => g.bars.map((b) => b[1])));
    const el = h('div', { class: 'chart' }, [h('p', { class: 'chart-title', text: c.title })].concat(c.groups.map((g) => h('div', { class: 'chart-group' }, [
      h('div', { class: 'chart-group-head' }, [h('span', { text: g.label }), g.callout ? h('b', { text: g.callout }) : null])
    ].concat(g.bars.map((b, i) => {
      const fill = h('i', { class: 'bar-fill', 'data-w': (b[1] / max * 100).toFixed(1) });
      return h('div', { class: 'bar-row' + (i === g.bars.length - 1 ? ' hi' : '') }, [
        h('span', { class: 'lbl', text: b[0] }), h('span', { class: 'bar-track' }, fill), h('span', { class: 'val', text: b[1].toFixed(3) + ' ' + c.unit })
      ]);
    }))))).concat(c.note ? [h('p', { class: 'chart-note', text: c.note })] : []));
    return el;
  }

  function renderZone(z) {
    const f = document.createDocumentFragment();
    const media = (z.media || []).slice();
    if (z.id === 'hq') {
      const photo = media.find((m) => m.type === 'image');
      f.appendChild(h('div', { class: 'about-top' }, [
        photo ? h('img', { class: 'about-photo', src: photo.src, alt: photo.caption || '' }) : h('div'),
        h('dl', { class: 'facts' }, (z.facts || []).map((fa) => h('div', null, [h('dt', { text: fa[0] }), h('dd', { text: fa[1] })])))
      ]));
      f.appendChild(sec('Profile', (z.summary || []).map((p) => h('p', { text: p }))));
      f.appendChild(sec('Skills', [h('div', { class: 'skills' }, (z.skills || []).map((g) => h('div', { class: 'skill-group' }, [h('h4', { text: g.group }), tags(g.items)])))]));
      f.appendChild(sec('Get in touch', [linkBtns(z.links)]));
      if (z.note) f.appendChild(h('p', { class: 'note', text: z.note }));
      return f;
    }
    const heroIdx = media.findIndex((m) => m.type === 'video' || m.type === 'youtube');
    if (heroIdx >= 0) {
      const hero = media.splice(heroIdx, 1)[0];
      f.appendChild(h('div', { class: 'sec' }, mediaEl(hero, z)));
    }
    if (z.summary && z.summary.length) f.appendChild(sec('Overview', z.summary.map((p) => h('p', { text: p }))));
    if (z.chart) f.appendChild(sec('Results', [chartEl(z.chart)]));
    if (z.points && z.points.length) f.appendChild(sec(z.category === 'Experience' ? 'What I worked on' : 'What I did', [h('ul', { class: 'bullets' }, z.points.map((p) => h('li', { text: p })))]));
    if (z.game) f.appendChild(h('p', { class: 'note game-note', text: '🏁 ' + z.game }));
    if (z.timeline) {
      f.appendChild(sec(z.id === 'edu' ? 'Degrees & honours' : 'Timeline', [h('ol', { class: 'timeline' }, z.timeline.map((t) => h('li', null, [
        h('div', { class: 'tl-when', text: t.when }), h('p', { class: 'tl-what', text: t.what }), t.detail ? h('p', { class: 'tl-detail', text: t.detail }) : null
      ])))]));
    }
    if (z.publications) f.appendChild(sec('Papers & manuscripts', z.publications.map(pubCard)));
    if (z.reports) {
      f.appendChild(sec('Technical reports', [h('ul', { class: 'reports' }, z.reports.map((r) => h('li', null, [
        h('span', { text: r.title }),
        r.zone && byId[r.zone] ? h('button', { class: 'pub-go', type: 'button', style: { marginTop: '0' }, onclick: () => goZone(r.zone) }, byId[r.zone].name + ' →') : null
      ])))]));
    }
    if (z.publication) f.appendChild(sec('Publication', [pubCard(z.publication)]));
    if (media.length) {
      const videos = media.filter((m) => m.type !== 'image');
      const imgs = media.filter((m) => m.type === 'image');
      f.appendChild(sec('Gallery', [
        videos.length ? h('div', { class: 'media-grid', style: { marginBottom: '10px' } }, videos.map((m) => mediaEl(m, z))) : null,
        imgs.length ? h('div', { class: 'media-grid' }, imgs.map((m) => mediaEl(m, z))) : null
      ]));
    }
    if ((z.links && z.links.length) || (z.tags && z.tags.length)) f.appendChild(sec('Links & stack', [linkBtns(z.links), tags(z.tags)]));
    if (z.note) f.appendChild(h('p', { class: 'note', text: z.note }));
    return f;
  }

  function goZone(id) {
    if (S.started && S.world) flyTo(id);
    else openPanel(id);
  }

  function updatePanelFoot() {
    if (!S.panel) return;
    const i = order.indexOf(S.panel);
    const prev = byId[order[(i - 1 + order.length) % order.length]], next = byId[order[(i + 1) % order.length]];
    const flying = S.started && S.world;
    $('panel-prev').textContent = '← ' + prev.name;
    $('panel-prev').title = (flying ? 'Fly to ' : 'Open ') + prev.name;
    $('panel-next').textContent = next.name + ' →';
    $('panel-next').title = (flying ? 'Fly to ' : 'Open ') + next.name;
    $('panel-prev').dataset.id = prev.id;
    $('panel-next').dataset.id = next.id;
    $('panel-fly').textContent = flying ? 'Back to flying' : (S.world ? 'Take off' : 'Close');
  }
  $('panel-prev').addEventListener('click', (e) => goZone(e.currentTarget.dataset.id));
  $('panel-next').addEventListener('click', (e) => goZone(e.currentTarget.dataset.id));
  $('panel-fly').addEventListener('click', () => {
    const wasStarted = S.started;
    closePanel();
    if (!wasStarted && S.world) startFlight();
  });
  $('panel-close').addEventListener('click', () => closePanel());

  let panelClearTimer = 0;
  function openPanel(id) {
    const z = byId[id];
    if (!z) return;
    clearTimeout(panelClearTimer);
    closeIndex(); closeMap();
    pauseMedia();
    S.panel = id;
    S.lastAutoZone = id;
    panel.style.setProperty('--acc', z.accent);
    $('panel-kicker').textContent = z.name + ' · ' + z.kicker;
    $('panel-title').textContent = z.title;
    $('panel-sub').textContent = z.subtitle || '';
    pbody.textContent = '';
    pbody.appendChild(renderZone(z));
    pbody.scrollTop = 0;
    updatePanelFoot();
    panel.classList.add('open');
    body.classList.add('panel-open');
    $('prompt').classList.remove('show');
    if (S.world && S.started) S.world.hold();
    markVisited(id);
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// may refuse */ }
    setTimeout(() => {
      pbody.querySelectorAll('.bar-fill').forEach((b) => { b.style.width = b.dataset.w + '%'; });
    }, 260);
    panel.focus({ preventScroll: true });
  }
  function pauseMedia() {
    pbody.querySelectorAll('video').forEach((v) => { try { v.pause(); } catch (e) { /* ignore */ } });
    pbody.querySelectorAll('iframe').forEach((f) => f.remove());
  }
  function closePanel(silent) {
    if (!S.panel) return;
    pauseMedia();
    S.panel = null;
    panel.classList.remove('open');
    body.classList.remove('panel-open');
    panelClearTimer = setTimeout(() => { if (!S.panel) pbody.textContent = ''; }, 600);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    if (!silent && S.started) $('scene').focus({ preventScroll: true });
  }

  // ---------- index ----------
  const CATS = ['About', 'Research', 'Projects', 'Experience', 'Education', 'Publications', 'Teams'];
  function thumbOf(z) {
    if (z.thumb) return z.thumb;
    const m = (z.media || []);
    const img = m.find((x) => x.type === 'image' && !/profile/.test(x.src)) || m.find((x) => x.poster);
    return img ? (img.type === 'image' ? img.src : img.poster) : null;
  }
  function buildIndex() {
    const grid = $('index-grid');
    grid.textContent = '';
    CATS.forEach((cat) => {
      const list = ZD.filter((z) => z.category === cat);
      if (!list.length) return;
      grid.appendChild(h('h3', { class: 'index-cat', text: cat }));
      grid.appendChild(h('div', { class: 'cards' }, list.map((z) => {
        const th = thumbOf(z);
        const card = h('article', { class: 'card' + (visited.has(z.id) ? ' visited' : ''), 'data-id': z.id, style: { '--c': z.accent } }, [
          th ? h('div', { class: 'card-thumb', style: { backgroundImage: `url("${th}")` } }) : null,
          h('span', { class: 'visited-badge', text: '✓ visited' }),
          h('span', { class: 'card-place', text: z.name }),
          h('h3', { text: z.title }),
          h('p', { text: z.kicker }),
          h('div', { class: 'card-actions' }, [
            h('button', { type: 'button', class: S.world ? '' : 'primary', onclick: () => { closeIndex(); if (S.started && S.world) S.world.teleportTo(z.id); openPanel(z.id); } }, 'Open'),
            S.world ? h('button', { type: 'button', class: 'primary', onclick: () => flyTo(z.id) }, 'Fly there') : null
          ])
        ]);
        card.style.setProperty('--c', z.accent);
        return card;
      })));
    });
  }
  function openIndex() {
    if (S.panel) closePanel(true);
    S.indexOpen = true;
    $('index').classList.add('open');
    $('index').focus({ preventScroll: true });
  }
  function closeIndex() {
    if (!S.indexOpen) return;
    S.indexOpen = false;
    $('index').classList.remove('open');
  }
  $('btn-index').addEventListener('click', (e) => { e.currentTarget.blur(); openIndex(); });
  $('index-close').addEventListener('click', () => { closeIndex(); if (S.started) $('scene').focus({ preventScroll: true }); });
  $('brand').addEventListener('click', (e) => { e.currentTarget.blur(); openPanel('hq'); });

  // ---------- lightbox ----------
  function openLightbox(z, src) {
    const imgs = (z.media || []).filter((m) => m.type === 'image');
    const i = Math.max(0, imgs.findIndex((m) => m.src === src));
    S.lb = { imgs, i };
    showLb();
    $('lightbox').classList.add('open');
    $('lb-close').focus({ preventScroll: true });
  }
  function showLb() {
    const m = S.lb.imgs[S.lb.i];
    $('lb-img').src = m.src;
    $('lb-img').alt = m.caption || '';
    $('lb-cap').textContent = (m.caption || '') + (S.lb.imgs.length > 1 ? `  (${S.lb.i + 1}/${S.lb.imgs.length})` : '');
    $('lb-prev').style.display = $('lb-next').style.display = S.lb.imgs.length > 1 ? '' : 'none';
  }
  function lbStep(d) { if (!S.lb) return; S.lb.i = (S.lb.i + d + S.lb.imgs.length) % S.lb.imgs.length; showLb(); }
  function closeLb() { S.lb = null; $('lightbox').classList.remove('open'); panel.focus({ preventScroll: true }); }
  $('lb-close').addEventListener('click', closeLb);
  $('lb-prev').addEventListener('click', () => lbStep(-1));
  $('lb-next').addEventListener('click', () => lbStep(1));
  $('lightbox').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeLb(); });

  function closeTop() {
    if (S.lb) return closeLb();
    if (S.mapBig) return closeMap();
    if (S.indexOpen) { closeIndex(); if (S.started) $('scene').focus({ preventScroll: true }); return; }
    if (S.panel) return closePanel();
    if (body.classList.contains('show-help')) return toggleHelp();
  }

  // ---------- help ----------
  function toggleHelp() {
    const c = $('controls-card');
    if (isTouch) { body.classList.toggle('show-help'); return; }
    clearTimeout(S.helpTimer);
    c.classList.toggle('hidden');
  }
  $('btn-help').addEventListener('click', (e) => { e.currentTarget.blur(); toggleHelp(); });
  $('controls-close').addEventListener('click', () => { $('controls-card').classList.add('hidden'); body.classList.remove('show-help'); });

  // ---------- quality ----------
  $('btn-quality').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (!S.world) return;
    S.quality = S.quality === 'high' ? 'low' : 'high';
    S.world.setQuality(S.quality);
    store.set('tofigh.quality', S.quality);
    $('quality-label').textContent = S.quality === 'high' ? 'High' : 'Low';
    toast(`Graphics: <b>${S.quality === 'high' ? 'High (bloom, sharper shadows)' : 'Low (faster)'}</b>`, null, 1800);
  });

  // ---------- motor sound (WebAudio, off by default) ----------
  const audio = { ctx: null, gain: null, o1: null, o2: null, filt: null };
  function initAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    const gain = ctx.createGain(); gain.gain.value = 0;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 800; filt.Q.value = 0.8;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 22;
    const o3 = ctx.createOscillator(); o3.type = 'triangle';
    const g3 = ctx.createGain(); g3.gain.value = 0.6;
    o1.connect(filt); o2.connect(filt); o3.connect(g3); g3.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    [o1, o2, o3].forEach((o) => o.start());
    Object.assign(audio, { ctx, gain, o1, o2, o3, filt });
    return true;
  }
  $('btn-sound').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (!audio.ctx && !initAudio()) return;
    S.sound = !S.sound;
    e.currentTarget.setAttribute('aria-pressed', String(S.sound));
    if (S.sound) audio.ctx.resume();
  });
  function updateAudio(t) {
    if (!audio.ctx) return;
    const now = audio.ctx.currentTime;
    const thr = t ? t.thrust : 0;
    const on = S.sound && S.started && t && t.armed && !document.hidden;
    const f = 70 + thr * 2.1;
    audio.o1.frequency.setTargetAtTime(f, now, 0.08);
    audio.o2.frequency.setTargetAtTime(f * 1.5, now, 0.08);
    audio.o3.frequency.setTargetAtTime(f * 0.5, now, 0.08);
    audio.filt.frequency.setTargetAtTime(500 + thr * 18, now, 0.1);
    audio.gain.gain.setTargetAtTime(on ? clamp(0.025 + thr * 0.0011, 0, 0.11) : 0, now, 0.12);
  }

  // ---------- deep links ----------
  function handleHash() {
    const id = decodeURIComponent((location.hash || '').slice(1));
    if (id && byId[id]) openPanel(id);
  }
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (byId[id] && S.panel !== id) openPanel(id); });

  // ---------- main loop ----------
  let last = performance.now();
  let mapTimer = 0;
  sizeMap();
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    const w = S.world;
    const frozen = !!(S.panel || S.indexOpen || S.lb || S.mapBig);
    w.update(dt, readInput(), frozen);
    if (!S.indexOpen || S.started === false) w.render();
    let t = null;
    if (S.started) {
      t = updateHUD(dt);
      updateLabels();
      updatePrompt(t);
      mapTimer += dt;
      if (mapTimer > (S.mapBig ? 0.05 : 0.1)) { mapTimer = 0; drawMap(t); }
    }
    updateAudio(t);
    requestAnimationFrame(loop);
  }
})();

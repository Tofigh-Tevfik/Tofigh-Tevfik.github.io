/* =====================================================================
   WORLD: Three.js scene, procedural buildings, drone dynamics, camera.
   Exposes window.createWorld(canvas, PORTFOLIO, options) → api
   Requires window.THREE and window.THREE_ADDONS (set in index.html).
   ===================================================================== */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const G = 9.81;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const minJerk = (t) => t * t * t * (10 - 15 * t + 6 * t * t);
  const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createWorld(canvas, DATA, opts) {
    const T = window.THREE;
    const AD = window.THREE_ADDONS || {};
    const V3 = T.Vector3;
    opts = opts || {};
    let quality = opts.quality || 'high';
    const listeners = {};
    const on = (n, f) => { (listeners[n] = listeners[n] || []).push(f); };
    const emit = (n, d) => { (listeners[n] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } }); };

    /* ------------------------------------------------------------------
       Renderer / scene / camera
       ------------------------------------------------------------------ */
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(62, 1, 0.1, 6000);

    const PAL = {
      skyTop: '#3f74bd', skyHorizon: '#f7d2a6', skyBottom: '#e6cfb1', sun: '#ffd49a',
      fog: '#ecd3b4'
    };
    scene.fog = new T.Fog(new T.Color(PAL.fog), 170, 900);

    const sunDir = new V3(-0.62, 0.42, -0.66).normalize();

    // composer (bloom) is created lazily for high quality
    let composer = null, bloomPass = null;
    function setupComposer() {
      if (!AD.EffectComposer || !AD.UnrealBloomPass || !AD.RenderPass || !AD.OutputPass) return;
      const size = renderer.getDrawingBufferSize(new T.Vector2());
      const rt = new T.WebGLRenderTarget(size.x, size.y, { type: T.HalfFloatType, samples: 4 });
      composer = new AD.EffectComposer(renderer, rt);
      composer.addPass(new AD.RenderPass(scene, camera));
      bloomPass = new AD.UnrealBloomPass(new T.Vector2(size.x, size.y), 0.55, 0.55, 0.86);
      composer.addPass(bloomPass);
      composer.addPass(new AD.OutputPass());
    }

    function applyQuality() {
      const dpr = window.devicePixelRatio || 1;
      renderer.setPixelRatio(quality === 'high' ? Math.min(dpr, 1.5) : Math.min(dpr, 1));
      const ms = quality === 'high' ? 2048 : 1024;
      if (sun.shadow.mapSize.x !== ms) {
        sun.shadow.mapSize.set(ms, ms);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
      if (quality === 'high' && !composer) setupComposer();
      resize();
    }

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? 72 : 62;
      camera.updateProjectionMatrix();
      if (composer) {
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(w, h);
      }
    }

    /* ------------------------------------------------------------------
       Materials & helpers
       ------------------------------------------------------------------ */
    const std = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, o || {}));
    const glow = (color, k) => new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(k == null ? 2.4 : k) });

    const MAT = {
      wall: std('#f1eadf'),
      wallWarm: std('#f4e4cb'),
      wallCool: std('#e4e9ef'),
      wallDS: std('#ece4d6', { side: T.DoubleSide }),
      trim: std('#2f353e', { roughness: 0.7 }),
      roof: std('#474e59', { roughness: 0.75 }),
      metal: std('#aeb7c2', { roughness: 0.42, metalness: 0.55 }),
      dark: std('#23272e', { roughness: 0.55 }),
      stone: std('#d8cfbf'),
      white: std('#f7f6f2', { roughness: 0.6 }),
      wood: std('#7b5537'),
      glass: std('#86aed0', { roughness: 0.12, metalness: 0.55, emissive: new T.Color('#1e3a56'), emissiveIntensity: 0.65 }),
      winLit: std('#3d3a35', { roughness: 0.4, emissive: new T.Color('#ffd49a'), emissiveIntensity: 1.0 }),
      winDark: std('#5f84a6', { roughness: 0.15, metalness: 0.5, emissive: new T.Color('#16293c'), emissiveIntensity: 0.55 }),
      leaf: std('#ffffff', { roughness: 0.9, flatShading: true }),
      trunk: std('#6d4b33'),
      asphalt: std('#5d6169', { roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      dash: std('#efe5cc', { roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      lot: std('#d9d1c1', { roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      gold: std('#c9a24a', { roughness: 0.35, metalness: 0.7 })
    };

    const colliders = [];

    function addMesh(parent, geo, mat, x, y, z, noShadow) {
      const m = new T.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.castShadow = !noShadow;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    // y = bottom of the box
    function box(parent, w, h, d, mat, x, y, z, solid) {
      const m = addMesh(parent, new T.BoxGeometry(w, h, d), mat, x, (y || 0) + h / 2, z);
      if (solid) colliders.push({ obj: m, hx: w / 2, hy: h / 2, hz: d / 2 });
      return m;
    }
    function cyl(parent, rt, rb, h, mat, x, y, z, seg, solid) {
      const m = addMesh(parent, new T.CylinderGeometry(rt, rb, h, seg || 16), mat, x, (y || 0) + h / 2, z);
      if (solid) { const r = Math.max(rt, rb) * 0.9; colliders.push({ obj: m, hx: r, hy: h / 2, hz: r }); }
      return m;
    }
    function solidBox(parent, w, h, d, x, y, z) {
      const o = new T.Object3D();
      o.position.set(x || 0, (y || 0) + h / 2, z || 0);
      parent.add(o);
      colliders.push({ obj: o, hx: w / 2, hy: h / 2, hz: d / 2 });
      return o;
    }
    function prism(w, h, d) {
      const s = new T.Shape();
      s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
      g.translate(0, 0, -d / 2);
      return g;
    }

    function addWindows(parent, o) {
      const r = mulberry32(o.seed || 7);
      const lit = [], dark = [];
      const gx = o.w / o.cols, gy = o.h / o.rows;
      const pw = o.pw || gx * 0.62, ph = o.ph || gy * 0.62;
      for (let i = 0; i < o.cols; i++) {
        for (let j = 0; j < o.rows; j++) {
          const g = new T.PlaneGeometry(pw, ph);
          g.translate(-o.w / 2 + gx * (i + 0.5), gy * (j + 0.5), 0);
          (r() < (o.lit == null ? 0.35 : o.lit) ? lit : dark).push(g);
        }
      }
      const grp = new T.Group();
      grp.position.set(o.x || 0, o.y || 0, o.z || 0);
      grp.rotation.y = o.ry || 0;
      parent.add(grp);
      const put = (list, mat) => {
        if (!list.length) return;
        if (AD.mergeGeometries) {
          const m = new T.Mesh(AD.mergeGeometries(list), mat);
          m.receiveShadow = true; grp.add(m);
          list.forEach((g) => g.dispose());
        } else {
          list.forEach((g) => grp.add(new T.Mesh(g, mat)));
        }
      };
      put(lit, MAT.winLit);
      put(dark, MAT.winDark);
      return grp;
    }
    // windows on all four faces of a w×d block
    function windows4(parent, w, d, o) {
      addWindows(parent, Object.assign({}, o, { w: w - (o.inset || 2), z: (o.cz || 0) + d / 2 + 0.03, x: o.cx || 0, seed: (o.seed || 1) }));
      addWindows(parent, Object.assign({}, o, { w: w - (o.inset || 2), z: (o.cz || 0) - d / 2 - 0.03, x: o.cx || 0, ry: Math.PI, seed: (o.seed || 1) + 1 }));
      addWindows(parent, Object.assign({}, o, { w: d - (o.inset || 2), cols: Math.max(1, Math.round(o.cols * d / w)), x: (o.cx || 0) + w / 2 + 0.03, z: o.cz || 0, ry: Math.PI / 2, seed: (o.seed || 1) + 2 }));
      addWindows(parent, Object.assign({}, o, { w: d - (o.inset || 2), cols: Math.max(1, Math.round(o.cols * d / w)), x: (o.cx || 0) - w / 2 - 0.03, z: o.cz || 0, ry: -Math.PI / 2, seed: (o.seed || 1) + 3 }));
    }

    const FONT = "'Space Grotesk', 'Segoe UI', system-ui, sans-serif";
    function textTexture(text, accent, o) {
      o = o || {};
      const fs = 96;
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const font = `700 ${fs}px ${FONT}`;
      ctx.font = font;
      const tw = Math.ceil(ctx.measureText(text).width);
      const padX = fs * 0.55, bar = fs * 0.28;
      c.width = Math.min(4096, tw + padX * 2 + bar);
      c.height = Math.round(fs * 1.6);
      ctx.font = font;
      ctx.fillStyle = o.bg || '#1c222b';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, bar, c.height);
      ctx.fillStyle = o.fg || '#e6e0d4';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bar + padX, c.height / 2 + fs * 0.04);
      const tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = 4;
      return { tex, aspect: c.width / c.height };
    }
    function sign(parent, text, accent, h, x, y, z, ry, o) {
      const { tex, aspect } = textTexture(text, accent, o);
      const m = new T.Mesh(new T.PlaneGeometry(h * aspect, h), new T.MeshBasicMaterial({ map: tex }));
      m.position.set(x, y, z);
      m.rotation.y = ry || 0;
      parent.add(m);
      return m;
    }

    /* ------------------------------------------------------------------
       Lights
       ------------------------------------------------------------------ */
    const hemi = new T.HemisphereLight(new T.Color('#cfe0ff'), new T.Color('#8a7a58'), 1.15);
    scene.add(hemi);
    const sun = new T.DirectionalLight(new T.Color('#ffe1b8'), 2.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -105; sc.right = 105; sc.top = 105; sc.bottom = -105; sc.near = 1; sc.far = 460;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
    scene.add(sun);
    scene.add(sun.target);

    /* ------------------------------------------------------------------
       Sky dome
       ------------------------------------------------------------------ */
    const skyMat = new T.ShaderMaterial({
      uniforms: {
        top: { value: new T.Color(PAL.skyTop) },
        horizon: { value: new T.Color(PAL.skyHorizon) },
        bottom: { value: new T.Color(PAL.skyBottom) },
        sunColor: { value: new T.Color(PAL.sun) },
        sunDir: { value: sunDir.clone() }
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunColor; uniform vec3 sunDir;',
        'varying vec3 vDir;',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  float h = d.y;',
        '  vec3 col = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.6));',
        '  col = mix(col, bottom, smoothstep(0.0, -0.2, h));',
        '  float s = max(dot(d, normalize(sunDir)), 0.0);',
        '  col += sunColor * (pow(s, 900.0) * 7.0 + pow(s, 24.0) * 0.32 + pow(s, 4.0) * 0.14);',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n'),
      side: T.BackSide,
      depthWrite: false,
      fog: false
    });
    const sky = new T.Mesh(new T.SphereGeometry(4000, 32, 16), skyMat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);

    /* ------------------------------------------------------------------
       Terrain
       ------------------------------------------------------------------ */
    function groundHeight(x, z) {
      const r = Math.hypot(x, z);
      if (r < 330) return 0;
      const t = smoothstep(330, 640, r);
      const n = 0.55 + 0.25 * Math.sin(x * 0.012 + 1.3) * Math.cos(z * 0.010 - 0.7) + 0.2 * Math.sin((x + z) * 0.021);
      return t * (12 + 48 * n);
    }
    (function buildGround() {
      const geo = new T.PlaneGeometry(2800, 2800, 190, 190);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      const col = new Float32Array(pos.count * 3);
      const cA = new T.Color('#8fb468'), cB = new T.Color('#a9c47c'), cC = new T.Color('#759a55'), cD = new T.Color('#b7ad7c');
      const tmp = new T.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, groundHeight(x, z));
        const n1 = 0.5 + 0.5 * Math.sin(x * 0.031 + Math.cos(z * 0.027) * 1.7);
        const n2 = 0.5 + 0.5 * Math.sin(z * 0.045 - x * 0.013);
        tmp.copy(cA).lerp(cB, n1 * 0.8).lerp(cC, n2 * 0.45);
        const r = Math.hypot(x, z);
        tmp.lerp(cD, smoothstep(300, 700, r) * 0.55);
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      }
      geo.setAttribute('color', new T.BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const ground = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
      ground.receiveShadow = true;
      scene.add(ground);
    })();

    // Distant mountains (Mt. Erciyes + range)
    (function buildMountains() {
      const haze = new T.Color(PAL.fog);
      function peak(x, z, r, h, seed, snowLine, hazeAmt) {
        const rnd = mulberry32(seed);
        const phase = rnd() * 10;
        // Custom polar grid (ConeGeometry with heightSegments > 1 drops faces in r169).
        // Vertex positions are deterministic, so shared edges stay watertight.
        const NS = 36, NR = 9;
        const P = (i, j) => {
          const a = (i % NS) / NS * TAU, t = j / NR;
          const k = 1 + (0.09 * Math.sin(a * 5 + phase) + 0.05 * Math.sin(a * 11 + phase * 2)) * t;
          const jag = j > 0 && j < NR ? (Math.sin(a * 13 + j * 2.1 + phase) * 0.025) : 0;
          const rr = r * t * k;
          return [rr * Math.sin(a), h / 2 - t * h + jag * h, rr * Math.cos(a)];
        };
        const verts = [];
        for (let i = 0; i < NS; i++) {
          for (let j = 0; j < NR; j++) {
            const a = P(i, j), b = P(i, j + 1), c2 = P(i + 1, j + 1), d = P(i + 1, j);
            if (j > 0) verts.push(...a, ...b, ...d);
            verts.push(...b, ...c2, ...d);
          }
        }
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
        geo.computeVertexNormals(); // non-indexed → per-face normals (low-poly look)
        const pos = geo.attributes.position;
        const col = new Float32Array(pos.count * 3);
        const rock = new T.Color('#8291ad'), snow = new T.Color('#f3f6fb'), tmp = new T.Color();
        for (let f = 0; f < pos.count; f += 3) {
          let cy = 0, ca = 0;
          for (let j = 0; j < 3; j++) { cy += pos.getY(f + j); ca += Math.atan2(pos.getZ(f + j), pos.getX(f + j)); }
          const hn = (cy / 3 + h / 2) / h;
          const sl = snowLine + 0.06 * Math.sin((ca / 3) * 7 + phase);
          tmp.copy(rock).lerp(snow, snowLine < 1 ? smoothstep(sl - 0.03, sl + 0.03, hn) : 0);
          tmp.lerp(haze, hazeAmt);
          for (let j = 0; j < 3; j++) { col[(f + j) * 3] = tmp.r; col[(f + j) * 3 + 1] = tmp.g; col[(f + j) * 3 + 2] = tmp.b; }
        }
        geo.setAttribute('color', new T.BufferAttribute(col, 3));
        const m = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true, fog: false }));
        m.position.set(x, h / 2 - 25, z);
        scene.add(m);
      }
      peak(-700, -1900, 600, 430, 11, 0.58, 0.34); // Erciyes
      peak(-260, -1950, 330, 200, 12, 0.85, 0.46);
      peak(-1500, -1500, 480, 200, 13, 2, 0.55);
      peak(900, -1800, 560, 180, 14, 2, 0.6);
      peak(1850, -500, 640, 170, 15, 2, 0.62);
      peak(1500, 1300, 560, 150, 16, 2, 0.64);
      peak(-1800, 800, 600, 170, 17, 2, 0.62);
      peak(-400, 1950, 640, 160, 18, 2, 0.64);
    })();

    // Clouds
    const clouds = [];
    (function buildClouds() {
      const rnd = mulberry32(99);
      const mat = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, emissive: new T.Color('#ffe8d0'), emissiveIntensity: 0.35 });
      const geo = new T.IcosahedronGeometry(1, 1);
      for (let i = 0; i < 18; i++) {
        const g = new T.Group();
        const n = 4 + Math.floor(rnd() * 4);
        for (let j = 0; j < n; j++) {
          const m = new T.Mesh(geo, mat);
          const s = 7 + rnd() * 9;
          m.scale.set(s * 1.4, s * 0.7, s);
          m.position.set((j - n / 2) * 9 + rnd() * 5, rnd() * 4, rnd() * 10 - 5);
          g.add(m);
        }
        const a = rnd() * TAU, r = 120 + rnd() * 520;
        g.position.set(Math.cos(a) * r, 95 + rnd() * 70, Math.sin(a) * r);
        g.userData.speed = 1 + rnd() * 1.5;
        scene.add(g);
        clouds.push(g);
      }
    })();

    /* ------------------------------------------------------------------
       Drone factory (F450 look: red front arms, white rear, orange FC)
       ------------------------------------------------------------------ */
    function makeDrone(o) {
      o = o || {};
      const g = new T.Group();
      const H = o.holo || null;
      const M = (m) => H || m;
      const frontMat = M(std(o.front || '#c62f2b', { roughness: 0.55 }));
      const backMat = M(std(o.back || '#f2f0ea', { roughness: 0.55 }));
      const darkMat = M(std('#1e2127', { roughness: 0.5, metalness: 0.25 }));
      const carbonMat = M(std('#2b2f36', { roughness: 0.3, metalness: 0.4 }));
      const fcMat = M(std(o.fc || '#f26a1b', { roughness: 0.45 }));
      const propA = M(std(o.prop || '#f4f3ef', { roughness: 0.5 }));
      const propB = M(std(o.propB || o.prop || '#f4f3ef', { roughness: 0.5 }));
      const brass = M(MAT.gold);
      const plate = new T.CylinderGeometry(0.42, 0.42, 0.04, 6);
      addMesh(g, plate, darkMat, 0, 0, 0);
      addMesh(g, plate, darkMat, 0, 0.17, 0);
      addMesh(g, new T.CylinderGeometry(0.52, 0.52, 0.03, 6), carbonMat, 0, 0.45, 0);
      const so = new T.CylinderGeometry(0.015, 0.015, 0.28, 5);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2;
        addMesh(g, so, brass, Math.cos(a) * 0.3, 0.31, Math.sin(a) * 0.3, true);
      }
      addMesh(g, new T.BoxGeometry(0.32, 0.18, 0.26), fcMat, 0, 0.27, 0.02);
      addMesh(g, new T.CylinderGeometry(0.15, 0.15, 0.06, 20), darkMat, -0.1, 0.49, 0.12);
      addMesh(g, new T.BoxGeometry(0.24, 0.13, 0.52), M(std('#30353c')), 0, -0.1, 0.02);
      addMesh(g, new T.BoxGeometry(0.02, 0.02, 0.32), darkMat, -0.22, 0.05, 0.5, true); // antenna
      const props = [];
      const L = 0.95;
      const dirs = [[1, -1], [-1, -1], [-1, 1], [1, 1]];
      const armGeo = new T.BoxGeometry(0.1, 0.055, L);
      const motorGeo = new T.CylinderGeometry(0.075, 0.08, 0.13, 14);
      const legGeo = new T.BoxGeometry(0.035, 0.36, 0.06);
      const bladeGeo = new T.BoxGeometry(0.66, 0.012, 0.07);
      const hubGeo = new T.CylinderGeometry(0.03, 0.03, 0.05, 8);
      const discGeo = new T.CircleGeometry(0.34, 28);
      dirs.forEach((d, i) => {
        const dx = d[0] / Math.SQRT2, dz = d[1] / Math.SQRT2;
        const front = dz < 0;
        const arm = addMesh(g, armGeo, front ? frontMat : backMat, dx * L / 2, 0.08, dz * L / 2);
        arm.rotation.y = Math.atan2(dx, dz);
        addMesh(g, motorGeo, darkMat, dx * L, 0.17, dz * L);
        addMesh(g, legGeo, front ? frontMat : backMat, dx * 0.55, -0.12, dz * 0.55);
        const pg = new T.Group();
        pg.position.set(dx * L, 0.25, dz * L);
        g.add(pg);
        const blades = addMesh(pg, bladeGeo, front ? propA : propB, 0, 0, 0, true);
        addMesh(pg, hubGeo, darkMat, 0, 0, 0, true);
        const disc = new T.Mesh(discGeo, new T.MeshBasicMaterial({ color: '#f7f2ea', transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
        disc.rotation.x = -Math.PI / 2;
        pg.add(disc);
        props.push({ g: pg, blades, disc, dir: (i % 2 === 0) ? 1 : -1, angle: i * 1.3 });
      });
      const ledGeo = new T.SphereGeometry(0.05, 8, 6);
      const ledL = new T.Mesh(ledGeo, glow('#ff3b30', 5)); ledL.position.set(-L / Math.SQRT2, 0.06, -L / Math.SQRT2); g.add(ledL);
      const ledR = new T.Mesh(ledGeo, glow('#2dff6e', 5)); ledR.position.set(L / Math.SQRT2, 0.06, -L / Math.SQRT2); g.add(ledR);
      const strobe = new T.Mesh(ledGeo, glow('#ffffff', 6)); strobe.position.set(0, 0.04, 0.42); g.add(strobe);
      function spin(rate, dt, t) {
        for (const p of props) {
          p.angle += p.dir * rate * dt;
          p.g.rotation.y = p.angle;
          if (!H) {
            const k = clamp((rate - 16) / 40, 0, 1);
            p.blades.visible = k < 0.6;
            p.disc.material.opacity = k * 0.2;
          }
        }
        if (t != null) strobe.visible = (t % 1.2) < 0.08;
      }
      return { group: g, props, spin };
    }

    // tilt an object like a multirotor from its (world) acceleration
    function orientLikeQuad(obj, ax, az, yaw, maxTilt) {
      const aF = -ax * Math.sin(yaw) - az * Math.cos(yaw);
      const aR = ax * Math.cos(yaw) - az * Math.sin(yaw);
      const mt = maxTilt || 0.6;
      obj.rotation.set(clamp(-Math.atan(aF / G), -mt, mt), yaw, clamp(-Math.atan(aR / G), -mt, mt), 'YXZ');
    }

    /* ------------------------------------------------------------------
       BUILDINGS: each returns { group, padOffset, height, clear, update }
       Local frame: front faces +z (towards the plaza).
       ------------------------------------------------------------------ */
    const ringState = { passed: new Set(), start: 0, done: false, doneAt: 0 };

    function windsock(parent, x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
      cyl(g, 0.07, 0.09, 6.5, MAT.metal, 0, 0, 0, 6);
      const sock = new T.Group(); sock.position.y = 6.2; g.add(sock);
      const orange = std('#ff6a2a', { roughness: 0.7, side: T.DoubleSide }), white = std('#f6f2ea', { roughness: 0.7, side: T.DoubleSide });
      for (let i = 0; i < 4; i++) {
        const seg = new T.Mesh(new T.CylinderGeometry(0.42 - i * 0.07, 0.35 - i * 0.07, 0.6, 12, 1, true), i % 2 ? white : orange);
        seg.rotation.z = Math.PI / 2;
        seg.position.x = 0.35 + i * 0.6;
        seg.castShadow = true;
        sock.add(seg);
      }
      return (t) => { sock.rotation.y = 0.6 + Math.sin(t * 0.7) * 0.25; sock.rotation.z = -0.08 + Math.sin(t * 2.3) * 0.05; };
    }

    /* ---------- Control tower (About) ---------- */
    function bTower(z) {
      const g = new T.Group();
      const A = std(z.accent, { roughness: 0.5 }), AG = glow(z.accent, 2.6);
      box(g, 18, 7, 12, MAT.wall, 0, 0, 0, true);
      box(g, 18.8, 0.6, 12.8, MAT.trim, 0, 7, 0);
      addWindows(g, { w: 15, h: 3.6, cols: 7, rows: 2, y: 0.9, z: 6.03, seed: 3, lit: 0.45 });
      addWindows(g, { w: 15, h: 3.6, cols: 7, rows: 2, y: 0.9, z: -6.03, ry: Math.PI, seed: 4 });
      sign(g, 'CONTROL TOWER  ·  ABOUT ME', z.accent, 1.15, 0, 5.6, 6.06, 0);
      box(g, 7, 0.35, 3.2, MAT.trim, 0, 3.3, 7.4);
      box(g, 7, 0.1, 0.1, AG, 0, 3.27, 9.0);
      cyl(g, 2.9, 3.3, 26, MAT.wall, 0, 7, -1.5, 20, true);
      for (let i = 0; i < 3; i++) cyl(g, 3.34, 3.34, 0.45, A, 0, 11 + i * 6.5, -1.5, 20);
      box(g, 0.9, 19, 0.3, MAT.glass, 0, 9, 1.55);
      cyl(g, 3.6, 3.0, 1.4, MAT.trim, 0, 33, -1.5, 8);
      cyl(g, 5.2, 4.5, 4.4, MAT.glass, 0, 34.4, -1.5, 8, true);
      cyl(g, 5.8, 5.8, 0.5, MAT.trim, 0, 38.8, -1.5, 8);
      cyl(g, 5.86, 5.86, 0.14, AG, 0, 38.7, -1.5, 8);
      const radar = new T.Group(); radar.position.set(0, 39.3, -1.5); g.add(radar);
      cyl(radar, 0.22, 0.3, 1.8, MAT.metal, 0, 0, 0, 8);
      const dish = new T.Group(); dish.position.y = 2.0; radar.add(dish);
      box(dish, 4.4, 1.0, 0.18, MAT.white, 0, -0.5, 0);
      box(dish, 0.3, 0.3, 1.0, MAT.trim, 0, -0.15, 0.5);
      cyl(g, 0.06, 0.1, 6, MAT.metal, 2.8, 39.3, -2.6, 6);
      const blink = addMesh(g, new T.SphereGeometry(0.22, 10, 8), glow('#ff3030', 5), 2.8, 45.4, -2.6, true);
      const sockUpd = windsock(g, -11, 16);
      return {
        group: g, padOffset: 21, padSide: 15, height: 46, clear: [[0, 0, 17], [15, 21, 9]],
        update(t) { dish.rotation.y = t * 1.4; blink.visible = (t % 1.4) < 0.3; sockUpd(t); }
      };
    }

    /* ---------- Flight Test Hangar (PX4) ---------- */
    function bHangar(z) {
      const g = new T.Group();
      const AG = glow(z.accent, 2.6);
      const R = 13, LEN = 30;
      const shellMat = std('#c5ced8', { roughness: 0.5, metalness: 0.45, side: T.DoubleSide });
      const shellGeo = new T.CylinderGeometry(R, R, LEN, 36, 1, true, -Math.PI / 2, Math.PI);
      shellGeo.rotateX(-Math.PI / 2);
      addMesh(g, shellGeo, shellMat, 0, 0, 0);
      const ribGeo = new T.TorusGeometry(R + 0.12, 0.17, 6, 36, Math.PI);
      for (let k = 0; k <= 6; k++) addMesh(g, ribGeo, MAT.trim, 0, 0, -LEN / 2 + k * (LEN / 6));
      const s = new T.Shape();
      s.moveTo(-R, 0); s.lineTo(-8, 0); s.lineTo(-8, 9); s.lineTo(8, 9); s.lineTo(8, 0); s.lineTo(R, 0);
      s.absarc(0, 0, R, 0, Math.PI, false);
      addMesh(g, new T.ShapeGeometry(s, 24), MAT.wallDS, 0, 0, LEN / 2);
      const back = addMesh(g, new T.CircleGeometry(R, 36, 0, Math.PI), MAT.wallDS, 0, 0, -LEN / 2);
      back.rotation.y = Math.PI;
      addMesh(g, new T.PlaneGeometry(2 * R - 0.4, LEN - 0.4).rotateX(-Math.PI / 2), std('#3a3f47', { roughness: 0.9 }), 0, 0.04, 0, true);
      box(g, 0.32, 9.3, 0.32, AG, -8.16, 0, LEN / 2 + 0.12);
      box(g, 0.32, 9.3, 0.32, AG, 8.16, 0, LEN / 2 + 0.12);
      box(g, 16.6, 0.32, 0.32, AG, 0, 9.0, LEN / 2 + 0.12);
      sign(g, 'FLIGHT TEST HANGAR', z.accent, 1.25, 0, 10.55, LEN / 2 + 0.06, 0);
      // museum drone inside
      box(g, 6.5, 0.9, 6.5, MAT.trim, 0, 0, 4);
      box(g, 6.7, 0.12, 6.7, AG, 0, 0.85, 4);
      const museum = makeDrone();
      museum.group.scale.setScalar(3.1);
      museum.group.position.set(0, 2.25, 4);
      museum.group.rotation.y = Math.PI * 0.75;
      g.add(museum.group);
      for (let i = 0; i < 3; i++) box(g, 0.25, 0.12, 20, glow('#fff2d8', 1.6), -5 + i * 5, 11.2 - Math.abs(i - 1) * 1.4, -2);
      // annex
      box(g, 6, 4.5, 9, MAT.wall, 16.5, 0, 6, true);
      box(g, 6.5, 0.4, 9.5, MAT.trim, 16.5, 4.5, 6);
      addWindows(g, { w: 7, h: 2, cols: 4, rows: 1, x: 16.5 + 3.02, y: 1.6, z: 6, ry: Math.PI / 2, seed: 21, lit: 0.6 });
      cyl(g, 0.05, 0.08, 5, MAT.metal, 18, 4.9, 3.5, 6);
      solidBox(g, 26, 13, LEN, 0, 0, 0);
      const sockUpd = windsock(g, -18, 12);
      // hologram: lemniscate reference + ghost drone tracking it
      const holo = new T.Group(); holo.position.y = 25; g.add(holo);
      const pts = [];
      for (let i = 0; i < 240; i++) {
        const t = i / 240 * TAU;
        pts.push(new V3(15 * Math.sin(t), 1.6 * Math.sin(t), 16 * Math.sin(t) * Math.cos(t)));
      }
      const curve = new T.CatmullRomCurve3(pts, true);
      const tube = new T.Mesh(new T.TubeGeometry(curve, 480, 0.1, 6, true), AG);
      holo.add(tube);
      const halo = new T.Mesh(new T.TubeGeometry(curve, 240, 0.42, 8, true), new T.MeshBasicMaterial({ color: new T.Color(z.accent), transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false }));
      holo.add(halo);
      const holoMat = new T.MeshBasicMaterial({ color: new T.Color(z.accent).multiplyScalar(1.5), transparent: true, opacity: 0.8 });
      const ghost = makeDrone({ holo: holoMat });
      ghost.group.scale.setScalar(1.6);
      holo.add(ghost.group);
      const beamMat = new T.MeshBasicMaterial({ color: new T.Color(z.accent), transparent: true, opacity: 0.1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
      const beam = new T.Mesh(new T.CylinderGeometry(1.0, 3.8, 11.5, 20, 1, true), beamMat);
      beam.position.y = 13 + 11.5 / 2 - 0.2;
      g.add(beam);
      const clen = curve.getLength();
      const pA = new V3(), pB = new V3(), pC = new V3();
      return {
        group: g, padOffset: 28, height: 30, clear: [[0, 0, 24], [16, 6, 9], [0, 28, 10]],
        update(t, dt) {
          const sp = 9 / clen; // ~9 m/s
          const u = (t * sp) % 1, du = 0.002;
          curve.getPointAt((u - du + 1) % 1, pA); curve.getPointAt(u, pB); curve.getPointAt((u + du) % 1, pC);
          const dtu = du / sp;
          const off = 0.35 * Math.sin(t * 2.1);
          ghost.group.position.copy(pB).add(new V3(off, 0.15 * Math.sin(t * 3.1), -off * 0.5));
          const vx = (pC.x - pA.x) / (2 * dtu), vz = (pC.z - pA.z) / (2 * dtu);
          const ax = (pC.x - 2 * pB.x + pA.x) / (dtu * dtu), az = (pC.z - 2 * pB.z + pA.z) / (dtu * dtu);
          orientLikeQuad(ghost.group, ax, az, Math.atan2(-vx, -vz), 0.7);
          ghost.spin(60, dt);
          museum.spin(3, dt);
          halo.material.opacity = 0.1 + 0.04 * Math.sin(t * 2);
          sockUpd(t);
        }
      };
    }

    /* ---------- CMPC research tower ---------- */
    function bResearchTower(z) {
      const g = new T.Group();
      const A = std(z.accent, { roughness: 0.45 }), AG = glow(z.accent, 2.8);
      box(g, 16, 10, 16, MAT.wall, 0, 0, 0, true);
      box(g, 16.6, 0.5, 16.6, MAT.trim, 0, 10, 0);
      windows4(g, 16, 16, { h: 7, cols: 6, rows: 3, y: 1.4, seed: 31, inset: 2.5 });
      box(g, 5, 0.3, 2.6, MAT.trim, 0, 4.2, 9.2);
      box(g, 5, 0.1, 0.1, AG, 0, 4.18, 10.5);
      const glassT = std('#7aa2c6', { roughness: 0.1, metalness: 0.65, emissive: new T.Color('#24405e'), emissiveIntensity: 0.6 });
      box(g, 12, 18, 12, glassT, 0, 10.5, 0, true);
      for (let i = 1; i < 6; i++) box(g, 12.25, 0.22, 12.25, MAT.trim, 0, 10.5 + i * 3, 0);
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach((c) => box(g, 0.4, 18, 0.4, A, c[0] * 6.1, 10.5, c[1] * 6.1));
      box(g, 12.8, 0.5, 12.8, MAT.trim, 0, 28.5, 0);
      box(g, 9, 11, 9, MAT.wall, 0, 29, 0, true);
      windows4(g, 9, 9, { h: 8.5, cols: 4, rows: 3, y: 30.3, seed: 35, inset: 1.5 });
      box(g, 9.6, 0.6, 9.6, MAT.trim, 0, 40, 0);
      sign(g, 'CMPC RESEARCH', z.accent, 1.1, 0, 6.6, 8.06, 0);
      // crown: signal bars + sliding convolution kernel
      const N = 30, Rc = 3.7, win = 7;
      const barGeo = new T.BoxGeometry(0.42, 1, 0.42); barGeo.translate(0, 0.5, 0);
      const barMat = std('#e3e7ec', { roughness: 0.4 });
      const bars = [];
      for (let i = 0; i < N; i++) {
        const b = i / N * TAU;
        const m = addMesh(g, barGeo, barMat, Rc * Math.cos(b), 40.6, -Rc * Math.sin(b));
        m.userData.b = b;
        bars.push(m);
      }
      const kernel = new T.Group(); kernel.position.y = 40.62; g.add(kernel);
      const arc = new T.Mesh(new T.TorusGeometry(Rc, 0.1, 6, 24, TAU * win / N), AG);
      arc.rotation.x = -Math.PI / 2;
      kernel.add(arc);
      const arc2 = arc.clone(); arc2.position.y = 3.2; kernel.add(arc2);
      cyl(g, 0.14, 0.2, 5, MAT.metal, 0, 40.6, 0, 6);
      const tip = addMesh(g, new T.SphereGeometry(0.3, 10, 8), AG, 0, 45.8, 0, true);
      return {
        group: g, padOffset: 20, height: 47, clear: [[0, 0, 15]],
        update(t) {
          const psi = (t * 0.55) % TAU;
          kernel.rotation.y = psi;
          for (const m of bars) {
            const b = m.userData.b;
            let h = 1.3 + 1.0 * Math.sin(b * 3 + t * 1.3) + 0.55 * Math.sin(b * 7 - t * 2.1);
            const rel = (b - psi + TAU * 2) % TAU;
            const inK = rel <= TAU * win / N;
            if (inK) h *= 1.35;
            m.scale.y = Math.max(0.25, h);
            m.material = inK ? AG : barMat;
          }
          tip.scale.setScalar(1 + 0.25 * Math.sin(t * 3));
        }
      };
    }

    /* ---------- Aerobatics arena (min-snap rings) ---------- */
    let arenaRings = [];
    function bArena(z) {
      const g = new T.Group();
      const A = std(z.accent, { roughness: 0.5 }), AG = glow(z.accent, 2.6);
      // turf
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const x = c.getContext('2d');
      for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#69a347' : '#5e9840'; x.fillRect(i * 32, 0, 32, 512); }
      x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 6;
      x.beginPath(); x.arc(256, 256, 70, 0, TAU); x.stroke();
      x.beginPath(); x.arc(256, 256, 230, 0, TAU); x.stroke();
      x.lineWidth = 10; x.beginPath(); x.moveTo(226, 226); x.lineTo(226, 286); x.moveTo(286, 226); x.lineTo(286, 286); x.moveTo(226, 256); x.lineTo(286, 256); x.stroke();
      const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
      const turf = addMesh(g, new T.CircleGeometry(30, 64).rotateX(-Math.PI / 2), std('#ffffff', { map: tex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 0, 0.03, 0, true);
      turf.receiveShadow = true;
      const N = 28;
      const seatMat = std('#3c4452', { roughness: 0.7 });
      for (let k = 0; k < N; k++) {
        const a = k / N * TAU;
        if (Math.abs(wrapAngle(a)) < 0.15) continue;
        const w1 = box(g, 7.1, 3.0, 1.0, MAT.wall, Math.sin(a) * 31, 0, Math.cos(a) * 31, true); w1.rotation.y = a;
        const w2 = box(g, 7.7, 5.2, 2.6, seatMat, Math.sin(a) * 33.2, 0, Math.cos(a) * 33.2, true); w2.rotation.y = a;
        const w3 = box(g, 7.75, 0.3, 2.65, A, Math.sin(a) * 33.2, 5.2, Math.cos(a) * 33.2); w3.rotation.y = a;
      }
      // gate
      box(g, 1.4, 9, 1.4, MAT.trim, -4.6, 0, 31.5, true);
      box(g, 1.4, 9, 1.4, MAT.trim, 4.6, 0, 31.5, true);
      box(g, 10.6, 1.4, 1.4, MAT.trim, 0, 9, 31.5);
      sign(g, 'AEROBATICS ARENA', z.accent, 1.1, 0, 9.7, 32.25, 0);
      // light towers
      [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4].forEach((a) => {
        const px = Math.sin(a) * 37.5, pz = Math.cos(a) * 37.5;
        cyl(g, 0.35, 0.55, 20, MAT.metal, px, 0, pz, 8, true);
        const head = new T.Group(); head.position.set(px, 20.5, pz); head.rotation.y = a + Math.PI; g.add(head);
        box(head, 3.4, 1.8, 0.7, MAT.trim, 0, 0, 0);
        box(head, 3.0, 1.4, 0.1, glow('#fff4dc', 2.2), 0, 0.2, 0.4);
      });
      // rings on a smooth closed path
      const ringPts = [];
      const NR = 7;
      for (let i = 0; i < NR; i++) {
        const a = i / NR * TAU;
        const rr = 17 + 5 * Math.sin(2 * a + 0.6);
        ringPts.push(new V3(rr * Math.sin(a), 10 + 4.5 * Math.sin(a * 2 + 1.1) + 2 * Math.cos(3 * a), rr * Math.cos(a)));
      }
      const curve = new T.CatmullRomCurve3(ringPts, true, 'centripetal');
      const ringGeo = new T.TorusGeometry(3.3, 0.28, 10, 44);
      arenaRings = ringPts.map((p, i) => {
        const m = new T.Mesh(ringGeo, glow(z.accent, 2.6));
        m.position.copy(p);
        const tan = curve.getTangent(i / NR);
        m.quaternion.setFromUnitVectors(new V3(0, 0, 1), tan);
        g.add(m);
        return { mesh: m, c: new V3(), n: new V3(), ready: false };
      });
      const linePts = curve.getSpacedPoints(400);
      const line = new T.Line(new T.BufferGeometry().setFromPoints(linePts), new T.LineDashedMaterial({ color: new T.Color(z.accent).multiplyScalar(1.4), dashSize: 1.4, gapSize: 1.0, transparent: true, opacity: 0.9 }));
      line.computeLineDistances();
      g.add(line);
      const tmp = new V3();
      return {
        group: g, padOffset: 42, height: 22, clear: [[0, 0, 41], [0, 42, 9]],
        update(t, dt, dp) {
          for (let i = 0; i < arenaRings.length; i++) {
            const r = arenaRings[i];
            if (!r.ready) { r.mesh.getWorldPosition(r.c); r.mesh.getWorldDirection(r.n); r.ready = true; }
            const passed = ringState.passed.has(i);
            r.mesh.rotation.z += dt * (passed ? 0.2 : 0.8);
            if (!passed && dp && !ringState.done) {
              tmp.copy(dp).sub(r.c);
              const along = tmp.dot(r.n);
              const radial = tmp.addScaledVector(r.n, -along).length();
              if (Math.abs(along) < 1.3 && radial < 3.1) {
                ringState.passed.add(i);
                if (ringState.passed.size === 1) ringState.start = t;
                r.mesh.material = glow('#7dffb0', 2.8);
                emit('ring', { count: ringState.passed.size, total: arenaRings.length });
                if (ringState.passed.size === arenaRings.length) {
                  ringState.done = true; ringState.doneAt = t;
                  emit('ringsComplete', { time: t - ringState.start });
                }
              }
            }
          }
          if (ringState.done && t - ringState.doneAt > 10) {
            ringState.done = false; ringState.passed.clear();
            arenaRings.forEach((r) => { r.mesh.material = glow(z.accent, 2.6); });
          }
        }
      };
    }

    /* ---------- Sensor-fusion lab (IMU) ---------- */
    function bSensorLab(z) {
      const g = new T.Group();
      const A = std(z.accent, { roughness: 0.5 }), AG = glow(z.accent, 2.6);
      box(g, 18, 8, 14, MAT.wallCool, 0, 0, 0, true);
      box(g, 18.6, 0.5, 14.6, MAT.trim, 0, 8, 0);
      box(g, 18.1, 0.55, 14.1, A, 0, 3.6, 0);
      addWindows(g, { w: 15, h: 3.2, cols: 6, rows: 1, y: 4.4, z: 7.03, seed: 41, lit: 0.6 });
      addWindows(g, { w: 15, h: 3.2, cols: 6, rows: 1, y: 4.4, z: -7.03, ry: Math.PI, seed: 42 });
      addWindows(g, { w: 11, h: 3.2, cols: 4, rows: 1, y: 4.4, x: 9.03, ry: Math.PI / 2, seed: 43 });
      addWindows(g, { w: 11, h: 3.2, cols: 4, rows: 1, y: 4.4, x: -9.03, ry: -Math.PI / 2, seed: 44 });
      box(g, 3, 3.1, 0.25, MAT.glass, 0, 0, 7.05);
      box(g, 3.4, 0.12, 0.12, AG, 0, 3.15, 7.2);
      sign(g, 'SENSOR FUSION LAB', z.accent, 1.0, -4.5, 9.35, 6.2, 0);
      box(g, 9.5, 0.15, 0.15, MAT.metal, -4.5, 8.5, 6.15);
      // roof sculpture: IMU board + filtered/raw axis triads
      cyl(g, 0.2, 0.35, 4.6, MAT.metal, 0, 8.5, -1, 8);
      const imu = new T.Group(); imu.position.set(0, 15, -1); g.add(imu);
      box(imu, 5, 0.3, 3.6, std('#1d7a4a', { roughness: 0.5 }), 0, -0.15, 0);
      box(imu, 1.3, 0.35, 1.3, MAT.dark, 0.6, 0.15, 0.2);
      box(imu, 4.2, 0.25, 0.25, MAT.gold, 0, 0.15, -1.55);
      box(imu, 1.0, 0.3, 0.7, std('#c7ccd2', { metalness: 0.6, roughness: 0.3 }), -1.6, 0.15, 0.6);
      function triad(parent, k, opacity) {
        const grp = new T.Group(); parent.add(grp);
        const mk = (col, rot, pos) => {
          const mat = opacity < 1 ? new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(1.6), transparent: true, opacity }) : glow(col, 2.2);
          const shaft = new T.Mesh(new T.CylinderGeometry(0.09 * k, 0.09 * k, 3.4, 8), mat);
          const head = new T.Mesh(new T.ConeGeometry(0.3 * k, 0.8, 12), mat);
          const a = new T.Group(); a.add(shaft); shaft.position.y = 1.7; a.add(head); head.position.y = 3.8;
          a.rotation.set(rot[0], rot[1], rot[2]); grp.add(a);
        };
        mk('#ff4b4b', [0, 0, -Math.PI / 2]);   // X
        mk('#4bff7a', [-Math.PI / 2, 0, 0]);   // Y (into -z)
        mk('#4ba3ff', [0, 0, 0]);              // Z (up)
        return grp;
      }
      const filtered = triad(imu, 1, 1);
      const raw = triad(imu, 0.7, 0.35);
      const qT = new T.Quaternion(), qR = new T.Quaternion(), e = new T.Euler();
      // UDP wave arcs
      cyl(g, 0.08, 0.1, 4, MAT.metal, 7.2, 8.5, -5, 6);
      const waves = [];
      for (let i = 0; i < 3; i++) {
        const w = new T.Mesh(new T.TorusGeometry(1, 0.07, 6, 20, Math.PI / 2), new T.MeshBasicMaterial({ color: new T.Color(z.accent).multiplyScalar(2), transparent: true, opacity: 0.8 }));
        w.position.set(7.2, 12.6, -5);
        w.rotation.set(0, Math.PI / 2, Math.PI / 4);
        g.add(w); waves.push(w);
      }
      return {
        group: g, padOffset: 18, height: 21, clear: [[0, 0, 14]],
        update(t, dt) {
          e.set(Math.sin(t * 0.7) * 0.55, t * 0.35, Math.cos(t * 0.9) * 0.45);
          qT.setFromEuler(e);
          filtered.quaternion.slerp(qT, 1 - Math.exp(-4 * dt));
          e.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25);
          qR.setFromEuler(e).premultiply(qT);
          raw.quaternion.copy(qR);
          imu.position.y = 15 + Math.sin(t * 1.2) * 0.3;
          waves.forEach((w, i) => {
            const ph = ((t * 0.8 + i / 3) % 1);
            w.scale.setScalar(0.6 + ph * 2.4);
            w.material.opacity = 0.9 * (1 - ph);
          });
        }
      };
    }

    /* ---------- LiDAR station ---------- */
    function bLidar(z) {
      const g = new T.Group();
      const AG = glow(z.accent, 3);
      // scan display floor
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const x = c.getContext('2d');
      x.fillStyle = '#141a23'; x.fillRect(0, 0, 512, 512);
      x.strokeStyle = 'rgba(120,200,255,0.22)'; x.lineWidth = 2;
      for (let r = 40; r < 256; r += 40) { x.beginPath(); x.arc(256, 256, r, 0, TAU); x.stroke(); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.beginPath(); x.moveTo(256, 256); x.lineTo(256 + Math.cos(a) * 256, 256 + Math.sin(a) * 256); x.stroke(); }
      const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
      addMesh(g, new T.CircleGeometry(25, 64).rotateX(-Math.PI / 2), std('#ffffff', { map: tex, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 0, 0.04, 0, true);
      addMesh(g, new T.RingGeometry(25, 25.6, 64).rotateX(-Math.PI / 2), glow(z.accent, 1.6), 0, 0.06, 0, true);
      cyl(g, 8.5, 8.5, 7, MAT.wallCool, 0, 0, 0, 28, true);
      cyl(g, 8.62, 8.62, 1.4, MAT.glass, 0, 3.2, 0, 28);
      cyl(g, 9.2, 9.2, 0.5, MAT.trim, 0, 7, 0, 28);
      cyl(g, 1.8, 2.4, 5.5, MAT.wall, 0, 7.5, 0, 14, true);
      box(g, 5.2, 1.0, 6.4, MAT.dark, 0, 13, 0.6);
      sign(g, 'LIDAR STATION', z.accent, 1.0, 0, 5.4, 8.62, 0);
      const head = new T.Group(); head.position.set(0, 14, 0); g.add(head);
      cyl(head, 2.2, 2.2, 1.3, MAT.dark, 0, 0, 0, 28);
      box(head, 0.3, 0.5, 1.6, AG, 2.15, 0.4, 0);
      const beamGeo = new T.CircleGeometry(80, 1, -0.03, 0.06).rotateX(-Math.PI / 2);
      const beam = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color: new T.Color(z.accent).multiplyScalar(1.6), transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
      beam.position.y = 0.65;
      head.add(beam);
      // point cloud of a synthetic "room" drawn on the floor display
      const NP = 1100;
      const pos = new Float32Array(NP * 3), colA = new Float32Array(NP * 3), ang = new Float32Array(NP);
      const rnd = mulberry32(5);
      for (let i = 0; i < NP; i++) {
        const a = i / NP * TAU;
        let r = 21 + 2.2 * Math.sin(3 * a + 0.5) + 1.2 * Math.sin(8 * a);
        const sq = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
        r = Math.min(r, 17.5 * sq);
        if ((a > 0.6 && a < 0.95) || (a > 2.4 && a < 2.7) || (a > 4.3 && a < 4.8)) r = 12.5 + Math.sin(a * 30) * 0.4;
        r = Math.min(24, Math.max(10.5, r + (rnd() - 0.5) * 0.35));
        pos[i * 3] = r * Math.cos(a); pos[i * 3 + 1] = 0.25; pos[i * 3 + 2] = -r * Math.sin(a);
        ang[i] = a;
      }
      const pgeo = new T.BufferGeometry();
      pgeo.setAttribute('position', new T.BufferAttribute(pos, 3));
      pgeo.setAttribute('color', new T.BufferAttribute(colA, 3));
      const points = new T.Points(pgeo, new T.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      g.add(points);
      const acc = new T.Color(z.accent);
      return {
        group: g, padOffset: 33, height: 17, clear: [[0, 0, 28], [0, 33, 9]],
        update(t) {
          const psi = (t * 2.4) % TAU;
          head.rotation.y = psi;
          const ca = pgeo.attributes.color.array;
          for (let i = 0; i < NP; i++) {
            const age = (psi - ang[i] + TAU * 2) % TAU;
            const b = 0.08 + 2.4 * Math.exp(-age * 1.1);
            ca[i * 3] = acc.r * b; ca[i * 3 + 1] = acc.g * b; ca[i * 3 + 2] = acc.b * b;
          }
          pgeo.attributes.color.needsUpdate = true;
        }
      };
    }

    /* ---------- Smart house (vacuum robot) ---------- */
    function bHouse(z) {
      const g = new T.Group();
      const A = std(z.accent, { roughness: 0.5 }), AG = glow(z.accent, 2.6);
      box(g, 14, 6, 10, MAT.wallWarm, 0, 0, -4, true);
      // gable roof with the ridge running along x
      addMesh(g, prism(11.2, 4.4, 15.4).rotateY(Math.PI / 2), std('#b5563d', { roughness: 0.8 }), 0, 6, -4);
      solidBox(g, 14, 4, 10, 0, 6, -4);
      box(g, 1.2, 3.2, 1.2, std('#9c4a34'), 4, 7.6, -5.5);
      box(g, 1.8, 3.1, 0.2, MAT.wood, 0, 0, 1.05);
      [-4.2, 4.2].forEach((wx) => {
        box(g, 2.8, 2.2, 0.15, MAT.white, wx, 1.6, 1.04);
        box(g, 2.4, 1.8, 0.18, MAT.winLit, wx, 1.8, 1.06);
      });
      addWindows(g, { w: 8, h: 2, cols: 3, rows: 1, y: 1.8, x: 7.03, z: -4, ry: Math.PI / 2, seed: 51, lit: 0.5 });
      addWindows(g, { w: 8, h: 2, cols: 3, rows: 1, y: 1.8, x: -7.03, z: -4, ry: -Math.PI / 2, seed: 52 });
      // patio with a "dirty floor" canvas that the robot cleans
      const PW = 14, PD = 10, PZ = 7;
      const cv = document.createElement('canvas'); cv.width = 280; cv.height = 200;
      const cx = cv.getContext('2d');
      const rnd = mulberry32(8);
      function dirty() {
        cx.fillStyle = '#b6ab98'; cx.fillRect(0, 0, cv.width, cv.height);
        cx.fillStyle = 'rgba(110,96,74,0.35)';
        for (let i = 0; i < 260; i++) { cx.beginPath(); cx.arc(rnd() * cv.width, rnd() * cv.height, 1 + rnd() * 3.5, 0, TAU); cx.fill(); }
        cx.strokeStyle = 'rgba(80,70,55,0.25)'; cx.lineWidth = 1;
        for (let i = 0; i <= 14; i++) { cx.beginPath(); cx.moveTo(i * 20, 0); cx.lineTo(i * 20, cv.height); cx.stroke(); }
        for (let j = 0; j <= 10; j++) { cx.beginPath(); cx.moveTo(0, j * 20); cx.lineTo(cv.width, j * 20); cx.stroke(); }
      }
      dirty();
      const ptex = new T.CanvasTexture(cv); ptex.colorSpace = T.SRGBColorSpace;
      addMesh(g, new T.PlaneGeometry(PW, PD).rotateX(-Math.PI / 2), std('#ffffff', { map: ptex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 0, 0.05, PZ, true);
      const hedge = std('#4f7f3a', { roughness: 0.95, flatShading: true });
      box(g, 0.9, 0.9, PD, hedge, -PW / 2 - 0.6, 0, PZ);
      box(g, 0.9, 0.9, PD, hedge, PW / 2 + 0.6, 0, PZ);
      const bushGeo = new T.IcosahedronGeometry(1.2, 0);
      [[-8.5, -1], [8.5, -1.5], [-8.6, -7], [8.7, -7.5]].forEach((p) => addMesh(g, bushGeo, hedge, p[0], 1.0, p[1]));
      sign(g, 'SMART HOUSE', z.accent, 0.8, 5.2, 1.6, 12.3, 0);
      cyl(g, 0.07, 0.07, 1.3, MAT.metal, 3.3, 0, 12.25, 6); cyl(g, 0.07, 0.07, 1.3, MAT.metal, 7.1, 0, 12.25, 6);
      // the robot
      const robot = new T.Group(); g.add(robot);
      cyl(robot, 0.85, 0.88, 0.28, std('#2a2f37', { roughness: 0.4, metalness: 0.3 }), 0, 0.05, 0, 28);
      cyl(robot, 0.9, 0.9, 0.06, AG, 0, 0.18, 0, 28);
      cyl(robot, 0.24, 0.26, 0.2, MAT.dark, 0, 0.33, -0.2, 14);
      box(robot, 0.5, 0.06, 0.12, glow('#9cffd1', 3), 0, 0.33, 0.62);
      const wps = [];
      const x0 = -PW / 2 + 1.0, x1 = PW / 2 - 1.0;
      let dir = 1;
      for (let zz = PZ - PD / 2 + 1.0; zz <= PZ + PD / 2 - 0.9; zz += 1.35) {
        wps.push(new V3(dir > 0 ? x0 : x1, 0, zz), new V3(dir > 0 ? x1 : x0, 0, zz));
        dir *= -1;
      }
      const st = { i: 0, pos: wps[0].clone(), yaw: 0, wait: 0, frame: 0 };
      robot.position.copy(st.pos);
      function paint(p) {
        const u = (p.x + PW / 2) / PW * cv.width, v = (p.z - PZ + PD / 2) / PD * cv.height;
        cx.fillStyle = '#ece4d3';
        cx.beginPath(); cx.arc(u, v, 0.86 / PW * cv.width, 0, TAU); cx.fill();
      }
      return {
        group: g, padOffset: 21, height: 12, clear: [[0, -3, 13], [0, 7, 10]],
        update(t, dt) {
          if (st.wait > 0) {
            st.wait -= dt;
            if (st.wait <= 0) { dirty(); ptex.needsUpdate = true; st.i = 0; }
            return;
          }
          const tgt = wps[st.i];
          const dx = tgt.x - st.pos.x, dz = tgt.z - st.pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.05) {
            st.i++;
            if (st.i >= wps.length) { st.wait = 3; st.i = 0; }
            return;
          }
          const want = Math.atan2(dx, dz);
          const err = wrapAngle(want - st.yaw);
          st.yaw += clamp(err, -3 * dt, 3 * dt);
          if (Math.abs(err) < 0.08) {
            const step = Math.min(dist, 2.0 * dt);
            st.pos.x += dx / dist * step; st.pos.z += dz / dist * step;
            paint(st.pos);
            if ((st.frame++ & 1) === 0) ptex.needsUpdate = true;
          }
          robot.position.set(st.pos.x, 0, st.pos.z);
          robot.rotation.y = st.yaw;
        }
      };
    }

    /* ---------- Agricultural farm (Pure Pursuit spraying drone) ---------- */
    function bFarm(z) {
      const g = new T.Group();
      const AG = glow(z.accent, 2.4);
      const red = std('#b4402f', { roughness: 0.8 });
      box(g, 12, 6, 16, red, 0, 0, 0, true);
      const s = new T.Shape();
      s.moveTo(-6.6, 0); s.lineTo(6.6, 0); s.lineTo(5.3, 2.7); s.lineTo(0, 4.7); s.lineTo(-5.3, 2.7); s.closePath();
      const rg = new T.ExtrudeGeometry(s, { depth: 17, bevelEnabled: false }); rg.translate(0, 0, -8.5);
      addMesh(g, rg, std('#4b5059', { roughness: 0.8 }), 0, 6, 0);
      solidBox(g, 12, 4.7, 16, 0, 6, 0);
      box(g, 5, 4.6, 0.15, std('#6e2a20'), 0, 0, 8.05);
      const xa = Math.atan2(4.6, 5);
      [xa, -xa].forEach((r) => { const m = box(g, 6.6, 0.28, 0.12, MAT.white, 0, 2.15, 8.15); m.rotation.z = r; });
      box(g, 5.3, 0.3, 0.14, MAT.white, 0, 4.6, 8.12);
      box(g, 2, 1.6, 0.14, MAT.white, 0, 7.4, 8.07);
      cyl(g, 3, 3, 13, std('#c9ccd0', { roughness: 0.5, metalness: 0.4 }), 9.5, 0, -3, 22, true);
      addMesh(g, new T.SphereGeometry(3, 22, 10, 0, TAU, 0, Math.PI / 2), std('#8a9097', { metalness: 0.5, roughness: 0.4 }), 9.5, 13, -3);
      sign(g, 'AGRI-UAV FARM', z.accent, 0.9, -4.5, 6.9, 8.08, 0);
      // field
      const FZ = -36, FW = 54, FD = 42;
      addMesh(g, new T.PlaneGeometry(FW + 2, FD + 2).rotateX(-Math.PI / 2), std('#7d5c3e', { roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 0, 0.04, FZ, true);
      const rows = 23;
      const crops = new T.InstancedMesh(new T.BoxGeometry(1.1, 0.8, FD - 2), std('#ffffff', { roughness: 0.9, flatShading: true }), rows);
      const m4 = new T.Matrix4(), cA = new T.Color('#6ea13a'), cB = new T.Color('#88b74b');
      for (let i = 0; i < rows; i++) {
        m4.makeTranslation(-FW / 2 + 2 + i * ((FW - 4) / (rows - 1)), 0.4, FZ);
        crops.setMatrixAt(i, m4);
        crops.setColorAt(i, i % 2 ? cA : cB);
      }
      crops.castShadow = true; crops.receiveShadow = true;
      g.add(crops);
      // fence
      const posts = [];
      for (let xx = -FW / 2 - 1; xx <= FW / 2 + 1; xx += 4) { posts.push([xx, FZ - FD / 2 - 1], [xx, FZ + FD / 2 + 1]); }
      for (let zz = FZ - FD / 2 - 1; zz <= FZ + FD / 2 + 1; zz += 4) { posts.push([-FW / 2 - 1, zz], [FW / 2 + 1, zz]); }
      const postIM = new T.InstancedMesh(new T.BoxGeometry(0.22, 1.4, 0.22), MAT.wood, posts.length);
      posts.forEach((p, i) => { m4.makeTranslation(p[0], 0.7, p[1]); postIM.setMatrixAt(i, m4); });
      postIM.castShadow = true;
      g.add(postIM);
      [FZ - FD / 2 - 1, FZ + FD / 2 + 1].forEach((zz) => box(g, FW + 2, 0.12, 0.12, MAT.wood, 0, 1.0, zz));
      [-FW / 2 - 1, FW / 2 + 1].forEach((xx) => box(g, 0.12, 0.12, FD + 2, MAT.wood, xx, 1.0, FZ));
      // spraying drone on a coverage path (lanes between crop rows)
      const lanes = [];
      for (let k = 0; k < 13; k++) {
        const lx = -24 + k * 4;
        const zA = FZ + FD / 2 - 3, zB = FZ - FD / 2 + 3;
        if (k % 2 === 0) lanes.push(new V3(lx, 5, zA), new V3(lx, 5, zB));
        else lanes.push(new V3(lx, 5, zB), new V3(lx, 5, zA));
      }
      const path = new T.CatmullRomCurve3(lanes, true, 'centripetal');
      const plen = path.getLength();
      const sd = makeDrone({ front: '#e9ecef', back: '#e9ecef', fc: '#2b7de9', prop: '#2d3036' });
      sd.group.scale.setScalar(1.5);
      g.add(sd.group);
      box(sd.group, 0.6, 0.35, 0.75, MAT.white, 0, -0.55, 0);
      box(sd.group, 2.4, 0.05, 0.06, MAT.dark, 0, -0.42, 0);
      const spray = new T.Mesh(new T.ConeGeometry(1.9, 4.2, 18, 1, true), new T.MeshBasicMaterial({ color: '#e9f6ff', transparent: true, opacity: 0.2, depthWrite: false, side: T.DoubleSide }));
      g.add(spray);
      const pA = new V3(), pB = new V3(), pC = new V3();
      let u = 0;
      return {
        group: g, padOffset: 18, height: 16, clear: [[0, 0, 14], [0, FZ, 34], [-18, FZ + 12, 20], [18, FZ + 12, 20]],
        update(t, dt) {
          u = (u + 5.5 * dt / plen) % 1;
          const du = 0.003, dtu = du * plen / 5.5;
          path.getPointAt((u - du + 1) % 1, pA); path.getPointAt(u, pB); path.getPointAt((u + du) % 1, pC);
          sd.group.position.copy(pB);
          const vx = (pC.x - pA.x) / (2 * dtu), vz = (pC.z - pA.z) / (2 * dtu);
          const ax = (pC.x - 2 * pB.x + pA.x) / (dtu * dtu), az = (pC.z - 2 * pB.z + pA.z) / (dtu * dtu);
          orientLikeQuad(sd.group, ax, az, Math.atan2(-vx, -vz), 0.5);
          sd.spin(55, dt, t);
          const straight = Math.abs(vz) > 0.93 * Math.hypot(vx, vz) && pB.z < FZ + FD / 2 - 2 && pB.z > FZ - FD / 2 + 2;
          spray.visible = straight;
          spray.position.set(pB.x, pB.y - 2.6, pB.z);
          spray.material.opacity = 0.16 + 0.05 * Math.sin(t * 20);
        }
      };
    }

    /* ---------- Rail depot (KAAF) ---------- */
    function bDepot(z) {
      const g = new T.Group();
      const A = std(z.accent, { roughness: 0.5 }), AG = glow(z.accent, 2.4);
      box(g, 30, 9, 16, std('#e7e2d8'), 0, 0, 0, true);
      const tooth = new T.Shape(); tooth.moveTo(0, 0); tooth.lineTo(7.5, 0); tooth.lineTo(7.5, 3.2); tooth.closePath();
      const tg = new T.ExtrudeGeometry(tooth, { depth: 16, bevelEnabled: false }); tg.translate(0, 0, -8);
      for (let i = 0; i < 4; i++) {
        addMesh(g, tg, MAT.roof, -15 + i * 7.5, 9, 0);
        box(g, 0.12, 3.0, 15.6, MAT.winLit, -15 + (i + 1) * 7.5 - 0.08, 9.05, 0);
      }
      solidBox(g, 30, 3.2, 16, 0, 9, 0);
      box(g, 30.2, 0.45, 16.2, A, 0, 8.6, 0);
      addWindows(g, { w: 26, h: 2.2, cols: 10, rows: 1, y: 5.4, z: 8.03, seed: 61, lit: 0.55 });
      box(g, 0.12, 6.2, 5.2, MAT.dark, 15.02, 0, 0);
      box(g, 0.12, 6.2, 5.2, MAT.dark, -15.02, 0, 0);
      box(g, 2, 3, 0.2, MAT.wood, -9, 0, 8.05);
      sign(g, 'RAIL DEPOT  ·  R&D', z.accent, 1.3, 0, 10.1, 8.15, 0);
      // track
      box(g, 190, 0.25, 3.8, std('#8b8377', { roughness: 1 }), 0, 0, 0);
      [-0.72, 0.72].forEach((rz) => box(g, 190, 0.16, 0.14, MAT.metal, 0, 0.37, rz));
      const nS = 156;
      const sl = new T.InstancedMesh(new T.BoxGeometry(0.32, 0.12, 2.6), MAT.wood, nS);
      const m4 = new T.Matrix4();
      for (let i = 0; i < nS; i++) { m4.makeTranslation(-93 + i * 1.2, 0.31, 0); sl.setMatrixAt(i, m4); }
      sl.receiveShadow = true;
      g.add(sl);
      // concrete apron
      addMesh(g, new T.PlaneGeometry(36, 13).rotateX(-Math.PI / 2), MAT.lot, 0, 0.03, 14.5, true);
      // locomotive
      const loco = new T.Group(); loco.position.y = 0.41; g.add(loco);
      const body = std('#2f4fa3', { roughness: 0.5, metalness: 0.3 });
      const yellow = std('#f2c230', { roughness: 0.6 });
      const wheelGeo = new T.CylinderGeometry(0.5, 0.5, 0.25, 16); wheelGeo.rotateX(Math.PI / 2);
      const wheels = [];
      [-4.2, -2.6, 2.6, 4.2].forEach((wx) => [-0.72, 0.72].forEach((wz) => { wheels.push(addMesh(loco, wheelGeo, MAT.dark, wx, 0.5, wz)); }));
      box(loco, 13, 0.6, 2.9, MAT.dark, 0, 0.9, 0);
      box(loco, 8.4, 2.5, 2.3, body, -1.9, 1.5, 0);
      box(loco, 8.42, 0.25, 2.32, A, -1.9, 2.3, 0);
      box(loco, 3.8, 3.3, 2.9, body, 4.4, 1.5, 0);
      box(loco, 4.1, 0.25, 3.1, MAT.trim, 4.4, 4.8, 0);
      box(loco, 0.1, 1.1, 2.3, MAT.glass, 6.31, 3.2, 0);
      [-1.46, 1.46].forEach((wz) => box(loco, 2.6, 1.0, 0.1, MAT.glass, 4.4, 3.3, wz));
      [6.5, -6.5].forEach((ex) => box(loco, 0.12, 0.6, 2.9, yellow, ex, 0.9, 0));
      [-1.35, 1.35].forEach((wz) => box(loco, 8.4, 0.06, 0.06, MAT.metal, -1.9, 4.3, wz));
      box(loco, 0.15, 0.3, 0.6, glow('#fff1cf', 3.5), 6.38, 4.1, 0);
      box(loco, 0.15, 0.3, 0.6, glow('#fff1cf', 3.5), -6.15, 3.4, 0);
      // parked wagon with containers
      const wag = new T.Group(); wag.position.set(-42, 0.41, 0); g.add(wag);
      [-3.4, 3.4].forEach((wx) => [-0.72, 0.72].forEach((wz) => addMesh(wag, wheelGeo, MAT.dark, wx, 0.5, wz)));
      box(wag, 10, 0.6, 2.7, MAT.trim, 0, 0.95, 0);
      box(wag, 4.6, 2.5, 2.5, std('#c4523b'), -2.5, 1.55, 0);
      box(wag, 4.6, 2.5, 2.5, std('#3b78c4'), 2.5, 1.55, 0);
      const clear = [[0, 0, 19], [0, 16, 9]];
      for (let xx = -92; xx <= 92; xx += 8) clear.push([xx, 0, 6]);
      return {
        group: g, padOffset: 21, height: 13, clear,
        update(t) {
          const cyc = t % 26;
          let xL;
          if (cyc < 3) xL = 0;
          else if (cyc < 11) xL = 50 * smoothstep(3, 11, cyc);
          else if (cyc < 15) xL = 50;
          else if (cyc < 23) xL = 50 * (1 - smoothstep(15, 23, cyc));
          else xL = 0;
          loco.position.x = xL;
          wheels.forEach((w) => { w.rotation.z = -xL / 0.5; });
        }
      };
    }

    /* ---------- Co-simulation lab (cart-pole) ---------- */
    function bSimLab(z) {
      const g = new T.Group();
      const A = std(z.accent, { roughness: 0.45 }), AG = glow(z.accent, 2.6);
      box(g, 16, 8, 12, MAT.wall, 0, 0, 0, true);
      box(g, 16.6, 0.5, 12.6, MAT.trim, 0, 8, 0);
      addWindows(g, { w: 10, h: 4, cols: 4, rows: 2, x: 8.03, y: 1.6, ry: Math.PI / 2, seed: 71 });
      addWindows(g, { w: 10, h: 4, cols: 4, rows: 2, x: -8.03, y: 1.6, ry: -Math.PI / 2, seed: 72 });
      addWindows(g, { w: 14, h: 4, cols: 6, rows: 2, z: -6.03, y: 1.6, ry: Math.PI, seed: 73 });
      box(g, 2.4, 3.2, 0.2, MAT.glass, 0, 0, 6.05);
      sign(g, 'CO-SIMULATION LAB', z.accent, 0.9, 0, 7.05, 6.06, 0);
      // two live "screens": MATLAB-like plot and Gazebo-like render
      function screen(x) {
        const c = document.createElement('canvas'); c.width = 320; c.height = 180;
        const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
        box(g, 6.0, 3.6, 0.2, MAT.trim, x, 2.9, 6.02);
        const m = new T.Mesh(new T.PlaneGeometry(5.6, 3.15), new T.MeshBasicMaterial({ map: tex }));
        m.position.set(x, 4.7, 6.14); g.add(m);
        return { c, ctx: c.getContext('2d'), tex };
      }
      const scrA = screen(-4.6), scrB = screen(4.6);
      // roof cart-pole
      box(g, 14, 0.3, 0.5, MAT.metal, 0, 8.5, 0);
      box(g, 0.4, 0.9, 0.9, A, -7, 8.5, 0); box(g, 0.4, 0.9, 0.9, A, 7, 8.5, 0);
      const cart = new T.Group(); cart.position.y = 8.8; g.add(cart);
      box(cart, 2.2, 0.9, 1.5, A, 0, 0, 0);
      const pole = new T.Group(); pole.position.y = 0.9; cart.add(pole);
      cyl(pole, 0.1, 0.1, 6.5, MAT.metal, 0, 0, 0, 8);
      addMesh(pole, new T.SphereGeometry(0.45, 14, 10), AG, 0, 6.5, 0);
      const st = { k: -10, th0: 0.3, hist: [] };
      let lastDraw = 0;
      function drawScreens(t, th, xc) {
        const a = scrA.ctx, w = 320, h = 180;
        a.fillStyle = '#ffffff'; a.fillRect(0, 0, w, h);
        a.strokeStyle = '#d0d4da'; a.lineWidth = 1;
        for (let i = 1; i < 6; i++) { a.beginPath(); a.moveTo(30, i * 28); a.lineTo(w - 10, i * 28); a.stroke(); }
        a.strokeStyle = '#333'; a.beginPath(); a.moveTo(30, 10); a.lineTo(30, h - 20); a.lineTo(w - 10, h - 20); a.stroke();
        a.fillStyle = '#333'; a.font = '600 13px sans-serif'; a.fillText('θ(t)  pole angle', 40, 22);
        a.strokeStyle = '#0072bd'; a.lineWidth = 2.5; a.beginPath();
        st.hist.forEach((v, i) => { const px = 30 + i * ((w - 40) / 120), py = 84 - v * 160; i ? a.lineTo(px, py) : a.moveTo(px, py); });
        a.stroke();
        const b = scrB.ctx;
        const gr = b.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fb3c8'); gr.addColorStop(1, '#5d6b7a');
        b.fillStyle = gr; b.fillRect(0, 0, w, h);
        b.strokeStyle = 'rgba(255,255,255,0.25)';
        for (let i = 0; i < 12; i++) { b.beginPath(); b.moveTo(i * 30, 120); b.lineTo(160 + (i * 30 - 160) * 2.2, h); b.stroke(); }
        b.fillStyle = '#3a3f46'; b.fillRect(20, 118, 280, 6);
        const cxp = 160 + xc * 22;
        b.fillStyle = '#f59e0b'; b.fillRect(cxp - 22, 100, 44, 18);
        b.strokeStyle = '#e5e7eb'; b.lineWidth = 4; b.beginPath(); b.moveTo(cxp, 100); b.lineTo(cxp - Math.sin(th) * 80, 100 - Math.cos(th) * 80); b.stroke();
        b.fillStyle = '#ffffff'; b.font = '600 13px sans-serif'; b.fillText('Gazebo · cart-pole', 12, 20);
        scrA.tex.needsUpdate = true; scrB.tex.needsUpdate = true;
      }
      return {
        group: g, padOffset: 18, height: 16, clear: [[0, 0, 12]],
        update(t) {
          if (t - st.k > 5.5) { st.k = t; st.th0 = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.2); }
          const tau = t - st.k;
          const th = st.th0 * Math.exp(-1.4 * tau) * Math.cos(4.4 * tau);
          const xc = -2.6 * (st.th0 / 0.35) * Math.exp(-0.9 * tau) * Math.sin(2.3 * tau);
          cart.position.x = clamp(xc, -5.5, 5.5);
          pole.rotation.z = th;
          if (t - lastDraw > 0.07) {
            lastDraw = t;
            st.hist.push(th); if (st.hist.length > 120) st.hist.shift();
            drawScreens(t, th, xc);
          }
        }
      };
    }

    /* ---------- University ---------- */
    function bUniversity(z) {
      const g = new T.Group();
      const AG = glow(z.accent, 2.4);
      box(g, 26, 0.5, 19, MAT.stone, 0, 0, 0);
      box(g, 25, 0.5, 18, MAT.stone, 0, 0.5, 0);
      box(g, 24, 0.5, 17, MAT.stone, 0, 1.0, 0);
      box(g, 22, 10, 12, MAT.wall, 0, 1.5, -2, true);
      windows4(g, 22, 12, { h: 6.5, cols: 7, rows: 2, y: 2.6, cz: -2, seed: 81, inset: 3, lit: 0.4 });
      for (let i = 0; i < 6; i++) cyl(g, 0.55, 0.65, 8.5, MAT.white, -7.5 + i * 3, 1.5, 6.3, 16, false);
      solidBox(g, 18, 10, 4, 0, 1.5, 6.3);
      box(g, 18.4, 1.2, 4.6, MAT.wall, 0, 10, 6.2);
      addMesh(g, prism(18.8, 3.2, 4.8), MAT.wall, 0, 11.2, 6.2);
      sign(g, 'ERCIYES UNIVERSITY', z.accent, 0.9, 0, 10.6, 8.53, 0);
      box(g, 22.6, 0.5, 12.6, MAT.trim, 0, 11.5, -2);
      cyl(g, 4.2, 4.2, 2.6, MAT.wall, 0, 12, -2, 28, true);
      addMesh(g, new T.SphereGeometry(4.2, 28, 14, 0, TAU, 0, Math.PI / 2), std('#5f9e8f', { roughness: 0.45, metalness: 0.35 }), 0, 14.6, -2);
      cyl(g, 0.55, 0.75, 1.4, MAT.white, 0, 18.5, -2, 12);
      addMesh(g, new T.SphereGeometry(0.4, 12, 8), AG, 0, 20.3, -2, true);
      // floating mortarboard
      const cap = new T.Group(); cap.position.set(0, 27, -2); g.add(cap);
      const navy = std('#1d2742', { roughness: 0.6 });
      const board = box(cap, 6.5, 0.35, 6.5, navy, 0, 0, 0); board.rotation.y = Math.PI / 4;
      cyl(cap, 2.4, 2.7, 1.9, navy, 0, -1.9, 0, 24);
      cyl(cap, 0.32, 0.32, 0.25, MAT.gold, 0, 0.35, 0, 12);
      const cord = box(cap, 0.08, 0.08, 4.4, MAT.gold, 0, 0.38, 2.2);
      const tassel = new T.Group(); tassel.position.set(0, 0.4, 4.45); cap.add(tassel);
      cyl(tassel, 0.07, 0.07, 2.3, MAT.gold, 0, -2.3, 0, 6);
      addMesh(tassel, new T.ConeGeometry(0.32, 1.0, 10), MAT.gold, 0, -2.6, 0);
      const ring = new T.Mesh(new T.TorusGeometry(5.6, 0.1, 6, 64), AG);
      ring.rotation.x = Math.PI / 2; ring.position.set(0, 24, -2); g.add(ring);
      return {
        group: g, padOffset: 20, height: 31, clear: [[0, 0, 17]],
        update(t) {
          cap.rotation.y = t * 0.45;
          cap.position.y = 27 + Math.sin(t * 1.1) * 0.6;
          tassel.rotation.x = Math.sin(t * 2) * 0.15;
          ring.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);
        }
      };
    }

    /* ---------- Library ---------- */
    function bLibrary(z) {
      const g = new T.Group();
      const A = std(z.accent, { roughness: 0.5 }), AG = glow(z.accent, 2.6);
      box(g, 20, 12, 11, MAT.wallWarm, 0, 0, -2, true);
      box(g, 20.6, 0.6, 11.6, MAT.trim, 0, 12, -2);
      addWindows(g, { w: 8, h: 8, cols: 3, rows: 3, x: 10.03, y: 2, z: -2, ry: Math.PI / 2, seed: 91 });
      addWindows(g, { w: 8, h: 8, cols: 3, rows: 3, x: -10.03, y: 2, z: -2, ry: -Math.PI / 2, seed: 92 });
      addWindows(g, { w: 17, h: 8, cols: 6, rows: 3, z: -7.53, y: 2, ry: Math.PI, seed: 93 });
      box(g, 20.6, 0.6, 2.4, MAT.wood, 0, 0, 4.4);
      const pal = ['#8e2b2b', '#22406e', '#2f6b4f', '#c49a2c', '#5b3a73', '#1f6f78', '#a4492b', '#394150', '#b07a3b', '#3f5d8a'];
      const rnd = mulberry32(17);
      let bx = -9.8, i = 0;
      while (bx < 9.4) {
        const w = Math.min(0.75 + rnd() * 0.65, 9.9 - bx);
        const h = 6.2 + rnd() * 4.6;
        const mat = std(pal[i++ % pal.length], { roughness: 0.7 });
        box(g, w - 0.08, h, 1.7, mat, bx + w / 2, 0.6, 4.4, true);
        box(g, w - 0.06, 0.22, 1.72, MAT.gold, bx + w / 2, 0.6 + h * 0.84, 4.4);
        box(g, w - 0.06, 0.12, 1.72, MAT.gold, bx + w / 2, 0.6 + h * 0.12, 4.4);
        bx += w;
      }
      box(g, 20.6, 0.5, 2.6, MAT.wood, 0, 11.6, 4.4);
      sign(g, 'LIBRARY  ·  PUBLICATIONS', z.accent, 1.0, 0, 13.3, 3.4, 0);
      box(g, 12, 1.4, 0.2, MAT.trim, 0, 12.6, 3.25);
      // floating open book + orbiting pages
      const book = new T.Group(); book.position.set(0, 21, -2); g.add(book);
      const pageL = new T.Group(); pageL.rotation.z = -0.32; book.add(pageL);
      box(pageL, 4.4, 0.5, 6, MAT.white, -2.3, -0.25, 0);
      box(pageL, 4.6, 0.14, 6.2, A, -2.3, -0.42, 0);
      const pageR = new T.Group(); pageR.rotation.z = 0.32; book.add(pageR);
      box(pageR, 4.4, 0.5, 6, MAT.white, 2.3, -0.25, 0);
      box(pageR, 4.6, 0.14, 6.2, A, 2.3, -0.42, 0);
      const sheets = [];
      const sheetMat = new T.MeshStandardMaterial({ color: '#fbf8f0', side: T.DoubleSide, roughness: 0.8, emissive: new T.Color('#ffffff'), emissiveIntensity: 0.15 });
      for (let k = 0; k < 6; k++) { const s = new T.Mesh(new T.PlaneGeometry(1.2, 1.6), sheetMat); g.add(s); sheets.push(s); }
      const ring = new T.Mesh(new T.TorusGeometry(6.8, 0.08, 6, 64), AG); ring.rotation.x = Math.PI / 2; ring.position.set(0, 19, -2); g.add(ring);
      return {
        group: g, padOffset: 18, height: 26, clear: [[0, 0, 14]],
        update(t) {
          book.rotation.y = Math.sin(t * 0.3) * 0.6;
          book.position.y = 21 + Math.sin(t * 1.2) * 0.5;
          sheets.forEach((s, k) => {
            const a = t * 0.5 + k / sheets.length * TAU;
            s.position.set(Math.cos(a) * 7.5, 21 + Math.sin(t * 1.3 + k) * 1.5, -2 + Math.sin(a) * 7.5);
            s.rotation.set(Math.sin(t * 2 + k) * 0.6, -a, Math.cos(t * 1.7 + k) * 0.4);
          });
        }
      };
    }

    /* ---------- Robotics workshop (Teknofest + FRC) ---------- */
    function bWorkshop(z) {
      const g = new T.Group();
      const A = std(z.accent, { roughness: 0.5 }), AG = glow(z.accent, 2.4);
      box(g, 20, 8, 14, std('#d6dbe1', { roughness: 0.55, metalness: 0.25 }), 0, 0, 0, true);
      const roofG = prism(14.8, 3.6, 20.8); roofG.rotateY(Math.PI / 2);
      addMesh(g, roofG, MAT.roof, 0, 8, 0);
      solidBox(g, 20, 3.6, 14, 0, 8, 0);
      box(g, 20.1, 0.5, 14.1, A, 0, 7.2, 0);
      box(g, 8, 6, 0.2, std('#9aa3ad', { metalness: 0.4, roughness: 0.5 }), -3.5, 0, 7.05);
      for (let k = 0; k < 11; k++) box(g, 8, 0.07, 0.1, MAT.trim, -3.5, 0.4 + k * 0.53, 7.17);
      box(g, 1.6, 2.8, 0.2, MAT.wood, 4, 0, 7.05);
      addWindows(g, { w: 5, h: 1.4, cols: 3, rows: 1, x: 6.8, y: 2.2, z: 7.04, seed: 101, lit: 0.7 });
      sign(g, 'ROBOTICS WORKSHOP', z.accent, 0.85, 5.6, 5.0, 7.08, 0);
      addWindows(g, { w: 10, h: 2, cols: 5, rows: 1, x: 10.03, y: 3, ry: Math.PI / 2, seed: 102 });
      // big drone sculpture (Teknofest colours: black frame, red/green props)
      cyl(g, 2.4, 2.8, 1.6, MAT.stone, -13.5, 0, 9, 24, true);
      cyl(g, 2.45, 2.45, 0.12, AG, -13.5, 1.55, 9, 24);
      const big = makeDrone({ front: '#1d1f24', back: '#1d1f24', fc: '#7a3fd1', prop: '#e5322d', propB: '#52cf38' });
      big.group.scale.setScalar(2.6);
      big.group.position.set(-13.5, 3.4, 9);
      g.add(big.group);
      // FRC-style robot driving a figure-eight
      const frc = new T.Group(); g.add(frc);
      box(frc, 2.0, 0.45, 2.4, MAT.dark, 0, 0.25, 0);
      const bump = std('#cf3434', { roughness: 0.7 });
      box(frc, 2.5, 0.42, 0.35, bump, 0, 0.2, 1.38); box(frc, 2.5, 0.42, 0.35, bump, 0, 0.2, -1.38);
      box(frc, 0.35, 0.42, 2.4, bump, 1.08, 0.2, 0); box(frc, 0.35, 0.42, 2.4, bump, -1.08, 0.2, 0);
      const arm = box(frc, 0.25, 2.0, 0.25, MAT.metal, 0, 0.7, -0.4); arm.rotation.x = 0.5;
      box(frc, 1.4, 0.5, 0.6, A, 0, 2.3, 0.4);
      const pB = new V3(), pN = new V3();
      return {
        group: g, padOffset: 22, height: 14, clear: [[0, 0, 15], [-13.5, 9, 5]],
        update(t, dt) {
          big.group.position.y = 3.4 + Math.sin(t * 1.3) * 0.35;
          big.group.rotation.y = t * 0.3;
          big.spin(40, dt, t);
          const s = t * 0.55;
          pB.set(5.5 + 4.2 * Math.sin(s), 0, 12 + 2.4 * Math.sin(2 * s));
          pN.set(5.5 + 4.2 * Math.sin(s + 0.05), 0, 12 + 2.4 * Math.sin(2 * (s + 0.05)));
          frc.position.copy(pB);
          frc.rotation.y = Math.atan2(pN.x - pB.x, pN.z - pB.z);
        }
      };
    }

    const BUILDERS = {
      tower: bTower, hangar: bHangar, researchTower: bResearchTower, arena: bArena,
      sensorLab: bSensorLab, lidarStation: bLidar, house: bHouse, farm: bFarm,
      depot: bDepot, simLab: bSimLab, university: bUniversity, library: bLibrary, workshop: bWorkshop
    };

    /* ------------------------------------------------------------------
       Place zones: building + pad + beacon
       ------------------------------------------------------------------ */
    const zones = [];
    const animators = [];
    const beacons = [];
    const clearCircles = [];

    function padTexture(accent) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = '#272c34'; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = accent; x.lineWidth = 14; x.beginPath(); x.arc(128, 128, 112, 0, TAU); x.stroke();
      x.strokeStyle = 'rgba(240,235,225,0.7)'; x.lineWidth = 4; x.setLineDash([14, 10]); x.beginPath(); x.arc(128, 128, 88, 0, TAU); x.stroke();
      x.setLineDash([]);
      x.fillStyle = '#ece6da'; x.font = `700 118px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('H', 128, 134);
      const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return tex;
    }
    const beamAlpha = (function () {
      const c = document.createElement('canvas'); c.width = 4; c.height = 128;
      const x = c.getContext('2d');
      const gr = x.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
      x.fillStyle = gr; x.fillRect(0, 0, 4, 128);
      return new T.CanvasTexture(c);
    })();

    (DATA.zones || []).forEach((zd) => {
      const builder = BUILDERS[zd.building];
      if (!builder) return;
      const b = builder(zd);
      const px = zd.pos[0], pz = zd.pos[1];
      const ang = (px === 0 && pz === 0) ? 0 : Math.atan2(-px, -pz);
      b.group.position.set(px, 0, pz);
      b.group.rotation.y = ang;
      scene.add(b.group);
      const fwd = new V3(Math.sin(ang), 0, Math.cos(ang));
      const right = new V3(Math.cos(ang), 0, -Math.sin(ang));
      const pad = new V3(px, 0, pz).addScaledVector(fwd, b.padOffset).addScaledVector(right, b.padSide || 0);
      // pad
      const padG = new T.Group(); padG.position.copy(pad); padG.rotation.y = ang; scene.add(padG);
      const side = std('#30353d', { roughness: 0.8 });
      const top = std('#ffffff', { map: padTexture(zd.accent), roughness: 0.75 });
      const pm = new T.Mesh(new T.CylinderGeometry(5.6, 5.9, 0.3, 40), [side, top, side]);
      pm.position.y = 0.15; pm.receiveShadow = true; padG.add(pm);
      const ringMat = glow(zd.accent, 2.4);
      const ring = new T.Mesh(new T.TorusGeometry(5.75, 0.11, 8, 72), ringMat);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.33; padG.add(ring);
      // beacon
      const bm = new T.MeshBasicMaterial({ color: new T.Color(zd.accent).multiplyScalar(1.3), transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false, alphaMap: beamAlpha });
      const beam = new T.Mesh(new T.CylinderGeometry(0.55, 0.9, 150, 16, 1, true), bm);
      beam.position.set(pad.x, 75, pad.z);
      scene.add(beam);
      beacons.push({ mesh: beam, mat: bm, zone: zd.id });
      // lot / clearance
      (b.clear || [[0, 0, 15]]).forEach((c) => {
        const wx = px + right.x * c[0] + fwd.x * c[1], wz = pz + right.z * c[0] + fwd.z * c[1];
        clearCircles.push([wx, wz, c[2]]);
      });
      const z = {
        id: zd.id, data: zd, accent: zd.accent, name: zd.name,
        center: new V3(px, 0, pz), pad, yawToBuilding: Math.atan2(-(px - pad.x), -(pz - pad.z)) + 0,
        labelPos: new V3(px, b.height + 6, pz), ring, ringMat, padGroup: padG, height: b.height
      };
      // yaw that faces the building from the pad: forward = (-sin yaw, -cos yaw) must point to center
      z.yawToBuilding = Math.atan2(-(px - pad.x), -(pz - pad.z));
      zones.push(z);
      if (b.update) animators.push(b.update);
    });

    /* ------------------------------------------------------------------
       Plaza, roads, lamps, trees
       ------------------------------------------------------------------ */
    (function buildPlaza() {
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      const x = c.getContext('2d');
      x.fillStyle = '#ddd4c4'; x.fillRect(0, 0, 1024, 1024);
      x.strokeStyle = 'rgba(120,105,85,0.25)'; x.lineWidth = 3;
      for (let r = 80; r < 512; r += 70) { x.beginPath(); x.arc(512, 512, r, 0, TAU); x.stroke(); }
      for (let i = 0; i < 32; i++) { const a = i / 32 * TAU; x.beginPath(); x.moveTo(512 + Math.cos(a) * 80, 512 + Math.sin(a) * 80); x.lineTo(512 + Math.cos(a) * 512, 512 + Math.sin(a) * 512); x.stroke(); }
      // compass rose (north = -z = canvas top)
      x.save(); x.translate(512, 512);
      for (let i = 0; i < 8; i++) {
        x.rotate(TAU / 8);
        x.fillStyle = i % 2 ? 'rgba(60,66,78,0.55)' : 'rgba(196,150,70,0.75)';
        const L = i % 2 ? 200 : 330;
        x.beginPath(); x.moveTo(0, -L); x.lineTo(26, 0); x.lineTo(-26, 0); x.closePath(); x.fill();
      }
      x.restore();
      x.fillStyle = 'rgba(50,55,65,0.85)'; x.font = `700 70px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('N', 512, 120); x.fillText('S', 512, 904); x.fillText('E', 904, 512); x.fillText('W', 120, 512);
      const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
      const plaza = new T.Mesh(new T.CircleGeometry(32, 80).rotateX(-Math.PI / 2), std('#ffffff', { map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      plaza.position.y = 0.03; plaza.receiveShadow = true;
      scene.add(plaza);
      const rim = new T.Mesh(new T.RingGeometry(32, 33.2, 80).rotateX(-Math.PI / 2), std('#b9935a', { roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      rim.position.y = 0.035; rim.receiveShadow = true;
      scene.add(rim);
    })();

    const roads = [];
    (function buildRoads() {
      const dashGeo = new T.PlaneGeometry(0.32, 2.4).rotateX(-Math.PI / 2);
      const lampPole = new T.CylinderGeometry(0.12, 0.16, 6.5, 6);
      const lampHead = new T.BoxGeometry(0.5, 0.25, 1.2);
      const dashes = [], lamps = [];
      zones.forEach((z) => {
        if (z.id === 'hq') return;
        const dir = new V3(z.pad.x, 0, z.pad.z).normalize();
        const a = dir.clone().multiplyScalar(31);
        const b = z.pad.clone().addScaledVector(dir, -5.8);
        const L = a.distanceTo(b);
        if (L < 2) return;
        const ang = Math.atan2(dir.x, dir.z);
        const r = new T.Mesh(new T.PlaneGeometry(7, L).rotateX(-Math.PI / 2), MAT.asphalt);
        r.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
        r.rotation.y = ang;
        r.receiveShadow = true;
        scene.add(r);
        roads.push([a.x, a.z, b.x, b.z]);
        for (let s = 3; s < L - 2; s += 6) dashes.push([a.x + dir.x * s, a.z + dir.z * s, ang]);
        const side = new V3(dir.z, 0, -dir.x);
        for (let s = 12; s < L - 6; s += 26) lamps.push([a.x + dir.x * s + side.x * 5, a.z + dir.z * s + side.z * 5, ang]);
      });
      const m4 = new T.Matrix4(), q = new T.Quaternion(), one = new V3(1, 1, 1), p = new V3();
      const dIM = new T.InstancedMesh(dashGeo, MAT.dash, dashes.length);
      dashes.forEach((d, i) => { q.setFromAxisAngle(new V3(0, 1, 0), d[2]); m4.compose(p.set(d[0], 0.04, d[1]), q, one); dIM.setMatrixAt(i, m4); });
      dIM.receiveShadow = true;
      scene.add(dIM);
      const pIM = new T.InstancedMesh(lampPole, MAT.trim, lamps.length);
      const hIM = new T.InstancedMesh(lampHead, glow('#ffe2b0', 1.9), lamps.length);
      lamps.forEach((l, i) => {
        q.setFromAxisAngle(new V3(0, 1, 0), l[2]);
        m4.compose(p.set(l[0], 3.25, l[1]), q, one); pIM.setMatrixAt(i, m4);
        m4.compose(p.set(l[0], 6.55, l[1]), q, one); hIM.setMatrixAt(i, m4);
      });
      pIM.castShadow = true;
      scene.add(pIM); scene.add(hIM);
    })();

    function distToSeg(px, pz, s) {
      const dx = s[2] - s[0], dz = s[3] - s[1];
      const t = clamp(((px - s[0]) * dx + (pz - s[1]) * dz) / (dx * dx + dz * dz), 0, 1);
      return Math.hypot(px - (s[0] + dx * t), pz - (s[1] + dz * t));
    }

    (function buildTrees() {
      const rnd = mulberry32(2024);
      const list = [];
      let attempts = 0;
      while (list.length < 420 && attempts < 9000) {
        attempts++;
        const a = rnd() * TAU, r = 36 + Math.sqrt(rnd()) * 270;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        let ok = true;
        for (const c of clearCircles) { if (Math.hypot(x - c[0], z - c[1]) < c[2] + 4) { ok = false; break; } }
        if (ok) for (const s of roads) { if (distToSeg(x, z, s) < 7) { ok = false; break; } }
        if (ok) list.push([x, z, 0.75 + rnd() * 0.7, rnd() < 0.45 ? 1 : 0, rnd()]);
      }
      for (let i = 0; i < 260; i++) {
        const a = rnd() * TAU, r = 320 + rnd() * 260;
        list.push([Math.cos(a) * r, Math.sin(a) * r, 1 + rnd() * 0.8, rnd() < 0.6 ? 1 : 0, rnd()]);
      }
      const trunkGeo = new T.CylinderGeometry(0.28, 0.42, 2.4, 6); trunkGeo.translate(0, 1.2, 0);
      const pineGeo = new T.ConeGeometry(2.3, 6.5, 7); pineGeo.translate(0, 2.4 + 3.0, 0);
      const roundGeo = new T.IcosahedronGeometry(2.7, 0); roundGeo.translate(0, 2.4 + 2.2, 0);
      const pines = list.filter((t) => t[3] === 1), rounds = list.filter((t) => t[3] === 0);
      const trunks = new T.InstancedMesh(trunkGeo, MAT.trunk, list.length);
      const pIM = new T.InstancedMesh(pineGeo, MAT.leaf, pines.length);
      const rIM = new T.InstancedMesh(roundGeo, MAT.leaf, rounds.length);
      const m4 = new T.Matrix4(), q = new T.Quaternion(), s = new V3(), p = new V3(), col = new T.Color();
      const pc = [new T.Color('#3f7a4a'), new T.Color('#4d8a50'), new T.Color('#5b8f4a')];
      const rc = [new T.Color('#6aa04a'), new T.Color('#86ad4c'), new T.Color('#a0b852'), new T.Color('#c08a43')];
      let pi = 0, ri = 0;
      list.forEach((t, i) => {
        q.setFromAxisAngle(new V3(0, 1, 0), t[4] * TAU);
        s.setScalar(t[2]);
        p.set(t[0], groundHeight(t[0], t[1]) - 0.1, t[1]);
        m4.compose(p, q, s);
        trunks.setMatrixAt(i, m4);
        if (t[3] === 1) { pIM.setMatrixAt(pi, m4); pIM.setColorAt(pi, col.copy(pc[Math.floor(t[4] * 3) % 3])); pi++; }
        else { rIM.setMatrixAt(ri, m4); rIM.setColorAt(ri, col.copy(rc[Math.floor(t[4] * 7) % 4])); ri++; }
      });
      [trunks, pIM, rIM].forEach((m) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
    })();

    // collider finalisation
    scene.updateMatrixWorld(true);
    (function finalizeColliders() {
      const q = new T.Quaternion(), e = new T.Euler(), p = new V3();
      colliders.forEach((c) => {
        c.obj.getWorldPosition(p);
        c.obj.getWorldQuaternion(q);
        e.setFromQuaternion(q, 'YXZ');
        c.cx = p.x; c.cy = p.y; c.cz = p.z;
        c.cos = Math.cos(e.y); c.sin = Math.sin(e.y);
      });
    })();

    /* ------------------------------------------------------------------
       Player drone
       ------------------------------------------------------------------ */
    const player = makeDrone();
    player.group.scale.setScalar(1.6); // larger so it reads well from the bird's-eye camera
    scene.add(player.group);
    // ground marker + altitude drop-line (helps judge position/height from above)
    const markerMat = new T.MeshBasicMaterial({ color: new T.Color('#7dd3fc').multiplyScalar(1.3), transparent: true, opacity: 0, depthWrite: false, fog: false });
    const marker = new T.Mesh(new T.RingGeometry(1.7, 2.1, 40).rotateX(-Math.PI / 2), markerMat);
    marker.renderOrder = 2;
    scene.add(marker);
    const dropMat = new T.LineBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0, depthWrite: false, fog: false });
    const dropLine = new T.Line(new T.BufferGeometry().setFromPoints([new V3(0, 0, 0), new V3(0, -1, 0)]), dropMat);
    dropLine.frustumCulled = false;
    scene.add(dropLine);
    const hq = zones.find((z) => z.id === 'hq') || zones[0];
    const D = {
      p: new V3(hq ? hq.pad.x : 0, 0.75, hq ? hq.pad.z : 20),
      v: new V3(), a: new V3(), yaw: 0, yawRate: 0, pitch: 0, roll: 0,
      mode: 'DISARMED', armed: false, landed: true, thrust: 0, geofence: false
    };
    const R_DRONE = 1.3;
    const HOVER_H = 0.82;

    function collide() {
      let onTop = false;
      for (const c of colliders) {
        const dx = D.p.x - c.cx, dy = D.p.y - c.cy, dz = D.p.z - c.cz;
        if (Math.abs(dy) > c.hy + R_DRONE) continue;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        const px = c.hx + R_DRONE - Math.abs(lx);
        if (px <= 0) continue;
        const pz = c.hz + R_DRONE - Math.abs(lz);
        if (pz <= 0) continue;
        const py = c.hy + (dy > 0 ? HOVER_H : R_DRONE) - Math.abs(dy);
        if (py <= -0.03) continue;
        if (py < px && py < pz) {
          if (dy > 0) {
            if (py > 0) D.p.y += py;
            if (D.v.y < 0) D.v.y = 0;
            onTop = true;
          } else {
            if (py <= 0) continue;
            D.p.y -= py;
            if (D.v.y > 0) D.v.y = 0;
          }
        } else if (py <= 0) {
          continue;
        } else if (px < pz) {
          const sgn = lx >= 0 ? 1 : -1;
          const nx = c.cos * sgn, nz = -c.sin * sgn;
          D.p.x += nx * px; D.p.z += nz * px;
          const vn = D.v.x * nx + D.v.z * nz;
          if (vn < 0) { D.v.x -= nx * vn * 1.2; D.v.z -= nz * vn * 1.2; }
        } else {
          const sgn = lz >= 0 ? 1 : -1;
          const nx = c.sin * sgn, nz = c.cos * sgn;
          D.p.x += nx * pz; D.p.z += nz * pz;
          const vn = D.v.x * nx + D.v.z * nz;
          if (vn < 0) { D.v.x -= nx * vn * 1.2; D.v.z -= nz * vn * 1.2; }
        }
      }
      return onTop;
    }

    /* ------------------------------------------------------------------
       Autopilot (min-jerk transit with altitude bump) + visualisation
       ------------------------------------------------------------------ */
    const AP = { active: false, s: 0, T: 1, p0: new V3(), pe: new V3(), cruise: 0, yawEnd: 0, zone: null, hold: new V3() };
    // planned reference trajectory, drawn as a thin glowing tube
    const refLineMat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false, fog: false });
    const refLine = new T.Mesh(new T.BufferGeometry(), refLineMat);
    refLine.frustumCulled = false;
    scene.add(refLine);
    const tmpR = new V3(), tmpR2 = new V3(), tmpR3 = new V3();

    function refAt(s, out) {
      s = clamp(s, 0, 1);
      const m = minJerk(s);
      const x = lerp(AP.p0.x, AP.pe.x, m), z = lerp(AP.p0.z, AP.pe.z, m);
      const base = lerp(AP.p0.y, AP.pe.y, m);
      const bump = smoothstep(0, 0.32, s) * (1 - smoothstep(0.68, 1, s));
      return out.set(x, base + Math.max(0, AP.cruise - base) * bump, z);
    }

    function flyTo(id) {
      const z = zones.find((q) => q.id === id);
      if (!z) return false;
      if (!D.armed) { D.armed = true; }
      AP.zone = z;
      AP.p0.copy(D.p);
      AP.pe.set(z.pad.x, HOVER_H + 6, z.pad.z);
      const dist = Math.hypot(AP.pe.x - AP.p0.x, AP.pe.z - AP.p0.z);
      // obstacle-aware cruise altitude: only climb as high as the route needs
      const seg = [AP.p0.x, AP.p0.z, AP.pe.x, AP.pe.z];
      let top = 0;
      for (const c of colliders) {
        if (distToSeg(c.cx, c.cz, seg) < Math.max(c.hx, c.hz) + 5) top = Math.max(top, c.cy + c.hy);
      }
      AP.cruise = Math.max(AP.p0.y, AP.pe.y, top > 0 ? top + 7 : 0, dist > 40 ? 16 : 0);
      const climb = Math.max(0, AP.cruise - Math.min(AP.p0.y, AP.pe.y));
      AP.T = clamp(dist / 13 + 3 + climb / 14, 4, 18);
      AP.s = 0;
      AP.yawEnd = z.yawToBuilding;
      AP.active = true;
      D.mode = 'AUTO.MISSION';
      const pts = [];
      for (let i = 0; i <= 90; i++) pts.push(refAt(i / 90, new V3()));
      refLine.geometry.dispose();
      refLine.geometry = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 180, 0.11, 5, false);
      refLineMat.color.set(z.accent).multiplyScalar(1.7);
      refLineMat.opacity = 0.85;
      emit('mode', D.mode);
      return true;
    }
    function cancelAuto() {
      if (!AP.active) return;
      AP.active = false;
      D.mode = 'POSCTL';
      emit('mode', D.mode);
    }
    function teleportTo(id) {
      const z = zones.find((q) => q.id === id);
      if (!z) return;
      AP.active = false;
      D.armed = true;
      D.p.set(z.pad.x, HOVER_H + 6, z.pad.z);
      D.v.set(0, 0, 0);
      D.yaw = z.yawToBuilding;
      D.yawRate = 0;
      AP.hold.copy(D.p);
      D.mode = 'AUTO.LOITER';
      snapCamera = true;
      CAM.blend = 1;
      CAM.yawOff = 0;
      trailBuf.length = 0;
    }

    /* ------------------------------------------------------------------
       Trail of the actual path
       ------------------------------------------------------------------ */
    const TRAIL_N = 180;
    const trailPos = new Float32Array(TRAIL_N * 3), trailCol = new Float32Array(TRAIL_N * 3);
    const trailGeo = new T.BufferGeometry();
    trailGeo.setAttribute('position', new T.BufferAttribute(trailPos, 3));
    trailGeo.setAttribute('color', new T.BufferAttribute(trailCol, 3));
    const trail = new T.Line(trailGeo, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    trail.frustumCulled = false;
    scene.add(trail);
    const trailBuf = [];
    let trailAcc = 0;
    const trailColor = new T.Color('#7dd3fc');
    function updateTrail(dt) {
      trailAcc += dt;
      if (trailAcc > 0.04) {
        trailAcc = 0;
        trailBuf.push(D.p.x, D.p.y + 0.1, D.p.z);
        if (trailBuf.length > TRAIL_N * 3) trailBuf.splice(0, 3);
      }
      const n = trailBuf.length / 3;
      for (let i = 0; i < TRAIL_N; i++) {
        const j = Math.min(i, n - 1);
        if (j < 0) break;
        trailPos[i * 3] = trailBuf[j * 3]; trailPos[i * 3 + 1] = trailBuf[j * 3 + 1]; trailPos[i * 3 + 2] = trailBuf[j * 3 + 2];
        const k = i < n ? Math.pow(i / n, 1.6) * 1.4 : 0;
        trailCol[i * 3] = trailColor.r * k; trailCol[i * 3 + 1] = trailColor.g * k; trailCol[i * 3 + 2] = trailColor.b * k;
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.color.needsUpdate = true;
      trailGeo.setDrawRange(0, Math.max(0, Math.min(TRAIL_N, n)));
    }

    /* ------------------------------------------------------------------
       Physics step
       ------------------------------------------------------------------ */
    const fwdV = new V3(), rightV = new V3(), vdes = new V3(), acc = new V3();
    const GEOFENCE = 300, CEILING = 140;
    let near = null;

    function stepDrone(dt, input, t, frozen) {
      fwdV.set(-Math.sin(D.yaw), 0, -Math.cos(D.yaw));
      rightV.set(Math.cos(D.yaw), 0, -Math.sin(D.yaw));
      const hasInput = input && (Math.abs(input.fwd) + Math.abs(input.strafe) + Math.abs(input.up) + Math.abs(input.yaw)) > 0.02;
      if (hasInput && !frozen && D.armed) {
        if (AP.active || D.mode === 'AUTO.LOITER' || D.mode === 'LANDED' || D.mode === 'DISARMED') { AP.active = false; D.mode = 'POSCTL'; emit('mode', D.mode); }
      }
      let kv = 2.6, aMax = 13, kvY = 3.2;
      if (AP.active) {
        AP.s = Math.min(1, AP.s + dt / AP.T);
        refAt(AP.s, tmpR);
        const e = 0.004;
        refAt(AP.s + e, tmpR2); refAt(AP.s - e, tmpR3);
        const span = (Math.min(1, AP.s + e) - Math.max(0, AP.s - e)) || e;
        vdes.subVectors(tmpR2, tmpR3).multiplyScalar(1 / (span * AP.T));
        vdes.addScaledVector(tmpR.sub(D.p), 2.0);
        kv = 4.5; aMax = 17; kvY = 4.5;
        const hs = Math.hypot(vdes.x, vdes.z);
        const yawT = hs > 2.5 && AP.s < 0.9 ? Math.atan2(-vdes.x, -vdes.z) : AP.yawEnd;
        D.yawRate = clamp(wrapAngle(yawT - D.yaw) * 2.6, -2.4, 2.4);
        if (AP.s >= 1 && D.p.distanceTo(AP.pe) < 1.2) {
          AP.active = false; AP.hold.copy(AP.pe);
          D.mode = 'AUTO.LOITER';
          emit('mode', D.mode);
          emit('arrive', AP.zone.id);
        }
      } else if (D.mode === 'AUTO.LOITER' || frozen) {
        vdes.subVectors(AP.hold, D.p).multiplyScalar(1.5);
        if (D.mode !== 'AUTO.LOITER') vdes.set(0, 0, 0);
        D.yawRate *= Math.exp(-6 * dt);
      } else if (D.armed && input) {
        const VH = 17, VV = 7.5;
        vdes.copy(fwdV).multiplyScalar(input.fwd * VH).addScaledVector(rightV, input.strafe * VH * 0.8);
        vdes.y = input.up * VV;
        D.yawRate = lerp(D.yawRate, input.yaw * 1.9, 1 - Math.exp(-9 * dt));
      } else {
        vdes.set(0, 0, 0);
      }
      if (!D.armed) vdes.set(0, -1, 0);
      // acceleration (velocity loop), horizontal limited like a thrust-tilt limit
      acc.set((vdes.x - D.v.x) * kv, 0, (vdes.z - D.v.z) * kv);
      const ah = Math.hypot(acc.x, acc.z);
      if (ah > aMax) { acc.x *= aMax / ah; acc.z *= aMax / ah; }
      acc.y = clamp((vdes.y - D.v.y) * kvY, -9, 11);
      D.v.addScaledVector(acc, dt);
      D.p.addScaledVector(D.v, dt);
      D.yaw = wrapAngle(D.yaw + D.yawRate * dt);
      // ground / ceiling / geofence
      const gh = groundHeight(D.p.x, D.p.z) + HOVER_H;
      let onSurface = D.p.y <= gh + 0.03;
      if (D.p.y < gh) { D.p.y = gh; if (D.v.y < 0) D.v.y = 0; }
      if (D.p.y > CEILING) { D.p.y = CEILING; if (D.v.y > 0) D.v.y = 0; }
      const r = Math.hypot(D.p.x, D.p.z);
      D.geofence = r > GEOFENCE - 25;
      if (r > GEOFENCE) {
        D.p.x *= GEOFENCE / r; D.p.z *= GEOFENCE / r;
        const vr = (D.v.x * D.p.x + D.v.z * D.p.z) / GEOFENCE;
        if (vr > 0) { D.v.x -= D.p.x / GEOFENCE * vr * 1.3; D.v.z -= D.p.z / GEOFENCE * vr * 1.3; }
      }
      if (collide()) onSurface = true;
      const landed = onSurface && (!input || input.up <= 0.05) && !AP.active && D.mode !== 'AUTO.LOITER';
      if (landed) { D.v.x *= Math.exp(-6 * dt); D.v.z *= Math.exp(-6 * dt); }
      if (D.armed && landed && D.mode === 'POSCTL' && Math.hypot(D.v.x, D.v.z) < 0.5) { D.mode = 'LANDED'; emit('mode', D.mode); }
      D.landed = landed;
      D.a.copy(acc);
      // attitude from acceleration (+ a little hover wobble)
      const aF = acc.x * fwdV.x + acc.z * fwdV.z;
      const aR = acc.x * rightV.x + acc.z * rightV.z;
      const wob = D.armed && !landed ? 0.012 : 0;
      const tp = clamp(-Math.atan(aF / G), -0.6, 0.6) + Math.sin(t * 2.3) * wob;
      const tr = clamp(-Math.atan(aR / G), -0.6, 0.6) + Math.sin(t * 1.7 + 1) * wob;
      D.pitch = lerp(D.pitch, landed ? 0 : tp, 1 - Math.exp(-10 * dt));
      D.roll = lerp(D.roll, landed ? 0 : tr, 1 - Math.exp(-10 * dt));
      player.group.position.copy(D.p);
      player.group.rotation.set(D.pitch, D.yaw, D.roll, 'YXZ');
      const thrust = D.armed ? (landed ? 14 : 48 + clamp(acc.y, -5, 10) * 2 + Math.hypot(acc.x, acc.z) * 1.2) : 0;
      D.thrust = lerp(D.thrust, thrust, 1 - Math.exp(-5 * dt));
      player.spin(D.thrust, dt, t);
      // ground marker under the drone, fading in with height
      const g0 = groundHeight(D.p.x, D.p.z);
      const mk = smoothstep(1.5, 6, D.p.y - g0 - HOVER_H);
      marker.position.set(D.p.x, g0 + 0.12, D.p.z);
      marker.scale.setScalar(1 + 0.06 * Math.sin(t * 4));
      markerMat.opacity = 0.75 * mk;
      marker.visible = mk > 0.01;
      dropLine.position.copy(D.p);
      dropLine.scale.y = Math.max(0.01, D.p.y - g0 - 0.12);
      dropMat.opacity = 0.35 * mk;
      dropLine.visible = mk > 0.01;
    }

    /* ------------------------------------------------------------------
       Camera: intro orbit → chase cam
       ------------------------------------------------------------------ */
    // Slanted bird's-eye chase camera: high, pulled back, looking a little ahead of the drone
    const CAM_DIST = 30;        // metres from the drone (scaled by mouse-wheel zoom)
    const CAM_ELEV = 1.02;      // ~58° above the horizon
    const CAM_LOOKAHEAD = 6;    // aim this far ahead so more of the route is visible
    const CAM = { mode: 'intro', blend: 0, dist: 1, yawOff: 0, elev: CAM_ELEV, drag: false };
    let snapCamera = true;
    const camPos = new V3(), camLook = new V3(), chasePos = new V3(), chaseLook = new V3(), introPos = new V3(), introLook = new V3();
    function updateCamera(dt, t) {
      const ia = t * 0.045 + 0.6;
      introPos.set(Math.sin(ia) * 175, 82, Math.cos(ia) * 175);
      introLook.set(0, 12, -10);
      const yaw = D.yaw + CAM.yawOff;
      CAM.autoK = lerp(CAM.autoK || 0, AP.active ? 1 : 0, 1 - Math.exp(-1.5 * dt));
      const d = CAM_DIST * CAM.dist * (1 + 0.18 * CAM.autoK);
      const el = clamp(CAM.elev + 0.04 * CAM.autoK, 0.25, 1.45);
      chasePos.set(D.p.x + Math.sin(yaw) * Math.cos(el) * d, D.p.y + Math.sin(el) * d + 0.8, D.p.z + Math.cos(yaw) * Math.cos(el) * d);
      const gh = groundHeight(chasePos.x, chasePos.z) + 0.6;
      if (chasePos.y < gh) chasePos.y = gh;
      // never put the camera inside a building: lift it above the roof instead
      for (const c of colliders) {
        const dx = chasePos.x - c.cx, dz = chasePos.z - c.cz;
        const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) < c.hx + 1.5 && Math.abs(lz) < c.hz + 1.5) {
          const top = c.cy + c.hy + 2.5;
          if (chasePos.y < top && chasePos.y > c.cy - c.hy - 1) chasePos.y = top;
        }
      }
      chaseLook.set(D.p.x - Math.sin(D.yaw) * CAM_LOOKAHEAD * CAM.dist, D.p.y, D.p.z - Math.cos(D.yaw) * CAM_LOOKAHEAD * CAM.dist);
      if (!CAM.drag) { CAM.yawOff *= Math.exp(-1.6 * dt); CAM.elev = lerp(CAM.elev, CAM_ELEV, 1 - Math.exp(-0.8 * dt)); }
      if (CAM.mode === 'intro') {
        camPos.copy(introPos); camLook.copy(introLook);
      } else {
        if (snapCamera) { camPos.copy(chasePos); camLook.copy(chaseLook); snapCamera = false; }
        const k = 1 - Math.exp(-(6.5 + 3 * (CAM.autoK || 0)) * dt);
        camPos.lerp(chasePos, k);
        camLook.lerp(chaseLook, 1 - Math.exp(-9 * dt));
        if (CAM.blend < 1) {
          CAM.blend = Math.min(1, CAM.blend + dt / 2.4);
          const b = smoothstep(0, 1, CAM.blend);
          camera.position.lerpVectors(introPos, camPos, b);
          tmpR.lerpVectors(introLook, camLook, b);
          camera.lookAt(tmpR);
          return;
        }
      }
      camera.position.copy(camPos);
      camera.lookAt(camLook);
    }

    /* ------------------------------------------------------------------
       Main update
       ------------------------------------------------------------------ */
    let time = 0;
    const tmpV = new V3();
    function update(dt, input, frozen) {
      time += dt;
      const t = time;
      stepDrone(dt, CAM.mode === 'intro' ? null : input, t, frozen);
      updateTrail(dt);
      updateCamera(dt, t);
      // animated buildings
      for (const f of animators) f(t, dt, D.p);
      // clouds drift
      for (const c of clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 700) c.position.x = -700; }
      // nearest zone + pad / beacon effects
      near = null;
      let best = 1e9;
      for (const z of zones) {
        const dh = Math.hypot(D.p.x - z.pad.x, D.p.z - z.pad.z);
        const isNear = dh < 13 && D.p.y < 34;
        if (isNear && dh < best) { best = dh; near = z; }
        const pulse = isNear ? 2.6 + Math.sin(t * 6) * 1.2 : 2.2;
        z.ringMat.color.set(z.accent).multiplyScalar(pulse);
      }
      for (const b of beacons) {
        const z = zones.find((q) => q.id === b.zone);
        const dist = tmpV.set(z.pad.x - camera.position.x, 0, z.pad.z - camera.position.z).length();
        b.mat.opacity = 0.19 * smoothstep(22, 120, dist);
        b.mesh.visible = b.mat.opacity > 0.003;
      }
      // shadows follow the drone (or the plaza during intro)
      const focus = CAM.mode === 'intro' ? tmpV.set(0, 0, -20) : tmpV.set(D.p.x - Math.sin(D.yaw) * 30, 0, D.p.z - Math.cos(D.yaw) * 30);
      sun.position.set(focus.x + sunDir.x * 200, sunDir.y * 200, focus.z + sunDir.z * 200);
      sun.target.position.set(focus.x, 0, focus.z);
      sky.position.copy(camera.position);
      refLineMat.opacity = AP.active ? 0.85 : Math.max(0, refLineMat.opacity - dt * 0.6);
      refLine.visible = refLineMat.opacity > 0.01;
    }

    function render() {
      if (quality === 'high' && composer) composer.render();
      else renderer.render(scene, camera);
    }

    applyQuality();

    const projV = new V3();
    return {
      on,
      update,
      render,
      resize,
      setQuality(q) { quality = q; applyQuality(); },
      get quality() { return quality; },
      start() {
        CAM.mode = 'chase';
        CAM.blend = 0;
        snapCamera = true;
        D.armed = true;
        D.mode = 'POSCTL';
        D.v.set(0, 2.5, 0);
        emit('mode', D.mode);
      },
      get started() { return CAM.mode !== 'intro'; },
      flyTo,
      cancelAuto,
      teleportTo,
      hold() { AP.hold.copy(D.p); if (!AP.active) { D.mode = 'AUTO.LOITER'; emit('mode', D.mode); } },
      zones,
      nearZone() { return near; },
      zoom(f) { CAM.dist = clamp(CAM.dist * f, 0.4, 2.0); },
      orbit(dx, dy) { CAM.yawOff = clamp(CAM.yawOff - dx * 0.006, -Math.PI, Math.PI); CAM.elev = clamp(CAM.elev + dy * 0.004, 0.25, 1.45); },
      setDragging(b) { CAM.drag = b; },
      telemetry() {
        return {
          x: D.p.x, z: D.p.z, alt: D.p.y - HOVER_H, speed: D.v.length(), hspeed: Math.hypot(D.v.x, D.v.z), vs: D.v.y,
          yaw: D.yaw, heading: ((-D.yaw * 180 / Math.PI) % 360 + 360) % 360,
          pitch: D.pitch, roll: D.roll, mode: D.mode, geofence: D.geofence, auto: AP.active, autoZone: AP.zone ? AP.zone.id : null,
          thrust: D.thrust, armed: D.armed
        };
      },
      project(v3, out) {
        projV.copy(v3).project(camera);
        out.x = (projV.x * 0.5 + 0.5) * window.innerWidth;
        out.y = (-projV.y * 0.5 + 0.5) * window.innerHeight;
        out.visible = projV.z < 1 && projV.z > -1;
        out.dist = camera.position.distanceTo(v3);
        return out;
      },
      ringsTotal() { return arenaRings.length; }
    };
  }

  window.createWorld = createWorld;
})();

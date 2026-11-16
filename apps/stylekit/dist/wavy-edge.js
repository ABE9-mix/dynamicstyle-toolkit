/*! StyleKit · wavy-edge  |  噪声生成波浪边缘的纯色块组件
 *  <wavy-edge w="520" h="340" fill="#c8f751" amp="6.5" waves="9"></wavy-edge>
 *  属性：w h radius amp waves octaves lacunarity gain warp drift speed mode seed
 *        fill stroke stroke-w stroke-color shadow shadow-blur shadow-y shadow-color shadow-alpha
 *  MIT — 直接用，改到爆。 */
/* ============================================================
   StyleKit · noise.js
   依赖：无。挂载到 window.SKNoise。
   提供：seeded 3D simplex noise（Gustavson 风格）+ 工具函数
   ============================================================ */
(function (global) {
  'use strict';

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const GRAD3 = new Int8Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
    1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
    0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
  ]);

  // 标准 simplex 3D，返回约 [-1, 1]
  function makeNoise3(seed) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    const rng = mulberry32(seed);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    const perm = new Uint8Array(512);
    const permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
      permMod12[i] = perm[i] % 12;
    }

    const F3 = 1 / 3, G3 = 1 / 6;

    return function noise3(xin, yin, zin) {
      const s = (xin + yin + zin) * F3;
      const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
      const t = (i + j + k) * G3;
      const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);

      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }

      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;

      const ii = i & 255, jj = j & 255, kk = k & 255;
      let n = 0, tt, g;

      tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (tt > 0) {
        g = permMod12[ii + perm[jj + perm[kk]]] * 3;
        tt *= tt;
        n += tt * tt * (GRAD3[g] * x0 + GRAD3[g + 1] * y0 + GRAD3[g + 2] * z0);
      }
      tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (tt > 0) {
        g = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
        tt *= tt;
        n += tt * tt * (GRAD3[g] * x1 + GRAD3[g + 1] * y1 + GRAD3[g + 2] * z1);
      }
      tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (tt > 0) {
        g = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
        tt *= tt;
        n += tt * tt * (GRAD3[g] * x2 + GRAD3[g + 1] * y2 + GRAD3[g + 2] * z2);
      }
      tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (tt > 0) {
        g = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
        tt *= tt;
        n += tt * tt * (GRAD3[g] * x3 + GRAD3[g + 1] * y3 + GRAD3[g + 2] * z3);
      }
      return 32 * n;
    };
  }

  const cache = new Map();
  function noise3(seed) {
    const key = seed | 0;
    let fn = cache.get(key);
    if (!fn) { fn = makeNoise3(key); cache.set(key, fn); }
    return fn;
  }

  global.SKNoise = { noise3, mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================
   StyleKit · shape.js —— 基础形状 → 带法线的闭合折线
   产出统一格式：按弧长累积的稠密折线（点 + 外法线 + 弧长表）
   供 wavy.js 做「沿法线噪声位移」。
   支持：rect / ellipse / polygon / star / path(SVG)
   依赖：无（path 采样用浏览器自带的 SVGGeometryElement）
   ============================================================ */
(function (global) {
  'use strict';

  const cache = new Map();
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  /* ---------- 缓存键 ---------- */
  function keyOf(st) {
    return [
      st.shape || 'rect', st.w, st.h, st.radius, st.sides, st.spike, st.shapeRot,
      st.pathD ? st.pathD.length + ':' + st.pathD.slice(0, 48) : '', st.pathVb || ''
    ].join('|');
  }

  function get(st) {
    const k = keyOf(st);
    let s = cache.get(k);
    if (!s) {
      s = prep(raw(st));
      cache.set(k, s);
      if (cache.size > 48) cache.delete(cache.keys().next().value);
    }
    return s;
  }

  /* ---------- 各形状的原始折线（中心为原点，y 向下） ---------- */
  function raw(st) {
    const w = st.w, h = st.h;
    const rot = (st.shapeRot || 0) * Math.PI / 180;

    switch (st.shape) {
      case 'ellipse': return ellipse(w, h);

      case 'polygon': return polygon(w, h, Math.max(3, Math.round(st.sides || 6)), rot, 0, st.radius || 0);

      case 'star': return polygon(w, h, Math.max(3, Math.round(st.sides || 5)), rot, clamp(st.spike || 0.45, 0.1, 0.95), st.radius || 0);

      case 'path': {
        const p = pathPoints(st.pathD, st.pathVb, w, h);
        return p && p.length > 2 ? p : roundedRect(w, h, st.radius || 0);
      }

      default: return roundedRect(w, h, st.radius || 0);
    }
  }

  function ellipse(w, h) {
    const pts = [], N = 240;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2;
      pts.push([Math.cos(a) * w / 2, Math.sin(a) * h / 2]);
    }
    return pts;
  }

  function roundedRect(w, h, r) {
    const W = w / 2, H = h / 2;
    r = clamp(r, 0, Math.min(W, H));
    const pts = [];
    const ex = W - r, ey = H - r;
    const arc = (cx, cy, a0, a1) => {
      const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) * r / 2));
      for (let k = 0; k <= steps; k++) {
        const a = a0 + (a1 - a0) * k / steps;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    pts.push([-ex, -H]);            // 上边起点
    if (ex > 0) { pts.push([ex, -H]); }
    if (r > 0) arc(ex, -ey, -Math.PI / 2, 0);
    if (ey > 0) { pts.push([W, ey]); }
    if (r > 0) arc(ex, ey, 0, Math.PI / 2);
    if (ex > 0) { pts.push([-ex, H]); }
    if (r > 0) arc(-ex, ey, Math.PI / 2, Math.PI);
    if (ey > 0) { pts.push([-W, -ey]); }
    if (r > 0) arc(-ex, -ey, Math.PI, Math.PI * 1.5);
    return pts;
  }

  /* 正多边形 / 星形：顶点 → 圆角(arc fillet) */
  function polygon(w, h, n, rot, innerRatio, r) {
    const verts = [];
    if (innerRatio > 0) {
      // 星形：外/内交替，共 2n 个顶点
      for (let i = 0; i < n * 2; i++) {
        const a = rot + i * Math.PI / n - Math.PI / 2;
        const rad = i % 2 ? innerRatio : 1;
        verts.push([Math.cos(a) * rad * w / 2, Math.sin(a) * rad * h / 2]);
      }
    } else {
      for (let i = 0; i < n; i++) {
        const a = rot + i * Math.PI * 2 / n - Math.PI / 2;
        verts.push([Math.cos(a) * w / 2, Math.sin(a) * h / 2]);
      }
    }
    return r > 0.5 ? fillet(verts, r) : verts;
  }

  function fillet(poly, r) {
    const out = [], n = poly.length;
    for (let i = 0; i < n; i++) {
      const A = poly[(i - 1 + n) % n], V = poly[i], B = poly[(i + 1) % n];
      const ux = A[0] - V[0], uy = A[1] - V[1];
      const vx = B[0] - V[0], vy = B[1] - V[1];
      const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
      if (lu < 1e-6 || lv < 1e-6) { out.push(V); continue; }
      const u = [ux / lu, uy / lu], v = [vx / lv, vy / lv];
      const cosT = clamp(u[0] * v[0] + u[1] * v[1], -1, 1);
      const th = Math.acos(cosT);
      if (th < 0.05 || th > Math.PI - 0.05) { out.push(V); continue; }

      let t = r / Math.tan(th / 2);
      t = Math.min(t, lu * 0.48, lv * 0.48);
      const rr = t * Math.tan(th / 2);
      if (rr < 0.3) { out.push(V); continue; }

      const p1 = [V[0] + u[0] * t, V[1] + u[1] * t];
      const p2 = [V[0] + v[0] * t, V[1] + v[1] * t];
      let bx = u[0] + v[0], by = u[1] + v[1];
      const bl = Math.hypot(bx, by) || 1;
      const dist = rr / Math.sin(th / 2);
      const C = [V[0] + bx / bl * dist, V[1] + by / bl * dist];

      let a1 = Math.atan2(p1[1] - C[1], p1[0] - C[0]);
      let a2 = Math.atan2(p2[1] - C[1], p2[0] - C[0]);
      let d = a2 - a1;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const steps = Math.max(2, Math.ceil(Math.abs(d) / 0.12));
      for (let k = 0; k <= steps; k++) {
        const a = a1 + d * k / steps;
        out.push([C[0] + Math.cos(a) * rr, C[1] + Math.sin(a) * rr]);
      }
    }
    return out;
  }

  /* ---------- SVG path 采样（借浏览器 flatten，支持全部 path 命令） ---------- */
  let svgRoot = null;
  const pathCache = new Map();

  function svgEl() {
    if (svgRoot) return svgRoot;
    svgRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgRoot.setAttribute('width', '0');
    svgRoot.setAttribute('height', '0');
    svgRoot.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden';
    document.body.appendChild(svgRoot);
    return svgRoot;
  }

  function pathPoints(d, vb, w, h) {
    if (!d) return null;
    const k = d + '|' + (vb || '');
    let pts = pathCache.get(k);
    if (!pts) {
      try {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        el.setAttribute('d', d);
        svgEl().appendChild(el);
        const total = el.getTotalLength();
        if (!total || !isFinite(total)) { el.remove(); return null; }
        const N = clamp(Math.round(total / 2), 120, 900);
        pts = [];
        for (let i = 0; i < N; i++) {
          const p = el.getPointAtLength(i / N * total);
          pts.push([p.x, p.y]);
        }
        el.remove();
      } catch (e) { return null; }
      pathCache.set(k, pts);
    }
    // 归一化：等比缩放进 w×h 的框，居中
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const bw = maxX - minX || 1, bh = maxY - minY || 1;
    const s = Math.min(w / bw, h / bh);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    return pts.map(([x, y]) => [(x - cx) * s, (y - cy) * s]);
  }

  /* ---------- 折线 → 稠密采样 + 法线 + 弧长表 ---------- */
  function prep(poly) {
    // 0) 去掉重复点：cusp 处重采样会产生零长线段，法线会算出 0 向量
    const clean = [];
    for (const p of poly) {
      const last = clean[clean.length - 1];
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.05) clean.push(p);
    }
    if (clean.length > 2) {
      const f = clean[0], l = clean[clean.length - 1];
      if (Math.hypot(f[0] - l[0], f[1] - l[1]) <= 0.05) clean.pop();
    }
    poly = clean.length > 2 ? clean : poly;

    // 1) 抽稀/加密到 ≤2px 间距（保证法线与弧长准确）
    const dense = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.ceil(len / 2));
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        dense.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }

    const m = dense.length;
    const xs = new Float32Array(m), ys = new Float32Array(m);
    const nx = new Float32Array(m), ny = new Float32Array(m);
    const cum = new Float32Array(m + 1);

    for (let i = 0; i < m; i++) { xs[i] = dense[i][0]; ys[i] = dense[i][1]; }

    // 2) 弧长
    let total = 0;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      total += Math.hypot(xs[j] - xs[i], ys[j] - ys[i]);
      cum[i + 1] = total;
    }

    // 3) 法线：邻居切线的垂线，再用质心判朝向
    for (let i = 0; i < m; i++) {
      const a = (i - 1 + m) % m, b = (i + 1) % m;
      const tx = xs[b] - xs[a], ty = ys[b] - ys[a];
      const l = Math.hypot(tx, ty) || 1;
      nx[i] = ty / l;
      ny[i] = -tx / l;
    }
    let dotSum = 0;
    for (let i = 0; i < m; i++) dotSum += nx[i] * xs[i] + ny[i] * ys[i];
    if (dotSum < 0) { for (let i = 0; i < m; i++) { nx[i] = -nx[i]; ny[i] = -ny[i]; } }

    // 4) 法线平滑：多边形/星形的尖角处法线会突跳，位移后容易出尖刺；
    //    沿周长做两遍邻域平均（再归一化），圆滑过渡且不改变轮廓本身
    const SMOOTH_PASSES = 4, SMOOTH_K = 3;
    for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
      const tx = new Float32Array(m), ty = new Float32Array(m);
      for (let i = 0; i < m; i++) {
        const a = (i - SMOOTH_K + m) % m, b = (i + SMOOTH_K) % m;
        tx[i] = nx[a] + nx[i] * 2 + nx[b];
        ty[i] = ny[a] + ny[i] * 2 + ny[b];
      }
      for (let i = 0; i < m; i++) {
        const l = Math.hypot(tx[i], ty[i]);
        if (l < 1e-6) { nx[i] = nx[(i - 1 + m) % m]; ny[i] = ny[(i - 1 + m) % m]; continue; }
        nx[i] = tx[i] / l; ny[i] = ty[i] / l;
      }
    }

    // 5) 局部曲率半径：位移不能超过它，否则尖角处偏移曲线会自交、长出细刺
    const rad = new Float32Array(m);
    const K = 4;   // 用 ±4 个采样点估曲率（约 ±8px），避免离散尖角算出无穷曲率
    for (let i = 0; i < m; i++) {
      const a = (i - K + m) % m, b = (i + K) % m;
      const ax = xs[i] - xs[a], ay = ys[i] - ys[a];
      const bx = xs[b] - xs[i], by = ys[b] - ys[i];
      const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
      const cosT = clamp((ax * bx + ay * by) / (la * lb), -1, 1);
      const dth = Math.acos(cosT);
      const ds = cum[i + K > m ? m : i + K] - cum[Math.max(0, i - K)];
      const kappa = dth / Math.max(ds, 1e-3);
      rad[i] = kappa > 1e-5 ? 1 / kappa : 1e6;
    }
    // 取邻域最小值（把尖角附近一圈都压住）：只夹住尖点本身没用，
    // 尖点旁边一个采样点仍会按大半径位移，直接越过尖点形成「火苗」
    const W = 6;
    const tmp = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      let mn = rad[i];
      for (let k = -W; k <= W; k++) mn = Math.min(mn, rad[(i + k + m) % m]);
      tmp[i] = mn;
    }
    rad.set(tmp);
    // 再轻微平滑，避免逐点抖动
    for (let pass = 0; pass < 3; pass++) {
      const t2 = new Float32Array(m);
      for (let i = 0; i < m; i++) t2[i] = (rad[(i - 1 + m) % m] + rad[i] * 2 + rad[(i + 1) % m]) / 4;
      rad.set(t2);
    }

    return { xs, ys, nx, ny, rad, cum, total, count: m };
  }

  /* 按弧长取点（线性插值点与法线） */
  function sample(sh, s) {
    const total = sh.total;
    s = ((s % total) + total) % total;
    const cum = sh.cum;
    let lo = 0, hi = sh.count - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cum[mid] <= s) lo = mid; else hi = mid - 1;
    }
    const i = lo, j = (i + 1) % sh.count;
    const seg = cum[i + 1] - cum[i] || 1;
    const t = (s - cum[i]) / seg;
    return {
      x: sh.xs[i] + (sh.xs[j] - sh.xs[i]) * t,
      y: sh.ys[i] + (sh.ys[j] - sh.ys[i]) * t,
      nx: sh.nx[i] + (sh.nx[j] - sh.nx[i]) * t,
      ny: sh.ny[i] + (sh.ny[j] - sh.ny[i]) * t,
      rad: sh.rad ? sh.rad[i] + (sh.rad[j] - sh.rad[i]) * t : 1e6
    };
  }

  /* ---------- SVG 导入：取文件里第一个可测轮廓，转成简化后的 path d ---------- */
  function measureRoot() { return svgEl(); }

  function distToSeg(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (!l2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    t = clamp(t, 0, 1);
    return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
  }

  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    let dmax = 0, idx = 0;
    const a = pts[0], b = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++) {
      const d = distToSeg(pts[i], a, b);
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax > eps) {
      const l = rdp(pts.slice(0, idx + 1), eps);
      const r = rdp(pts.slice(idx), eps);
      return l.slice(0, -1).concat(r);
    }
    return [a, b];
  }

  const SVG_TAGS = ['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'line'];

  function fromSvgText(text) {
    // 先用 HTML 解析器：它会把 <svg> 放进正确的 SVG 命名空间（XML 解析器遇到
    // 缺 xmlns 的文件会得到「无命名空间元素」，getTotalLength 就没了）
    let doc = new DOMParser().parseFromString(text, 'text/html');
    let svg = doc.querySelector('svg');
    if (!svg) {
      doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      if (doc.querySelector('parsererror')) return null;
      svg = doc.querySelector('svg');
    }
    if (!svg) return null;

    let src = null;
    for (const tag of SVG_TAGS) {
      src = svg.querySelector(tag);
      if (src) break;
    }
    if (!src) return null;

    const clone = src.cloneNode(true);
    svgEl().appendChild(clone);

    let pts = [];
    try {
      const total = clone.getTotalLength ? clone.getTotalLength() : 0;
      if (total && isFinite(total)) {
        const N = clamp(Math.round(total / 1.5), 120, 1200);
        for (let i = 0; i < N; i++) {
          const p = clone.getPointAtLength(i / N * total);
          pts.push([p.x, p.y]);
        }
      }
    } catch (e) { pts = []; }
    clone.remove();

    if (pts.length < 6) return null;

    // 多子路径（如「头 + 身」两个形状）会被 getPointAtLength 连成一条直线：
    // 按「相邻采样点距离突然变大」切段，只保留最长的那一段
    const runs = [];
    let cur = [pts[0]];
    const dists = [];
    for (let i = 1; i < pts.length; i++) {
      dists.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    const sorted = dists.slice().sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)] || 1;
    const jump = Math.max(med * 8, med + 2);
    for (let i = 1; i < pts.length; i++) {
      if (dists[i - 1] > jump) { runs.push(cur); cur = [pts[i]]; }
      else cur.push(pts[i]);
    }
    runs.push(cur);
    if (runs.length > 1) {
      runs.sort((a, b) => b.length - a.length);
      pts = runs[0];
      if (pts.length < 6) return null;
    }

    // 简化：闭合环 → 首尾重复后做 RDP
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const diag = Math.hypot(maxX - minX, maxY - minY) || 1;
    const simplified = rdp(pts.concat([pts[0]]), diag * 0.004);
    simplified.pop();   // 去掉重复的收尾点

    const d = 'M' + simplified.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L') + 'Z';

    return {
      d,
      pts: simplified.length,
      name: src.tagName.toLowerCase(),
      box: [maxX - minX, maxY - minY]
    };
  }

  global.SKShape = { get, sample, raw, prep, pathPoints, fillet, roundedRect, polygon, ellipse, fromSvgText, measureRoot };
})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================
   StyleKit · wavy.js
   效果 #1：NoiseEdge Block —— 噪声生成波浪边缘的纯色块
   依赖：window.SKNoise
   核心：把圆角矩形的周长参数化，沿外法线用「周期性 3D 噪声」
        做位移，得到一条永不破碎的闭合曲线。
   ============================================================ */
(function (global) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- 默认参数 ---------- */
  const defaults = {
    name: '未命名块',
    w: 520, h: 340,
    radius: 44,

    amp: 9,            // 振幅：占 min(w,h) 的百分比
    waves: 5,          // 周长上的波数
    octaves: 2,        // 噪声层数
    lacunarity: 2.1,   // 每层频率倍率
    gain: 0.38,        // 每层振幅倍率
    warp: 0.8,         // 周向域扭曲（不打乱闭合性）
    drift: 0.6,        // 波沿周长漂移速度
    speed: 0.4,        // 噪声时间演化速度
    mode: 'fbm',       // fbm | ridged | billow | sharp
    seed: 7,

    shape: 'rect',     // rect | ellipse | polygon | star | path
    sides: 6,          // 多边形边数 / 星形角数
    spike: 0.45,       // 星形内径比例
    shapeRot: 0,       // 基础形状自身的旋转（度）
    pathD: '',         // 导入的 SVG path d
    pathVb: '',        // 原始 viewBox（仅记录用）

    fill: '#c8f751',
    stroke: false, strokeW: 2, strokeColor: '#0b0b0e',
    shadow: true, shadowBlur: 34, shadowY: 18, shadowColor: '#000000', shadowAlpha: 0.42
  };

  /* ---------- 参数面板 schema（UI 由它自动生成） ---------- */
  const ICONS = {
    rect: '<svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="12" rx="3"/></svg>',
    ellipse: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8.5" ry="6.5"/></svg>',
    polygon: '<svg viewBox="0 0 24 24"><path d="M12 3.2l7.6 4.4v8.8L12 20.8l-7.6-4.4V7.6z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.3L12 17.1l-5.6 3.1 1.3-6.3L3 9.6l6.3-.7z"/></svg>',
    path: '<svg viewBox="0 0 24 24"><path d="M4 17c3-1 3-10 6-10s2 7 5 7 3-4 5-4"/></svg>'
  };

  const schema = [
    { group: '基础形状', items: [
      { key: 'shape', label: '形状', type: 'iconbar', options: [
        ['rect', '矩形', ICONS.rect],
        ['ellipse', '椭圆', ICONS.ellipse],
        ['polygon', '多边形', ICONS.polygon],
        ['star', '星形', ICONS.star],
        ['path', 'SVG 路径', ICONS.path]
      ] },
      { key: 'sides', label: '边数', type: 'range', min: 3, max: 24, step: 1, unit: '边', whenIn: ['polygon', 'star'] },
      { key: 'spike', label: '星形内径', type: 'range', min: 0.15, max: 0.9, step: 0.01, whenIn: ['star'] },
      { key: 'shapeRot', label: '形状旋转', type: 'range', min: -180, max: 180, step: 1, unit: '°' },
      { key: 'svg', label: 'SVG 文件', type: 'import', accept: '.svg,image/svg+xml', hint: '取文件里第一个图形轮廓' }
    ] },
    { group: '几何', items: [
      { key: 'w', label: '宽', type: 'range', min: 120, max: 900, step: 1, unit: 'px' },
      { key: 'h', label: '高', type: 'range', min: 120, max: 900, step: 1, unit: 'px' },
      { key: 'radius', label: '圆角', type: 'range', min: 0, max: 300, step: 1, unit: 'px' }
    ] },
    { group: '噪声形状', items: [
      { key: 'mode', label: '噪声模式', type: 'select', options: [
        ['fbm', 'fbm · 有机波浪'], ['ridged', 'ridged · 尖脊'], ['billow', 'billow · 鼓包'], ['sharp', 'sharp · 硬波']
      ] },
      { key: 'amp', label: '振幅', type: 'range', min: 0, max: 40, step: 0.1, unit: '%' },
      { key: 'waves', label: '波数', type: 'range', min: 0.5, max: 60, step: 0.5, unit: '个/周' },
      { key: 'octaves', label: '细节层数', type: 'range', min: 1, max: 6, step: 1, unit: '层' },
      { key: 'lacunarity', label: '频率倍率', type: 'range', min: 1.2, max: 3.6, step: 0.05 },
      { key: 'gain', label: '振幅衰减', type: 'range', min: 0.1, max: 0.9, step: 0.01 },
      { key: 'warp', label: '域扭曲', type: 'range', min: 0, max: 2, step: 0.01 },
      { key: 'seed', label: '种子', type: 'range', min: 1, max: 999, step: 1 }
    ] },
    { group: '动画', items: [
      { key: 'drift', label: '波漂移', type: 'range', min: -3, max: 3, step: 0.01 },
      { key: 'speed', label: '形变速度', type: 'range', min: 0, max: 2, step: 0.01 }
    ] },
    { group: '颜色与边缘', items: [
      { key: 'fill', label: '填充色', type: 'color' },
      { key: 'stroke', label: '描边', type: 'toggle' },
      { key: 'strokeW', label: '描边宽', type: 'range', min: 0.5, max: 12, step: 0.5, unit: 'px', when: 'stroke' },
      { key: 'strokeColor', label: '描边色', type: 'color', when: 'stroke' }
    ] },
    { group: '投影', items: [
      { key: 'shadow', label: '投影', type: 'toggle' },
      { key: 'shadowBlur', label: '模糊', type: 'range', min: 0, max: 120, step: 1, unit: 'px', when: 'shadow' },
      { key: 'shadowY', label: '偏移 Y', type: 'range', min: -60, max: 80, step: 1, unit: 'px', when: 'shadow' },
      { key: 'shadowAlpha', label: '不透明度', type: 'range', min: 0, max: 1, step: 0.01, when: 'shadow' },
      { key: 'shadowColor', label: '投影色', type: 'color', when: 'shadow' }
    ] }
  ];

  /* ---------- 预设 ---------- */
  const presets = [
    // 用户自定，存为内置默认：黄色扁平、低振幅、wave 缓慢绕边漂移
    { name: 'tomotachi', state: {
      shape: 'rect', radius: 40, fill: '#ffc100',
      amp: 4, waves: 5, mode: 'fbm', seed: 399,
      octaves: 1, lacunarity: 1.2, gain: 0.1, warp: 0,
      drift: 0.5, speed: 0,
      stroke: false, strokeW: 2, strokeColor: '#0b0b0e',
      shadow: false, shadowBlur: 34, shadowY: 18, shadowColor: '#000000', shadowAlpha: 0.42
    } },
    { name: '液态塑料', state: { fill: '#c8f751', mode: 'fbm', amp: 9, waves: 5, octaves: 2, lacunarity: 2.1, gain: 0.38, warp: 0.8, drift: 0.7, speed: 0.45, radius: 56 } },
    { name: '毛边纸张', state: { fill: '#f4efe4', mode: 'fbm', amp: 2, waves: 30, octaves: 4, lacunarity: 2.5, gain: 0.5, warp: 1.0, drift: 0.05, speed: 0.16, radius: 8 } },
    { name: '呼吸软块', state: { fill: '#ff6b3d', mode: 'fbm', amp: 13, waves: 3, octaves: 2, lacunarity: 2, gain: 0.45, warp: 0.4, drift: 0, speed: 0.5, radius: 110 } },
    { name: '尖脊撕口', state: { fill: '#8b6bff', mode: 'ridged', amp: 10, waves: 9, octaves: 3, lacunarity: 2.1, gain: 0.5, warp: 0.9, drift: 0.25, speed: 0.35, radius: 20 } },
    { name: '细微波纹', state: { fill: '#7fd8ff', mode: 'billow', amp: 1.4, waves: 40, octaves: 3, lacunarity: 2.2, gain: 0.45, warp: 0.3, drift: 1.0, speed: 0.3, radius: 40 } },
    { name: '硬波锯齿', state: { fill: '#ffd23f', mode: 'sharp', amp: 9, waves: 12, octaves: 2, lacunarity: 2.6, gain: 0.6, warp: 0.2, drift: 0.9, speed: 0.25, radius: 10 } }
  ];

  /* ---------- 圆角矩形周长参数化 ---------- */
  function buildSampler(w, h, r) {
    const W = w / 2, H = h / 2;
    r = clamp(r, 0, Math.min(W, H));
    const ex = W - r, ey = H - r;
    const parts = [];

    function add(len, at) { if (len > 1e-9) parts.push({ len, at }); }

    // 上边：(-ex,-H) → (ex,-H)
    add(ex * 2, l => ({ x: -ex + l, y: -H, nx: 0, ny: -1 }));
    // 右上角：-90° → 0°
    add(Math.PI / 2 * r, l => { const a = -Math.PI / 2 + l / r; return { x: ex + Math.cos(a) * r, y: -ey + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }; });
    // 右边
    add(ey * 2, l => ({ x: W, y: -ey + l, nx: 1, ny: 0 }));
    // 右下角：0° → 90°
    add(Math.PI / 2 * r, l => { const a = l / r; return { x: ex + Math.cos(a) * r, y: ey + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }; });
    // 下边：(ex,H) → (-ex,H)
    add(ex * 2, l => ({ x: ex - l, y: H, nx: 0, ny: 1 }));
    // 左下角：90° → 180°
    add(Math.PI / 2 * r, l => { const a = Math.PI / 2 + l / r; return { x: -ex + Math.cos(a) * r, y: ey + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }; });
    // 左边
    add(ey * 2, l => ({ x: -W, y: ey - l, nx: -1, ny: 0 }));
    // 左上角：180° → 270°
    add(Math.PI / 2 * r, l => { const a = Math.PI + l / r; return { x: -ex + Math.cos(a) * r, y: -ey + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }; });

    let total = 0;
    for (const p of parts) { p.start = total; total += p.len; }

    function at(s) {
      s = ((s % total) + total) % total;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (s <= p.start + p.len) return p.at(s - p.start);
      }
      const last = parts[parts.length - 1];
      return last.at(last.len);
    }
    return { total, at };
  }

  function shape(v, mode) {
    switch (mode) {
      case 'ridged': return (1 - Math.abs(v)) * 2 - 1;
      case 'billow': return Math.abs(v) * 2 - 1;
      case 'sharp': return Math.sign(v) * Math.pow(Math.abs(v), 1.8);
      // 默认 fbm：原始 fbm 输出集中在 0 附近，边缘会「大部分是直的、偶尔鼓一下」。
      // 用 tanh 做一次软压缩，让整个边缘都吃到位移，同时峰值不越界。
      default: return Math.tanh(v * 1.35) / 0.874;
    }
  }

  /* 在当前参数下的振幅（像素） */
  function ampPx(st) { return (st.amp / 100) * Math.min(st.w, st.h); }

  /* 画布需要的外扩留白 */
  function pad(st) {
    const a = ampPx(st) * 1.15 + 10;
    const sh = st.shadow ? (st.shadowBlur * 0.7 + Math.abs(st.shadowY) * 0.6) : 0;
    return Math.ceil(a + sh + 18);
  }

  /* 逐点生成轮廓（以块中心为原点）
     底形由 SKShape 提供（矩形/椭圆/多边形/星形/SVG），这里只负责沿法线做噪声位移 */
  function outline(st, time) {
    const sh = SKShape.get(st);
    const P = sh.total;
    const n = clamp(Math.round(P / 2.0), 320, 2600);
    const A = ampPx(st);
    const nz = SKNoise.noise3(st.seed | 0);
    const oct = Math.max(1, Math.round(st.octaves));
    const waves = Math.max(0.5, st.waves);
    const lac = Math.max(1.01, st.lacunarity);
    const gain = clamp(st.gain, 0.01, 0.99);
    const drift = st.drift, z = time * st.speed;
    const pts = new Float32Array(n * 2);
    const offs = new Float32Array(n), rads = new Float32Array(n);
    const px = new Float32Array(n), py = new Float32Array(n);
    const pnx = new Float32Array(n), pny = new Float32Array(n);
    const TWO_PI = Math.PI * 2;

    for (let i = 0; i < n; i++) {
      const s = i / n * P;
      const p = SKShape.sample(sh, s);
      let t = s / P;

      // 周向域扭曲：仍以「周期 1」采样，所以 t=0 与 t=1 结果相同，接缝无缝
      if (st.warp > 0) {
        const wa = t * TWO_PI;
        t += st.warp * 0.05 * nz(Math.cos(wa) * 1.3, Math.sin(wa) * 1.3, z * 0.6 + 57.7);
      }

      // 在噪声空间里沿「圆」走一圈 → 位移天然对 t 周期化
      const ang = t * TWO_PI + drift * time;
      const ca = Math.cos(ang), sa = Math.sin(ang);

      let v = 0, sum = 0, a = 1, Rf = waves / TWO_PI;
      for (let o = 0; o < oct; o++) {
        v += a * nz(ca * Rf, sa * Rf, z + o * 17.13);
        sum += a;
        Rf *= lac;
        a *= gain;
      }
      v = shape(v / (sum || 1), st.mode);

      // 偏移量不能超过局部曲率半径，否则尖角处会自交（表现为一根细刺）
      let off = A * v;
      const lim = Math.max(0.6, (p.rad || 1e6) * 0.9);
      if (Math.abs(off) > lim) off = Math.sign(off) * lim;

      offs[i] = off;
      rads[i] = p.rad || 1e6;
      px[i] = p.x; py[i] = p.y; pnx[i] = p.nx; pny[i] = p.ny;
    }

    // 空间平滑：尖角两侧在「参数上」离得远、在「空间上」挨得近，各自独立位移就会
    // 把尖点夹成一根细刺。这里按局部曲率半径决定模糊半径（越尖糊得越宽），
    // 让尖点及其两侧共享同一段位移，尖端整体平移而不是被撕开。
    let src = offs;
    for (let pass = 0; pass < 2; pass++) {
      const dst = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const w = Math.min(n >> 2, Math.max(1, Math.round(26 / (rads[i] * 0.25 + 1))));
        let sum = 0, cnt = 0;
        for (let k = -w; k <= w; k++) { sum += src[(i + k + n) % n]; cnt++; }
        dst[i] = sum / cnt;
      }
      src = dst;
    }

    for (let i = 0; i < n; i++) {
      const off = src[i];
      pts[i * 2] = px[i] + pnx[i] * off;
      pts[i * 2 + 1] = py[i] + pny[i] * off;
    }
    return pts;
  }

  function pathD(pts, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    const n = pts.length >> 1;
    let d = 'M' + (pts[0] + ox).toFixed(2) + ' ' + (pts[1] + oy).toFixed(2);
    for (let i = 1; i < n; i++) {
      d += 'L' + (pts[i * 2] + ox).toFixed(2) + ' ' + (pts[i * 2 + 1] + oy).toFixed(2);
    }
    return d + 'Z';
  }

  /* 供 CSS clip-path 用：归一化到 [0,1] 的 padded box */
  function polygonPoints(st, time) {
    const p = pad(st);
    const bw = st.w + p * 2, bh = st.h + p * 2;
    const pts = outline(st, time);
    const n = pts.length >> 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = (pts[i * 2] + st.w / 2 + p) / bw * 100;
      const y = (pts[i * 2 + 1] + st.h / 2 + p) / bh * 100;
      out.push(x.toFixed(2) + '% ' + y.toFixed(2) + '%');
    }
    return { box: { w: bw, h: bh }, points: out };
  }

  global.SKWavy = {
    id: 'wavy-edge',
    label: '波浪边缘块',
    defaults, schema, presets,
    buildSampler, outline, pathD, pad, ampPx, polygonPoints,
    shape: (st) => SKShape.get(st)
  };
})(typeof window !== 'undefined' ? window : globalThis);


/* ============================================================
   StyleKit · wavy-element.js
   <wavy-edge> 自定义元素：把噪声轮廓渲染成可动画的 canvas 组件
   依赖：window.SKNoise, window.SKWavy
   用法：
     <wavy-edge w="520" h="340" fill="#c8f751" amp="6.5" waves="9"></wavy-edge>
     <wavy-edge paused></wavy-edge>   // 冻结在 t=0
   ============================================================ */
(function (global) {
  'use strict';

  const ATTRS = ['w', 'h', 'radius', 'shape', 'sides', 'spike', 'shape-rot', 'path-d', 'path-vb',
    'amp', 'waves', 'octaves', 'lacunarity', 'gain',
    'warp', 'drift', 'speed', 'mode', 'seed', 'fill', 'stroke', 'stroke-w',
    'stroke-color', 'shadow', 'shadow-blur', 'shadow-y', 'shadow-color', 'shadow-alpha'];

  const MAP = {
    'stroke-w': 'strokeW', 'stroke-color': 'strokeColor',
    'shadow-blur': 'shadowBlur', 'shadow-y': 'shadowY',
    'shadow-color': 'shadowColor', 'shadow-alpha': 'shadowAlpha',
    'shape-rot': 'shapeRot', 'path-d': 'pathD', 'path-vb': 'pathVb'
  };

  const BOOL = new Set(['stroke', 'shadow']);

  function camel(k) { return MAP[k] || k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

  class WavyEdge extends HTMLElement {
    static get observedAttributes() { return ATTRS; }

    constructor() {
      super();
      this._canvas = null;
      this._ctx = null;
      this._raf = 0;
      this._t0 = 0;
      this._visible = true;
      this._io = null;
    }

    get state() {
      const st = Object.assign({}, SKWavy.defaults);
      for (const a of ATTRS) {
        if (!this.hasAttribute(a)) continue;
        const key = camel(a);
        const raw = this.getAttribute(a);
        if (BOOL.has(key)) st[key] = raw !== 'false' && raw !== '0';
        else if (key === 'fill' || key === 'strokeColor' || key === 'shadowColor' || key === 'mode' || key === 'shape' || key === 'pathD' || key === 'pathVb') st[key] = raw;
        else {
          const num = parseFloat(raw);
          st[key] = Number.isFinite(num) ? num : st[key];
        }
      }
      return st;
    }

    set state(patch) {
      for (const [k, v] of Object.entries(patch)) {
        const attr = Object.keys(MAP).find(a => MAP[a] === k) || k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        this.setAttribute(attr, String(v));
      }
    }

    connectedCallback() {
      if (!this._canvas) {
        this._canvas = document.createElement('canvas');
        this._canvas.style.cssText = 'display:block;width:100%;height:100%;position:absolute;inset:0';
        if (getComputedStyle(this).position === 'static') this.style.position = 'relative';
        this.appendChild(this._canvas);
        this._ctx = this._canvas.getContext('2d');
      }
      this._resize();
      if (this.hasAttribute('paused') || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.draw(0);
        return;
      }
      this._t0 = performance.now();
      this._loop = this._loop.bind(this);
      this._raf = requestAnimationFrame(this._loop);

      if ('IntersectionObserver' in global) {
        this._io = new IntersectionObserver((es) => {
          this._visible = es[0].isIntersecting;
          if (this._visible && !this._raf) this._raf = requestAnimationFrame(this._loop);
        }, { rootMargin: '120px' });
        this._io.observe(this);
      }
    }

    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      if (this._io) { this._io.disconnect(); this._io = null; }
    }

    attributeChangedCallback() {
      if (!this._ctx) return;
      this._resize();
      if (!this._raf) this.draw(0);
    }

    _loop(now) {
      if (!this._visible) { this._raf = 0; return; }
      this.draw((now - this._t0) / 1000);
      this._raf = requestAnimationFrame(this._loop);
    }

    _resize() {
      const st = this.state;
      const p = SKWavy.pad(st);
      const cssW = st.w + p * 2, cssH = st.h + p * 2;
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      this._canvas.width = Math.round(cssW * dpr);
      this._canvas.height = Math.round(cssH * dpr);
      this._canvas.style.width = cssW + 'px';
      this._canvas.style.height = cssH + 'px';
      this.style.width = cssW + 'px';
      this.style.height = cssH + 'px';
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._size = { w: cssW, h: cssH, pad: p, sx: st.w / 2 + p, sy: st.h / 2 + p };
    }

    draw(time) {
      const st = this.state;
      const ctx = this._ctx;
      if (!ctx) return;
      const { w, h, sx, sy } = this._size;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(sx, sy);
      const pts = SKWavy.outline(st, time);
      const path = new Path2D();
      path.moveTo(pts[0], pts[1]);
      for (let i = 1; i < pts.length >> 1; i++) path.lineTo(pts[i * 2], pts[i * 2 + 1]);
      path.closePath();

      if (st.shadow && st.shadowBlur > 0 || (st.shadow && st.shadowY)) {
        const [r, g, b] = hexToRgb(st.shadowColor);
        ctx.shadowColor = `rgba(${r},${g},${b},${st.shadowAlpha})`;
        ctx.shadowBlur = st.shadowBlur;
        ctx.shadowOffsetY = st.shadowY;
      }
      ctx.fillStyle = st.fill;
      ctx.fill(path);

      // 清掉阴影再描边，避免描边也带投影
      ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      if (st.stroke) {
        ctx.lineWidth = st.strokeW;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = st.strokeColor;
        ctx.stroke(path);
      }
      ctx.restore();
    }
  }

  function hexToRgb(hex) {
    let c = String(hex || '#000').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  global.WavyEdge = WavyEdge;
  if (!customElements.get('wavy-edge')) customElements.define('wavy-edge', WavyEdge);
})(typeof window !== 'undefined' ? window : globalThis);

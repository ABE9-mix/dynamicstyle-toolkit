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

/* ============================================================
   StyleKit · exporters.js
   场景：{ vw, vh, items:[ { x, y, rot, st } ] }   x/y 为块中心，rot 为弧度
   依赖：window.SKWavy
   ============================================================ */
(function (global) {
  'use strict';

  const ATTR_MAP = {
    strokeW: 'stroke-w', strokeColor: 'stroke-color',
    shadowBlur: 'shadow-blur', shadowY: 'shadow-y',
    shadowColor: 'shadow-color', shadowAlpha: 'shadow-alpha',
    shapeRot: 'shape-rot', pathD: 'path-d', pathVb: 'path-vb'
  };
  const attrName = k => ATTR_MAP[k] || k;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const r2 = n => Math.round(n * 100) / 100;
  const deg = rot => r2(((rot || 0) * 180) / Math.PI);

  function hexToRgba(hex, a) {
    let c = String(hex || '#000').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16) || 0;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------- SVG（整场，单帧） ---------- */
  function svg(scene, time) {
    const { vw, vh, items } = scene;
    let defs = '', body = '';

    items.forEach((it, i) => {
      const st = it.st;
      // 局部坐标下的路径（不含位移），由 <g> 负责摆放与旋转
      const d = SKWavy.pathD(SKWavy.outline(st, time), 0, 0);
      const fid = 'sk-sh-' + i;
      let filterAttr = '';
      if (st.shadow) {
        defs += `
    <filter id="${fid}" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="${st.shadowY}" stdDeviation="${r2(st.shadowBlur / 2)}"
        flood-color="${st.shadowColor}" flood-opacity="${st.shadowAlpha}"/>
    </filter>`;
        filterAttr = ` filter="url(#${fid})"`;
      }
      const strokeAttr = st.stroke
        ? ` stroke="${st.strokeColor}" stroke-width="${st.strokeW}" stroke-linejoin="round"`
        : '';
      const tf = `translate(${r2(it.x)} ${r2(it.y)})` + (it.rot ? ` rotate(${deg(it.rot)})` : '');
      body += `  <g transform="${tf}">\n    <path d="${d}" fill="${st.fill}"${strokeAttr}${filterAttr}/>\n  </g>\n`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vw)}" height="${r2(vh)}" viewBox="0 0 ${r2(vw)} ${r2(vh)}" fill="none">
  <defs>${defs}
  </defs>
${body}</svg>
`;
  }

  /* ---------- CSS（只导出选中变体，纯 clip-path 关键帧） ---------- */
  function loopPeriod(st) {
    const d = Math.abs(st.drift);
    if (d < 0.08) return 4;
    const T = Math.max(1, Math.round(d * 4)) / d;
    return Math.min(9, Math.max(2, T));
  }

  function stride(pts, count) {
    const n = pts.length >> 1;
    const step = Math.max(1, Math.floor(n / count));
    const out = [];
    for (let i = 0; i < n; i += step) out.push([pts[i * 2], pts[i * 2 + 1]]);
    return out;
  }

  function css(st, time, rot) {
    const FRAMES = 5, PTS = 56;
    const p = SKWavy.pad(st);
    const BW = st.w + p * 2, BH = st.h + p * 2;
    const T = loopPeriod(st);
    const toPct = (x, y) =>
      ((x + st.w / 2 + p) / BW * 100).toFixed(2) + '% ' + ((y + st.h / 2 + p) / BH * 100).toFixed(2) + '%';

    const frames = [];
    for (let f = 0; f < FRAMES; f++) {
      frames.push(stride(SKWavy.outline(st, time + f / FRAMES * T), PTS).map(([x, y]) => toPct(x, y)).join(','));
    }

    let kf = '';
    for (let f = 0; f < FRAMES; f++) {
      kf += `  ${(f / FRAMES * 100).toFixed(0)}% { clip-path: polygon(${frames[f]}); }\n`;
    }
    kf += `  100% { clip-path: polygon(${frames[0]}); }\n`;

    const rotLine = rot ? `  transform: rotate(${deg(rot)}deg);\n` : '';

    return `/* StyleKit · 波浪边缘块（纯 CSS：5 帧 clip-path 关键帧，无 JS） */
.wavy-block {
  width: ${BW}px;
  height: ${BH}px;
  background: ${st.fill};
  clip-path: polygon(${frames[0]});
${rotLine}  animation: sk-wave ${T.toFixed(2)}s linear infinite;
  will-change: clip-path;
}

@keyframes sk-wave {
${kf}}
`;
  }

  /* ---------- 独立 HTML（整场 = 若干 <wavy-edge>） ---------- */
  let bundleCache = null;
  async function bundle() {
    if (bundleCache) return bundleCache;
    const res = await fetch('dist/wavy-edge.js');
    if (!res.ok) throw new Error('无法读取 dist/wavy-edge.js（请通过 http 服务打开本页）');
    bundleCache = await res.text();
    return bundleCache;
  }

  const ATTR_ORDER = ['w', 'h', 'radius', 'shape', 'sides', 'spike', 'shapeRot', 'pathD',
    'amp', 'waves', 'octaves', 'lacunarity', 'gain', 'warp',
    'drift', 'speed', 'mode', 'seed', 'fill', 'stroke', 'strokeW', 'strokeColor',
    'shadow', 'shadowBlur', 'shadowY', 'shadowColor', 'shadowAlpha'];

  function elementTag(it, indent) {
    const st = it.st;
    const pad = indent || '';
    const p = SKWavy.pad(st);
    const left = r2(it.x - st.w / 2 - p), top = r2(it.y - st.h / 2 - p);
    const rot = it.rot ? `transform:rotate(${deg(it.rot)}deg);` : '';
    const attrs = ATTR_ORDER.filter(k => k in st).map(k => `${attrName(k)}="${esc(st[k])}"`);
    return `${pad}<wavy-edge style="left:${left}px;top:${top}px;${rot}"\n${pad}  ${attrs.join('\n' + pad + '  ')}></wavy-edge>`;
  }

  async function html(scene) {
    const src = await bundle();
    const els = scene.items.map(it => elementTag(it, '  ')).join('\n\n');
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>StyleKit 场景</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { display: grid; place-items: center; background: #0f1216;
         font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }
  /* 块按中心坐标绝对定位，旋转绕自身中心 */
  .sk-scene { position: relative; width: ${r2(scene.vw)}px; height: ${r2(scene.vh)}px; overflow: hidden; }
  .sk-scene wavy-edge { position: absolute; display: block; transform-origin: center center; }
</style>
</head>
<body>

<div class="sk-scene">

${els}

</div>

<script>
/* ---- StyleKit · wavy-edge 运行时 ---- */
${src}
</script>
</body>
</html>
`;
  }

  /* ---------- PNG（整张画布） ---------- */
  function renderCanvas(scene, time, scale) {
    scale = scale || 2;
    const cv = document.createElement('canvas');
    cv.width = Math.round(scene.vw * scale);
    cv.height = Math.round(scene.vh * scale);
    const ctx = cv.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    paint(ctx, scene, time);
    return cv;
  }

  function paint(ctx, scene, time) {
    for (const it of scene.items) {
      const st = it.st;
      const pts = SKWavy.outline(st, time);
      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.rot) ctx.rotate(it.rot);

      const path = new Path2D();
      path.moveTo(pts[0], pts[1]);
      for (let i = 1; i < pts.length >> 1; i++) path.lineTo(pts[i * 2], pts[i * 2 + 1]);
      path.closePath();

      if (st.shadow) {
        ctx.shadowColor = hexToRgba(st.shadowColor, st.shadowAlpha);
        ctx.shadowBlur = st.shadowBlur;
        ctx.shadowOffsetY = st.shadowY;
      }
      ctx.fillStyle = st.fill;
      ctx.fill(path);
      ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      if (st.stroke) {
        ctx.lineWidth = st.strokeW; ctx.lineJoin = 'round';
        ctx.strokeStyle = st.strokeColor; ctx.stroke(path);
      }
      ctx.restore();
    }
  }

  global.SKExport = { svg, css, html, renderCanvas, paint, elementTag, attrName, loopPeriod, hexToRgba, deg };
})(typeof window !== 'undefined' ? window : globalThis);

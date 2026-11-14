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


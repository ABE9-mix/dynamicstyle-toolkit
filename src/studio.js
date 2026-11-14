/* ============================================================
   StyleKit · studio.js
   全窗口画布 + 浮层 HUD + 图形上直接拖把手
   模型：scene = { vw, vh, items:[ { id, name, x, y, rot, st } ] }
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 效果注册表 ---------------- */
  const REGISTRY = {
    'wavy-edge': { label: '波浪边缘块', mod: window.SKWavy }
  };
  const effectId = 'wavy-edge';
  const effect = REGISTRY[effectId].mod;
  const DEF = effect.defaults;

  /* ---------------- 状态 ---------------- */
  const scene = { vw: 0, vh: 0, items: [] };
  let nextId = 1;
  let selId = 0;

  let playing = true;
  let t = 0;
  let lastTs = 0;

  let dirty = true;

  const openAcc = new Set();          // 展开的折叠组 id
  let bubblePinned = null;            // 用户拖过气泡后的固定位置
  let selectionVisible = true;        // 点空白处可临时藏掉把手/选框，纯看效果

  const $ = id => document.getElementById(id);
  const canvas = $('stage');
  const ctx = canvas.getContext('2d');
  const bubble = $('bubble');
  const bubbleBody = $('bubble-body');

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const r2 = n => Math.round(n * 100) / 100;
  // 去掉无意义的尾零：9.0 → 9，12.50 → 12.5，0.38 → 0.38
  const fmt = (v, step) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return String(v);
    const d = step >= 1 ? 0 : (step >= 0.1 ? 1 : 2);
    return v.toFixed(d).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1');
  };
  const sel = () => scene.items.find(i => i.id === selId) || scene.items[0];

  function normHex(h) {
    let c = String(h || '#000000').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(c)) c = '000000';
    return '#' + c.toLowerCase();
  }

  /* ---------------- 尺寸 ---------------- */
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    scene.vw = w; scene.vh = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------------- 几何工具 ---------------- */
  function rotPt(x, y, r) {
    const c = Math.cos(r || 0), s = Math.sin(r || 0);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  function corners(it) {
    const hw = it.st.w / 2, hh = it.st.h / 2;
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const p = rotPt(sx * hw, sy * hh, it.rot);
      return { x: it.x + p.x, y: it.y + p.y, sx, sy };
    });
  }

  function rotateHandle(it) {
    const p = rotPt(0, -it.st.h / 2 - 26, it.rot);
    return { x: it.x + p.x, y: it.y + p.y };
  }

  function insidePoly(pts, x, y) {
    let inside = false;
    const n = pts.length >> 1;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = pts[i * 2], yi = pts[i * 2 + 1];
      const xj = pts[j * 2], yj = pts[j * 2 + 1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function hitShape(px, py) {
    for (let i = scene.items.length - 1; i >= 0; i--) {
      const it = scene.items[i];
      if (!it._pts) continue;
      const d = rotPt(px - it.x, py - it.y, -(it.rot || 0));
      if (insidePoly(it._pts, d.x, d.y)) return it;
    }
    return null;
  }

  /* ---------------- 绘制 ---------------- */
  function draw() {
    ctx.clearRect(0, 0, scene.vw, scene.vh);

    for (const it of scene.items) {
      const st = it.st;
      const pts = effect.outline(st, t);
      it._pts = pts;

      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.rot) ctx.rotate(it.rot);

      const path = new Path2D();
      path.moveTo(pts[0], pts[1]);
      for (let i = 1; i < pts.length >> 1; i++) path.lineTo(pts[i * 2], pts[i * 2 + 1]);
      path.closePath();

      if (st.shadow) {
        ctx.shadowColor = rgba(st.shadowColor, st.shadowAlpha);
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

    drawSelection(sel());
  }

  function drawSelection(it) {
    if (!it || !selectionVisible) return;
    const { w, h } = it.st;

    ctx.save();
    ctx.translate(it.x, it.y);
    if (it.rot) ctx.rotate(it.rot);
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = 'rgba(201,112,74,.95)';
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.setLineDash([]);
    // 旋转杆
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(0, -h / 2 - 26);
    ctx.strokeStyle = 'rgba(139,209,216,.7)';
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.restore();

    corners(it).forEach(c => handle(c.x, c.y, '#fbf6ee', '#c9704a'));
    const rh = rotateHandle(it);
    handle(rh.x, rh.y, '#8bd1d8', '#2b4244');
  }

  function handle(x, y, fill, stroke) {
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function rgba(hex, a) {
    let c = String(hex || '#000').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16) || 0;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function tick(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.06, (ts - lastTs) / 1000);
    lastTs = ts;
    if (playing) { t += dt; dirty = true; }
    if (dirty) { draw(); dirty = false; }

    requestAnimationFrame(tick);
  }

  /* ---------------- 指针交互 ---------------- */
  let drag = null;

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', e => {
    const p = pos(e);
    const it = sel();

    // 1) 旋转把手
    if (it) {
      const rh = rotateHandle(it);
      if (Math.hypot(p.x - rh.x, p.y - rh.y) < 11) {
        drag = { mode: 'rotate', id: it.id, cx: it.x, cy: it.y };
        canvas.setPointerCapture?.(e.pointerId);
        return;
      }
      // 2) 缩放把手
      const cs = corners(it);
      for (const c of cs) {
        if (Math.hypot(p.x - c.x, p.y - c.y) < 11) {
          drag = { mode: 'scale', id: it.id, cx: it.x, cy: it.y, rot: it.rot || 0, aspect: it.st.w / it.st.h };
          canvas.setPointerCapture?.(e.pointerId);
          return;
        }
      }
    }

    // 3) 点图形：选中或移动
    const hit = hitShape(p.x, p.y);
    if (hit) {
      if (hit.id !== selId) selectItem(hit.id, { reposition: true });
      else if (!selectionVisible) setSelectionVisible(true);   // 之前点空白藏起来了，重新点亮
      const target = sel();
      drag = { mode: 'move', id: target.id, dx: p.x - target.x, dy: p.y - target.y };
      canvas.setPointerCapture?.(e.pointerId);
      return;
    }

    // 4) 点空白：藏掉把手/选框和气泡，纯看效果（点任一图形恢复）
    drag = null;
    deselect();
  });

  canvas.addEventListener('pointermove', e => {
    const p = pos(e);

    if (!drag) { hoverCursor(p); return; }

    const it = scene.items.find(i => i.id === drag.id);
    if (!it) return;

    if (drag.mode === 'move') {
      let nx = p.x - drag.dx, ny = p.y - drag.dy;
      if (e.shiftKey) { nx = Math.round(nx / 10) * 10; ny = Math.round(ny / 10) * 10; }
      it.x = Math.round(nx); it.y = Math.round(ny);
      syncPos();
    } else if (drag.mode === 'scale') {
      const d = rotPt(p.x - it.x, p.y - it.y, -drag.rot);
      let w = clamp(Math.abs(d.x) * 2, 40, 4000);
      let h = clamp(Math.abs(d.y) * 2, 40, 4000);
      if (e.shiftKey) {                       // 等比
        const k = Math.max(w / it.st.w, h / it.st.h);
        w = clamp(it.st.w * k, 40, 4000);
        h = clamp(it.st.h * k, 40, 4000);
      }
      it.st.w = Math.round(w);
      it.st.h = Math.round(h);
      syncSizeInputs();
    } else if (drag.mode === 'rotate') {
      let a = Math.atan2(p.y - it.y, p.x - it.x) + Math.PI / 2;
      if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
      it.rot = a;
      syncSizeInputs();
    }
    markDirty();
    writeHashSoon();
  });

  function endDrag(e) {
    if (!drag) return;
    if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    const wasTransform = drag.mode === 'scale' || drag.mode === 'rotate';
    drag = null;
    if (wasTransform) { syncSizeInputs(); markLayers(); positionBubble(true); }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function hoverCursor(p) {
    if (selectionVisible) {
      const it = sel();
      if (it) {
        const rh = rotateHandle(it);
        if (Math.hypot(p.x - rh.x, p.y - rh.y) < 11) { canvas.style.cursor = 'grab'; return; }
        for (const c of corners(it)) {
          if (Math.hypot(p.x - c.x, p.y - c.y) < 11) {
            canvas.style.cursor = (c.sx * c.sy > 0) ? 'nwse-resize' : 'nesw-resize';
            return;
          }
        }
      }
    }
    canvas.style.cursor = hitShape(p.x, p.y) ? 'move' : 'default';
  }

  /* ---------------- 变体操作 ---------------- */
  function makeItem(srcSt, x, y) {
    return { id: nextId++, name: '变体 ' + nextId, x: Math.round(x), y: Math.round(y), rot: 0, st: Object.assign({}, DEF, srcSt || {}) };
  }

  function touch(structural) {
    if (structural) renderLayers();
    syncBubbleValues();
    markDirty();
    writeHashSoon();
  }

  function addItem(srcSt, x, y) {
    const cx = x == null ? scene.vw / 2 + (Math.random() * 120 - 60) : x;
    const cy = y == null ? scene.vh / 2 + (Math.random() * 120 - 60) : y;
    const it = makeItem(srcSt, cx, cy);
    scene.items.push(it);
    selId = it.id;
    renderLayers(); buildBubble(); positionBubble(); syncBubbleValues(); markDirty(); writeHashSoon();
    return it;
  }

  function duplicateItem(id) {
    const src = scene.items.find(i => i.id === id);
    if (!src) return;
    const it = makeItem(src.st, src.x + 36, src.y + 36);
    it.rot = src.rot; it.name = src.name + ' 副本';
    scene.items.push(it);
    selId = it.id;
    renderLayers(); buildBubble(); positionBubble(); syncBubbleValues(); markDirty(); writeHashSoon();
    toast('已复制');
  }

  function removeItem(id) {
    if (scene.items.length <= 1) { toast('至少保留一个变体'); return; }
    const idx = scene.items.findIndex(i => i.id === id);
    if (idx < 0) return;
    scene.items.splice(idx, 1);
    if (selId === id) selId = scene.items[Math.max(0, idx - 1)].id;
    renderLayers(); buildBubble(); positionBubble(); syncBubbleValues(); markDirty(); writeHashSoon();
  }

  function moveLayer(id, dir) {
    const idx = scene.items.findIndex(i => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= scene.items.length) return;
    const [it] = scene.items.splice(idx, 1);
    scene.items.splice(j, 0, it);
    renderLayers(); markDirty(); writeHashSoon();
  }

  function selectItem(id, opts) {
    selId = id;
    setSelectionVisible(true);
    renderLayers();
    buildBubble();
    if (!bubblePinned || opts && opts.reposition) positionBubble();
    syncBubbleValues();
    markDirty();
  }

  /* 点空白 / Esc：藏掉把手、选框和气泡，画布变干净；点任一图形即恢复 */
  function setSelectionVisible(v) {
    selectionVisible = v;
    bubble.classList.toggle('hidden', !v);
    dirty = true;
  }

  function deselect() {
    if (!selectionVisible) return;
    setSelectionVisible(false);
    canvas.style.cursor = 'default';
  }

  /* ---------------- 图层 ---------------- */
  function renderLayers() {
    const list = $('layers-list');
    list.innerHTML = '';
    $('layer-count').textContent = scene.items.length;

    for (let i = scene.items.length - 1; i >= 0; i--) {
      const it = scene.items[i];
      const el = document.createElement('div');
      el.className = 'layer' + (it.id === selId ? ' sel' : '');
      el.dataset.id = it.id;

      const sw = document.createElement('i');
      sw.className = 'sw';
      sw.style.background = it.st.fill;
      el.appendChild(sw);

      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = it.name;
      el.appendChild(nm);

      const posEl = document.createElement('span');
      posEl.className = 'pos';
      posEl.textContent = it.x + ',' + it.y;
      el.appendChild(posEl);

      const ops = document.createElement('span');
      ops.className = 'ops';
      const mk = (txt, title, fn, cls) => {
        const b = document.createElement('button');
        b.className = 'icon-btn' + (cls ? ' ' + cls : '');
        b.textContent = txt; b.title = title;
        b.addEventListener('click', e => { e.stopPropagation(); fn(); });
        ops.appendChild(b);
      };
      mk('↑', '上移一层', () => moveLayer(it.id, 1));
      mk('↓', '下移一层', () => moveLayer(it.id, -1));
      mk('⧉', '复制', () => duplicateItem(it.id));
      mk('✕', '删除', () => removeItem(it.id), 'danger');
      el.appendChild(ops);

      el.addEventListener('click', () => selectItem(it.id, { reposition: true }));
      list.appendChild(el);
    }

    
  }

  function markLayers() {
    for (const el of $('layers-list').children) {
      const it = scene.items.find(i => i.id === Number(el.dataset.id));
      el.classList.toggle('sel', Number(el.dataset.id) === selId);
      if (it) {
        el.querySelector('.pos').textContent = it.x + ',' + it.y;
        el.querySelector('.sw').style.background = it.st.fill;
        el.querySelector('.nm').textContent = it.name;
      }
    }
  }

  /* ---------------- 创建工具条（独立于图层） ---------------- */
  const SHAPE_NAME = {};
  effect.schema.forEach(g => g.items.forEach(it => {
    if (it.type === 'iconbar' && it.options) it.options.forEach(([v, txt]) => { SHAPE_NAME[v] = txt; });
  }));

  function buildCreateBar() {
    const host = $('cb-list');
    if (!host) return;
    host.innerHTML = '';
    const item = SCHEMA.shape;
    if (!item || !item.options) return;
    for (const [val, text, icon] of item.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cb-btn';
      b.dataset.shape = val;
      b.title = '新建' + text;
      b.setAttribute('aria-label', '新建' + text);
      b.innerHTML = icon;
      host.appendChild(b);
    }
  }

  /* 按形状新建一个元素：参数取默认，颜色跟随当前选中，落点错开避免完全重叠 */
  function createShape(shape) {
    const cur = sel();
    const st = { shape };
    if (cur) st.fill = cur.st.fill;
    const n = scene.items.length;
    const x = scene.vw / 2 + ((n % 5) - 2) * 64;
    const y = scene.vh / 2 + ((Math.floor(n / 5) % 4) - 1.5) * 64;
    const it = addItem(st, x, y);
    it.name = (SHAPE_NAME[shape] || '元素') + ' ' + it.id;
    renderLayers();
    markDirty();
    writeHashSoon();
    toast('已新建「' + (SHAPE_NAME[shape] || '元素') + '」');
    return it;
  }
  /* ---------------- 参数气泡 ---------------- */
  const SCHEMA = {};
  effect.schema.forEach(g => g.items.forEach(it => { SCHEMA[it.key] = it; }));

  const CORE = ['shape', 'amp', 'waves', 'mode', 'fill'];
  const GROUPS = [
    { id: 'geom',  title: '尺寸与位置', keys: ['w', 'h', 'radius', 'shapeRot', 'x', 'y', 'rot'] },
    { id: 'noise', title: '噪声细节',   keys: ['octaves', 'lacunarity', 'gain', 'warp', 'seed'] },
    { id: 'anim',  title: '动画',       keys: ['drift', 'speed'] },
    { id: 'stroke', title: '描边',      keys: ['stroke', 'strokeW', 'strokeColor'] },
    { id: 'shadow', title: '投影',      keys: ['shadow', 'shadowBlur', 'shadowY', 'shadowAlpha', 'shadowColor'] }
  ];

  const FIELDS = {};   // key -> sync()
  let whenItems = [];

  /* ---------- 形状图标栏同步 ---------- */
  function syncShapeBtns() {
    const bar = document.querySelector('#bubble-body .iconbar');
    if (!bar) return;
    const cur = sel().st.shape;
    for (const b of bar.children) b.classList.toggle('on', b.dataset.shape === cur);
  }

  /* ---------- 二级菜单：多边形 / SVG 的设置 ---------- */
  const openSub = new Set();

  function refreshShapeSub() {
    const host = document.getElementById('shape-sub');
    if (!host) return;
    host.innerHTML = '';
    const st = sel().st;
    const shape = st.shape;

    let title = null, summary = '', keys = [], id = null, defOpen = false;

    if (shape === 'polygon' || shape === 'star') {
      id = 'sub-poly';
      title = shape === 'star' ? '星形设置' : '多边形设置';
      summary = (st.sides || 6) + ' 边' + (shape === 'star' ? ' · 内径 ' + Math.round((st.spike || .45) * 100) + '%' : '');
      keys = shape === 'star' ? ['sides', 'spike'] : ['sides'];
      defOpen = true;
    } else if (shape === 'path') {
      id = 'sub-svg';
      title = 'SVG 设置';
      const d = st.pathD || '';
      summary = d ? (d.split('L').length + ' 段') : '未导入';
      keys = ['svg'];
      defOpen = !d;      // 还没导入就自动展开，导入完可收起来
    } else {
      return;            // 矩形/椭圆没有二级设置
    }

    const acc = document.createElement('div');
    acc.className = 'acc sub' + ((openSub.has(id) || (!openSub.size && defOpen)) ? ' open' : '');

    const head = document.createElement('div');
    head.className = 'acc-head';
    head.innerHTML = `<span class="chev"></span><span class="acc-title">${title}</span>`
      + `<span class="sub-sum">${summary}</span><span class="grow"></span>`;
    head.addEventListener('click', () => {
      const open = acc.classList.toggle('open');
      open ? openSub.add(id) : openSub.delete(id);
      requestAnimationFrame(() => positionBubble());
    });
    acc.appendChild(head);

    const body = document.createElement('div');
    body.className = 'acc-body';
    for (const k of keys) if (SCHEMA[k]) body.appendChild(field(SCHEMA[k]));
    acc.appendChild(body);

    host.appendChild(acc);
    applyWhen();
    if (FIELDS.shape) syncShapeBtns();
  }
  function buildBubble() {
    bubbleBody.innerHTML = '';
    for (const k in FIELDS) delete FIELDS[k];
    whenItems = [];

    // —— 核心（始终展开）——
    const core = document.createElement('div');
    core.className = 'core-win';
    for (const key of CORE) core.appendChild(field(SCHEMA[key]));
    bubbleBody.appendChild(core);

    // —— 二级菜单（多边形 / SVG 专属设置）——
    const subHost = document.createElement('div');
    subHost.id = 'shape-sub';
    bubbleBody.appendChild(subHost);

    // —— 折叠组 ——
    for (const g of GROUPS) {
      const acc = document.createElement('div');
      acc.className = 'acc' + (openAcc.has(g.id) ? ' open' : '');

      const head = document.createElement('div');
      head.className = 'acc-head';
      head.innerHTML = `<span class="chev"></span><span class="acc-title">${g.title}</span><span class="grow"></span>`;
      head.addEventListener('click', () => {
        const open = acc.classList.toggle('open');
        open ? openAcc.add(g.id) : openAcc.delete(g.id);
        requestAnimationFrame(() => positionBubble());
      });
      acc.appendChild(head);

      const body = document.createElement('div');
      body.className = 'acc-body';
      for (const key of g.keys) {
        if (key === 'x' || key === 'y') body.appendChild(posField(key));
        else if (key === 'rot') body.appendChild(rotField());
        else if (SCHEMA[key]) body.appendChild(field(SCHEMA[key]));
      }
      acc.appendChild(body);
      bubbleBody.appendChild(acc);
    }

    // —— 预设 ——
    const presets = document.createElement('div');
    presets.className = 'presets';
    presets.id = 'presets';
    bubbleBody.appendChild(presets);
    renderPresets();

    refreshShapeSub();
    applyWhen();
  }

  function shell(labelText, headExtra) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const head = document.createElement('div');
    head.className = 'field-head';
    const lab = document.createElement('label');
    lab.textContent = labelText;
    head.appendChild(lab);
    if (headExtra) head.appendChild(headExtra);
    wrap.appendChild(head);
    return { wrap, head };
  }

  /* 数字框 + 滑块的统一行。
     关键：键入时**只更新模型和滑块，绝不回写输入框**——
     一旦在 input 事件里改 value，光标会被重置、小数点会被 fmt 抹掉，
     结果就是「打得进键但数字不动」。格式化只在失焦/回车时做。 */
  function numericRow(o) {
    const { wrap, head } = shell(o.label);
    const num = numberInput(o);
    head.appendChild(num.wrap);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = o.min; input.max = o.max; input.step = o.step;

    const paint = v => paintRange(input, o, v);

    // 拖滑块：焦点在滑块上，这时可以安全回写数字框
    input.addEventListener('input', () => {
      const v = clamp(parseFloat(input.value), o.min, o.max);
      o.set(v);
      paint(v);
      num.input.value = fmt(o.get(), o.step);
      onChange();
    });

    // 键盘输入：只吃有效数字，输入框文本保持原样（允许中间态 "12." / "-"）
    num.input.addEventListener('input', () => {
      const raw = num.input.value.trim();
      if (raw === '' || raw === '-' || raw === '+' || raw === '.' || raw === '-.' || raw === '+.') return;
      const v = parseFloat(raw);
      if (!Number.isFinite(v)) return;
      const cv = clamp(v, o.min, o.max);
      o.set(cv);
      paint(cv);
      onChange();
    });

    // 收尾才格式化：失焦 / 回车
    num.input.addEventListener('blur', () => { num.input.value = fmt(o.get(), o.step); });

    const sync = () => {
      const v = o.get();
      paint(v);
      if (document.activeElement !== num.input) num.input.value = fmt(v, o.step);
    };

    wrap.appendChild(input);      // 滑块挂在数字头下面
    return { wrap, sync };
  }

  function field(item) {
    const key = item.key;

    if (item.type === 'range') {
      const row = numericRow({
        label: item.label, min: item.min, max: item.max, step: item.step, unit: item.unit,
        get: () => sel().st[key],
        set: v => { sel().st[key] = v; }
      });
      FIELDS[key] = row.sync;
      registerWhen(row.wrap, item);
      return row.wrap;
    }

    if (item.type === 'iconbar') {
      const { wrap } = shell(item.label);
      const bar = document.createElement('div');
      bar.className = 'iconbar';
      for (const [val, text, icon] of item.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'shape-btn';
        b.dataset.shape = val;
        b.title = text;
        b.setAttribute('aria-label', text);
        b.innerHTML = icon;
        b.addEventListener('click', () => {
          if (sel().st.shape === val) return;
          sel().st.shape = val;
          syncShapeBtns();
          refreshShapeSub();
          onChange();
        });
        bar.appendChild(b);
      }
      wrap.appendChild(bar);
      FIELDS.shape = syncShapeBtns;
      return wrap;
    }
    if (item.type === 'select') {
      const { wrap } = shell(item.label);
      const s = document.createElement('select');
      s.className = 'full';
      for (const [v, txt] of item.options) {
        const o = document.createElement('option');
        o.value = v; o.textContent = txt;
        s.appendChild(o);
      }
      s.addEventListener('change', () => { sel().st[key] = s.value; applyWhen(); onChange(); });
      wrap.appendChild(s);
      FIELDS[key] = () => { s.value = sel().st[key]; };
      registerWhen(wrap, item);
      return wrap;
    }

    if (item.type === 'color') {
      const { wrap } = shell(item.label);
      const row = document.createElement('div');
      row.className = 'color-row';
      const picker = document.createElement('input');
      picker.type = 'color';
      const hex = document.createElement('input');
      hex.type = 'text';
      hex.className = 'full mono';
      picker.addEventListener('input', () => { sel().st[key] = picker.value; hex.value = picker.value; onChange(); });
      hex.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{3,6}$/.test(hex.value)) { sel().st[key] = hex.value; picker.value = normHex(hex.value); onChange(); }
      });
      hex.addEventListener('keydown', e => e.stopPropagation());
      row.appendChild(picker); row.appendChild(hex);
      wrap.appendChild(row);
      FIELDS[key] = () => { const v = sel().st[key]; picker.value = normHex(v); hex.value = v; };
      registerWhen(wrap, item);
      return wrap;
    }

    if (item.type === 'toggle') {
      const { wrap, head } = shell(item.label);
      wrap.classList.add('is-toggle');
      const sw = document.createElement('div');
      sw.className = 'switch';
      head.appendChild(sw);
      sw.addEventListener('click', () => {
        const it = sel();
        it.st[key] = !it.st[key];
        sw.classList.toggle('on', !!it.st[key]);
        applyWhen(); onChange();
      });
      // 注意：开关行自己**不能**注册到 whenItems —— 否则一关掉就把自己也隐藏了，
      // 再也点不回来。只有它的从属行（模糊/偏移/…）才按 when 隐藏。
      FIELDS[key] = () => sw.classList.toggle('on', !!sel().st[key]);
      return wrap;
    }

    if (item.type === 'import') {
      const { wrap } = shell(item.label);
      const row = document.createElement('div');
      row.className = 'import-row';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini';

      const file = document.createElement('input');
      file.type = 'file';
      file.accept = item.accept || '.svg,image/svg+xml';
      file.style.display = 'none';

      const status = document.createElement('span');
      status.className = 'import-status';

      const refresh = () => {
        const d = sel().st.pathD;
        if (d) {
          const segs = (d.match(/L/g) || []).length + 1;
          btn.textContent = '换一个 SVG…';
          status.textContent = '已导入 · ' + segs + ' 段';
        } else {
          btn.textContent = '选择 SVG…';
          status.textContent = '未导入';
        }
      };

      btn.addEventListener('click', () => file.click());
      file.addEventListener('change', async () => {
        const f = file.files && file.files[0];
        if (!f) return;
        try {
          const text = await f.text();
          const res = window.SKShape.fromSvgText(text);
          if (!res) { toast('这个 SVG 里没找到可测的轮廓'); return; }
          const it = sel();
          it.st.pathD = res.d;
          it.st.shape = 'path';
          it.st.pathVb = '';
          syncBubbleValues(); refreshShapeSub(); applyWhen(); markLayers(); onChange();
          toast('已导入 <' + res.name + '> · ' + res.pts + ' 个锚点');
        } catch (err) {
          toast('导入失败：' + (err && err.message ? err.message : err));
        }
        file.value = '';
      });

      row.append(btn, file, status);
      wrap.appendChild(row);
      refresh();                 // 首次渲染就要把按钮文案/状态填上
      FIELDS['svg'] = refresh;
      return wrap;
    }
    return document.createElement('div');
  }

  function posField(axis) {
    const it0 = sel();
    if (!it0) return document.createElement('div');
    const row = numericRow({
      label: axis === 'x' ? 'X' : 'Y', min: -4000, max: 4000, step: 1, unit: 'px',
      get: () => sel()[axis],
      set: v => { sel()[axis] = Math.round(v); markLayers(); }
    });
    FIELDS['pos-' + axis] = row.sync;
    return row.wrap;
  }

  function rotField() {
    const row = numericRow({
      label: '旋转', min: -180, max: 180, step: 1, unit: '°',
      get: () => Math.round((sel().rot || 0) * 180 / Math.PI),
      set: v => { sel().rot = clamp(v, -180, 180) * Math.PI / 180; }
    });
    FIELDS.rot = row.sync;
    return row.wrap;
  }

  function numberInput(o) {
    const wrap = document.createElement('span');
    wrap.className = 'numwrap';
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'num';
    input.min = o.min; input.max = o.max; input.step = o.step;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); e.stopPropagation(); });
    wrap.appendChild(input);
    // 单位栏永远占位（即使为空），否则没单位的行数字会右移，列对不齐
    const u = document.createElement('span');
    u.className = 'unit';
    u.textContent = o.unit || '';
    wrap.appendChild(u);
    return { wrap, input };
  }

  function paintRange(input, o, v) {
    const pc = clamp((v - o.min) / (o.max - o.min) * 100, 0, 100);
    input.style.setProperty('--fill', pc + '%');
    input.value = v;
  }

  /* 注册「按条件显隐」的行：when = 布尔键，whenIn = 形状取值集合 */
  function registerWhen(el, item) {
    if (item.whenIn) whenItems.push({ el, whenIn: item.whenIn });
    else if (item.when) whenItems.push({ el, when: item.when });
  }
  function applyWhen() {
    const it = sel();
    for (const w of whenItems) {
      let show = true;
      if (w.when) show = !!it.st[w.when];
      if (w.whenIn) show = w.whenIn.indexOf(it.st.shape) >= 0;
      w.el.style.display = show ? '' : 'none';
    }
  }

  function syncBubbleValues() {
    for (const k in FIELDS) FIELDS[k]();
    updateSubSummary();
    applyWhen();
    const nm = $('name-input');
    if (document.activeElement !== nm) nm.value = sel().name;
  }

  function syncPos() { if (FIELDS['pos-x']) FIELDS['pos-x'](); if (FIELDS['pos-y']) FIELDS['pos-y'](); markLayers(); }
  function syncSizeInputs() { if (FIELDS.w) FIELDS.w(); if (FIELDS.h) FIELDS.h(); if (FIELDS.rot) FIELDS.rot(); }

  function updateSubSummary() {
    const st = sel().st, el = document.querySelector('#shape-sub .sub-sum');
    if (!el) return;
    if (st.shape === 'star') el.textContent = (st.sides || 6) + ' 边 · 内径 ' + Math.round((st.spike || .45) * 100) + '%';
    else if (st.shape === 'polygon') el.textContent = (st.sides || 6) + ' 边';
    else if (st.shape === 'path') el.textContent = st.pathD ? (st.pathD.split('L').length + ' 段') : '未导入';
  }

  function onChange() {
    updateSubSummary();
    markLayers();
    markDirty();
    writeHashSoon();
    if (FIELDS['pos-x']) { /* 位置变化时气泡跟随 */ }
  }

  /* 气泡定位：贴在图形右侧，越界则翻到左侧，垂直方向夹进视口 */
  function positionBubble(force) {
    if (bubblePinned && !force) return;
    const it = sel();
    if (!it) return;

    const rect = bubble.getBoundingClientRect();
    const bw = rect.width || 256;
    const bh = rect.height || 420;

    if (bubblePinned) {
      bubble.style.left = clamp(bubblePinned.left, 8, Math.max(8, scene.vw - bw - 8)) + 'px';
      bubble.style.top = clamp(bubblePinned.top, 56, Math.max(56, scene.vh - 40)) + 'px';
      return;
    }

    const gap = 26, hw = it.st.w / 2, hh = it.st.h / 2;

    // 右侧可用边界：如果图层面板开着，气泡别压到它
    const lp = $('layers-panel');
    const layersOn = lp && !lp.classList.contains('hidden');
    const lpRect = layersOn ? lp.getBoundingClientRect() : null;
    const maxRight = layersOn ? Math.min(scene.vw - 12, lpRect.left - 12) : scene.vw - 12;

    let left = it.x + hw + gap;
    if (left + bw > maxRight) left = it.x - hw - gap - bw;
    left = clamp(left, 12, Math.max(12, maxRight - bw));

    // 别压到左下角的导出按钮
    const act = $('actions') && $('actions').getBoundingClientRect();
    const hitsActions = act && (left < act.right + 12) && (left + bw > act.left - 12);
    let maxBottom = scene.vh - 16;
    if (hitsActions) maxBottom = Math.min(maxBottom, act.top - 12);

    let top = clamp(it.y - hh, 60, Math.max(60, maxBottom - bh));
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }

  /* ---------------- 预设 ---------------- */
  const LS_KEY = ['stylekit', 'presets', 'v3'].join(':');
  const userPresets = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } };
  const saveUserPresets = l => { try { localStorage.setItem(LS_KEY, JSON.stringify(l)); } catch {} };

  function renderPresets() {
    const el = $('presets');
    if (!el) return;
    el.innerHTML = '';

    const add = (name, st, removable, idx) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.title = removable ? '左键应用 · 右键删除' : '应用到选中变体';
      const dot = document.createElement('i');
      dot.style.background = st.fill || '#888';
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode(name));
      chip.addEventListener('click', () => {
        const { w, h, ...rest } = st;
        Object.assign(sel().st, rest);
        syncBubbleValues(); markLayers(); markDirty(); writeHashSoon();
      });
      if (removable) chip.addEventListener('contextmenu', e => {
        e.preventDefault();
        const list = userPresets(); list.splice(idx, 1); saveUserPresets(list); renderPresets();
        toast('已删除预设');
      });
      el.appendChild(chip);
    };

    const builtinNames = new Set(effect.presets.map(p => p.name));
    effect.presets.forEach(p => add(p.name, p.state, false, -1));
    // 与内置同名的用户预设不再重复显示（用户把某个预设「升级」成内置后就是这么用的）
    userPresets().forEach((p, i) => { if (!builtinNames.has(p.name)) add(p.name, p.state, true, i); });

    const save = document.createElement('button');
    save.className = 'chip add';
    save.innerHTML = '<i class="ph"></i>＋ 存为预设';
    save.addEventListener('click', () => {
      const name = prompt('预设名称', '我的块 ' + (userPresets().length + 1));
      if (!name) return;
      const list = userPresets();
      const { w, h, ...rest } = sel().st;
      list.push({ name, state: rest });
      saveUserPresets(list); renderPresets(); toast('已保存');
    });
    el.appendChild(save);
  }

  /* ---------------- 导出 ---------------- */
  function markDirty() {
    dirty = true;
  }

  /* 按需生成导出文本（不常驻渲染，只在点按钮时算一次） */
  async function exportText(kind) {
    const it = sel();
    if (kind === 'html') return await window.SKExport.html(scene);
    if (kind === 'css') return window.SKExport.css(it.st, t, it.rot);
    if (kind === 'svg') return window.SKExport.svg(scene, t);
    return JSON.stringify(compactScene(), null, 2);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  function flash(btn, okText) {
    if (!btn) return;
    if (!btn.dataset.orig) btn.dataset.orig = btn.textContent.trim();  // 记住原始文案，避免连续点击把「已复制」当原文案
    btn.classList.add('done');
    btn.textContent = okText;
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.classList.remove('done');
      btn.textContent = btn.dataset.orig;
    }, 1100);
  }

  async function runAction(kind, btn, ev) {
    try {
      // HTML：单击=下载文件，Shift+单击=复制代码（两个动作合并到一个按钮上）
      if (kind === 'html') {
        const text = await exportText('html');
        if (ev && ev.shiftKey) {
          await copyText(text);
          flash(btn, '已复制');
          toast('已复制 HTML（Shift+点击才复制，普通点击是下载）');
        } else {
          download(new Blob([text], { type: 'text/html;charset=utf-8' }), 'stylekit-scene.html');
          flash(btn, '已存');
          toast('已下载 stylekit-scene.html');
        }
        return;
      }
      if (kind === 'webm') { await toggleRecord(btn); return; }

      const map = { 'copy-css': ['css', 'CSS'], 'copy-svg': ['svg', 'SVG'], 'copy-json': ['json', 'JSON'] };
      const [ext, label] = map[kind] || [];
      if (!ext) return;
      const text = await exportText(ext);
      await copyText(text);
      flash(btn, '已复制');
      toast('已复制 ' + label);
    } catch (err) {
      toast('导出失败：' + (err && err.message ? err.message : err));
    }
  }

  /* ---------------- WebM 录制 ---------------- */
  let rec = null, recChunks = [], recRaf = 0, recT0 = 0, recBtn = null, recTimer = 0;

  function webmMime() {
    const list = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (const t of list) if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
    return '';
  }

  async function toggleRecord(btn) {
    // 正在录 → 停止
    if (rec && rec.state === 'recording') { rec.stop(); return; }

    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      toast('这个浏览器不支持 canvas 录制');
      return;
    }

    const mime = webmMime();
    if (!mime) { toast('没有可用的 WebM 编码器'); return; }

    const scale = 1;   // 1:1 就够清晰，2× 会让软件编码掉帧
    const cw = Math.round(scene.vw * scale), ch = Math.round(scene.vh * scale);
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    // 关键：captureStream 的 canvas 必须挂在 DOM 里才会被合成，否则录不到帧（拿到空 blob）。
    // 放到视口外，用户看不见。
    cv.style.cssText = `position:fixed;left:-10000px;top:0;width:${cw}px;height:${ch}px;pointer-events:none`;
    document.body.appendChild(cv);
    const cx = cv.getContext('2d');
    // 视频格式基本不支持 alpha，先把当前背景底色烤进画面
    const bg = getComputedStyle(document.body).backgroundColor || '#14171b';

    const stream = cv.captureStream(30);
    const bitrate = Math.min(16e6, Math.max(4e6, cw * ch * 30 * 0.15));
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(bitrate) });
    recChunks = [];

    rec.ondataavailable = e => { if (e.data && e.data.size) recChunks.push(e.data); };
    rec.onstop = () => {
      cancelAnimationFrame(recRaf);
      const secs = ((performance.now() - recT0) / 1000).toFixed(1);
      const blob = new Blob(recChunks, { type: mime.split(';')[0] });
      recChunks = [];
      if (blob.size > 0) {
        download(blob, 'stylekit-motion.webm');
        toast('已保存 WebM · ' + secs + 's · ' + (blob.size / 1048576).toFixed(1) + ' MB');
      } else {
        toast('录制失败：没有数据');
      }
      restoreRecBtn();
      stream.getTracks().forEach(tr => tr.stop());
      cv.remove();          // 清理离屏 canvas
      rec = null;
    };

    recT0 = performance.now();
    rec.start(200);

    // 录制循环：背景 + 场景，跟随实时 t，所以录到的就是屏幕上看到的动画
    const drawRec = () => {
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.fillStyle = bg;
      cx.fillRect(0, 0, cw, ch);
      cx.setTransform(scale, 0, 0, scale, 0, 0);
      try { window.SKExport.paint(cx, scene, t); } catch (e) { /* 忽略单帧错误 */ }
      recRaf = requestAnimationFrame(drawRec);
    };
    drawRec();

    // 按钮进入「录制中」态
    recBtn = btn;
    if (!btn.dataset.orig) btn.dataset.orig = btn.textContent.trim();
    btn.classList.add('recording');
    const tickLabel = () => {
      const s = ((performance.now() - recT0) / 1000).toFixed(1);
      btn.textContent = '● ' + s + 's';
      recTimer = setTimeout(tickLabel, 100);
    };
    tickLabel();

    // 最长 20 秒自动停，避免录太长
    setTimeout(() => { if (rec && rec.state === 'recording') rec.stop(); }, 20000);
    toast('开始录制，再点一次结束（最长 20 秒）');
  }

  function restoreRecBtn() {
    clearTimeout(recTimer);
    if (recBtn) {
      recBtn.classList.remove('recording');
      recBtn.textContent = recBtn.dataset.orig || 'WebM';
      recBtn = null;
    }
  }

  /* ---------------- URL hash ---------------- */
  function writeHashSoon() {
    clearTimeout(writeHashSoon._t);
    writeHashSoon._t = setTimeout(writeHash, 500);
  }

  function compactScene() {
    return {
      vw: scene.vw, vh: scene.vh,
      items: scene.items.map(it => {
        const d = {};
        for (const k in it.st) if (it.st[k] !== DEF[k]) d[k] = typeof it.st[k] === 'number' ? r2(it.st[k]) : it.st[k];
        return { n: it.name, x: it.x, y: it.y, r: it.rot ? r2(it.rot) : 0, st: d };
      })
    };
  }

  function writeHash() {
    try {
      const s = '#s=' + encodeURIComponent(JSON.stringify(compactScene()));
      if (s.length > 14000) return;
      history.replaceState(null, '', s);
    } catch {}
  }

  function readHash() {
    try {
      const m = location.hash.match(/s=([^&]+)/);
      if (!m) return false;
      const o = JSON.parse(decodeURIComponent(m[1]));
      if (!o || !Array.isArray(o.items) || !o.items.length) return false;
      scene.items = o.items.map(it => ({
        id: nextId++, name: it.n || '变体', x: it.x | 0, y: it.y | 0, rot: it.r || 0,
        st: Object.assign({}, DEF, it.st || {})
      }));
      selId = scene.items[0].id;
      return true;
    } catch { return false; }
  }

  /* ---------------- 绑定 ---------------- */
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('on'), 1500);
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function bind() {
    $('btn-play').addEventListener('click', e => {
      playing = !playing;
      e.currentTarget.textContent = playing ? '暂停' : '播放';
    });

    $('btn-random').addEventListener('click', () => {
      const r = (a, b) => a + Math.random() * (b - a);
      const modes = ['fbm', 'fbm', 'fbm', 'ridged', 'billow', 'sharp'];
      Object.assign(sel().st, {
        amp: +r(1.5, 13).toFixed(1),
        waves: +r(3, 26).toFixed(1),
        octaves: Math.round(r(1, 5)),
        lacunarity: +r(1.6, 2.8).toFixed(2),
        gain: +r(0.35, 0.68).toFixed(2),
        warp: +r(0, 1.5).toFixed(2),
        drift: +r(-1.2, 1.2).toFixed(2),
        speed: +r(0.15, 1).toFixed(2),
        mode: modes[Math.floor(Math.random() * modes.length)],
        seed: Math.round(r(1, 999))
      });
      syncBubbleValues(); markLayers(); markDirty(); writeHashSoon();
    });

    $('bg-seg').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b));
      document.body.dataset.bg = b.dataset.bg;
    });

    $('btn-layers').addEventListener('click', e => {
      const p = $('layers-panel');
      const hidden = p.classList.toggle('hidden');
      e.currentTarget.classList.toggle('on', !hidden);
    });
    $('btn-layers-close').addEventListener('click', () => {
      $('layers-panel').classList.add('hidden');
      $('btn-layers').classList.remove('on');
    });

    // 左下导出按钮
    $('actions').addEventListener('click', e => {
      const b = e.target.closest('button.act');
      if (!b) return;
      runAction(b.dataset.act, b, e);
    });

    // 创建工具条：按形状新建；⧉ 复制当前
    $('cb-list').addEventListener('click', e => {
      const b = e.target.closest('.cb-btn');
      if (b) createShape(b.dataset.shape);
    });
    $('cb-dup').addEventListener('click', () => duplicateItem(selId));

    $('btn-dup').addEventListener('click', () => duplicateItem(selId));
    $('btn-del').addEventListener('click', () => removeItem(selId));
    $('btn-bubble-min').addEventListener('click', e => {
      bubble.classList.toggle('min');
      e.currentTarget.textContent = bubble.classList.contains('min') ? '+' : '–';
    });

    $('name-input').addEventListener('input', e => {
      sel().name = e.target.value || '未命名';
      markLayers(); markDirty(); writeHashSoon();
    });
    $('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });

    // 拖动气泡
    const bh = $('bubble-head');
    bh.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      const r = bubble.getBoundingClientRect();
      const off = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      let moved = false;
      const move = ev => {
        moved = true;
        bubblePinned = { left: ev.clientX - off.dx, top: ev.clientY - off.dy };
        positionBubble(true);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (!moved) bubblePinned = bubblePinned; // no-op
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });

    // 双击气泡头 = 回到跟随图形
    bh.addEventListener('dblclick', () => { bubblePinned = null; positionBubble(true); });

    window.addEventListener('resize', () => {
      resize();
      positionBubble(true);
    });

    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

      if (e.code === 'Space') { e.preventDefault(); $('btn-play').click(); }
      else if (e.key === 'Escape') { deselect(); }
      else if (e.key === 'r' || e.key === 'R') { $('btn-random').click(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeItem(selId); }
      else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); duplicateItem(selId); }
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const it = sel();
        if (e.key === 'ArrowLeft') it.x -= step;
        if (e.key === 'ArrowRight') it.x += step;
        if (e.key === 'ArrowUp') it.y -= step;
        if (e.key === 'ArrowDown') it.y += step;
        syncPos(); positionBubble(); markDirty(); writeHashSoon();
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  const selEl = $('effect-select');
  for (const id in REGISTRY) {
    const o = document.createElement('option');
    o.value = id; o.textContent = REGISTRY[id].label;
    selEl.appendChild(o);
  }
  selEl.value = effectId;

  document.body.dataset.bg = 'grid';
  resize();

  const fromHash = readHash();
  if (!fromHash) {
    // 空白启动时用内置的「tomotachi」作为默认样式
    const def0 = effect.presets[0] && effect.presets[0].state;
    scene.items = [makeItem(def0, scene.vw / 2, scene.vh / 2)];
    scene.items[0].name = effect.presets[0] ? effect.presets[0].name : '变体 1';
    selId = scene.items[0].id;
  }

  buildCreateBar();
  renderLayers();
  buildBubble();
  positionBubble();
  syncBubbleValues();
  bind();
  requestAnimationFrame(tick);

  /* 调试 / 自动化入口 */
  window.SKStudio = {
    get scene() { return scene; },
    get state() { return sel().st; },
    set state(v) { Object.assign(sel().st, v); syncBubbleValues(); markLayers(); markDirty(); writeHashSoon(); },
    get time() { return t; },
    set time(v) { t = v; draw(); },
    get selId() { return selId; },
    get selected() { return sel(); },
    get hash() { writeHash(); return location.hash; },
    get bubblePinned() { return bubblePinned; },
    addItem, createShape, buildCreateBar, duplicateItem, removeItem, selectItem, moveLayer,
    setRot(x) { sel().rot = x; syncSizeInputs(); markLayers(); },
    redraw: draw,
    exportText, runAction, positionBubble
  };
})();

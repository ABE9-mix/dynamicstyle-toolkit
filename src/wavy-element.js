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

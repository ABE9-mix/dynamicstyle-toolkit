/* ============================================================
   Dynamic Style Toolkit · 总目录逻辑
   读 apps.json → 渲染卡片 → 懒加载每个应用的实时预览 iframe
   新增应用只需要：apps/<id>/ 目录 + apps.json 里加一条
   ============================================================ */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const grid = $('grid');
  /** 应用预览统一按 1440×900 的视口渲染，再等比缩放进卡片 */
  const FRAME_W = 1440, FRAME_H = 900;

  /* ---------------- 主题 ---------------- */
  const THEME_KEY = 'dst:theme';
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  (function initTheme() {
    let t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!t) t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    applyTheme(t);
  })();
  $('theme-btn').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  /* ---------------- 卡片 ---------------- */
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function makeCard(app, i) {
    const a = el('a', 'card');
    a.href = app.path;
    a.setAttribute('aria-label', (app.name || app.id) + ' · 打开');

    const shot = el('div', 'shot');
    const badge = el('span', 'badge', String(i + 1).padStart(2, '0') + ' / ' + (app.status === 'ready' ? 'LIVE' : 'WIP'));
    const ifr = document.createElement('iframe');
    // 懒加载：先只记 data-src，进了视口再真加载
    ifr.dataset.src = app.path + (app.path.includes('?') ? '&' : '?') + 'preview=1';
    ifr.title = (app.name || app.id) + ' 实时预览';
    ifr.setAttribute('scrolling', 'no');
    ifr.setAttribute('tabindex', '-1');
    ifr.setAttribute('aria-hidden', 'true');
    ifr.addEventListener('load', () => ifr.classList.add('loaded'));
    const enter = el('span', 'enter', '↗');
    shot.append(ifr, badge, enter);

    const body = el('div', 'body');
    const row1 = el('div', 'row1');
    row1.append(
      el('span', 'idx', String(i + 1).padStart(2, '0')),
      el('span', 'name', app.name || app.id)
    );
    if (app.sub) row1.append(el('span', 'sub', app.sub));
    const desc = el('p', 'desc', app.desc || '');
    const tags = el('div', 'tags');
    (app.tags || []).forEach(t => tags.append(el('span', 'tag', t)));
    body.append(row1, desc, tags);

    a.append(shot, body);
    return a;
  }

  function makeSoonCard() {
    const d = el('div', 'card soon');
    d.append(
      el('div', 'plus', '＋'),
      el('div', 't', '下一个应用'),
      el('div', 'h', 'apps/<id>/ + apps.json 一条')
    );
    return d;
  }

  /* ---------------- 缩放 iframe 适配卡片 ---------------- */
  const frames = [];
  function fitAll() {
    for (const f of frames) {
      const w = f.parentElement.clientWidth;
      if (!w) continue;
      f.style.transform = 'scale(' + (w / FRAME_W) + ')';
    }
  }
  addEventListener('resize', fitAll, { passive: true });

  /* ---------------- 懒加载 ---------------- */
  let io = null;
  function observe(ifr) {
    if (!('IntersectionObserver' in window)) { ifr.src = ifr.dataset.src; return; }
    io = io || new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const f = e.target;
        if (f.dataset.src && !f.src) f.src = f.dataset.src;
        io.unobserve(f);
      }
    }, { rootMargin: '300px' });
    io.observe(ifr);
  }

  /* ---------------- 启动 ---------------- */
  fetch('apps.json', { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('apps.json ' + r.status)))
    .then(data => {
      const apps = (data.apps || []).filter(a => a && a.id && a.path);
      if (data.name) $('brand-name').textContent = data.name;
      if (data.tagline) $('tagline').textContent = data.tagline;
      $('app-count').textContent = apps.length + ' 个应用';
      document.title = (data.name || 'Dynamic Style Toolkit') + ' · 可参数化的网页样式组件集';

      grid.innerHTML = '';
      apps.forEach((app, i) => grid.append(makeCard(app, i)));
      grid.append(makeSoonCard());

      frames.length = 0;
      document.querySelectorAll('.shot iframe').forEach(f => { frames.push(f); observe(f); });
      fitAll();
      // 首屏两帧等布局稳定再量一次
      requestAnimationFrame(fitAll);
      setTimeout(fitAll, 300);
    })
    .catch(err => {
      grid.innerHTML = '';
      const p = el('p', 'lede', '读取 apps.json 失败：' + err.message);
      p.style.gridColumn = '1 / -1';
      grid.append(p);
    });
})();

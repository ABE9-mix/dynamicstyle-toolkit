/* ============================================================
   动态样式工具集 · 总目录逻辑
   读 apps.json → 渲染卡片 → 懒加载每个应用的实时预览 iframe
   新增应用：apps/<id>/ 目录 + apps.json 加一条（中文为主、英文为辅）
   ============================================================ */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const grid = $('grid');
  const FRAME_W = 1440, FRAME_H = 900;   // 预览按 1440×900 渲染，再等比缩放进卡片

  /* ---------------- 主题 ---------------- */
  const THEME_KEY = 'dst:theme';
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  (function initTheme() {
    // 允许 ?theme=dark|light 强制指定（便于截图/嵌入），否则读存档，再否则跟随系统
    const q = new URLSearchParams(location.search).get('theme');
    let t = (q === 'dark' || q === 'light') ? q : null;
    if (!t) { try { t = localStorage.getItem(THEME_KEY); } catch (e) {} }
    if (!t) t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    applyTheme(t);
  })();
  $('theme-btn').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  /* ---------------- 小工具 ---------------- */
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* 卡片：中文名为主、英文名为辅 */
  function makeCard(app, i) {
    const zh = app.zh || app.name || app.id;
    const en = app.en || app.id;

    const a = el('a', 'card');
    a.href = app.path;
    a.setAttribute('aria-label', zh + (app.sub ? '·' + app.sub : '') + ' 打开');

    const shot = el('div', 'shot');
    const badge = el('span', 'badge',
      String(i + 1).padStart(2, '0') + (app.status === 'ready' ? ' · 实时' : ' · 开发中'));
    const ifr = document.createElement('iframe');
    let qs = 'preview=1';
    // 应用若指定了 previewBg，把底色透给应用（卡片里才能和页面底色分开）
    if (app.previewBg) qs += '&bg=' + encodeURIComponent(app.previewBg);
    ifr.dataset.src = app.path + (app.path.includes('?') ? '&' : '?') + qs;
    ifr.title = zh + ' 实时预览';
    ifr.setAttribute('scrolling', 'no');
    ifr.setAttribute('tabindex', '-1');
    ifr.setAttribute('aria-hidden', 'true');
    ifr.addEventListener('load', () => ifr.classList.add('loaded'));
    shot.append(ifr, badge, el('span', 'enter', '↗'));

    const body = el('div', 'body');
    const head = el('div', 'head');
    head.append(
      el('span', 'idx', String(i + 1).padStart(2, '0')),
      el('span', 'name-zh', zh),
      el('span', 'name-en', en)
    );
    if (app.sub) head.append(el('span', 'tagline-zh', app.sub));

    const desc = el('p', 'desc', app.desc || '');
    const tags = el('div', 'tags');
    (app.tags || []).forEach(t => tags.append(el('span', 'tag', t)));
    body.append(head, desc, tags);

    a.append(shot, body);
    return a;
  }

  function makeSoonCard() {
    const d = el('div', 'card soon');
    d.append(
      el('div', 'plus', '＋'),
      el('div', 't', '下一个工具'),
      el('div', 'h', 'apps/<id>/ + apps.json 一条')
    );
    return d;
  }

  /* ---------------- 缩放 iframe ---------------- */
  const frames = [];
  function fitAll() {
    for (const f of frames) {
      const w = f.parentElement.clientWidth;
      if (!w) continue;
      f.style.transform = 'scale(' + (w / FRAME_W) + ')';
    }
  }
  addEventListener('resize', fitAll, { passive: true });

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

      // 所有可选文案都走 setText：节点缺失时静默跳过，不让整页报「读取 apps.json 失败」
      const setText = (id, v) => { const e = $(id); if (e) e.textContent = v; };

      if (data.name) setText('foot-zh', data.name);
      if (data.intro) {
        setText('tagline', data.intro);
        // 短句当标语处理（拉大字号/字距），长句仍是正文段落
        const t = $('tagline');
        if (t && data.intro.length <= 24) t.classList.add('is-slogan');
      }
      if (data.taglineEn) setText('tagline-en', data.taglineEn);
      setText('app-count', apps.length + ' 个工具');
      document.title = (data.name || 'kenzakiABE9 的图形生成库') + ' · 网页图形与样式生成工具集';

      grid.innerHTML = '';
      apps.forEach((app, i) => grid.append(makeCard(app, i)));
      grid.append(makeSoonCard());

      frames.length = 0;
      document.querySelectorAll('.shot iframe').forEach(f => { frames.push(f); observe(f); });
      fitAll();
      requestAnimationFrame(fitAll);
      setTimeout(fitAll, 300);
    })
    .catch(err => {
      console.error('[catalog]', err);
      grid.innerHTML = '';
      const p = el('p', 'lede', '读取 apps.json 失败：' + (err && err.message ? err.message : err));
      p.style.gridColumn = '1 / -1';
      grid.append(p);
    });
})();

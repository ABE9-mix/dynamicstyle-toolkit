/* 用真实键盘事件测数字框（JS 里 set value + dispatchEvent 测不出问题）
   用法：node tools/type-test.mjs [url] [字段名或 css 选择器] [要键入的文本]
   例：  node tools/type-test.mjs http://127.0.0.1:8791/index.html 振幅 12.5
         node tools/type-test.mjs http://127.0.0.1:8791/index.html label:波数 7
         node tools/type-test.mjs http://127.0.0.1:8791/index.html "#bubble-body .num" 3
*/
import { setTimeout as sleep } from 'node:timers/promises';
import { spawn } from 'node:child_process';

const URL = process.argv[2] || 'http://127.0.0.1:8791/index.html';
const ARG = process.argv[3] || '振幅';
const TEXT = process.argv[4] || '12.5';

const resolveExpr = (arg) => {
  if (arg.startsWith('#') || arg.startsWith('.')) return `document.querySelector(${JSON.stringify(arg)})`;
  const name = arg.replace(/^label:/, '');
  return `[...document.querySelectorAll('#bubble-body .field')].find(f => f.querySelector('label') && f.querySelector('label').textContent.trim() === ${JSON.stringify(name)})?.querySelector('.num')`;
};
const Q = resolveExpr(ARG);

const PORT = 9446;
const PROFILE = process.env.LOCALAPPDATA + '\\Temp\\stylekit-chrome-type';

spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=1440,900',
  '--force-device-scale-factor=1', 'about:blank'
], { detached: true, stdio: 'ignore' }).unref();

let wsUrl;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
  catch { await sleep(250); }
}
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + m.params.exceptionDetails.exception?.description);
};
const send = (method, params = {}, sessionId) => new Promise(res => {
  const mid = ++id; pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Network.enable', {}, sessionId);
await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
await send('Page.navigate', { url: URL }, sessionId);
await sleep(2200);

const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
  return r.result.result.value;
};

// 展开全部折叠组，方便测组内字段
await ev(`document.querySelectorAll('.acc-head').forEach(h => h.click())`);
await sleep(250);

const snapshot = () => ev(`(() => {
  const S = window.SKStudio, it = S.selected;
  return JSON.stringify({ field: (${Q}) ? (${Q}).value : null, st: it.st, x: it.x, y: it.y, rot: +((it.rot||0)*180/Math.PI).toFixed(3) });
})()`);

const diff = (a, b) => {
  const A = JSON.parse(a), B = JSON.parse(b), out = [];
  for (const k of ['x', 'y', 'rot']) if (A[k] !== B[k]) out.push(`${k}: ${A[k]} → ${B[k]}`);
  for (const k in B.st) if (A.st[k] !== B.st[k]) out.push(`${k}: ${A.st[k]} → ${B.st[k]}`);
  return out.join(' | ') || '(模型未变)';
};

await ev(`(() => { const el = (${Q}); if (el) el.scrollIntoView({ block: 'center' }); })()`);
await sleep(220);
const box = JSON.parse(await ev(`(() => { const el = (${Q}); if (!el) return '{"err":1}'; const b = el.getBoundingClientRect(); return JSON.stringify({ x: Math.round(b.left + b.width/2), y: Math.round(b.top + b.height/2), value: el.value }); })()`));
if (box.err) { console.log('找不到目标输入框:', ARG); process.exit(1); }
console.log(`目标: ${ARG}  初始值 ${box.value}`);

await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 }, sessionId);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 }, sessionId);
await sleep(120);
await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 }, sessionId);
await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 }, sessionId);
await sleep(80);

const KEYCODES = { '.': [190, 'Period'], '-': [189, 'Minus'], '+': [187, 'Equal'] };
// 支持 "ArrowUp*3" 这种写法：连按方向键（测原生步进）
let last = await snapshot();
console.log('聚焦后 显示=', JSON.parse(last).field);
const arrow = TEXT.match(/^(Arrow\w+)\*(\d+)$/);
const keys = arrow ? Array.from({ length: +arrow[2] }, () => arrow[1]) : [...TEXT];
for (const ch of keys) {
  const [vkey, code] = KEYCODES[ch] || (ch.startsWith('Arrow')
    ? [{ ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 }[ch], ch]
    : [ch.toUpperCase().charCodeAt(0), 'Key' + ch.toUpperCase()]);
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: ch, windowsVirtualKeyCode: vkey, nativeVirtualKeyCode: vkey, code,
    ...(ch.startsWith('Arrow') ? {} : { text: ch, unmodifiedText: ch })
  }, sessionId);
  if (!ch.startsWith('Arrow')) {
    await send('Input.dispatchKeyEvent', { type: 'char', key: ch, text: ch, unmodifiedText: ch, windowsVirtualKeyCode: vkey }, sessionId);
  }
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, windowsVirtualKeyCode: vkey, nativeVirtualKeyCode: vkey, code }, sessionId);
  await sleep(90);
  const cur = await snapshot();
  console.log(`  键入 "${ch}"  显示=${JSON.parse(cur).field}   ${diff(last, cur)}`);
  last = cur;
}
await ev(`(${Q}).blur()`);
await sleep(150);
const fin = await snapshot();
console.log(`失焦后 显示=${JSON.parse(fin).field}`);
console.log('页面错误:', logs.length ? logs.join('\n') : '(clean)');

await send('Target.closeTarget', { targetId });
ws.close();
process.exit(0);

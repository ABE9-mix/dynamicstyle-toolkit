/* 用 headless chrome 生成三种导出物并落盘，做「导出的东西真能跑」的验收
   用法：node tools/gen-exports.mjs [outDir] */
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const OUT = process.argv[2] || 'tools/shots';
mkdirSync(OUT, { recursive: true });

const PORT = 9445;
const PROFILE = process.env.LOCALAPPDATA + '\\Temp\\stylekit-chrome-export';

spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--window-size=1200,800', '--force-device-scale-factor=1', 'about:blank'
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
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('[log] ' + m.params.entry.text);
};
const send = (method, params = {}, sessionId) => new Promise(res => {
  const mid = ++id; pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Log.enable', {}, sessionId);
await send('Network.enable', {}, sessionId);
await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
await send('Page.navigate', { url: 'http://127.0.0.1:8791/index.html' }, sessionId);
await sleep(2200);

async function evalJs(expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true
  }, sessionId);
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
  return r.result.result.value;
}

const preset = Number(process.argv[3] ?? 0);
// 组一个 3 变体场景（同时验证多块导出）
await evalJs(`(() => {
  const S = SKStudio;
  while (S.scene.items.length > 1) S.removeItem(S.scene.items[S.scene.items.length - 1].id);
  const first = S.scene.items[0];
  Object.assign(first.st, Object.assign({}, SKWavy.presets[${preset}].state, { w: 420, h: 300 }));
  first.x = 330; first.y = 340; first.name = '底层';
  const a = S.addItem({ fill: '#ff6b3d', w: 300, h: 300, amp: 6, waves: 8, radius: 90, drift: -0.6 }, 640, 220);
  a.name = '中层';
  const b = S.addItem({ fill: '#8b6bff', w: 380, h: 230, amp: 10, waves: 4, radius: 40, mode: 'ridged' }, 600, 450);
  b.name = '顶层';
  S.selectItem(b.id);
  return S.scene.items.length;
})()`);
await sleep(300);
await evalJs(`SKStudio.time = 1.2`);
await sleep(200);

const svg = await evalJs('SKExport.svg(SKStudio.scene, SKStudio.time)');
const css = await evalJs('SKExport.css(SKStudio.state, SKStudio.time)');
const html = await evalJs('SKExport.html(SKStudio.scene)');

writeFileSync(OUT + '/export.svg', svg);
writeFileSync(OUT + '/export.css', css);
writeFileSync(OUT + '/export.html', html);
writeFileSync(OUT + '/export.css-demo.html',
  `<!doctype html><meta charset="utf-8"><style>
   html,body{margin:0;height:100%;display:grid;place-items:center;background:#0a0a0e}
   ${css.replace(/^\/\*[\s\S]*?\*\//, '')}
   .pad{display:grid;place-items:center}
   </style><div class="pad"><div class="wavy-block"></div></div>`);

console.log('wrote', OUT, logs.length ? logs : '(no page errors)');
ws.close();
await send('Target.closeTarget', { targetId });
process.exit(0);

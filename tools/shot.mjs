/* headless 验收：截图 + 收集 console / 异常
   用法：node tools/shot.mjs <url> <out.png> [waitMs] [evalScript]
   固定调试端口 + 固定 user-data-dir，复用同一个实例；不按进程名杀进程。 */
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const [, , url, out = 'shot.png', waitMs = '2500', evalScript = ''] = process.argv;
const PORT = 9444;
const PROFILE = process.env.LOCALAPPDATA + '\\Temp\\stylekit-chrome';

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome devtools 未就绪');
}

const { spawn } = await import('node:child_process');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const child = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--window-size=1440,900', '--force-device-scale-factor=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion',
  'about:blank'
], { detached: true, stdio: 'ignore' });
child.unref();

const browserWs = await connect();

// 用 browser 级连接建 target
const ws = new WebSocket(browserWs);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let id = 0;
const pending = new Map();
const logs = [];
let targetId = null;

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push('[console.' + msg.params.type + '] ' + msg.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    logs.push('[exception] ' + (d.exception?.description || d.text));
  }
  if (msg.method === 'Log.entryAdded') {
    logs.push('[log.' + msg.params.entry.level + '] ' + msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
  }
};

const send = (method, params = {}, sessionId) => new Promise((res) => {
  const mid = ++id;
  pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { result: t } = await send('Target.createTarget', { url: 'about:blank' });
targetId = t.targetId;
const { result: att } = await send('Target.attachToTarget', { targetId, flatten: true });
const sid = att.sessionId;

await send('Page.enable', {}, sid);
await send('Runtime.enable', {}, sid);
await send('Log.enable', {}, sid);
await send('Network.enable', {}, sid);
await send('Network.setCacheDisabled', { cacheDisabled: true }, sid);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sid);
await send('Page.navigate', { url }, sid);
await sleep(Number(waitMs));

if (evalScript) {
  const r = await send('Runtime.evaluate', { expression: evalScript, awaitPromise: true, returnByValue: true }, sid);
  console.log('EVAL:', JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails ?? null));
  await sleep(600);
}

const clipArg = process.argv[6];   // 可选：x,y,w,h —— 只截这一块，方便看圆角细节
const shot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
  ...(clipArg ? { clip: (() => { const [x, y, width, height] = clipArg.split(',').map(Number); return { x, y, width, height, scale: 2 }; })() } : {})
}, sid);
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));

console.log('--- logs ---');
console.log(logs.length ? logs.join('\n') : '(clean)');
console.log('saved', out);

await send('Target.closeTarget', { targetId });
ws.close();
process.exit(0);

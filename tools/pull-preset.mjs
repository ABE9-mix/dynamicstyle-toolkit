/* 用「复制过来的 Chrome localStorage」启动 headless，读出用户的预设
   用法：node tools/pull-preset.mjs                                     */
import { setTimeout as sleep } from 'node:timers/promises';
import { spawn } from 'node:child_process';

const PORT = 9449;
const PROFILE = process.env.TEMP + '\\sk-lspull';

spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=1200,800',
  'about:blank'
], { detached: true, stdio: 'ignore' }).unref();

let wsUrl;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
  catch { await sleep(250); }
}
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let id = 0; const pending = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}, sessionId) => new Promise(res => {
  const mid = ++id; pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);

const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.result?.exceptionDetails) return { err: r.result.exceptionDetails.exception?.description };
  return r.result.result.value;
};

for (const url of ['http://127.0.0.1:8791/', 'http://localhost:8791/']) {
  await send('Page.navigate', { url }, sessionId);
  await sleep(1500);
  const keys = await ev(`JSON.stringify(Object.keys(localStorage))`);
  const raw = await ev(`localStorage.getItem('stylekit:presets:v3')`);
  console.log('ORIGIN ' + url);
  console.log('  keys:', keys);
  console.log('  presets:', typeof raw === 'string' ? raw : JSON.stringify(raw));
  console.log('');
}

await send('Target.closeTarget', { targetId });
ws.close();
process.exit(0);

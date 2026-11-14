/* WebM 录制端到端测试：真的点按钮录制，检查下载出的文件
   用法：node tools/webm-test.mjs [秒数]                                     */
import { setTimeout as sleep } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SECS = Number(process.argv[2] || 2);
const OUT = resolve('tools/shots/webm-out');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const PORT = 9448;
const PROFILE = process.env.LOCALAPPDATA + '\\Temp\\stylekit-chrome-webm';

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
  if (m.method === 'Browser.downloadProgress') logs.push('[download] ' + JSON.stringify(m.params));
};
const send = (method, params = {}, sessionId) => new Promise(res => {
  const mid = ++id; pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});

await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT, eventsEnabled: true });

const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
for (const d of ['Page', 'Runtime', 'Network']) await send(d + '.enable', {}, sessionId);
await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
await send('Page.navigate', { url: 'http://127.0.0.1:8791/index.html' }, sessionId);
await sleep(2400);

const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
  return r.result.result.value;
};

console.log('MediaRecorder 支持:', await ev(`JSON.stringify({
  mr: !!window.MediaRecorder,
  vp9: MediaRecorder.isTypeSupported('video/webm;codecs=vp9'),
  vp8: MediaRecorder.isTypeSupported('video/webm;codecs=vp8'),
  plain: MediaRecorder.isTypeSupported('video/webm'),
  cap: !!HTMLCanvasElement.prototype.captureStream
})`));

// 让画面动起来，确保录到的是动画
await ev(`(() => { const S = window.SKStudio; S.state = { amp: 10, waves: 6, drift: 1.2, speed: 0.8 }; return 1; })()`);
await sleep(300);

const btn = `[data-act="webm"]`;
await ev(`document.querySelector('${btn}').click()`);
console.log('已开始录制，等待 ' + SECS + 's …');
await sleep(SECS * 1000);
const mid = await ev(`document.querySelector('${btn}').textContent`);
console.log('录制中按钮文案:', mid);
await ev(`document.querySelector('${btn}').click()`);
await sleep(1800);

console.log('结束后按钮文案:', await ev(`document.querySelector('${btn}').textContent`));
console.log('toast:', await ev(`document.getElementById('toast').textContent`));

const files = readdirSync(OUT).map(f => ({ f, size: statSync(join(OUT, f)).size }));
console.log('下载目录:', files);

console.log('页面错误:', logs.filter(l => l.startsWith('[exception]')).length ? logs.filter(l => l.startsWith('[exception]')).join('\n') : '(clean)');

await send('Target.closeTarget', { targetId });
ws.close();
process.exit(0);

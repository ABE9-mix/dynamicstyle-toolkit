/* SVG 导入端到端测试：真的选文件（CDP DOM.setFileInputFiles），不是模拟
   用法：node tools/svg-import-test.mjs [svg 路径]                        */
import { setTimeout as sleep } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const FILE = resolve(process.argv[2] || 'tests/sample-blob.svg');
const PORT = 9447;
const PROFILE = process.env.LOCALAPPDATA + '\\Temp\\stylekit-chrome-svg';

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
for (const d of ['Page', 'Runtime', 'DOM', 'Network']) await send(d + '.enable', {}, sessionId);
await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
await send('Page.navigate', { url: 'http://127.0.0.1:8791/index.html' }, sessionId);
await sleep(2400);

const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
  return r.result.result.value;
};

// 点图标栏里的「SVG 路径」按钮，让它展开二级菜单
await ev(`document.querySelectorAll('.shape-btn')[4].click()`);
await sleep(400);

// 找到隐藏的 file input，塞文件
await send('DOM.enable', {}, sessionId);
const { result: { root } } = await send('DOM.getDocument', { depth: -1, pierce: true }, sessionId);
const { result: { nodeId } } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '.import-row input[type=file]' }, sessionId);
console.log('file input nodeId =', nodeId);
await send('DOM.setFileInputFiles', { files: [FILE], nodeId }, sessionId);
await sleep(1200);

const state = await ev(`(() => {
  const s = SKStudio.state;
  return JSON.stringify({ shape: s.shape, dLen: (s.pathD || '').length, segs: (s.pathD || '').split('L').length, head: (s.pathD || '').slice(0, 60) });
})()`);
console.log('导入后 state =', state);

const info = await ev(`(() => {
  const sh = SKShape.get(SKStudio.state);
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  for (let i=0;i<sh.count;i++){ minX=Math.min(minX,sh.xs[i]); maxX=Math.max(maxX,sh.xs[i]); minY=Math.min(minY,sh.ys[i]); maxY=Math.max(maxY,sh.ys[i]); }
  const b = SKWavy.outline(SKStudio.state, 1);
  return JSON.stringify({ 点数: sh.count, 弧长: Math.round(sh.total), bbox: [Math.round(minX),Math.round(minY),Math.round(maxX),Math.round(maxY)], 轮廓点: b.length/2, 块尺寸: [SKStudio.state.w, SKStudio.state.h] });
})()`);
console.log('几何 =', info);
console.log('页面错误:', logs.length ? logs.join('\n') : '(clean)');

await send('Target.closeTarget', { targetId });
ws.close();
process.exit(0);

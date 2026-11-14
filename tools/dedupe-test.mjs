import { setTimeout as sleep } from "node:timers/promises";
import { spawn } from "node:child_process";
const PORT = 9451, PROFILE = process.env.TEMP + "\\sk-lspull2";
spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new",`--remote-debugging-port=${PORT}`,`--user-data-dir=${PROFILE}`,"--no-first-run","--no-default-browser-check","--window-size=1440,900","about:blank"], { detached:true, stdio:"ignore" }).unref();
let wsUrl; for (let i=0;i<40&&!wsUrl;i++){ try{ wsUrl=(await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }catch{ await sleep(250); } }
const ws = new WebSocket(wsUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
let id=0; const pend=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const send=(method,params={},sid)=>new Promise(r=>{const mid=++id;pend.set(mid,r);ws.send(JSON.stringify({id:mid,method,params,...(sid?{sessionId:sid}:{})}));});
const {result:{targetId}}=await send("Target.createTarget",{url:"about:blank"});
const {result:{sessionId}}=await send("Target.attachToTarget",{targetId,flatten:true});
await send("Page.enable",{},sessionId); await send("Runtime.enable",{},sessionId);
await send("Page.navigate",{url:"http://127.0.0.1:8791/"},sessionId); await sleep(2500);
const ev=async x=>{const r=await send("Runtime.evaluate",{expression:x,awaitPromise:true,returnByValue:true},sessionId); return r.result?.exceptionDetails? "ERR "+r.result.exceptionDetails.exception?.description : r.result.result.value;};
console.log("localStorage 里的用户预设:", await ev("localStorage.getItem('stylekit:presets:v3')"));
console.log("界面上 chip 文案:", await ev("JSON.stringify([...document.querySelectorAll('.presets .chip')].map(c=>c.textContent.trim()))"));
console.log("tomotachi 出现次数:", await ev("[...document.querySelectorAll('.presets .chip')].filter(c=>c.textContent.trim()==='tomotachi').length"));
await send("Target.closeTarget",{targetId}); ws.close(); process.exit(0);


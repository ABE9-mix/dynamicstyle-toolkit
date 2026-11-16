const fs = require("fs");
global.window = globalThis;
eval(fs.readFileSync("src/noise.js","utf8"));
eval(fs.readFileSync("src/shape.js","utf8"));
eval(fs.readFileSync("src/wavy.js","utf8"));
const base = Object.assign({}, SKWavy.defaults, { w: 240, h: 155, shadow: false });
function maxDisp(st, t) {
  const shp = SKShape.get(st);
  const P = shp.total;
  const pts = SKWavy.outline(st, t);
  let m = 0, sum = 0;
  const n = pts.length >> 1;
  for (let i = 0; i < n; i++) {
    const p = SKShape.sample(shp, i / n * P);
    const dx = pts[i*2] - p.x, dy = pts[i*2+1] - p.y;
    const d = Math.hypot(dx, dy);
    m = Math.max(m, d); sum += d;
  }
  return { max: m, mean: sum / n };
}
for (const amp of [0, 10, 20, 30, 40]) {
  const st = Object.assign({}, base, { amp });
  const r = maxDisp(st, 0.8);
  console.log(`amp=${amp}%  理论=${(amp/100*155).toFixed(1)}px  max=${r.max.toFixed(2)}px  mean=${r.mean.toFixed(2)}px`);
}
console.log("--- 时间连续性（同一参数相邻时刻位移差）---");
const st = base;
let prev = SKWavy.outline(st, 0);
for (const t of [0.016, 0.032, 0.048, 0.064]) {
  const cur = SKWavy.outline(st, t);
  let md = 0;
  for (let i = 0; i < cur.length; i += 2) md = Math.max(md, Math.hypot(cur[i]-prev[i], cur[i+1]-prev[i+1]));
  console.log(`t=${t.toFixed(3)} → 单帧最大点位移 ${md.toFixed(3)}px`);
  prev = cur;
}
console.log("--- 闭合性（首尾点距离应≈相邻点距）---");
const pts = SKWavy.outline(st, 0.5), n = pts.length >> 1;
const d01 = Math.hypot(pts[0]-pts[2], pts[1]-pts[3]);
const dEnd = Math.hypot(pts[0]-pts[(n-1)*2], pts[1]-pts[(n-1)*2+1]);
console.log(`相邻点距=${d01.toFixed(2)}px  首尾距=${dEnd.toFixed(2)}px  点数=${n}`);

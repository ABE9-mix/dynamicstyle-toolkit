/* 打包出可直接上传到静态托管（腾讯 EdgeOne Pages 等）的纯静态站点
   用法：node tools/build-site.mjs
   产物：dist-upload/
     index.html          总目录
     apps.json           应用清单
     assets/             总目录的 css/js
     apps/<id>/          每个应用的运行时文件（index.html + css/src/dist/assets，若有）
   排除：各应用的 tools/ tests/ 预览大图（只服务开发与验收）
*/
import { cpSync, rmSync, mkdirSync, readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-upload');
const APP_DIRS = ['css', 'src', 'dist', 'assets', 'js'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

/* 站点骨架 */
for (const f of ['index.html', 'apps.json']) {
  const src = join(root, f);
  if (!existsSync(src)) throw new Error('缺少 ' + f);
  cpSync(src, join(out, f));
}
if (existsSync(join(root, 'assets'))) cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });

/* 各应用 */
const manifest = JSON.parse(readFileSync(join(root, 'apps.json'), 'utf8'));
const apps = (manifest.apps || []).filter(a => a && a.path);
const copied = [];

for (const app of apps) {
  const rel = app.path.replace(/\/+$/, '');          // apps/stylekit
  const srcDir = join(root, rel);
  if (!existsSync(srcDir)) { console.warn('  ! 跳过（目录不存在）: ' + rel); continue; }
  const dstDir = join(out, rel);
  mkdirSync(dstDir, { recursive: true });

  const entry = join(srcDir, 'index.html');
  if (!existsSync(entry)) { console.warn('  ! 跳过（无 index.html）: ' + rel); continue; }
  cpSync(entry, join(dstDir, 'index.html'));

  const dirs = [];
  for (const d of APP_DIRS) {
    if (existsSync(join(srcDir, d))) { cpSync(join(srcDir, d), join(dstDir, d), { recursive: true }); dirs.push(d); }
  }
  copied.push(rel + '  (' + dirs.join(' ') + ')');
}

/* 统计 */
let total = 0, count = 0;
(function walk(p) {
  for (const name of readdirSync(p)) {
    const full = join(p, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full); else { total += st.size; count++; }
  }
})(out);

console.log(`dist-upload/  ${count} 个文件  ${(total / 1024).toFixed(1)} KB`);
console.log('  应用:');
for (const c of copied) console.log('    ' + c);

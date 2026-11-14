/* 打包出可直接上传到静态托管（腾讯 EdgeOne Pages 等）的纯静态目录
   用法：node tools/build-site.mjs
   产物：dist-upload/  （index.html + css + src + dist）
   注意：src 里只有运行时需要的 6 个 js；tools/ tests/ 不进产物 */
import { cpSync, rmSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-upload');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const files = ['index.html'];
const dirs = ['css', 'src', 'dist'];

for (const f of files) cpSync(join(root, f), join(out, f));
for (const d of dirs) cpSync(join(root, d), join(out, d), { recursive: true });

// 统计
let total = 0, count = 0;
(function walk(p) {
  for (const name of readdirSync(p)) {
    const full = join(p, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else { total += st.size; count++; }
  }
})(out);

console.log(`dist-upload/  ${count} 个文件  ${(total / 1024).toFixed(1)} KB`);
for (const d of ['', 'css/', 'src/', 'dist/']) {
  const p = join(out, d);
  console.log('  ' + (d || './') + '  ' + readdirSync(p).join(' '));
}

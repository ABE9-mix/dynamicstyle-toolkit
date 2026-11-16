/* 把 core 三个文件拼成 dist/wavy-edge.js —— 可直接 <script src> 引入的分发文件
   用法：node tools/bundle.mjs                                        */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['src/noise.js', 'src/shape.js', 'src/wavy.js', 'src/wavy-element.js'];

const banner = `/*! StyleKit · wavy-edge  |  噪声生成波浪边缘的纯色块组件
 *  <wavy-edge w="520" h="340" fill="#c8f751" amp="6.5" waves="9"></wavy-edge>
 *  属性：w h radius amp waves octaves lacunarity gain warp drift speed mode seed
 *        fill stroke stroke-w stroke-color shadow shadow-blur shadow-y shadow-color shadow-alpha
 *  MIT — 直接用，改到爆。 */\n`;

const out = banner + files.map(f => readFileSync(join(root, f), 'utf8')).join('\n');
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/wavy-edge.js'), out);
console.log('dist/wavy-edge.js  ' + (out.length / 1024).toFixed(1) + ' KB');

# kenzakiABE9 的图形生成库

**KENZAKIABE9 · GRAPHICS LIBRARY**

一组能直接在网页里跑的**图形与样式生成工具**。每个工具都是一个独立、自包含的静态应用：
没有构建步骤、没有依赖，双击 `index.html` 就能跑，也能单独嵌进任何页面。

站点根目录就是**总目录页**（catalog）：列出所有组件，每个卡片里跑的是**真·实时预览**
（一个 `?preview=1` 的 iframe，等比缩放），点进去就是完整工作台。

线上：<https://github.com/ABE9-mix/dynamicstyle-toolkit>（可直连腾讯 EdgeOne Pages）

---

## 目录结构

```
/
├─ index.html            总目录页
├─ apps.json             工具清单（总目录读它渲染）
├─ DESIGN.md             设计方法：中文主导的排版系统（新应用照它做）
├─ assets/
│  ├─ logo.svg           站点 Logo（矢量，页头 + favicon）
│  ├─ catalog.css        总目录样式
│  └─ catalog.js         总目录逻辑（渲染卡片 + 懒加载实时预览）
├─ tools/
│  └─ build-site.mjs     打包出 dist-upload/（可直传静态托管）
└─ apps/
   ├─ stylekit/          工具 ①：噪声边缘组件 StyleKit
   │  ├─ index.html
   │  ├─ css/ src/ dist/
   │  ├─ tools/          该应用的开发/验收脚本（不进产物）
   │  ├─ tests/          该应用的对照页（不进产物）
   │  └─ README.md       应用自己的文档
   └─ wavedot/           工具 ②：动态波点背景 WaveDots
      └─ index.html      单文件（WebGL 引擎 + 面板都在里面）
```

---

## 本地预览

```powershell
# 在仓库根目录起一个静态服务（必须走 http，预览 iframe 和 fetch 都要它）
py -3 -m http.server 8791 --bind 127.0.0.1
# 总目录： http://127.0.0.1:8791/
# 应用：   http://127.0.0.1:8791/apps/stylekit/
```

---

## 新增一个工具（3 步）

1. **建目录**：`apps/<id>/`，里面至少要有 `index.html`。相对路径写成同目录相对
   （`css/…`、`src/…`），因为整套站点会按原样搬到静态托管上。
2. **加清单**：往 `apps.json` 的 `apps` 数组里加一条：

   ```json
   {
     "id": "myapp",
     "name": "My App",
     "sub": "一句话副标题",
     "desc": "两三句说明，会显示在卡片里。",
     "tags": ["canvas", "svg"],
     "path": "apps/myapp/",
     "accent": "#8bd1d8",
     "status": "ready"
   }
   ```

   `status` 写 `ready` 会显示 `LIVE` 角标，其它值显示 `WIP`。

3. **可选：加"预览模式"**：如果应用和 StyleKit 一样有 HUD，建议支持 `?preview=1` ——
   隐藏所有面板、只留画面。总目录的卡片就是这样拿到干净实时预览的
   （参考 `apps/stylekit/src/studio.js` 里 `preview-mode` 那一段）。

完毕，刷新总目录即可看到新卡片，`build-site.mjs` 也会自动把它打进去。

---

## 工具清单

| # | 工具 | 说明 | 目录 |
|---|---|---|---|
| 01 | **噪声边缘组件** `StyleKit` | 会呼吸的网页样式组件：纯色块 + 三维噪声沿法线实时生成波浪边缘；五种底形（矩形/椭圆/多边形/星形/SVG 路径）、图形上拖把手缩放旋转、导出 HTML / CSS / SVG / JSON / WebM | [`apps/stylekit/`](apps/stylekit/README.md) |
| 02 | **动态波点背景** `WaveDots` | 规则点阵上跑一道方向性行波：可调方向、波长、波速与起伏强度，波峰处点更大更亮；鼠标透镜 + 点击涟漪，导出 PNG 或独立 WebGL 代码 | [`apps/wavedot/`](apps/wavedot/index.html) |

---

## 分支策略

| 分支 | 角色 | 说明 |
|---|---|---|
| `main` | **稳定线** | 只接收验收过的提交；建站托管（EdgeOne Pages）从这里构建 |
| `dev` | **探索线** | 现阶段的新功能、新工具、重构都先投这里，跑通了再合回 `main` |

```powershell
git switch dev      # 日常开发
git switch main && git merge --no-ff dev   # 验收后合并
```

## 品牌

Logo：`assets/logo.svg`（矢量，48×48 视框，任意尺寸清晰）。
陶土色超椭圆底板 + 奶油色「K」波浪笔画 + 青色波点，同时指向「kenzaki」与「图形生成」。
总目录页头、三个页面的 favicon 都用它。

## 打包 / 部署（腾讯 EdgeOne Pages）

```powershell
node tools/build-site.mjs      # → dist-upload/（总目录 + 各应用的运行时文件）
```

`dist-upload/` 只含运行时文件（`index.html`、`apps.json`、`assets/`、`apps/*/{index.html,css,src,dist,assets}`），
各应用的 `tools/`、`tests/`、预览大图都不会进去。

| 方式 | 构建命令 | 输出目录 |
|---|---|---|
| 免构建 | 留空 | `/`（仓库根目录本身就是可跑的站点） |
| 干净产物 | `node tools/build-site.mjs` | `dist-upload` |

---

## 约定

- **字体**：中文无衬线优先 `OPPO Sans` → `MiSans` → 系统回退；代码/数字用等宽。
- **无描边**：UI 强调用实色面或描边环（仅背景选择器用环），不用 1px 装饰线。
- **圆角**：iOS 连续曲率 `corner-shape: superellipse(1.6)`；胶囊类用 `round`。
- **零依赖**：所有 JS 都是原生脚本，直接 `<script src>`；不用打包器。

# kenzakiABE9 的图形生成库

**KENZAKIABE9 · GRAPHICS LIBRARY**

一组能直接在网页里跑的**图形与样式生成工具**。每个工具都是一个独立、自包含的静态应用：
没有构建步骤、没有依赖，双击 `index.html` 就能跑，也能单独嵌进任何页面。

站点根目录就是**总目录页**（catalog）：列出所有组件，每个卡片里跑的是**真·实时预览**
（一个 `?preview=1` 的 iframe，等比缩放），点进去就是完整工作台。

线上：<https://illustrious-entremet-5db35f.netlify.app/>　·　仓库：<https://github.com/ABE9-mix/dynamicstyle-toolkit>

---

## 目录结构

```
/
├─ index.html            总目录页
├─ apps.json             工具清单（总目录读它渲染）
├─ DESIGN.md             设计方法：中文主导的排版系统（新应用照它做）
├─ netlify.toml          Netlify 部署配置（构建命令 + 发布目录 + 缓存头）
├─ assets/
│  ├─ logo.svg           站点图标（当前为 iOS 网格占位，矢量 favicon）
│  ├─ catalog.css        总目录样式
│  └─ catalog.js         总目录逻辑（渲染卡片 + 懒加载实时预览）
├─ brand/
│  └─ logo-k.svg        早期 K 标设计稿（暂存，不进产物）
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
| `dev` | **探索线（默认工作分支）** | 所有开发都在这里；Netlify 只连 `main`，所以推 `dev` **不消耗构建额度** |
| `main` | **发布线** | 只在效果验收达标后合并进来；**每次往 main 推 = 一次 Netlify 构建（计费）**，所以攒一批再合 |

```powershell
git switch dev                                  # 日常开发（本地起服务看效果）
py -3 -m http.server 8791 --bind 127.0.0.1
# …验收 OK 后…
git switch main && git merge --no-ff dev && git push origin main   # 这一步才会触发部署
```

> Netlify 按构建次数计费，所以：**在 dev 上把东西做完、本地验完，再合并到 main**。
> `netlify.toml` 里还加了 `ignore` 规则 —— 只改 README / 设计文档这类非站点文件时，构建会自动跳过。

## 品牌

**图标设计暂停中**，当前 `assets/logo.svg` 是 **iOS 标准 App Icon 网格占位**：
1024 画布、圆角 22.37%（≈229）、Ø824 圆形 + 728 方形关键线 + 中心占位字形。
16px 下是干净的中性方砖，正好当 favicon 占位。

之前的「K」标设计稿保留在 `brand/logo-k.svg`（不参与打包），等图标定了再启用。

## 打包 / 部署（Netlify）

仓库根有 [`netlify.toml`](netlify.toml)，Netlify 会自动读，**不用在面板里手填**：

| 项 | 值 |
|---|---|
| 构建命令 | `node tools/build-site.mjs` |
| 发布目录 | `dist-upload` |
| Node | 任意 18+（构建只做文件拷贝，无依赖） |

```powershell
node tools/build-site.mjs      # 本地复现：→ dist-upload/
```

`dist-upload/` 只含运行时文件（`index.html`、`apps.json`、`assets/`、`apps/*/{index.html,css,src,dist,assets}`），
各应用的 `tools/`、`tests/`、预览大图都不会进去（15 个文件 / 约 194 KB）。

- **连 Git 部署**：Netlify → Add new site → Import from Git → 选 `ABE9-mix/dynamicstyle-toolkit`，分支 `main`，其余留空（读 netlify.toml）
- **手动上传**：把 `dist-upload/` 里的内容打包成 zip 拖进 Netlify Drop
- Netlify 默认域名形如 `xxx.netlify.app`，也可在 Domain management 绑自定义域名（自动 HTTPS）

> 想改成「零构建」：删掉 `netlify.toml` 里的 `command`，`publish` 改成 `"."`
> —— 代价是 README / DESIGN.md / tools / tests 也会被一起发布。

---

## 约定

- **字体**：中文无衬线优先 `OPPO Sans` → `MiSans` → 系统回退；代码/数字用等宽。
- **无描边**：UI 强调用实色面或描边环（仅背景选择器用环），不用 1px 装饰线。
- **圆角**：iOS 连续曲率 `corner-shape: superellipse(1.6)`；胶囊类用 `round`。
- **零依赖**：所有 JS 都是原生脚本，直接 `<script src>`；不用打包器。

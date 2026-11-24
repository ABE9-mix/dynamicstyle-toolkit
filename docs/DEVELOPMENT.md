# 开发与发布手册

给维护者自己看的：分支、部署、加工具的流程。对外展示用 [README.md](../README.md)。

---

## 本地开发

```powershell
cd stylekit
py -3 -m http.server 8791 --bind 127.0.0.1
# 总目录 http://127.0.0.1:8791/
# 工具   http://127.0.0.1:8791/apps/stylekit/ 、 /apps/wavedot/
```

必须走 http（页面要 `fetch apps.json`、卡片里嵌预览 iframe）。

---

## 分支与发布

| 分支 | 角色 | 说明 |
|---|---|---|
| `dev` | **默认工作分支** | 所有开发都在这里；Netlify 只连 `main`，推 `dev` **不消耗构建额度** |
| `main` | **发布线** | 只在验收达标后合并进来；**往 main 推一次 = 一次 Netlify 构建（计费）** |

```powershell
git switch dev                     # 日常
# …改完，本地起服务验收…
git switch main && git merge --no-ff dev && git push origin main   # 只有这一步触发部署
```

> Netlify 按构建次数计费，所以攒一批改动再合并。
> `netlify.toml` 里还有 `ignore` 规则：只改 README / 本文档这类非站点文件时，构建会自动跳过。

---

## 部署（Netlify）

线上：<https://illustrious-entremet-5db35f.netlify.app/>

仓库根的 [`netlify.toml`](../netlify.toml) 已写好，面板里不用手填：

| 项 | 值 |
|---|---|
| 构建命令 | `node tools/build-site.mjs` |
| 发布目录 | `dist-upload` |
| Node | 18+（构建只做文件拷贝，无依赖） |

- **连 Git**：Netlify → Add new site → Import from Git → 选仓库 → 分支 `main`
- **手动上传**：`node tools/build-site.mjs` 后把 `dist-upload/` 内容打包拖进 Netlify Drop
- 免费版右下角有「Powered by Netlify」角标，可在 Site configuration → Build & deploy → Post processing 关掉

打包产物只含运行时文件（`index.html`、`apps.json`、`assets/`、`apps/*/{index.html,css,src,dist,assets}`），
各工具的 `tools/`、`tests/`、截图都不会进去（约 15 个文件 / 200 KB）。

---

## 新增一个工具

1. 建目录 `apps/<id>/`，至少一个 `index.html`，内部路径全部用相对路径（整站会被原样搬到静态托管）。
2. 往 [`apps.json`](../apps.json) 的 `apps` 数组加一条：

   ```json
   {
     "id": "myapp",
     "zh": "中文名",
     "en": "English Name",
     "sub": "一句话副标题",
     "desc": "两三句说明，显示在卡片里",
     "tags": ["canvas"],
     "path": "apps/myapp/",
     "previewBg": "#1b2129",
     "status": "ready"
   }
   ```

   - `status: "ready"` 显示「实时」角标，其它值显示「开发中」
   - `previewBg` 可选：应用自带不透明背景时填，卡片预览才会和页面底色分开，
     且应用需支持 `?bg=%23rrggbb` 覆盖背景色

3. 支持 `?preview=1`（总目录卡片就靠它拿实时预览）：隐藏**所有** `.hud` 浮层、只留画面、不画选框。
4. 左上角放一个 `← 返回` 指到站点根 `../../`，并带 `.hud` 类（预览时自动隐藏）。
5. favicon 指向 `../../assets/logo.svg`。

视觉细则（字体、字号阶梯、零描边、圆角、配色、卡片预览规范）见 [DESIGN.md](../DESIGN.md)，最后按它的检查清单过一遍。

---

## 目录结构

```
.
├─ index.html            总目录页
├─ apps.json             工具清单（总目录读它渲染）
├─ DESIGN.md             设计方法（中文主导排版系统）
├─ netlify.toml          部署配置
├─ docs/
│  ├─ DEVELOPMENT.md     本文
│  └─ preview/           README 用的截图
├─ brand/                早期图标草稿（不进产物）
├─ assets/               总目录样式 + 图标
├─ tools/
│  └─ build-site.mjs     打包出 dist-upload/
└─ apps/
   ├─ stylekit/          噪声边缘组件（index.html + css/ src/ dist/ + tools/ + tests/）
   └─ wavedot/           动态波点背景（单文件）
```

---

## 验收脚本

都在 `apps/stylekit/tools/`（依赖本机 Chrome，headless 截图 + 抓 console）：

```powershell
node apps/stylekit/tools/shot.mjs <url> <out.png> [waitMs] [evalScript] [clip]  # 截图 + 报错收集
node apps/stylekit/tools/type-test.mjs <url> <字段名> <要键入的文本>              # 真实键盘事件测输入框
node apps/stylekit/tools/svg-import-test.mjs <svg>                             # SVG 导入端到端
node apps/stylekit/tools/webm-test.mjs [秒数]                                  # WebM 录制
node apps/stylekit/tools/check.js                                              # 噪声几何数值检查
```

约定：**不要按进程名杀 Chrome**（会连用户的浏览器一起杀掉）；用固定调试端口 + 固定
`user-data-dir` 复用同一个 headless 实例。

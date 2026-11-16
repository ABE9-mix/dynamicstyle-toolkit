# 设计方法 · Chinese-first Type System

本站所有页面（含以后新增的应用）都按这一套做。核心一句话：
**中文承担信息，英文只做辅助；强调用「面」，不用「线」。**

---

## 1. 语言层级（中文主导 / 英文辅助）

| 角色 | 语言 | 规格 | 例子 |
|---|---|---|---|
| 主标题 | 中文 | 40–96px，`clamp()`，行高 1.04，字距 0 | 会呼吸的**网页样式**组件 |
| 眉标 eyebrow | **仅英文** | 11px mono，`uppercase`，字距 .22em，陶土色 | `DYNAMIC STYLE TOOLKIT` |
| 英文辅助行 | 仅英文 | 12.5px mono，字距 .02em，`--dim` | `A small collection of live…` |
| 中文导语 | 中文 | 15.5px，行高 1.85，`--muted` | 一组可参数化、可实时预览的… |
| 卡片主名 | 中文 | 19px / 660 | 噪声边缘组件 |
| 卡片副名 | 英文 | 10.5px mono，`uppercase`，字距 .16em，`--dim` | `STYLEKIT` |
| 技术标签 | 英文 | 10.5px mono，`--dim` | `canvas` `noise` `svg` |
| 正文/说明 | 中文 | 13.5px，行高 1.8 | — |

硬规则：

- 同级信息里，**中文在前、英文在后**，不要反过来。
- 英文出现在中文语境里时，一律 **小号 + 大写 + 宽字距 + 弱化色**，让它退成背景纹理，不抢中文。
- 技术术语（canvas / SVG / WebM / clip-path…）保留英文原样，不翻译。
- 一屏内不要出现两条同等重量的中英标题。

## 2. 字体

```css
--zh:   "OPPO Sans", "OPPOSans", "MiSans", "HarmonyOS Sans SC",
        "Source Han Sans SC", "Noto Sans SC", "PingFang SC",
        "Microsoft YaHei", system-ui, sans-serif;   /* 中文：OPPO Sans 优先，其次 MiSans */
--mono: ui-monospace, "SFMono-Regular", "Cascadia Mono", "JetBrains Mono", Consolas, monospace;
```

- **中文无衬线只用 OPPO Sans / MiSans 优先的这条栈**（不要默认雅黑 / PingFang）。
- 数字、英文标签、序号、代码用 mono —— 和中文形成明确的层级差。
- 不引入衬线体。
- 本机已装 `OPPO Sans 4.0` 与 `MiSans`（9 个字重），渲染即为 OPPO Sans。
  上线后访客若无此字体则落到 Noto Sans SC / 系统字体；若要做字形一致，再按需子集化打包（当前未打包，避免几 MB 字体）。

## 3. 字号阶梯（只用这几档）

| token | 用途 |
|---|---|
| 96 / 72 / 56 / 40 | 展示级标题（`clamp` 自动过渡） |
| 19 | 卡片主名 |
| 15.5 | 导语 |
| 14.5 | 区块标题 |
| 13.5 | 正文 |
| 12.5 | meta / 按钮 |
| 11 | 眉标 / 序号 |
| 10.5 | 英文副名 / 技术标签 |

## 4. 行高 / 行宽 / 字距

- 中文正文行高 **1.8**，导语 1.85，大标题 1.04。
- 中文行宽控制在 **≈26 字**（`max-width: 26em`）；英文段落 `52ch`。
- **中文标题不放负字距**（CJK 会挤在一起）；英文标签用 **.16–.22em 正字距**。

## 5. 零描边，强调靠「面」

- 不用 1px 装饰线。分层靠半透明底色 + 阴影 + 背景模糊。
- 选中 / 激活 = **实色填充 + 深色字**（`background: var(--clay); color: #1a0f0a`）。
- 折叠标题展开 = 青色半透明实色底。
- 唯一例外：背景选择器用 `inset box-shadow` 画描边环（圆点语义不明）。
- 需要虚线占位时用 `box-shadow: inset 0 0 0 1.5px`，不用 `border`。

## 6. 圆角

- 卡片 / 面板 / 输入框：`border-radius: 16–22px` + `corner-shape: superellipse(1.6)`（iOS 连续曲率）。
- 胶囊（按钮 / chip / 徽标）：`border-radius: 999px` + `corner-shape: round`
  （胶囊套 superellipse 会把两端压成直角，看着像圆角没了 —— 踩过）。

## 7. 配色

| token | 值 | 用途 |
|---|---|---|
| `--bg` | `#14171b` | 深色底 |
| `--bg-2` | `#191d23` | 卡片内预览底 |
| `--clay` | `#d97a4f` | 主强调（暖陶土） |
| `--teal` | `#8bd1d8` | 次强调 |
| `--cream` | `#f9efb9` | 高亮 / 进入按钮 |
| `--text` / `--muted` / `--dim` | `#eef1f5` / `#98a2ad` / `#6b7681` | 三级文字 |

- 背景不是纯平：两层很大的径向光（左上暖、右下冷），边缘化开。
- 明暗双主题：`html[data-theme="light|dark"]`，跟随系统、可手动切、存 `localStorage`；
  支持 `?theme=dark|light` 强制指定（截图 / 嵌入用）。

## 8. 卡片 = 真·实时预览

- 卡片里嵌 `<iframe src="apps/<id>/?preview=1">`，按 **1440×900** 渲染再 `scale()` 进卡片。
- `pointer-events: none`（点击穿透给卡片链接）、`IntersectionObserver` 懒加载、`opacity` 淡入。
- 应用侧必须支持 `?preview=1`：隐藏**所有** `.hud` 浮层，只留画面，且不画选框/把手。

## 9. Logo 与导航

- **Logo**：`assets/logo.svg`，48×48 视框。陶土色超椭圆底板 + 奶油色「K」波浪笔画 + 一颗青色波点。
  16px 仍能读成 K，所以同一个文件同时做站点页头图标和 favicon，不做第二套小图。
- **返回键**：所有工具页左上角固定一个 `← 返回`，指向站点根 `../../`。
  样式与页头其他胶囊一致（`rgba(255,255,255,.07)` 底、`round` 圆角、12px）。
  必须带 `.hud` 类，这样在 `?preview=1` 的卡片预览里会自动隐藏。
- 站点根（总目录）自身不放返回键 —— 它就是入口。

## 10. 新增应用检查清单

- [ ] `apps/<id>/index.html`，内部路径全用相对路径
- [ ] 支持 `?preview=1`（隐藏全部 `.hud`、不画选框）
- [ ] 左上角有 `← 返回` 指向 `../../`，且在预览模式下隐藏（带 `.hud` 类即可）
- [ ] favicon 指向 `../../assets/logo.svg`
- [ ] `apps.json` 加一条：`zh`（中文名）/ `en`（英文名）/ `desc`（中文说明）/ `tags`
- [ ] 中文用 `--zh` 字体栈，英文标签用 mono + uppercase + 宽字距
- [ ] 无 1px 描边；强调用实色面；圆角走 superellipse
- [ ] `node tools/build-site.mjs` 后产物能在纯静态下跑通

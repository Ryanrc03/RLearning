# 英文版 — 设计文档

日期：2026-10-30　状态：设计已和作者确认，待实施

## 目标

给英文读者一个入口：站点界面和首页有完整英文版，选定的笔记可以在中文和英文之间切换。没有翻译的笔记照常出现在英文版的目录里，标「中文」，点进去读中文原文。

## 范围

- 做：英文界面（侧栏、顶栏、活动方格、路线图、笔记页框架）、英文首页（含 3D 主机的英文文字，见 `2026-10-30-machine-cover-design.md`）、第一批 3 篇笔记连同它们的 7 个图。
- 第一批笔记（一条线：概念 → 失败模式 → 真实实验，也是封面 GRPO 视角讲的那条线）：

| 笔记 | 中文汉字数 | 图 |
| --- | --- | --- |
| `ml/post-training/grpo` | 1,492 | `GrpoFigure`、`PolicyGradientStepFigure` |
| `ml/post-training/reward-hacking` | 853 | `RewardHackingFigure` |
| `ml/post-training/grpo-3060-project` | 3,317 | `G3ResultsFigure`、`G3TrainingCurves`、`G3CheckpointSweep`、`G3SampleCompare` |

- 不做：其余 129 篇笔记和 239 个图的翻译（它们默认中文，之后一篇篇加）；按浏览器语言自动跳转；英文搜索分词。

## 方案选择

用独立的 `/en/...` URL。备选是同一 URL 用按钮切换（两种语言打进同一个包、英文读者先看到中文闪一下、搜索引擎只收中文），或独立子域名 / 部署（两套构建，3 篇笔记不值得）。

## 路由与布局

英文页需要 `<html lang="en">`，所以拆成两个 root layout（Next 16 文档 `route-groups.md`「Creating multiple root layouts」）：

```text
app/
  (zh)/layout.tsx              <html lang="zh-CN">，原 app/layout.tsx
  (zh)/page.tsx                中文首页
  (zh)/notes/[...slug]/page.tsx
  (en)/en/layout.tsx           <html lang="en">
  (en)/en/page.tsx             英文首页
  (en)/en/notes/[...slug]/page.tsx   generateStaticParams 只产出有 en 的笔记
```

- 两个 layout 共用一个 `SiteShell({ lang })`（原 `NotebookShell` 加 `lang`），两个笔记页共用一个 `NotePageView({ lang, slug })`，不复制页面代码。
- 跨 root layout 跳转会整页刷新（文档 Caveats），只发生在切换语言时，可以接受。
- 实施时先确认静态导出下 404 页仍能生成；如果多 root layout 让 `404.html` 缺失，按文档开 `global-not-found`。

## 语言切换

- 有英文版的笔记，标题区显示 `中文 | English`，并输出 `<link rel="alternate" hreflang="zh-CN|en">`。
- 顶栏加一个语言入口：首页在 `/` 和 `/en/` 之间切；笔记页在两种语言之间切；在英文版里打开一篇没翻译的笔记，入口提示「This note is in Chinese」。
- 英文版侧栏和最近记录里的链接：有英文的指向 `/en/notes/<slug>/`，没有的指向 `/notes/<slug>/` 并带一个小 `中文` 标记。

## 数据

- `NoteEntry` 加可选字段 `en?: { title: string; description: string; updated: string }`。有这个字段就表示有英文版。
- 英文 MDX 和中文放在一起：`content/ml/post-training/grpo.en.mdx`。英文笔记页的组件表单独一张（`noteComponentsEn`），和中文那张同一个文件里维护。
- 英文页的 `updated` 早于中文 `updated` 时，文首显示一行「The Chinese original has been updated since this translation.」。
- 界面文字集中到 `lib/i18n.ts`：`const dict = { zh: {...}, en: {...} }`，加 `t(lang, key)`。分类的 `description` 和 `topics` 也进字典。

## 图的英文化

- 笔记页用 `<LangProvider lang>` 包住正文；图组件用 `useLang()` 读语言，默认 `"zh"`。
- 7 个图各自在文件里写 `const COPY = { zh: {...}, en: {...} }`，渲染时取 `COPY[lang]`。英文 MDX 用的是同一批组件，不传额外 props。
- 其余图不改，在英文版里显示中文。

## 翻译原则

- 由 Claude 翻译、作者审。读起来像英文写的，不逐字对照；数字、代码、公式、变量名、专有名词不动；中文里的举例（坏橙子那道题等）保留原题。
- 链接：指向已翻译笔记的改成 `/en/notes/...`，其余保持中文链接。

## 测试

- `tests/i18n.test.ts`：每个有 `en` 的条目都有对应 `.en.mdx` 并在 `noteComponentsEn` 里注册；英文 `generateStaticParams` 正好是这 3 篇；`dict.zh` 和 `dict.en` 的 key 完全一致。
- `npm test`、`npm run typecheck`、`npm run lint`、`npm run build` 全过；`out/en/index.html` 和 3 篇 `out/en/notes/.../index.html` 存在且 `<html lang="en">`。
- 内置浏览器预览：`/en/` 和 3 篇英文笔记、语言切换来回跳对、英文版目录里的 `中文` 标记、英文图里没有残留中文、手机宽度无横向溢出。

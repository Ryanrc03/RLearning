# English Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve an English site under `/en/` (UI, homepage with the 3D machine, and three translated notes with their seven figures), with a `中文 | English` switch on notes that have both.

**Architecture:** Two root layouts (`app/(zh)` with `<html lang="zh-CN">`, `app/(en)/en` with `<html lang="en">`) render one shared `RootDocument`. Pages are thin wrappers around shared views (`HomePageView`, `NotePageView`) that take `lang`. Client components read the language from a `LangProvider` context; server components get it as a prop. UI strings live in one dictionary in `lib/i18n.ts`; figure strings live next to each figure as `COPY = { zh, en }`.

**Tech Stack:** Next 16 App Router (static export, route groups with multiple root layouts), React 19, MDX via `@next/mdx`, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-30-english-version-design.md`. **Depends on:** `docs/superpowers/plans/2026-10-30-machine-cover.md` (it creates `lib/i18n.ts`, `MachineHero` with a `lang` prop, and `profile.intro`).

---

## File map

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/i18n.ts` | Modify | dictionary, `t`, path helpers, per-note text helpers |
| `tests/i18n.test.ts` | Create | dictionary parity, path helpers, English registry |
| `components/i18n/LangProvider.tsx` | Create | `LangProvider`, `useLang()` |
| `components/layout/RootDocument.tsx` | Create | `<html>`, fonts, global CSS, shell; shared by both root layouts |
| `app/layout.tsx` | Delete | replaced by the two below |
| `app/(zh)/layout.tsx`, `app/(en)/en/layout.tsx` | Create | root layouts |
| `app/page.tsx` → `app/(zh)/page.tsx` | Move | thin wrapper over `HomePageView` |
| `app/(en)/en/page.tsx` | Create | thin wrapper over `HomePageView` |
| `components/home/HomePageView.tsx` | Create | the homepage body, from today's `app/page.tsx` |
| `content/noteComponents.ts` | Create | the MDX import map moved out of the note page, plus `noteComponentsEn` |
| `components/layout/NotePageView.tsx` | Create | the note body, from today's note page |
| `app/notes/[...slug]/page.tsx` → `app/(zh)/notes/[...slug]/page.tsx` | Move | thin wrapper |
| `app/(en)/en/notes/[...slug]/page.tsx` | Create | thin wrapper, English params only |
| `content/notes.ts` | Modify | `en?` field on `NoteEntry`; `en` on the three notes |
| `content/navigation.ts` | Modify | `description` and `topics` become `Localized` |
| `lib/content.ts` | Modify | `getNoteToc(slug, lang)` reads `.en.mdx` for English |
| `components/layout/NotebookShell.tsx`, `SidebarNav.tsx`, `SplitReader.tsx`, `LearningActivity.tsx`, `Avatar.tsx` | Modify | strings and links via `lang` |
| `components/home/RoadmapGraph.tsx`, `RoadmapDrawer.tsx`, `content/roadmap.ts` | Modify | strings and links via `lang` |
| `components/home/machine/MachineHero.tsx` | Modify | links and titles via `lang` |
| 7 figures + `lib/ml/grpo3060.ts`, `lib/ml/grpo.ts`, `lib/ml/policyGradient.ts` | Modify | `COPY = { zh, en }` and `Localized` labels |
| `content/ml/post-training/{grpo,reward-hacking,grpo-3060-project}.en.mdx` | Create | translations |

---

### Task 1: i18n core (TDD)

**Files:** Modify `lib/i18n.ts`; Create `tests/i18n.test.ts`

- [ ] **Step 1: Write the failing tests** — `tests/i18n.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { dict, homePath, notePath, noteText, otherLang, stripLang } from "@/lib/i18n";
import { noteEntries } from "@/content/notes";

test("both languages define exactly the same UI keys", () => {
  assert.deepEqual(Object.keys(dict.en).sort(), Object.keys(dict.zh).sort());
});

test("note paths: English only for translated notes", () => {
  const translated = { slug: "ml/post-training/grpo", en: { title: "GRPO", description: "d", updated: "2026-10-30" } };
  const chineseOnly = { slug: "cs/os/overview" };
  assert.equal(notePath(translated, "zh"), "/notes/ml/post-training/grpo/");
  assert.equal(notePath(translated, "en"), "/en/notes/ml/post-training/grpo/");
  assert.equal(notePath(chineseOnly, "en"), "/notes/cs/os/overview/");
});

test("home paths and prefix stripping", () => {
  assert.equal(homePath("zh"), "/");
  assert.equal(homePath("en"), "/en/");
  assert.equal(stripLang("/en/notes/a/b"), "/notes/a/b");
  assert.equal(stripLang("/en"), "");
  assert.equal(stripLang("/notes/a"), "/notes/a");
  assert.equal(otherLang("zh"), "en");
});

test("note text falls back to Chinese when there is no translation", () => {
  const note = noteEntries.find((entry) => !entry.en)!;
  assert.equal(noteText(note, "en").title, note.title);
  assert.equal(noteText(note, "en").translated, false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test tests/i18n.test.ts`
Expected: FAIL — `dict` / `notePath` not exported.

- [ ] **Step 3: Implement** — replace `lib/i18n.ts`:

```ts
export type Lang = "zh" | "en";

/** A reader-facing string in both site languages. */
export type Localized = Record<Lang, string>;

export const otherLang = (lang: Lang): Lang => (lang === "zh" ? "en" : "zh");
export const homePath = (lang: Lang) => (lang === "en" ? "/en/" : "/");

/** "/en/notes/x" → "/notes/x"; "/en" → "" (the shell strips trailing slashes before calling). */
export const stripLang = (pathname: string) => (pathname === "/en" ? "" : pathname.replace(/^\/en(?=\/)/, ""));

type Translatable = { slug: string; en?: { title: string; description: string; updated: string } };

/** English readers get the English page when one exists, otherwise the Chinese original. */
export const notePath = (note: Translatable, lang: Lang) =>
  lang === "en" && note.en ? `/en/notes/${note.slug}/` : `/notes/${note.slug}/`;

export function noteText(note: Translatable & { title: string; description: string }, lang: Lang) {
  const translated = lang === "en" && Boolean(note.en);
  return translated
    ? { title: note.en!.title, description: note.en!.description, translated }
    : { title: note.title, description: note.description, translated };
}

const zh = {
  skipToContent: "跳到正文",
  openSidebar: "打开目录",
  closeSidebar: "关闭目录",
  sidebarLabel: "知识库目录",
  mainNav: "主导航",
  searchPlaceholder: "搜索笔记",
  noResults: "没有匹配「{q}」的笔记",
  homeLink: "知识库首页",
  overview: "Overview",
  publicLabel: "Personal knowledge garden",
  chineseOnly: "中文",
  switchToOther: "English",
  readingMinutes: "约 {n} 分钟",
  seriesLabel: "系列：{title}",
  prevInSeries: "← 上一篇 · {title}",
  nextInSeries: "下一篇 →",
  stillGrowing: "这篇笔记还会继续生长。",
  backToLibrary: "回到知识库",
  translationBehind: "",
  heroTitle: "保持好奇，慢慢积累",
  heroTitleEnd: "。",
  roadmapTitle: "知识路线图",
  roadmapHint: "箭头指向下一步 · 点节点看笔记",
  recentTitle: "最近记录",
  noteCount: "{n} 篇笔记",
  showAll: "查看全部 {n} 篇",
  activityTitle: "每一点积累，都算数。",
  activityBody: "记录笔记的创建与最近更新，慢慢把知识连成线。",
  activityPeriod: "过去 26 周",
  activityAria: "过去 26 周的笔记更新：{updates} 次更新，{days} 个活跃日。每天一个方格，颜色越深表示当天更新的笔记越多。",
  activityFuture: "{date} · 尚未到来",
  activityDay: "{date} · {n} 篇笔记更新",
  activityLess: "少",
  activityMore: "多",
  statNotes: "篇公开笔记",
  statDays: "个活跃日",
  statUpdates: "次笔记更新",
  avatarAlt: "{name} 的头像",
  close: "关闭",
  splitPaneLabel: "并排阅读：{title}",
  splitResize: "拖动调整左右宽度",
  splitResizeTitle: "拖动调整宽度，双击恢复一半",
  splitOpenFull: "整页打开",
  splitClose: "关闭并排阅读",
  splitCloseTitle: "关闭 (Esc)",
  roadmapNotes: "{n} 篇",
  roadmapLegend: "颜色图例",
  roadmapProgress: "进度条 = stable / growing / seed 的比例",
  roadmapAria: "知识路线图，箭头表示先后顺序",
  roadmapLayer: "第 {n} 层",
  roadmapDrawerNotes: "{n} 篇笔记",
  roadmapBefore: "先修",
  roadmapAfter: "下一步",
};

export const dict: Record<Lang, typeof zh> = {
  zh,
  en: {
    skipToContent: "Skip to content",
    openSidebar: "Open contents",
    closeSidebar: "Close contents",
    sidebarLabel: "Library contents",
    mainNav: "Main navigation",
    searchPlaceholder: "Search notes",
    noResults: "No notes match “{q}”",
    homeLink: "Library home",
    overview: "Overview",
    publicLabel: "Personal knowledge garden",
    chineseOnly: "中文",
    switchToOther: "中文",
    readingMinutes: "{n} min read",
    seriesLabel: "Series: {title}",
    prevInSeries: "← Previous · {title}",
    nextInSeries: "Next →",
    stillGrowing: "This note is still growing.",
    backToLibrary: "Back to the library",
    translationBehind: "The Chinese original has been updated since this translation.",
    heroTitle: "Stay curious, keep collecting",
    heroTitleEnd: ".",
    roadmapTitle: "Roadmap",
    roadmapHint: "Arrows point to what comes next · click a node to see its notes",
    recentTitle: "Recently added",
    noteCount: "{n} notes",
    showAll: "Show all {n}",
    activityTitle: "Every bit of progress counts.",
    activityBody: "Each square is a day of notes created or updated.",
    activityPeriod: "Last 26 weeks",
    activityAria: "Note updates over the last 26 weeks: {updates} updates on {days} active days. One square per day; darker means more notes updated that day.",
    activityFuture: "{date} · not yet",
    activityDay: "{date} · {n} notes updated",
    activityLess: "Less",
    activityMore: "More",
    statNotes: "public notes",
    statDays: "active days",
    statUpdates: "note updates",
    avatarAlt: "{name}'s avatar",
    close: "Close",
    splitPaneLabel: "Side-by-side: {title}",
    splitResize: "Drag to resize the panes",
    splitResizeTitle: "Drag to resize, double-click to reset to half",
    splitOpenFull: "Open full page",
    splitClose: "Close side-by-side reading",
    splitCloseTitle: "Close (Esc)",
    roadmapNotes: "{n} notes",
    roadmapLegend: "Color legend",
    roadmapProgress: "Bar = share of stable / growing / seed notes",
    roadmapAria: "Knowledge roadmap; arrows show reading order",
    roadmapLayer: "Layer {n}",
    roadmapDrawerNotes: "{n} notes",
    roadmapBefore: "Before this",
    roadmapAfter: "Next",
  },
};

export type DictKey = keyof typeof zh;

/** Look up a UI string and fill {placeholders}. */
export function t(lang: Lang, key: DictKey, vars: Record<string, string | number> = {}): string {
  return dict[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
```

Before writing the Chinese values, open each component listed in Task 6 and copy its current Chinese strings exactly into `zh` (the values above are from a read of the source; any mismatch in the existing text wins, so Chinese pages render byte-for-byte as before).

- [ ] **Step 4: Add `en?` to `NoteEntry`** in `content/notes.ts` (inside the type, after `layout?`):

```ts
  /** Present when an English translation exists at content/<slug>.en.mdx. */
  en?: { title: string; description: string; updated: string };
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx tsx --test tests/i18n.test.ts`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/i18n.ts tests/i18n.test.ts content/notes.ts
git commit -m "Add the UI dictionary and language path helpers"
```

---

### Task 2: Language context

**Files:** Create `components/i18n/LangProvider.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";

import { createContext, useContext } from "react";
import type { Lang } from "@/lib/i18n";

const LangContext = createContext<Lang>("zh");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** The page's language; "zh" outside a provider, so figures keep working anywhere. */
export const useLang = () => useContext(LangContext);
```

- [ ] **Step 2: Typecheck, commit**

```bash
npm run typecheck
git add components/i18n/LangProvider.tsx
git commit -m "Add LangProvider and useLang"
```

---

### Task 3: Two root layouts

**Files:** Create `components/layout/RootDocument.tsx`, `app/(zh)/layout.tsx`, `app/(en)/en/layout.tsx`; Delete `app/layout.tsx`; Move `app/page.tsx` → `app/(zh)/page.tsx`, `app/notes` → `app/(zh)/notes`

- [ ] **Step 1: Read the docs first** — `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` (multiple root layouts, full reload between them, home route must live inside a group) and `layout.md` (root layout rules).

- [ ] **Step 2: Create `components/layout/RootDocument.tsx`** — today's `app/layout.tsx` body with `lang`:

```tsx
import { Patrick_Hand } from "next/font/google";
import NotebookShell from "@/components/layout/NotebookShell";
import LearningActivity from "@/components/layout/LearningActivity";
import { LangProvider } from "@/components/i18n/LangProvider";
import type { Lang } from "@/lib/i18n";
import "@/app/globals.css";
import "@/styles/visualization.css";
import "@/styles/sketch.css";
import "@/styles/machine.css";
import "katex/dist/katex.min.css";

// Handwritten face for the Excalidraw-style figures; self-hosted at build time.
const sketchFont = Patrick_Hand({ weight: "400", subsets: ["latin"], variable: "--font-sketch", display: "swap" });

export default function RootDocument({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <html lang={lang === "en" ? "en" : "zh-CN"} className={sketchFont.variable} suppressHydrationWarning>
      <head>
        {/* A note opened in the split-reading pane drops the site chrome before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: "if(window.self!==window.top)document.documentElement.classList.add('is-embedded')" }} />
      </head>
      <body>
        <LangProvider lang={lang}>
          <NotebookShell activity={<LearningActivity lang={lang} />}>{children}</NotebookShell>
        </LangProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create the two layouts**

`app/(zh)/layout.tsx`:

```tsx
import type { Metadata } from "next";
import RootDocument from "@/components/layout/RootDocument";

export const metadata: Metadata = {
  metadataBase: new URL("https://rlearning-gamma.vercel.app"),
  title: { default: "RLearning", template: "%s | RLearning" },
  description: "Notes on computer systems, machine learning, LLMs, and AI infrastructure.",
  alternates: { languages: { "zh-CN": "/", en: "/en/" } },
};

export default function ZhLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument lang="zh">{children}</RootDocument>;
}
```

`app/(en)/en/layout.tsx`:

```tsx
import type { Metadata } from "next";
import RootDocument from "@/components/layout/RootDocument";

export const metadata: Metadata = {
  metadataBase: new URL("https://rlearning-gamma.vercel.app"),
  title: { default: "RLearning", template: "%s | RLearning" },
  description: "Ryan's notes on computer systems, machine learning, LLMs, and AI infrastructure, learned in public.",
  alternates: { languages: { "zh-CN": "/", en: "/en/" } },
};

export default function EnLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument lang="en">{children}</RootDocument>;
}
```

- [ ] **Step 4: Move files with git**

```bash
mkdir -p "app/(zh)" "app/(en)/en"
git mv app/page.tsx "app/(zh)/page.tsx"
git mv app/notes "app/(zh)/notes"
git rm app/layout.tsx
```

`app/globals.css` stays where it is (imported by `RootDocument`).

- [ ] **Step 5: Build and check the 404 page**

Run: `npm run build`
Expected: success, `out/index.html` has `<html lang="zh-CN"`, `out/404.html` exists. If the build fails because there is no root layout for the not-found page, add `app/global-not-found.tsx` per `03-file-conventions/not-found.md` (import `@/app/globals.css`, render `<html lang="zh-CN"><body>…</body></html>` with a link home) and set `experimental: { globalNotFound: true }` in `next.config.mjs`; rebuild.

- [ ] **Step 6: Commit**

```bash
git add -A app components/layout/RootDocument.tsx next.config.mjs
git commit -m "Split into zh and en root layouts sharing RootDocument"
```

---

### Task 4: Shared homepage view and `/en/`

**Files:** Create `components/home/HomePageView.tsx`, `app/(en)/en/page.tsx`; Modify `app/(zh)/page.tsx`

- [ ] **Step 1: Create `components/home/HomePageView.tsx`** by moving the body of `app/(zh)/page.tsx` (after the cover plan's Task 6) into `export default function HomePageView({ lang }: { lang: Lang })`, with these replacements:
  - the `recentRow` helper becomes a closure inside the component and uses `notePath(note, lang)` for `href`, `noteText(note, lang).title/description`, and appends `<span className="lang-tag">{t(lang, "chineseOnly")}</span>` after the title when `lang === "en" && !note.en`;
  - `<h1>{t(lang, "heroTitle")}<span className="brand-dot">{t(lang, "heroTitleEnd")}</span></h1>`;
  - `<p>{profile.intro[lang]}</p>`; `<MachineHero lang={lang} />`; `<LearningActivity lang={lang} />`;
  - roadmap heading `{t(lang, "roadmapTitle")}` keeping `<span>Roadmap</span>` only for `zh`; hint `t(lang, "roadmapHint")`;
  - recent heading `{t(lang, "recentTitle")}` keeping `<span>Recently added</span>` only for `zh`; counts via `t(lang, "noteCount", { n })` and `t(lang, "showAll", { n })`.

- [ ] **Step 2: Thin pages**

`app/(zh)/page.tsx`:

```tsx
import HomePageView from "@/components/home/HomePageView";

export default function HomePage() {
  return <HomePageView lang="zh" />;
}
```

`app/(en)/en/page.tsx`:

```tsx
import HomePageView from "@/components/home/HomePageView";

export default function EnglishHomePage() {
  return <HomePageView lang="en" />;
}
```

- [ ] **Step 3: `.lang-tag` style** in `app/globals.css` (near `.note-status`):

```css
.lang-tag { display: inline-block; margin-left: 6px; padding: 0 5px; border: 1px solid #e3e3e3; border-radius: 4px; font-size: 10px; font-weight: 400; color: #8a8a8a; vertical-align: 1px; }
```

- [ ] **Step 4: Shell skips activity on both homes** — in `NotebookShell.tsx`, the cover plan's `pathname === ""` check becomes `stripLang(pathname) === ""` (import from `@/lib/i18n`).

- [ ] **Step 5: Typecheck, build, commit**

```bash
npm run typecheck && npm run build
git add -A components/home app
git commit -m "Shared HomePageView; add /en/ homepage"
```

Expected: `out/en/index.html` exists with `<html lang="en"`.

---

### Task 5: Shared note view and English note route

**Files:** Create `content/noteComponents.ts`, `components/layout/NotePageView.tsx`, `app/(en)/en/notes/[...slug]/page.tsx`; Modify `app/(zh)/notes/[...slug]/page.tsx`, `lib/content.ts`

- [ ] **Step 1: Move the MDX import map** — cut all `import X from "@/content/....mdx"` lines and the `const noteComponents = {…}` object from the note page into `content/noteComponents.ts`, export it, and add the English map at the bottom:

```ts
import GrpoEn from "@/content/ml/post-training/grpo.en.mdx";
import RewardHackingEn from "@/content/ml/post-training/reward-hacking.en.mdx";
import Grpo3060ProjectEn from "@/content/ml/post-training/grpo-3060-project.en.mdx";

/** English pages; keys must match the notes that carry an `en` entry in content/notes.ts. */
export const noteComponentsEn = {
  "ml/post-training/grpo": GrpoEn,
  "ml/post-training/reward-hacking": RewardHackingEn,
  "ml/post-training/grpo-3060-project": Grpo3060ProjectEn,
};
```

Until Tasks 8–10 create the `.en.mdx` files, create each as a one-line placeholder so the build resolves (`# GRPO` etc.); Tasks 8–10 replace them. Do not add `en` to `notes.ts` until the real translation lands.

- [ ] **Step 2: TOC per language** — in `lib/content.ts` change the signature to `getNoteToc(slug: string, lang: Lang = "zh")` and the file name to `` `${slug}${lang === "en" ? ".en" : ""}.mdx` ``.

- [ ] **Step 3: Create `components/layout/NotePageView.tsx`** from the current `NotePage` body:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNote, getSeriesNeighbors } from "@/content/notes";
import { noteComponents, noteComponentsEn } from "@/content/noteComponents";
import { getNoteToc } from "@/lib/content";
import { homePath, notePath, noteText, t, type Lang } from "@/lib/i18n";
import TableOfContents from "@/components/layout/TableOfContents";
import SplitReader from "@/components/layout/SplitReader";
import Icon from "@/components/ui/Icon";

export default function NotePageView({ slug, lang }: { slug: string; lang: Lang }) {
  const note = getNote(slug);
  const map: Record<string, React.ComponentType<{ components?: object }>> = lang === "en" ? noteComponentsEn : noteComponents;
  const Content = map[slug];
  if (!note || !Content || (lang === "en" && !note.en)) notFound();
  const text = noteText(note, lang);
  const updated = lang === "en" ? note.en!.updated : note.updated;
  const behind = lang === "en" && note.updated > note.en!.updated;
  const toc = getNoteToc(slug, lang);
  const { prev, next } = getSeriesNeighbors(slug);
  const label = (n: typeof prev) => (n ? noteText(n, lang).title : "");

  return (
    <div className="note-layout">
      <div className="note-main">
        <header className="article-header">
          <div className="note-breadcrumb"><span>{note.category}</span><Icon name="chevron" /><span>{note.section}</span></div>
          <h1>{text.title}</h1>
          <p className="article-description">{text.description}</p>
          <div className="article-meta">
            <span className={`note-status status-${note.status}`}><span />{note.status === "growing" ? "Growing" : note.status === "stable" ? "Stable" : "Seed"}</span>
            <span><Icon name="calendar" /><time dateTime={updated}>{updated.replaceAll("-", ".")}</time></span>
            <span><Icon name="clock" />{t(lang, "readingMinutes", { n: note.readingMinutes })}</span>
            {note.en && (
              <span className="lang-switch" aria-label="Language">
                {lang === "zh" ? <b>中文</b> : <Link href={notePath(note, "zh")} hrefLang="zh-CN">中文</Link>}
                <span aria-hidden="true">|</span>
                {lang === "en" ? <b>English</b> : <Link href={notePath(note, "en")} hrefLang="en">English</Link>}
              </span>
            )}
          </div>
          {behind && <p className="translation-behind">{t(lang, "translationBehind")}</p>}
        </header>
        <article className={note.layout === "case-study" ? "prose prose-case" : "prose"}><Content components={{ h1: () => null }} /></article>
        {note.series && (prev || next) && (
          <nav className="series-nav" aria-label={t(lang, "seriesLabel", { title: note.series.title })}>
            {prev ? <Link className="series-link" href={notePath(prev, lang)}><small>{t(lang, "prevInSeries", { title: note.series.title })}</small><span>{label(prev)}</span></Link> : <span />}
            {next ? <Link className="series-link is-next" href={notePath(next, lang)}><small>{t(lang, "nextInSeries")}</small><span>{label(next)}</span></Link> : <span />}
          </nav>
        )}
        <div className="note-tags"><span>FILED UNDER</span>{note.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        <div className="article-end"><div><Icon name="leaf" /><span>{t(lang, "stillGrowing")}</span></div><Link href={homePath(lang)}>{t(lang, "backToLibrary")} <Icon name="arrow" /></Link></div>
      </div>
      <TableOfContents items={toc} />
      {/* Keyed by note so moving to another note (e.g. from the sidebar) closes the split. */}
      <SplitReader key={`${lang}:${slug}`} />
    </div>
  );
}
```

Copy the JSX from the current page rather than this listing wherever they differ (the listing shows the intended replacements; the current page is the source of truth for markup and class names).

- [ ] **Step 4: Thin note pages**

`app/(zh)/notes/[...slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import NotePageView from "@/components/layout/NotePageView";
import { getNote, noteEntries } from "@/content/notes";

export const dynamicParams = false;

export function generateStaticParams() {
  return noteEntries.map((note) => ({ slug: note.slug.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const note = getNote(slug.join("/"));
  return {
    title: note?.title ?? "Note",
    description: note?.description,
    alternates: note?.en ? { languages: { "zh-CN": `/notes/${note.slug}/`, en: `/en/notes/${note.slug}/` } } : undefined,
  };
}

export default async function NotePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <NotePageView slug={slug.join("/")} lang="zh" />;
}
```

`app/(en)/en/notes/[...slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import NotePageView from "@/components/layout/NotePageView";
import { getNote, noteEntries } from "@/content/notes";

export const dynamicParams = false;

export function generateStaticParams() {
  return noteEntries.filter((note) => note.en).map((note) => ({ slug: note.slug.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const note = getNote(slug.join("/"));
  return {
    title: note?.en?.title ?? "Note",
    description: note?.en?.description,
    alternates: note ? { languages: { "zh-CN": `/notes/${note.slug}/`, en: `/en/notes/${note.slug}/` } } : undefined,
  };
}

export default async function EnglishNotePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <NotePageView slug={slug.join("/")} lang="en" />;
}
```

If `generateStaticParams` returning `[]` breaks the export before translations exist, keep the route but temporarily add `en` to `ml/post-training/grpo` with its placeholder file; remove it again before Task 8 if Task 8 is not next.

- [ ] **Step 5: Styles** in `app/globals.css` near `.article-meta`:

```css
.lang-switch { display: inline-flex; gap: 6px; align-items: center; }
.lang-switch b { font-weight: 600; color: var(--accent); }
.lang-switch a { color: inherit; }
.translation-behind { margin-top: 10px; font-size: 12px; color: #8a6d1f; background: #fff8e6; border: 1px solid #f3e2b3; border-radius: 6px; padding: 6px 10px; }
```

- [ ] **Step 6: Typecheck, test, build, commit**

```bash
npm run typecheck && npm test && npm run build
git add -A
git commit -m "Shared NotePageView; English note route and language switch"
```

---

### Task 6: Localize the shell, sidebar, activity, roadmap, split reader, avatar

**Files:** Modify `components/layout/NotebookShell.tsx`, `SidebarNav.tsx`, `LearningActivity.tsx`, `SplitReader.tsx`, `Avatar.tsx`, `components/home/RoadmapGraph.tsx`, `RoadmapDrawer.tsx`, `content/navigation.ts`, `content/roadmap.ts`, `components/home/machine/MachineHero.tsx`

Rule for every file: each Chinese literal becomes `t(lang, key)` with the key from Task 1; client components get `lang` from `useLang()`; `LearningActivity` (server) takes a `lang` prop. Every internal note link becomes `notePath(note, lang)`; every home link becomes `homePath(lang)`.

- [ ] **Step 1: `NotebookShell.tsx`**
  - `const lang = useLang();` `const path = stripLang(pathname);` and use `path` where the code compares against `/notes/...` (`currentNote` lookup).
  - Brand link and breadcrumb home → `homePath(lang)`; skip link, overlay, drawer `aria-label`s → dict keys.
  - Topbar language entry, before the GitHub icon:

```tsx
{(() => {
  const target = path === "" ? homePath(otherLang(lang)) : currentNote?.en ? notePath(currentNote, otherLang(lang)) : null;
  return target && <a className="lang-link" href={target} hrefLang={otherLang(lang) === "en" ? "en" : "zh-CN"}>{t(lang, "switchToOther")}</a>;
})()}
```

  It is a plain `<a>` on purpose: the target uses the other root layout, which always reloads the page.
  - CSS in `app/globals.css`: `.lang-link { font-size: 12px; color: #6b6b6b; text-decoration: none; padding: 4px 8px; border: 1px solid #e8e8e8; border-radius: 999px; } .lang-link:hover { color: var(--accent); border-color: var(--accent); }`

- [ ] **Step 2: `SidebarNav.tsx`**
  - `const lang = useLang();`. Move `searchIndex` and `openFor` into functions of `lang` (memoize `searchIndex` with `useMemo` on `lang`); `href: notePath(note, lang)`; `haystack` includes `noteText(note, lang).title` and the Chinese title, so Chinese queries still work on the English site.
  - `openFor` compares `stripLang(pathname)` with `/notes/${slug}`.
  - Placeholder, aria labels, "没有匹配…", "知识库首页" → dict. Home link `href={homePath(lang)}`, active when `stripLang(pathname) === ""`.
  - Note rows show `noteText(note, lang).title` and, when `lang === "en" && !note.en`, `<span className="lang-tag">{t(lang, "chineseOnly")}</span>`.
  - `content/navigation.ts`: `children` items carry `{ title, href, note }` so the sidebar can call `notePath`; `description` and `topics` become `Localized`:

```ts
{ id: "cs", title: "CS Foundations", description: { zh: "回到基础，理解计算机如何工作。", en: "Back to basics: how a computer works." }, icon: "code", topics: { zh: "CS Fundamentals · Computer Networks · Operating Systems", en: "CS Fundamentals · Computer Networks · Operating Systems" } },
{ id: "systems", title: "Systems", description: { zh: "从单个组件到协作运行的系统。", en: "From single components to systems that work together." }, icon: "layers", topics: { zh: "Distributed Systems · Data Infrastructure · System Design · Backend Systems", en: "Distributed Systems · Data Infrastructure · System Design · Backend Systems" } },
{ id: "ml", title: "ML & LLM", description: { zh: "理解模型，也理解学习本身。", en: "Understand the models, and learning itself." }, icon: "brain", topics: { zh: "Evaluation · Classifiers · Trees · LLMs · Multimodal · RecSys · RL", en: "Evaluation · Classifiers · Trees · LLMs · Multimodal · RecSys · RL" } },
{ id: "ai-infra", title: "AI Infrastructure", description: { zh: "让模型高效运行的工程细节。", en: "The engineering that makes models run fast." }, icon: "cpu", topics: { zh: "Agent Harness · GPU · Inference", en: "Agent Harness · GPU · Inference" } },
{ id: "algorithms", title: "Algorithms", description: { zh: "学 pattern，而不只是题解。", en: "Learn the pattern, not just the solution." }, icon: "search", topics: { zh: "Binary Search · Two Pointers · Sliding Window · Stack · Heap · Trees · Graphs · DP", en: "Binary Search · Two Pointers · Sliding Window · Stack · Heap · Trees · Graphs · DP" } },
```

  Then fix every reader of `category.description` / `category.topics` (`grep -rn "\.description\|\.topics" components content`) to index with `[lang]`.

- [ ] **Step 3: `LearningActivity.tsx`** — signature `LearningActivity({ lang = "zh" }: { lang?: Lang })`; every string → dict (`activityTitle`, `activityBody`, `activityPeriod`, `activityAria`, `activityFuture`, `activityDay`, `activityLess`, `activityMore`, `statNotes`, `statDays`, `statUpdates`). The day tooltip's title list joins with `"、"` for zh and `", "` for en.

- [ ] **Step 4: `SplitReader.tsx`** — `const lang = useLang();`; the click interceptor accepts paths that start with `/notes/` or `/en/notes/`; `titleFor` compares `stripLang(normalize(path))` and returns `noteText(note, lang).title`; all aria labels/titles → dict (`splitPaneLabel`, `splitResize`, `splitResizeTitle`, `splitOpenFull`, `splitClose`, `splitCloseTitle`).

- [ ] **Step 5: `Avatar.tsx`** — `alt={t(useLang(), "avatarAlt", { name: profile.name })}` (call `useLang()` once at the top).

- [ ] **Step 6: Roadmap** — `RoadmapGraph.tsx` and `RoadmapDrawer.tsx`: `const lang = useLang();`; strings → `roadmapNotes`, `roadmapLegend`, `roadmapProgress`, `roadmapAria`, `roadmapLayer`, `roadmapDrawerNotes`, `roadmapBefore`, `roadmapAfter`, `close`; drawer note links → `notePath(note, lang)` and titles → `noteText(note, lang).title` with the `lang-tag` for untranslated notes in English. In `content/roadmap.ts` the one Chinese label (`"ML 知识树"`, node `ml-tree`) becomes `"ML Knowledge Tree"` for both languages if `label` is a plain string, or `Localized` if other labels are already bilingual — check the type first and keep it a string unless needed.

- [ ] **Step 7: `MachineHero.tsx`** — note links use `notePath(getNote(slug)!, lang)` and titles `noteText(getNote(slug)!, lang).title`; part labels likewise via `notePath`.

- [ ] **Step 8: Verify nothing Chinese leaks into English chrome**

Run: `npm run build`, then

```bash
python -I -c "import re,sys;s=open('out/en/index.html',encoding='utf-8').read();s=re.sub(r'<script.*?</script>','',s,flags=re.S);print(sorted(set(re.findall(r'[一-鿿]+',s)))[:40])"
```

Expected: only the `中文` tags and Chinese-only note titles shown in the sidebar/recent list (those notes have no translation). Anything else is a missed string: add a key and fix.

- [ ] **Step 9: Test, commit**

```bash
npm test && npm run typecheck && npm run lint
git add -A
git commit -m "Localize the site chrome, sidebar, activity, roadmap and split reader"
```

---

### Task 7: Localize the seven figures

**Files:** Modify `components/visualization/ml/post-training/{GrpoFigure,PolicyGradientStepFigure,RewardHackingFigure}.tsx`, `components/visualization/ml/post-training/grpo3060/{G3ResultsFigure,G3TrainingCurves,G3CheckpointSweep,G3SampleCompare}.tsx`, `lib/ml/grpo3060.ts`, `lib/ml/grpo.ts`, `lib/ml/policyGradient.ts`

Pattern, per figure:

```tsx
import { useLang } from "@/components/i18n/LangProvider";

const COPY = {
  zh: { title: "…", description: "…", /* every visible string, verbatim from today's JSX */ },
  en: { title: "…", description: "…" },
} satisfies Record<Lang, Record<string, string>>;

export default function GrpoFigure() {
  const copy = COPY[useLang()];
  // replace each literal with copy.key; strings with numbers become small functions:
  // groupLabel: (g: number) => `G = ${g}`
}
```

For the `lib/ml/*` modules, labels that the figures display (`MODEL_LABEL`, `RUN_LABEL`, `GRPO_PROMPTS[].text`, `PG_ANSWERS`, preset names, etc.) become `Localized` values, and the figures index them with `[lang]`. Keep numeric data untouched. Update the existing tests in `tests/grpo3060.test.ts`, `tests/grpo.test.ts`, `tests/policy-gradient.test.ts` only where they read a label string (index `.zh`).

- [ ] **Step 1:** `GrpoFigure` + `lib/ml/grpo.ts` → run `npx tsx --test tests/grpo.test.ts` → commit `"Localize GrpoFigure"`.
- [ ] **Step 2:** `PolicyGradientStepFigure` + `lib/ml/policyGradient.ts` → `npx tsx --test tests/policy-gradient.test.ts` → commit.
- [ ] **Step 3:** `RewardHackingFigure` → `npx tsx --test tests/reward-hacking.test.ts` → commit.
- [ ] **Step 4:** the four `G3*` figures + `lib/ml/grpo3060.ts` → `npx tsx --test tests/grpo3060.test.ts` → commit.
- [ ] **Step 5:** Check the Chinese pages are unchanged: `npm run build`, then for each of the three notes compare the visible text of `out/notes/<slug>/index.html` before and after (`git stash`-free: build once on the commit before Step 1 into `out-before/` with `cp -r out out-before`, then diff the extracted text). Expected: no differences.

---

### Tasks 8–10: Translate the three notes

One task per note, in this order: `grpo`, `reward-hacking`, `grpo-3060-project` (the project note links to the other two).

**Files per note:** Create `content/ml/post-training/<name>.en.mdx` (replacing the Task 5 placeholder); Modify `content/notes.ts` (add `en`).

Translation rules (from the spec):
- Read as if written in English; restructure sentences freely, keep every claim, number, formula, code block, variable name, table row and figure in place and in order.
- Same imports and the same figure components as the Chinese file; no extra props.
- Headings translated; the TOC is generated from them.
- Links to `ml/post-training/grpo`, `ml/post-training/reward-hacking`, `ml/post-training/grpo-3060-project` become `/en/notes/.../`; every other internal link stays `/notes/.../`.
- Chinese examples (the bad-orange word problem, sample outputs) keep the original problem and translate the surrounding explanation; model outputs quoted from logs stay verbatim.

- [ ] **Step 1:** Write `<name>.en.mdx`.
- [ ] **Step 2:** Add to the note's entry in `content/notes.ts`:

```ts
en: { title: "<English title>", description: "<one-sentence English description in the style of the Chinese one>", updated: "2026-10-30" },
```

- [ ] **Step 3:** `npm run build`; open `/en/notes/ml/post-training/<name>/` in the preview; check headings, figures in English, links.
- [ ] **Step 4:** Commit `"Translate <name> into English"`.

---

### Task 11: English registry test

**Files:** Modify `tests/i18n.test.ts`

- [ ] **Step 1: Add the test**

```ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

test("every translated note has an English MDX file registered in noteComponentsEn", () => {
  const source = readFileSync(path.join(process.cwd(), "content", "noteComponents.ts"), "utf8");
  const registry = source.slice(source.indexOf("export const noteComponentsEn"));
  const registered = [...registry.matchAll(/"([^"]+)":/g)].map((m) => m[1]).sort();
  const translated = noteEntries.filter((note) => note.en).map((note) => note.slug).sort();
  assert.deepEqual(registered, translated);
  for (const slug of translated) assert.ok(existsSync(path.join(process.cwd(), "content", `${slug}.en.mdx`)), slug);
});

test("first batch is exactly the GRPO line", () => {
  assert.deepEqual(
    noteEntries.filter((note) => note.en).map((note) => note.slug).sort(),
    ["ml/post-training/grpo", "ml/post-training/grpo-3060-project", "ml/post-training/reward-hacking"],
  );
});
```

- [ ] **Step 2:** `npx tsx --test tests/i18n.test.ts` → 6 pass. Commit.

---

### Task 12: Full verification

- [ ] **Step 1:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` — all pass.
- [ ] **Step 2:** Built output: `out/en/index.html` and `out/en/notes/ml/post-training/{grpo,reward-hacking,grpo-3060-project}/index.html` exist with `<html lang="en"`; `out/index.html` and every `out/notes/**/index.html` keep `lang="zh-CN"`; `out/404.html` exists.
- [ ] **Step 3:** Preview (`preview_start`): `/en/` (hero, 3D labels in English, recent list with `中文` tags), the three English notes (switch, TOC, figures without leftover Chinese, links), switching back and forth from the topbar and the article switch, a Chinese-only note opened from the English sidebar, mobile width without horizontal scroll, no console errors.
- [ ] **Step 4:** Screenshot `/en/` and one English note as proof.

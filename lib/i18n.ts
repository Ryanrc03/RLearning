export type Lang = "zh" | "en";

/** A reader-facing string in both site languages. */
export type Localized = Record<Lang, string>;

export const otherLang = (lang: Lang): Lang => (lang === "zh" ? "en" : "zh");
export const homePath = (lang: Lang) => (lang === "en" ? "/en/" : "/");

/** The BCP 47 tag for `lang`, `hreflang` and `<html lang>`. */
export const htmlLang = (lang: Lang): "en" | "zh-CN" => (lang === "en" ? "en" : "zh-CN");

/** "/en/notes/x" → "/notes/x"; "/en" → "" (the shell strips trailing slashes before calling). */
export const stripLang = (pathname: string) => pathname.replace(/^\/en(?=\/|$)/, "");

/** The English title, description and last-updated date of a translated note, plus its series title when it is in one. */
export type NoteTranslation = { title: string; description: string; updated: string; seriesTitle?: string };

type Translatable = { slug: string; en?: NoteTranslation };

/** English readers get the English page when one exists, otherwise the Chinese original. */
export const notePath = (note: Translatable, lang: Lang) =>
  lang === "en" && note.en ? `/en/notes/${note.slug}/` : `/notes/${note.slug}/`;

/**
 * A note's title and description in the page language. `textLang` is "zh-CN" when an English page
 * falls back to the Chinese original, for the `lang` attribute of the elements that show them.
 */
export function noteText(note: Translatable & { title: string; description: string }, lang: Lang) {
  const en = lang === "en" ? note.en : undefined;
  const textLang = lang === "en" && !en ? ("zh-CN" as const) : undefined;
  return en
    ? { title: en.title, description: en.description, translated: true, textLang }
    : { title: note.title, description: note.description, translated: false, textLang };
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
  chineseOnlyTitle: "仅中文",
  languageLabel: "语言",
  switchToOther: "English",
  englishSiteTitle: "英文版首页（这篇笔记只有中文）",
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
  activityDayTitles: "{date} · {n} 篇笔记更新：{titles}",
  listSeparator: "、",
  activityLess: "少",
  activityMore: "多",
  statNotes: "篇公开笔记",
  statDays: "个活跃日",
  statUpdates: "次笔记更新",
  avatarAlt: "{name} 的头像",
  close: "关闭",
  splitPaneLabel: "并排阅读：{title}",
  splitResize: "拖动调整左右比例",
  splitResizeTitle: "拖动调整比例，双击恢复一半",
  splitOpenFull: "整页打开",
  splitClose: "关闭并排阅读",
  splitCloseTitle: "关闭 (Esc)",
  roadmapNotes: "{n} 篇",
  roadmapLegend: "颜色图例",
  roadmapProgress: "进度条 = stable / growing / seed 的比例",
  roadmapAria: "知识路线图：箭头表示先读哪个",
  roadmapLayer: "第 {n} 层",
  roadmapDrawerNotes: "{n} 篇笔记",
  roadmapBefore: "先修",
  roadmapAfter: "接下来",
  // The sidebar's headings are English on both sites ("MY LIBRARY", "RESULTS"), so is their count.
  libraryCount: "{n} note{s}",
};

export const dict: Record<Lang, typeof zh> = {
  zh,
  en: {
    skipToContent: "Skip to content",
    openSidebar: "Open sidebar",
    closeSidebar: "Close sidebar",
    sidebarLabel: "Library contents",
    mainNav: "Main navigation",
    searchPlaceholder: "Search notes",
    noResults: "No notes match “{q}”",
    homeLink: "Library home",
    overview: "Overview",
    publicLabel: "Personal knowledge garden",
    chineseOnly: "中文",
    chineseOnlyTitle: "Chinese only",
    languageLabel: "Language",
    switchToOther: "中文",
    englishSiteTitle: "English home (this note is in Chinese only)",
    readingMinutes: "{n} min read",
    seriesLabel: "Series: {title}",
    prevInSeries: "← Previous · {title}",
    nextInSeries: "Next →",
    stillGrowing: "This note is still growing.",
    backToLibrary: "Back to the library",
    translationBehind: "The Chinese original has been updated since this translation.",
    heroTitle: "Stay curious, grow slowly",
    heroTitleEnd: ".",
    roadmapTitle: "Roadmap",
    roadmapHint: "Arrows point to what comes next · select a node to see its notes",
    recentTitle: "Recently added",
    noteCount: "{n} note{s}",
    showAll: "Show all {n}",
    activityTitle: "Every bit of progress counts.",
    activityBody: "Tracks when notes are created or updated, slowly connecting the dots.",
    activityPeriod: "Last 26 weeks",
    activityAria: "Note updates over the last 26 weeks: {updates} updates on {days} active days. One square per day; darker means more notes updated that day.",
    activityFuture: "{date} · in the future",
    activityDay: "{date} · {n} note{s} updated",
    activityDayTitles: "{date} · {n} note{s} updated: {titles}",
    listSeparator: ", ",
    activityLess: "Less",
    activityMore: "More",
    statNotes: "public notes",
    statDays: "active days",
    statUpdates: "note updates",
    avatarAlt: "{name}'s avatar",
    close: "Close",
    splitPaneLabel: "Side-by-side reading: {title}",
    splitResize: "Drag to resize the panes",
    splitResizeTitle: "Drag to resize, double-click to split evenly",
    splitOpenFull: "Open full page",
    splitClose: "Close side-by-side reading",
    splitCloseTitle: "Close (Esc)",
    roadmapNotes: "{n} note{s}",
    roadmapLegend: "Color legend",
    roadmapProgress: "Bar = share of stable / growing / seed notes",
    roadmapAria: "Knowledge roadmap: arrows show which to read first",
    roadmapLayer: "Layer {n}",
    roadmapDrawerNotes: "{n} note{s}",
    roadmapBefore: "Prerequisites",
    roadmapAfter: "Next",
    libraryCount: "{n} note{s}",
  },
};

export type DictKey = keyof typeof zh;

/**
 * Look up a UI string and fill {placeholders}. `{s}` is reserved for English plurals:
 * it becomes "" when `vars.n` is 1 and "s" otherwise.
 */
export function t(lang: Lang, key: DictKey, vars: Record<string, string | number> = {}): string {
  return dict[lang][key].replace(/\{(\w+)\}/g, (_, name: string) =>
    name === "s" ? (Number(vars.n) === 1 ? "" : "s") : String(vars[name] ?? `{${name}}`),
  );
}

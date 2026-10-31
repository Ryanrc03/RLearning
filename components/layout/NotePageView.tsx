import type { ComponentType } from "react";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNote, getSeriesNeighbors } from "@/content/notes";
import { noteComponents, noteComponentsEn } from "@/content/noteComponents";
import { getNoteToc } from "@/lib/content";
import { homePath, notePath, noteText, t, type Lang } from "@/lib/i18n";
import TableOfContents from "@/components/layout/TableOfContents";
import SplitReader from "@/components/layout/SplitReader";
import Icon from "@/components/ui/Icon";

type NotePages = Partial<Record<string, ComponentType<{ components?: MDXComponents }>>>;

/** One note page, shared by `/notes/<slug>/` and its English twin `/en/notes/<slug>/`. */
export default function NotePageView({ slug, lang }: { slug: string; lang: Lang }) {
  const pages: NotePages = lang === "en" ? noteComponentsEn : noteComponents;
  const note = getNote(slug);
  const Content = pages[slug];
  if (!note || !Content || (lang === "en" && !note.en)) notFound();
  const { title, description } = noteText(note, lang);
  const updated = lang === "en" && note.en ? note.en.updated : note.updated;
  const toc = getNoteToc(slug, lang);
  const { prev, next } = getSeriesNeighbors(slug);

  return (
    <div className="note-layout">
      <div className="note-main">
        <header className="article-header">
          <div className="note-breadcrumb"><span>{note.category}</span><Icon name="chevron" /><span>{note.section}</span></div>
          <h1>{title}</h1>
          <p className="article-description">{description}</p>
          <div className="article-meta">
            <span className={`note-status status-${note.status}`}><span />{note.status === "growing" ? "Growing" : note.status === "stable" ? "Stable" : "Seed"}</span>
            <span><Icon name="calendar" /><time dateTime={updated}>{updated.replaceAll("-", ".")}</time></span>
            <span><Icon name="clock" />{t(lang, "readingMinutes", { n: note.readingMinutes })}</span>
            {note.en && (
              // Plain links: the two languages have separate root layouts, so switching is a full page load anyway.
              <span className="lang-switch" aria-label="Language">
                {lang === "zh" ? <b>中文</b> : <a href={notePath(note, "zh")} hrefLang="zh-CN">中文</a>}
                <span aria-hidden="true">|</span>
                {lang === "en" ? <b>English</b> : <a href={notePath(note, "en")} hrefLang="en">English</a>}
              </span>
            )}
          </div>
          {lang === "en" && note.en && note.updated > note.en.updated && <p className="translation-behind">{t(lang, "translationBehind")}</p>}
        </header>
        <article className={note.layout === "case-study" ? "prose prose-case" : "prose"}><Content components={{ h1: () => null }} /></article>
        {note.series && (prev || next) && (
          <nav className="series-nav" aria-label={t(lang, "seriesLabel", { title: note.series.title })}>
            {prev ? <Link className="series-link" href={notePath(prev, lang)}><small>{t(lang, "prevInSeries", { title: note.series.title })}</small><span>{noteText(prev, lang).title}</span></Link> : <span />}
            {next ? <Link className="series-link is-next" href={notePath(next, lang)}><small>{t(lang, "nextInSeries")}</small><span>{noteText(next, lang).title}</span></Link> : <span />}
          </nav>
        )}
        <div className="note-tags"><span>FILED UNDER</span>{note.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        <div className="article-end"><div><Icon name="leaf" /><span>{t(lang, "stillGrowing")}</span></div><Link href={homePath(lang)}>{t(lang, "backToLibrary")} <Icon name="arrow" /></Link></div>
      </div>
      <TableOfContents items={toc} />
      {/* Keyed by page so moving to another note (e.g. from the sidebar) or language closes the split. */}
      <SplitReader key={`${lang}:${slug}`} />
    </div>
  );
}

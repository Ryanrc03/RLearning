import type { Metadata } from "next";
import Link from "next/link";
import { noteEntries, type NoteEntry } from "@/content/notes";
import Icon from "@/components/ui/Icon";
import RoadmapGraph from "@/components/home/RoadmapGraph";
import Avatar from "@/components/layout/Avatar";
import LearningActivity from "@/components/layout/LearningActivity";
import MachineHero from "@/components/home/machine/MachineHero";
import { profile } from "@/content/profile";

// Language alternates sit on the home page, not the layout, so note pages don't inherit them.
export const metadata: Metadata = {
  alternates: { languages: { "zh-CN": "/", en: "/en/" } },
};

const RECENT = 6;

const recentRow = (note: NoteEntry) => <Link className="recent-note" key={note.slug} href={`/notes/${note.slug}/`}>
          <span className="note-card-icon"><Icon name={note.categoryId === "ml" ? "brain" : note.categoryId === "algorithms" ? "search" : "code"} /></span>
          <div className="recent-note-copy"><p className="note-category">{note.category} <span>/</span> {note.section}</p><h3>{note.title}</h3><p>{note.description}</p></div>
          <div className="recent-note-end"><span className={`note-status status-${note.status}`}><span />{note.status === "growing" ? "Growing" : note.status === "stable" ? "Stable" : "Seed"}</span><time dateTime={note.updated}>{note.updated.slice(5).replace("-", ".")}</time></div><Icon name="arrow" className="card-arrow" />
        </Link>;

export default function HomePage() {
  const recentNotes = [...noteEntries].sort((a, b) => b.updated.localeCompare(a.updated));
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="page-intro">
          <p className="eyebrow"><span /> THE KNOWLEDGE GARDEN</p>
          <h1>保持好奇，慢慢积累<span className="brand-dot">。</span></h1>
          <div className="intro-byline">
            <Avatar size="small" />
            <p>{profile.intro.zh}</p>
          </div>
          <p className="intro-links">
            {profile.githubUrl && <a href={profile.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
            {profile.homepageUrl && <a href={profile.homepageUrl} target="_blank" rel="noreferrer">Homepage</a>}
          </p>
        </div>
        <MachineHero lang="zh" />
      </section>
      <LearningActivity />
      <section className="roadmap-section" aria-labelledby="roadmap-title">
        <div className="section-heading"><h2 id="roadmap-title">知识路线图 <span>Roadmap</span></h2><span className="subtle-text">箭头指向下一步 · 点节点看笔记</span></div>
        <RoadmapGraph />
      </section>
      <section className="recent-section" aria-labelledby="recent-title">
        <div className="section-heading"><h2 id="recent-title">最近记录 <span>Recently added</span></h2><span className="subtle-text">{noteEntries.length} 篇笔记</span></div>
        <div className="recent-notes">{recentNotes.slice(0, RECENT).map(recentRow)}</div>
        {recentNotes.length > RECENT && (
          <details className="recent-more">
            <summary>查看全部 {recentNotes.length} 篇 <Icon name="chevron" /></summary>
            <div className="recent-notes">{recentNotes.slice(RECENT).map(recentRow)}</div>
          </details>
        )}
      </section>
    </div>
  );
}

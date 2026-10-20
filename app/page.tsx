import Link from "next/link";
import { noteEntries, type NoteEntry } from "@/content/notes";
import Icon from "@/components/ui/Icon";
import RoadmapGraph from "@/components/home/RoadmapGraph";

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
      <div className="page-intro"><p className="eyebrow"><span /> THE KNOWLEDGE GARDEN</p><h1>保持好奇，慢慢积累<span className="brand-dot">。</span></h1><p className="page-description">关于计算机系统、机器学习与 AI 基础设施的学习笔记。<br />把零散的理解，慢慢连成自己的知识地图。</p></div>
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

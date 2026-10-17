import Link from "next/link";
import { categories } from "@/content/navigation";
import { noteEntries } from "@/content/notes";
import Icon from "@/components/ui/Icon";

export default function HomePage() {
  const recentNotes = [...noteEntries].sort((a, b) => b.updated.localeCompare(a.updated));
  return (
    <div className="home-page">
      <div className="page-intro"><p className="eyebrow"><span /> THE KNOWLEDGE GARDEN</p><h1>保持好奇，慢慢积累<span className="brand-dot">。</span></h1><p className="page-description">关于计算机系统、机器学习与 AI 基础设施的学习笔记。<br />把零散的理解，慢慢连成自己的知识地图。</p></div>
      <section className="recent-section" aria-labelledby="recent-title">
        <div className="section-heading"><h2 id="recent-title">最近记录 <span>Recently added</span></h2><span className="subtle-text">{noteEntries.length} 篇笔记</span></div>
        <div className="recent-notes">{recentNotes.map((note) => <Link className="recent-note" key={note.slug} href={`/notes/${note.slug}/`}>
          <span className="note-card-icon"><Icon name={note.categoryId === "ml" ? "brain" : note.categoryId === "algorithms" ? "search" : "code"} /></span>
          <div className="recent-note-copy"><p className="note-category">{note.category} <span>/</span> {note.section}</p><h3>{note.title}</h3><p>{note.description}</p></div>
          <div className="recent-note-end"><span className={`note-status status-${note.status}`}><span />{note.status === "growing" ? "Growing" : note.status === "stable" ? "Stable" : "Seed"}</span><time dateTime={note.updated}>{note.updated.slice(5).replace("-", ".")}</time></div><Icon name="arrow" className="card-arrow" />
        </Link>)}</div>
      </section>
      <section aria-labelledby="topics-title" className="topics-section">
        <div className="section-heading"><h2 id="topics-title">探索主题 <span>Browse the library</span></h2></div>
        <div className="topic-grid">{categories.map((category) => {
          const notes = noteEntries.filter((note) => note.categoryId === category.id);
          const card = <><div className="topic-card-top"><span className={`topic-icon topic-icon-${category.id}`}><Icon name={category.icon} /></span><span>{notes.length ? `${notes.length} 篇笔记` : "待探索"}</span></div><h3>{category.title}</h3><p>{category.description}</p><div className="topic-card-bottom"><span>{category.topics}</span>{notes.length > 0 && <Icon name="arrow" />}</div></>;
          return notes.length ? <Link key={category.id} className="topic-card" href={`/notes/${notes[0].slug}/`}>{card}</Link> : <div key={category.id} className="topic-card is-empty">{card}</div>;
        })}</div>
      </section>
    </div>
  );
}

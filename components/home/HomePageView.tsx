import Link from "next/link";
import { noteEntries, type NoteEntry } from "@/content/notes";
import Icon from "@/components/ui/Icon";
import RoadmapGraph from "@/components/home/RoadmapGraph";
import Avatar from "@/components/layout/Avatar";
import LearningActivity from "@/components/layout/LearningActivity";
import MachineHero from "@/components/home/machine/MachineHero";
import NoteTitle from "@/components/i18n/NoteTitle";
import { profile } from "@/content/profile";
import { notePath, noteText, t, type Lang } from "@/lib/i18n";

const RECENT = 6;

/** The homepage body shared by `/` and `/en/`. */
export default function HomePageView({ lang }: { lang: Lang }) {
  // Ordered by the original's date: a translation date would interleave the two languages' histories.
  const recentNotes = [...noteEntries].sort((a, b) => b.updated.localeCompare(a.updated));

  const recentRow = (note: NoteEntry) => {
    // English readers get the Chinese original when there is no translation; mark its language.
    const { description, textLang } = noteText(note, lang);
    return (
      <Link className="recent-note" key={note.slug} href={notePath(note, lang)}>
        <span className="note-card-icon"><Icon name={note.categoryId === "ml" ? "brain" : note.categoryId === "algorithms" ? "search" : "code"} /></span>
        <div className="recent-note-copy"><p className="note-category">{note.category} <span>/</span> {note.section}</p><NoteTitle note={note} lang={lang} as="h3" /><p lang={textLang}>{description}</p></div>
        <div className="recent-note-end"><span className={`note-status status-${note.status}`}><span />{note.status === "growing" ? "Growing" : note.status === "stable" ? "Stable" : "Seed"}</span><time dateTime={note.updated}>{note.updated.slice(5).replace("-", ".")}</time></div><Icon name="arrow" className="card-arrow" />
      </Link>
    );
  };

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="page-intro">
          <p className="eyebrow"><span /> THE KNOWLEDGE GARDEN</p>
          <h1>{t(lang, "heroTitle")}<span className="brand-dot">{t(lang, "heroTitleEnd")}</span></h1>
          <div className="intro-byline">
            <Avatar size="small" />
            <p>{profile.intro[lang]}</p>
          </div>
          <p className="intro-links">
            {profile.githubUrl && <a href={profile.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
            {profile.homepageUrl && <a href={profile.homepageUrl} target="_blank" rel="noreferrer">Homepage</a>}
          </p>
        </div>
        <MachineHero lang={lang} />
      </section>
      <LearningActivity lang={lang} />
      <section className="roadmap-section" aria-labelledby="roadmap-title">
        {/* The Chinese headings keep their English gloss; the English page would only repeat itself. */}
        <div className="section-heading"><h2 id="roadmap-title">{t(lang, "roadmapTitle")}{lang === "zh" && <> <span>Roadmap</span></>}</h2><span className="subtle-text">{t(lang, "roadmapHint")}</span></div>
        <RoadmapGraph />
      </section>
      <section className="recent-section" aria-labelledby="recent-title">
        <div className="section-heading"><h2 id="recent-title">{t(lang, "recentTitle")}{lang === "zh" && <> <span>Recently added</span></>}</h2><span className="subtle-text">{t(lang, "noteCount", { n: noteEntries.length })}</span></div>
        <div className="recent-notes">{recentNotes.slice(0, RECENT).map(recentRow)}</div>
        {recentNotes.length > RECENT && (
          <details className="recent-more">
            <summary>{t(lang, "showAll", { n: recentNotes.length })} <Icon name="chevron" /></summary>
            <div className="recent-notes">{recentNotes.slice(RECENT).map(recentRow)}</div>
          </details>
        )}
      </section>
    </div>
  );
}

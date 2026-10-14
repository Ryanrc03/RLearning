import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import VirtualMemory from "@/content/cs/os/virtual-memory.mdx";
import UCB from "@/content/ml/reinforcement-learning/ucb.mdx";
import { getNote, noteEntries } from "@/content/notes";
import { getNoteToc } from "@/lib/content";
import TableOfContents from "@/components/layout/TableOfContents";
import Icon from "@/components/ui/Icon";

const noteComponents = { "cs/os/virtual-memory": VirtualMemory, "ml/reinforcement-learning/ucb": UCB };

export const dynamicParams = false;

export function generateStaticParams() {
  return noteEntries.map((note) => ({ slug: note.slug.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const note = getNote(slug.join("/"));
  return { title: note?.title ?? "Note", description: note?.description };
}

export default async function NotePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const key = slug.join("/");
  const note = getNote(key);
  const Content = noteComponents[key as keyof typeof noteComponents];
  if (!note || !Content) notFound();
  const toc = getNoteToc(key);

  return (
    <div className="note-layout">
      <div className="note-main">
        <header className="article-header">
          <div className="note-breadcrumb"><span>{note.category}</span><Icon name="chevron" /><span>{note.section}</span></div>
          <h1>{note.title}</h1>
          <p className="article-description">{note.description}</p>
          <div className="article-meta"><span className={`note-status status-${note.status}`}><span />{note.status === "growing" ? "Growing" : note.status === "stable" ? "Stable" : "Seed"}</span><span><Icon name="calendar" /><time dateTime={note.updated}>{note.updated.replaceAll("-", ".")}</time></span><span><Icon name="clock" />约 {note.readingMinutes} 分钟</span></div>
        </header>
        <article className="prose"><Content components={{ h1: () => null }} /></article>
        <div className="note-tags"><span>FILED UNDER</span>{note.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        <div className="article-end"><div><Icon name="leaf" /><span>这篇笔记还会继续生长。</span></div><Link href="/">回到知识库 <Icon name="arrow" /></Link></div>
      </div>
      <TableOfContents items={toc} />
    </div>
  );
}

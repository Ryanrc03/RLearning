import type { Metadata } from "next";
import { getNote, noteEntries } from "@/content/notes";
import { notePath } from "@/lib/i18n";
import NotePageView from "@/components/layout/NotePageView";

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
    // Only translated notes have a second language to point at.
    ...(note?.en && { alternates: { languages: { "zh-CN": notePath(note, "zh"), en: notePath(note, "en") } } }),
  };
}

export default async function NotePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <NotePageView slug={slug.join("/")} lang="zh" />;
}

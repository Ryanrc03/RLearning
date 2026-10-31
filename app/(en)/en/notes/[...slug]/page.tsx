import type { Metadata } from "next";
import { getNote, noteEntries } from "@/content/notes";
import { notePath } from "@/lib/i18n";
import NotePageView from "@/components/layout/NotePageView";

export const dynamicParams = false;

// Only translated notes get an English page; the rest link to the Chinese original.
export function generateStaticParams() {
  return noteEntries.filter((note) => note.en).map((note) => ({ slug: note.slug.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const note = getNote(slug.join("/"));
  if (!note?.en) return { title: "Note" };
  return {
    title: note.en.title,
    description: note.en.description,
    alternates: { languages: { "zh-CN": notePath(note, "zh"), en: notePath(note, "en") } },
  };
}

export default async function EnglishNotePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <NotePageView slug={slug.join("/")} lang="en" />;
}

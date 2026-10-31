import type { ReactNode } from "react";
import { noteText, type Lang, type NoteTranslation } from "@/lib/i18n";
import LangTag from "./LangTag";

type Props = {
  note: { slug: string; title: string; description: string; en?: NoteTranslation };
  lang: Lang;
  /** The element that holds the title; it carries `lang="zh-CN"` when an English page shows the Chinese title. */
  as?: "span" | "strong" | "h3";
  /** Renders the title text, e.g. with a search match highlighted. */
  children?: (title: string) => ReactNode;
};

/** A note's title in the page language; on English pages an untranslated note keeps its Chinese title and a 中文 tag. */
export default function NoteTitle({ note, lang, as: Tag = "span", children }: Props) {
  const { title, textLang } = noteText(note, lang);
  return <Tag lang={textLang}>{children ? children(title) : title}{textLang && <LangTag lang={lang} />}</Tag>;
}

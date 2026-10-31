"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { maturity, nextSteps, nodeLabel, notesForNode, prerequisites, roadmapNode, type RoadmapNode } from "@/content/roadmap";
import { categories } from "@/content/navigation";
import Icon from "@/components/ui/Icon";
import LangTag from "@/components/i18n/LangTag";
import { useLang } from "@/components/i18n/LangProvider";
import { notePath, noteText, t } from "@/lib/i18n";

type Props = {
  nodeId: string;
  /** Jump to another node (prerequisite / next step) without closing. */
  onSelect: (id: string) => void;
  onClose: () => void;
};

const statusLabel = { seed: "Seed", growing: "Growing", stable: "Stable" } as const;

export default function RoadmapDrawer({ nodeId, onSelect, onClose }: Props) {
  const lang = useLang();
  const node = roadmapNode(nodeId)!;
  const closeButton = useRef<HTMLButtonElement>(null);
  const notes = notesForNode(nodeId);
  const { stable, growing, seed, total } = maturity(nodeId);
  const category = categories.find((entry) => entry.id === node.categoryId);

  useEffect(() => {
    closeButton.current?.focus();
  }, [nodeId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const neighbours = (title: string, list: RoadmapNode[]) => list.length > 0 && (
    <div className="rm-drawer-links">
      <p>{title}</p>
      {list.map((other) => (
        <button key={other.id} type="button" className={`rm-chip rm-cat-${other.categoryId}`} onClick={() => onSelect(other.id)}>
          <span />{nodeLabel(other, lang)}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button type="button" className="rm-backdrop" aria-label={t(lang, "close")} tabIndex={-1} onClick={onClose} />
      <aside className={`rm-drawer rm-cat-${node.categoryId}`} role="dialog" aria-modal="true" aria-labelledby="rm-drawer-title">
        <header className="rm-drawer-head">
          <div>
            <p className="rm-drawer-category"><span />{category?.title}</p>
            <h2 id="rm-drawer-title">{node.section}</h2>
            <p className="rm-drawer-progress">{t(lang, "roadmapDrawerNotes", { n: total })} · {[stable && `${stable} stable`, growing && `${growing} growing`, seed && `${seed} seed`].filter(Boolean).join(" · ")}</p>
          </div>
          <button ref={closeButton} type="button" className="icon-button" aria-label={t(lang, "close")} onClick={onClose}><Icon name="close" /></button>
        </header>
        <ol className="rm-drawer-notes">
          {notes.map((note, index) => {
            const { title, description, translated } = noteText(note, lang);
            // English pages list an untranslated note under its Chinese title and description.
            const zhOnly = lang === "en" && !translated;
            const textLang = zhOnly ? "zh-CN" : undefined;
            return (
              <li key={note.slug}>
                <Link href={notePath(note, lang)}>
                  <span className="rm-drawer-index">{index + 1}</span>
                  <span className="rm-drawer-copy">
                    <strong lang={textLang}>{title}{zhOnly && <LangTag lang={lang} />}</strong>
                    <span lang={textLang}>{description}</span>
                  </span>
                  <span className={`note-status status-${note.status}`}><span />{statusLabel[note.status]}</span>
                </Link>
              </li>
            );
          })}
        </ol>
        {neighbours(t(lang, "roadmapBefore"), prerequisites(nodeId))}
        {neighbours(t(lang, "roadmapAfter"), nextSteps(nodeId))}
      </aside>
    </>
  );
}

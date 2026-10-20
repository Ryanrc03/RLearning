"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { maturity, nextSteps, notesForNode, prerequisites, roadmapNode, type RoadmapNode } from "@/content/roadmap";
import { categories } from "@/content/navigation";
import Icon from "@/components/ui/Icon";

type Props = {
  nodeId: string;
  /** Jump to another node (prerequisite / next step) without closing. */
  onSelect: (id: string) => void;
  onClose: () => void;
};

const statusLabel = { seed: "Seed", growing: "Growing", stable: "Stable" } as const;

export default function RoadmapDrawer({ nodeId, onSelect, onClose }: Props) {
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
          <span />{other.label ?? other.section}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button type="button" className="rm-backdrop" aria-label="关闭" tabIndex={-1} onClick={onClose} />
      <aside className={`rm-drawer rm-cat-${node.categoryId}`} role="dialog" aria-modal="true" aria-labelledby="rm-drawer-title">
        <header className="rm-drawer-head">
          <div>
            <p className="rm-drawer-category"><span />{category?.title}</p>
            <h2 id="rm-drawer-title">{node.section}</h2>
            <p className="rm-drawer-progress">{total} 篇笔记 · {[stable && `${stable} stable`, growing && `${growing} growing`, seed && `${seed} seed`].filter(Boolean).join(" · ")}</p>
          </div>
          <button ref={closeButton} type="button" className="icon-button" aria-label="关闭" onClick={onClose}><Icon name="close" /></button>
        </header>
        <ol className="rm-drawer-notes">
          {notes.map((note, index) => (
            <li key={note.slug}>
              <Link href={`/notes/${note.slug}/`}>
                <span className="rm-drawer-index">{index + 1}</span>
                <span className="rm-drawer-copy">
                  <strong>{note.title}</strong>
                  <span>{note.description}</span>
                </span>
                <span className={`note-status status-${note.status}`}><span />{statusLabel[note.status]}</span>
              </Link>
            </li>
          ))}
        </ol>
        {neighbours("先修", prerequisites(nodeId))}
        {neighbours("接下来", nextSteps(nodeId))}
      </aside>
    </>
  );
}

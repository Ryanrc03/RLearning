"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { navigation } from "@/content/navigation";
import { noteEntries } from "@/content/notes";
import Icon from "@/components/ui/Icon";

type Props = {
  pathname: string;
  /** Called when a link is followed (closes the mobile drawer). */
  onNavigate: () => void;
  /** Called on ⌘K / "/" before the search box is focused (opens the mobile drawer). */
  onSearchShortcut: () => void;
};

const sectionKey = (categoryId: string, section: string) => `${categoryId}/${section}`;

// Only the current note's category and section start open; everything else is one line.
function openFor(pathname: string) {
  const note = noteEntries.find((entry) => pathname === `/notes/${entry.slug}`);
  return new Set(note ? [note.categoryId, sectionKey(note.categoryId, note.section)] : []);
}

const searchIndex = noteEntries.map((note) => ({
  note,
  href: `/notes/${note.slug}/`,
  haystack: `${note.title} ${note.section} ${note.category} ${note.tags.join(" ")}`.toLowerCase(),
}));

function Highlight({ text, term }: { text: string; term: string }) {
  const at = term ? text.toLowerCase().indexOf(term) : -1;
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + term.length)}</mark>{text.slice(at + term.length)}</>;
}

export default function SidebarNav({ pathname, onNavigate, onSearchShortcut }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(() => openFor(pathname));
  // Moving to another note collapses the tree back to that note's branch.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(openFor(pathname));
    setQuery("");
  }

  const toggle = (key: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  useEffect(() => {
    // Set scrollTop directly: a smooth scrollIntoView gets cancelled by Next's own scroll handling on load.
    const nav = document.querySelector<HTMLElement>(".sidebar-nav");
    const active = nav?.querySelector<HTMLElement>(".note-link.is-active");
    if (!nav || !active) return;
    const offset = active.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
    nav.scrollTop = offset - nav.clientHeight / 2 + active.offsetHeight / 2;
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      const isCmdK = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (!isCmdK && (event.key !== "/" || typing)) return;
      event.preventDefault();
      onSearchShortcut();
      // Let the mobile drawer open (and run its own focus) before taking focus.
      window.setTimeout(() => { input.current?.focus(); input.current?.select(); }, 30);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onSearchShortcut]);

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = terms.length ? searchIndex.filter((item) => terms.every((term) => item.haystack.includes(term))) : [];
  const resultGroups = [...new Set(results.map((item) => `${item.note.category} / ${item.note.section}`))]
    .map((title) => ({ title, items: results.filter((item) => `${item.note.category} / ${item.note.section}` === title) }));

  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (query) setQuery(""); else input.current?.blur();
    } else if (event.key === "Enter" && results[0]) {
      router.push(results[0].href);
      onNavigate();
    }
  };

  return (
    <>
      <label className="nav-search">
        <Icon name="search" />
        <input
          ref={input}
          type="search"
          value={query}
          placeholder="搜索笔记"
          aria-label="搜索笔记"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKey}
        />
        <kbd>⌘K</kbd>
      </label>
      <nav className="sidebar-nav" aria-label="主导航">
        {terms.length ? (
          <div className="nav-results" aria-live="polite">
            <div className="nav-heading"><span>RESULTS</span><span>{results.length} notes</span></div>
            {resultGroups.length === 0 && <p className="nav-empty">没有匹配「{query.trim()}」的笔记</p>}
            {resultGroups.map((group) => (
              <div className="nav-result-group" key={group.title}>
                <p className="nav-result-title">{group.title}</p>
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className="note-link" onClick={onNavigate}>
                    <span className="note-bullet" /><span><Highlight text={item.note.title} term={terms[0]} /></span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <>
            <Link href="/" className={`home-link ${pathname === "" ? "is-active" : ""}`} aria-current={pathname === "" ? "page" : undefined} onClick={onNavigate}><Icon name="home" /><span>知识库首页</span><span className="nav-shortcut">⌂</span></Link>
            <div className="nav-heading"><span>MY LIBRARY</span><span>{noteEntries.length} notes</span></div>
            <div className="nav-groups">
              {navigation.map((group) => {
                if (!group.count) return <div key={group.id} className="nav-group-empty"><Icon name={group.icon} /><span>{group.title}</span><span className="nav-count">0</span></div>;
                const groupOpen = open.has(group.id);
                return (
                  <div key={group.id} className={`nav-group ${groupOpen ? "is-open" : ""}`}>
                    <button type="button" className="nav-group-toggle" aria-expanded={groupOpen} aria-controls={`nav-${group.id}`} onClick={() => toggle(group.id)}>
                      <Icon name={group.icon} /><span>{group.title}</span><span className="nav-count">{group.count}</span><Icon name="chevron" className="nav-chevron" />
                    </button>
                    {groupOpen && (
                      <div className="nav-sections" id={`nav-${group.id}`}>
                        {group.children.map((section) => {
                          const key = sectionKey(group.id, section.title);
                          const sectionOpen = open.has(key);
                          return (
                            <div className={`nav-section ${sectionOpen ? "is-open" : ""}`} key={section.title}>
                              <button type="button" className="nav-section-toggle" aria-expanded={sectionOpen} onClick={() => toggle(key)}>
                                <Icon name="chevron" className="nav-chevron" /><span>{section.title}</span><span className="nav-count">{section.children.length}</span>
                              </button>
                              {sectionOpen && section.children.map((note) => {
                                const active = pathname === note.href.replace(/\/$/, "");
                                return <Link key={note.href} href={note.href} className={`note-link ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={onNavigate}><span className="note-bullet" /><span>{note.title}</span></Link>;
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </nav>
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { navigation } from "@/content/navigation";
import { noteEntries } from "@/content/notes";
import Icon from "@/components/ui/Icon";
import NoteTitle from "@/components/i18n/NoteTitle";
import { useLang } from "@/components/i18n/LangProvider";
import { homePath, notePath, stripLang, t } from "@/lib/i18n";

type Props = {
  /** The current path without its trailing slash; may carry the "/en" prefix. */
  pathname: string;
  /** Called when a link is followed (closes the mobile drawer). */
  onNavigate: () => void;
  /** Called on ⌘K / "/" before the search box is focused (opens the mobile drawer). */
  onSearchShortcut: () => void;
};

const sectionKey = (categoryId: string, section: string) => `${categoryId}/${section}`;

// Only the current note's category and section start open; everything else is one line.
function openFor(pathname: string) {
  const path = stripLang(pathname);
  const note = noteEntries.find((entry) => path === `/notes/${entry.slug}`);
  return new Set(note ? [note.categoryId, sectionKey(note.categoryId, note.section)] : []);
}

function Highlight({ text, term }: { text: string; term: string }) {
  const at = term ? text.toLowerCase().indexOf(term) : -1;
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + term.length)}</mark>{text.slice(at + term.length)}</>;
}

export default function SidebarNav({ pathname, onNavigate, onSearchShortcut }: Props) {
  const lang = useLang();
  const path = stripLang(pathname);
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

  // Both titles are searchable in either language; results link to the page in the reader's language.
  const searchIndex = useMemo(() => noteEntries.map((note) => ({
    note,
    href: notePath(note, lang),
    haystack: `${note.en?.title ?? ""} ${note.title} ${note.section} ${note.category} ${note.tags.join(" ")}`.toLowerCase(),
  })), [lang]);

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
      const target = event.target;
      const typing = target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']");
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
          placeholder={t(lang, "searchPlaceholder")}
          aria-label={t(lang, "searchPlaceholder")}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKey}
        />
        <kbd>⌘K</kbd>
      </label>
      <nav className="sidebar-nav" aria-label={t(lang, "mainNav")}>
        {terms.length ? (
          <div className="nav-results" aria-live="polite">
            <div className="nav-heading"><span>RESULTS</span><span>{t(lang, "libraryCount", { n: results.length })}</span></div>
            {resultGroups.length === 0 && <p className="nav-empty">{t(lang, "noResults", { q: query.trim() })}</p>}
            {resultGroups.map((group) => (
              <div className="nav-result-group" key={group.title}>
                <p className="nav-result-title">{group.title}</p>
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className="note-link" onClick={onNavigate}>
                    <span className="note-bullet" /><NoteTitle note={item.note} lang={lang}>{(title) => <Highlight text={title} term={terms[0]} />}</NoteTitle>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <>
            <Link href={homePath(lang)} className={`home-link ${path === "" ? "is-active" : ""}`} aria-current={path === "" ? "page" : undefined} onClick={onNavigate}><Icon name="home" /><span>{t(lang, "homeLink")}</span><span className="nav-shortcut">⌂</span></Link>
            <div className="nav-heading"><span>MY LIBRARY</span><span>{t(lang, "libraryCount", { n: noteEntries.length })}</span></div>
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
                                const active = path === `/notes/${note.slug}`;
                                return <Link key={note.slug} href={notePath(note, lang)} className={`note-link ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={onNavigate}><span className="note-bullet" /><NoteTitle note={note} lang={lang} /></Link>;
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

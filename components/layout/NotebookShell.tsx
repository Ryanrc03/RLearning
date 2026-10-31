"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { noteEntries } from "@/content/notes";
import { profile } from "@/content/profile";
import Avatar from "./Avatar";
import SidebarNav from "./SidebarNav";
import Icon from "@/components/ui/Icon";
import { useLang } from "@/components/i18n/LangProvider";
import { homePath, htmlLang, notePath, otherLang, stripLang, t } from "@/lib/i18n";

export default function NotebookShell({ children, activity }: { children: React.ReactNode; activity: React.ReactNode }) {
  const lang = useLang();
  const pathname = usePathname().replace(/\/$/, "");
  // The page's place in the library, the same for both languages: "" is the homepage.
  const path = stripLang(pathname);
  const currentNote = noteEntries.find((note) => path === `/notes/${note.slug}`);
  // The same page in the other language, when there is one.
  const other = otherLang(lang);
  const samePage = path === "" ? homePath(other) : currentNote?.en ? notePath(currentNote, other) : null;
  // A Chinese-only note still gives English readers a way back: the English home.
  const englishHome = !samePage && Boolean(currentNote) && lang === "zh";
  const otherPage = samePage ?? (englishHome ? homePath("en") : null);
  const otherTag = htmlLang(other);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  // The drawer only exists on narrow screens; opening it there is harmless on wide ones.
  const openForSearch = useCallback(() => { if (window.matchMedia("(max-width: 850px)").matches) setMobileOpen(true); }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const returnFocus = menuButton.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const items = Array.from(sidebar.current?.querySelectorAll<HTMLElement>("a, button, summary") ?? []).filter((item) => item.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeyDown);
      returnFocus?.focus();
    };
  }, [mobileOpen]);

  return (
    <div className="notebook-shell">
      <a className="skip-link" href="#main-content">{t(lang, "skipToContent")}</a>
      {mobileOpen && <button className="sidebar-overlay" aria-label={t(lang, "closeSidebar")} onClick={() => setMobileOpen(false)} />}
      <div className="sidebar-hotzone" aria-hidden="true" />
      <aside id="notebook-sidebar" ref={sidebar} className={`sidebar ${mobileOpen ? "is-open" : ""}`} aria-label={t(lang, "sidebarLabel")}>
        <div className="sidebar-heading">
          <Link href={homePath(lang)} className="brand" onClick={() => setMobileOpen(false)}><span className="brand-mark"><Icon name="book" /></span><span>RLearning<span className="brand-dot">.</span></span></Link>
          <button className="icon-button mobile-close" aria-label={t(lang, "closeSidebar")} onClick={() => setMobileOpen(false)}><Icon name="close" /></button>
        </div>
        <p className="brand-caption">A little wiser, every day.</p>
        <SidebarNav pathname={pathname} onNavigate={closeMobile} onSearchShortcut={openForSearch} />
        <div className="sidebar-bottom">
          <div className="sidebar-signature"><span className="status-dot" /> Learning in public <span>EST. 2026</span></div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-path">
            <button ref={menuButton} className="icon-button mobile-menu" aria-label={t(lang, "openSidebar")} aria-expanded={mobileOpen} aria-controls="notebook-sidebar" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
            <Link href={homePath(lang)} className="breadcrumb-home"><Icon name="book" /><span>Notebook</span></Link><span className="breadcrumb-divider">/</span><span className="breadcrumb-current">{currentNote?.category ?? t(lang, "overview")}</span>
          </div>
          <div className="topbar-profile">
            <span className="public-label"><span className="status-dot" /> {t(lang, "publicLabel")}</span>
            {/* A plain link: each language has its own root layout, so switching is a full page load anyway. */}
            {otherPage && (englishHome
              // The title is in the page language, so only the link text is marked as English.
              ? <a className="lang-link" href={otherPage} hrefLang={otherTag} title={t(lang, "englishSiteTitle")}><span lang={otherTag}>{t(lang, "switchToOther")}</span></a>
              : <a className="lang-link" href={otherPage} hrefLang={otherTag} lang={otherTag}>{t(lang, "switchToOther")}</a>)}
            {profile.githubUrl && <a className="icon-button github-link" href={profile.githubUrl} aria-label={`${profile.name} on GitHub`} target="_blank" rel="noreferrer"><Icon name="github" /></a>}<Avatar size="small" />
          </div>
        </header>
        <main id="main-content" className="workspace-content" tabIndex={-1}>
          {path === "" ? null : activity}{children}
          <footer className="site-footer"><span>RLearning<span className="brand-dot">.</span> <span className="footer-separator">/</span> Notes, connections & small discoveries.</span><span>Always a work in progress <Icon name="sun" /></span></footer>
        </main>
      </div>
    </div>
  );
}

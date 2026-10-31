"use client";

import { useEffect, useRef, useState } from "react";
import { noteEntries } from "@/content/notes";
import Icon from "@/components/ui/Icon";
import { useLang } from "@/components/i18n/LangProvider";
import { noteText, stripLang, t, type Lang } from "@/lib/i18n";

// Below this width there is no room for two articles side by side, so links navigate normally.
const SPLIT_QUERY = "(min-width: 1081px)";

// Share of the viewport the right pane takes; remembered across notes.
const RATIO_KEY = "rlearning:split-ratio";
const MIN_RATIO = 0.25;
const MAX_RATIO = 0.75;
const clampRatio = (ratio: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));

const normalize = (path: string) => path.replace(/\/$/, "");

/** The pane header for a note path (either language); an English page marks a Chinese-only title. */
function titleFor(path: string, lang: Lang) {
  const note = noteEntries.find((entry) => `/notes/${entry.slug}` === stripLang(normalize(path)));
  if (!note) return { path, title: "", zhOnly: false };
  const { title, translated } = noteText(note, lang);
  return { path, title, zhOnly: lang === "en" && !translated };
}

/** Opens in-article note links in a right-hand pane instead of navigating away. */
export default function SplitReader() {
  const lang = useLang();
  const [src, setSrc] = useState<string | null>(null);
  const [current, setCurrent] = useState({ path: "", title: "", zhOnly: false });
  // The pane only renders after a click, so reading storage here cannot cause a hydration mismatch.
  const [ratio, setRatio] = useState(() => {
    try {
      const saved = typeof window === "undefined" ? 0 : Number(window.localStorage.getItem(RATIO_KEY));
      return saved ? clampRatio(saved) : 0.5;
    } catch {
      return 0.5;
    }
  });
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--split-width", `${ratio * 100}vw`);
    try { window.localStorage.setItem(RATIO_KEY, String(ratio)); } catch {}
  }, [ratio]);

  useEffect(() => {
    if (window.self !== window.top) return; // already inside a split pane: let links move within it
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>(".prose a[href]");
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      // Notes in either language: /notes/… and /en/notes/….
      if (url.origin !== window.location.origin || !stripLang(url.pathname).startsWith("/notes/")) return;
      if (normalize(url.pathname) === normalize(window.location.pathname)) return;
      if (!window.matchMedia(SPLIT_QUERY).matches) return;
      event.preventDefault();
      setSrc(url.pathname + url.hash);
      setCurrent(titleFor(url.pathname, lang));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [lang]);

  useEffect(() => {
    if (!src) return;
    const root = document.documentElement;
    root.classList.add("is-split");
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSrc(null); };
    const media = window.matchMedia(SPLIT_QUERY);
    const onResize = () => { if (!media.matches) setSrc(null); };
    document.addEventListener("keydown", onKeyDown);
    media.addEventListener("change", onResize);
    return () => {
      root.classList.remove("is-split");
      document.removeEventListener("keydown", onKeyDown);
      media.removeEventListener("change", onResize);
    };
  }, [src]);

  if (!src) return null;

  // The iframe would swallow pointer moves mid-drag, so html.is-resizing turns its pointer events off.
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    document.documentElement.classList.add("is-resizing");
    const onMove = (move: PointerEvent) => setRatio(clampRatio(1 - move.clientX / window.innerWidth));
    const onUp = () => {
      document.documentElement.classList.remove("is-resizing");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  const onResizeKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: 0.05, ArrowRight: -0.05 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    setRatio((value) => clampRatio(value + step));
  };

  // Links clicked inside the pane navigate the iframe; keep the header in step with it.
  const onLoad = () => {
    const path = frame.current?.contentWindow?.location.pathname;
    if (path) setCurrent(titleFor(path, lang));
  };

  return (
    <aside className="split-pane" aria-label={t(lang, "splitPaneLabel", { title: current.title })}>
      <div
        className="split-pane-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label={t(lang, "splitResize")}
        aria-valuemin={MIN_RATIO * 100}
        aria-valuemax={MAX_RATIO * 100}
        aria-valuenow={Math.round(ratio * 100)}
        title={t(lang, "splitResizeTitle")}
        tabIndex={0}
        onPointerDown={startResize}
        onDoubleClick={() => setRatio(0.5)}
        onKeyDown={onResizeKey}
      />
      <div className="split-pane-bar">
        <span className="split-pane-title" lang={current.zhOnly ? "zh-CN" : undefined}>{current.title}</span>
        <a className="split-pane-open" href={current.path}>{t(lang, "splitOpenFull")} <Icon name="arrow" /></a>
        <button className="icon-button" aria-label={t(lang, "splitClose")} title={t(lang, "splitCloseTitle")} onClick={() => setSrc(null)}><Icon name="close" /></button>
      </div>
      <iframe ref={frame} key={src} src={src} title={current.title} onLoad={onLoad} />
    </aside>
  );
}

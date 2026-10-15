"use client";

import { useEffect, useRef } from "react";

type LabFrameProps = {
  /** Path under public/, e.g. "/labs/recsys/boosting-lab.html". Must be same-origin. */
  src: string;
  title: string;
  minHeight?: number;
};

// Embeds a self-contained lab page and keeps the iframe as tall as its document,
// so the note scrolls as one page. Same-origin lets us observe the inner document
// directly instead of injecting postMessage scripts into every lab.
export default function LabFrame({ src, title, minHeight = 480 }: LabFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    let observer: ResizeObserver | undefined;

    const fit = () => {
      const root = iframe.contentDocument?.documentElement;
      if (root) iframe.style.height = `${Math.ceil(root.getBoundingClientRect().height)}px`;
    };
    const attach = () => {
      const win = iframe.contentWindow;
      const root = iframe.contentDocument?.documentElement;
      if (!win || !root) return;
      observer?.disconnect();
      // Created in the iframe's realm so it observes that document's layout.
      const next = new (win as Window & typeof globalThis).ResizeObserver(fit);
      next.observe(root);
      observer = next;
      fit();
    };

    iframe.addEventListener("load", attach);
    // The load event may already have fired before hydration attached this effect.
    if (iframe.contentDocument?.readyState === "complete" && iframe.contentDocument.body?.childElementCount) attach();
    return () => {
      iframe.removeEventListener("load", attach);
      observer?.disconnect();
    };
  }, [src]);

  return (
    <div className="lab-frame">
      <iframe ref={frame} src={src} title={title} loading="lazy" style={{ minHeight }} />
    </div>
  );
}

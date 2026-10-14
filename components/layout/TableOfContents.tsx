"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/headings";

export default function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => heading !== null);
    let frame = 0;

    function updateActiveHeading() {
      frame = 0;
      let current = headings[0]?.id ?? "";

      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= 128) current = heading.id;
      }

      // Short final sections may never reach the top of the viewport.
      if (
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 4
      ) {
        current = headings.at(-1)?.id ?? current;
      }

      setActiveId(current);
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(updateActiveHeading);
    }

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav className="note-toc" aria-label="On this page">
      <p className="toc-label">On this page</p>
      <ol className="toc-links">
        {items.map((item) => (
          <li key={item.id}>
            <a
              className={`toc-link${item.level === 3 ? " is-subheading" : ""}${activeId === item.id ? " is-active" : ""}`}
              href={`#${item.id}`}
              aria-current={activeId === item.id ? "location" : undefined}
              onClick={() => setActiveId(item.id)}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

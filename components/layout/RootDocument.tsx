import type { Metadata } from "next";
import { Patrick_Hand } from "next/font/google";
import NotebookShell from "@/components/layout/NotebookShell";
import LearningActivity from "@/components/layout/LearningActivity";
import { LangProvider } from "@/components/i18n/LangProvider";
import { htmlLang, type Lang } from "@/lib/i18n";
import "@/app/globals.css";
import "@/styles/visualization.css";
import "@/styles/sketch.css";
import "@/styles/machine.css";
import "katex/dist/katex.min.css";

// Handwritten face for the Excalidraw-style figures; self-hosted at build time.
// Defined once here so both root layouts share a single font instance.
const sketchFont = Patrick_Hand({ weight: "400", subsets: ["latin"], variable: "--font-sketch", display: "swap" });

/** Metadata both root layouts share; each adds a description in its own language. */
export const baseMetadata = {
  metadataBase: new URL("https://rlearning-gamma.vercel.app"),
  title: { default: "RLearning", template: "%s | RLearning" },
} satisfies Metadata;

/** The <html> document shared by the Chinese and English root layouts. */
export default function RootDocument({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <html lang={htmlLang(lang)} className={sketchFont.variable} suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-head-element -- App Router root document (rendered by the root layouts), not a Pages Router page. */}
      <head>
        {/* A note opened in the split-reading pane drops the site chrome before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: "if(window.self!==window.top)document.documentElement.classList.add('is-embedded')" }} />
      </head>
      <body>
        <LangProvider lang={lang}>
          {/* The shell skips this activity panel on home pages, which render their own below the hero (an accepted duplicate in the RSC payload). */}
          <NotebookShell activity={<LearningActivity lang={lang} />}>{children}</NotebookShell>
        </LangProvider>
      </body>
    </html>
  );
}

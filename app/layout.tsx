import type { Metadata } from "next";
import { Patrick_Hand } from "next/font/google";
import NotebookShell from "@/components/layout/NotebookShell";
import LearningActivity from "@/components/layout/LearningActivity";
import "./globals.css";
import "@/styles/visualization.css";
import "@/styles/sketch.css";
import "katex/dist/katex.min.css";

// Handwritten face for the Excalidraw-style figures; self-hosted at build time.
const sketchFont = Patrick_Hand({ weight: "400", subsets: ["latin"], variable: "--font-sketch", display: "swap" });

export const metadata: Metadata = {
  title: { default: "RLearning", template: "%s | RLearning" },
  description: "Notes on computer systems, machine learning, LLMs, and AI infrastructure.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={sketchFont.variable}>
      <body><NotebookShell activity={<LearningActivity />}>{children}</NotebookShell></body>
    </html>
  );
}

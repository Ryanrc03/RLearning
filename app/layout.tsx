import type { Metadata } from "next";
import NotebookShell from "@/components/layout/NotebookShell";
import LearningActivity from "@/components/layout/LearningActivity";
import "./globals.css";
import "@/styles/visualization.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: { default: "RLearning", template: "%s | RLearning" },
  description: "Notes on computer systems, machine learning, LLMs, and AI infrastructure.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><NotebookShell activity={<LearningActivity />}>{children}</NotebookShell></body>
    </html>
  );
}

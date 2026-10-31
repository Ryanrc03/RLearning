import type { Metadata } from "next";
import RootDocument from "@/components/layout/RootDocument";

// No `alternates` here: metadata merges shallowly down the tree, so every note page
// would inherit it. The language alternates live on the two home pages instead.
export const metadata: Metadata = {
  metadataBase: new URL("https://rlearning-gamma.vercel.app"),
  title: { default: "RLearning", template: "%s | RLearning" },
  description: "Notes on computer systems, machine learning, LLMs, and AI infrastructure.",
};

export default function ZhLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument lang="zh">{children}</RootDocument>;
}

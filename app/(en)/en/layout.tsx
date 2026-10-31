import type { Metadata } from "next";
import RootDocument, { baseMetadata } from "@/components/layout/RootDocument";

// No `alternates` here, for the same reason as the Chinese layout: it would be inherited by every page below.
export const metadata: Metadata = {
  ...baseMetadata,
  description: "Ryan's notes on computer systems, machine learning, LLMs, and AI infrastructure, learned in public.",
};

export default function EnLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument lang="en">{children}</RootDocument>;
}

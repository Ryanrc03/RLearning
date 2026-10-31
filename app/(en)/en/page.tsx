import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { languages: { "zh-CN": "/", en: "/en/" } },
};

// Temporary placeholder; replaced by the shared HomePageView in a later step.
export default function EnglishHomePage() {
  return <div className="home-page"><div className="page-intro"><h1>RLearning</h1></div></div>;
}

import type { Metadata } from "next";
import HomePageView from "@/components/home/HomePageView";

// Language alternates sit on the home page, not the layout, so note pages don't inherit them.
export const metadata: Metadata = {
  alternates: { languages: { "zh-CN": "/", en: "/en/" } },
};

export default function HomePage() {
  return <HomePageView lang="zh" />;
}

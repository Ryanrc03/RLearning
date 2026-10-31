import type { Metadata } from "next";
import HomePageView from "@/components/home/HomePageView";

export const metadata: Metadata = {
  alternates: { languages: { "zh-CN": "/", en: "/en/" } },
};

export default function EnglishHomePage() {
  return <HomePageView lang="en" />;
}

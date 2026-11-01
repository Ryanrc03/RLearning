import { t, type Lang } from "@/lib/i18n";

/** The small 中文 tag after a Chinese-only note's title on an English page. */
export default function LangTag({ lang }: { lang: Lang }) {
  return <span className="lang-tag" title={t(lang, "chineseOnlyTitle")}>{t(lang, "chineseOnly")}</span>;
}

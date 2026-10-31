import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dict, homePath, htmlLang, notePath, noteText, otherLang, stripLang, t, type DictKey } from "@/lib/i18n";
import { noteEntries } from "@/content/notes";

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).filter((name) => name !== "s").sort();

test("both languages define exactly the same UI keys", () => {
  assert.deepEqual(Object.keys(dict.en).sort(), Object.keys(dict.zh).sort());
});

test("each key uses the same placeholders in both languages, ignoring the plural {s}", () => {
  for (const key of Object.keys(dict.zh) as DictKey[]) {
    assert.deepEqual(placeholders(dict.en[key]), placeholders(dict.zh[key]), key);
  }
});

test("note paths: English only for translated notes", () => {
  const translated = { slug: "ml/post-training/grpo", en: { title: "GRPO", description: "d", updated: "2026-10-30" } };
  const chineseOnly = { slug: "cs/os/overview" };
  assert.equal(notePath(translated, "zh"), "/notes/ml/post-training/grpo/");
  assert.equal(notePath(translated, "en"), "/en/notes/ml/post-training/grpo/");
  assert.equal(notePath(chineseOnly, "en"), "/notes/cs/os/overview/");
});

test("home paths and prefix stripping", () => {
  assert.equal(homePath("zh"), "/");
  assert.equal(homePath("en"), "/en/");
  assert.equal(stripLang("/en/notes/a/b"), "/notes/a/b");
  assert.equal(stripLang("/en"), "");
  assert.equal(stripLang("/notes/a"), "/notes/a");
  assert.equal(stripLang("/en/"), "/");
  assert.equal(stripLang("/english"), "/english");
  assert.equal(otherLang("zh"), "en");
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});

test("note text falls back to Chinese when there is no translation", () => {
  const note = noteEntries.find((entry) => !entry.en)!;
  assert.equal(noteText(note, "en").title, note.title);
  assert.equal(noteText(note, "en").translated, false);
  assert.equal(noteText(note, "en").textLang, "zh-CN");
  assert.equal(noteText(note, "zh").textLang, undefined);
});

test("note text uses the English title and description when translated", () => {
  const note = { slug: "a/b", title: "标题", description: "描述", en: { title: "Title", description: "Description", updated: "2026-10-30" } };
  assert.deepEqual(noteText(note, "en"), { title: "Title", description: "Description", translated: true, textLang: undefined });
  assert.deepEqual(noteText(note, "zh"), { title: "标题", description: "描述", translated: false, textLang: undefined });
});

test("t fills placeholders", () => {
  assert.equal(t("en", "noteCount", { n: 3 }), "3 notes");
  assert.equal(t("zh", "noteCount", { n: 3 }), "3 篇笔记");
});

test("t pluralises English with {s}: only n = 1 is singular", () => {
  assert.equal(t("en", "noteCount", { n: 1 }), "1 note");
  assert.equal(t("en", "noteCount", { n: 0 }), "0 notes");
  assert.equal(t("en", "noteCount", { n: 2 }), "2 notes");
  assert.equal(t("zh", "noteCount", { n: 1 }), "1 篇笔记");
});

test("t fills several placeholders and leaves a missing one visible", () => {
  const vars = { date: "2026-10-30", n: 2, titles: "A, B" };
  assert.equal(t("en", "activityDayTitles", vars), "2026-10-30 · 2 notes updated: A, B");
  assert.equal(t("en", "activityDayTitles", { ...vars, n: 1, titles: "A" }), "2026-10-30 · 1 note updated: A");
  assert.equal(t("zh", "activityDayTitles", { ...vars, titles: "A、B" }), "2026-10-30 · 2 篇笔记更新：A、B");
  assert.equal(t("zh", "noteCount"), "{n} 篇笔记");
  assert.ok(t("en", "noteCount").startsWith("{n} note"));
});

// content/noteComponents.ts imports .mdx files, which the test runner cannot load, so read its keys as text.
function registryKeys(name: string): string[] {
  const source = readFileSync(join(process.cwd(), "content", "noteComponents.ts"), "utf8");
  const start = source.indexOf(`export const ${name} = {`);
  assert.ok(start >= 0, `content/noteComponents.ts has no ${name}`);
  const block = source.slice(start, source.indexOf("\n}", start));
  return [...block.matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]).sort();
}

const translatedSlugs = noteEntries.filter((note) => note.en).map((note) => note.slug).sort();

test("the Chinese registry has exactly one page per note", () => {
  assert.deepEqual(registryKeys("noteComponents"), noteEntries.map((note) => note.slug).sort());
});

test("the English registry has exactly the translated notes, each with its .en.mdx file", () => {
  assert.deepEqual(registryKeys("noteComponentsEn"), translatedSlugs);
  for (const slug of translatedSlugs) assert.ok(existsSync(join(process.cwd(), "content", `${slug}.en.mdx`)), `content/${slug}.en.mdx is missing`);
});

test("a translated note in a series has an English series title", () => {
  for (const note of noteEntries) if (note.en && note.series) assert.ok(note.en.seriesTitle, `${note.slug} needs en.seriesTitle`);
});

test("the first batch of translations is the GRPO line", () => {
  assert.deepEqual(translatedSlugs, ["ml/post-training/grpo", "ml/post-training/grpo-3060-project", "ml/post-training/reward-hacking"]);
});

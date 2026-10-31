import { test } from "node:test";
import assert from "node:assert/strict";
import { dict, homePath, notePath, noteText, otherLang, stripLang, t, type DictKey } from "@/lib/i18n";
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
});

test("note text falls back to Chinese when there is no translation", () => {
  const note = noteEntries.find((entry) => !entry.en)!;
  assert.equal(noteText(note, "en").title, note.title);
  assert.equal(noteText(note, "en").translated, false);
});

test("note text uses the English title and description when translated", () => {
  const note = { slug: "a/b", title: "标题", description: "描述", en: { title: "Title", description: "Description", updated: "2026-10-30" } };
  assert.deepEqual(noteText(note, "en"), { title: "Title", description: "Description", translated: true });
  assert.deepEqual(noteText(note, "zh"), { title: "标题", description: "描述", translated: false });
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

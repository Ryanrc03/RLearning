import { test } from "node:test";
import assert from "node:assert/strict";
import { dict, homePath, notePath, noteText, otherLang, stripLang, t } from "@/lib/i18n";
import { noteEntries } from "@/content/notes";

test("both languages define exactly the same UI keys", () => {
  assert.deepEqual(Object.keys(dict.en).sort(), Object.keys(dict.zh).sort());
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
  assert.equal(stripLang("/english"), "/english");
  assert.equal(otherLang("zh"), "en");
});

test("note text falls back to Chinese when there is no translation", () => {
  const note = noteEntries.find((entry) => !entry.en)!;
  assert.equal(noteText(note, "en").title, note.title);
  assert.equal(noteText(note, "en").translated, false);
});

test("t fills placeholders", () => {
  assert.equal(t("en", "noteCount", { n: 3 }), "3 notes");
  assert.equal(t("zh", "noteCount", { n: 3 }), "3 篇笔记");
});

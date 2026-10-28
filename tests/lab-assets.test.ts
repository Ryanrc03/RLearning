import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { noteEntries } from "@/content/notes";

test("embedded labs resolve to directory index files in both static hosting and Next/Vercel", () => {
  let checked = 0;
  for (const note of noteEntries) {
    const source = readFileSync(join(process.cwd(), "content", `${note.slug}.mdx`), "utf8");
    for (const match of source.matchAll(/<LabFrame\b[^>]*\bsrc="([^"]+)"/g)) {
      const src = match[1];
      const directory = join(process.cwd(), "public", src);
      assert.ok(statSync(directory).isDirectory(), `${note.slug}: ${src} must be a directory entrypoint; explicit .html URLs return 404 on Vercel`);
      assert.ok(readFileSync(join(directory, "index.html"), "utf8").toLowerCase().includes("<!doctype html>"), `${src} must serve a complete HTML lab`);
      checked++;
    }
  }
  assert.ok(checked > 0, "must check actual embedded labs");
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { getNote } from "@/content/notes";
import { createHeadingId, type TocItem } from "@/lib/headings";

function headingText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .trim();
}

// Read only published local content at build time; no runtime service is needed.
export function getNoteToc(slug: string): TocItem[] {
  if (!getNote(slug)) return [];

  const source = readFileSync(
    path.join(process.cwd(), "content", `${slug}.mdx`),
    "utf8",
  );
  const nextId = createHeadingId();
  const items: TocItem[] = [];
  let fence: { marker: string; length: number } | undefined;

  for (const line of source.split(/\r?\n/)) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);

    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      const length = fenceMatch[1].length;

      if (!fence) {
        fence = { marker, length };
      } else if (
        marker === fence.marker &&
        length >= fence.length &&
        fenceMatch[2].trim() === ""
      ) {
        fence = undefined;
      }
      continue;
    }

    if (fence) continue;

    const heading = line.match(/^ {0,3}(#{2,3})\s+(.+?)\s*$/);
    if (!heading) continue;

    const title = headingText(heading[2].replace(/\s+#+\s*$/, ""));
    items.push({
      id: nextId(title),
      title,
      level: heading[1].length as 2 | 3,
    });
  }

  return items;
}

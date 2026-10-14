export type TocItem = {
  id: string;
  title: string;
  level: 2 | 3;
};

export function headingId(title: string): string {
  return (
    title
      .normalize("NFKC")
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section"
  );
}

// Each article gets its own generator so repeated titles remain linkable.
export function createHeadingId() {
  const used = new Set<string>();

  return (title: string): string => {
    const base = headingId(title);
    let id = base;
    let suffix = 1;

    while (used.has(id)) {
      id = `${base}-${suffix++}`;
    }

    used.add(id);
    return id;
  };
}

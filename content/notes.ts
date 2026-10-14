export type NoteEntry = {
  slug: string;
  title: string;
  description: string;
  categoryId: "cs" | "systems" | "ml" | "ai-infra";
  category: string;
  section: string;
  created: string;
  updated: string;
  status: "seed" | "growing" | "stable";
  readingMinutes: number;
  tags: string[];
};

// Published notes share this metadata across navigation, search, and article pages.
export const noteEntries: NoteEntry[] = [
  {
    slug: "ml/reinforcement-learning/ucb",
    title: "Upper Confidence Bound (UCB)",
    description:
      "用不确定性指导探索：从 UCB 的直觉与公式，到适应奖励变化的 Discounted UCB。",
    categoryId: "ml",
    category: "ML & LLM",
    section: "Reinforcement Learning",
    created: "2026-09-29",
    updated: "2026-09-29",
    status: "growing",
    readingMinutes: 8,
    tags: ["bandits", "exploration", "reinforcement learning"],
  },
  {
    slug: "cs/os/virtual-memory",
    title: "Virtual Memory",
    description:
      "理解操作系统如何为进程提供独立的地址空间，以及地址转换背后的机制与代价。",
    categoryId: "cs",
    category: "CS Foundations",
    section: "Operating Systems",
    created: "2026-09-29",
    updated: "2026-09-29",
    status: "seed",
    readingMinutes: 2,
    tags: ["operating systems", "memory", "paging"],
  },
];

export function getNote(slug: string): NoteEntry | undefined {
  return noteEntries.find((note) => note.slug === slug);
}

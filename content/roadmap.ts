// The homepage roadmap: one node per section of the library, laid out by hand
// on a grid, with "read A before B" edges. ML edges are derived from the
// knowledge tree (content/ml/tree.ts); the rest are written here. Edges that are
// implied by a longer path are dropped so the picture stays readable.
// tests/roadmap.test.ts keeps it in step with the note registry.

import { noteEntries, type NoteEntry } from "./notes";
import { edges as treeEdges, nodeBySlug } from "./ml/tree";

export type RoadmapNode = {
  /** Stable id, e.g. "cs-os" or "ml-llms". ML chapters use `ml-${chapter.id}`. */
  id: string;
  /** Matches `section` in content/notes.ts exactly. */
  section: string;
  categoryId: NoteEntry["categoryId"];
  /** Short label drawn on the card; defaults to the section name. */
  label?: string;
  /** Grid row (0 at the top) and column; columns may be fractional to centre a node. */
  row: number;
  col: number;
};

export type RoadmapEdge = { from: string; to: string };

export const roadmapNodes: RoadmapNode[] = [
  // CS foundations, then systems built on them
  { id: "cs-fundamentals", section: "CS Fundamentals", categoryId: "cs", row: 0, col: 1 },
  { id: "algo-binary-search", section: "Binary Search", categoryId: "algorithms", row: 1, col: 0 },
  { id: "cs-networks", section: "Computer Networks", categoryId: "cs", label: "Networks", row: 1, col: 1 },
  { id: "cs-os", section: "Operating Systems", categoryId: "cs", row: 1, col: 2 },
  { id: "algo-stack", section: "Stack & Monotonic Stack", categoryId: "algorithms", label: "Monotonic Stack", row: 2, col: 0 },
  { id: "sys-distributed", section: "Distributed Systems", categoryId: "systems", label: "Distributed", row: 2, col: 1.5 },
  { id: "sys-data", section: "Data Infrastructure", categoryId: "systems", label: "Data Infra", row: 3, col: 0 },
  { id: "sys-design", section: "System Design", categoryId: "systems", row: 3, col: 1 },
  { id: "sys-backend", section: "Backend Systems", categoryId: "systems", label: "Backend", row: 3, col: 2 },
  { id: "ai-gpu", section: "GPU Kernels", categoryId: "ai-infra", row: 3, col: 3 },
  { id: "sys-ads", section: "Ads Backend Systems", categoryId: "systems", label: "Ads Backend", row: 4, col: 1 },
  // ML & LLM
  { id: "ml-tree", section: "Knowledge Tree", categoryId: "ml", label: "ML 知识树", row: 0, col: 5 },
  { id: "ml-training", section: "Training", categoryId: "ml", row: 1, col: 4 },
  { id: "ml-ab-testing", section: "A/B Testing", categoryId: "ml", label: "A/B Testing", row: 0, col: 7 },
  { id: "ml-evaluation", section: "Evaluation", categoryId: "ml", row: 1, col: 6 },
  { id: "ml-causal-inference", section: "Causal Inference", categoryId: "ml", label: "Causal", row: 1, col: 7 },
  { id: "ml-dl-blocks", section: "Deep Learning Blocks", categoryId: "ml", label: "DL Blocks", row: 2, col: 3 },
  { id: "ml-classifiers", section: "Classifiers", categoryId: "ml", row: 2, col: 4 },
  { id: "ml-trees", section: "Tree Models", categoryId: "ml", row: 2, col: 5 },
  { id: "ml-llms", section: "LLMs", categoryId: "ml", row: 3, col: 4 },
  { id: "ml-recsys", section: "Recommender Systems", categoryId: "ml", label: "RecSys", row: 4, col: 6 },
  { id: "ml-llm-engineering", section: "LLM Engineering", categoryId: "ml", row: 4, col: 4 },
  { id: "ml-representations", section: "Representations", categoryId: "ml", row: 4, col: 5 },
  { id: "ai-agent", section: "Agent Harness", categoryId: "ai-infra", row: 5, col: 3 },
  { id: "ml-post-training", section: "Post-training", categoryId: "ml", row: 5, col: 4 },
  { id: "ml-rl", section: "Reinforcement Learning", categoryId: "ml", label: "RL", row: 6, col: 4 },
  { id: "ml-multimodal", section: "Multimodal Learning", categoryId: "ml", label: "Multimodal", row: 6, col: 5.5 },
];

// Edges the knowledge tree does not know about.
const handEdges: RoadmapEdge[] = [
  { from: "cs-fundamentals", to: "cs-os" },
  { from: "cs-fundamentals", to: "cs-networks" },
  { from: "cs-fundamentals", to: "algo-binary-search" },
  { from: "algo-binary-search", to: "algo-stack" },
  { from: "cs-networks", to: "sys-distributed" },
  { from: "cs-os", to: "sys-distributed" },
  { from: "sys-distributed", to: "sys-data" },
  { from: "sys-distributed", to: "sys-design" },
  { from: "sys-distributed", to: "sys-backend" },
  { from: "sys-data", to: "sys-ads" },
  { from: "sys-design", to: "sys-ads" },
  { from: "cs-os", to: "ai-gpu" },
  { from: "ml-dl-blocks", to: "ai-gpu" },
  { from: "ml-tree", to: "ml-training" },
  { from: "ml-tree", to: "ml-evaluation" },
  { from: "ml-training", to: "ml-dl-blocks" },
  { from: "ml-llm-engineering", to: "ai-agent" },
  { from: "ml-post-training", to: "ml-rl" },
];

/** Chapter-level edges: chapter A → B when any node of A is a prerequisite of a node of B. */
export function deriveMlEdges(): RoadmapEdge[] {
  const seen = new Set<string>();
  const out: RoadmapEdge[] = [];
  for (const edge of treeEdges) {
    const from = `ml-${nodeBySlug[edge.from].chapter.id}`;
    const to = `ml-${nodeBySlug[edge.to].chapter.id}`;
    const key = `${from}>${to}`;
    if (from === to || seen.has(key)) continue;
    seen.add(key);
    out.push({ from, to });
  }
  return out;
}

// Drop u → v when v is still reachable from u without it.
function transitiveReduction(all: RoadmapEdge[]): RoadmapEdge[] {
  const out = new Map<string, string[]>();
  for (const edge of all) out.set(edge.from, [...(out.get(edge.from) ?? []), edge.to]);
  const reachableWithout = (start: string, target: string) => {
    const stack = (out.get(start) ?? []).filter((next) => next !== target);
    const seen = new Set(stack);
    while (stack.length) {
      const id = stack.pop()!;
      if (id === target) return true;
      for (const next of out.get(id) ?? []) if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
    return false;
  };
  return all.filter((edge) => !reachableWithout(edge.from, edge.to));
}

export const roadmapEdges: RoadmapEdge[] = transitiveReduction([...handEdges, ...deriveMlEdges()]);

const byId = new Map(roadmapNodes.map((node) => [node.id, node]));

export function roadmapNode(id: string): RoadmapNode | undefined {
  return byId.get(id);
}

/** The section's notes in reading order: notes outside a series (overviews) first, then by series order. */
export function notesForNode(id: string): NoteEntry[] {
  const node = byId.get(id);
  if (!node) return [];
  return noteEntries
    .filter((note) => note.section === node.section && note.categoryId === node.categoryId)
    .sort((a, b) => (a.series?.order ?? 0) - (b.series?.order ?? 0));
}

export function prerequisites(id: string): RoadmapNode[] {
  return roadmapEdges.filter((edge) => edge.to === id).map((edge) => byId.get(edge.from)!);
}

export function nextSteps(id: string): RoadmapNode[] {
  return roadmapEdges.filter((edge) => edge.from === id).map((edge) => byId.get(edge.to)!);
}

/** Writing maturity: how many of the section's notes are at each status. */
export function maturity(id: string) {
  const notes = notesForNode(id);
  const count = (status: NoteEntry["status"]) => notes.filter((note) => note.status === status).length;
  return { stable: count("stable"), growing: count("growing"), seed: count("seed"), total: notes.length };
}

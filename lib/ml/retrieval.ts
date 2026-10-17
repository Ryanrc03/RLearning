// Recommender Systems: P@k, Recall@k and hit@k on one query's ranked results,
// plus the numbers measured in the owner's MeMe retrieval project. Pure
// functions; the figure's live numbers all come from here. See tests/retrieval.test.ts.

// `flags[i]` says whether the result at rank i + 1 is relevant to the query.
export type RelevanceFlags = readonly boolean[];

function assertK(k: number) {
  if (!Number.isInteger(k) || k <= 0) throw new Error(`k must be a positive integer, got ${k}`);
}

// How many of the first k results are relevant. A list shorter than k counts
// the missing ranks as not relevant.
export function hitsInTopK(flags: RelevanceFlags, k: number): number {
  assertK(k);
  return flags.slice(0, k).filter(Boolean).length;
}

// P@k = (relevant among the first k) / k.
export function precisionAtK(flags: RelevanceFlags, k: number): number {
  return hitsInTopK(flags, k) / k;
}

// Recall@k = (relevant among the first k) / (relevant in the whole library).
export function recallAtK(flags: RelevanceFlags, k: number, totalRelevant: number): number {
  const hits = hitsInTopK(flags, k);
  if (!Number.isInteger(totalRelevant) || totalRelevant <= 0) throw new Error(`totalRelevant must be a positive integer, got ${totalRelevant}`);
  if (hits > totalRelevant) throw new Error(`${hits} relevant results in the top ${k} but only ${totalRelevant} relevant in the library`);
  return hits / totalRelevant;
}

// hit@k: is there at least one relevant result in the first k?
export function hitAtK(flags: RelevanceFlags, k: number): boolean {
  return hitsInTopK(flags, k) > 0;
}

// The share of queries whose top k contains a hit. This is what the project
// notes call "P@30": one hit-or-miss per query, averaged over the queries.
export function hitRate(queries: readonly RelevanceFlags[], k: number): number {
  if (queries.length === 0) throw new Error("no queries");
  return queries.filter((q) => hitAtK(q, k)).length / queries.length;
}

export const DEMO_K = 30;

// One query's ranked list: 6 relevant memes at these ranks (1-based) out of 30.
export const DEMO_RELEVANT_RANKS = [1, 3, 7, 12, 19, 25] as const;

export function demoFlags(): boolean[] {
  return Array.from({ length: DEMO_K }, (_, i) => DEMO_RELEVANT_RANKS.includes((i + 1) as (typeof DEMO_RELEVANT_RANKS)[number]));
}

// How many relevant memes the whole library holds for this query; the figure's preset.
export const LIBRARY_TOTALS = [5, 10, 20] as const;
export const DEMO_LIBRARY_TOTAL = 10;

// Measured in the MeMe retrieval project over 100 queries. These are read off
// the project, not computed by the figure.
export type Measured = { key: "exact" | "semantic" | "group"; label: string; value: number; gloss: string };
export const MEASURED: readonly Measured[] = [
  { key: "exact", label: "exact-match 检索 P@30", value: 0.23, gloss: "100 条 query 里只有二十几条在前 30 个结果里找到了相关的 meme" },
  { key: "semantic", label: "semantic 检索 P@30", value: 0.9344, gloss: "100 条里 93 到 94 条在前 30 里找到了" },
  { key: "group", label: "group P@1", value: 0.8287, gloss: "第一个结果就落在正确的组里" },
];

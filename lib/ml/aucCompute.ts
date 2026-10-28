// Recommender Systems: how AUC and GAUC are actually computed (kurec/metrics.py).
// AUC counts correctly ordered (positive, negative) pairs; the rank formula gets
// the same number from one sort, ties scored as half a pair through average
// ranks. GAUC cuts the rows into groups (user, or request), computes one AUC per
// group that has both classes and averages them with weights.
// No React here; see tests/auc-compute.test.ts.

export type Row = { id: string; group: string; score: number; label: 0 | 1 };

// The O(n⁺·n⁻) definition: every positive against every negative, ties count ½.
export function pairCountAuc(rows: readonly Row[]): { auc: number; good: number; ties: number; pairs: number } {
  const pos = rows.filter((r) => r.label === 1);
  const neg = rows.filter((r) => r.label === 0);
  let good = 0;
  let ties = 0;
  for (const p of pos)
    for (const q of neg) {
      if (p.score > q.score) good++;
      else if (p.score === q.score) ties++;
    }
  const pairs = pos.length * neg.length;
  return { auc: pairs === 0 ? NaN : (good + ties / 2) / pairs, good, ties, pairs };
}

// Ranks 1..n by ascending score; tied scores share the average of their positions (scipy rankdata "average").
export function averageRanks(scores: readonly number[]): number[] {
  const order = scores.map((s, i) => [s, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(scores.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k++) ranks[order[k][1]] = avg;
    i = j + 1;
  }
  return ranks;
}

// The O(n log n) rank formula: AUC = (R⁺ − n⁺(n⁺+1)/2) / (n⁺ · n⁻), R⁺ = sum of the positives' ranks.
export function rankAuc(rows: readonly Row[]) {
  const ranks = averageRanks(rows.map((r) => r.score));
  const nPos = rows.filter((r) => r.label === 1).length;
  const nNeg = rows.length - nPos;
  const rPos = rows.reduce((s, r, i) => s + (r.label === 1 ? ranks[i] : 0), 0);
  const floor = (nPos * (nPos + 1)) / 2; // R⁺ if every positive sat at the bottom
  return { ranks, nPos, nNeg, rPos, floor, auc: nPos === 0 || nNeg === 0 ? NaN : (rPos - floor) / (nPos * nNeg) };
}

export type Weighting = "sample" | "positive" | "none";
export type GroupAuc = { group: string; n: number; nPos: number; auc: number; skipped: boolean };

// One AUC per group in first-seen order; a group with one class only is kept but marked skipped.
export function perGroupAuc(rows: readonly Row[]): GroupAuc[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  return [...groups.entries()].map(([group, list]) => {
    const nPos = list.filter((r) => r.label === 1).length;
    const skipped = nPos === 0 || nPos === list.length;
    return { group, n: list.length, nPos, auc: skipped ? NaN : rankAuc(list).auc, skipped };
  });
}

export const groupWeight = (g: GroupAuc, w: Weighting) => (w === "sample" ? g.n : w === "positive" ? g.nPos : 1);

export function gaucFrom(groups: readonly GroupAuc[], w: Weighting = "sample") {
  const used = groups.filter((g) => !g.skipped);
  const den = used.reduce((s, g) => s + groupWeight(g, w), 0);
  const num = used.reduce((s, g) => s + groupWeight(g, w) * g.auc, 0);
  const rowsUsed = used.reduce((s, g) => s + g.n, 0);
  const rowsAll = groups.reduce((s, g) => s + g.n, 0);
  return { gauc: den === 0 ? NaN : num / den, groups: used.length, skipped: groups.length - used.length, coverage: rowsAll === 0 ? 0 : rowsUsed / rowsAll };
}

// The worked example: three users. User A has a tie between a positive and a negative; user C clicked nothing,
// so C has no AUC. Requests group the same rows by (user, request time).
export const EXAMPLE_ROWS: Row[] = [
  { id: "A1", group: "A", score: 0.91, label: 1 },
  { id: "A2", group: "A", score: 0.74, label: 0 },
  { id: "A3", group: "A", score: 0.66, label: 1 },
  { id: "A4", group: "A", score: 0.52, label: 0 },
  { id: "A5", group: "A", score: 0.52, label: 1 },
  { id: "A6", group: "A", score: 0.3, label: 0 },
  { id: "A7", group: "A", score: 0.21, label: 0 },
  { id: "A8", group: "A", score: 0.12, label: 0 },
  { id: "B1", group: "B", score: 0.85, label: 0 },
  { id: "B2", group: "B", score: 0.62, label: 1 },
  { id: "B3", group: "B", score: 0.4, label: 0 },
  { id: "B4", group: "B", score: 0.18, label: 1 },
  { id: "C1", group: "C", score: 0.7, label: 0 },
  { id: "C2", group: "C", score: 0.33, label: 0 },
  { id: "C3", group: "C", score: 0.25, label: 0 },
];

// The same rows cut into requests: A's eight exposures came in two requests, B's four in two, C's three in one.
export const EXAMPLE_REQUEST: Record<string, string> = {
  A1: "A·r1", A2: "A·r1", A3: "A·r1", A4: "A·r1",
  A5: "A·r2", A6: "A·r2", A7: "A·r2", A8: "A·r2",
  B1: "B·r1", B2: "B·r1", B3: "B·r2", B4: "B·r2",
  C1: "C·r1", C2: "C·r1", C3: "C·r1",
};

export const byRequest = (rows: readonly Row[]): Row[] => rows.map((r) => ({ ...r, group: EXAMPLE_REQUEST[r.id] }));

// Real coverage numbers from kuairank (test tab 1, 988 users; random set, 1,000 users).
export const REAL_COVERAGE = {
  testTab1Users: 988,
  testTab1UsersInGauc: { click: 988, like: 864, follow: 572 },
  randomUsers: 1_000,
  randomUsersInGauc: { click: 849, like: 86, follow: 8 },
};

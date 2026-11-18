export const USERS = ["U1", "U2", "U3", "U4", "U5"];
export const ITEMS = ["A", "B", "C", "D"];
export const INTERACTIONS = [
  [1, 1, 0, 0],
  [1, 1, 1, 0],
  [1, 0, 1, 0],
  [0, 1, 0, 1],
  [0, 0, 1, 1],
];
export const U6 = [1, 1, 0, 0];
export type CfMode = "item" | "user";

export function itemVector(matrix: readonly number[][], index: number) {
  return matrix.map((row) => row[index]);
}

export function cosine(left: readonly number[], right: readonly number[]) {
  const shared = left.map((value, index) => value > 0 && right[index] > 0);
  const numerator = left.reduce((total, value, index) => total + value * right[index], 0);
  const leftNorm = Math.hypot(...left);
  const rightNorm = Math.hypot(...right);
  const denominator = leftNorm * rightNorm;
  return { shared, numerator, leftNorm, rightNorm, denominator, value: denominator ? numerator / denominator : 0 };
}

export function popularityWeight(count: number) {
  return 1 / Math.log1p(count);
}

type Neighbor = { index: number; weight: number };
type Path = { via: string; item: number; similarity: number; like: number };

function neighbors(vector: number[], vectors: number[][], exclude = -1): Neighbor[] {
  return vectors.map((other, index) => ({ index, weight: cosine(vector, other).value }))
    .filter(({ index, weight }) => index !== exclude && weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
}

export function buildToyIndexes() {
  const columns = ITEMS.map((_, i) => itemVector(INTERACTIONS, i));
  return {
    history: U6.flatMap((weight, index) => weight > 0 ? [{ index, weight }] : []),
    items: columns.map((column, index) => neighbors(column, columns, index)),
    users: neighbors(U6, INTERACTIONS),
    activities: INTERACTIONS.map((row) => row.flatMap((weight, index) => weight > 0 ? [{ index, weight }] : [])),
  };
}

export function scorePaths(paths: readonly Pick<Path, "similarity" | "like">[]) {
  return paths.reduce((total, path) => total + path.similarity * path.like, 0);
}

export function retrieveToy(mode: CfMode, n: number, k: number, m: number, indexes = buildToyIndexes()) {
  const first = mode === "item" ? indexes.history.slice(0, n) : indexes.users.slice(0, k);
  const lookups = first.map((entry) => {
    const entries = mode === "item" ? indexes.items[entry.index].slice(0, k) : indexes.activities[entry.index].slice(0, n);
    return { via: (mode === "item" ? ITEMS : USERS)[entry.index], entries, weight: entry.weight };
  });
  const paths: Path[] = lookups.flatMap(({ via, entries, weight }) => entries.map((entry) => ({
    via, item: entry.index,
    similarity: mode === "item" ? entry.weight : weight,
    like: mode === "item" ? weight : entry.weight,
  })));
  const unique = [...new Set(paths.map((entry) => entry.item))];
  const merged = unique.map((item) => ({
    item, score: scorePaths(paths.filter((entry) => entry.item === item)),
  })).sort((a, b) => b.score - a.score || a.item - b.item);
  return { lookups, paths, merged, selected: merged.filter(({ item }) => !U6[item]).slice(0, m) };
}

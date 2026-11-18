export type Vector = readonly [number, number];
export type Metric = "ip" | "l2" | "cosine";
export type Embeddings = { users: readonly Vector[]; items: readonly Vector[] };

export const INTEREST = [[4, 0, null, null], [1, null, 3, null], [null, 2, null, 1]];
export const ITEM_NAMES = ["A", "B", "C", "D"];
export const INITIAL_EMBEDDINGS: Embeddings = {
  users: [[0.8, 0.2], [0.3, 0.9], [0.5, 0.2]],
  items: [[1, 0.5], [1, 0.5], [0.35, 0.9], [-0.2, 0.6]],
};
export const OBSERVATIONS = INTEREST.flatMap((row, user) => row.flatMap((label, item) =>
  label === null ? [] : [{ user, item, label }],
));
export const LEARNING_RATE = 0.05;

export function dot(a: Vector, b: Vector) {
  return a[0] * b[0] + a[1] * b[1];
}

export function normalize(v: Vector): Vector {
  const length = Math.hypot(...v);
  return length > 0 ? [v[0] / length, v[1] / length] : v;
}

export function metricScore(a: Vector, b: Vector, metric: Metric): number | null {
  if (metric === "l2") return Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (metric === "ip") return dot(a, b);
  if (Math.hypot(...a) === 0 || Math.hypot(...b) === 0) return null;
  return dot(normalize(a), normalize(b));
}

export function sgdStep(model: Embeddings, { user, item, label }: typeof OBSERVATIONS[number]) {
  const a = model.users[user];
  const b = model.items[item];
  const before = dot(a, b);
  const error = 2 * (before - label);
  const gradA: Vector = [error * b[0], error * b[1]];
  const gradB: Vector = [error * a[0], error * a[1]];
  const nextA: Vector = [a[0] - LEARNING_RATE * gradA[0], a[1] - LEARNING_RATE * gradA[1]];
  const nextB: Vector = [b[0] - LEARNING_RATE * gradB[0], b[1] - LEARNING_RATE * gradB[1]];
  return {
    before, after: dot(nextA, nextB), gradA, gradB,
    model: {
      users: model.users.map((v, i) => i === user ? nextA : v),
      items: model.items.map((v, i) => i === item ? nextB : v),
    },
  };
}

export function observedMse(model: Embeddings) {
  return OBSERVATIONS.reduce((sum, { user, item, label }) =>
    sum + (label - dot(model.users[user], model.items[item])) ** 2, 0) / OBSERVATIONS.length;
}

export function exactTopK(model: Embeddings, user: number, k: number, eligible: (item: number) => boolean = () => true) {
  return model.items.flatMap((embedding, item) =>
    INTEREST[user][item] === null && eligible(item) ? [{ item, score: dot(model.users[user], embedding) }] : [],
  ).sort((a, b) => b.score - a.score || a.item - b.item).slice(0, k);
}

export const PARTITIONS: readonly Vector[] = [[-1.4, 0.8], [-0.5, -1.3], [0.65, 0.75], [1.45, -0.6]];
const OFFSETS: readonly Vector[] = [[-0.21, 0.12], [0.1, 0.25], [0.19, -0.16], [-0.3, -0.25], [0.36, 0.03], [-0.03, -0.32]];
export const ANN_ITEMS = PARTITIONS.flatMap(([x, y], bucket) => OFFSETS.map(([dx, dy], i) => ({
  id: bucket * OFFSETS.length + i + 1, bucket, vector: [x + dx, y + dy] as Vector,
})));
export const ANN_K = 5;

export function partitionSearch(query: Vector, budget: number) {
  const partitions = PARTITIONS.map((center, bucket) => ({ bucket, score: dot(query, center) }))
    .sort((a, b) => b.score - a.score || a.bucket - b.bucket)
    .slice(0, budget).map(({ bucket }) => bucket);
  const visited = ANN_ITEMS.filter(({ bucket }) => partitions.includes(bucket));
  const top = (items: typeof ANN_ITEMS) => items.map(({ id, vector }) => ({ id, score: dot(query, vector) }))
    .sort((a, b) => b.score - a.score || a.id - b.id).slice(0, ANN_K).map(({ id }) => id);
  const exact = top(ANN_ITEMS);
  const approximate = top(visited);
  const hits = approximate.filter((id) => exact.includes(id)).length;
  return { partitions, visited, exact, approximate, hits, recall: hits / ANN_K };
}

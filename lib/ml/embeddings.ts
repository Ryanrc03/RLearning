// Pure helpers for the Representations chapter: Word2Vec window pairs, BERT-style
// pooling and the cosine-similarity geometry. No React here; every number a figure
// shows comes from these functions (see tests/embeddings.test.ts). Cosine and dot
// product are reused from lib/ml/clip.ts.

import { cosineSimilarity, dot } from "./clip";

// ---------- Word2Vec: the sentence from the notes ----------

export const TOKENS: readonly string[] = ["we", "are", "about", "to", "study", "the", "idea"];

/** Vocabulary index of a word (the sentence has no repeated words, so vocab = tokens). */
export function vocabIndex(word: string, vocab: readonly string[] = TOKENS): number {
  const i = vocab.indexOf(word.toLowerCase());
  if (i < 0) throw new RangeError(`unknown word: ${word}`);
  return i;
}

/** Positions inside the window around the centre, clipped at the sentence edges. */
export function contextIndices(tokens: readonly string[], centreIdx: number, window: number): number[] {
  if (centreIdx < 0 || centreIdx >= tokens.length) throw new RangeError(`centre ${centreIdx} out of range`);
  const out: number[] = [];
  for (let i = Math.max(0, centreIdx - window); i <= Math.min(tokens.length - 1, centreIdx + window); i++) {
    if (i !== centreIdx) out.push(i);
  }
  return out;
}

export type WindowPairs = {
  /** CBOW: all context words predict the centre word. */
  cbow: { context: string[]; target: string };
  /** Skip-gram: the centre word predicts each context word, one pair per context word. */
  skipgram: [string, string][];
};

export function windowPairs(tokens: readonly string[], centreIdx: number, window: number): WindowPairs {
  const centre = tokens[centreIdx];
  const context = contextIndices(tokens, centreIdx, window).map((i) => tokens[i]);
  return {
    cbow: { context, target: centre },
    skipgram: context.map((w) => [centre, w] as [string, string]),
  };
}

/** Words of the sentence outside the window: the label-0 side of negative sampling. */
export function negativeWords(tokens: readonly string[], centreIdx: number, window: number): string[] {
  const inside = new Set([centreIdx, ...contextIndices(tokens, centreIdx, window)]);
  return tokens.filter((_, i) => !inside.has(i));
}

export function oneHot(index: number, size: number): number[] {
  if (index < 0 || index >= size) throw new RangeError(`index ${index} out of range for size ${size}`);
  const v = new Array<number>(size).fill(0);
  v[index] = 1;
  return v;
}

/** CBOW input: the mean of the context one-hots, 1/n at each context position. */
export function averageOneHots(indices: number[], vocabSize: number): number[] {
  if (indices.length === 0) throw new RangeError("need at least one context word");
  const v = new Array<number>(vocabSize).fill(0);
  for (const i of indices) {
    if (i < 0 || i >= vocabSize) throw new RangeError(`index ${i} out of range for size ${vocabSize}`);
    v[i] += 1 / indices.length;
  }
  return v;
}

// ---------- Sentence embedding: [CLS] I really like Adobe [SEP] ----------

export const SENTENCE_TOKENS: readonly string[] = ["[CLS]", "I", "really", "like", "Adobe", "[SEP]"];

export function isSpecialToken(token: string): boolean {
  return token === "[CLS]" || token === "[SEP]";
}

/** true for the tokens that stay in the mean when the special tokens are excluded. */
export function contentMask(tokens: readonly string[]): boolean[] {
  return tokens.map((t) => !isSpecialToken(t));
}

// Hand-made teaching values (6 tokens × 6 dims), not outputs of a real BERT. Chosen so the
// hand-computed averages are tidy: the all-token mean is [0.3, 0.3, 0.5/6, 1.6/6, 1.3/6, −0.2/6],
// the content-only mean is [0.3, 0.425, 0.05, 0.3, 0.325, −0.075].
export const DEMO_HIDDEN: readonly (readonly number[])[] = [
  [0.4, 0.5, 0.0, 0.4, 0.3, -0.1], // [CLS]
  [0.1, 0.3, -0.2, 0.5, 0.2, -0.1], // I
  [0.5, 0.7, -0.4, 0.3, 0.6, -0.3], // really
  [0.8, 0.6, -0.1, 0.7, 0.4, -0.5], // like
  [-0.2, 0.1, 0.9, -0.3, 0.1, 0.6], // Adobe
  [0.2, -0.4, 0.3, 0.0, -0.3, 0.2], // [SEP]
];

/** A toy sentiment head on top of the pooled vector: logit = w · h + b. */
export const DEMO_CLASSIFIER = { w: [1.2, 0.8, 0.6, 1.0, 0.5, 0.4], b: -0.5 } as const;

/** The vector at position 0, i.e. the [CLS] token's hidden state (copied). */
export function clsPool(vectors: readonly (readonly number[])[]): number[] {
  if (vectors.length === 0) throw new RangeError("no vectors to pool");
  return [...vectors[0]];
}

/** Dimension-wise mean of the vectors whose mask entry is true (all of them by default). */
export function meanPool(vectors: readonly (readonly number[])[], mask?: readonly boolean[]): number[] {
  const kept = vectors.filter((_, i) => (mask ? mask[i] : true));
  if (kept.length === 0) throw new RangeError("mask keeps no vectors");
  const d = kept[0].length;
  const out = new Array<number>(d).fill(0);
  for (const v of kept) {
    if (v.length !== d) throw new Error("dimension mismatch");
    for (let j = 0; j < d; j++) out[j] += v[j] / kept.length;
  }
  return out;
}

/** Weight each token carries in the pooled vector: 1/n for kept tokens under mean pooling, 1 for [CLS] under CLS pooling. */
export function poolingWeights(count: number, mode: "cls" | "mean", mask?: readonly boolean[]): number[] {
  if (mode === "cls") return Array.from({ length: count }, (_, i) => (i === 0 ? 1 : 0));
  const kept = Array.from({ length: count }, (_, i) => (mask ? mask[i] : true));
  const n = kept.filter(Boolean).length;
  if (n === 0) throw new RangeError("mask keeps no vectors");
  return kept.map((k) => (k ? 1 / n : 0));
}

export function classifierLogit(h: readonly number[], w: readonly number[], b: number): number {
  return dot([...h], [...w]) + b;
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ---------- Cosine similarity geometry ----------

export function norm(v: readonly number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

/** Angle between two vectors in degrees, 0 … 180. */
export function angleBetweenDeg(a: readonly number[], b: readonly number[]): number {
  const c = Math.max(-1, Math.min(1, cosineSimilarity([...a], [...b])));
  return (Math.acos(c) * 180) / Math.PI;
}

/** A 2-D vector of the given length pointing at `deg` degrees counter-clockwise from +x. */
export function fromPolar(len: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  return [len * Math.cos(r), len * Math.sin(r)];
}

/** Direction of a 2-D vector in degrees, 0 … 360. */
export function toDeg(v: readonly [number, number]): number {
  const d = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
}

/** The fixed vector A of the cosine figure: length 0.9 at 20°. */
export const VECTOR_A: [number, number] = fromPolar(0.9, 20);

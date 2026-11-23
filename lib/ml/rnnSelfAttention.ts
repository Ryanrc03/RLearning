// LLMs, "Attention (II)": a SimpleRNN whose next state reads a context built
// from its own earlier hidden states. h_t = tanh(A [x_t; c_{t−1}] + b),
// c_t = Σ_{i≤t} α_{t,i} h_i. No React here; see tests/rnn-self-attention.test.ts.

import { attentionWeights, contextVector, scoresFromWeights } from "./bahdanau";

export const SENTENCE = ["The", "FBI", "is", "chasing", "a", "criminal"] as const;

/** The constructed scores of the note's c_2 example: [e_{2,1}, e_{2,2}]. Not a model's output. */
export const C2_EXAMPLE_SCORES = [1.2, 0.4];

/** Number of history states that c_t summarises: h_1 … h_t. */
export function historyLength(t: number): number {
  return Math.max(0, t);
}

/** Alignment scores computed over a sequence of length n: 0 + 1 + … + (n − 1). */
export function scoreCount(n: number): number {
  return (n * (n - 1)) / 2;
}

/**
 * Simulated weights for reading SENTENCE, keyed by the 1-based index t of the
 * token being read. The row is α_{t−1,·}: it covers h_1 … h_{t−1} and sums to 1.
 * Teaching values, not the output of a trained model.
 */
export const READING_WEIGHTS: Record<number, number[]> = {
  3: [0.3, 0.7],
  4: [0.1, 0.7, 0.2],
  5: [0.05, 0.25, 0.15, 0.55],
  6: [0.04, 0.2, 0.1, 0.55, 0.11],
};

export const READING_STEPS = [3, 4, 5, 6] as const;

export type ReadingStep = {
  /** 1-based index of the token being read. */
  t: number;
  token: string;
  /** Tokens whose hidden states are already available: positions 1 … t − 1. */
  history: string[];
  weights: number[];
  /** Scores with mean 0 whose softmax is exactly `weights`. */
  scores: number[];
  /** Index (0-based) of the history position with the largest weight. */
  top: number;
};

export function readingStep(t: number): ReadingStep {
  const weights = READING_WEIGHTS[t];
  if (!weights) throw new Error(`no simulated weights for t = ${t}`);
  return {
    t,
    token: SENTENCE[t - 1],
    history: SENTENCE.slice(0, t - 1),
    weights,
    scores: scoresFromWeights(weights),
    top: weights.indexOf(Math.max(...weights)),
  };
}

export type SimpleRnnParams = {
  /** A, shape [hidden][input + hidden]: applied to the concatenation [x_t; c_{t−1}]. */
  a: number[][];
  /** b, length hidden. */
  b: number[];
};

/** One state update of the classroom model: h_t = tanh(A [x_t; c_{t−1}] + b). */
export function rnnStep(p: SimpleRnnParams, x: number[], cPrev: number[]): number[] {
  const input = [...x, ...cPrev];
  return p.a.map((row, k) => Math.tanh(row.reduce((acc, w, d) => acc + w * input[d], 0) + p.b[k]));
}

export type UnrolledStep = {
  t: number;
  /** c_{t−1}, the context this step reads. */
  cPrev: number[];
  h: number[];
  /** α_{t,·} over h_1 … h_t, used to build c_t for the next step. */
  weights: number[];
  /** c_t. */
  c: number[];
};

/**
 * Unrolls the model over `xs`. `score(query, key)` is any alignment function;
 * the same one is used at every step and for every history position. c_0 is
 * the zero vector, and c_t never reads a state later than h_t.
 */
export function unroll(p: SimpleRnnParams, xs: number[][], score: (hCurrent: number[], hPast: number[]) => number): UnrolledStep[] {
  const hidden = p.b.length;
  const states: number[][] = [];
  const steps: UnrolledStep[] = [];
  let cPrev = new Array<number>(hidden).fill(0);
  xs.forEach((x, idx) => {
    const h = rnnStep(p, x, cPrev);
    states.push(h);
    const weights = attentionWeights(states.map((past) => score(h, past)));
    const c = contextVector(weights, states);
    steps.push({ t: idx + 1, cPrev, h, weights, c });
    cPrev = c;
  });
  return steps;
}

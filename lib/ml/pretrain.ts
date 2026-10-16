// LLMs, page 6: what the loss sums over during pre-training. Autoregressive
// (GPT) terms, masked-LM (BERT) terms, the next-sentence binary term, and the
// visible context at each position derived from the attention masks.
// Pure functions, no React; see tests/pretrain.test.ts.

import { buildBidirectionalMask, buildCausalMask } from "@/lib/ml/attention";

export const DEMO_SENTENCE: string[] = ["我", "今天", "很", "想", "吃", "火锅"];

/**
 * Toy probabilities the model assigns to the right token.
 * `causal[t]` = P(x_t | x_<t) for GPT; `masked[t]` = P(x_t | x_masked) for BERT,
 * only meaningful at the masked positions (both sides visible, so sharper).
 */
export const DEMO_PROBS: { causal: number[]; masked: number[] } = {
  causal: [0.2, 0.35, 0.5, 0.4, 0.65, 0.85],
  masked: [0.3, 0.55, 0.6, 0.5, 0.92, 0.9],
};

/** Positions replaced by [MASK] in the demo (2 of 6; the real recipe picks 15 % at random). */
export const MASKED_IDX: number[] = [1, 4];

/** The next-sentence pair the demo's [CLS] judges: p = P(IsNext), y = 1 means it really is the next sentence. */
export const DEMO_NSP = { p: 0.9, y: 1 as 0 | 1 };

export type LossTerm = { pos: number; p: number; term: number };
export type LossTerms = { terms: LossTerm[]; total: number };

const nll = (p: number) => {
  if (!(p > 0 && p <= 1)) throw new Error(`probability out of range: ${p}`);
  return -Math.log(p);
};

/** L = −Σ_t log P(x_t | x_<t): one term per position. */
export function causalLossTerms(probs: number[]): LossTerms {
  const terms = probs.map((p, pos) => ({ pos, p, term: nll(p) }));
  return { terms, total: terms.reduce((s, t) => s + t.term, 0) };
}

/** L = −Σ_{i ∈ masked} log P(x_i | x_masked): only the masked positions contribute. */
export function maskedLossTerms(probs: number[], maskedIdx: number[]): LossTerms {
  const terms = [...maskedIdx].sort((a, b) => a - b).map((pos) => ({ pos, p: probs[pos], term: nll(probs[pos]) }));
  return { terms, total: terms.reduce((s, t) => s + t.term, 0) };
}

/** Binary cross-entropy of the next-sentence head: −y log p − (1 − y) log(1 − p). */
export function nspTerm(p: number, y: 0 | 1): number {
  if (!(p > 0 && p < 1)) throw new Error(`probability out of range: ${p}`);
  return -y * Math.log(p) - (1 - y) * Math.log(1 - p);
}

export type Objective = "causal" | "masked";

/**
 * Which tokens position t may read while predicting. GPT: the input is
 * [BOS] + tokens, so predicting token t means reading input positions ≤ t,
 * i.e. tokens j < t (row t of the causal mask over T + 1 inputs). BERT: the
 * bidirectional mask lets every position read every other, [MASK] included.
 */
export function visibleTokens(kind: Objective, T: number, t: number): boolean[] {
  if (kind === "causal") {
    const row = buildCausalMask(T + 1)[t];
    return Array.from({ length: T }, (_, j) => row[j + 1] === 0);
  }
  const row = buildBidirectionalMask(T)[t];
  return row.map((m) => m === 0);
}

/** The strip the model actually sees under each objective. */
export function inputTokens(kind: Objective, sentence: string[], maskedIdx: number[]): string[] {
  if (kind === "causal") return ["[BOS]", ...sentence];
  return ["[CLS]", ...sentence.map((tok, i) => (maskedIdx.includes(i) ? "[MASK]" : tok))];
}

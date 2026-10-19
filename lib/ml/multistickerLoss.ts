// The MultiSticker training objective on one query, made concrete. The real
// model scores one query against all 6,758 stickers; here the 6,757 negatives
// are a seeded stand-in (cosine similarities ~ N(0.20, 0.05)) so the page can
// show how the full-bank softmax cross-entropy, its gradient and the intent
// auxiliary loss behave as the gold sticker's similarity moves.
// No React here; see tests/multisticker-loss.test.ts.

import { clamp, createRng, randomNormal } from "./random";

export const MS_TAU = 0.07;
export const MS_BANK = 6_758;
export const MS_INTENT_WEIGHT = 0.2;

export function stickerNegatives(n = MS_BANK - 1, seed = 646, mean = 0.2, sd = 0.05): number[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => clamp(randomNormal(rng, mean, sd), -1, 1));
}

function logSumExp(xs: readonly number[]): number {
  const m = Math.max(...xs);
  let s = 0;
  for (const x of xs) s += Math.exp(x - m);
  return m + Math.log(s);
}

export type RetrievalLoss = {
  goldLogit: number;
  logZ: number;
  pGold: number;
  loss: number;
  rank: number;
  /** ∂L/∂s_gold = (p_gold − 1)/τ: how hard the gold similarity is pulled up. */
  gradGold: number;
  /** Share of the total push on negatives that lands on the 10 most similar ones. */
  top10Share: number;
  /** p of the single hardest negative. */
  pHardest: number;
};

// L = −log softmax(s/τ)_gold over the gold sticker and every negative.
export function retrievalLoss(goldSim: number, negatives: readonly number[], tau = MS_TAU): RetrievalLoss {
  const logits = [goldSim / tau, ...negatives.map((s) => s / tau)];
  const logZ = logSumExp(logits);
  const goldLogit = logits[0];
  const pGold = Math.exp(goldLogit - logZ);
  const negP = logits.slice(1).map((z) => Math.exp(z - logZ)).sort((a, b) => b - a);
  const negTotal = negP.reduce((a, b) => a + b, 0);
  const rank = 1 + negatives.filter((s) => s > goldSim).length;
  return {
    goldLogit,
    logZ,
    pGold,
    loss: logZ - goldLogit,
    rank,
    gradGold: (pGold - 1) / tau,
    top10Share: negTotal === 0 ? 0 : negP.slice(0, 10).reduce((a, b) => a + b, 0) / negTotal,
    pHardest: negP[0] ?? 0,
  };
}

/** Loss of a model that ranks uniformly at random: log(bank size). */
export function uniformLoss(bank = MS_BANK): number {
  return Math.log(bank);
}

/** Probability the logged average loss corresponds to: p = e^(−L). */
export function lossToProb(loss: number): number {
  return Math.exp(-loss);
}

// The auxiliary intent loss for one query: −log p(gold sticker's intent group).
export function intentLoss(pGroup: number): number {
  return -Math.log(pGroup);
}

export function totalLoss(retrieval: number, intent: number, weight = MS_INTENT_WEIGHT): number {
  return retrieval + weight * intent;
}

// LoRA on one linear layer W (out × in): h = W x + (α / r) · B A x.
export function loraLayer(outDim: number, inDim: number, r: number, alpha: number) {
  const frozen = outDim * inDim;
  const trainable = r * (inDim + outDim);
  return { frozen, trainable, share: trainable / frozen, scale: alpha / r };
}

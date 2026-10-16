// Temperature sampling for the Hallucination page: one fixed logit vector over a
// ten-word vocabulary, softmax(z / T), and seeded draws. Pure functions, no React;
// see tests/sampling.test.ts.

import { softmax } from "@/lib/ml/clip";
import type { Rng } from "@/lib/ml/random";

export type Candidate = { text: string; logit: number; acceptable: boolean };

// The prompt "珠穆朗玛峰的海拔是" and ten candidate next tokens. 8848 is the
// classic figure and 8849 the 2020 re-measurement rounded; everything else is
// a number that looks like an altitude but is wrong.
export const DEMO_LOGITS: { prompt: string; unit: string; tokens: Candidate[] } = {
  prompt: "珠穆朗玛峰的海拔是",
  unit: "米",
  tokens: [
    { text: "8848", logit: 6.0, acceptable: true },
    { text: "8849", logit: 4.5, acceptable: true },
    { text: "8800", logit: 3.5, acceptable: false },
    { text: "8000", logit: 2.5, acceptable: false },
    { text: "9000", logit: 2.0, acceptable: false },
    { text: "7000", logit: 0.5, acceptable: false },
    { text: "10000", logit: 0.0, acceptable: false },
    { text: "5000", logit: -0.5, acceptable: false },
    { text: "6000", logit: -0.5, acceptable: false },
    { text: "3000", logit: -1.5, acceptable: false },
  ],
};

// p_i = exp(z_i / T) / Σ_j exp(z_j / T). T → 0 approaches argmax, T → ∞ approaches uniform.
export function softmaxTemperature(logits: number[], T: number): number[] {
  if (!(T > 0)) throw new Error("temperature must be > 0");
  return softmax(logits.map((z) => z / T));
}

// Draw n tokens by inverse CDF; returns how many times each index came up.
export function sampleTokens(rng: Rng, probs: number[], n: number): number[] {
  const counts = probs.map(() => 0);
  for (let k = 0; k < n; k++) {
    const u = rng();
    let acc = 0;
    let picked = probs.length - 1;
    for (let i = 0; i < probs.length; i++) {
      acc += probs[i];
      if (u < acc) {
        picked = i;
        break;
      }
    }
    counts[picked] += 1;
  }
  return counts;
}

// Probability mass on the tokens the mask marks acceptable.
export function acceptableMass(probs: number[], acceptable: boolean[]): number {
  return probs.reduce((sum, p, i) => sum + (acceptable[i] ? p : 0), 0);
}

// How many of the drawn samples landed on a token the mask rejects.
export function wrongCount(counts: number[], acceptable: boolean[]): number {
  return counts.reduce((sum, c, i) => sum + (acceptable[i] ? 0 : c), 0);
}

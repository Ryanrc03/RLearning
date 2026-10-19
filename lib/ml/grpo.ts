// GRPO's group-relative advantage: sample G answers to one prompt, score each
// with a verifiable 0/1 reward, and centre/scale the rewards inside the group.
// No React here; see tests/grpo.test.ts.

import { createRng } from "./random";

export type GroupStats = { mean: number; std: number; advantages: number[] };

// Population std (divide by G), as in the DeepSeekMath formulation. When every
// reward in the group is the same, std is 0 and every advantage is 0: the group
// carries no learning signal. eps only guards the division.
export function groupAdvantages(rewards: readonly number[], eps = 1e-6): GroupStats {
  const g = rewards.length;
  if (g === 0) return { mean: 0, std: 0, advantages: [] };
  const mean = rewards.reduce((a, b) => a + b, 0) / g;
  const variance = rewards.reduce((a, r) => a + (r - mean) ** 2, 0) / g;
  const std = Math.sqrt(variance);
  const advantages = rewards.map((r) => (std < eps ? 0 : (r - mean) / (std + eps)));
  return { mean, std, advantages };
}

// Probability that a prompt the policy solves with probability p gives an
// all-correct or all-wrong group of size G, i.e. zero gradient.
export function zeroSignalProbability(p: number, g: number): number {
  return p ** g + (1 - p) ** g;
}

export type Difficulty = "easy" | "medium" | "hard";

// Per-difficulty solve rate and seed. The seeds are chosen (see the tests) so
// the first few answers of the easy prompt are all correct and of the hard
// prompt all wrong; a larger G then has to rescue the signal.
export const GRPO_PROMPTS: Record<Difficulty, { p: number; seed: number; label: string }> = {
  easy: { p: 0.85, seed: 8, label: "简单题（会做 85%）" },
  medium: { p: 0.5, seed: 2, label: "中等题（会做 50%）" },
  hard: { p: 0.12, seed: 9, label: "难题（会做 12%）" },
};

export const G_MAX = 16;

// Draws G_MAX Bernoulli(p) rewards once; a group of size G is the first G of
// them, so moving the G slider adds answers instead of redrawing the group.
export function sampleRewards(p: number, seed: number, count = G_MAX): number[] {
  const rng = createRng(seed);
  // Park–Miller's first outputs from a small seed are tiny; burn a few in.
  for (let i = 0; i < 4; i++) rng();
  return Array.from({ length: count }, () => (rng() < p ? 1 : 0));
}

// Smallest G (≥ 2) at which the seeded group first contains both a right and a
// wrong answer; G_MAX + 1 if it never does within G_MAX draws.
export function firstMixedG(rewards: readonly number[]): number {
  for (let g = 2; g <= rewards.length; g++) {
    const head = rewards.slice(0, g);
    if (head.some((r) => r === 1) && head.some((r) => r === 0)) return g;
  }
  return rewards.length + 1;
}

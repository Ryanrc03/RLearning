// A toy policy trained against two reward designs, to show reward hacking.
// The policy has two knobs: `skill` (how well it actually reasons) and
// `length` (tokens per answer). Skill is hard to move, length is cheap.
// Accuracy depends on both: some reasoning helps, rambling past the useful
// length dilutes it, and running past the generation limit truncates the
// final answer. No React here; see tests/reward-hacking.test.ts.

import { createRng, randomNormal } from "./random";

export type RewardScheme = "additive" | "gated";

export const HACK = {
  /** Length at which extra reasoning stops helping. */
  usefulLength: 300,
  /** Generation limit; answers longer than this lose their final line. */
  maxLength: 1024,
  /** Tokens over which truncation goes from rare to common. */
  truncSoftness: 250,
  /** Bonus per 1000 tokens in both schemes. */
  alpha: 1.0,
  /** The gated scheme stops paying for length past this. */
  cap: 400,
  bias: -1.4,
  reasonWeight: 1.6,
  startSkill: 0,
  startLength: 120,
  /** Distance the policy may move per step in (skill, log length), a stand-in for the PPO clip / KL trust region. */
  stepSize: 0.02,
  steps: 300,
  batch: 64,
  seed: 568,
} as const;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

// How much the reasoning length helps: rises to 1 at usefulLength, then decays.
export function reasoningBenefit(length: number): number {
  const u = Math.max(0, length) / HACK.usefulLength;
  return u * Math.exp(1 - u);
}

// Probability that the final answer is correct (what we actually want).
export function trueAccuracy(skill: number, length: number): number {
  const reasoned = sigmoid(HACK.bias + skill + HACK.reasonWeight * reasoningBenefit(length));
  const notTruncated = sigmoid((HACK.maxLength - length) / HACK.truncSoftness);
  return reasoned * notTruncated;
}

// Reward for one answer with correctness c ∈ {0, 1} and the given length.
// additive: correctness + α·length — length pays whether or not the answer is right.
// gated:    correctness · (1 + α·min(length, cap)) — length pays only on a right answer, and only up to cap.
export function answerReward(scheme: RewardScheme, correct: number, length: number): number {
  if (scheme === "additive") return correct + (HACK.alpha * length) / 1000;
  return correct * (1 + (HACK.alpha * Math.min(length, HACK.cap)) / 1000);
}

export function expectedReward(scheme: RewardScheme, skill: number, length: number): number {
  return answerReward(scheme, trueAccuracy(skill, length), length);
}

export type TrainPoint = {
  step: number;
  skill: number;
  length: number;
  /** Expected accuracy of the policy at this step. */
  accuracy: number;
  /** Mean reward on this step's sampled batch (what the training log shows). */
  reward: number;
  /** Accuracy measured on the same batch. */
  batchAccuracy: number;
  usefulTokens: number;
  fillerTokens: number;
};

// Gradient ascent on expected reward with respect to (skill, log length), with
// seeded noise standing in for policy-gradient variance. Each step also draws a
// batch of answers so the logged reward and accuracy wiggle like a real run.
export function simulateTraining(scheme: RewardScheme, steps: number = HACK.steps, seed: number = HACK.seed): TrainPoint[] {
  const rng = createRng(seed);
  let skill: number = HACK.startSkill;
  let logLen = Math.log(HACK.startLength);
  const h = 1e-4;
  const out: TrainPoint[] = [];
  for (let step = 0; step <= steps; step++) {
    const length = Math.exp(logLen);
    const accuracy = trueAccuracy(skill, length);
    let right = 0;
    let rewardSum = 0;
    for (let i = 0; i < HACK.batch; i++) {
      const c = rng() < accuracy ? 1 : 0;
      const len = Math.max(1, length * (1 + 0.15 * randomNormal(rng)));
      right += c;
      rewardSum += answerReward(scheme, c, len);
    }
    out.push({
      step,
      skill,
      length,
      accuracy,
      reward: rewardSum / HACK.batch,
      batchAccuracy: right / HACK.batch,
      usefulTokens: Math.min(length, HACK.usefulLength),
      fillerTokens: Math.max(0, length - HACK.usefulLength),
    });
    if (step === steps) break;
    const r = (s: number, l: number) => expectedReward(scheme, s, Math.exp(l));
    const gSkill = (r(skill + h, logLen) - r(skill - h, logLen)) / (2 * h);
    const gLen = (r(skill, logLen + h) - r(skill, logLen - h)) / (2 * h);
    // The step has a fixed size, so whichever knob pays more takes the budget.
    const norm = Math.hypot(gSkill, gLen) || 1;
    skill += (HACK.stepSize * gSkill * (1 + 0.2 * randomNormal(rng))) / norm;
    logLen += (HACK.stepSize * gLen * (1 + 0.2 * randomNormal(rng))) / norm;
    // Keep the toy bounded: past 1.5× the limit every answer is cut anyway.
    logLen = Math.min(logLen, Math.log(1.5 * HACK.maxLength));
  }
  return out;
}

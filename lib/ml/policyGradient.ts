// One policy-gradient update on a toy policy, to show how θ actually moves.
// The "LLM" answers "2 + 3 = ?" with one of three tokens; its parameters are
// three logits and π = softmax(θ). For a softmax policy the gradient of
// log π(a) with respect to the logits is onehot(a) − π, so one update is
//   θ ← θ + lr · (1/G) Σ w_i · (onehot(a_i) − π)
// where w_i is the reward (REINFORCE), the reward minus the group mean
// (baseline), or that divided by the group std (GRPO).
// No React here; see tests/policy-gradient.test.ts.

export const PG_ANSWERS = ["5", "6", "4"] as const;
export const PG_CORRECT = 0;

export type PgMode = "reinforce" | "baseline" | "grpo";
export type PgSample = { answer: number; reward: number };

export function softmax(logits: readonly number[]): number[] {
  const m = Math.max(...logits);
  const e = logits.map((z) => Math.exp(z - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

// The weight each sampled answer's log-prob gradient is multiplied by.
export function sampleWeights(rewards: readonly number[], mode: PgMode, eps = 1e-6): number[] {
  if (mode === "reinforce") return [...rewards];
  const g = rewards.length;
  const mean = rewards.reduce((a, b) => a + b, 0) / g;
  if (mode === "baseline") return rewards.map((r) => r - mean);
  const std = Math.sqrt(rewards.reduce((a, r) => a + (r - mean) ** 2, 0) / g);
  return rewards.map((r) => (std < eps ? 0 : (r - mean) / std));
}

export type PgStep = {
  probsBefore: number[];
  weights: number[];
  /** w_i · (onehot(a_i) − π), one logit-gradient vector per sample. */
  pushes: number[][];
  /** Mean of the pushes: the gradient ascent direction on the logits. */
  grad: number[];
  logitsAfter: number[];
  probsAfter: number[];
  /** ‖Δθ‖₂, how far one step moved the parameters. */
  stepNorm: number;
};

export function policyGradientStep(logits: readonly number[], samples: readonly PgSample[], mode: PgMode, lr = 1): PgStep {
  const k = logits.length;
  const probsBefore = softmax(logits);
  const weights = sampleWeights(samples.map((s) => s.reward), mode);
  const pushes = samples.map((s, i) => Array.from({ length: k }, (_, j) => weights[i] * ((j === s.answer ? 1 : 0) - probsBefore[j])));
  const grad = Array.from({ length: k }, (_, j) => pushes.reduce((a, p) => a + p[j], 0) / samples.length);
  const logitsAfter = logits.map((z, j) => z + lr * grad[j]);
  const stepNorm = Math.sqrt(grad.reduce((a, g) => a + (lr * g) ** 2, 0));
  return { probsBefore, weights, pushes, grad, logitsAfter, probsAfter: softmax(logitsAfter), stepNorm };
}

// PPO / GRPO's clipped surrogate for one sample: ρ = π_new / π_old. When ρ has
// already moved past 1 ± ε in the direction the advantage wants, the min()
// picks the clipped branch and this sample stops contributing gradient.
export function clipStatus(ratio: number, advantage: number, eps = 0.2): "clipped" | "active" {
  if (advantage > 0 && ratio > 1 + eps) return "clipped";
  if (advantage < 0 && ratio < 1 - eps) return "clipped";
  return "active";
}

export type PgPreset = "binary" | "score";

// Four sampled answers with the same tokens; only the reward scale differs.
// "score" uses the handwritten-note example: one answer scores 95 against a
// group average of 92.
export const PG_PRESETS: Record<PgPreset, { label: string; samples: PgSample[] }> = {
  binary: {
    label: "对错奖励 0 / 1",
    samples: [
      { answer: 0, reward: 1 },
      { answer: 1, reward: 0 },
      { answer: 0, reward: 1 },
      { answer: 2, reward: 0 },
    ],
  },
  score: {
    label: "打分奖励（满分 100）",
    samples: [
      { answer: 0, reward: 95 },
      { answer: 1, reward: 90 },
      { answer: 0, reward: 93 },
      { answer: 2, reward: 90 },
    ],
  },
};

export const PG_START_LOGITS = [0, 0, 0];

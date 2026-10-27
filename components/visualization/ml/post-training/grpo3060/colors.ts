import type { ModelKey } from "@/lib/ml/grpo3060";

// One color per model across every figure of the 3060 project note:
// grey = untouched, green = SFT, orange = the run that got hacked
// (light at its step-200 peak), blue = the fixed run.
export const MODEL_COLOR: Record<ModelKey, string> = {
  instruct: "#9a9c8d",
  sft: "var(--v3)",
  base200: "#f4a37f",
  base500: "var(--v2)",
  fixed500: "var(--v1)",
};

export const RUN_COLOR = { base: "var(--v2)", fixed: "var(--v1)" } as const;

// Inside the training-curve panels the colors mean the reward component instead.
export const CURVE_COLOR = {
  correct: "var(--v1)",
  format: "var(--v2)",
  reward: "#3b4234",
  len: "var(--v3)",
  kl: "#b8860b",
} as const;

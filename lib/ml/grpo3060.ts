// Derived views of the real GRPO runs in grpo3060Data.ts: series for the
// training-curve figure, first-vs-last summaries, the checkpoint peak, and the
// length distributions the KL page compares. No React here; see tests/grpo3060.test.ts.

import type { Localized } from "@/lib/i18n";
import { GRPO3060, type ModelKey, type RunKey } from "./grpo3060Data";
import { klDivergence, klTerms, smoothCounts } from "./klDivergence";

export { GRPO3060 };
export type { ModelKey, RunKey };

export const RUN_LABEL: Record<RunKey, Localized> = {
  base: { zh: "第一轮：base reward，β = 0", en: "First run: base reward, β = 0" },
  fixed: { zh: "修正版：β = 0.04 + Dr. GRPO + 门控格式分", en: "Fixed run: β = 0.04 + Dr. GRPO + gated format reward" },
};

export const MODEL_LABEL: Record<ModelKey, Localized> = {
  instruct: { zh: "Instruct（未训练）", en: "Instruct (untrained)" },
  sft: { zh: "SFT · 1 epoch", en: "SFT · 1 epoch" },
  base200: { zh: "GRPO 第一轮 · 200 步", en: "GRPO first run · 200 steps" },
  base500: { zh: "GRPO 第一轮 · 500 步", en: "GRPO first run · 500 steps" },
  fixed500: { zh: "GRPO 修正版 · 500 步", en: "GRPO fixed run · 500 steps" },
};

export type CurveKey = "reward" | "correct" | "int" | "strict" | "soft" | "xml" | "len" | "kl";
type Curves = (typeof GRPO3060.curves)[RunKey];

/** Number of 10-step bins in each run (500 steps → 50). */
export const BINS = GRPO3060.curves.base.step.length;

function curves(run: RunKey): Curves {
  return GRPO3060.curves[run];
}

/** Sum of the four format terms (int, strict, soft, xml count) at bin i. */
export function formatReward(run: RunKey, i: number): number {
  const c = curves(run);
  return c.int[i] + c.strict[i] + c.soft[i] + c.xml[i];
}

/** [step, value] pairs for one logged curve, or for the summed format reward. */
export function series(run: RunKey, key: CurveKey | "format"): [number, number][] {
  const c = curves(run);
  return c.step.map((s, i) => [s, key === "format" ? formatReward(run, i) : c[key][i]]);
}

/** Value of a curve at bin i. */
export function valueAt(run: RunKey, key: CurveKey | "format", i: number): number {
  return key === "format" ? formatReward(run, i) : curves(run)[key][i];
}

/** Trailing mean over the last `window` bins ending at bin i (fewer at the start); 5 bins = 50 steps. */
export function smoothedAt(run: RunKey, key: CurveKey | "format", i: number, window = 5): number {
  const from = Math.max(0, i - window + 1);
  return meanOver(run, key, from, i + 1);
}

/** [step, trailing mean] pairs, the bold line drawn over the raw 10-step bins. */
export function smoothedSeries(run: RunKey, key: CurveKey | "format", window = 5): [number, number][] {
  return curves(run).step.map((s, i) => [s, smoothedAt(run, key, i, window)]);
}

/** Mean of a curve over bins [from, to). */
export function meanOver(run: RunKey, key: CurveKey | "format", from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += valueAt(run, key, i);
  return s / (to - from);
}

export type Trend = { first: number; last: number; delta: number };

/** First 10% of training vs last 10% (5 bins of 10 steps each), the slices the diagnostic script compares. */
export function trend(run: RunKey, key: CurveKey | "format"): Trend {
  const k = Math.max(1, Math.round(BINS * 0.1));
  const first = meanOver(run, key, 0, k);
  const last = meanOver(run, key, BINS - k, BINS);
  return { first, last, delta: last - first };
}

export type SweepPoint = { step: number; acc: number; len: number };

export function sweep(run: RunKey): SweepPoint[] {
  return GRPO3060.sweep[run].map((p) => ({ step: p.step, acc: p.acc, len: p.len }));
}

/** The checkpoint with the highest accuracy on the 300-problem subset. */
export function peakCheckpoint(run: RunKey): SweepPoint {
  return sweep(run).reduce((m, p) => (p.acc > m.acc ? p : m));
}

/** Labels for the completion-length buckets, e.g. "100–149". */
export function bucketLabels(): string[] {
  const e = GRPO3060.lengthEdges;
  return e.slice(0, -1).map((lo, i) => (i === e.length - 2 ? `≥ ${lo}` : `${lo}–${e[i + 1] - 1}`));
}

/** Smoothed completion-length distribution of a model's 1,319 GSM8K test answers. */
export function lengthDistribution(model: ModelKey): number[] {
  return smoothCounts(GRPO3060.lengthHist[model], 1);
}

export type Direction = "reverse" | "forward";

/**
 * KL between a model's length distribution and the untouched Instruct model's.
 * "reverse" is KL(π ‖ π_ref), the direction the GRPO loss penalises;
 * "forward" is KL(π_ref ‖ π).
 */
export function lengthKl(model: ModelKey, direction: Direction = "reverse"): number {
  const p = lengthDistribution(model);
  const ref = lengthDistribution("instruct");
  return direction === "reverse" ? klDivergence(p, ref) : klDivergence(ref, p);
}

export function lengthKlTerms(model: ModelKey, direction: Direction = "reverse"): number[] {
  const p = lengthDistribution(model);
  const ref = lengthDistribution("instruct");
  return direction === "reverse" ? klTerms(p, ref) : klTerms(ref, p);
}

/** GSM8K test accuracy (1,319 problems) for a model. */
export function gsm8kAccuracy(model: ModelKey): number {
  return GRPO3060.eval[model].gsm8k_test.acc;
}

/** Mean completion tokens on GSM8K test for a model. */
export function gsm8kLength(model: ModelKey): number {
  return GRPO3060.eval[model].gsm8k_test.len;
}

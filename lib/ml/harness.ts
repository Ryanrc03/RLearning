// A layered post-generation gate (deterministic rules → model judge → regenerate)
// for the Eval Harness page. Pure functions; see tests/harness.test.ts.

// Each raw generation falls into one of three classes.
export type OutputMix = {
  good: number;
  /** Defects a rule can see for sure: text overflow, broken JSON, missing field. */
  ruleBad: number;
  /** Defects only judgement can see: ugly layout, off-topic, weak copy. */
  subtleBad: number;
};

export type GateClass = keyof OutputMix;

export type Gate = {
  name: string;
  /** Cost per call, in units of one generation. */
  cost: number;
  /** Probability the gate rejects an output of each class (for good: a false reject). */
  reject: Record<GateClass, number>;
};

const CLASSES: GateClass[] = ["good", "ruleBad", "subtleBad"];

export type StageStat = { name: string; reached: number; passRate: number; cost: number };

export type AttemptStats = {
  /** Probability one attempt survives every gate, overall and per class. */
  accept: number;
  acceptByClass: Record<GateClass, number>;
  /** Probability an attempt that every gate passed is actually good. */
  precision: number;
  /** Expected cost of one attempt: generation plus the gates it reaches. */
  cost: number;
  stages: StageStat[];
};

// Push one attempt through the gates in order; a gate only runs on what the previous one passed.
export function attemptStats(mix: OutputMix, gates: readonly Gate[], genCost = 1): AttemptStats {
  const alive: Record<GateClass, number> = { good: mix.good, ruleBad: mix.ruleBad, subtleBad: mix.subtleBad };
  let cost = genCost;
  const stages: StageStat[] = [];
  for (const g of gates) {
    const reached = CLASSES.reduce((s, c) => s + alive[c], 0);
    cost += reached * g.cost;
    for (const c of CLASSES) alive[c] *= 1 - g.reject[c];
    const passed = CLASSES.reduce((s, c) => s + alive[c], 0);
    stages.push({ name: g.name, reached, passRate: reached === 0 ? 0 : passed / reached, cost: g.cost });
  }
  const accept = CLASSES.reduce((s, c) => s + alive[c], 0);
  return { accept, acceptByClass: alive, precision: accept === 0 ? 0 : alive.good / accept, cost, stages };
}

export type HarnessResult = AttemptStats & {
  maxRetries: number;
  /** Probability some attempt passed within 1 + maxRetries tries. */
  passedWithin: number;
  /** Share of delivered outputs that are good. When every try fails, the last one ships anyway. */
  goodYield: number;
  expectedAttempts: number;
  costPerOutput: number;
  costPerGood: number;
};

// Retry until an attempt passes or the budget runs out; attempts are independent draws.
export function harnessYield(mix: OutputMix, gates: readonly Gate[], maxRetries: number, genCost = 1): HarnessResult {
  const a = attemptStats(mix, gates, genCost);
  const tries = maxRetries + 1;
  const failAll = Math.pow(1 - a.accept, tries);
  const passedWithin = 1 - failAll;
  const rejectedGood = mix.good - a.acceptByClass.good;
  const goodGivenRejected = a.accept >= 1 ? 0 : rejectedGood / (1 - a.accept);
  const goodYield = passedWithin * a.precision + failAll * goodGivenRejected;
  // E[attempts] = Σ_{k<tries} (1 − a)^k
  const expectedAttempts = a.accept === 0 ? tries : (1 - failAll) / a.accept;
  const costPerOutput = expectedAttempts * a.cost;
  return { ...a, maxRetries, passedWithin, goodYield, expectedAttempts, costPerOutput, costPerGood: goodYield === 0 ? Infinity : costPerOutput / goodYield };
}

export function yieldCurve(mix: OutputMix, gates: readonly Gate[], upTo: number, genCost = 1): HarnessResult[] {
  return Array.from({ length: upTo + 1 }, (_, k) => harnessYield(mix, gates, k, genCost));
}

// ---- The page's scenario: generated web pages ---------------------------------

export const PAGE_MIX: OutputMix = { good: 0.6, ruleBad: 0.25, subtleBad: 0.15 };

export const RULE_GATE: Gate = { name: "规则检查", cost: 0.01, reject: { good: 0, ruleBad: 1, subtleBad: 0 } };
export const VLM_GATE: Gate = { name: "VLM 质量门", cost: 0.3, reject: { good: 0.05, ruleBad: 0.6, subtleBad: 0.8 } };

export type HarnessPreset = "layered" | "vlmOnly" | "none";

export const HARNESS_PRESETS: Record<HarnessPreset, readonly Gate[]> = {
  layered: [RULE_GATE, VLM_GATE],
  vlmOnly: [VLM_GATE],
  none: [],
};

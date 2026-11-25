import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bce,
  binPredictions,
  brier,
  brierFromBins,
  ece,
  ecpm,
  expandBlocks,
  isotonicPredict,
  makeCascadePosts,
  naiveHarmfulRate,
  operatingPoints,
  pava,
  PAVA_EXAMPLE,
  pavaStack,
  pavaSteps,
  recallAtPrecision,
  RELIABILITY_BINS,
  runCascade,
  viewWeight,
  weightedHarmfulRate,
} from "@/lib/ml/calibration";
import { auc, makeScoredDataset } from "@/lib/ml/metrics";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const closeAll = (a: readonly number[], b: readonly number[]) => {
  assert.equal(a.length, b.length);
  a.forEach((v, i) => close(v, b[i]));
};

test("the note's reliability table: ECE is the count-weighted gap", () => {
  // gaps 0.05, 0.15, 0.20, 0.20, 0.15, 0.10, six equal buckets
  close(ece(RELIABILITY_BINS), 0.85 / 6);
  close(ece(RELIABILITY_BINS.map((b) => ({ ...b, conf: b.acc }))), 0);
});

test("the note's PAVA example pools 0.35 and 0.25 into 0.30", () => {
  const { rates, weights } = PAVA_EXAMPLE;
  closeAll(pava(rates, weights), [0.05, 0.3, 0.3, 0.65, 0.85]);
  const steps = pavaSteps(rates, weights);
  assert.equal(steps.length, 2);
  assert.equal(steps[1].pooled, 1);
  assert.equal(steps[1].blocks[1].weight, 200);
});

test("pooling cascades backwards and uses weighted means", () => {
  // 0.5, 0.4 pool to 0.45; 0.45 > 0.2 pools again to 1.1 / 3.
  closeAll(pava([0.1, 0.5, 0.4, 0.2, 0.9]), [0.1, 1.1 / 3, 1.1 / 3, 1.1 / 3, 0.9]);
  assert.equal(pavaSteps([0.1, 0.5, 0.4, 0.2, 0.9]).length, 3);
  // weights 300 and 100: (300 · 0.4 + 100 · 0.2) / 400 = 0.35
  closeAll(pava([0.4, 0.2], [300, 100]), [0.35, 0.35]);
});

test("the stack version gives the same fit, and the fit is non-decreasing", () => {
  const items = makeScoredDataset({ seed: 5, nPos: 60, nNeg: 140, posMean: 0.6, negMean: 0.4, sd: 0.2 }).sort((a, b) => a.score - b.score);
  const y = items.map((x) => (x.label ? 1 : 0));
  const fit = pava(y);
  closeAll(pavaStack(y), fit);
  for (let i = 1; i < fit.length; i++) assert.ok(fit[i] >= fit[i - 1] - 1e-12);
  // Isotonic regression keeps the weighted mean.
  close(fit.reduce((s, v) => s + v, 0), y.reduce((s: number, v) => s + v, 0), 1e-9);
});

test("isotonic calibration cannot reorder samples, but ties can move AUC", () => {
  const items = makeScoredDataset({ seed: 9, nPos: 50, nNeg: 150, posMean: 0.62, negMean: 0.4, sd: 0.18 }).sort((a, b) => a.score - b.score);
  const fit = pava(items.map((x) => (x.label ? 1 : 0)));
  const calibrated = items.map((x, i) => ({ score: fit[i], label: x.label }));
  for (let i = 1; i < calibrated.length; i++) assert.ok(calibrated[i].score >= calibrated[i - 1].score - 1e-12);
  assert.ok(new Set(fit).size < items.length, "expected plateaus");
  assert.ok(Math.abs(auc(calibrated) - auc(items)) < 0.05);
});

test("serve-time lookup interpolates between knots and clips outside", () => {
  const { scores, rates, weights } = PAVA_EXAMPLE;
  const fit = pava(rates, weights);
  close(isotonicPredict(scores, fit, 0.7), 0.65);
  close(isotonicPredict(scores, fit, 0.2), 0.175);
  close(isotonicPredict(scores, fit, 0.4), 0.3);
  close(isotonicPredict(scores, fit, 0.8), 0.75);
  close(isotonicPredict(scores, fit, 0.02), 0.05);
  close(isotonicPredict(scores, fit, 0.99), 0.85);
});

test("expandBlocks returns one value per input", () => {
  assert.deepEqual(expandBlocks([{ start: 0, end: 1, weight: 2, value: 0.5 }, { start: 2, end: 2, weight: 1, value: 0.9 }]), [0.5, 0.5, 0.9]);
});

test("Brier score: per-sample and bucketed forms agree", () => {
  const items = [
    { p: 0.9, label: true },
    { p: 0.9, label: false },
    { p: 0.1, label: false },
    { p: 0.1, label: false },
  ];
  close(brier(items), (0.01 + 0.81 + 0.01 + 0.01) / 4);
  close(brierFromBins(binPredictions(items, 10)), brier(items));
  const bins = binPredictions(items, 10);
  assert.equal(bins.length, 2);
  close(bins[1].acc, 0.5);
});

test("same ranking, different probabilities: equal AUC, different ECE", () => {
  const labels = [false, false, true, false, true, true];
  const a = [0.05, 0.2, 0.35, 0.5, 0.8, 0.95];
  const b = a.map((p) => Math.sqrt(p)); // monotone, so the order is unchanged
  const scored = (p: number[]) => p.map((score, i) => ({ score, label: labels[i] }));
  close(auc(scored(a)), auc(scored(b)));
  const eceOf = (p: number[]) => ece(binPredictions(p.map((v, i) => ({ p: v, label: labels[i] })), 5));
  assert.notEqual(eceOf(a), eceOf(b));
});

test("Recall@Precision picks the highest-recall threshold above the floor", () => {
  const items = [0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4].map((score, i) => ({ score, label: [true, true, true, false, true, false, true, false][i] }));
  const pts = operatingPoints(items);
  assert.equal(pts.length, 8);
  const best = recallAtPrecision(items, 0.95)!;
  close(best.threshold, 0.85);
  close(best.precision, 1);
  close(best.recall, 3 / 5);
  // A looser floor reaches further down the list: 4 of 5 at precision 0.8.
  close(recallAtPrecision(items, 0.8)!.recall, 4 / 5);
  assert.equal(recallAtPrecision([{ score: 0.9, label: false }], 0.95), null);
});

test("view weight: 1 at zero views, log growth, capped", () => {
  close(viewWeight(0, 5), 1);
  close(viewWeight(99, 5), 1 + Math.log(100));
  close(viewWeight(1e6, 5), 6);
  close(viewWeight(1e9, 5), 6);
  close(bce(0.5, 1), Math.log(2));
  close(bce(0.9, 0), -Math.log(0.1));
});

test("cascade: system recall = stage-1 recall × stage-2 recall, and stage-1 misses are final", () => {
  const posts = makeCascadePosts({ seed: 11, n: 20000, harmfulRate: 0.01 });
  assert.equal(posts.filter((p) => p.harmful).length, 200);
  const r = runCascade(posts, 0.45, 0.6);
  close(r.systemRecall, r.stage1Recall * r.stage2Recall);
  assert.ok(r.systemRecall <= r.stage1Recall);
  // Raising the stage-1 threshold sends fewer posts on and can only lose harmful ones.
  const strict = runCascade(posts, 0.7, 0.6);
  assert.ok(strict.passRate < r.passRate);
  assert.ok(strict.stage1Recall <= r.stage1Recall);
  assert.ok(strict.missedAtStage1 >= r.missedAtStage1);
  close(runCascade(posts, 0, 0.6).stage1Recall, 1);
});

test("importance sampling: weighting by 1 / sampling rate recovers the population rate", () => {
  const strata = [
    { name: "high", population: 10_000, sampled: 500, harmfulInSample: 100 },
    { name: "low", population: 990_000, sampled: 500, harmfulInSample: 1 },
  ];
  // 10000 · 0.2 + 990000 · 0.002 = 2000 + 1980 = 3980 of 1,000,000
  close(weightedHarmfulRate(strata), 0.00398);
  close(naiveHarmfulRate(strata), 0.101);
});

test("eCPM example from the note", () => {
  close(ecpm(0.1, 2), 200);
  close(ecpm(0.06, 2), 120);
});

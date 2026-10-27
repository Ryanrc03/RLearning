import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BINS,
  GRPO3060,
  bucketLabels,
  formatReward,
  gsm8kAccuracy,
  lengthDistribution,
  lengthKl,
  lengthKlTerms,
  peakCheckpoint,
  series,
  smoothedAt,
  smoothedSeries,
  sweep,
  trend,
} from "@/lib/ml/grpo3060";

const close = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("both runs log 500 steps in 50 bins of 10", () => {
  assert.equal(BINS, 50);
  for (const run of ["base", "fixed"] as const) {
    const c = GRPO3060.curves[run];
    assert.equal(c.step[0], 10);
    assert.equal(c.step[BINS - 1], 500);
    for (const key of ["reward", "correct", "int", "strict", "soft", "xml", "len", "kl"] as const) assert.equal(c[key].length, BINS, `${run}.${key}`);
    for (const [, v] of series(run, "format")) assert.ok(Number.isFinite(v));
  }
});

test("run 1: correctness falls, format rises, length collapses, KL is never measured", () => {
  const corr = trend("base", "correct");
  close(corr.first, 1.58, 0.01);
  close(corr.last, 0.933, 0.001);
  const fmt = trend("base", "format");
  assert.ok(fmt.delta > 1.0, `format delta ${fmt.delta}`);
  const len = trend("base", "len");
  close(len.first, 281.8, 0.5);
  close(len.last, 89.6, 0.1);
  assert.ok(GRPO3060.curves.base.kl.every((k) => k === 0));
  assert.ok(GRPO3060.curves.base.strict.every((k) => k === 0));
  close(trend("base", "reward").delta, 0.598, 0.001);
});

test("fixed run: correctness holds, length stays, KL grows slowly, strict format fires", () => {
  // 1.56 → 1.46 (78% → 73% of the 2.0 maximum) against 1.58 → 0.93 in run 1
  close(trend("fixed", "correct").delta, -0.1, 0.001);
  assert.ok(trend("fixed", "len").last > 240);
  const kl = GRPO3060.curves.fixed.kl;
  assert.ok(kl[0] < 0.002 && kl[BINS - 1] > 0.01 && kl[BINS - 1] < 0.02);
  assert.ok(trend("fixed", "strict").last > 0.2);
  // weights are halved in the fixed run, so its format total stays small
  assert.ok(formatReward("fixed", BINS - 1) < formatReward("base", BINS - 1));
});

test("checkpoint sweep: run 1 peaks at step 200 then falls; the fixed run plateaus", () => {
  const p = peakCheckpoint("base");
  assert.equal(p.step, 200);
  close(p.acc, 0.76);
  close(sweep("base").at(-1)!.acc, 0.57);
  for (const pt of sweep("fixed")) if (pt.step >= 250) assert.ok(pt.acc >= 0.75, `step ${pt.step}: ${pt.acc}`);
  close(GRPO3060.sweepRefs.instruct[0], 0.6267);
  close(GRPO3060.sweepRefs.sft[0], 0.65);
});

test("full GSM8K test accuracies match the write-up", () => {
  close(gsm8kAccuracy("instruct"), 0.6209);
  close(gsm8kAccuracy("sft"), 0.6755);
  close(gsm8kAccuracy("base200"), 0.7453);
  close(gsm8kAccuracy("base500"), 0.5686);
  close(gsm8kAccuracy("fixed500"), 0.7726);
  for (const m of Object.keys(GRPO3060.eval) as (keyof typeof GRPO3060.eval)[]) {
    assert.equal(GRPO3060.eval[m].gsm8k_test.n, 1319);
    assert.equal(GRPO3060.eval[m].aime2025.acc, 0);
  }
});

test("length distributions: 1,319 answers each; run 1 drifts ~200x further than the fixed run", () => {
  assert.equal(bucketLabels().length, 8);
  assert.equal(bucketLabels()[7], "≥ 400");
  for (const m of Object.keys(GRPO3060.lengthHist) as (keyof typeof GRPO3060.lengthHist)[]) {
    assert.equal(GRPO3060.lengthHist[m].reduce<number>((s, c) => s + c, 0), 1319, m);
    close(lengthDistribution(m).reduce((s, x) => s + x, 0), 1, 1e-9);
  }
  close(lengthKl("instruct"), 0, 1e-12);
  close(lengthKl("base500"), 3.537);
  close(lengthKl("fixed500"), 0.017);
  close(lengthKl("sft"), 2.471);
  close(lengthKl("base200"), 1.337);
  close(lengthKl("base500", "forward"), 3.213);
  close(lengthKlTerms("base500").reduce((s, t) => s + t, 0), lengthKl("base500"), 1e-9);
  assert.ok(lengthKl("base500") / lengthKl("fixed500") > 150);
});

test("the four sample problems carry every model's output and the expected verdicts", () => {
  assert.deepEqual(GRPO3060.samples.map((s) => s.idx), [679, 60, 117, 462]);
  const hacked = GRPO3060.samples.find((s) => s.tag === "hacked")!;
  assert.equal(hacked.answers.base500.correct, false);
  assert.ok(hacked.answers.base500.tokens < 60);
  assert.equal(hacked.answers.fixed500.correct, true);
  const reasoning = GRPO3060.samples.find((s) => s.tag === "reasoning")!;
  assert.equal(reasoning.answers.base200.correct, true);
  assert.equal(reasoning.answers.sft.correct, false);
  assert.equal(reasoning.answers.fixed500.correct, true);
});

test("the 50-step trailing mean starts at the first bin and ends on the last-10% slice", () => {
  close(smoothedAt("base", "correct", 0), GRPO3060.curves.base.correct[0], 1e-12);
  close(smoothedAt("base", "correct", BINS - 1), trend("base", "correct").last, 1e-12);
  close(smoothedAt("fixed", "len", BINS - 1), trend("fixed", "len").last, 1e-12);
  const s = smoothedSeries("fixed", "correct");
  assert.equal(s.length, BINS);
  // smoothed batch accuracy of the fixed run: a dip to ~59% at steps 160–200, otherwise 70–84%
  for (let i = 4; i < BINS; i++) assert.ok(s[i][1] / 2 > 0.55 && s[i][1] / 2 < 0.86, `bin ${i}: ${s[i][1]}`);
  const dip = Math.min(...s.slice(14, 21).map((p) => p[1] / 2));
  close(dip, 0.593, 0.005);
  // run 1 at the same steps (same seed, same problems) shows no such dip
  assert.ok(Math.min(...smoothedSeries("base", "correct").slice(14, 21).map((p) => p[1] / 2)) > 0.72);
});

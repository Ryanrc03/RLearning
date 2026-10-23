import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BIAS_POINTS,
  DECOMP,
  essRatio,
  gapExplainedByPool,
  kendall,
  popularityWeights,
  rankOrder,
  ranks,
  spearman,
} from "@/lib/ml/biasDecomposition";

const close = (a: number, b: number, eps: number) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("26 learned click models, as in docs/DEBIAS.zh-CN.md §5.1", () => {
  assert.equal(BIAS_POINTS.length, 26);
  assert.equal(new Set(BIAS_POINTS.map((p) => p.run)).size, 26);
  BIAS_POINTS.forEach((p) => assert.ok(p.lo <= p.random && p.random <= p.hi));
});

test("rank agreement matches the doc: Spearman 0.731, Kendall 0.51 (23 Day 1–4 models: 0.755 / 0.53)", () => {
  const t = BIAS_POINTS.map((p) => p.tab1);
  const r = BIAS_POINTS.map((p) => p.random);
  close(spearman(t, r), 0.731, 0.001);
  close(kendall(t, r), 0.508, 0.001);
  const d14 = BIAS_POINTS.filter((p) => p.stage !== "Day 5" && p.run !== 35);
  assert.equal(d14.length, 23);
  close(spearman(d14.map((p) => p.tab1), d14.map((p) => p.random)), 0.755, 0.001);
});

test("ranks average ties and a perfect monotone pair gives 1", () => {
  assert.deepEqual(ranks([3, 1, 3, 2]), [3.5, 1, 3.5, 2]);
  close(spearman([1, 2, 3], [10, 20, 30]), 1, 1e-12);
  close(kendall([1, 2, 3], [3, 2, 1]), -1, 1e-12);
});

test("the best tab1 model is a sequence / multi-task model, LightGBM is near the bottom on random", () => {
  const rt = rankOrder(BIAS_POINTS, "tab1");
  const rr = rankOrder(BIAS_POINTS, "random");
  assert.equal([...rt.entries()].find(([, v]) => v === 1)?.[0], 23);
  assert.ok((rr.get(5) ?? 0) >= 22);
});

test("the random-pool subset already shows most of the tab1 → random GAUC gap", () => {
  assert.ok(gapExplainedByPool(DECOMP[0]) > 0.95);
  assert.ok(gapExplainedByPool(DECOMP[2]) > 0.8);
});

test("popularity weights: mean 1, rarer videos weigh more, clipping holds", () => {
  const counts = [1, 1, 1, 4, 4, 100, 100, 100, 10000];
  const w = popularityWeights(counts, 0.5, 10);
  close(w.reduce((a, b) => a + b, 0) / w.length, 1, 1e-9);
  assert.ok(w[0] > w[3] && w[3] > w[5] && w[5] > w[8]);
  assert.ok(Math.max(...w) <= 10 + 1e-9);
  close(essRatio([1, 1, 1, 1]), 1, 1e-12);
  assert.ok(essRatio(popularityWeights(counts, 1, 10)) < essRatio(w));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BAGGING_SAMPLES,
  bestLeaf,
  bestSplit,
  bootstrapSample,
  bundleExclusive,
  candidateSplits,
  classify,
  classStumpPredict,
  DT_POINTS,
  entropy,
  featureSubset,
  fitClassStump,
  fitStump,
  GAIN_TABLE,
  GBDT_POINTS,
  gbdtRun,
  gbdtStepCurve,
  gossSelect,
  growLeafWise,
  growLevelWise,
  growTree,
  histogramBins,
  informationGain,
  majorityVote,
  nodeDepth,
  residualChain,
  treeDepth,
  unbundleExclusive,
  weightedCombine,
} from "@/lib/ml/trees";
import { createRng } from "@/lib/ml/random";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

// --- Decision tree ---------------------------------------------------------

test("entropy: a 50/50 split is 1 bit, a pure node is 0", () => {
  close(entropy([6, 6]), 1);
  close(entropy([1, 1]), 1);
  assert.equal(entropy([5, 0]), 0);
  assert.equal(entropy([0, 0]), 0);
  close(entropy([5, 1]), 0.65002242);
});

test("information gain of a perfectly separating split equals the parent entropy", () => {
  close(informationGain([6, 6], [[6, 0], [0, 6]]), entropy([6, 6]));
  close(informationGain([5, 1], [[5, 0], [0, 1]]), entropy([5, 1]));
  // A cut that changes nothing gains nothing.
  close(informationGain([6, 6], [[3, 3], [3, 3]]), 0);
});

test("the 12 points: best first cut is x ≤ 5 with gain 1 − H(5, 1)", () => {
  const best = bestSplit(DT_POINTS);
  assert.ok(best);
  assert.equal(best.feature, "x");
  assert.equal(best.threshold, 5);
  assert.deepEqual(best.left, [5, 1]);
  assert.deepEqual(best.right, [1, 5]);
  close(best.gain, 1 - entropy([5, 1]));
  // 11 midpoints per feature.
  assert.equal(candidateSplits(DT_POINTS).length, 22);
});

test("growTree to depth 2 cuts on y next and classifies all 12 points", () => {
  const tree = growTree(DT_POINTS, 2);
  assert.equal(tree.kind, "split");
  if (tree.kind !== "split") return;
  assert.equal(tree.left.kind, "split");
  assert.equal(tree.right.kind, "split");
  if (tree.left.kind === "split") {
    assert.equal(tree.left.feature, "y");
    assert.equal(tree.left.threshold, 8);
    close(tree.left.gain, entropy([5, 1]));
  }
  if (tree.right.kind === "split") {
    assert.equal(tree.right.feature, "y");
    assert.equal(tree.right.threshold, 2.25);
  }
  assert.equal(treeDepth(tree), 2);
  for (const p of DT_POINTS) assert.equal(classify(tree, p), p.label);
  // Depth 1 cannot: the two noisy points stay wrong.
  const stump = growTree(DT_POINTS, 1);
  assert.equal(DT_POINTS.filter((p) => classify(stump, p) !== p.label).length, 2);
});

// --- Ensembles -------------------------------------------------------------

test("bootstrap sample is seeded, has length n and repeats some index", () => {
  const a = bootstrapSample(createRng(3), 10);
  const b = bootstrapSample(createRng(3), 10);
  assert.deepEqual(a, b);
  assert.equal(a.length, 10);
  assert.ok(a.every((i) => i >= 0 && i < 10));
  assert.ok(new Set(a).size < 10, "a bootstrap of 10 should repeat at least one index");
});

test("majority vote counts and breaks ties by first appearance", () => {
  assert.equal(majorityVote([0, 1, 0]).winner, 0);
  assert.equal(majorityVote(["cat", "dog", "dog"]).winner, "dog");
  assert.deepEqual(majorityVote([1, 1, 0]).tally, [{ label: 1, count: 2 }, { label: 0, count: 1 }]);
  assert.equal(majorityVote(["b", "a"]).winner, "b");
});

test("residual chain for the notes' height example is [20, 10, 0] and the trees sum back to 180", () => {
  const preds = [160, 10, 10];
  assert.deepEqual(residualChain(180, preds), [20, 10, 0]);
  assert.equal(preds.reduce((a, b) => a + b, 0), 180);
});

test("feature subset draws m distinct indices below M", () => {
  const s = featureSubset(createRng(5), 2, 4);
  assert.equal(s.length, 2);
  assert.equal(new Set(s).size, 2);
  assert.ok(s.every((i) => i >= 0 && i < 4));
  assert.deepEqual(featureSubset(createRng(5), 2, 4), s);
  assert.throws(() => featureSubset(createRng(1), 5, 4));
});

test("stacking meta model is a weighted sum", () => {
  close(weightedCombine([0.8, 0.55, 0.35], [0.6, 0.3, 0.1]), 0.68);
  assert.throws(() => weightedCombine([1], [1, 2]));
});

test("bagging samples: three bootstrapped stumps disagree and the vote settles it", () => {
  const full = fitClassStump(BAGGING_SAMPLES);
  assert.equal(full.threshold, 7.5);
  const votes = [0, 1, 2].map((k) => {
    const idx = bootstrapSample(createRng(1600 + k), 10);
    return classStumpPredict(fitClassStump(idx.map((i) => BAGGING_SAMPLES[i])), 6.5);
  });
  assert.deepEqual(votes, [0, 1, 0]);
  assert.equal(majorityVote(votes).winner, 0);
});

// --- GBDT ------------------------------------------------------------------

test("a stump on two-level data recovers the split and the two means", () => {
  const s = fitStump([0, 1, 2, 3, 4, 5], [1, 1, 1, 5, 5, 5]);
  assert.equal(s.threshold, 2.5);
  close(s.left, 1);
  close(s.right, 5);
  close(s.sse, 0);
  // All x equal: one leaf at the mean.
  const flat = fitStump([1, 1, 1], [2, 4, 6]);
  assert.equal(flat.threshold, Infinity);
  close(flat.left, 4);
});

test("GBDT: MSE never rises across rounds at lr 0.5, and round 0 is the mean", () => {
  const run = gbdtRun(GBDT_POINTS, 0.5, 12);
  assert.equal(run.length, 13);
  assert.equal(run[0].stump, null);
  const meanY = GBDT_POINTS.reduce((a, p) => a + p.y, 0) / GBDT_POINTS.length;
  close(run[0].F[0], meanY);
  for (let m = 1; m < run.length; m++) assert.ok(run[m].mse <= run[m - 1].mse + 1e-12, `round ${m} rose`);
});

test("GBDT: after one round lr 1.0 reduces MSE more than lr 0.1", () => {
  const fast = gbdtRun(GBDT_POINTS, 1.0, 1);
  const slow = gbdtRun(GBDT_POINTS, 0.1, 1);
  assert.ok(fast[1].mse < slow[1].mse);
  assert.ok(slow[1].mse < slow[0].mse);
});

test("GBDT step curve has one breakpoint per distinct threshold and matches the model", () => {
  const run = gbdtRun(GBDT_POINTS, 0.5, 3);
  const stumps = run.slice(1).map((r) => r.stump!);
  const curve = gbdtStepCurve(run[0].F[0], stumps, 0.5, 0, 1);
  const distinct = new Set(stumps.map((s) => s.threshold)).size;
  assert.equal(curve.length, distinct + 2);
  close(curve[0][1], run[0].F[0] + 0.5 * stumps.reduce((a, s) => a + (0 <= s.threshold ? s.left : s.right), 0));
});

// --- XGBoost / LightGBM ----------------------------------------------------

test("leaf-wise picks the max-gain leaf at every step", () => {
  for (let steps = 1; steps <= 7; steps++) {
    const before = growLeafWise(GAIN_TABLE, steps - 1);
    const after = growLeafWise(GAIN_TABLE, steps);
    assert.equal(after.splits[steps - 1], bestLeaf(GAIN_TABLE, before.leaves));
    assert.equal(after.splits[steps - 1], before.next);
    assert.equal(after.leaves.length, steps + 1);
  }
  const g = growLeafWise(GAIN_TABLE, 7);
  assert.deepEqual(g.splits, [1, 2, 4, 8, 3, 16, 32]);
  assert.equal(g.totalGain, 287);
  assert.equal(g.depth, 6);
});

test("level-wise grows one full level per step; same 8 leaves gain less than leaf-wise", () => {
  const g = growLevelWise(GAIN_TABLE, 3);
  assert.deepEqual(g.splits, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(g.leaves.length, 8);
  assert.equal(g.depth, 3);
  assert.equal(g.totalGain, 249);
  assert.ok(growLeafWise(GAIN_TABLE, 7).totalGain > g.totalGain);
  assert.equal(growLevelWise(GAIN_TABLE, 0).leaves.length, 1);
  assert.equal(nodeDepth(1), 0);
  assert.equal(nodeDepth(7), 2);
});

test("histogram bin counts sum to n and every value lands in a bin", () => {
  const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10];
  const h = histogramBins(values, 4);
  assert.equal(h.counts.reduce((a, b) => a + b, 0), values.length);
  assert.equal(h.edges.length, 5);
  assert.ok(h.bin.every((b) => b >= 0 && b < 4));
  assert.equal(h.bin[0], 0);
  assert.equal(h.bin[values.length - 1], 3);
});

test("EFB merges exclusive one-hot columns losslessly and throws when they overlap", () => {
  const man = [1, 0, 1, 0];
  const woman = [0, 1, 0, 1];
  const b = bundleExclusive(man, woman);
  assert.deepEqual(b.merged, [1, 2, 1, 2]);
  assert.deepEqual(unbundleExclusive(b), { colA: man, colB: woman });
  assert.throws(() => bundleExclusive([1, 0], [1, 0]), /not exclusive/);
});

test("GOSS keeps every sample in the top fraction and samples the rest", () => {
  const grads = [1.0, -0.9, 0.05, 0.02, -0.01, 0.03, 0.04, -0.02, 0.01, 0.06];
  const g = gossSelect(grads, 0.2, 0.5, createRng(2));
  assert.deepEqual(g.top, [0, 1]);
  assert.equal(g.sampled.length, 4);
  assert.equal(g.top.length + g.sampled.length + g.dropped.length, grads.length);
  assert.ok(g.sampled.every((i) => !g.top.includes(i)));
  close(g.weight, 1.6);
  assert.deepEqual(gossSelect(grads, 0.2, 0.5, createRng(2)), g);
});

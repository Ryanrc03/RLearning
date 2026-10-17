import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accuracy,
  auc,
  averagePrecision,
  confusion,
  confusionAtThreshold,
  DOG_CAT,
  DOG_CAT_SCORED,
  f1,
  makeScoredDataset,
  precision,
  precisionAtK,
  prPoints,
  recall,
  rocPoints,
  specificity,
  trapezoid,
} from "@/lib/ml/metrics";
import { createRng, randomNormal } from "@/lib/ml/random";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

// The handwritten notes: 6 dogs, 4 cats; the model says dog 7 times and gets 5 of 10 right.
test("dog/cat example from the notes: TP 4, FP 3, FN 2, TN 1", () => {
  const c = confusion(DOG_CAT.labels, DOG_CAT.preds);
  assert.deepEqual(c, { tp: 4, fp: 3, fn: 2, tn: 1 });
  close(accuracy(c), 0.5);
  close(precision(c), 4 / 7);
  close(recall(c), 4 / 6);
  close(specificity(c), 1 / 4);
  close(f1(c), 8 / 13);
});

test("precision and recall are 0, not NaN, when nothing is predicted positive", () => {
  const c = confusion([true, false], [false, false]);
  assert.equal(precision(c), 0);
  assert.equal(recall(c), 0);
  assert.equal(f1(c), 0);
});

test("scored dog/cat set reproduces the notes' matrix at threshold 0.5", () => {
  assert.deepEqual(confusionAtThreshold(DOG_CAT_SCORED, 0.5), { tp: 4, fp: 3, fn: 2, tn: 1 });
  // Threshold below every score: everything is a dog.
  assert.deepEqual(confusionAtThreshold(DOG_CAT_SCORED, 0), { tp: 6, fp: 4, fn: 0, tn: 0 });
});

test("AUC counts positive-over-negative pairs, ties worth a half", () => {
  const perfect = [
    { score: 0.9, label: true },
    { score: 0.8, label: true },
    { score: 0.3, label: false },
  ];
  close(auc(perfect), 1);
  const threeOfFour = [
    { score: 0.9, label: true },
    { score: 0.4, label: true },
    { score: 0.6, label: false },
    { score: 0.2, label: false },
  ];
  close(auc(threeOfFour), 0.75);
  const tie = [
    { score: 0.5, label: true },
    { score: 0.5, label: false },
  ];
  close(auc(tie), 0.5);
});

test("ROC points start at (0,0), end at (1,1), and their area equals the pairwise AUC", () => {
  const items = makeScoredDataset({ seed: 7, nPos: 30, nNeg: 40, posMean: 0.65, negMean: 0.4, sd: 0.15 });
  const pts = rocPoints(items);
  assert.deepEqual([pts[0].fpr, pts[0].tpr], [0, 0]);
  assert.deepEqual([pts[pts.length - 1].fpr, pts[pts.length - 1].tpr], [1, 1]);
  close(trapezoid(pts.map((p) => [p.fpr, p.tpr])), auc(items), 1e-9);
  for (let i = 1; i < pts.length; i++) {
    assert.ok(pts[i].fpr >= pts[i - 1].fpr && pts[i].tpr >= pts[i - 1].tpr, "monotone");
  }
});

test("PR points and average precision on a hand example", () => {
  // Ranked: P N P N → precision at each positive: 1/1, 2/3 → AP = (1 + 2/3) / 2
  const items = [
    { score: 0.9, label: true },
    { score: 0.8, label: false },
    { score: 0.7, label: true },
    { score: 0.6, label: false },
  ];
  const pts = prPoints(items);
  assert.equal(pts[0].recall, 0);
  close(pts[pts.length - 1].recall, 1);
  close(averagePrecision(items), (1 + 2 / 3) / 2);
});

test("precision@k only looks at the top k scores", () => {
  const items = [
    { score: 0.9, label: true },
    { score: 0.8, label: false },
    { score: 0.7, label: true },
    { score: 0.6, label: true },
    { score: 0.1, label: false },
  ];
  close(precisionAtK(items, 1), 1);
  close(precisionAtK(items, 2), 0.5);
  close(precisionAtK(items, 4), 0.75);
});

test("makeScoredDataset is deterministic and clipped to [0, 1]", () => {
  const a = makeScoredDataset({ seed: 3, nPos: 10, nNeg: 90, posMean: 0.7, negMean: 0.3, sd: 0.2 });
  const b = makeScoredDataset({ seed: 3, nPos: 10, nNeg: 90, posMean: 0.7, negMean: 0.3, sd: 0.2 });
  assert.deepEqual(a, b);
  assert.equal(a.filter((x) => x.label).length, 10);
  assert.ok(a.every((x) => x.score >= 0 && x.score <= 1));
});

test("seeded rng repeats itself and the normal sampler is roughly standard", () => {
  const r1 = createRng(42);
  const r2 = createRng(42);
  const xs = Array.from({ length: 5 }, () => r1());
  assert.deepEqual(xs, Array.from({ length: 5 }, () => r2()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  const rng = createRng(1);
  const n = 20000;
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const z = randomNormal(rng);
    sum += z;
    sq += z * z;
  }
  const mean = sum / n;
  const sd = Math.sqrt(sq / n - mean * mean);
  assert.ok(Math.abs(mean) < 0.03, `mean ${mean}`);
  assert.ok(Math.abs(sd - 1) < 0.03, `sd ${sd}`);
});

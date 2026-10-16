import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accuracyOf,
  bce,
  boundarySegment,
  crossEntropy,
  logisticGrad,
  logitsForTarget,
  makeBlobs,
  pickShowcasePoint,
  predictProb,
  sigmoid,
  softmax,
  trainLogistic,
} from "@/lib/ml/linear";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("sigmoid: 0.5 at zero, symmetric, saturates without overflow", () => {
  close(sigmoid(0), 0.5);
  close(sigmoid(2) + sigmoid(-2), 1);
  close(sigmoid(1000), 1);
  close(sigmoid(-1000), 0);
});

test("BCE is ≈ 0 for a perfect prediction and grows as the prediction gets worse", () => {
  assert.ok(bce(1, 1) < 1e-9);
  assert.ok(bce(0, 0) < 1e-9);
  close(bce(0.5, 1), Math.log(2));
  assert.ok(bce(0.1, 1) > bce(0.9, 1));
  assert.ok(Number.isFinite(bce(0, 1)));
});

test("makeBlobs is seeded, 16 + 16 points, and the gradient points the right way", () => {
  const a = makeBlobs(11);
  const b = makeBlobs(11);
  assert.deepEqual(a, b);
  assert.equal(a.length, 32);
  assert.equal(a.filter((p) => p.label === 1).length, 16);
  // Starting from w = (0, 1): label-1 points sit lower-right, so the gradient on w1 is negative
  // (w1 should increase) and on w2 positive (w2 should decrease).
  const g = logisticGrad({ w1: 0, w2: 1, b: 0 }, a);
  assert.ok(g.w1 < 0, `g.w1 ${g.w1}`);
  assert.ok(g.w2 > 0, `g.w2 ${g.w2}`);
});

test("batch gradient descent: loss falls every step for 30 steps at lr 0.5, final accuracy ≥ 0.9", () => {
  const data = makeBlobs(11);
  const h = trainLogistic(data, 0.5, 30);
  assert.equal(h.length, 31);
  assert.deepEqual(h[0].params, { w1: 0, w2: 1, b: 0 });
  for (let k = 1; k < h.length; k++) assert.ok(h[k].loss < h[k - 1].loss, `step ${k}: ${h[k].loss} ≥ ${h[k - 1].loss}`);
  assert.ok(h[30].accuracy >= 0.9, `accuracy ${h[30].accuracy}`);
  close(accuracyOf(h[30].params, data), h[30].accuracy);
  assert.ok(h[30].params.w1 > 0 && h[30].params.w2 < 0, "boundary rotated towards the blobs");
});

test("boundary segment crosses the box twice, and is null when w = 0", () => {
  const seg = boundarySegment({ w1: 1, w2: -1, b: 0 }, [-4, 4], [-4, 4]);
  assert.ok(seg);
  // y = x: corners (-4,-4) and (4,4)
  const xs = seg.map((p) => p[0]).sort((u, v) => u - v);
  assert.deepEqual(xs, [-4, 4]);
  assert.equal(boundarySegment({ w1: 0, w2: 0, b: 1 }, [-4, 4], [-4, 4]), null);
  const horizontal = boundarySegment({ w1: 0, w2: 1, b: 0 }, [-4, 4], [-4, 4]);
  assert.ok(horizontal);
  close(horizontal[0][1], 0);
  close(horizontal[1][1], 0);
});

test("showcase point is a valid index and its own-class probability rises during training", () => {
  const data = makeBlobs(11);
  const h = trainLogistic(data, 0.5, 30);
  const i = pickShowcasePoint(data, h[0].params, h[30].params);
  assert.ok(i >= 0 && i < data.length);
  const own = (p: number) => (data[i].label === 1 ? p : 1 - p);
  assert.ok(own(predictProb(h[30].params, data[i])) > own(predictProb(h[0].params, data[i])));
});

test("cross-entropy reproduces the notes: 0.9 → 0.105, 0.2 → 1.61", () => {
  close(crossEntropy([0.9, 0.05, 0.05], 0), 0.105, 0.01);
  close(crossEntropy([0.2, 0.4, 0.4], 0), 1.61, 0.01);
  assert.ok(crossEntropy([1, 0, 0], 0) < 1e-9);
  assert.throws(() => crossEntropy([0.5, 0.5], 2));
});

test("logitsForTarget inverts softmax for the target class", () => {
  const others = [0, 0];
  const z = logitsForTarget(0.9, others);
  const p = softmax([z, ...others]);
  close(p[0], 0.9, 1e-9);
  close(p[1], 0.05, 1e-9);
  close(crossEntropy(p, 0), 0.105, 0.01);
  const z2 = logitsForTarget(0.2, others);
  close(softmax([z2, ...others])[0], 0.2, 1e-9);
  close(crossEntropy(softmax([z2, ...others]), 0), 1.61, 0.01);
});

test("K = 2: softmax of (z1, z2) is the sigmoid of z1 − z2", () => {
  for (const [z1, z2] of [[1.5, -0.5], [-2, 3], [0, 0], [4, 4.5]]) {
    close(softmax([z1, z2])[0], sigmoid(z1 - z2), 1e-9);
  }
});

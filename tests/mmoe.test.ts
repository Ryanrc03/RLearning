import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "@/lib/ml/random";
import { gateSoftmax, aggregateExperts, invertedGateDropout, drawGateMask, mmoeDemo } from "@/lib/ml/mmoe";

function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`); }

test("gate Softmax is normalized, stable for large logits and invariant to a shared offset", () => {
  const a = gateSoftmax([1000, 1000, 1000]);
  a.forEach((p) => close(p, 1 / 3));
  const b = gateSoftmax([Math.log(3), Math.log(4), Math.log(3)]);
  [0.3, 0.4, 0.3].forEach((p, i) => close(b[i], p));
  const c = gateSoftmax([Math.log(3) + 1000, Math.log(4) + 1000, Math.log(3) + 1000]);
  c.forEach((p, i) => close(p, b[i]));
});

test("expert aggregation mixes vector coordinates and supports non-normalized dropout weights", () => {
  const experts = [[1, 0], [0, 1], [1, 1]];
  assert.deepEqual(aggregateExperts(experts, [0.3, 0.4, 0.3]), [0.6, 0.7]);
  assert.deepEqual(aggregateExperts(experts, [0, 0, 0]), [0, 0]);
  assert.deepEqual(aggregateExperts(experts, [0, 0, 2]), [2, 2]);
});

test("changing CTR's demo logit changes only its gate; both predictions remain probabilities", () => {
  const before = mmoeDemo([0, 0]);
  const after = mmoeDemo([4, 0]);
  assert.ok(after[0].gate[2] > before[0].gate[2]);
  assert.deepEqual(after[1], before[1]);
  close(before[0].hidden[0], before[0].gate[0] + before[0].gate[2]);
  for (const t of after) assert.ok(t.prediction > 0 && t.prediction < 1);
});

test("inverted gate dropout scales survivors and does not renormalize or resample all-zero masks", () => {
  const a = invertedGateDropout([0.01, 0.01, 0.98], [1, 1, 0], 0.1);
  close(a[0], 1 / 90); close(a[1], 1 / 90); assert.equal(a[2], 0);
  close(a.reduce((s, p) => s + p, 0), 1 / 45);
  const b = invertedGateDropout([0.3, 0.4, 0.3], [1, 1, 1], 0.1);
  close(b.reduce((s, p) => s + p, 0), 10 / 9);
  assert.deepEqual(invertedGateDropout([0.3, 0.4, 0.3], [0, 0, 0], 0.1), [0, 0, 0]);
  assert.deepEqual(invertedGateDropout([0.3, 0.4, 0.3], [1, 1, 1], 0), [0.3, 0.4, 0.3]);
});

test("exact expectation over all masks restores original gate weights", () => {
  const means = [0, 0, 0];
  for (let bits = 0; bits < 8; bits++) {
    const mask = [0, 1, 2].map((i) => ((bits >> i) & 1) as 0 | 1);
    const mass = mask.reduce<number>((p, m) => p * (m ? 0.9 : 0.1), 1);
    invertedGateDropout([0.3, 0.4, 0.3], mask, 0.1).forEach((p, i) => { means[i] += p * mass; });
  }
  [0.3, 0.4, 0.3].forEach((p, i) => close(means[i], p));
});

test("Bernoulli masks use the dropout threshold and a reproducible RNG", () => {
  const draws = [0.01, 0.1, 0.99];
  assert.deepEqual(drawGateMask(3, 0.1, () => draws.shift()!), [0, 1, 1]);
  const a = createRng(20261027); const b = createRng(20261027);
  assert.deepEqual(Array.from({ length: 20 }, () => drawGateMask(3, 0.1, a)), Array.from({ length: 20 }, () => drawGateMask(3, 0.1, b)));
});

test("invalid dimensions or probabilities fail explicitly instead of displaying NaN", () => {
  assert.throws(() => gateSoftmax([]));
  assert.throws(() => gateSoftmax([NaN, 0]));
  assert.throws(() => aggregateExperts([[1, 0], [1]], [0.5, 0.5]));
  assert.throws(() => aggregateExperts([[1, 0]], [0.5, 0.5]));
  assert.throws(() => invertedGateDropout([0.2, 0.8], [1], 0.1));
  assert.throws(() => invertedGateDropout([0.2, 0.8], [1, 1], 1));
  assert.throws(() => drawGateMask(3, -0.1, createRng(1)));
});

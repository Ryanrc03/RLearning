import { test } from "node:test";
import assert from "node:assert/strict";
import { batchNorm, DEMO_ACTIVATIONS, DEMO_BATCH, DEMO_FEATURES, DEMO_SEED, DEMO_WEIGHTS, layerNorm, meanStd, weightNorm } from "@/lib/ml/norm";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("meanStd is the mean and the population standard deviation", () => {
  const r = meanStd([2, 4, 4, 4, 5, 5, 7, 9]);
  close(r.mean, 5);
  close(r.std, 2);
  assert.deepEqual(meanStd([]), { mean: 0, std: 0 });
});

test("BatchNorm: every column has mean 0 and std 1 (eps = 0)", () => {
  const m = DEMO_ACTIVATIONS(DEMO_SEED);
  assert.equal(m.length, DEMO_BATCH);
  assert.ok(m.every((row) => row.length === DEMO_FEATURES));
  const r = batchNorm(m, 0);
  for (let j = 0; j < DEMO_FEATURES; j++) {
    const col = r.normalized.map((row) => row[j]);
    const { mean, std } = meanStd(col);
    close(mean, 0);
    close(std, 1);
    // μ_B and σ_B reported per column are the raw column statistics.
    const raw = meanStd(m.map((row) => row[j]));
    close(r.mean[j], raw.mean);
    close(r.std[j], raw.std);
  }
  // With eps > 0 the column std falls slightly below 1.
  const withEps = batchNorm(m, 1e-2);
  const col0 = meanStd(withEps.normalized.map((row) => row[0]));
  assert.ok(col0.std < 1 && col0.std > 0.9);
});

test("LayerNorm: every row has mean 0 and std 1 (eps = 0)", () => {
  const m = DEMO_ACTIVATIONS(DEMO_SEED);
  const r = layerNorm(m, 0);
  for (let i = 0; i < DEMO_BATCH; i++) {
    const { mean, std } = meanStd(r.normalized[i]);
    close(mean, 0);
    close(std, 1);
    const raw = meanStd(m[i]);
    close(r.mean[i], raw.mean);
    close(r.std[i], raw.std);
  }
  // A row's normalisation depends only on that row.
  const alone = layerNorm([m[2]], 0);
  assert.deepEqual(alone.normalized[0], r.normalized[2]);
});

test("WeightNorm: the unit direction has norm 1 and g · unit rebuilds v", () => {
  const { g, unit } = weightNorm(DEMO_WEIGHTS);
  close(Math.sqrt(unit.reduce((s, x) => s + x * x, 0)), 1);
  close(g, Math.sqrt(DEMO_WEIGHTS.reduce((s, x) => s + x * x, 0)));
  unit.forEach((u, i) => close(g * u, DEMO_WEIGHTS[i]));
  assert.throws(() => weightNorm([0, 0, 0]));
});

test("DEMO_ACTIVATIONS is seeded and its features sit on different scales", () => {
  const a = DEMO_ACTIVATIONS(DEMO_SEED);
  assert.deepEqual(a, DEMO_ACTIVATIONS(DEMO_SEED));
  const colMeans = Array.from({ length: DEMO_FEATURES }, (_, j) => meanStd(a.map((row) => row[j])).mean);
  assert.ok(Math.max(...colMeans) - Math.min(...colMeans) > 5, `column means too similar: ${colMeans}`);
  assert.ok(a.flat().every((v) => Number.isFinite(v)));
});

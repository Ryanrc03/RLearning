import { test } from "node:test";
import assert from "node:assert/strict";
import { normalCdf, normalQuantile, powerTwoProportions, requiredSampleSize, simulateAB, zTestTwoProportions } from "@/lib/ml/abtest";
import { createRng } from "@/lib/ml/random";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("normal cdf and quantile agree at the usual landmarks", () => {
  close(normalCdf(0), 0.5, 1e-7);
  close(normalCdf(1.959964), 0.975, 1e-5);
  close(normalCdf(-1.959964), 0.025, 1e-5);
  close(normalQuantile(0.975), 1.959964, 1e-4);
  close(normalQuantile(0.8), 0.841621, 1e-4);
  close(normalQuantile(normalCdf(0.7)), 0.7, 1e-4);
});

test("two-proportion z test: 10% vs 13% on 1000 each is just under p = 0.05", () => {
  const r = zTestTwoProportions(100, 1000, 130, 1000);
  close(r.pA, 0.1);
  close(r.pB, 0.13);
  close(r.diff, 0.03);
  assert.ok(r.z > 2.09 && r.z < 2.11, `z ${r.z}`);
  assert.ok(r.p > 0.03 && r.p < 0.04, `p ${r.p}`);
});

test("identical groups give p = 1 and zero z", () => {
  const r = zTestTwoProportions(50, 500, 50, 500);
  close(r.z, 0);
  close(r.p, 1);
});

test("required sample size for 10% → 12% at α 0.05, power 0.8 is about 3841 per group", () => {
  const n = requiredSampleSize(0.1, 0.12, 0.05, 0.8);
  assert.ok(n >= 3800 && n <= 3900, `n ${n}`);
  // Power at that n should be close to 0.8, and grow with n.
  const p = powerTwoProportions(0.1, 0.12, n, 0.05);
  assert.ok(p > 0.78 && p < 0.82, `power ${p}`);
  assert.ok(powerTwoProportions(0.1, 0.12, 2 * n, 0.05) > p);
});

test("simulateAB is seeded and its rates land near the true ones", () => {
  const a = simulateAB(createRng(9), 0.1, 0.13, 5000);
  const b = simulateAB(createRng(9), 0.1, 0.13, 5000);
  assert.deepEqual(a, b);
  assert.ok(Math.abs(a.xA / 5000 - 0.1) < 0.02);
  assert.ok(Math.abs(a.xB / 5000 - 0.13) < 0.02);
});

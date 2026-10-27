import { test } from "node:test";
import assert from "node:assert/strict";
import { expectedK3, k3, klDivergence, klTerms, mixDistributions, smoothCounts } from "@/lib/ml/klDivergence";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("smoothCounts gives a distribution with no zero bucket", () => {
  const p = smoothCounts([0, 3, 1], 1);
  close(p.reduce((s, x) => s + x, 0), 1);
  close(p[0], 1 / 7);
  close(p[1], 4 / 7);
  assert.throws(() => smoothCounts([], 0));
});

test("KL is zero for identical distributions, positive otherwise, and asymmetric", () => {
  const p = [0.5, 0.3, 0.2];
  const q = [0.2, 0.3, 0.5];
  close(klDivergence(p, p), 0);
  assert.ok(klDivergence(p, q) > 0);
  close(klDivergence(p, q), 0.5 * Math.log(2.5) + 0.2 * Math.log(0.4));
  // A distribution that drops support where q has mass, vs one that adds mass where q has little.
  const narrow = [0.98, 0.01, 0.01];
  const wide = [1 / 3, 1 / 3, 1 / 3];
  assert.notEqual(klDivergence(narrow, wide).toFixed(6), klDivergence(wide, narrow).toFixed(6));
});

test("the per-outcome terms sum to the KL and can be negative one by one", () => {
  const p = [0.7, 0.2, 0.1];
  const q = [0.4, 0.4, 0.2];
  const terms = klTerms(p, q);
  close(terms.reduce((s, t) => s + t, 0), klDivergence(p, q));
  assert.ok(terms[0] > 0 && terms[1] < 0 && terms[2] < 0);
  assert.equal(klTerms([0.5, 0.5], [1, 0])[1], Infinity);
  assert.equal(klTerms([1, 0], [0.5, 0.5])[1], 0);
});

test("k3 is non-negative per sample and unbiased for KL(p ‖ q)", () => {
  for (const x of [-3, -0.5, 0, 0.5, 3]) assert.ok(k3(x) >= 0);
  close(k3(0), 0);
  const p = [0.6, 0.25, 0.1, 0.05];
  const q = [0.25, 0.25, 0.25, 0.25];
  close(expectedK3(p, q), klDivergence(p, q), 1e-12);
});

test("sliding p toward q shrinks KL(mix ‖ q) monotonically to 0", () => {
  const p = [0.8, 0.15, 0.05];
  const q = [0.2, 0.3, 0.5];
  let prev = Infinity;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const k = klDivergence(mixDistributions(p, q, t), q);
    assert.ok(k < prev + 1e-12);
    prev = k;
  }
  close(prev, 0);
});

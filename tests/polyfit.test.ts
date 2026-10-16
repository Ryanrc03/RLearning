import { test } from "node:test";
import assert from "node:assert/strict";
import { bestDegree, errorByDegree, fitMse, fitRegionOf, fitRegions, makeSineData, mse, polyfit, polyval, trueCurve } from "@/lib/ml/polyfit";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("degree-1 fit of an exact line recovers slope and intercept", () => {
  const xs = [0, 0.25, 0.5, 0.75, 1];
  const ys = xs.map((x) => 2.5 * x - 0.7);
  const fit = polyfit(xs, ys, 1);
  const intercept = polyval(fit, 0);
  const slope = polyval(fit, 1) - polyval(fit, 0);
  close(intercept, -0.7);
  close(slope, 2.5);
  close(fitMse(fit, { xs, ys }), 0);
});

test("a degree-3 fit reproduces a cubic exactly, and mse is the mean squared residual", () => {
  const xs = [0.1, 0.2, 0.35, 0.5, 0.6, 0.8, 0.9];
  const ys = xs.map((x) => 1 - 3 * x + 2 * x * x * x);
  const fit = polyfit(xs, ys, 3);
  close(polyval(fit, 0.42), 1 - 3 * 0.42 + 2 * 0.42 ** 3, 1e-7);
  close(mse([1, 2, 3], [1, 2, 3]), 0);
  close(mse([1, 2, 3], [2, 2, 1]), (1 + 0 + 4) / 3);
  assert.throws(() => mse([1], []));
});

test("makeSineData is seeded and stays near sin(2πx)", () => {
  const a = makeSineData(19, 20, 0.3);
  const b = makeSineData(19, 20, 0.3);
  assert.deepEqual(a, b);
  assert.equal(a.xs.length, 20);
  for (let i = 1; i < a.xs.length; i++) assert.ok(a.xs[i] > a.xs[i - 1], "xs are sorted");
  const resid = mse(a.ys, a.xs.map(trueCurve));
  assert.ok(resid > 0.02 && resid < 0.3, `noise mse ${resid}`);
  assert.deepEqual(makeSineData(19, 5, 0).ys, makeSineData(19, 5, 0).xs.map(trueCurve));
});

// The figure's data: seed 19 for the 20 training points, seed 119 for the 40 test points.
test("on the figure's seeded data train MSE never rises with degree and degree 12 overfits", () => {
  const train = makeSineData(19, 20, 0.3);
  const test = makeSineData(119, 40, 0.3);
  const errs = errorByDegree(train, test, 12);
  assert.equal(errs.length, 12);
  for (let i = 1; i < errs.length; i++) {
    assert.ok(errs[i].train <= errs[i - 1].train + 1e-9, `train MSE rose at degree ${errs[i].degree}`);
  }
  const d3 = errs[2];
  const d12 = errs[11];
  assert.ok(d12.test > d3.test, `test MSE at 12 (${d12.test}) should exceed degree 3 (${d3.test})`);
  assert.ok(d12.train < d3.train, "train MSE keeps falling while test MSE rises");
  const best = bestDegree(errs);
  assert.ok(best >= 3 && best <= 6, `best degree ${best}`);
  // Degree 1 cannot follow a full sine period: high bias.
  assert.ok(errs[0].train > 0.25);
  // The two ends get labelled; the best degree sits between them.
  const r = fitRegions(errs);
  assert.equal(r.best, best);
  assert.ok(r.underEnd !== null && r.underEnd < best);
  assert.ok(r.overStart !== null && r.overStart > best && r.overStart <= 12);
  assert.equal(fitRegionOf(r, 1), "under");
  assert.equal(fitRegionOf(r, best), "sweet");
  assert.equal(fitRegionOf(r, 12), "over");
});

test("fitRegions leaves an end unlabelled when the curve never rises there", () => {
  const flat = [
    { degree: 1, train: 0.1, test: 0.1 },
    { degree: 2, train: 0.09, test: 0.1 },
    { degree: 3, train: 0.05, test: 0.3 },
  ];
  const r = fitRegions(flat);
  assert.equal(r.best, 1);
  assert.equal(r.underEnd, null);
  assert.equal(r.overStart, 3);
  assert.equal(fitRegionOf(r, 2), "sweet");
});

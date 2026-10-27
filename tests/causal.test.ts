import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "@/lib/ml/random";
import {
  covariance,
  didEstimate,
  didRegression,
  interceptThroughMean,
  makeConfounded,
  makeCorrelated,
  makeUShape,
  olsFit,
  olsMulti,
  partialCorrelation,
  pearson,
  rotateToCorrelation,
  sd,
  solveLinear,
  sse,
  waldTest,
} from "@/lib/ml/causal";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("covariance, sd and Pearson r on a hand-checkable sample", () => {
  const xs = [1, 2, 3, 4, 5];
  const ys = [2, 4, 6, 8, 10];
  close(covariance(xs, ys), 5);
  close(sd(xs), Math.sqrt(2.5));
  close(pearson(xs, ys), 1);
  close(pearson(xs, ys.map((y) => -y)), -1);
  close(pearson(xs, [3, 3, 3, 3, 3]), 0);
  // r is scale-free: Celsius or Fahrenheit, same number.
  close(pearson(xs, ys.map((y) => y * 1.8 + 32)), 1);
});

test("OLS: slope = cov / var = r · s_y / s_x, line through the means, minimal SSE", () => {
  const xs = [1, 2, 3, 4, 5, 6];
  const ys = [1.2, 1.9, 3.2, 3.8, 5.1, 5.8];
  const f = olsFit(xs, ys);
  close(f.slope, covariance(xs, ys) / covariance(xs, xs));
  close(f.slope, f.r * (sd(ys) / sd(xs)));
  close(f.intercept, interceptThroughMean(xs, ys, f.slope));
  for (const s of [f.slope - 0.3, f.slope + 0.3, 0]) {
    assert.ok(sse(xs, ys, s, interceptThroughMean(xs, ys, s)) > f.sse);
  }
  close(f.r2, f.r * f.r);
});

test("Gaussian elimination and multiple OLS recover known coefficients", () => {
  assert.deepEqual(solveLinear([[2, 1], [1, 3]], [3, 5]).map((v) => Math.round(v * 1e9) / 1e9), [0.8, 1.4]);
  const rng = createRng(21);
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < 200; i++) {
    const a = rng() * 10;
    const b = rng() * 10;
    X.push([1, a, b]);
    y.push(2 + 0.5 * a - 1.5 * b);
  }
  const beta = olsMulti(X, y);
  close(beta[0], 2, 1e-8);
  close(beta[1], 0.5, 1e-8);
  close(beta[2], -1.5, 1e-8);
  assert.throws(() => solveLinear([[1, 2], [2, 4]], [1, 2]));
});

test("Card & Krueger's four means give DiD ≈ 2.75 FTE and the interaction coefficient equals it", () => {
  const cells = { treatBefore: 20.44, treatAfter: 21.03, ctrlBefore: 23.33, ctrlAfter: 21.17 };
  const d = didEstimate(cells);
  close(d.beforeAfter, 0.59);
  close(d.crossSection, -0.14);
  close(d.controlTrend, -2.16);
  close(d.counterfactual, 18.28);
  close(d.did, 2.75);
  // Regression on the saturated model: β3 is exactly the DiD when every cell is one mean.
  const rows = [
    { treated: 1 as const, post: 0 as const, y: cells.treatBefore },
    { treated: 1 as const, post: 1 as const, y: cells.treatAfter },
    { treated: 0 as const, post: 0 as const, y: cells.ctrlBefore },
    { treated: 0 as const, post: 1 as const, y: cells.ctrlAfter },
  ];
  const b = didRegression(rows);
  close(b.b0, cells.ctrlBefore);
  close(b.b1, cells.treatBefore - cells.ctrlBefore);
  close(b.b2, d.controlTrend);
  close(b.b3, d.did);
  // Their reported SE of 1.36 puts the estimate just past the 5% line.
  const w = waldTest(2.76, 1.36);
  close(w.t, 2.029, 1e-3);
  assert.ok(w.p < 0.05 && w.p > 0.04, String(w.p));
});

test("DiD regression on unbalanced noisy panels still returns the cell-mean DiD", () => {
  const rng = createRng(4);
  const rows: { treated: 0 | 1; post: 0 | 1; y: number }[] = [];
  const cellMean = { "1,0": 10, "1,1": 14, "0,0": 7, "0,1": 8 };
  const counts = { "1,0": 30, "1,1": 30, "0,0": 12, "0,1": 12 };
  for (const key of Object.keys(cellMean) as (keyof typeof cellMean)[]) {
    const [t, p] = key.split(",").map(Number) as [0 | 1, 0 | 1];
    for (let i = 0; i < counts[key]; i++) rows.push({ treated: t, post: p, y: cellMean[key] + (rng() - 0.5) * 2 });
  }
  const b = didRegression(rows);
  const means = (t: number, p: number) => {
    const ys = rows.filter((r) => r.treated === t && r.post === p).map((r) => r.y);
    return ys.reduce((s, v) => s + v, 0) / ys.length;
  };
  close(b.b3, means(1, 1) - means(1, 0) - (means(0, 1) - means(0, 0)), 1e-9);
});

test("synthetic clouds: correlated, rotated, U-shaped and confounded", () => {
  const rng = createRng(2);
  const c = makeCorrelated(rng, 4000, 0.7, { mx: 0, sx: 1, my: 0, sy: 1 });
  close(pearson(c.xs, c.ys), 0.7, 0.03);
  const base = { u: Array.from({ length: 3000 }, () => rng() * 2 - 1), e: Array.from({ length: 3000 }, () => rng() * 2 - 1) };
  for (const r of [-0.9, 0, 0.5, 1]) {
    const xy = rotateToCorrelation(base, r, { mx: 20, sx: 5, my: 100, sy: 30 });
    close(pearson(xy.xs, xy.ys), r, 0.05);
    close(sd(xy.xs), 5 * sd(base.u), 1e-9);
  }
  const u = makeUShape(createRng(3), 400);
  assert.ok(Math.abs(pearson(u.xs, u.ys)) < 0.1, "a U has almost no linear correlation");
  const f = makeConfounded(createRng(5), 3000);
  assert.ok(pearson(f.xs, f.ys) > 0.5, "ice cream and drownings correlate");
  assert.ok(Math.abs(partialCorrelation(f.xs, f.ys, f.zs)) < 0.08, "but not once temperature is held fixed");
});

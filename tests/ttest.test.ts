import { test } from "node:test";
import assert from "node:assert/strict";
import { normalCdf } from "@/lib/ml/abtest";
import { createRng } from "@/lib/ml/random";
import {
  drawIndependent,
  drawPaired,
  logGamma,
  pairedTTest,
  regularizedIncompleteBeta,
  sampleStats,
  studentTCdf,
  studentTPdf,
  studentTQuantile,
  studentTTest,
  tPValue,
  welchTTest,
  zPValue,
} from "@/lib/ml/ttest";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("log gamma matches factorials and Γ(1/2) = √π", () => {
  close(logGamma(1), 0, 1e-12);
  close(logGamma(5), Math.log(24), 1e-12);
  close(logGamma(0.5), 0.5 * Math.log(Math.PI), 1e-12);
  close(logGamma(10.5), Math.log(1133278.3889487855), 1e-9);
});

test("regularized incomplete beta: closed forms and symmetry", () => {
  // I_x(1, 1) = x, I_x(2, 1) = x², I_x(a, b) = 1 − I_{1−x}(b, a).
  close(regularizedIncompleteBeta(0.3, 1, 1), 0.3, 1e-12);
  close(regularizedIncompleteBeta(0.6, 2, 1), 0.36, 1e-12);
  close(regularizedIncompleteBeta(0.2, 3.5, 0.5) + regularizedIncompleteBeta(0.8, 0.5, 3.5), 1, 1e-12);
  assert.equal(regularizedIncompleteBeta(0, 2, 3), 0);
  assert.equal(regularizedIncompleteBeta(1, 2, 3), 1);
});

test("t cdf matches the closed forms at df = 1 (Cauchy) and df = 2", () => {
  close(studentTCdf(0, 1), 0.5, 1e-12);
  close(studentTCdf(1, 1), 0.75, 1e-10);
  close(studentTCdf(-3, 1), 0.5 + Math.atan(-3) / Math.PI, 1e-10);
  for (const t of [-4, -1.2, 0.5, 2, 7]) close(studentTCdf(t, 2), 0.5 + t / (2 * Math.sqrt(2 + t * t)), 1e-10);
});

test("t critical values match the textbook table and shrink toward 1.96", () => {
  close(studentTQuantile(0.975, 5), 2.570582, 1e-5);
  close(studentTQuantile(0.975, 10), 2.228139, 1e-5);
  close(studentTQuantile(0.975, 30), 2.042272, 1e-5);
  close(studentTQuantile(0.975, 1e5), 1.959985, 1e-4);
  assert.ok(studentTQuantile(0.975, 3) > studentTQuantile(0.975, 30));
});

test("t has heavier tails than the normal at small df and converges as df grows", () => {
  const tail = (df: number) => 1 - studentTCdf(2.5, df);
  assert.ok(tail(3) > 3 * (1 - normalCdf(2.5)), `df 3 tail ${tail(3)}`);
  assert.ok(tail(3) > tail(10) && tail(10) > tail(100));
  close(studentTCdf(1.7, 5000), normalCdf(1.7), 1e-4);
  close(studentTPdf(0, 1), 1 / Math.PI, 1e-10);
  close(studentTPdf(0.4, 1e6), Math.exp(-0.08) / Math.sqrt(2 * Math.PI), 1e-5);
});

test("one-sided p is half the two-sided p in the observed direction", () => {
  const two = tPValue(2.1, 12);
  close(tPValue(2.1, 12, "greater"), two / 2, 1e-12);
  close(tPValue(2.1, 12, "less"), 1 - two / 2, 1e-12);
  close(zPValue(1.959964), 0.05, 1e-5);
});

test("sample stats use the n − 1 variance", () => {
  const s = sampleStats([1, 2, 3, 4, 5]);
  close(s.mean, 3);
  close(s.variance, 2.5);
});

test("Welch t and Welch–Satterthwaite df on a hand-worked example", () => {
  // a: mean 3, var 2.5; b: mean 6, var 10. se = √(0.5 + 2) = 1.5811, df = 2.5² / (0.5²/4 + 2²/4) = 5.882.
  const r = welchTTest([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
  close(r.diff, 3);
  close(r.se, Math.sqrt(2.5));
  close(r.t, 3 / Math.sqrt(2.5));
  close(r.df, 6.25 / 1.0625);
  close(r.p, 2 * (1 - studentTCdf(r.t, r.df)), 1e-12);
  assert.ok(r.p > 0.1 && r.p < 0.12, `p ${r.p}`);
  // With equal n the pooled t is the same number, only the df differs (8 vs 5.88).
  const s = studentTTest([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
  close(s.t, r.t);
  assert.equal(s.df, 8);
  assert.ok(s.p < r.p);
});

test("Student's pooled test is overconfident when the small group has the big variance", () => {
  const a = [10, 11, 9, 10, 11, 9, 10, 11, 9, 10, 11, 9, 10, 11, 9, 10];
  const b = [4, 18, 7, 16];
  const w = welchTTest(a, b);
  const s = studentTTest(a, b);
  assert.ok(s.se < w.se, `pooled se ${s.se} vs welch ${w.se}`);
  assert.ok(w.df >= 3 && w.df <= a.length + b.length - 2, `df ${w.df}`);
});

test("paired t test on before/after of the same four units", () => {
  // d = [1, 2, 1, 3]: mean 1.75, sd √(2.75 / 3), df 3.
  const r = pairedTTest([10, 12, 14, 16], [11, 14, 15, 19]);
  close(r.diff, 1.75);
  close(r.se, Math.sqrt(2.75 / 3) / 2);
  close(r.t, 1.75 / (Math.sqrt(2.75 / 3) / 2));
  assert.equal(r.df, 3);
  assert.ok(r.p > 0.03 && r.p < 0.04, `p ${r.p}`);
  // Treating the same numbers as two independent groups throws away the pairing.
  assert.ok(welchTTest([10, 12, 14, 16], [11, 14, 15, 19]).p > 0.3);
});

test("seeded draws are reproducible and pairing removes the unit-level spread", () => {
  const ind = drawIndependent(createRng(3), 50, { mean: 120, sd: 25 }, { mean: 137.5, sd: 40 });
  assert.deepEqual(ind, drawIndependent(createRng(3), 50, { mean: 120, sd: 25 }, { mean: 137.5, sd: 40 }));
  assert.ok(Math.abs(sampleStats(ind.a).mean - 120) < 12);
  const p = drawPaired(createRng(5), 40, { level: 125, levelSd: 35, effect: 12, noiseSd: 7 });
  const diffs = sampleStats(p.after.map((x, i) => x - p.before[i]));
  assert.ok(diffs.sd < sampleStats(p.before).sd / 2, `diff sd ${diffs.sd}`);
  assert.ok(pairedTTest(p.before, p.after).p < welchTTest(p.before, p.after).p);
});

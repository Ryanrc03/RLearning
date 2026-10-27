import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "@/lib/ml/random";
import {
  binomialCdf,
  binomialCriticalLow,
  binomialPmf,
  countTrue,
  drawPulls,
  histogram,
  isRejected,
  maxCdfGap,
  normalPdf,
  oneSampleZTest,
  POPULATIONS,
  power,
  proportionTest,
  rejectionRegion,
  sampleMeans,
  skewness,
  zTailProbability,
} from "@/lib/ml/clt";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("population moments match their definitions", () => {
  close(POPULATIONS.dice.mean, 3.5);
  close(POPULATIONS.dice.sd, Math.sqrt(35 / 12));
  close(POPULATIONS.ratings.mean, 0.3 * 1 + 0.1 * 3 + 0.6 * 5);
  for (const pop of Object.values(POPULATIONS)) {
    const rng = createRng(11);
    const xs = Array.from({ length: 20000 }, () => pop.draw(rng));
    const m = xs.reduce((s, x) => s + x, 0) / xs.length;
    const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
    close(m, pop.mean, pop.sd * 0.03);
    close(Math.sqrt(v), pop.sd, pop.sd * 0.05);
  }
});

test("sample means shrink in spread like σ/√n and approach the normal", () => {
  const pop = POPULATIONS.delivery;
  const m1 = sampleMeans(createRng(3), pop, 1, 4000);
  const m30 = sampleMeans(createRng(3), pop, 30, 4000);
  const spread = (xs: number[]) => {
    const m = xs.reduce((s, x) => s + x, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
  };
  close(spread(m30), pop.sd / Math.sqrt(30), 0.4);
  assert.ok(skewness(m1) > 1.5, "exponential draws are strongly right-skewed");
  assert.ok(Math.abs(skewness(m30)) < 0.5, "averages of 30 are nearly symmetric");
  const gap1 = maxCdfGap(m1, pop.mean, pop.sd);
  const gap30 = maxCdfGap(m30, pop.mean, pop.sd / Math.sqrt(30));
  assert.ok(gap1 > 0.1 && gap30 < 0.06, `gap n=1 ${gap1}, n=30 ${gap30}`);
});

test("histogram bins count every value and the density integrates to one", () => {
  const h = histogram([1, 1, 2, 3, 3, 3], 0.5, 3.5, 1);
  assert.deepEqual(h.counts, [2, 1, 3]);
  close(h.density.reduce((s, d) => s + d, 0) * 1, 1);
  assert.deepEqual(h.edges, [0.5, 1.5, 2.5, 3.5]);
});

test("normal pdf peaks at the mean with height 1/(σ√2π)", () => {
  close(normalPdf(0), 1 / Math.sqrt(2 * Math.PI));
  close(normalPdf(5, 5, 2), 1 / (2 * Math.sqrt(2 * Math.PI)));
  close(normalPdf(1.96) / normalPdf(0), Math.exp(-0.5 * 1.96 * 1.96));
});

test("one-sample z test: 36 bowls averaging 192 g against 200 g with σ = 24 g", () => {
  const r = oneSampleZTest(192, 200, 24, 36);
  close(r.se, 4);
  close(r.z, -2);
  close(r.p, 0.0455, 1e-3);
  close(oneSampleZTest(192, 200, 24, 36, "less").p, 0.02275, 1e-4);
  close(oneSampleZTest(192, 200, 24, 36, "greater").p, 0.97725, 1e-4);
  close(zTailProbability(0), 1);
});

test("rejection region at α = 5%: ±1.96 two-sided, −1.645 one-sided", () => {
  const two = rejectionRegion(0.05);
  close(two.lower!, -1.959964, 1e-5);
  close(two.upper!, 1.959964, 1e-5);
  const less = rejectionRegion(0.05, "less");
  close(less.lower!, -1.644854, 1e-5);
  assert.equal(less.upper, null);
  assert.ok(isRejected(-2.1, two));
  assert.ok(!isRejected(-1.9, two));
  assert.ok(isRejected(-1.7, less));
  assert.ok(!isRejected(2.5, less), "a one-sided test ignores the other tail");
});

test("power: α itself when there is no effect, 0.80 at the textbook δ = 2.8, and it falls as α shrinks", () => {
  close(power(0, 0.05), 0.05, 1e-6);
  close(power(2.8016, 0.05), 0.8, 1e-3);
  close(power(2, 0.05, "less"), 0, 1e-6 + power(-2, 0.05, "greater"));
  close(power(-2, 0.05, "less"), 0.6388, 1e-3);
  assert.ok(power(-2, 0.01, "less") < power(-2, 0.05, "less"));
});

test("binomial pmf and cdf agree with closed forms", () => {
  close(binomialPmf(0, 10, 0.5), 1 / 1024);
  close(binomialPmf(5, 10, 0.5), 252 / 1024);
  close(binomialCdf(10, 10, 0.5), 1);
  close(binomialCdf(2, 4, 0.5), 11 / 16);
  let total = 0;
  for (let k = 0; k <= 500; k++) total += binomialPmf(k, 500, 0.01);
  close(total, 1, 1e-9);
});

test("gacha: 2 SSR in 500 pulls does not convict a 1% banner, 8 in 2000 does", () => {
  const small = proportionTest(2, 500, 0.01, "less");
  close(small.z, -1.349, 1e-3);
  assert.ok(small.pExact > 0.05 && small.pNormal > 0.05, `${small.pExact} ${small.pNormal}`);
  close(small.pExact, binomialCdf(2, 500, 0.01));
  const big = proportionTest(8, 2000, 0.01, "less");
  assert.ok(big.pExact < 0.05 && big.pNormal < 0.05, `${big.pExact} ${big.pNormal}`);
  // Exact and normal agree once n·p0 is comfortably large.
  close(big.pExact, big.pNormal, 0.01);
  const two = proportionTest(2, 500, 0.01, "two-sided");
  assert.ok(two.pExact > small.pExact);
});

test("binomial critical value: the biggest k whose lower tail stays under α", () => {
  const k = binomialCriticalLow(2000, 0.01, 0.05);
  assert.ok(binomialCdf(k, 2000, 0.01) <= 0.05);
  assert.ok(binomialCdf(k + 1, 2000, 0.01) > 0.05);
  assert.equal(binomialCriticalLow(10, 0.5, 0.0001), -1);
});

test("pull streams are seeded and prefix-stable", () => {
  const a = drawPulls(createRng(5), 300, 0.01);
  const b = drawPulls(createRng(5), 300, 0.01);
  assert.deepEqual(a, b);
  assert.equal(countTrue(a, 300), a.filter(Boolean).length);
  assert.ok(countTrue(a, 100) <= countTrue(a, 300));
  const many = drawPulls(createRng(9), 200000, 0.01);
  close(countTrue(many, 200000) / 200000, 0.01, 0.001);
});

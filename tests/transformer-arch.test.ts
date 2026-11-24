import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "@/lib/ml/random";
import {
  BASE,
  DIVISOR_PRESETS,
  DIVISOR_SCORES,
  causalAllowed,
  dotProductVariance,
  dryRun,
  headDim,
  maskedWeights,
  multiHeadShapes,
  positionalEncoding,
  scaledWeights,
  stageShapes,
} from "@/lib/ml/transformerArch";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("base config: 8 heads of 64 dims concatenate back to 512", () => {
  assert.equal(headDim(BASE.dModel, BASE.heads), 64);
  const s = multiHeadShapes(BASE.dModel, BASE.heads, BASE.m);
  assert.deepEqual(s.perHead, [64, 4]);
  assert.deepEqual(s.concat, [512, 4]);
  assert.deepEqual(s.out, [512, 4]);
  for (const h of [1, 2, 4, 8]) assert.equal(multiHeadShapes(512, h, 4).concat[0], 512);
  assert.throws(() => headDim(512, 3));
});

test("divisor experiment on scores [8, 0] reproduces the table", () => {
  const pct = DIVISOR_PRESETS.map((c) => (scaledWeights(DIVISOR_SCORES, c)[0] * 100).toFixed(2));
  assert.deepEqual(pct, ["99.97", "88.08", "73.11", "62.25", "52.00"]);
  for (const c of DIVISOR_PRESETS) close(scaledWeights(DIVISOR_SCORES, c).reduce((a, b) => a + b, 0), 1);
});

test("the variance of q·k grows like d_k and dividing by sqrt(d_k) brings it back to about 1", () => {
  const rng = createRng(7);
  const normal = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const dK = 64, trials = 4000;
  let sum = 0, sumSq = 0;
  for (let n = 0; n < trials; n++) {
    let dot = 0;
    for (let r = 0; r < dK; r++) dot += normal() * normal();
    sum += dot; sumSq += dot * dot;
  }
  const variance = sumSq / trials - (sum / trials) ** 2;
  assert.ok(Math.abs(variance / dotProductVariance(dK) - 1) < 0.1, `variance ${variance}`);
  assert.ok(Math.abs(variance / dK - 1) < 0.1);
});

test("sinusoidal positions: sin/cos pairs, position 0, and the first frequency", () => {
  const pe = positionalEncoding(8, 512);
  assert.equal(pe.length, 8);
  assert.equal(pe[0].length, 512);
  for (let i = 0; i < 512; i += 2) { close(pe[0][i], 0); close(pe[0][i + 1], 1); }
  close(pe[1][0], Math.sin(1));
  close(pe[1][1], Math.cos(1));
  close(pe[3][2], Math.sin(3 / 10000 ** (2 / 512)));
  for (const row of pe) for (let i = 0; i < 512; i += 2) close(row[i] ** 2 + row[i + 1] ** 2, 1, 1e-12);
});

test("causal mask is lower triangular and masked keys get exactly zero weight", () => {
  const allowed = causalAllowed(4);
  assert.deepEqual(allowed[0], [true, false, false, false]);
  assert.deepEqual(allowed[3], [true, true, true, true]);
  const w = maskedWeights([1, 5, 9, 2], allowed[1]);
  assert.equal(w[2], 0); assert.equal(w[3], 0);
  close(w[0] + w[1], 1);
  assert.ok(w[1] > w[0]);
});

test("encoder self-attention shapes", () => {
  const s = stageShapes("encSelf");
  assert.deepEqual([s.q, s.k, s.v], [[64, 4], [64, 4], [64, 4]]);
  assert.deepEqual(s.scores, [4, 4]);
  assert.deepEqual(s.out, [512, 4]);
  assert.equal(s.causal, false);
});

test("decoder masked self-attention shapes", () => {
  const s = stageShapes("decSelf");
  assert.deepEqual(s.q, [64, 3]);
  assert.deepEqual(s.scores, [3, 3]);
  assert.deepEqual(s.out, [512, 3]);
  assert.equal(s.causal, true);
});

test("cross-attention: queries from the decoder, keys and values from U, output follows the queries", () => {
  const s = stageShapes("decCross");
  assert.deepEqual(s.q, [64, 3]);
  assert.deepEqual([s.k, s.v], [[64, 4], [64, 4]]);
  assert.deepEqual(s.scores, [4, 3]);
  assert.deepEqual(s.scoresRowConvention, [3, 4]);
  assert.deepEqual(s.headOut, [64, 3]);
  assert.deepEqual(s.out, [512, 3]);
  assert.equal(s.causal, false);
});

test("the dry-run table matches the hand-written one", () => {
  const rows = dryRun();
  assert.equal(rows.length, 14);
  assert.deepEqual(rows.map((r) => r.shape), [
    "512 × 4", "各 64 × 4", "4 × 4", "512 × 4", "512 × 4", "512 × 4",
    "512 × 3", "3 × 3", "64 × 3", "各 64 × 4", "4 × 3", "512 × 3", "512 × 3", "|Vocab| × 3",
  ]);
});

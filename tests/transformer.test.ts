import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyBlockDemo,
  blockShapes,
  DEMO_CONTEXT,
  DEMO_D_FF,
  DEMO_D_MODEL,
  DEMO_POS,
  DEMO_TOKEN_VEC,
  DEMO_W1,
  DEMO_W2,
  layerNormVec,
  learnedPositionsInit,
  sinusoidalFrequency,
  sinusoidalPositions,
} from "@/lib/ml/transformer";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

test("sinusoidal values stay in [−1, 1]; position 0 is sin 0 / cos 1 in every pair", () => {
  const pe = sinusoidalPositions(16, 8);
  assert.equal(pe.length, 16);
  assert.ok(pe.every((row) => row.length === 8));
  assert.ok(pe.flat().every((v) => v >= -1 && v <= 1));
  pe[0].forEach((v, j) => close(v, j % 2 === 0 ? 0 : 1));
  // first pair oscillates at frequency 1: PE[pos][0] = sin(pos)
  close(pe[3][0], Math.sin(3));
  close(pe[3][1], Math.cos(3));
  // second pair is ten times slower for d = 8: 10000^(2/8) = 10
  close(sinusoidalFrequency(1, 8), 0.1);
  close(pe[5][2], Math.sin(0.5));
  assert.throws(() => sinusoidalPositions(4, 3));
});

test("a learned table is just a seeded (T, d) parameter matrix", () => {
  const a = learnedPositionsInit(16, 4);
  const b = learnedPositionsInit(16, 4);
  assert.deepEqual(a, b);
  assert.equal(a.length, 16);
  assert.ok(a.every((row) => row.length === 4));
  assert.ok(a.flat().some((v) => v !== 0));
});

test("layerNormVec: mean 0 and std 1 at eps 0; γ and β scale and shift", () => {
  const v = [1.2, -0.4, 0.8, 0.3];
  const r = layerNormVec(v, 0);
  close(sum(r.out) / 4, 0);
  close(Math.sqrt(sum(r.out.map((x) => x * x)) / 4), 1);
  close(r.mu, 0.475);
  const g = layerNormVec(v, 0, [2, 2, 2, 2], [1, 1, 1, 1]);
  g.out.forEach((x, j) => close(x, 2 * r.out[j] + 1));
  // a constant vector has σ = 0 and normalises to all zeros instead of NaN
  const c = layerNormVec([3, 3, 3], 0);
  assert.ok(c.out.every((x) => x === 0));
});

test("blockShapes: (B, T, d_model) in and out, (B, h, T, T) attention weights, (B, h, T, d_k) per head", () => {
  const s = blockShapes(2, 8, 512, 8, 2048);
  const edge = (k: string) => s.edges.find((e) => e.key === k)!;
  assert.deepEqual(edge("embed").shape, [2, 8, 512]);
  assert.deepEqual(edge("out").shape, [2, 8, 512]);
  assert.deepEqual(edge("weights").shape, [2, 8, 8, 8]);
  assert.deepEqual(edge("qkv").shape, [2, 8, 8, 64]);
  assert.deepEqual(edge("hidden").shape, [2, 8, 2048]);
  assert.equal(s.dK, 64);
  assert.equal(edge("tokens").symbolic, "(B, T)");
  assert.throws(() => blockShapes(1, 4, 10, 4, 16));
});

test("the toy walk-through: causal attention over the context, LN rows normalised, MLP shapes 4 → 8 → 4", () => {
  const pe = sinusoidalPositions(DEMO_CONTEXT.length, DEMO_D_MODEL);
  const r = applyBlockDemo(pe);
  assert.deepEqual(r.e, DEMO_TOKEN_VEC);
  r.x0.forEach((x, j) => close(x, DEMO_TOKEN_VEC[j] + pe[DEMO_POS][j]));
  assert.equal(r.attn.length, DEMO_CONTEXT.length);
  close(sum(r.attn), 1);
  assert.ok(r.attn.every((a) => a > 0));
  // the followed token is the last one, so nothing is masked; with pos 0 it could only see itself
  const first = applyBlockDemo(pe, DEMO_CONTEXT, 0);
  close(first.attn[0], 1);
  assert.equal(first.attn[1], 0);
  assert.equal(first.scores[2], -Infinity);
  // residual then LayerNorm
  r.x1.forEach((x, j) => close(x, r.x0[j] + r.delta[j]));
  close(sum(r.ln1.out) / DEMO_D_MODEL, 0, 1e-6);
  assert.equal(r.hidden.length, DEMO_D_FF);
  assert.equal(DEMO_W1.length, DEMO_D_FF);
  assert.equal(DEMO_W2[0].length, DEMO_D_FF);
  assert.ok(r.hidden.every((h) => h >= 0));
  assert.equal(r.mlp.length, DEMO_D_MODEL);
  r.x2.forEach((x, j) => close(x, r.ln1.out[j] + r.mlp[j]));
  close(sum(r.ln2.out) / DEMO_D_MODEL, 0, 1e-6);
  assert.ok([...r.x0, ...r.delta, ...r.ln1.out, ...r.hidden, ...r.mlp, ...r.ln2.out].every(Number.isFinite));
});

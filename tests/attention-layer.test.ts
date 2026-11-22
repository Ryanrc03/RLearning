import { test } from "node:test";
import assert from "node:assert/strict";
import {
  A_CROSS,
  A_SELF,
  CROSS_KEYS,
  LAYER_DIMS,
  SELF_TOKENS,
  attentionColumn,
  attentionRows,
  layerShapes,
  matmul,
  matmulShape,
  transpose,
  type Matrix,
} from "@/lib/ml/attentionLayer";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// X: 3 key/value tokens of width 2; X': 2 query tokens of width 2.
const x: Matrix = [[1, 0], [0, 1], [1, 1]];
const xq: Matrix = [[0.5, -1], [2, 0.3]];
const wQ: Matrix = [[0.4, -0.2], [0.1, 0.7]];
const wK: Matrix = [[0.3, 0.8], [-0.5, 0.2]];
const wV: Matrix = [[1, 0, 2], [0, -1, 1]];

test("cross-attention shapes: 5 × 4 weights and a 5 × 32 output", () => {
  const s = layerShapes(LAYER_DIMS.cross);
  assert.deepEqual(s.q, [5, 64]);
  assert.deepEqual(s.k, [4, 64]);
  assert.deepEqual(s.kT, [64, 4]);
  assert.deepEqual(s.v, [4, 32]);
  assert.deepEqual(s.a, [5, 4]);
  assert.deepEqual(s.c, [5, 32]);
  assert.deepEqual([s.wQ, s.wK, s.wV], [[128, 64], [128, 64], [128, 32]]);
});

test("self-attention shapes: 4 × 4 weights and a 4 × 32 output", () => {
  const s = layerShapes(LAYER_DIMS.self);
  assert.deepEqual(s.q, [4, 64]);
  assert.deepEqual(s.a, [4, 4]);
  assert.deepEqual(s.c, [4, 32]);
});

test("the output has one row per query and the width of the values", () => {
  const d = { m: 7, t: 3, dSrc: 10, dTgt: 12, dK: 6, dV: 9 };
  const s = layerShapes(d);
  assert.deepEqual(s.c, [d.t, d.dV]);
  assert.throws(() => matmulShape([5, 64], [4, 64]));
});

test("the example weight matrices are row-normalised and match their labels", () => {
  assert.equal(A_CROSS.length, LAYER_DIMS.cross.t);
  assert.equal(A_SELF.length, SELF_TOKENS.length);
  for (const row of A_CROSS) { assert.equal(row.length, CROSS_KEYS.length); close(sum(row), 1); }
  for (const row of A_SELF) { assert.equal(row.length, SELF_TOKENS.length); close(sum(row), 1); }
});

test("row convention: each row of A sums to 1 and C = A V has one row per query", () => {
  const { weights, context } = attentionRows(matmul(xq, wQ), matmul(x, wK), matmul(x, wV));
  assert.equal(weights.length, 2);
  assert.equal(weights[0].length, 3);
  weights.forEach((row) => close(sum(row), 1));
  assert.equal(context.length, 2);
  assert.equal(context[0].length, 3);
});

test("the lecture's column form V·softmax(Kᵀq) gives the same context as the row form softmax(QKᵀ)·V", () => {
  const q = matmul(xq, wQ);
  const k = matmul(x, wK);
  const v = matmul(x, wV);
  const rows = attentionRows(q, k, v);
  q.forEach((qj, j) => {
    const col = attentionColumn(transpose(k), transpose(v), qj);
    col.weights.forEach((w, i) => close(w, rows.weights[j][i]));
    col.context.forEach((c, d) => close(c, rows.context[j][d]));
  });
});

test("self-attention is the same layer with X' = X, and Q, K, V still differ", () => {
  const q = matmul(x, wQ);
  const k = matmul(x, wK);
  const { weights, context } = attentionRows(q, k, matmul(x, wV));
  assert.equal(weights.length, x.length);
  assert.equal(weights[0].length, x.length);
  assert.equal(context.length, x.length);
  assert.notDeepEqual(q, k);
});

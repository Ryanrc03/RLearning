import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMatrix,
  attention,
  buildCausalMask,
  DEMO_CROSS,
  DEMO_DEC,
  DEMO_TARGET,
  attend,
  attentionWeights,
  DEMO_ATTENTION,
  DEMO_E,
  DEMO_HEADS,
  DEMO_TOKENS,
  DEMO_WO,
  DEMO_WQ,
  matmul,
  multiHeadAttention,
  multiHeadParams,
  paramCount,
  project,
  scaledScores,
  selfAttention,
  splitHeads,
} from "@/lib/ml/attention";
import { dot } from "@/lib/ml/clip";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const shape = (m: number[][]) => [m.length, m[0].length];

test("project is X W: a 4×4 X times a 4×4 W, checked against a hand-computed entry", () => {
  const Q = project(DEMO_E, DEMO_WQ);
  assert.deepEqual(shape(Q), [4, 4]);
  // Q[0][0] = Σ_k E[0][k] · W_Q[k][0]
  close(Q[0][0], dot(DEMO_E[0], DEMO_WQ.map((row) => row[0])));
  assert.throws(() => matmul([[1, 2]], [[1, 2]]));
});

test("every row of A sums to 1 and every weight is positive", () => {
  const { A } = selfAttention(DEMO_E, DEMO_ATTENTION);
  assert.equal(A.length, DEMO_TOKENS.length);
  A.forEach((row) => {
    close(sum(row), 1);
    assert.ok(row.every((w) => w > 0 && w < 1));
  });
});

test("identical keys give equal weights, whatever the query", () => {
  const Q = [
    [1, -2, 0.5],
    [0, 0, 3],
  ];
  const K = [
    [0.3, 0.3, 0.3],
    [0.3, 0.3, 0.3],
    [0.3, 0.3, 0.3],
    [0.3, 0.3, 0.3],
  ];
  const A = attentionWeights(scaledScores(Q, K));
  assert.deepEqual(shape(A), [2, 4]);
  A.forEach((row) => row.forEach((w) => close(w, 0.25)));
});

test("scaledScores divides q·k by √d_k: the Ryan→I cell matches a hand computation", () => {
  const { Q, K, S, dK } = selfAttention(DEMO_E, DEMO_ATTENTION);
  assert.equal(dK, 4);
  close(S[3][1], dot(Q[3], K[1]) / Math.sqrt(4));
  // Unscaled scores are exactly twice as large when d_k = 4.
  const raw = matmul(Q, K[0].map((_, j) => K.map((row) => row[j])));
  S.forEach((row, i) => row.forEach((s, j) => close(s, raw[i][j] / 2)));
});

test("attend mixes the values: out_i = Σ_j A_ij V_j, shape T × d", () => {
  const { A, V, out, updated } = selfAttention(DEMO_E, DEMO_ATTENTION);
  assert.deepEqual(shape(out), [4, 4]);
  const byHand = A.map((row) => V[0].map((_, c) => sum(row.map((a, j) => a * V[j][c]))));
  out.forEach((row, i) => row.forEach((x, j) => close(x, byHand[i][j])));
  assert.deepEqual(attend(A, V), out);
  // E' = E + ΔE
  assert.ok(updated);
  assert.deepEqual(updated, addMatrix(DEMO_E, out));
});

test("the demo sentence: Ryan looks mostly at I, and no row is degenerate", () => {
  const { A } = selfAttention(DEMO_E, DEMO_ATTENTION);
  const ryan = A[3];
  const argmax = ryan.indexOf(Math.max(...ryan));
  assert.equal(DEMO_TOKENS[argmax], "I");
  assert.ok(ryan[1] > 0.5, `Ryan→I = ${ryan[1]}`);
  A.forEach((row) => assert.ok(Math.max(...row) < 0.8 && Math.min(...row) > 0.04));
});

test("paramCount(12288, 128): W_Q and W_K are 12,288 × 128 each; W_V defaults to the same", () => {
  const c = paramCount(12288, 128);
  assert.equal(c.wq, 12288 * 128);
  assert.equal(c.wk, 12288 * 128);
  assert.equal(c.wv, 12288 * 128);
  assert.equal(c.total, 3 * 12288 * 128);
  // The notes' sketch with a full-size value matrix.
  assert.equal(paramCount(12288, 128, 12288).wv, 12288 * 12288);
});

test("multi-head parameter total is 4 d_model² for every h", () => {
  for (const h of [1, 2, 4, 8, 16]) {
    const p = multiHeadParams(128, h);
    assert.equal(p.dK * h, 128);
    assert.equal(p.perHead, 128 * p.dK);
    assert.equal(p.wq, 128 * 128);
    assert.equal(p.wk, 128 * 128);
    assert.equal(p.wv, 128 * 128);
    assert.equal(p.wo, 128 * 128);
    assert.equal(p.total, 4 * 128 * 128);
  }
  assert.equal(multiHeadParams(128, 8).total, 65536);
  // GPT-3: d_model 12,288 with d_k 128 means 96 heads.
  const g = multiHeadParams(12288, 96);
  assert.equal(g.dK, 128);
  assert.equal(g.perHead, 12288 * 128);
  assert.equal(g.total, 4 * 12288 * 12288);
  assert.throws(() => multiHeadParams(128, 3));
});

test("splitHeads cuts d_model into h contiguous slices that concatenate back to d_model", () => {
  const slices = splitHeads(128, 8);
  assert.equal(slices.length, 8);
  assert.equal(sum(slices.map((s) => s.width)), 128);
  slices.forEach((s, i) => {
    assert.equal(s.width, 16);
    assert.equal(s.start, i * 16);
    assert.equal(s.end, (i + 1) * 16);
  });
  assert.deepEqual(splitHeads(4, 1), [{ head: 0, start: 0, end: 4, width: 4 }]);
});

test("multiHeadAttention: concat is T × (h · d_v) = T × d_model, output T × d_model, heads differ", () => {
  const r = multiHeadAttention(DEMO_E, DEMO_HEADS, DEMO_WO);
  assert.equal(r.heads.length, 2);
  r.heads.forEach((h) => {
    assert.deepEqual(shape(h.out), [4, 2]);
    assert.equal(h.updated, null);
    h.A.forEach((row) => close(sum(row), 1));
  });
  assert.deepEqual(shape(r.concat), [4, 4]);
  assert.deepEqual(shape(r.out), [4, 4]);
  assert.deepEqual(r.concat[3], [...r.heads[0].out[3], ...r.heads[1].out[3]]);
  // For Ryan, head 1 peaks on I and head 2 on am.
  const a = r.heads[0].A[3];
  const b = r.heads[1].A[3];
  assert.equal(a.indexOf(Math.max(...a)), 1);
  assert.equal(b.indexOf(Math.max(...b)), 2);
  assert.ok(a[1] > 0.5 && b[2] > 0.5);
});

test("attention with Xq = Xkv and no mask is exactly selfAttention", () => {
  const a = attention(DEMO_E, DEMO_E, DEMO_ATTENTION);
  const b = selfAttention(DEMO_E, DEMO_ATTENTION);
  assert.deepEqual(a.A, b.A);
  assert.deepEqual(a.out, b.out);
});

test("masked self-attention on the decoder: row i puts zero weight on every later token", () => {
  const n = DEMO_DEC.length;
  const { A } = attention(DEMO_DEC, DEMO_DEC, DEMO_ATTENTION, buildCausalMask(n));
  assert.deepEqual(shape(A), [n, n]);
  A.forEach((row, i) => {
    close(sum(row), 1);
    row.forEach((w, j) => (j > i ? assert.equal(w, 0) : assert.ok(w > 0)));
  });
  assert.deepEqual(A[0], [1, 0, 0]);
});

test("cross-attention: Q from 3 decoder tokens, K and V from 4 encoder outputs → A is 3 × 4", () => {
  const enc = selfAttention(DEMO_E, DEMO_ATTENTION).updated!;
  const r = attention(DEMO_DEC, enc, DEMO_CROSS);
  assert.equal(DEMO_TARGET.length, 3);
  assert.deepEqual(shape(r.Q), [3, 4]);
  assert.deepEqual(shape(r.K), [4, 4]);
  assert.deepEqual(shape(r.A), [3, 4]);
  assert.deepEqual(shape(r.out), [3, 4]);
  r.A.forEach((row) => close(sum(row), 1));
  // 你好 → Hi, 我 → I, 是 → Ryan, each above 0.6.
  [0, 1, 3].forEach((j, i) => {
    assert.equal(r.A[i].indexOf(Math.max(...r.A[i])), j);
    assert.ok(r.A[i][j] > 0.6);
  });
});

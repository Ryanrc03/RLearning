import { test } from "node:test";
import assert from "node:assert/strict";
import {
  argmax,
  clipLoss,
  cosineSimilarity,
  l2Normalize,
  lerpMatrix,
  logSumExp,
  multiPositiveRowLoss,
  S_DUP,
  S_AFTER,
  S_BEFORE,
  softmax,
  subMatrix,
} from "@/lib/ml/clip";
import { buildBidirectionalMask, buildCausalMask, DEMO_SCORES, maskedAttention } from "@/lib/ml/attention";
import { patchCount, qwen2vlTokens } from "@/lib/ml/patches";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

test("l2Normalize gives unit length and cosine is scale-invariant", () => {
  const u = l2Normalize([3, 4]);
  close(u[0], 0.6);
  close(u[1], 0.8);
  close(cosineSimilarity([1, 2, 3], [2, 4, 6]), 1);
  close(cosineSimilarity([1, 0], [0, 5]), 0);
  assert.throws(() => l2Normalize([0, 0]));
});

test("softmax is stable for huge logits and sums to 1", () => {
  const p = softmax([1000, 1001, 999]);
  assert.ok(p.every(Number.isFinite));
  close(sum(p), 1);
  assert.equal(argmax(p), 1);
  const q = softmax([-1e6, 0, 1e6]);
  close(q[2], 1);
  close(logSumExp([1e4, 1e4]), 1e4 + Math.log(2));
});

test("softmax gives masked (−∞) positions exactly zero weight", () => {
  const p = softmax([1, -Infinity, 2]);
  assert.equal(p[1], 0);
  close(sum(p), 1);
});

test("CLIP: S_after, τ = 0.1, cat row logits and probability", () => {
  const r = clipLoss(subMatrix(S_AFTER, 3), 0.1);
  r.logits[0].forEach((z, j) => close(z, [8.3, 2.0, 1.0][j]));
  close(r.probI2T[0][0], Math.exp(8.3) / (Math.exp(8.3) + Math.exp(2) + Math.exp(1)));
  assert.ok(r.probI2T[0][0] > 0.997);
});

test("CLIP: every row (I→T) and column (T→I) softmax sums to 1", () => {
  for (const S of [S_BEFORE, S_AFTER]) {
    for (const n of [2, 3, 4]) {
      for (const tau of [0.05, 0.1, 0.27, 0.5]) {
        const r = clipLoss(subMatrix(S, n), tau);
        r.probI2T.forEach((row) => close(sum(row), 1));
        r.probT2I.forEach((col) => close(sum(col), 1));
        assert.ok(Number.isFinite(r.loss) && r.loss >= 0);
      }
    }
  }
});

test("CLIP: T→I uses columns, not rows", () => {
  const r = clipLoss(subMatrix(S_BEFORE, 3), 0.1);
  const col0 = [0.3, 0.36, 0.21].map((s) => s / 0.1);
  close(r.rowLossT2I[0], logSumExp(col0) - col0[0]);
  const row0 = [0.3, 0.35, 0.25].map((s) => s / 0.1);
  close(r.rowLossI2T[0], logSumExp(row0) - row0[0]);
  close(r.loss, (r.lossI2T + r.lossT2I) / 2);
});

test("CLIP: before alignment the cat image prefers the dog caption", () => {
  const r = clipLoss(subMatrix(S_BEFORE, 3), 0.1);
  assert.equal(argmax(r.probI2T[0]), 1);
  assert.ok(clipLoss(subMatrix(S_AFTER, 3), 0.1).loss < r.loss);
});

test("CLIP: smaller τ is not always better — a wrong row gets a larger loss", () => {
  const S = subMatrix(S_BEFORE, 3);
  assert.ok(clipLoss(S, 0.05).rowLossI2T[0] > clipLoss(S, 0.5).rowLossI2T[0]);
  const A = subMatrix(S_AFTER, 3);
  assert.ok(clipLoss(A, 0.05).loss < clipLoss(A, 0.5).loss);
});

test("CLIP: extreme logits stay finite", () => {
  const r = clipLoss([[1, -1], [-1, 1]], 1e-4);
  assert.ok(Number.isFinite(r.loss));
  close(r.loss, 0);
  const bad = clipLoss([[-1, 1], [1, -1]], 1e-4);
  assert.ok(Number.isFinite(bad.loss));
  close(bad.loss, 2e4, 1e-3);
  assert.throws(() => clipLoss([[1]], 0));
});

test("multi-positive loss is never larger than the single-positive loss", () => {
  const row = S_DUP[0].map((s) => s / 0.1);
  const single = logSumExp(row) - row[0];
  const multi = multiPositiveRowLoss(row, [0, 3]);
  assert.ok(multi < single);
  assert.ok(single > 0.3);
  close(multiPositiveRowLoss(row, [0]), single);
});

test("lerpMatrix endpoints", () => {
  assert.deepEqual(lerpMatrix(S_BEFORE, S_AFTER, 0), S_BEFORE);
  lerpMatrix(S_BEFORE, S_AFTER, 1).forEach((row, i) => row.forEach((x, j) => close(x, S_AFTER[i][j])));
});

test("causal mask: row i can read only j ≤ i", () => {
  const m = buildCausalMask(4);
  m.forEach((row, i) => row.forEach((x, j) => assert.equal(x, j <= i ? 0 : -Infinity)));
  assert.ok(buildBidirectionalMask(4).flat().every((x) => x === 0));
});

test("masked attention: future weights are 0 and rows sum to 1", () => {
  const w = maskedAttention(DEMO_SCORES, buildCausalMask(4), 4);
  w.forEach((row, i) => {
    close(sum(row), 1);
    row.forEach((x, j) => (j > i ? assert.equal(x, 0) : assert.ok(x > 0)));
  });
  close(w[0][0], 1);
  maskedAttention(DEMO_SCORES, buildBidirectionalMask(4), 4).forEach((row) => {
    close(sum(row), 1);
    assert.ok(row.every((x) => x > 0));
  });
});

test("patch counts for a 224×224 input", () => {
  assert.equal(patchCount(224, 224, 8), 784);
  assert.equal(patchCount(224, 224, 16), 196);
  assert.equal(patchCount(224, 224, 32), 49);
  assert.throws(() => patchCount(224, 224, 15));
});

test("Qwen2-VL: 224×224 becomes 66 tokens", () => {
  assert.deepEqual(qwen2vlTokens(224, 224), { patches: 256, merged: 64, withSpecial: 66 });
});

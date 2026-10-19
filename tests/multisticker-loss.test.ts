import { test } from "node:test";
import assert from "node:assert/strict";
import { intentLoss, loraLayer, lossToProb, retrievalLoss, stickerNegatives, totalLoss, uniformLoss } from "@/lib/ml/multistickerLoss";

const close = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const negs = stickerNegatives();

test("negatives: seeded, 6,757 of them, centred near 0.20", () => {
  assert.equal(negs.length, 6757);
  assert.deepEqual(stickerNegatives().slice(0, 5), negs.slice(0, 5));
  const mean = negs.reduce((a, b) => a + b, 0) / negs.length;
  close(mean, 0.2, 0.005);
});

test("uniform guessing costs log(6758) ≈ 8.82; the logged head_only loss 7.03 means p ≈ 0.00088", () => {
  close(uniformLoss(), 8.8185);
  close(lossToProb(7.03), 0.000885, 1e-5);
  assert.ok(lossToProb(7.03) / (1 / 6758) > 5.9);
});

test("loss = logZ − gold logit, and it falls as the gold similarity rises", () => {
  const a = retrievalLoss(0.3, negs);
  close(a.loss, a.logZ - a.goldLogit, 1e-9);
  close(a.pGold, Math.exp(-a.loss), 1e-12);
  const b = retrievalLoss(0.45, negs);
  assert.ok(b.loss < a.loss && b.rank < a.rank);
});

test("rank 1 is not the end of training: the bank still holds most of the probability", () => {
  const r = retrievalLoss(0.45, negs);
  assert.equal(r.rank, 1);
  assert.ok(r.pGold < 0.01, String(r.pGold));
  assert.ok(r.loss > 5);
});

test("gradient on the gold similarity is (p − 1)/τ", () => {
  const r = retrievalLoss(0.3, negs);
  close(r.gradGold, (r.pGold - 1) / 0.07, 1e-9);
  assert.ok(r.gradGold < -14);
});

test("intent auxiliary loss and the total", () => {
  close(intentLoss(0.5), Math.LN2);
  close(totalLoss(7, intentLoss(0.5)), 7 + 0.2 * Math.LN2);
});

test("LoRA on one text-tower c_fc (2048 × 512), r = 8, α = 16", () => {
  const l = loraLayer(2048, 512, 8, 16);
  assert.equal(l.frozen, 1_048_576);
  assert.equal(l.trainable, 20_480);
  close(l.share, 0.0195, 1e-4);
  assert.equal(l.scale, 2);
});

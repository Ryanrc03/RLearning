import { test } from "node:test";
import assert from "node:assert/strict";
import { CHINESE_BASE_PARAMS, collapseOf, crossEntropy, DEFAULT_RUN, DEMO_CONFUSION, encode, encodeBatch, headParams, logitGrad, lrAt, perClass, simulateRun, softmax, SPECIAL_IDS, summary } from "@/lib/ml/finetune";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("encode wraps characters in [CLS] … [SEP], pads with [PAD] and masks the padding", () => {
  const e = encode("国补到账了", 16, 10);
  assert.deepEqual(e.tokens.slice(0, 7), ["[CLS]", "国", "补", "到", "账", "了", "[SEP]"]);
  assert.equal(e.tokens.length, 10);
  assert.deepEqual(e.attentionMask, [1, 1, 1, 1, 1, 1, 1, 0, 0, 0]);
  assert.equal(e.inputIds[0], SPECIAL_IDS["[CLS]"]);
  assert.equal(e.inputIds[6], SPECIAL_IDS["[SEP]"]);
  assert.equal(e.inputIds[9], SPECIAL_IDS["[PAD]"]);
  assert.ok(e.tokenTypeIds.every((t) => t === 0));
  assert.equal(e.truncated, 0);
});

test("encode truncates long text so [SEP] still fits inside max_len", () => {
  const e = encode("一二三四五六七八九十", 8);
  assert.equal(e.tokens.length, 8);
  assert.equal(e.tokens[7], "[SEP]");
  assert.equal(e.truncated, 4);
});

test("encodeBatch pads every row to the longest row of the batch", () => {
  const b = encodeBatch(["好", "国补什么时候发"], 16);
  assert.ok(b.every((r) => r.tokens.length === 9));
  assert.equal(b[0].attentionMask.reduce((a, c) => a + c, 0), 3);
});

test("softmax sums to 1, cross-entropy is −log p_y and the logit gradient is p − y", () => {
  const p = softmax([2, 0.5, -1]);
  close(p.reduce((a, b) => a + b, 0), 1);
  close(crossEntropy(p, 0), -Math.log(p[0]));
  const g = logitGrad(p, 2);
  close(g[2], p[2] - 1);
  close(g.reduce((a, b) => a + b, 0), 0);
});

test("parameter counts: a 768 → 3 head has 2,307; the Chinese base body is 102,267,648", () => {
  assert.equal(headParams(768, 3), 2307);
  assert.equal(CHINESE_BASE_PARAMS, 102_267_648);
});

test("lr schedule warms up linearly, peaks, then decays linearly to 0", () => {
  assert.equal(lrAt(0, 100, 10, 2e-5), 0);
  close(lrAt(5, 100, 10, 2e-5), 1e-5);
  close(lrAt(10, 100, 10, 2e-5), 2e-5);
  close(lrAt(55, 100, 10, 2e-5), 1e-5);
  assert.equal(lrAt(100, 100, 10, 2e-5), 0);
});

test("the default toy run: 32 steps, loss falls, validation accuracy ends high", () => {
  const r = simulateRun();
  assert.equal(r.length, 33);
  assert.ok(r[32].valLoss < r[0].valLoss / 4);
  assert.ok(r[32].valAcc >= 0.95);
  close(r[32].budget, 1);
  assert.deepEqual(simulateRun().map((s) => s.valLoss), r.map((s) => s.valLoss), "seeded: same run twice");
});

test("five times the learning rate learns fast, then washes the features out", () => {
  const r = simulateRun({ ...DEFAULT_RUN, peakLr: 1e-4 });
  const best = Math.max(...r.map((s) => s.valAcc));
  assert.ok(best >= 0.95);
  assert.ok(r[32].valAcc < 0.5);
  assert.equal(collapseOf(r[32].budget), 1);
});

test("dev-set metrics: accuracy 0.828 hides a neutral class at F1 0.550; macro-F1 is 0.770", () => {
  const pc = perClass(DEMO_CONFUSION);
  const s = summary(DEMO_CONFUSION);
  assert.equal(s.total, 600);
  assert.equal(Math.round(s.accuracy * 1000), 828);
  assert.equal(Math.round(pc[1].f1 * 1000), 550);
  assert.equal(Math.round(s.macroF1 * 1000), 770);
  assert.equal(Math.round(s.weightedF1 * 1000), 825);
});

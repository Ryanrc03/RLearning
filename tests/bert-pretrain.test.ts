import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BERT_SIZES,
  FINETUNE_TASKS,
  JOINT_EXAMPLE,
  JOINT_TOKENS,
  MLM_EXAMPLES,
  MLM_SENTENCE,
  NSP_EXAMPLES,
  SLIDE_LARGE_PARAMS_M,
  binaryCrossEntropy,
  crossEntropy,
  jointLoss,
  meanLoss,
  mlmExampleLoss,
  mlmInput,
  nspLoss,
  sigmoidAsSoftmax,
} from "@/lib/ml/bertPretrain";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("MLM example: predicting cat with probability 0.75 costs about 0.288", () => {
  const cat = MLM_EXAMPLES[0];
  assert.equal(cat.target, "cat");
  assert.deepEqual(mlmInput(cat), ["the", "[MASK]", "sat", "on", "the", "mat"]);
  assert.equal(mlmExampleLoss(cat).toFixed(3), "0.288");
  close(crossEntropy([0.75, 0.15, 0.08, 0.02], 0), -Math.log(0.75));
});

test("every MLM candidate list is a distribution and its target is the masked token", () => {
  for (const e of MLM_EXAMPLES) {
    close(e.candidates.reduce((a, c) => a + c.p, 0), 1);
    assert.equal(e.candidates[0].token, e.target);
    assert.equal(MLM_SENTENCE[e.position], e.target);
    assert.equal(mlmInput(e).filter((t) => t === "[MASK]").length, 1);
  }
});

test("NSP: y = 1 with p = 0.8 costs about 0.223; the negative pair is scored on 1 − p", () => {
  const [next, random] = NSP_EXAMPLES;
  assert.equal(nspLoss(next).toFixed(3), "0.223");
  close(nspLoss(random), -Math.log(1 - random.pIsNext));
  assert.equal(next.y, 1); assert.equal(random.y, 0);
  assert.throws(() => binaryCrossEntropy(1, 1));
});

test("sigmoid on one logit equals softmax over two logits", () => {
  for (const z of [-3, -0.4, 0, 1.386, 5]) {
    const r = sigmoidAsSoftmax(z);
    close(r.viaSigmoid, r.viaSoftmax, 1e-12);
  }
});

test("joint example: masks sit on [MASK] tokens and the two ways of adding the losses differ", () => {
  for (const m of JOINT_EXAMPLE.masks) assert.equal(JOINT_TOKENS[m.position], "[MASK]");
  assert.equal(JOINT_TOKENS[0], "[CLS]");
  assert.equal(JOINT_TOKENS.filter((t) => t === "[SEP]").length, 2);
  const j = jointLoss();
  assert.deepEqual([j.nsp, ...j.mlmEach].map((x) => x.toFixed(3)), ["0.223", "0.511", "0.105"]);
  close(j.mlm, meanLoss(j.mlmEach));
  assert.equal(j.mlm.toFixed(3), "0.308");
  assert.equal(j.total.toFixed(3), "0.531");
  assert.equal(j.sumOfThree.toFixed(3), "0.839");
  close(j.total, j.mlm + j.nsp);
});

test("model sizes follow the paper: Large has 340M parameters, not the slide's 235M", () => {
  const [base, large] = BERT_SIZES;
  assert.deepEqual([base.layers, base.hidden, base.heads, base.paramsM], [12, 768, 12, 110]);
  assert.deepEqual([large.layers, large.hidden, large.heads, large.paramsM], [24, 1024, 16, 340]);
  assert.notEqual(large.paramsM, SLIDE_LARGE_PARAMS_M);
  for (const s of BERT_SIZES) assert.equal(s.hidden / s.heads, 64);
});

test("fine-tuning tasks read valid positions: [CLS] only for classification", () => {
  assert.equal(FINETUNE_TASKS.length, 3);
  for (const t of FINETUNE_TASKS) for (const i of t.used) assert.ok(i >= 0 && i < t.example.length);
  const sentiment = FINETUNE_TASKS[0];
  assert.deepEqual(sentiment.used, [0]);
  assert.equal(sentiment.example[0], "[CLS]");
});

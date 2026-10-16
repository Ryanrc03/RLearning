import { test } from "node:test";
import assert from "node:assert/strict";
import { causalLossTerms, DEMO_NSP, DEMO_PROBS, DEMO_SENTENCE, inputTokens, MASKED_IDX, maskedLossTerms, nspTerm, visibleTokens } from "@/lib/ml/pretrain";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("the demo sentence has six tokens, one toy probability per token under each objective", () => {
  assert.equal(DEMO_SENTENCE.length, 6);
  assert.equal(DEMO_PROBS.causal.length, 6);
  assert.equal(DEMO_PROBS.masked.length, 6);
  assert.ok(MASKED_IDX.every((i) => i >= 0 && i < 6));
});

test("causal: one term per position, sum equals −Σ log p", () => {
  const r = causalLossTerms(DEMO_PROBS.causal);
  assert.equal(r.terms.length, 6);
  r.terms.forEach((t, i) => {
    assert.equal(t.pos, i);
    close(t.term, -Math.log(DEMO_PROBS.causal[i]));
  });
  close(r.total, -DEMO_PROBS.causal.reduce((s, p) => s + Math.log(p), 0));
});

test("masked: only the masked positions contribute", () => {
  const r = maskedLossTerms(DEMO_PROBS.masked, MASKED_IDX);
  assert.deepEqual(r.terms.map((t) => t.pos), [...MASKED_IDX].sort((a, b) => a - b));
  close(r.total, -MASKED_IDX.reduce((s, i) => s + Math.log(DEMO_PROBS.masked[i]), 0));
  assert.ok(r.total < causalLossTerms(DEMO_PROBS.masked).total);
  assert.equal(maskedLossTerms(DEMO_PROBS.masked, []).total, 0);
});

test("nspTerm(0.9, 1) = 0.105 and the y = 0 branch uses 1 − p", () => {
  close(nspTerm(0.9, 1), 0.10536051565782628);
  close(nspTerm(0.9, 0), -Math.log(0.1));
  close(nspTerm(DEMO_NSP.p, DEMO_NSP.y), 0.105, 1e-3);
  assert.throws(() => nspTerm(1, 1));
});

test("every loss term is positive", () => {
  const all = [...causalLossTerms(DEMO_PROBS.causal).terms, ...maskedLossTerms(DEMO_PROBS.masked, MASKED_IDX).terms];
  assert.ok(all.every((t) => t.term > 0));
  assert.ok(nspTerm(DEMO_NSP.p, DEMO_NSP.y) > 0);
  assert.throws(() => causalLossTerms([0]));
});

test("visible context: GPT sees tokens before t, BERT sees everything", () => {
  const T = DEMO_SENTENCE.length;
  assert.deepEqual(visibleTokens("causal", T, 0), [false, false, false, false, false, false]);
  assert.deepEqual(visibleTokens("causal", T, 3), [true, true, true, false, false, false]);
  assert.ok(visibleTokens("masked", T, 2).every(Boolean));
  assert.deepEqual(inputTokens("causal", DEMO_SENTENCE, MASKED_IDX), ["[BOS]", ...DEMO_SENTENCE]);
  const bert = inputTokens("masked", DEMO_SENTENCE, MASKED_IDX);
  assert.equal(bert[0], "[CLS]");
  assert.equal(bert.filter((t) => t === "[MASK]").length, MASKED_IDX.length);
  MASKED_IDX.forEach((i) => assert.equal(bert[i + 1], "[MASK]"));
});

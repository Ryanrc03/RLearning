import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLabels, IGNORE_INDEX, lossMask, SFT_SAMPLES, sftLoss, type SftToken } from "@/lib/ml/sft";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

const tiny: SftToken[] = [
  { text: "<|user|>", role: "prompt", p: 0.5, special: true },
  { text: "hi", role: "prompt", p: 0.1 },
  { text: "<|assistant|>", role: "prompt", p: 0.9, special: true },
  { text: "hello", role: "response", p: 0.25 },
  { text: "<|end|>", role: "response", p: 0.5, special: true },
];

test("masking the prompt keeps only response positions, the end token included", () => {
  assert.deepEqual(lossMask(tiny, true), [false, false, false, true, true]);
  assert.deepEqual(lossMask(tiny, false), [true, true, true, true, true]);
});

test("labels replace masked positions with −100 and keep the ids elsewhere", () => {
  assert.deepEqual(buildLabels([7, 8, 9, 10, 11], tiny, true), [IGNORE_INDEX, IGNORE_INDEX, IGNORE_INDEX, 10, 11]);
  assert.deepEqual(buildLabels([7, 8, 9, 10, 11], tiny, false), [7, 8, 9, 10, 11]);
  assert.throws(() => buildLabels([1], tiny, true));
});

test("masked loss is the mean −log p over response tokens only", () => {
  const r = sftLoss(tiny, true);
  assert.equal(r.count, 2);
  close(r.mean, (-Math.log(0.25) - Math.log(0.5)) / 2);
  close(r.mean, r.responseMean);
  assert.equal(r.promptShare, 0);
});

test("unmasked loss averages over every position and reports the prompt's share", () => {
  const r = sftLoss(tiny, false);
  assert.equal(r.count, 5);
  const all = tiny.map((t) => -Math.log(t.p));
  close(r.sum, all.reduce((s, v) => s + v, 0));
  close(r.mean, r.sum / 5);
  close(r.promptShare, (all[0] + all[1] + all[2]) / r.sum);
});

test("demo samples: prompts are harder to predict than responses, so leaving them in inflates the loss", () => {
  for (const s of Object.values(SFT_SAMPLES)) {
    const masked = sftLoss(s.tokens, true);
    const full = sftLoss(s.tokens, false);
    assert.ok(full.mean > masked.mean);
    assert.ok(s.tokens[s.tokens.length - 1].role === "response");
  }
  // Long prompt, two-token answer: almost all of the unmasked loss is prompt.
  const ex = sftLoss(SFT_SAMPLES.extract.tokens, false);
  assert.ok(ex.promptShare > 0.9, `prompt share ${ex.promptShare}`);
  assert.equal(sftLoss(SFT_SAMPLES.extract.tokens, true).count, 2);
});

test("probabilities outside (0, 1] are rejected", () => {
  assert.throws(() => sftLoss([{ text: "x", role: "response", p: 0 }], true));
});

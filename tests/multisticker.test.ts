import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bestMethod,
  exactHit,
  groupHit,
  headParams,
  lift,
  loraParams,
  MS_DATA,
  MS_EPOCH_SECONDS,
  MS_FUNNEL,
  MS_HISTORY,
  MS_METHODS,
  MS_NO_MEMORY_HEAD,
  MS_PER_MEDIA,
  MS_RESULTS,
  MS_SAMPLES,
  trainableParams,
} from "@/lib/ml/multisticker";

const close = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("headline numbers the page quotes", () => {
  // Frozen CLIP 0.28% → dual LoRA 13.15% exact R@30, about 47×.
  close(lift(MS_RESULTS.dual_lora.r30, MS_RESULTS.direct_clip.r30), 46.96, 0.01);
  // Memory ablation on the same head: 4.12% → 12.63%, about 3.07×.
  close(lift(MS_RESULTS.head_only.r30, MS_NO_MEMORY_HEAD.r30), 3.066, 0.001);
  close(lift(MS_RESULTS.head_only.mrr, MS_NO_MEMORY_HEAD.mrr), 2.636, 0.001);
});

test("best method per metric matches the README's bold cells", () => {
  assert.equal(bestMethod("r1"), "head_only");
  assert.equal(bestMethod("r5"), "image_lora");
  assert.equal(bestMethod("r30"), "dual_lora");
  assert.equal(bestMethod("mrr"), "image_lora");
  assert.equal(bestMethod("g1"), "head_only");
  assert.equal(bestMethod("g5"), "dual_lora");
  assert.equal(bestMethod("g30"), "direct_clip");
});

test("recall is monotone in k for every method", () => {
  for (const m of MS_METHODS) {
    const r = MS_RESULTS[m];
    assert.ok(r.r1 <= r.r5 && r.r5 <= r.r10 && r.r10 <= r.r30, m);
    assert.ok(r.g1 <= r.g5 && r.g5 <= r.g10 && r.g10 <= r.g30, m);
    assert.ok(r.r30 <= r.g30, `${m}: exact can never beat group`);
  }
});

test("funnel only shrinks, and the validation split adds up by media type", () => {
  for (let i = 1; i < MS_FUNNEL.length; i++) assert.ok(MS_FUNNEL[i].value <= MS_FUNNEL[i - 1].value);
  const v = MS_DATA.valByMedia;
  assert.equal(v.png + v.gif + v.webm, MS_DATA.val);
  const m = MS_DATA.mediaRows;
  assert.equal(m.png + m.gif + m.webm, MS_FUNNEL[1].value);
});

test("epoch seconds are the means of the logged epochs", () => {
  close(MS_EPOCH_SECONDS.head_only, (2.71 + 2.63 + 2.63 + 2.65 + 2.62) / 5, 0.01);
  close(MS_EPOCH_SECONDS.dual_lora, (11464.88 + 11543.91 + 11355.44 + 11212.92 + 9779.24) / 5, 0.01);
  assert.ok(MS_EPOCH_SECONDS.dual_lora / MS_EPOCH_SECONDS.head_only > 4000);
});

test("histories: 5 epochs each, and the last epoch matches the final metric when the bank is not re-encoded", () => {
  for (const h of Object.values(MS_HISTORY)) assert.equal(h.length, 5);
  close(MS_HISTORY.head_only[4].r30, MS_RESULTS.head_only.r30);
  close(MS_HISTORY.text_lora[4].r30, MS_RESULTS.text_lora.r30);
  close(MS_HISTORY.head_no_memory[4].r30, MS_NO_MEMORY_HEAD.r30);
  // Image-side LoRA: the final evaluation re-encodes the bank with the final adapter.
  assert.ok(MS_RESULTS.dual_lora.r30 > MS_HISTORY.dual_lora[4].r30);
});

test("per-media: webm is the hardest for every run", () => {
  for (const runs of Object.values(MS_PER_MEDIA)) {
    assert.ok(runs.webm.r30 < runs.png.r30 && runs.webm.r30 < runs.gif.r30);
  }
});

test("sample hits: exact by rank, group from the logged top-5", () => {
  const finance = MS_SAMPLES[0];
  assert.equal(exactHit(finance.runs.dual_lora.rank, 30), true);
  assert.equal(exactHit(finance.runs.head_no_memory.rank, 30), false);
  assert.equal(groupHit(finance.runs.dual_lora.top5, 1), true);
  assert.equal(groupHit([false, false, false, true, false], 3), false);
  assert.throws(() => groupHit(finance.runs.dual_lora.top5, 30));
  for (const s of MS_SAMPLES) for (const r of Object.values(s.runs)) assert.equal(r.top5.length, 5);
});

test("trainable parameters", () => {
  assert.equal(headParams(), 1_052_672);
  assert.equal(loraParams(512), 589_824);
  assert.equal(loraParams(768), 884_736);
  assert.equal(trainableParams("direct_clip"), 0);
  assert.equal(trainableParams("dual_lora"), 1_052_672 + 589_824 + 884_736);
});

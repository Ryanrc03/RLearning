import { test } from "node:test";
import assert from "node:assert/strict";
import { blockParams, CLIP_CONFIGS, CLIP_EXAMPLE_TOKENS, clipParams, eosIndex, gridSize, imageTokens, logitScale, textParams, visionParams } from "@/lib/ml/clipArchitecture";

const b32 = CLIP_CONFIGS["ViT-B/32"];

test("ViT-B/32 sees a 7×7 grid: 49 patches + [CLS] = 50 tokens", () => {
  assert.equal(gridSize(b32), 7);
  assert.equal(imageTokens(b32), 50);
  assert.equal(imageTokens(CLIP_CONFIGS["ViT-B/16"]), 197);
  assert.equal(imageTokens(CLIP_CONFIGS["ViT-L/14"]), 257);
});

test("one block at width 768 and 512", () => {
  const v = blockParams(768);
  assert.equal(v.in_proj, 1_771_776);
  assert.equal(v.out_proj, 590_592);
  assert.equal(v.c_fc, 2_362_368);
  assert.equal(v.c_proj, 2_360_064);
  assert.equal(v.total, 7_087_872);
  assert.equal(blockParams(512).total, 3_152_384);
});

test("ViT-B/32 parameter counts match the released model (~87.8M + ~63.4M ≈ 151M)", () => {
  assert.equal(visionParams(b32).total, 87_849_216);
  assert.equal(textParams(b32).total, 63_428_096);
  assert.equal(textParams(b32).embed, 49_408 * 512 + 77 * 512);
  assert.equal(clipParams(b32), 151_277_313);
});

test("ViT-L/14 is about 428M parameters", () => {
  const total = clipParams(CLIP_CONFIGS["ViT-L/14"]);
  assert.ok(total > 420e6 && total < 435e6, String(total));
});

test("logit scale starts at 1/0.07 and is clamped at 100", () => {
  assert.ok(Math.abs(logitScale(Math.log(1 / 0.07)) - 14.2857) < 1e-3);
  assert.equal(logitScale(10), 100);
});

test("the text feature is read at the [EOS] position", () => {
  assert.equal(eosIndex(CLIP_EXAMPLE_TOKENS), 6);
});

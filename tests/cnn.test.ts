import { test } from "node:test";
import assert from "node:assert/strict";
import {
  B2_RANGE,
  branchCost,
  concatChannels,
  convMacs,
  convOutShape,
  convParams,
  DEMO_INCEPTION,
  inceptionBlock,
  inceptionOutShape,
  residualAdd,
  residualBlock,
} from "@/lib/ml/cnn";

test("convOutShape: same padding keeps H × W, pad 0 shrinks by k − 1, too-large kernels throw", () => {
  assert.deepEqual(convOutShape(192, 28, 28, 3, 128), { c: 128, h: 28, w: 28 });
  assert.deepEqual(convOutShape(192, 28, 28, 5, 32), { c: 32, h: 28, w: 28 });
  assert.deepEqual(convOutShape(3, 32, 32, 5, 6, 0), { c: 6, h: 28, w: 28 });
  assert.throws(() => convOutShape(3, 4, 4, 7, 6, 0));
  assert.throws(() => convOutShape(0, 4, 4, 3, 6));
});

test("convParams(64, 128, 3) = 64 · 128 · 9 + 128", () => {
  assert.equal(convParams(64, 128, 3), 64 * 128 * 9 + 128);
  assert.equal(convParams(64, 128, 3), 73856);
  assert.equal(convParams(192, 64, 1), 192 * 64 + 64);
  // MACs: every output pixel sums inC · k² inputs.
  assert.equal(convMacs(64, 128, 3, 28, 28), 128 * 28 * 28 * 64 * 9);
});

test("concatChannels adds channels and keeps H, W; mismatched H/W throws", () => {
  const out = concatChannels([
    { c: 64, h: 28, w: 28 },
    { c: 128, h: 28, w: 28 },
    { c: 32, h: 28, w: 28 },
    { c: 32, h: 28, w: 28 },
  ]);
  assert.deepEqual(out, { c: 256, h: 28, w: 28 });
  assert.throws(() => concatChannels([{ c: 64, h: 28, w: 28 }, { c: 64, h: 26, w: 26 }]), /H and W must match/);
  assert.throws(() => concatChannels([{ c: 64, h: 28, w: 28 }, { c: 64, h: 28, w: 27 }]), /H and W must match/);
  assert.throws(() => concatChannels([]));
  assert.deepEqual(inceptionOutShape({ c: 192, h: 28, w: 28 }, [64, 128, 32, 32]), { c: 256, h: 28, w: 28 });
});

test("residual add requires equal shapes and keeps them", () => {
  const x = { c: 192, h: 28, w: 28 };
  assert.deepEqual(residualAdd(x, { c: 192, h: 28, w: 28 }), x);
  assert.throws(() => residualAdd(x, { c: 256, h: 28, w: 28 }), /equal shapes/);
  assert.throws(() => residualAdd(x, { c: 192, h: 14, w: 14 }), /equal shapes/);
  // Whatever the middle width, f(x) ends on C channels and y = x + f(x) is the input shape.
  for (const mid of [8, 64, 128]) {
    const r = residualBlock(x, mid);
    assert.deepEqual(r.out, x);
    assert.equal(r.params, convParams(192, mid, 3) + convParams(mid, 192, 3));
  }
});

test("DEMO_INCEPTION is GoogLeNet 3a: 192 × 28 × 28 → 256 × 28 × 28 with 163 696 parameters", () => {
  const block = inceptionBlock(DEMO_INCEPTION.input, DEMO_INCEPTION.cfg);
  assert.deepEqual(block.out, { c: 256, h: 28, w: 28 });
  assert.deepEqual(block.branches.map((b) => b.outShape.c), [64, 128, 32, 32]);
  assert.ok(block.branches.every((b) => b.outShape.h === 28 && b.outShape.w === 28));
  const expected = {
    b1: convParams(192, 64, 1),
    b2: convParams(192, 96, 1) + convParams(96, 128, 3),
    b3: convParams(192, 16, 1) + convParams(16, 32, 5),
    b4: convParams(192, 32, 1),
  };
  assert.deepEqual(Object.fromEntries(block.branches.map((b) => [b.key, b.params])), expected);
  assert.equal(block.params, 163696);
  assert.equal(block.macs, block.branches.reduce((s, b) => s + b.macs, 0));
  // The pool stage costs nothing; the 1×1 after it does.
  const b4 = branchCost(DEMO_INCEPTION.input, { key: "b4", label: "", stages: [{ kind: "pool", kernel: 3 }, { kind: "conv", kernel: 1, outC: 32 }] });
  assert.equal(b4.stages[0].params, 0);
  assert.equal(b4.stages[1].params, expected.b4);
});

test("sliding the 3×3 branch changes only that branch and the channel sum", () => {
  const base = inceptionBlock(DEMO_INCEPTION.input, DEMO_INCEPTION.cfg);
  for (let c = B2_RANGE.min; c <= B2_RANGE.max; c += B2_RANGE.step) {
    const block = inceptionBlock(DEMO_INCEPTION.input, { ...DEMO_INCEPTION.cfg, b2: { ...DEMO_INCEPTION.cfg.b2, out: c } });
    assert.equal(block.out.c, 64 + c + 32 + 32);
    assert.equal(block.out.h, 28);
    assert.equal(block.out.w, 28);
    assert.equal(block.branches[0].params, base.branches[0].params);
    assert.equal(block.branches[2].params, base.branches[2].params);
    assert.equal(block.branches[3].params, base.branches[3].params);
    assert.equal(block.branches[1].params, convParams(192, 96, 1) + convParams(96, c, 3));
  }
});

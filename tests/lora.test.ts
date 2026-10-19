import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blockLinears,
  demoErrorCurves,
  fullParams,
  gaussianMatrix,
  LLAMA_8B,
  loraModelParams,
  loraParams,
  loraScale,
  lowRankErrorCurve,
  singularValues,
  symmetricEigenvalues,
  TARGET_PRESETS,
  TOY_N,
  totalParams,
  trainingMemoryGB,
} from "@/lib/ml/lora";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("one 4096 × 4096 layer: full is 16.8M, rank 8 is 65,536 (0.39 %)", () => {
  assert.equal(fullParams(4096, 4096), 16_777_216);
  assert.equal(loraParams(4096, 4096, 8), 65_536);
  close(loraParams(4096, 4096, 8) / fullParams(4096, 4096), 1 / 256);
  assert.equal(loraParams(4096, 4096, 0), 0);
  assert.throws(() => loraParams(4096, 4096, 1.5));
});

test("α / r scale", () => {
  assert.equal(loraScale(16, 8), 2);
  assert.equal(loraScale(16, 16), 1);
  assert.throws(() => loraScale(16, 0));
});

test("the Llama-style config adds up to about 8.03B parameters", () => {
  const t = totalParams(LLAMA_8B);
  assert.ok(t > 8.0e9 && t < 8.06e9, `total ${t}`);
  assert.deepEqual(blockLinears().k, [4096, 1024]);
});

test("whole-model LoRA counts: q,v at r = 8 is 3.4M, all linears at r = 8 is 21M", () => {
  assert.equal(loraModelParams(8, TARGET_PRESETS.qv.targets), 32 * 8 * (4096 + 4096 + 4096 + 1024));
  assert.equal(loraModelParams(8, TARGET_PRESETS.qv.targets), 3_407_872);
  assert.equal(loraModelParams(8, TARGET_PRESETS.all.targets), 20_971_520);
  // Linear in r.
  assert.equal(loraModelParams(16, TARGET_PRESETS.all.targets), 2 * loraModelParams(8, TARGET_PRESETS.all.targets));
});

test("training memory: full FT ≈ 16 bytes / param, LoRA ≈ the bf16 weights", () => {
  const t = totalParams();
  close(trainingMemoryGB(t, t), (t * 16) / 1e9);
  const lora = trainingMemoryGB(t, loraModelParams(8, TARGET_PRESETS.qv.targets));
  assert.ok(lora > 16 && lora < 16.2, `lora ${lora}`);
  assert.ok(trainingMemoryGB(t, t) > 128);
});

test("Jacobi eigenvalues of a known symmetric matrix", () => {
  const ev = symmetricEigenvalues([
    [2, 1, 0],
    [1, 2, 0],
    [0, 0, 5],
  ]);
  close(ev[0], 5, 1e-9);
  close(ev[1], 3, 1e-9);
  close(ev[2], 1, 1e-9);
});

test("singular values: rank-2 matrix has two non-zero σ, Frobenius norm is preserved", () => {
  const M = [
    [1, 2, 3, 4],
    [2, 4, 6, 8],
    [1, 0, 1, 0],
  ];
  const s = singularValues(M);
  assert.equal(s.length, 4);
  assert.ok(s[1] > 1e-6);
  assert.ok(s[2] < 1e-6 && s[3] < 1e-6);
  const fro2 = M.flat().reduce((a, v) => a + v * v, 0);
  close(s.reduce((a, v) => a + v * v, 0), fro2, 1e-8);
});

test("error curve starts at 1, ends at 0, never increases", () => {
  const c = lowRankErrorCurve([3, 2, 1]);
  assert.equal(c.length, 4);
  close(c[0], 1);
  close(c[1], Math.sqrt(5 / 14));
  close(c[3], 0);
  const g = lowRankErrorCurve(singularValues(gaussianMatrix(12, 12, 3)));
  for (let i = 1; i < g.length; i++) assert.ok(g[i] <= g[i - 1] + 1e-12);
});

test("demo: the toy ΔW is captured by rank 8, a random matrix is not", () => {
  const { update, random } = demoErrorCurves();
  assert.equal(update.length, TOY_N + 1);
  assert.ok(update[8] < 0.25, `update@8 ${update[8]}`);
  assert.ok(random[8] > 0.8, `random@8 ${random[8]}`);
  close(update[TOY_N], 0, 1e-6);
  close(random[TOY_N], 0, 1e-6);
});

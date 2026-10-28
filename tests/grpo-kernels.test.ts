import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCUMULATE,
  ACCURACY,
  DECODE,
  LAYERS,
  MS,
  RTX3060,
  STEP_PROFILE,
  bandwidthShare,
  gemmMs,
  layerMs,
  mcnemarExact,
  routesToTriton,
} from "@/lib/gpu/grpoKernels";

const close = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("profile categories add up to the measured totals", () => {
  const train = STEP_PROFILE.train.cats.reduce((s, c) => s + c.ms, 0);
  close(train, STEP_PROFILE.train.total, 1);
  const decode = STEP_PROFILE.decode.cats.reduce((s, c) => s + c.ms, 0);
  close(decode, STEP_PROFILE.decode.total, 0.05);
});

test("routing sends only M <= 16 on wide layers to Triton", () => {
  assert.equal(routesToTriton("down", 6), true);
  assert.equal(routesToTriton("down", 24), false);
  assert.equal(routesToTriton("kv", 6), false);
  for (const key of Object.keys(LAYERS) as (keyof typeof LAYERS)[]) {
    for (const m of MS) {
      if (!routesToTriton(key, m)) continue;
      const b = gemmMs(key, m, "bnb");
      const t = gemmMs(key, m, "triton");
      assert.ok(b !== null && t !== null && t <= b * 1.03, `${key} M=${m} routed but slower`);
    }
  }
});

test("bnb uses a small share of bandwidth at decode shapes", () => {
  const share = bandwidthShare("gate_up", gemmMs("gate_up", 6, "bnb")!);
  assert.ok(share > 0.18 && share < 0.26, `${share}`);
});

test("per-layer GEMM time at M=6 drops about 20% under routing", () => {
  const bnb = layerMs(6, "bnb")!;
  const routed = layerMs(6, "routed")!;
  close(bnb, 0.5522, 1e-3);
  assert.ok(routed / bnb > 0.75 && routed / bnb < 0.85, `${routed / bnb}`);
  assert.equal(layerMs(24, "bnb"), null); // q at M=24 was not measured cleanly
});

test("end-to-end decode speed-up and accuracy test", () => {
  close(DECODE[0].bnbMs / DECODE[0].tritonMs, 1.2, 0.01);
  close(mcnemarExact(ACCURACY.bnbOnly, ACCURACY.tritonOnly), ACCURACY.mcnemarP, 0.01);
  close((ACCURACY.bnb - ACCURACY.triton) * ACCURACY.n, ACCURACY.bnbOnly - ACCURACY.tritonOnly, 0.5);
});

test("fp16 accumulate beats the fp32-accumulate ceiling on q/o", () => {
  const q = ACCUMULATE[0];
  assert.ok(q.tritonFp16 > RTX3060.tflopsFp32Acc);
  assert.ok(q.cublas < RTX3060.tflopsFp32Acc);
  close(q.tritonFp16 / q.cublas, 1.54, 0.01);
});

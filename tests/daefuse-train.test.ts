import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aeDecode,
  aeEncode,
  barData,
  barTestSet,
  cnnGrad,
  cnnInit,
  cornerData,
  edgeData,
  edgeLikeness,
  mlpGrad,
  mlpInit,
  priorDraws,
  trainAe,
  trainClassifier,
  trainDetector,
  trainGan,
  vitForward,
  vitGrad,
  vitInit,
  type Params,
} from "@/lib/ml/daefuseTrain";

// Central differences on the first few entries of every parameter array.
function gradError(init: Params, f: (p: Params) => { loss: number; g: Params }): number {
  const base = f(init);
  let worst = 0;
  for (const k of Object.keys(init))
    for (let i = 0; i < Math.min(init[k].length, 5); i++) {
      const up = JSON.parse(JSON.stringify(init));
      const dn = JSON.parse(JSON.stringify(init));
      up[k][i] += 1e-5;
      dn[k][i] -= 1e-5;
      worst = Math.max(worst, Math.abs((f(up).loss - f(dn).loss) / 2e-5 - base.g[k][i]));
    }
  return worst;
}

test("hand-written gradients match finite differences", () => {
  const bars = barData(6, 1);
  assert.ok(gradError(cnnInit(3), (p) => cnnGrad(p, bars)) < 1e-6);
  assert.ok(gradError(mlpInit(3), (p) => mlpGrad(p, bars)) < 1e-6);
  assert.ok(gradError(vitInit(3), (p) => vitGrad(p, cornerData(6, 1))) < 1e-6);
});

test("CNN generalises to unseen bar positions, the MLP does not", () => {
  const test = barTestSet(99);
  const cnn = trainClassifier("cnn", barData(16, 5), test, { steps: 200, lr: 0.05, batch: 16, seed: 11, every: 200 });
  const mlp = trainClassifier("mlp", barData(16, 5), test, { steps: 200, lr: 0.02, batch: 16, seed: 11, every: 200 });
  assert.ok(cnn.at(-1)!.testAcc > 0.95);
  assert.equal(mlp.at(-1)!.trainAcc, 1);
  assert.ok(mlp.at(-1)!.testAcc < 0.7);
});

test("attention finds the two corners; conv + average pooling only counts lit patches", () => {
  const test = cornerData(80, 77);
  const vit = trainClassifier("vit", cornerData(120, 5), test, { steps: 200, lr: 0.01, batch: 16, seed: 11, every: 200 });
  const cnn = trainClassifier("cnn", cornerData(120, 5), test, { steps: 300, lr: 0.01, batch: 16, seed: 12, every: 300 });
  assert.ok(vit.at(-1)!.testAcc > 0.95);
  // The CNN only learns "how many patches are lit", which gets part of the way and stops.
  assert.ok(cnn.at(-1)!.testAcc > 0.55 && cnn.at(-1)!.testAcc < 0.8);
  const a = vitForward(vit.at(-1)!.params, test[1].x).a; // a positive sample
  assert.ok(a[0] + a[15] > 0.5);
});

test("GAN: non-saturating loss escapes a confident discriminator faster", () => {
  const cfg = { steps: 60, every: 60, seed: 3, preTrainD: 300, lrG: 0.05, lrD: 0.05, dSteps: 5, sgdG: true } as const;
  const mm = trainGan({ ...cfg, loss: "minimax" });
  const ns = trainGan({ ...cfg, loss: "nonsat" });
  assert.ok(Math.abs(ns.at(-1)!.b - 2) < 0.3);
  assert.ok(Math.abs(mm.at(-1)!.b - 2) > 2);
});

test("AE reconstructs sharper, VAE samples from the prior look more like edges", () => {
  const ae = trainAe({ vae: false, steps: 800, every: 800, seed: 4 }).at(-1)!;
  const vae = trainAe({ vae: true, beta: 0.05, steps: 800, every: 800, seed: 4 }).at(-1)!;
  assert.ok(ae.recon < vae.recon);
  const like = (p: Params) => priorDraws(16, 9).reduce((s, z) => s + edgeLikeness(aeDecode(p, z).out), 0) / 16;
  assert.ok(like(vae.params) > like(ae.params) + 0.15);
  const x = edgeData(4)[0].x;
  assert.ok(edgeLikeness(aeDecode(ae.params, aeEncode(ae.params, x).mu).out) > 0.9);
});

test("grid detector learns to box the object", () => {
  const snaps = trainDetector({ steps: 300, every: 300, seed: 6 });
  assert.ok(snaps[0].hit50 < 0.2);
  assert.ok(snaps.at(-1)!.hit50 > 0.8);
  assert.ok(snaps.at(-1)!.lossObj < snaps[0].lossObj);
});

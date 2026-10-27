import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contentLoss,
  corrLoss,
  crossAttend,
  DF_DET,
  DF_METHODS,
  dfPodium,
  dfRank,
  dfValue,
  edgeSharpness,
  fuse,
  ganLosses,
  iou,
  klGauss,
  lossInt,
  lossText,
  matchAt50,
  mixRatio,
  movingAverage,
  nms,
  receptiveField,
  blurTimes,
  softmax,
  toyInfrared,
  toyVisible,
  vaeExpectedRecon,
  type Det,
} from "@/lib/ml/daefuse";

const close = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const ir = toyInfrared();
const vis = toyVisible();

test("fusion losses: max has zero intensity loss, the plain average is worst of the mixes", () => {
  close(lossInt(fuse(ir, vis, "max"), ir, vis), 0, 1e-12);
  const mean = fuse(ir, vis, "weighted", 0.5);
  assert.ok(lossInt(mean, ir, vis) > lossInt(fuse(ir, vis, "vis"), ir, vis));
  assert.ok(lossText(mean, ir, vis) > lossText(fuse(ir, vis, "max"), ir, vis));
  // L_int grows linearly with the infrared weight on this scene (VIS is brighter almost everywhere).
  const a = lossInt(fuse(ir, vis, "weighted", 0.25), ir, vis);
  const b = lossInt(fuse(ir, vis, "weighted", 0.75), ir, vis);
  assert.ok(b > a);
});

test("content loss is zero for a perfect reconstruction and grows with blur", () => {
  close(contentLoss(ir, ir).total, 0, 1e-9);
  const one = contentLoss(vis, blurTimes(vis, 1)).total;
  const three = contentLoss(vis, blurTimes(vis, 3)).total;
  assert.ok(three > one && one > 0);
});

test("correlation decomposition loss", () => {
  close(corrLoss(0, 0.9), 0);
  close(corrLoss(0.5, 0.9), 0.25 / 1.91);
  // Denominator stays positive for any CC in [−1, 1] because ε = 1.01.
  assert.ok(corrLoss(0.1, -1) > 0);
});

test("receptive field and moving average", () => {
  assert.equal(receptiveField(1), 3);
  assert.equal(receptiveField(4), 9);
  assert.deepEqual(movingAverage([0, 0, 3, 0, 0], 3), [0, 1, 1, 1, 0]);
});

test("attention rows are distributions", () => {
  const w = softmax([1, 2, 3]);
  close(w.reduce((s, x) => s + x, 0), 1);
  const r = crossAttend([1, 0], [[1, 0], [0, 1]], [[10, 0], [0, 10]]);
  close(r.weights[0] + r.weights[1], 1);
  assert.ok(r.weights[0] > r.weights[1]);
  close(r.out[0], 10 * r.weights[0]);
});

test("GAN losses at the equilibrium D = 0.5", () => {
  const g = ganLosses(0.5, 0.5);
  close(g.disc, 2 * Math.log(2));
  close(g.genNonSat, Math.log(2));
  // When D confidently rejects the fake, the minimax generator gradient is small and the non-saturating one is large.
  const early = ganLosses(0.95, 0.02);
  assert.ok(Math.abs(early.gradNonSat) > 10 * Math.abs(early.gradMinimax));
});

test("VAE: KL is smallest at σ = 1 for μ = 0, and larger σ blurs the decoded edge", () => {
  close(klGauss(0, 1), 0);
  const rowA = Array.from({ length: 24 }, (_, i) => (i < 10 ? 0 : 1));
  const rowB = Array.from({ length: 24 }, (_, i) => (i < 14 ? 0 : 1));
  const sharp = edgeSharpness(vaeExpectedRecon([rowA, rowB], [-1, 1], 0.1));
  const blurry = edgeSharpness(vaeExpectedRecon([rowA, rowB], [-1, 1], 1));
  close(sharp, 1, 1e-3);
  assert.ok(blurry < 0.85);
  // A plain AE reproduces sample 1; a wide posterior drifts toward the average of the two samples.
  close(mixRatio(vaeExpectedRecon([rowA, rowB], [-1, 1], 0.05), rowA, rowB), 0, 1e-6);
  const wide = mixRatio(vaeExpectedRecon([rowA, rowB], [-1, 1], 1), rowA, rowB);
  assert.ok(wide > 0.2 && wide < 0.5);
});

test("IoU, NMS and the AP@50 match", () => {
  close(iou({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 0, w: 2, h: 2 }), 2 / 6);
  const dets: Det[] = [
    { cls: "car", score: 0.9, x: 0, y: 0, w: 4, h: 2 },
    { cls: "car", score: 0.6, x: 0.5, y: 0, w: 4, h: 2 },
    { cls: "person", score: 0.7, x: 0.5, y: 0, w: 1, h: 3 },
  ];
  const kept = nms(dets, 0.5);
  assert.equal(kept.length, 2); // the duplicate car goes, the person stays (other class)
  const { matches, missed } = matchAt50(kept, [{ cls: "car", x: 0, y: 0, w: 4, h: 2 }]);
  assert.equal(matches.filter((m) => m.tp).length, 1);
  assert.equal(missed.length, 0);
});

test("paper tables: the numbers the page quotes", () => {
  assert.equal(DF_METHODS.length, 8);
  close(dfValue("TNO", "DAE-Fuse", "EN"), 7.17);
  close(dfValue("MSRS", "CDDFuse", "VIF"), 1.05);
  assert.equal(dfRank("MSRS", "DAE-Fuse", "VIF"), 2);
  assert.equal(dfRank("TNO", "DAE-Fuse", "SD"), 2);
  // 1st on 4 / 5 / 6 / 6 of the 7 metrics; every other cell is 2nd (21 + 7 = 28).
  assert.equal(dfPodium("TNO", "DAE-Fuse").first, 4);
  assert.equal(dfPodium("MSRS", "DAE-Fuse").first, 5);
  assert.equal(dfPodium("RoadScene", "DAE-Fuse").first, 6);
  assert.equal(dfPodium("MRI-CT", "DAE-Fuse").first, 6);
  for (const ds of ["TNO", "MSRS", "RoadScene", "MRI-CT"] as const) assert.ok(dfPodium(ds, "DAE-Fuse").ranks.every((r) => r <= 2));
  const ours = DF_DET.find((r) => r.name === "DAE-Fuse")!;
  close(ours.map, 0.887);
  close(ours.map - DF_DET.find((r) => r.name === "Infrared")!.map, 0.108);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADS,
  crossWeightsAtScale,
  dcnMaxOrder,
  fitModel,
  fmWeightsAtScale,
  HELD_OUT,
  makeCells,
  MODEL_NAMES,
  paramSize,
  trainingLoss,
  trueCtr,
  USERS,
} from "@/lib/ml/featureCross";
import { createRng } from "@/lib/ml/random";

const close = (a: number, b: number, eps: number) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("the truth has a real interaction: young × game clicks most, 50+ × game least", () => {
  const game = USERS.map((_, i) => trueCtr(i, 0));
  assert.ok(game[0] > 0.15 && game[4] < 0.015);
  // The same age gap reverses on 理财: no additive model can produce both.
  const finance = USERS.map((_, i) => trueCtr(i, ADS.length - 1));
  assert.ok(finance[4] > finance[0]);
});

test("cells are deterministic and mark exactly one held-out cell", () => {
  const a = makeCells();
  assert.deepEqual(a, makeCells());
  assert.equal(a.length, USERS.length * ADS.length);
  const held = a.filter((c) => c.heldOut);
  assert.equal(held.length, 1);
  assert.deepEqual([held[0].user, held[0].ad], [HELD_OUT.user, HELD_OUT.ad]);
});

test("every model's gradient matches finite differences", () => {
  const cells = makeCells();
  const rng = createRng(3);
  for (const m of MODEL_NAMES) {
    const theta = Array.from({ length: paramSize(m) }, () => (rng() - 0.5) * 0.6);
    theta[0] = -2.5;
    const { grad } = trainingLoss(m, theta, cells);
    const h = 1e-6;
    for (let k = 0; k < theta.length; k++) {
      const up = [...theta];
      const dn = [...theta];
      up[k] += h;
      dn[k] -= h;
      const num = (trainingLoss(m, up, cells).loss - trainingLoss(m, dn, cells).loss) / (2 * h);
      close(grad[k], num, 1e-6);
    }
  }
});

test("LR cannot fit the interaction; crosses fit training cells but not the unseen one; FM and DCN do both", () => {
  const cells = makeCells();
  const lr = fitModel("lr", cells);
  const cross = fitModel("cross", cells);
  const fm = fitModel("fm", cells);
  const dcn = fitModel("dcn", cells);
  assert.ok(lr.trainAbsErr > 0.015, `lr train err ${lr.trainAbsErr}`);
  for (const r of [cross, fm, dcn]) {
    assert.ok(r.trainAbsErr < 0.003, `${r.model} train err ${r.trainAbsErr}`);
    assert.ok(r.trainLogLoss < lr.trainLogLoss);
  }
  const truth = trueCtr(HELD_OUT.user, HELD_OUT.ad);
  assert.ok(Math.abs(cross.heldOutPred - truth) > 0.05, `cross held-out ${cross.heldOutPred}`);
  close(fm.heldOutPred, truth, 0.005);
  close(dcn.heldOutPred, truth, 0.005);
});

test("weight counts: crosses grow with the product, FM with the sum", () => {
  assert.equal(crossWeightsAtScale(1_000_000, 100_000), 1e11);
  assert.equal(fmWeightsAtScale(1_000_000, 100_000, 16), 17_600_000);
  assert.equal(paramSize("cross") - paramSize("lr"), USERS.length * ADS.length);
});

test("each DCN cross layer adds one polynomial order", () => {
  assert.deepEqual([1, 2, 3].map(dcnMaxOrder), [2, 3, 4]);
});

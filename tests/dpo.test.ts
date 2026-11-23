import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWeights, btExample, dpoPair, optimalDistribution } from "@/lib/ml/dpo";
import { klDivergence, klTerms } from "@/lib/ml/klDivergence";
const close = (a: number, b: number, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("KL toy example has negative summand, nonnegative total, and asymmetric alternatives", () => {
  const p = normalizeWeights([2, 8]), q = normalizeWeights([8, 2]);
  close(klDivergence(p, q), 0.8317766166719343);
  assert.ok(klTerms(p, q)[0] < 0);
  close(klDivergence(p, p), 0);
  assert.notEqual(klDivergence([0.3, 0.7], q), klDivergence(q, [0.3, 0.7]));
  assert.throws(() => normalizeWeights([0, 0]));
});
test("BT maximum likelihood matches the observed proportions and is scale invariant", () => {
  const mle = btExample([1, 0.5, 5 / 3]);
  close(mle.ab, 8 / 12); close(mle.ac, 3 / 8);
  close(mle.nll, -8*Math.log(2/3)-4*Math.log(1/3)-3*Math.log(3/8)-5*Math.log(5/8));
  close(mle.nll, btExample([3, 1.5, 5]).nll);
  assert.ok(mle.nll < btExample([1, 1, 1]).nll);
});
test("DPO at reference gives log 2; increasing relative margin lowers loss", () => {
  const base = dpoPair([-3, -4, -3, -4], 0.1);
  close(base.loss, Math.log(2)); close(base.probability, 0.5);
  const improved = dpoPair([-2, -5, -3, -4], 0.1);
  close(improved.chosenRatio, 1); close(improved.rejectedRatio, -1); close(improved.margin, 0.2);
  assert.ok(improved.loss < base.loss);
  // Both absolute probabilities can drop while the preference margin improves.
  assert.ok(dpoPair([-4, -7, -3, -4], 0.1).loss < base.loss);
});
test("DPO softplus stays finite at extreme margins and its derivative matches finite differences", () => {
  for (const v of [-20000, 0]) {
    const extreme = dpoPair([v, -10000, -10000, -10000], 1);
    assert.ok(Number.isFinite(extreme.loss));
    close(extreme.loss, v < -10000 ? 10000 : 0);
  }
  const f = (v: number) => dpoPair([v, -4, -3, -4], 0.5).loss;
  const result = dpoPair([-2, -4, -3, -4], 0.5);
  close((f(-2 + 1e-5) - f(-2 - 1e-5))/2e-5, -0.5*(1-result.probability), 1e-8);
});
test("reward reweighting normalizes stably, respects reference support, and beta controls KL", () => {
  const ref = [0.2, 0.5, 0.3], rewards = [2, 0.6, -0.5];
  const sharp = optimalDistribution(ref, rewards, 0.1), soft = optimalDistribution(ref, rewards, 5);
  close(sharp.reduce((a,b) => a+b, 0), 1);
  assert.ok(klDivergence(sharp, ref) > klDivergence(soft, ref));
  assert.ok(sharp[0] > soft[0]);
  const extreme = optimalDistribution(ref, [2000, 600, -500], 0.01);
  close(extreme[0], 1); assert.ok(extreme.every(Number.isFinite));
  close(optimalDistribution([0, 0.5, 0.5], rewards, 0.1)[0], 0);
  // Same-prompt reward offsets (and hence beta log Z) cancel.
  const shifted = optimalDistribution(ref, rewards.map(r => r+10), 1);
  optimalDistribution(ref, rewards, 1).forEach((p,i) => close(p, shifted[i]));
  assert.throws(() => optimalDistribution(ref, rewards, 0));
});

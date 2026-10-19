import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bestBeta,
  betaPoint,
  bradleyTerryNll,
  dpoLoss,
  expectation,
  fitBradleyTerry,
  implicitReward,
  klDivergence,
  logBetaGrid,
  pairLoss,
  preferProb,
  RLHF_DEMO,
  sigmoid,
  sweepBeta,
  tiltedPolicy,
} from "@/lib/ml/rlhf";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const ref = RLHF_DEMO.candidates.map((c) => c.ref);
const quality = RLHF_DEMO.candidates.map((c) => c.quality);
const reward = fitBradleyTerry(RLHF_DEMO.wins);

test("the demo is a valid reference distribution with a symmetric 20-vote table", () => {
  close(sum(ref), 1);
  const k = RLHF_DEMO.wins.length;
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) assert.equal(RLHF_DEMO.wins[i][j] + RLHF_DEMO.wins[j][i], 20);
});

test("Bradley–Terry: equal rewards are a coin flip, and P(a≻b) + P(b≻a) = 1", () => {
  close(preferProb(0.7, 0.7), 0.5);
  close(preferProb(1.2, -0.3) + preferProb(-0.3, 1.2), 1);
  close(sigmoid(-800), 0, 1e-12);
  close(pairLoss(0, 0), Math.log(2));
});

test("fitted rewards are centred, beat the zero model, and reproduce observed win rates", () => {
  close(sum(reward), 0, 1e-9);
  assert.ok(bradleyTerryNll(RLHF_DEMO.wins, reward) < bradleyTerryNll(RLHF_DEMO.wins, [0, 0, 0, 0, 0]));
  // At the MLE each candidate's predicted total wins equal its observed total wins.
  const k = reward.length;
  for (let i = 0; i < k; i++) {
    let observed = 0;
    let predicted = 0;
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      observed += RLHF_DEMO.wins[i][j];
      predicted += 20 * preferProb(reward[i], reward[j]);
    }
    close(predicted, observed, 1e-3);
  }
});

test("the reward model ranks the flattering answer E first, though experts rank it fourth", () => {
  const top = reward.indexOf(Math.max(...reward));
  assert.equal(RLHF_DEMO.candidates[top].key, "E");
  assert.ok(preferProb(reward[0], reward[4]) < 0.5);
  assert.ok(quality[0] > quality[4]);
});

test("tilted policy: huge β returns π_ref, tiny β collapses on argmax reward", () => {
  const far = tiltedPolicy(ref, reward, 1e6);
  far.forEach((p, i) => close(p, ref[i], 1e-5));
  const near = tiltedPolicy(ref, reward, 0.005);
  assert.ok(near[4] > 0.999);
  close(sum(tiltedPolicy(ref, reward, 0.3)), 1);
});

test("tilted policy is the optimum of E[r] − β·KL against nearby policies", () => {
  const beta = 0.5;
  const star = tiltedPolicy(ref, reward, beta);
  const obj = (p: number[]) => expectation(p, reward) - beta * klDivergence(p, ref);
  const best = obj(star);
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      if (i === j) continue;
      const p = star.slice();
      const d = Math.min(0.01, p[j]);
      p[i] += d;
      p[j] -= d;
      assert.ok(obj(p) <= best + 1e-12);
    }
  }
});

test("KL is zero for identical distributions and positive otherwise", () => {
  close(klDivergence(ref, ref), 0);
  assert.ok(klDivergence([0.5, 0.5], [0.9, 0.1]) > 0);
});

test("DPO's implicit reward recovers the reward model up to a constant", () => {
  const beta = 0.4;
  const star = tiltedPolicy(ref, reward, beta);
  const implied = implicitReward(star, ref, beta);
  const shift = implied[0] - reward[0];
  implied.forEach((r, i) => close(r - shift, reward[i], 1e-9));
});

test("DPO loss falls as the policy raises the winner relative to the reference", () => {
  const atRef = dpoLoss(Math.log(0.3), Math.log(0.3), Math.log(0.1), Math.log(0.1), 0.5);
  close(atRef, Math.log(2));
  const moved = dpoLoss(Math.log(0.5), Math.log(0.3), Math.log(0.05), Math.log(0.1), 0.5);
  assert.ok(moved < atRef);
});

test("β sweep: smaller β means more KL and more RM reward, but true quality peaks in the middle", () => {
  const pts = sweepBeta(RLHF_DEMO, reward, logBetaGrid(-1.3, 0.7, 41));
  for (let i = 1; i < pts.length; i++) {
    assert.ok(pts[i].kl < pts[i - 1].kl);
    assert.ok(pts[i].reward < pts[i - 1].reward);
  }
  const best = bestBeta(pts);
  assert.ok(best.beta > 0.3 && best.beta < 1.2, `peak at β = ${best.beta}`);
  const refQuality = expectation(ref, quality);
  assert.ok(best.quality > refQuality + 0.08);
  assert.ok(pts[0].quality < refQuality, "β = 0.05 should be worse than the SFT model");
  close(betaPoint(RLHF_DEMO, reward, 1).beta, 1);
});

test("log grid spans the requested decades", () => {
  const g = logBetaGrid(-1, 1, 3);
  close(g[0], 0.1);
  close(g[1], 1);
  close(g[2], 10);
});

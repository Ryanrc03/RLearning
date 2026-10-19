import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agreementWithHuman,
  countVerdicts,
  gsbScores,
  JUDGE_SCENARIOS,
  netInterval,
  signTestP,
  simulateJudge,
  verdictFromScore,
  verdictsFor,
  wilsonInterval,
} from "@/lib/ml/judge";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("the two GSB scores: (G − B) / N counts ties, G / (G + B) drops them", () => {
  const s = gsbScores({ G: 40, S: 50, B: 10 });
  assert.equal(s.n, 100);
  close(s.net, 0.3);
  close(s.winRate, 0.8);
  close(s.notWorse, 0.9);
  // Same 80% win rate with almost everything tied: the net score sees it, the win rate does not.
  const tied = gsbScores({ G: 8, S: 90, B: 2 });
  close(tied.winRate, 0.8);
  close(tied.net, 0.06);
  // No decisive pairs: win rate falls back to a coin flip, not NaN.
  close(gsbScores({ G: 0, S: 5, B: 0 }).winRate, 0.5);
  close(gsbScores({ G: 0, S: 0, B: 0 }).net, 0);
});

test("sign test matches the exact binomial", () => {
  // 9 of 10 decisive pairs go G: P = 2 · (C(10,9) + C(10,10)) / 1024 = 22 / 1024.
  close(signTestP(9, 1), 22 / 1024, 1e-12);
  close(signTestP(5, 5), 1);
  close(signTestP(0, 0), 1);
  close(signTestP(3, 7), signTestP(7, 3), 1e-12);
  // 8 / 10 is a coin-flip-sized result; 80 / 100 is not.
  assert.ok(signTestP(8, 2) > 0.05);
  assert.ok(signTestP(80, 20) < 1e-8);
});

test("Wilson interval shrinks with n and stays inside [0, 1]", () => {
  const [lo10, hi10] = wilsonInterval(8, 10);
  const [lo100, hi100] = wilsonInterval(80, 100);
  assert.ok(lo10 < 0.5 && hi10 > 0.9, `${lo10} ${hi10}`);
  assert.ok(lo100 > 0.7 && hi100 < 0.87, `${lo100} ${hi100}`);
  const [lo, hi] = wilsonInterval(10, 10);
  assert.ok(lo > 0.65 && hi === 1);
  const [n0, n1] = netInterval({ G: 40, S: 50, B: 10 });
  assert.ok(n0 < 0.3 && n1 > 0.3 && n0 > 0.15 && n1 < 0.45, `${n0} ${n1}`);
});

test("verdicts from a preference score", () => {
  assert.equal(verdictFromScore(0.5, 0.4), "G");
  assert.equal(verdictFromScore(-0.5, 0.4), "B");
  assert.equal(verdictFromScore(0.1, 0.4), "S");
  assert.deepEqual(countVerdicts(["G", "G", "S", "B"]), { G: 2, S: 1, B: 1 });
});

test("simulated judge is seeded and shows position bias", () => {
  const a = simulateJudge(JUDGE_SCENARIOS.equal);
  const b = simulateJudge(JUDGE_SCENARIOS.equal);
  assert.deepEqual(a, b);
  assert.equal(a.length, 120);
  const score = (mode: Parameters<typeof verdictsFor>[1]) => gsbScores(countVerdicts(verdictsFor(a, mode)));
  // Two equally good models: humans see roughly a tie, but the judge favours whoever it reads first.
  assert.ok(Math.abs(score("human").net) < 0.1, `human ${score("human").net}`);
  assert.ok(score("newFirst").winRate > 0.7, `newFirst ${score("newFirst").winRate}`);
  assert.ok(score("newSecond").winRate < 0.3, `newSecond ${score("newSecond").winRate}`);
  // Judging both orders cancels most of it.
  assert.ok(Math.abs(score("swapped").net) < 0.1, `swapped ${score("swapped").net}`);
  assert.ok(agreementWithHuman(a, "swapped") > agreementWithHuman(a, "newFirst"));
});

test("a truly better model: swapped judge lands near the human win rate", () => {
  const pairs = simulateJudge(JUDGE_SCENARIOS.better);
  const w = (mode: Parameters<typeof verdictsFor>[1]) => gsbScores(countVerdicts(verdictsFor(pairs, mode))).winRate;
  assert.ok(w("human") > 0.78 && w("human") < 0.9, `human ${w("human")}`);
  assert.ok(Math.abs(w("swapped") - w("human")) < 0.06, `swapped ${w("swapped")}`);
  assert.ok(w("newFirst") > w("human") + 0.05);
  assert.equal(agreementWithHuman(pairs, "human"), 1);
});

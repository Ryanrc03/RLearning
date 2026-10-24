// Recommender Systems: why a model scores well on logs the recommender chose
// and worse on randomly exposed items. A toy world of users and authors: the
// recommender shows author a to user u with probability ∝ exp(λ·z_ua), where
// z_ua is the user's true taste; the "model" is the user×author historical
// click rate the logs make possible. No React here; see tests/exposure-bias.test.ts.

import { auc, type Scored } from "./metrics";
import { createRng, randomNormal, type Rng } from "./random";

export const BIAS_WORLD = { users: 200, authors: 60, history: 60, test: 40, random: 40, slope: 1.5, offset: -2.0, smoothA: 2, seed: 2022 };

export type Exposure = { user: number; author: number; click: boolean };

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function clickProb(z: number): number {
  return sigmoid(BIAS_WORLD.slope * z + BIAS_WORLD.offset);
}

// Taste matrix z[u][a] ~ N(0, 1), fixed by the seed.
export function tasteMatrix(seed = BIAS_WORLD.seed): number[][] {
  const rng = createRng(seed);
  return Array.from({ length: BIAS_WORLD.users }, () => Array.from({ length: BIAS_WORLD.authors }, () => randomNormal(rng)));
}

// Policy exposure probabilities over authors for one user: softmax(λ·z).
export function policyProbs(z: readonly number[], lambda: number): number[] {
  const m = Math.max(...z.map((v) => lambda * v));
  const e = z.map((v) => Math.exp(lambda * v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

function drawIndex(rng: Rng, probs: readonly number[]): number {
  let u = rng();
  for (let i = 0; i < probs.length; i++) {
    u -= probs[i];
    if (u < 0) return i;
  }
  return probs.length - 1;
}

export type BiasResult = {
  lambda: number;
  /** Click rate on the recommender's test exposures and on the random ones. */
  ctrStandard: number;
  ctrRandom: number;
  /** GAUC of the user×author click-rate feature on each test set. */
  gaucStandard: number;
  gaucRandom: number;
  /** Share of test exposures whose author the user has seen in the history. */
  coverageStandard: number;
  coverageRandom: number;
  /** mean(score) / mean(click) on the random set. */
  calibRandom: number;
  /** One user's history counts per author, for drawing. */
  example: { author: number; z: number; shown: number; clicks: number }[];
};

export function groupAuc(rows: readonly { user: number; score: number; label: boolean }[]): number {
  const byUser = new Map<number, Scored[]>();
  for (const r of rows) {
    const list = byUser.get(r.user) ?? [];
    list.push({ score: r.score, label: r.label });
    byUser.set(r.user, list);
  }
  let num = 0;
  let den = 0;
  for (const items of byUser.values()) {
    const pos = items.filter((x) => x.label).length;
    if (pos === 0 || pos === items.length) continue;
    num += items.length * auc(items);
    den += items.length;
  }
  return den === 0 ? 0.5 : num / den;
}

// One full simulation for a policy selectivity λ. The random set is drawn with
// its own stream so changing λ does not reshuffle which authors it shows.
export function simulateBias(lambda: number, seed = BIAS_WORLD.seed): BiasResult {
  const W = BIAS_WORLD;
  const z = tasteMatrix(seed);
  const rngPolicy = createRng(seed + 1);
  const rngRandom = createRng(seed + 2);
  const rngClick = createRng(seed + 3);
  const uniform = Array.from({ length: W.authors }, () => 1 / W.authors);
  const hist: { n: number[]; c: number[] }[] = [];
  let histClicks = 0;
  let histN = 0;
  const standard: Exposure[] = [];
  const random: Exposure[] = [];
  for (let u = 0; u < W.users; u++) {
    const probs = policyProbs(z[u], lambda);
    const n = new Array(W.authors).fill(0);
    const c = new Array(W.authors).fill(0);
    for (let k = 0; k < W.history; k++) {
      const a = drawIndex(rngPolicy, probs);
      const click = rngClick() < clickProb(z[u][a]);
      n[a]++;
      if (click) c[a]++;
      histN++;
      if (click) histClicks++;
    }
    hist.push({ n, c });
    for (let k = 0; k < W.test; k++) {
      const a = drawIndex(rngPolicy, probs);
      standard.push({ user: u, author: a, click: rngClick() < clickProb(z[u][a]) });
    }
    for (let k = 0; k < W.random; k++) {
      const a = drawIndex(rngRandom, uniform);
      random.push({ user: u, author: a, click: rngClick() < clickProb(z[u][a]) });
    }
  }
  const prior = histN === 0 ? 0 : histClicks / histN;
  const score = (e: Exposure) => (hist[e.user].c[e.author] + W.smoothA * prior) / (hist[e.user].n[e.author] + W.smoothA);
  const rows = (set: Exposure[]) => set.map((e) => ({ user: e.user, score: score(e), label: e.click }));
  const rate = (set: Exposure[]) => set.filter((e) => e.click).length / set.length;
  const cover = (set: Exposure[]) => set.filter((e) => hist[e.user].n[e.author] > 0).length / set.length;
  const meanScore = random.reduce((s, e) => s + score(e), 0) / random.length;
  const ex = hist[0];
  return {
    lambda,
    ctrStandard: rate(standard),
    ctrRandom: rate(random),
    gaucStandard: groupAuc(rows(standard)),
    gaucRandom: groupAuc(rows(random)),
    coverageStandard: cover(standard),
    coverageRandom: cover(random),
    calibRandom: meanScore / rate(random),
    example: z[0].map((zz, a) => ({ author: a, z: zz, shown: ex.n[a], clicks: ex.c[a] })),
  };
}

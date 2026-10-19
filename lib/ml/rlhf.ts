// RLHF in miniature: one prompt, five candidate answers.
// 1. Pairwise preferences → reward model scores via Bradley–Terry.
// 2. The KL-regularised objective max E[r] − β·KL(π‖π_ref) has a closed-form
//    optimum π*(y) ∝ π_ref(y)·exp(r(y)/β); PPO approximates it with gradient
//    steps, DPO reads it backwards. Sweeping β shows reward vs KL.
// No React here; see tests/rlhf.test.ts.

export type Candidate = {
  key: string;
  text: string;
  /** Probability the SFT (reference) model gives this answer. */
  ref: number;
  /** What an expert would actually grade it, 0–1. The reward model never sees this. */
  quality: number;
};

export type RlhfDemo = {
  prompt: string;
  candidates: Candidate[];
  /** wins[i][j] = times labelers preferred candidate i over j. */
  wins: number[][];
};

// Labelers compared each pair 20 times. They mostly agree with the expert,
// except that they fall for the long, flattering answer E a little too often.
export const RLHF_DEMO: RlhfDemo = {
  prompt: "用两三句话解释什么是过拟合",
  candidates: [
    { key: "A", text: "准确、简洁，带一个例子", ref: 0.3, quality: 0.9 },
    { key: "B", text: "准确，但绕了很多弯", ref: 0.25, quality: 0.7 },
    { key: "C", text: "大体对，有一处概念错", ref: 0.2, quality: 0.4 },
    { key: "D", text: "答非所问，讲成了欠拟合", ref: 0.15, quality: 0.1 },
    { key: "E", text: "“好问题！”开头，客套堆满三段", ref: 0.1, quality: 0.2 },
  ],
  wins: [
    [0, 12, 15, 19, 9],
    [8, 0, 14, 18, 7],
    [5, 6, 0, 16, 4],
    [1, 2, 4, 0, 1],
    [11, 13, 16, 19, 0],
  ],
};

export function sigmoid(x: number): number {
  return x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
}

/** Bradley–Terry: P(a ≻ b) = σ(r_a − r_b). */
export function preferProb(ra: number, rb: number): number {
  return sigmoid(ra - rb);
}

/** Reward-model loss on one preference pair: −log σ(r_w − r_l). */
export function pairLoss(rWinner: number, rLoser: number): number {
  return -Math.log(sigmoid(rWinner - rLoser));
}

/** Mean −log-likelihood of a win table under rewards r. */
export function bradleyTerryNll(wins: number[][], r: number[]): number {
  let total = 0;
  let n = 0;
  for (let i = 0; i < wins.length; i++) {
    for (let j = 0; j < wins.length; j++) {
      if (i === j || wins[i][j] === 0) continue;
      total += wins[i][j] * pairLoss(r[i], r[j]);
      n += wins[i][j];
    }
  }
  return n === 0 ? 0 : total / n;
}

/**
 * Fit Bradley–Terry rewards by gradient descent on the pairwise loss.
 * The model only sees differences, so the result is centred to mean 0.
 */
export function fitBradleyTerry(wins: number[][], iters = 4000, lr = 0.05): number[] {
  const k = wins.length;
  const r = new Array(k).fill(0);
  for (let t = 0; t < iters; t++) {
    const g = new Array(k).fill(0);
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const n = wins[i][j] + wins[j][i];
        if (n === 0) continue;
        // d(log-lik)/dr_i = wins_ij − n·σ(r_i − r_j)
        const resid = wins[i][j] - n * sigmoid(r[i] - r[j]);
        g[i] += resid;
        g[j] -= resid;
      }
    }
    for (let i = 0; i < k; i++) r[i] += (lr * g[i]) / k;
  }
  const mean = r.reduce((s, x) => s + x, 0) / k;
  return r.map((x) => x - mean);
}

/** Optimum of max E_π[r] − β·KL(π‖π_ref): π*(y) ∝ π_ref(y)·exp(r(y)/β). */
export function tiltedPolicy(ref: number[], reward: number[], beta: number): number[] {
  const logits = ref.map((p, i) => Math.log(p) + reward[i] / beta);
  const m = Math.max(...logits);
  const w = logits.map((l) => Math.exp(l - m));
  const z = w.reduce((s, x) => s + x, 0);
  return w.map((x) => x / z);
}

/** KL(p‖q) in nats. */
export function klDivergence(p: number[], q: number[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) if (p[i] > 0) s += p[i] * Math.log(p[i] / q[i]);
  return Math.max(0, s);
}

export function expectation(p: number[], values: number[]): number {
  return p.reduce((s, pi, i) => s + pi * values[i], 0);
}

/** DPO's implicit reward: β·log(π/π_ref). Equals r − β·log Z at the optimum. */
export function implicitReward(policy: number[], ref: number[], beta: number): number[] {
  return policy.map((p, i) => beta * Math.log(p / ref[i]));
}

/** DPO loss on one pair, given log π_θ and log π_ref of winner and loser. */
export function dpoLoss(logPiW: number, logRefW: number, logPiL: number, logRefL: number, beta: number): number {
  return pairLoss(beta * (logPiW - logRefW), beta * (logPiL - logRefL));
}

export type BetaPoint = { beta: number; kl: number; reward: number; quality: number; policy: number[] };

export function betaPoint(demo: RlhfDemo, reward: number[], beta: number): BetaPoint {
  const ref = demo.candidates.map((c) => c.ref);
  const quality = demo.candidates.map((c) => c.quality);
  const policy = tiltedPolicy(ref, reward, beta);
  return { beta, kl: klDivergence(policy, ref), reward: expectation(policy, reward), quality: expectation(policy, quality), policy };
}

/** β on a log grid from 10^lo to 10^hi. */
export function logBetaGrid(lo: number, hi: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => 10 ** (lo + ((hi - lo) * i) / (n - 1)));
}

export function sweepBeta(demo: RlhfDemo, reward: number[], betas: number[]): BetaPoint[] {
  return betas.map((b) => betaPoint(demo, reward, b));
}

/** The β on the sweep where true quality peaks. */
export function bestBeta(points: BetaPoint[]): BetaPoint {
  return points.reduce((best, p) => (p.quality > best.quality ? p : best), points[0]);
}

export const LOG_BETA_MIN = -1.3; // β ≈ 0.05
export const LOG_BETA_MAX = 0.7; // β ≈ 5
export const LOG_BETA_DEFAULT = 0; // β = 1

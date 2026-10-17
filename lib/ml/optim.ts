// The toy loss and the five update rules the Training chapter animates:
// GD, SGD, Momentum, RMSProp and Adam on one elongated two-dimensional bowl.
// Every function is pure; SGD's gradient noise comes from a seeded rng so a
// reload draws the same path. No React here; see tests/optim.test.ts.

import { createRng, randomNormal, type Rng } from "./random";

export type Vec2 = readonly [number, number];
export type OptimizerName = "gd" | "sgd" | "momentum" | "rmsprop" | "adam";

/** Where every trajectory starts. */
export const START: Vec2 = [-2.6, 2.2];

// f(x, y) = ½ (x²/9 + y²): a bowl nine times flatter along x than along y.
export function bowlLoss([x, y]: Vec2): number {
  return 0.5 * ((x * x) / 9 + y * y);
}

export function bowlGrad([x, y]: Vec2): Vec2 {
  return [x / 9, y];
}

// The level set f = level is the ellipse x²/9 + y² = 2·level, drawn as a closed polyline.
export function bowlContour(level: number, n = 96): Vec2[] {
  const a = 3 * Math.sqrt(2 * level);
  const b = Math.sqrt(2 * level);
  const pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n;
    pts.push([a * Math.cos(t), b * Math.sin(t)]);
  }
  return pts;
}

// θ ← θ − η g
export function gdStep(theta: Vec2, grad: Vec2, lr: number): Vec2 {
  return [theta[0] - lr * grad[0], theta[1] - lr * grad[1]];
}

// v_t = β v_{t−1} + g_t,  θ ← θ − η v_t
export type MomentumState = { theta: Vec2; v: Vec2 };
export function momentumStep(st: MomentumState, grad: Vec2, lr: number, beta: number): MomentumState {
  const v: Vec2 = [beta * st.v[0] + grad[0], beta * st.v[1] + grad[1]];
  return { theta: [st.theta[0] - lr * v[0], st.theta[1] - lr * v[1]], v };
}

// s_t = ρ s_{t−1} + (1 − ρ) g_t²,  θ ← θ − η g_t / √(s_t + ε)
export type RmsPropState = { theta: Vec2; s: Vec2 };
export function rmspropStep(st: RmsPropState, grad: Vec2, lr: number, rho: number, eps = 1e-8): RmsPropState {
  const s: Vec2 = [rho * st.s[0] + (1 - rho) * grad[0] * grad[0], rho * st.s[1] + (1 - rho) * grad[1] * grad[1]];
  return {
    theta: [st.theta[0] - (lr * grad[0]) / Math.sqrt(s[0] + eps), st.theta[1] - (lr * grad[1]) / Math.sqrt(s[1] + eps)],
    s,
  };
}

// m_t = β₁ m_{t−1} + (1 − β₁) g_t,  v_t = β₂ v_{t−1} + (1 − β₂) g_t²,
// m̂ = m_t / (1 − β₁ᵗ),  v̂ = v_t / (1 − β₂ᵗ),  θ ← θ − η m̂ / (√v̂ + ε)
export type AdamState = { theta: Vec2; m: Vec2; v: Vec2; t: number; mHat: Vec2; vHat: Vec2 };
export function adamStep(st: AdamState, grad: Vec2, lr: number, beta1: number, beta2: number, eps = 1e-8): AdamState {
  const t = st.t + 1;
  const m: Vec2 = [beta1 * st.m[0] + (1 - beta1) * grad[0], beta1 * st.m[1] + (1 - beta1) * grad[1]];
  const v: Vec2 = [beta2 * st.v[0] + (1 - beta2) * grad[0] * grad[0], beta2 * st.v[1] + (1 - beta2) * grad[1] * grad[1]];
  const c1 = 1 - Math.pow(beta1, t);
  const c2 = 1 - Math.pow(beta2, t);
  const mHat: Vec2 = [m[0] / c1, m[1] / c1];
  const vHat: Vec2 = [v[0] / c2, v[1] / c2];
  return {
    theta: [st.theta[0] - (lr * mHat[0]) / (Math.sqrt(vHat[0]) + eps), st.theta[1] - (lr * mHat[1]) / (Math.sqrt(vHat[1]) + eps)],
    m,
    v,
    t,
    mHat,
    vHat,
  };
}

// One learning rate per method, chosen so each is visibly characteristic on
// the bowl within forty steps (see the figure's narration).
export const HYPER = {
  gd: { lr: 1.8 },
  sgd: { lr: 1.8, noiseSd: 0.1 },
  momentum: { lr: 0.5, beta: 0.8 },
  rmsprop: { lr: 0.16, rho: 0.9 },
  adam: { lr: 0.16, beta1: 0.9, beta2: 0.999 },
} as const;

export type TrajectoryPoint = {
  /** Position after this many steps (index 0 is START). */
  theta: Vec2;
  loss: number;
  /** True gradient at theta. */
  grad: Vec2;
  /** The gradient the optimizer actually used to reach this point (noisy for SGD); undefined at step 0. */
  used?: Vec2;
  /** Momentum's velocity after this step. */
  v?: Vec2;
  /** RMSProp's running mean of squared gradients after this step. */
  s?: Vec2;
  /** Adam's bias-corrected moments after this step. */
  mHat?: Vec2;
  vHat?: Vec2;
};

function noisyGrad(grad: Vec2, rng: Rng, sd: number): Vec2 {
  return [grad[0] + randomNormal(rng, 0, sd), grad[1] + randomNormal(rng, 0, sd)];
}

// Runs `steps` updates of one optimizer from START and returns steps + 1 points.
export function runOptimizer(name: OptimizerName, steps: number, seed = 1): TrajectoryPoint[] {
  const rng = createRng(seed);
  const out: TrajectoryPoint[] = [{ theta: START, loss: bowlLoss(START), grad: bowlGrad(START) }];
  let theta: Vec2 = START;
  let mom: MomentumState = { theta: START, v: [0, 0] };
  let rms: RmsPropState = { theta: START, s: [0, 0] };
  let adam: AdamState = { theta: START, m: [0, 0], v: [0, 0], t: 0, mHat: [0, 0], vHat: [0, 0] };
  for (let i = 0; i < steps; i++) {
    const g = bowlGrad(theta);
    let used = g;
    let extra: Partial<TrajectoryPoint> = {};
    switch (name) {
      case "gd":
        theta = gdStep(theta, g, HYPER.gd.lr);
        break;
      case "sgd":
        used = noisyGrad(g, rng, HYPER.sgd.noiseSd);
        theta = gdStep(theta, used, HYPER.sgd.lr);
        break;
      case "momentum":
        mom = momentumStep(mom, g, HYPER.momentum.lr, HYPER.momentum.beta);
        theta = mom.theta;
        extra = { v: mom.v };
        break;
      case "rmsprop":
        rms = rmspropStep(rms, g, HYPER.rmsprop.lr, HYPER.rmsprop.rho);
        theta = rms.theta;
        extra = { s: rms.s };
        break;
      case "adam":
        adam = adamStep(adam, g, HYPER.adam.lr, HYPER.adam.beta1, HYPER.adam.beta2);
        theta = adam.theta;
        extra = { mHat: adam.mHat, vHat: adam.vHat };
        break;
    }
    out.push({ theta, loss: bowlLoss(theta), grad: bowlGrad(theta), used, ...extra });
  }
  return out;
}

// First step index whose loss is below `threshold`, or null if the run never gets there.
export function stepsToReach(traj: TrajectoryPoint[], threshold: number): number | null {
  const i = traj.findIndex((p) => p.loss < threshold);
  return i < 0 ? null : i;
}

// First step index from which the loss stays below `threshold` for the rest of
// the run (an overshooting optimizer dips below and climbs back), or null.
export function stepsToSettle(traj: TrajectoryPoint[], threshold: number): number | null {
  let k: number | null = null;
  for (let i = traj.length - 1; i >= 0; i--) {
    if (traj[i].loss >= threshold) return k;
    k = i;
  }
  return k;
}

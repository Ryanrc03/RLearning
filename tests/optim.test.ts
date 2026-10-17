import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adamStep,
  bowlContour,
  bowlGrad,
  bowlLoss,
  gdStep,
  HYPER,
  momentumStep,
  rmspropStep,
  runOptimizer,
  START,
  stepsToReach,
  stepsToSettle,
  type Vec2,
} from "@/lib/ml/optim";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("bowl loss and gradient: f = ½ (x²/9 + y²), ∇f = (x/9, y)", () => {
  close(bowlLoss([3, 1]), 1);
  close(bowlLoss([0, 0]), 0);
  const g = bowlGrad([3, 1]);
  close(g[0], 1 / 3);
  close(g[1], 1);
  // Every contour point sits on its level set.
  for (const p of bowlContour(0.5, 24)) close(bowlLoss(p), 0.5);
});

test("GD with lr 0.1 decreases the loss monotonically from the start point", () => {
  let theta: Vec2 = START;
  let prev = bowlLoss(theta);
  for (let i = 0; i < 100; i++) {
    theta = gdStep(theta, bowlGrad(theta), 0.1);
    const l = bowlLoss(theta);
    assert.ok(l < prev, `step ${i}: ${l} ≥ ${prev}`);
    prev = l;
  }
});

test("momentum state follows v_t = β v_{t−1} + g_t and θ ← θ − η v_t", () => {
  const beta = 0.9;
  const lr = 0.5;
  let st = { theta: START, v: [0, 0] as Vec2 };
  const g1 = bowlGrad(st.theta);
  st = momentumStep(st, g1, lr, beta);
  close(st.v[0], g1[0]);
  close(st.v[1], g1[1]);
  close(st.theta[0], START[0] - lr * g1[0]);
  const g2 = bowlGrad(st.theta);
  const v1 = st.v;
  st = momentumStep(st, g2, lr, beta);
  close(st.v[0], beta * v1[0] + g2[0]);
  close(st.v[1], beta * v1[1] + g2[1]);
});

test("RMSProp state follows s_t = ρ s_{t−1} + (1 − ρ) g_t² and divides the step by √(s_t + ε)", () => {
  const rho = 0.9;
  const lr = 0.1;
  const eps = 1e-8;
  let st = { theta: START, s: [0, 0] as Vec2 };
  const g1 = bowlGrad(st.theta);
  st = rmspropStep(st, g1, lr, rho, eps);
  close(st.s[0], (1 - rho) * g1[0] * g1[0]);
  close(st.s[1], (1 - rho) * g1[1] * g1[1]);
  close(st.theta[1], START[1] - (lr * g1[1]) / Math.sqrt(st.s[1] + eps));
  const s1 = st.s;
  const g2 = bowlGrad(st.theta);
  st = rmspropStep(st, g2, lr, rho, eps);
  close(st.s[0], rho * s1[0] + (1 - rho) * g2[0] * g2[0]);
  close(st.s[1], rho * s1[1] + (1 - rho) * g2[1] * g2[1]);
});

test("Adam's first bias-corrected step has magnitude ≈ lr in every coordinate", () => {
  const lr = 0.16;
  const st = adamStep({ theta: START, m: [0, 0], v: [0, 0], t: 0, mHat: [0, 0], vHat: [0, 0] }, bowlGrad(START), lr, 0.9, 0.999);
  // Bias correction cancels (1 − β): m̂ = g, v̂ = g², so the step is lr · sign(g).
  close(Math.abs(st.theta[0] - START[0]), lr, 1e-6);
  close(Math.abs(st.theta[1] - START[1]), lr, 1e-6);
  assert.ok(st.theta[0] > START[0], "x moves toward the minimum");
  assert.ok(st.theta[1] < START[1], "y moves toward the minimum");
  assert.equal(st.t, 1);
});

test("trajectories are deterministic for a seed and SGD's differ between seeds", () => {
  const a = runOptimizer("sgd", 40, 7);
  const b = runOptimizer("sgd", 40, 7);
  const c = runOptimizer("sgd", 40, 8);
  assert.deepEqual(a.map((p) => p.theta), b.map((p) => p.theta));
  assert.notDeepEqual(a.map((p) => p.theta), c.map((p) => p.theta));
  assert.equal(a.length, 41);
  assert.deepEqual(a[0].theta, START);
  // SGD used a noisy gradient, the others the true one.
  assert.notDeepEqual(a[1].used, bowlGrad(START));
  assert.deepEqual(runOptimizer("gd", 3, 1)[1].used, bowlGrad(START));
});

test("the figure's learning rates make every deterministic method reach loss < 0.01 within 40 steps", () => {
  for (const name of ["gd", "momentum", "rmsprop", "adam"] as const) {
    const t = runOptimizer(name, 40, 7);
    const k = stepsToReach(t, 0.01);
    assert.ok(k !== null && k <= 40, `${name} never reached 0.01`);
    assert.ok(t[40].loss < 0.01, `${name} ends at ${t[40].loss}`);
  }
  // GD at lr 1.8 zig-zags: y flips sign every step while shrinking.
  const gd = runOptimizer("gd", 6, 7);
  for (let i = 1; i <= 6; i++) {
    assert.ok(Math.sign(gd[i].theta[1]) === -Math.sign(gd[i - 1].theta[1]));
    assert.ok(Math.abs(gd[i].theta[1]) < Math.abs(gd[i - 1].theta[1]));
  }
  // Momentum overshoots past the minimum along x before settling.
  const mom = runOptimizer("momentum", 40, 7);
  assert.ok(mom.some((p) => p.theta[0] > 0.3), "momentum never crossed x = 0");
  assert.ok((stepsToSettle(mom, 0.01) ?? 99) > (stepsToReach(mom, 0.01) ?? 0), "overshoot climbs back above 0.01");
  assert.equal(HYPER.gd.lr, HYPER.sgd.lr);
});

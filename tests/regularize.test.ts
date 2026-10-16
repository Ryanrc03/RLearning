import { test } from "node:test";
import assert from "node:assert/strict";
import {
  circlePoints,
  dataLoss,
  diamondPoints,
  ellipsePoints,
  H_DEMO,
  l1Norm,
  l2Norm,
  lassoSolution,
  lassoZeroLambda,
  ridgeSolution,
  softThreshold,
  W_STAR,
} from "@/lib/ml/regularize";

const close = (a: number, b: number, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("λ = 0 returns w* for both ridge and lasso", () => {
  const r = ridgeSolution(H_DEMO, W_STAR, 0);
  const l = lassoSolution(H_DEMO, W_STAR, 0);
  close(r[0], W_STAR[0]);
  close(r[1], W_STAR[1]);
  close(l[0], W_STAR[0]);
  close(l[1], W_STAR[1]);
  close(dataLoss(H_DEMO, W_STAR, W_STAR), 0);
});

test("ridge matches the closed form and its norm decreases monotonically in λ", () => {
  // (H + 2I)⁻¹ H w* worked by hand: H w* = (3.74, 1.86), det = 11.64.
  const r2 = ridgeSolution(H_DEMO, W_STAR, 2);
  close(r2[0], (3 * 3.74 - 0.6 * 1.86) / 11.64);
  close(r2[1], (-0.6 * 3.74 + 4 * 1.86) / 11.64);
  let prev = Infinity;
  for (let lambda = 0; lambda <= 4; lambda += 0.05) {
    const n = l2Norm(ridgeSolution(H_DEMO, W_STAR, lambda));
    assert.ok(n < prev, `norm rose at λ = ${lambda}`);
    assert.ok(n > 0, "ridge never reaches exactly zero");
    prev = n;
  }
});

test("lasso with large λ returns exactly (0, 0)", () => {
  close(lassoZeroLambda(H_DEMO, W_STAR), 3.74);
  assert.deepEqual(lassoSolution(H_DEMO, W_STAR, 4), [0, 0]);
  assert.deepEqual(lassoSolution(H_DEMO, W_STAR, 3.74), [0, 0]);
  const just = lassoSolution(H_DEMO, W_STAR, 3.7);
  assert.ok(just[0] > 0 && just[1] === 0);
});

test("at an intermediate λ lasso has an exactly-zero coordinate while ridge has none", () => {
  const l = lassoSolution(H_DEMO, W_STAR, 2);
  const r = ridgeSolution(H_DEMO, W_STAR, 2);
  assert.equal(l[1], 0);
  assert.ok(l[0] > 0);
  close(l[0], (3.74 - 2) / 2);
  assert.ok(r[0] !== 0 && r[1] !== 0);
  // Lasso's solution satisfies the optimality condition: |∂data loss / ∂w₂| ≤ λ at w₂ = 0.
  const d = [l[0] - W_STAR[0], l[1] - W_STAR[1]];
  const g2 = H_DEMO[1][0] * d[0] + H_DEMO[1][1] * d[1];
  assert.ok(Math.abs(g2) <= 2 + 1e-9);
  assert.ok(l1Norm(l) < l1Norm(W_STAR));
  close(softThreshold(0.5, 1), 0);
  close(softThreshold(3, 1), 2);
  close(softThreshold(-3, 1), -2);
});

test("contour and constraint polylines sit on their level sets", () => {
  for (const p of ellipsePoints(H_DEMO, W_STAR, 0.7, 24)) close(dataLoss(H_DEMO, W_STAR, p), 0.7, 1e-9);
  for (const p of circlePoints(1.3, 16)) close(l2Norm(p), 1.3, 1e-9);
  for (const p of diamondPoints(1.3)) close(l1Norm(p), 1.3, 1e-9);
});

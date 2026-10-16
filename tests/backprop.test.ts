import { test } from "node:test";
import assert from "node:assert/strict";
import { backward, bce, DEMO_PARAMS, DEMO_X, DEMO_Y, forward, gradientChain, layerFactors, MAX_DEPTH, numericGradient, RESIDUAL_SEED, sigmoid } from "@/lib/ml/backprop";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("forward pass on the demo numbers: a = W⁽¹⁾x, z = σ(a), s = W⁽⁰⁾ᵀz, p = σ(s), L = −log p", () => {
  const f = forward(DEMO_PARAMS, DEMO_X);
  assert.deepEqual(f.a.map((v) => Math.round(v * 1000) / 1000), [0.6, 0.75]);
  close(f.z[0], sigmoid(0.6));
  close(f.z[1], sigmoid(0.75));
  close(f.s, 0.7 * sigmoid(0.6) - 1.1 * sigmoid(0.75));
  close(f.p, sigmoid(f.s));
  close(f.loss, -Math.log(f.p));
  close(bce(0.5, 1), Math.log(2));
});

test("∂L/∂W⁽⁰⁾ = −(1−p) · z holds exactly for the demo numbers", () => {
  const f = forward(DEMO_PARAMS, DEMO_X);
  const b = backward(DEMO_PARAMS, DEMO_X, DEMO_Y);
  assert.deepEqual(b.dLdw0, f.z.map((z) => -(1 - f.p) * z));
  // The two local derivatives really multiply to the collapsed form.
  close(b.dLdp, -1 / f.p);
  close(b.dpds, f.p * (1 - f.p));
  close(b.dLdp * b.dpds, b.dLds, 1e-12);
  close(b.dLds, -(1 - f.p), 1e-12);
});

test("∂L/∂W⁽¹⁾ = −(1−p) · W⁽⁰⁾ ⊙ z(1−z) · xᵀ", () => {
  const f = forward(DEMO_PARAMS, DEMO_X);
  const b = backward(DEMO_PARAMS, DEMO_X, DEMO_Y);
  for (let i = 0; i < 2; i++) {
    close(b.dLdz[i], -(1 - f.p) * DEMO_PARAMS.w0[i], 1e-12);
    close(b.dzda[i], f.z[i] * (1 - f.z[i]), 1e-12);
    for (let j = 0; j < 2; j++) {
      close(b.dLdw1[i][j], -(1 - f.p) * DEMO_PARAMS.w0[i] * f.z[i] * (1 - f.z[i]) * DEMO_X[j], 1e-12);
    }
  }
});

test("analytic gradients match central finite differences within 1e-5", () => {
  for (const y of [1, 0]) {
    const b = backward(DEMO_PARAMS, DEMO_X, y);
    const n = numericGradient(DEMO_PARAMS, DEMO_X, y, 1e-5);
    for (let i = 0; i < 2; i++) {
      close(b.dLdw0[i], n.dLdw0[i], 1e-5);
      for (let j = 0; j < 2; j++) close(b.dLdw1[i][j], n.dLdw1[i][j], 1e-5);
    }
  }
  // A second, asymmetric set of weights so the test is not tied to the demo.
  const other = { w1: [[-1.3, 0.2], [0.45, -0.7]], w0: [1.9, 0.35] };
  const b = backward(other, [0.3, -1.2], 1);
  const n = numericGradient(other, [0.3, -1.2], 1);
  for (let i = 0; i < 2; i++) {
    close(b.dLdw0[i], n.dLdw0[i], 1e-5);
    for (let j = 0; j < 2; j++) close(b.dLdw1[i][j], n.dLdw1[i][j], 1e-5);
  }
});

test("a plain chain of twenty 0.6 layers shrinks the gradient to 0.6²⁰ ≈ 3.66e-5", () => {
  const chain = gradientChain(Array(20).fill(0.6), false);
  assert.equal(chain.length, 20);
  close(chain[0], 0.6, 1e-12);
  close(chain[19], Math.pow(0.6, 20), 1e-12);
  close(chain[19], 3.66e-5, 1e-7);
});

test("a residual chain with ∂f/∂x = 0 passes the gradient through unchanged", () => {
  const chain = gradientChain(Array(12).fill(0), true);
  assert.deepEqual(chain, Array(12).fill(1));
});

test("layer factors are seeded, within [−0.4, 0.6], and the residual chain over 30 layers stays within [0.05, 20]", () => {
  const f = layerFactors(RESIDUAL_SEED, MAX_DEPTH);
  assert.deepEqual(f, layerFactors(RESIDUAL_SEED, MAX_DEPTH));
  assert.equal(f.length, 30);
  assert.ok(f.every((x) => x >= -0.4 && x <= 0.6));
  // Prefix stability: asking for fewer layers gives the same leading factors.
  assert.deepEqual(layerFactors(RESIDUAL_SEED, 10), f.slice(0, 10));
  const residual = gradientChain(f, true);
  const plain = gradientChain(f, false);
  for (let i = 0; i < 30; i++) assert.ok(residual[i] >= 0.05 && residual[i] <= 20, `layer ${i + 1}: ${residual[i]}`);
  assert.ok(plain[29] < 1e-6, `plain product ${plain[29]} should have vanished`);
});

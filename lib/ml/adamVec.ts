// Full-batch Adam over a flat parameter vector, for the small models the
// Recommender Systems figures train in the browser (ESMM towers, FM, DCN).
// lib/ml/optim.ts keeps its 2-D version for the optimizer page.

export type Objective = (theta: readonly number[]) => { loss: number; grad: number[] };

export type AdamOptions = { steps: number; lr: number; beta1?: number; beta2?: number; eps?: number };

export function adamMinimize(f: Objective, init: readonly number[], opts: AdamOptions): { theta: number[]; loss: number } {
  const { steps, lr, beta1 = 0.9, beta2 = 0.999, eps = 1e-8 } = opts;
  const theta = [...init];
  const m = theta.map(() => 0);
  const v = theta.map(() => 0);
  for (let t = 1; t <= steps; t++) {
    const { grad } = f(theta);
    for (let i = 0; i < theta.length; i++) {
      m[i] = beta1 * m[i] + (1 - beta1) * grad[i];
      v[i] = beta2 * v[i] + (1 - beta2) * grad[i] * grad[i];
      const mHat = m[i] / (1 - beta1 ** t);
      const vHat = v[i] / (1 - beta2 ** t);
      theta[i] -= (lr * mHat) / (Math.sqrt(vHat) + eps);
    }
  }
  return { theta, loss: f(theta).loss };
}

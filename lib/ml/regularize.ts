// L1 / L2 regularisation on a two-weight quadratic data loss
// ½ (w − w*)ᵀ H (w − w*): the ridge solution in closed form, the lasso
// solution by coordinate descent with soft-thresholding, and the loss
// contours as polylines. No React here; see tests/regularize.test.ts.

export type Vec2 = readonly [number, number];
/** Symmetric positive-definite 2×2 matrix [[a, b], [b, c]]. */
export type Mat2 = readonly [Vec2, Vec2];

/** The unregularised optimum and curvature used by the figure. */
export const W_STAR: Vec2 = [1.6, 0.9];
export const H_DEMO: Mat2 = [
  [2, 0.6],
  [0.6, 1],
];

export function matVec(H: Mat2, v: Vec2): Vec2 {
  return [H[0][0] * v[0] + H[0][1] * v[1], H[1][0] * v[0] + H[1][1] * v[1]];
}

export function dataLoss(H: Mat2, wStar: Vec2, w: Vec2): number {
  const d: Vec2 = [w[0] - wStar[0], w[1] - wStar[1]];
  const Hd = matVec(H, d);
  return 0.5 * (d[0] * Hd[0] + d[1] * Hd[1]);
}

export const l1Norm = (w: Vec2) => Math.abs(w[0]) + Math.abs(w[1]);
export const l2Norm = (w: Vec2) => Math.hypot(w[0], w[1]);

// argmin ½ (w − w*)ᵀ H (w − w*) + ½ λ ‖w‖₂²  =  (H + λI)⁻¹ H w*
export function ridgeSolution(H: Mat2, wStar: Vec2, lambda: number): Vec2 {
  const a = H[0][0] + lambda;
  const b = H[0][1];
  const c = H[1][1] + lambda;
  const det = a * c - b * b;
  const rhs = matVec(H, wStar);
  return [(c * rhs[0] - b * rhs[1]) / det, (-b * rhs[0] + a * rhs[1]) / det];
}

export function softThreshold(z: number, t: number): number {
  if (z > t) return z - t;
  if (z < -t) return z + t;
  return 0;
}

// argmin ½ (w − w*)ᵀ H (w − w*) + λ ‖w‖₁ by cyclic coordinate descent. Each
// coordinate's subproblem is a 1-D quadratic plus |w_i|, solved exactly with
// soft-thresholding, so coordinates land on exactly 0 when λ is large enough.
export function lassoSolution(H: Mat2, wStar: Vec2, lambda: number, tol = 1e-12, maxIter = 10000): Vec2 {
  const w: [number, number] = [wStar[0], wStar[1]];
  for (let it = 0; it < maxIter; it++) {
    let maxDelta = 0;
    for (let i = 0; i < 2; i++) {
      const j = 1 - i;
      const c = H[i][i] * wStar[i] - H[i][j] * (w[j] - wStar[j]);
      const next = softThreshold(c, lambda) / H[i][i];
      maxDelta = Math.max(maxDelta, Math.abs(next - w[i]));
      w[i] = next;
    }
    if (maxDelta < tol) break;
  }
  return [w[0], w[1]];
}

// The ellipse ½ (w − w*)ᵀ H (w − w*) = level as a closed polyline, via the eigenvectors of H.
export function ellipsePoints(H: Mat2, wStar: Vec2, level: number, n = 96): Vec2[] {
  const a = H[0][0];
  const b = H[0][1];
  const c = H[1][1];
  const theta = 0.5 * Math.atan2(2 * b, a - c);
  const mean = (a + c) / 2;
  const half = Math.sqrt(((a - c) / 2) ** 2 + b * b);
  const l1 = mean + half;
  const l2 = mean - half;
  const r1 = Math.sqrt((2 * level) / l1);
  const r2 = Math.sqrt((2 * level) / l2);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n;
    const u = r1 * Math.cos(t);
    const v = r2 * Math.sin(t);
    pts.push([wStar[0] + cos * u - sin * v, wStar[1] + sin * u + cos * v]);
  }
  return pts;
}

/** The L1 ball ‖w‖₁ = r as a diamond. */
export function diamondPoints(r: number): Vec2[] {
  return [
    [r, 0],
    [0, r],
    [-r, 0],
    [0, -r],
    [r, 0],
  ];
}

/** The L2 ball ‖w‖₂ = r as a circle. */
export function circlePoints(r: number, n = 96): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n;
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  return pts;
}

/** Smallest λ at which the lasso solution is exactly (0, 0): max |(H w*)_i|. */
export function lassoZeroLambda(H: Mat2, wStar: Vec2): number {
  const g = matVec(H, wStar);
  return Math.max(Math.abs(g[0]), Math.abs(g[1]));
}

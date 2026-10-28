// KL divergence between two discrete distributions, the per-outcome terms that
// add up to it, and the k3 estimator GRPO trainers use per token.
// No React here; see tests/kl-divergence.test.ts.

/** Turn counts into probabilities with add-α smoothing so no bucket is exactly 0. */
export function smoothCounts(counts: readonly number[], alpha = 1): number[] {
  const total = counts.reduce((s, c) => s + c, 0) + alpha * counts.length;
  if (total <= 0) throw new Error("smoothCounts: nothing to normalise");
  return counts.map((c) => (c + alpha) / total);
}

/**
 * Per-outcome terms p_i · ln(p_i / q_i). They sum to KL(p ‖ q); a term is negative
 * where p puts less mass than q, but the sum is never negative (Gibbs' inequality).
 */
export function klTerms(p: readonly number[], q: readonly number[]): number[] {
  if (p.length !== q.length) throw new Error("klTerms: length mismatch");
  return p.map((pi, i) => {
    if (pi === 0) return 0;
    if (q[i] === 0) return Infinity;
    return pi * Math.log(pi / q[i]);
  });
}

/** KL(p ‖ q) in nats. Asymmetric: KL(p ‖ q) ≠ KL(q ‖ p) in general. */
export function klDivergence(p: readonly number[], q: readonly number[]): number {
  return klTerms(p, q).reduce((s, t) => s + t, 0);
}

/**
 * The k3 estimator for one sampled token: with x = ln π_ref(a) − ln π_θ(a),
 * k3 = eˣ − x − 1. It is ≥ 0 for every sample, and its expectation under π_θ is
 * exactly KL(π_θ ‖ π_ref); this is the per-token KL in the GRPO loss.
 */
export function k3(logRefMinusLogPolicy: number): number {
  const x = logRefMinusLogPolicy;
  return Math.expm1(x) - x;
}

/** E_{a ~ p}[k3(ln q(a) − ln p(a))], which equals KL(p ‖ q) for any p, q with full support. */
export function expectedK3(p: readonly number[], q: readonly number[]): number {
  return p.reduce((s, pi, i) => (pi === 0 ? s : s + pi * k3(Math.log(q[i]) - Math.log(pi))), 0);
}

/** Mixture (1 − t)·p + t·q, used to show KL growing as one distribution slides toward another. */
export function mixDistributions(p: readonly number[], q: readonly number[], t: number): number[] {
  return p.map((pi, i) => (1 - t) * pi + t * q[i]);
}

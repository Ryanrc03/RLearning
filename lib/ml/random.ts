// Seeded random numbers so every figure draws the same picture after a reload.
// No React here; see tests/metrics.test.ts.

export type Rng = () => number;

// Park–Miller minimal standard LCG (multiplier 48271, modulus 2^31 − 1); returns [0, 1).
export function createRng(seed: number): Rng {
  let state = Math.floor(seed) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

// Box–Muller; one draw per call, the second half is discarded for simplicity.
export function randomNormal(rng: Rng, mean = 0, sd = 1): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + sd * z;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

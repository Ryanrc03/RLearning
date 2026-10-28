/** All behavior probabilities in this example are exposure-marginal, not funnel conditionals. */
export const FUSION_TARGETS = ["click", "like", "favorite", "pay"] as const;
export type FusionTarget = typeof FUSION_TARGETS[number];
export type FusionVector = Record<FusionTarget, number>;
export type FusionCandidate = FusionVector & { id: string; price: number };
export type FusionMode = "sum" | "ctr" | "rank" | "product";
export type FusionPowers = FusionVector & { price: number };
export type FusionParameters = { weights: FusionVector; alpha: number; beta: number; powers: FusionPowers; priceReference: number };
export const DEFAULT_CANDIDATES: readonly FusionCandidate[] = [
  { id: "A", click: 0.4, like: 0.02, favorite: 0.01, pay: 0.005, price: 80 },
  { id: "B", click: 0.2, like: 0.18, favorite: 0.1, pay: 0.02, price: 120 },
  { id: "C", click: 0.3, like: 0.08, favorite: 0.04, pay: 0.01, price: 200 },
  { id: "D", click: 0.12, like: 0.04, favorite: 0.03, pay: 0.008, price: 50 },
];
export const DEFAULT_FUSION_PARAMETERS: FusionParameters = {
  weights: { click: 1, like: 1, favorite: 1, pay: 1 }, alpha: 1, beta: 1,
  powers: { click: 1, like: 1, favorite: 1, pay: 1, price: 0.5 }, priceReference: 100,
};
function nonnegative(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError("Expected a finite nonnegative value");
  return value;
}
export function weightedSum(candidate: FusionVector, weights: FusionVector): number {
  return FUSION_TARGETS.reduce((sum, key) => sum + nonnegative(candidate[key]) * nonnegative(weights[key]), 0);
}
/** Click has fixed coefficient 1; weights.click is unused in this mode. */
export function ctrWeightedSum(candidate: FusionVector, weights: FusionVector): number {
  return nonnegative(candidate.click) * (1 + FUSION_TARGETS.filter(k => k !== "click").reduce((sum, key) => sum + nonnegative(candidate[key]) * nonnegative(weights[key]), 0));
}
export function rankDecay(rank: number, alpha: number, beta: number): number {
  if (!Number.isInteger(rank) || rank < 1 || !Number.isFinite(alpha) || alpha <= 0) throw new RangeError("Rank must be a positive integer and alpha must be positive");
  return 1 / (rank ** alpha + nonnegative(beta));
}
/** Competition ranking: equal values share rank; 1,1,3. No mutation. */
export function componentRanks(candidates: readonly FusionCandidate[]): FusionVector[] {
  return candidates.map(candidate => Object.fromEntries(FUSION_TARGETS.map(key => [key, 1 + candidates.filter(other => other[key] > candidate[key]).length])) as FusionVector);
}
/** A zero base contributes -Infinity for positive power; power zero omits that factor. */
export function productLogScore(candidate: FusionCandidate, powers: FusionPowers, priceReference: number): number {
  if (!Number.isFinite(priceReference) || priceReference <= 0) throw new RangeError("Price reference must be positive");
  return ([...FUSION_TARGETS, "price"] as const).reduce((sum, key) => {
    const power = nonnegative(powers[key]);
    const base = nonnegative(candidate[key]) / (key === "price" ? priceReference : 1);
    return power === 0 ? sum : sum + power * Math.log(base);
  }, 0);
}
export function productScore(candidate: FusionCandidate, powers: FusionPowers, priceReference: number): number {
  return Math.exp(productLogScore(candidate, powers, priceReference));
}
// Relative tolerance avoids splitting decimal arithmetic ties without merging
// distinct very small product scores merely because both are near zero.
function scoresTied(a: number, b: number): boolean {
  return a === b || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b)));
}
export function scoreCandidates(candidates: readonly FusionCandidate[], mode: FusionMode, parameters: FusionParameters = DEFAULT_FUSION_PARAMETERS) {
  const ranks = componentRanks(candidates);
  const results = candidates.map((candidate, index) => {
    const score = mode === "sum" ? weightedSum(candidate, parameters.weights)
      : mode === "ctr" ? ctrWeightedSum(candidate, parameters.weights)
      : mode === "product" ? productScore(candidate, parameters.powers, parameters.priceReference)
      : FUSION_TARGETS.reduce((sum, key) => sum + nonnegative(parameters.weights[key]) * rankDecay(ranks[index][key], parameters.alpha, parameters.beta), 0);
    return { ...candidate, score, componentRanks: ranks[index] };
  });
  return results.sort((a,b) => scoresTied(a.score,b.score) ? a.id.localeCompare(b.id) : b.score - a.score).map((result, index, sorted) => ({ ...result, rank: 1 + sorted.slice(0, index).filter(r => r.score > result.score && !scoresTied(r.score, result.score)).length }));
}

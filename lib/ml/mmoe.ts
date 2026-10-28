import { softmax } from "@/lib/ml/clip";
import type { Rng } from "@/lib/ml/random";

export type GateMask = (0 | 1)[];
export const DEMO_EXPERTS = [[1, 0], [0, 1], [1, 1]];

function dropoutRate(rate: number) {
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) throw new RangeError("dropout rate must be in [0, 1)");
}
function nonnegative(values: number[]) {
  if (!values.length || values.some((v) => !Number.isFinite(v) || v < 0)) throw new RangeError("weights must be finite, nonnegative and nonempty");
}
export function gateSoftmax(logits: number[]): number[] {
  if (!logits.length || logits.some((v) => !Number.isFinite(v))) throw new RangeError("finite gate logits required");
  return softmax(logits);
}
// Allows unnormalized weights: standard dropout does not preserve a convex sum.
export function aggregateExperts(experts: number[][], weights: number[]): number[] {
  nonnegative(weights);
  const d = experts[0]?.length;
  if (!d || experts.length !== weights.length || experts.some((e) => e.length !== d || e.some((v) => !Number.isFinite(v)))) throw new RangeError("experts must be K equal-length finite vectors, matching K weights");
  return Array.from({ length: d }, (_, j) => experts.reduce((sum, e, i) => sum + weights[i] * e[j], 0));
}
export function invertedGateDropout(gate: number[], mask: GateMask, rate: number): number[] {
  nonnegative(gate); dropoutRate(rate);
  if (gate.some((g) => g > 1) || mask.length !== gate.length || mask.some((m) => m !== 0 && m !== 1)) throw new RangeError("one binary mask per gate probability required");
  return gate.map((g, i) => mask[i] * g / (1 - rate));
}
export function drawGateMask(count: number, rate: number, rng: Rng): GateMask {
  dropoutRate(rate);
  if (!Number.isInteger(count) || count < 1) throw new RangeError("positive expert count required");
  return Array.from({ length: count }, () => rng() < rate ? 0 : 1);
}
// Two fixed illustrative gate logit vectors and towers; this is a forward-pass
// teaching example, not a trained model. The slider edits only the chosen gate.
export function mmoeDemo(thirdLogits: [number, number]) {
  return ["CTR", "Like"].map((task, t) => {
    const logits = t === 0 ? [0, 0.4, thirdLogits[t]] : [0.6, 0, thirdLogits[t]];
    const gate = gateSoftmax(logits);
    const hidden = aggregateExperts(DEMO_EXPERTS, gate);
    const logit = t === 0 ? hidden[0] - hidden[1] - 0.2 : 0.5 * hidden[0] + hidden[1] - 0.8;
    return { task, logits, gate, hidden, prediction: 1 / (1 + Math.exp(-logit)) };
  });
}

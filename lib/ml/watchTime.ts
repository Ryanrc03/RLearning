// Chapter 04: time is a nonnegative numerical value measured in seconds.
function time(t: number) {
  if (!Number.isFinite(t) || t < 0) throw new RangeError("watch time must be finite and nonnegative");
}
function probability(p: number) {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError("probability must be in [0,1]");
}
export function watchTimeTransform(t: number) {
  time(t);
  const label = t / (1 + t);
  const logit = t === 0 ? -Infinity : Math.log(t);
  return { time: t, label, logit, inferred: Math.exp(logit) };
}
export function softTimeBce(t: number, logit: number): number {
  const { label } = watchTimeTransform(t);
  if (Number.isNaN(logit)) throw new RangeError("logit must not be NaN");
  if (logit === -Infinity) return label === 0 ? 0 : Infinity;
  if (logit === Infinity) return label === 1 ? 0 : Infinity;
  return Math.max(logit, 0) - label * logit + Math.log1p(Math.exp(-Math.abs(logit)));
}
export function mixtureTimeOptimum(times: number[], weights: number[]) {
  if (!times.length || times.length !== weights.length || weights.some((w) => !Number.isFinite(w) || w < 0)) throw new RangeError("matching nonnegative mixture weights required");
  const total = weights.reduce((s, w) => s + w, 0);
  if (!(total > 0)) throw new RangeError("positive mixture weight required");
  times.forEach(time);
  const label = times.reduce((s, t, i) => s + watchTimeTransform(t).label * weights[i] / total, 0);
  const mean = times.reduce((s, t, i) => s + t * weights[i] / total, 0);
  return { label, proxy: label / (1 - label), mean };
}
export function completionLabel(watched: number, duration: number, threshold = 0.8): 0 | 1 {
  time(watched); time(duration); probability(threshold);
  if (duration === 0) throw new RangeError("duration must be positive");
  return watched / duration >= threshold ? 1 : 0;
}
// Synthetic teaching curve, NOT estimated business data. Anchors: f(15)=.5,
// f(180)=.1. Manual UI point overrides do not alter this curve.
export function lengthBaseline(duration: number): number {
  time(duration);
  if (duration === 0) throw new RangeError("duration must be positive");
  return 0.5 * Math.exp(-Math.log(5) * (duration - 15) / 165);
}
export function completionScore(prediction: number, baseline: number, floor = 0.01) {
  probability(prediction); probability(baseline); probability(floor);
  if (floor === 0) throw new RangeError("positive denominator floor required");
  const denominator = Math.max(baseline, floor);
  return { score: prediction / denominator, denominator, protected: baseline < floor };
}

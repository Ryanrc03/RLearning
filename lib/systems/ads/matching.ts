// Toy identity-matching candidates for chapter 02's threshold playground.
// Scores and the "truth" column are invented so the trade-off is visible; they are not production metrics.
// No React here; see tests/ads-backend.test.ts.

export type Candidate = {
  conversionId: string;
  touchpointId: string;
  method: "deterministic" | "probabilistic";
  /** Signals the toy model looked at; every one assumes consent and platform rules allow it. */
  signals: string;
  score: number;
  /** Ground truth that only exists in this sandbox. A real system never gets to see it. */
  truth: boolean;
};

export const CANDIDATES: Candidate[] = [
  { conversionId: "event_501", touchpointId: "click_101", method: "deterministic", signals: "落地页 URL 带回的 click_id", score: 1, truth: true },
  { conversionId: "event_501", touchpointId: "click_100", method: "probabilistic", signals: "同一广告主 · 间隔 40 min · 同一浏览器家族", score: 0.86, truth: true },
  { conversionId: "event_502", touchpointId: "click_102", method: "deterministic", signals: "广告主上报的 hashed email（用户已同意）", score: 1, truth: true },
  { conversionId: "event_503", touchpointId: "click_103", method: "probabilistic", signals: "间隔 2 h · 同一落地页 · 同一粗粒度地区", score: 0.74, truth: true },
  { conversionId: "event_503", touchpointId: "click_310", method: "probabilistic", signals: "间隔 3 h · 同一粗粒度地区", score: 0.56, truth: false },
  { conversionId: "event_504", touchpointId: "click_311", method: "probabilistic", signals: "间隔 5 h · 同一浏览器家族", score: 0.63, truth: false },
  { conversionId: "event_505", touchpointId: "click_312", method: "probabilistic", signals: "间隔 8 min · 同一落地页 · 同一浏览器家族", score: 0.92, truth: true },
  { conversionId: "event_506", touchpointId: "click_314", method: "probabilistic", signals: "间隔 50 min · 同一落地页", score: 0.52, truth: true },
  { conversionId: "event_506", touchpointId: "click_313", method: "probabilistic", signals: "间隔 4 h · 同一粗粒度地区", score: 0.45, truth: false },
  { conversionId: "event_507", touchpointId: "click_315", method: "probabilistic", signals: "间隔 6 min · 同一落地页 · 家庭共用设备", score: 0.88, truth: false },
  { conversionId: "event_508", touchpointId: "click_316", method: "probabilistic", signals: "间隔 9 h", score: 0.38, truth: false },
  { conversionId: "event_508", touchpointId: "click_317", method: "probabilistic", signals: "间隔 20 h · 同一落地页", score: 0.33, truth: true },
];

export type MatchStats = {
  accepted: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  /** Share of conversions that end up with at least one accepted match. */
  coverage: number;
  conversions: number;
};

export function matchStats(threshold: number, candidates: Candidate[] = CANDIDATES): MatchStats {
  const accepted = candidates.filter((c) => c.score >= threshold);
  const tp = accepted.filter((c) => c.truth).length;
  const fp = accepted.length - tp;
  const allTrue = candidates.filter((c) => c.truth).length;
  const conversions = new Set(candidates.map((c) => c.conversionId));
  const covered = new Set(accepted.map((c) => c.conversionId));
  return {
    accepted: accepted.length,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: allTrue - tp,
    precision: accepted.length ? tp / accepted.length : 1,
    recall: allTrue ? tp / allTrue : 1,
    coverage: covered.size / conversions.size,
    conversions: conversions.size,
  };
}

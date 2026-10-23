// Recommender Systems: the fixed time split of KuaiRand-1K and point-in-time
// features. A rolling statistic for a sample at time t may only count rows with
// timestamp strictly before t; the sample's own request shares t and is left
// out. No React here; see tests/point-in-time.test.ts.

import { auc } from "./metrics";
import { createRng } from "./random";

// Day 0 = 2022-04-08, day 30 = 2022-05-08.
export const DAY_LABELS = Array.from({ length: 31 }, (_, i) => {
  const d = new Date(Date.UTC(2022, 3, 8 + i));
  return `${d.getUTCMonth() + 1}/${String(d.getUTCDate()).padStart(2, "0")}`;
});

// Daily exposure counts from kuairank docs/eda_output.md §3 (before de-duplication).
export const STANDARD_DAILY = [
  358009, 400301, 404561, 370216, 345469, 346408, 326469, 361879, 389039, 396844, 333779, 337975, 339479, 345556,
  368455, 420805, 349106, 341550, 350481, 349214, 345369,
  393536, 438379, 442050, 426078, 436388, 409114, 384866, 397627, 389784, 414259,
];
// The random-exposure log starts on 4/22 (day 14).
export const RANDOM_FIRST_DAY = 14;
export const RANDOM_DAILY = [1009, 1688, 1517, 1462, 1519, 1536, 1483, 1785, 2170, 2152, 2955, 4029, 3682, 3642, 4290, 3885, 4224];

export type Split = "train" | "valid" | "test";
// PLAN §4: train 4/08–4/21, valid 4/22–4/28, test 4/29–5/08 (kurec/split.py).
export const TRAIN_LAST_DAY = 13;
export const VALID_LAST_DAY = 20;

export function splitOfDay(day: number): Split {
  if (day <= TRAIN_LAST_DAY) return "train";
  if (day <= VALID_LAST_DAY) return "valid";
  return "test";
}

export function splitTotals(): Record<Split, number> & { randomValid: number; randomTest: number } {
  const t = { train: 0, valid: 0, test: 0, randomValid: 0, randomTest: 0 };
  STANDARD_DAILY.forEach((n, d) => {
    t[splitOfDay(d)] += n;
  });
  RANDOM_DAILY.forEach((n, i) => {
    if (splitOfDay(RANDOM_FIRST_DAY + i) === "valid") t.randomValid += n;
    else t.randomTest += n;
  });
  return t;
}

// ---------------------------------------------------------------------------
// The toy: 8 videos uploaded on different days, each with its own true click
// rate. Exposures come in requests: every request has one timestamp and shows
// several videos at once. Time is in days (fractional), on the same calendar.

export type ToyExposure = { id: number; video: number; t: number; request: number; click: boolean };
export type ToyVideo = { video: number; upload: number; ctr: number };

export const TOY_VIDEOS: ToyVideo[] = [
  { video: 0, upload: 1, ctr: 0.3 },
  { video: 1, upload: 5, ctr: 0.55 },
  { video: 2, upload: 10, ctr: 0.2 },
  { video: 3, upload: 15, ctr: 0.6 },
  { video: 4, upload: 19, ctr: 0.35 },
  { video: 5, upload: 22, ctr: 0.65 },
  { video: 6, upload: 25, ctr: 0.15 },
  { video: 7, upload: 27, ctr: 0.5 },
];

// Smoothing as in kurec/features.py, (clicks + a·prior) / (n + a); the toy uses a = 5 (kuairank uses 20)
// because each toy video has only a few dozen exposures. Prior = the train click rate 0.38.
export const TOY_SMOOTH_A = 5;
export const TOY_PRIOR = 0.38;
export const TOY_SLOTS = [0.2, 0.45, 0.7, 0.95];
export const TOY_MAX_AGE = 4;

// Four requests a day; each request shows every video that is 0–4 days old with probability 0.75
// (new content gets most exposure, as in KuaiRand where 49% of exposures are within 1 day of upload).
export function toyExposures(seed = 408): ToyExposure[] {
  const rng = createRng(seed);
  const out: ToyExposure[] = [];
  let request = 0;
  for (let day = 0; day <= 30; day++) {
    for (const slot of TOY_SLOTS) {
      const t = day + slot;
      let shown = 0;
      for (const v of TOY_VIDEOS) {
        const age = t - v.upload;
        if (age < 0 || age > TOY_MAX_AGE) continue;
        if (rng() > 0.75) continue;
        out.push({ id: out.length, video: v.video, t, request, click: rng() < v.ctr });
        shown++;
      }
      if (shown > 0) request++;
    }
  }
  return out;
}

export type FeatureMode = "strict" | "same-time" | "monthly";

export const FEATURE_MODES: { key: FeatureMode; label: string }[] = [
  { key: "strict", label: "严格早于 t" },
  { key: "same-time", label: "≤ t（含本请求）" },
  { key: "monthly", label: "整月统计" },
];

// Which exposures a video click-rate feature for sample s may count under each rule.
export function countedRows(rows: readonly ToyExposure[], s: ToyExposure, mode: FeatureMode): ToyExposure[] {
  return rows.filter((r) => {
    if (r.video !== s.video) return false;
    if (mode === "strict") return r.t < s.t;
    if (mode === "same-time") return r.t <= s.t;
    return true;
  });
}

export function smoothedRate(clicks: number, n: number, a = TOY_SMOOTH_A, prior = TOY_PRIOR): number {
  return (clicks + a * prior) / (n + a);
}

export function videoFeature(rows: readonly ToyExposure[], s: ToyExposure, mode: FeatureMode) {
  const used = countedRows(rows, s, mode);
  const clicks = used.filter((r) => r.click).length;
  return { n: used.length, clicks, value: smoothedRate(clicks, used.length), includesSelf: used.some((r) => r.id === s.id) };
}

export function evalRows(rows: readonly ToyExposure[], fromDay = VALID_LAST_DAY + 1): ToyExposure[] {
  return rows.filter((r) => r.t >= fromDay);
}

// How well the feature alone ranks clicks over the test period (day ≥ 21). A feature that peeks at the
// sample's own label or at the video's future looks better offline than it can be at serving time.
export function featureAuc(rows: readonly ToyExposure[], mode: FeatureMode, fromDay = VALID_LAST_DAY + 1): number {
  return auc(evalRows(rows, fromDay).map((r) => ({ score: videoFeature(rows, r, mode).value, label: r.click })));
}

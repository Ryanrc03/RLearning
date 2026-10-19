// Recommender Systems, last page: a training sample is impression-time features
// plus a conversion label that arrives hours or days later. The join keeps each
// impression in state for a window W; a conversion that lands after W is
// written as a negative. No React here; see tests/sample-join.test.ts.

import { createRng, randomNormal } from "./random";

export type ConversionKind = "order" | "pay";

// Two delay profiles: a shopping order lands within hours, an in-app payment
// often a day or more after the ad. Lognormal delay, in hours.
export const DELAY_PROFILES: Record<ConversionKind, { label: string; medianHours: number; sigma: number; seed: number }> = {
  order: { label: "下单（中位 1.5 小时）", medianHours: 1.5, sigma: 1.3, seed: 568 },
  pay: { label: "付费（中位 20 小时）", medianHours: 20, sigma: 1.0, seed: 2024 },
};

// The demo traffic: 400 impressions, 40 of which really convert (true CVR 10%).
export const DEMO_IMPRESSIONS = 400;
export const DEMO_CONVERTERS = 40;

// The join windows the slider steps through, in hours.
export const JOIN_WINDOWS = [0.5, 1, 2, 4, 6, 12, 24, 48, 72, 168] as const;

const MIN_DELAY = 0.1;
const MAX_DELAY = 300;

// Seeded lognormal conversion delays, sorted ascending, clamped to [0.1h, 300h].
export function drawDelays(seed: number, count: number, medianHours: number, sigma: number): number[] {
  const rng = createRng(seed);
  const mu = Math.log(medianHours);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const d = Math.exp(randomNormal(rng, mu, sigma));
    out.push(Math.min(MAX_DELAY, Math.max(MIN_DELAY, d)));
  }
  return out.sort((a, b) => a - b);
}

export function demoDelays(kind: ConversionKind): number[] {
  const p = DELAY_PROFILES[kind];
  return drawDelays(p.seed, DEMO_CONVERTERS, p.medianHours, p.sigma);
}

export type JoinResult = {
  impressions: number;
  trueConversions: number;
  /** Conversions that arrived inside the window: labelled 1. */
  labelled: number;
  /** Real conversions that arrived after the window: written as 0. */
  falseNegatives: number;
  trueCvr: number;
  measuredCvr: number;
  /** labelled / trueConversions. */
  capture: number;
};

// Join every impression with its conversion if the conversion arrives within W hours.
export function joinWithWindow(delays: readonly number[], impressions: number, windowHours: number): JoinResult {
  const labelled = delays.filter((d) => d <= windowHours).length;
  const trueConversions = delays.length;
  return {
    impressions,
    trueConversions,
    labelled,
    falseNegatives: trueConversions - labelled,
    trueCvr: impressions === 0 ? 0 : trueConversions / impressions,
    measuredCvr: impressions === 0 ? 0 : labelled / impressions,
    capture: trueConversions === 0 ? 0 : labelled / trueConversions,
  };
}

// Abramowitz–Stegun 7.1.26, absolute error below 1.5e-7.
export function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}

// Share of conversions that have arrived by `hours`, under the lognormal delay model.
export function lognormalCdf(hours: number, medianHours: number, sigma: number): number {
  if (hours <= 0) return 0;
  return 0.5 * (1 + erf((Math.log(hours) - Math.log(medianHours)) / (sigma * Math.SQRT2)));
}

// Delayed-feedback correction: divide the measured CVR by the share of conversions
// the historical delay distribution says should have arrived within the window.
export function correctedCvr(measuredCvr: number, captureExpected: number): number {
  return captureExpected <= 0 ? 0 : measuredCvr / captureExpected;
}

// Empirical CDF of the delays as [hours, share arrived] points, one per conversion.
export function empiricalCdf(delays: readonly number[]): [number, number][] {
  const sorted = [...delays].sort((a, b) => a - b);
  return sorted.map((d, i) => [d, (i + 1) / sorted.length]);
}

// Rows the join holds in keyed state: every impression waits W hours for its conversion.
export function stateRows(impressionsPerHour: number, windowHours: number): number {
  return impressionsPerHour * windowHours;
}

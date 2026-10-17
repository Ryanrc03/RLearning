// Deep Learning Blocks, page 3: which axis each normalisation averages over.
// Pure functions on a batch × feature matrix; see tests/norm.test.ts.

import { createRng, randomNormal } from "./random";

export type Matrix = number[][];

export type NormResult = {
  normalized: Matrix;
  /** One mean per column (BatchNorm) or per row (LayerNorm). */
  mean: number[];
  /** One population std per column (BatchNorm) or per row (LayerNorm). */
  std: number[];
};

// Mean and population standard deviation (divide by n, as BatchNorm does).
export function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

function normalize(values: number[], eps: number): { normalized: number[]; mean: number; std: number } {
  const { mean, std } = meanStd(values);
  const denom = Math.sqrt(std * std + eps);
  return { normalized: values.map((v) => (denom === 0 ? 0 : (v - mean) / denom)), mean, std };
}

// BatchNorm: every column (feature) is normalised across the rows (the batch).
export function batchNorm(matrix: Matrix, eps = 0): NormResult {
  const cols = matrix[0]?.length ?? 0;
  const perCol = Array.from({ length: cols }, (_, j) => normalize(matrix.map((row) => row[j]), eps));
  return {
    normalized: matrix.map((row, i) => row.map((_, j) => perCol[j].normalized[i])),
    mean: perCol.map((c) => c.mean),
    std: perCol.map((c) => c.std),
  };
}

// LayerNorm: every row (sample) is normalised across its own features.
export function layerNorm(matrix: Matrix, eps = 0): NormResult {
  const perRow = matrix.map((row) => normalize(row, eps));
  return {
    normalized: perRow.map((r) => r.normalized),
    mean: perRow.map((r) => r.mean),
    std: perRow.map((r) => r.std),
  };
}

// WeightNorm: w = g · v / ‖v‖, length and direction kept as separate parameters.
export function weightNorm(v: number[]): { g: number; unit: number[] } {
  const g = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (g === 0) throw new Error("cannot normalise a zero weight vector");
  return { g, unit: v.map((x) => x / g) };
}

export const DEMO_BATCH = 4;
export const DEMO_FEATURES = 5;

// Five features that live on very different scales, so the batch axis and the
// feature axis give visibly different μ and σ.
const FEATURE_MEAN = [0, 5, -2, 10, 1];
const FEATURE_SD = [1, 3, 0.5, 4, 2];

export function DEMO_ACTIVATIONS(seed: number): Matrix {
  const rng = createRng(seed);
  const round = (x: number) => Math.round(x * 10) / 10;
  return Array.from({ length: DEMO_BATCH }, () => Array.from({ length: DEMO_FEATURES }, (_, j) => round(randomNormal(rng, FEATURE_MEAN[j], FEATURE_SD[j]))));
}

export const DEMO_SEED = 11;

// A weight vector for the WeightNorm tab; ‖v‖ ≈ 3 so g and v/‖v‖ look different.
export const DEMO_WEIGHTS = [1.2, -2.0, 0.6, 1.5, -0.9];

// ---------------------------------------------------------------------------
// BatchNorm2d: the CNN case. A (batch, channel, H, W) tensor is normalised per
// channel, and each channel's μ and σ come from every pixel of that channel in
// every image of the batch (batch × H × W numbers). The shape never changes.

/** Indexed [batch][channel][row][col]. */
export type Tensor4 = number[][][][];
export type Shape4 = [number, number, number, number];

export type Norm2dResult = {
  normalized: Tensor4;
  /** One mean per channel, taken over batch × H × W. */
  mean: number[];
  /** One population std per channel, taken over batch × H × W. */
  std: number[];
  /** (batch, channel, H, W); identical for input and output. */
  shape: Shape4;
};

// The tensor must be rectangular: every image has the same channels, every channel the same H × W.
export function tensorShape(t: Tensor4): Shape4 {
  const n = t.length;
  const c = t[0]?.length ?? 0;
  const h = t[0]?.[0]?.length ?? 0;
  const w = t[0]?.[0]?.[0]?.length ?? 0;
  for (const img of t) {
    if (img.length !== c) throw new Error("images differ in channel count");
    for (const ch of img) {
      if (ch.length !== h) throw new Error("channels differ in height");
      for (const row of ch) if (row.length !== w) throw new Error("rows differ in width");
    }
  }
  return [n, c, h, w];
}

// Every value of one channel, in every image, every row, every column.
export function channelValues(t: Tensor4, channel: number): number[] {
  return t.flatMap((img) => img[channel].flat());
}

export function batchNorm2d(t: Tensor4, eps = 0): Norm2dResult {
  const shape = tensorShape(t);
  const [, c] = shape;
  const perChannel = Array.from({ length: c }, (_, k) => {
    const { mean, std } = meanStd(channelValues(t, k));
    return { mean, std, denom: Math.sqrt(std * std + eps) };
  });
  const normalized = t.map((img) => img.map((ch, k) => ch.map((row) => row.map((v) => (perChannel[k].denom === 0 ? 0 : (v - perChannel[k].mean) / perChannel[k].denom)))));
  return { normalized, mean: perChannel.map((p) => p.mean), std: perChannel.map((p) => p.std), shape };
}

export const DEMO_IMAGE_BATCH = 2;
export const DEMO_IMAGE_CHANNELS = 3;
export const DEMO_IMAGE_HW = 2;
export const DEMO_IMAGE_SEED = 7;

// Three channels on different scales (think R / G / B after a conv), so each
// channel visibly needs its own μ and σ.
const CHANNEL_MEAN = [0, 6, -3];
const CHANNEL_SD = [1, 2.5, 0.8];

// The (2, 3, 2, 2) example from the notes: 2 images, 3 channels, 2 × 2 pixels.
export function DEMO_IMAGES(seed: number): Tensor4 {
  const rng = createRng(seed);
  const round = (x: number) => Math.round(x * 10) / 10;
  return Array.from({ length: DEMO_IMAGE_BATCH }, () =>
    Array.from({ length: DEMO_IMAGE_CHANNELS }, (_, k) =>
      Array.from({ length: DEMO_IMAGE_HW }, () => Array.from({ length: DEMO_IMAGE_HW }, () => round(randomNormal(rng, CHANNEL_MEAN[k], CHANNEL_SD[k])))),
    ),
  );
}

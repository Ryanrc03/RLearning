// LLMs, page 1: a vanilla RNN small enough to multiply through by hand.
// h_t = tanh(W_hh h_{t−1} + W_xh x_t), y_t = softmax(W_hy h_t). No React here;
// see tests/rnn.test.ts.

import { softmax } from "./clip";
import { createRng } from "./random";

export type RnnParams = {
  /** Input projection, shape [hidden][input]: W_xh x_t. */
  wxh: number[][];
  /** Recurrent weights, shape [hidden][hidden]: W_hh h_{t−1}. */
  whh: number[][];
  /** Output projection, shape [classes][hidden]: W_hy h_t. */
  why: number[][];
};

export type RnnStep = {
  /** 1-based time index; step 0 is the all-zero h_0 before anything is read. */
  t: number;
  x: number[];
  hPrev: number[];
  /** W_xh x_t */
  xProj: number[];
  /** W_hh h_{t−1} */
  hProj: number[];
  /** xProj + hProj, before tanh. */
  pre: number[];
  /** tanh(pre) */
  h: number[];
  /** W_hy h_t */
  logits: number[];
  /** softmax(logits) */
  y: number[];
};

export function matVec(m: number[][], v: number[]): number[] {
  return m.map((row) => {
    if (row.length !== v.length) throw new Error(`matVec: row length ${row.length} ≠ vector length ${v.length}`);
    return row.reduce((sum, w, j) => sum + w * v[j], 0);
  });
}

// One recurrence: every intermediate is returned so the figure can print it.
export function rnnStep(params: RnnParams, hPrev: number[], x: number[], t = 1): RnnStep {
  const xProj = matVec(params.wxh, x);
  const hProj = matVec(params.whh, hPrev);
  const pre = xProj.map((v, i) => v + hProj[i]);
  const h = pre.map(Math.tanh);
  const logits = matVec(params.why, h);
  return { t, x, hPrev, xProj, hProj, pre, h, logits, y: softmax(logits) };
}

// Unrolled run from h_0 = 0; the history has one entry per input.
export function rnnRun(params: RnnParams, xs: number[][]): RnnStep[] {
  const hidden = params.whh.length;
  let h = Array.from({ length: hidden }, () => 0);
  const out: RnnStep[] = [];
  xs.forEach((x, i) => {
    const step = rnnStep(params, h, x, i + 1);
    out.push(step);
    h = step.h;
  });
  return out;
}

export type ShapeRow = {
  name: string;
  symbol: string;
  shape: [number, number, number];
  /** What each axis counts, in the order of `shape`. */
  axes: [string, string, string];
};

// The three tensors in the notes: input (batch, seq, input) → h (batch, seq, hidden) → output (batch, seq, hidden).
export function shapeTable(batch: number, seq: number, input: number, hidden: number, output = hidden): ShapeRow[] {
  return [
    { name: "输入", symbol: "x", shape: [batch, seq, input], axes: ["batch：几条序列", "seq_len：每条几步", "input_size：每步的向量长度"] },
    { name: "hidden state", symbol: "h", shape: [batch, seq, hidden], axes: ["batch", "seq_len：每一步各留一个 h_t", "hidden_size：h_t 的长度"] },
    { name: "输出", symbol: "y", shape: [batch, seq, output], axes: ["batch", "seq_len：每一步各出一个 y_t", "output_size：这里取 hidden_size"] },
  ];
}

export function demoInputs(seed: number, steps: number, inputSize: number): number[][] {
  const rng = createRng(seed);
  return Array.from({ length: steps }, () => Array.from({ length: inputSize }, () => Math.round((rng() * 2 - 1) * 10) / 10));
}

export const DEMO_RNN_SEED = 23;
export const DEMO_RNN_STEPS = 10;

// hidden 3, input 2, 3 output classes: small enough that every product fits in a panel.
export const DEMO_RNN: { params: RnnParams; inputs: number[][] } = {
  params: {
    wxh: [
      [0.8, -0.5],
      [0.3, 0.9],
      [-0.6, 0.4],
    ],
    whh: [
      [0.5, -0.3, 0.2],
      [0.1, 0.6, -0.4],
      [-0.2, 0.3, 0.5],
    ],
    why: [
      [1.2, -0.8, 0.4],
      [-0.5, 1.0, 0.6],
      [0.3, 0.2, -1.1],
    ],
  },
  inputs: demoInputs(DEMO_RNN_SEED, DEMO_RNN_STEPS, 2),
};

// LLMs, "Attention (IV)": assembling the original Transformer encoder–decoder
// from multi-head attention. Shapes follow the lecture's column convention:
// one token per column, so a sequence of n tokens of width d is d × n.
// No React here; see tests/transformer-arch.test.ts.

import { softmax } from "./clip";
import { sinusoidalPositions } from "./transformer";

export type Shape = [rows: number, cols: number];
export const shapeText = (s: Shape) => `${s[0]} × ${s[1]}`;

export type ArchConfig = {
  /** Source tokens. */
  m: number;
  /** Target-prefix tokens fed to the decoder. */
  t: number;
  dModel: number;
  heads: number;
  dFf: number;
  layers: number;
};

/** The running example: Transformer base sizes with a 4-token source and a 3-token target prefix. */
export const BASE: ArchConfig = { m: 4, t: 3, dModel: 512, heads: 8, dFf: 2048, layers: 6 };

/** Per-head width when d_model is split evenly: d_k = d_v = d_model / heads. */
export function headDim(dModel: number, heads: number): number {
  if (dModel % heads !== 0) throw new Error(`d_model ${dModel} is not divisible by ${heads} heads`);
  return dModel / heads;
}

export type MultiHeadShapes = { dHead: number; perHead: Shape; concat: Shape; out: Shape };

/** One head gives d_head × n; concatenating along the feature axis gives (heads · d_head) × n; W_O maps back to d_model × n. */
export function multiHeadShapes(dModel: number, heads: number, n: number): MultiHeadShapes {
  const dHead = headDim(dModel, heads);
  return { dHead, perHead: [dHead, n], concat: [heads * dHead, n], out: [dModel, n] };
}

/** softmax(scores / c): the divisor experiment. c = √d_k is the paper's choice. */
export function scaledWeights(scores: number[], divisor: number): number[] {
  if (!(divisor > 0)) throw new Error("divisor must be positive");
  return softmax(scores.map((s) => s / divisor));
}

/** The fixed scores of the divisor experiment and the divisors the note tabulates. */
export const DIVISOR_SCORES = [8, 0];
export const DIVISOR_PRESETS = [1, 4, 8, 16, 100];

/** Variance of qᵀk when the 2·d_k components are independent with mean 0 and variance 1: exactly d_k. */
export function dotProductVariance(dK: number): number {
  return dK;
}

/** PE(pos, 2i) = sin(pos / 10000^(2i/d)), PE(pos, 2i+1) = cos(same angle). Rows are positions. */
export function positionalEncoding(positions: number, dModel: number): number[][] {
  return sinusoidalPositions(positions, dModel);
}

/** Decoder self-attention: query j may read key i only when i ≤ j. allowed[query][key]. */
export function causalAllowed(t: number): boolean[][] {
  return Array.from({ length: t }, (_, q) => Array.from({ length: t }, (_, k) => k <= q));
}

/** Softmax over the allowed keys only; masked keys get weight exactly 0 (their score is −∞). */
export function maskedWeights(scores: number[], allowed: boolean[]): number[] {
  return softmax(scores.map((s, i) => (allowed[i] ? s : -Infinity)));
}

export type AttentionStage = "encSelf" | "decSelf" | "decCross";

export type StageShapes = {
  stage: AttentionStage;
  /** Where the queries and the keys / values come from. */
  querySource: string;
  keySource: string;
  nQuery: number;
  nKey: number;
  q: Shape;
  k: Shape;
  v: Shape;
  /** Column convention KᵀQ: keys down the rows, queries across the columns. */
  scores: Shape;
  /** Row convention QKᵀ used by PyTorch-style code: the transpose. */
  scoresRowConvention: Shape;
  headOut: Shape;
  concat: Shape;
  out: Shape;
  causal: boolean;
};

/** Every shape inside one multi-head attention sub-layer, derived from the config. */
export function stageShapes(stage: AttentionStage, c: ArchConfig = BASE): StageShapes {
  const d = headDim(c.dModel, c.heads);
  const nQuery = stage === "encSelf" ? c.m : c.t;
  const nKey = stage === "decSelf" ? c.t : c.m;
  return {
    stage,
    querySource: stage === "encSelf" ? "Encoder 表示" : "Decoder 表示 D",
    keySource: stage === "encSelf" ? "Encoder 表示" : stage === "decSelf" ? "Decoder 表示 D" : "Encoder 输出 U",
    nQuery,
    nKey,
    q: [d, nQuery],
    k: [d, nKey],
    v: [d, nKey],
    scores: [nKey, nQuery],
    scoresRowConvention: [nQuery, nKey],
    headOut: [d, nQuery],
    concat: [c.heads * d, nQuery],
    out: [c.dModel, nQuery],
    causal: stage === "decSelf",
  };
}

export type DryRunRow = { stage: string; shape: string; why: string };

/** The end-to-end shape table of the note; `vocab` stays symbolic. */
export function dryRun(c: ArchConfig = BASE): DryRunRow[] {
  const enc = stageShapes("encSelf", c);
  const self = stageShapes("decSelf", c);
  const cross = stageShapes("decCross", c);
  const src: Shape = [c.dModel, c.m];
  const tgt: Shape = [c.dModel, c.t];
  return [
    { stage: "Source Embedding + Position", shape: shapeText(src), why: `${c.m} 个输入位置` },
    { stage: "Encoder 单 Head 的 Q / K / V", shape: `各 ${shapeText(enc.q)}`, why: `${c.dModel} 维投影到每头 ${enc.q[0]} 维` },
    { stage: "Encoder 单 Head 的 Score", shape: shapeText(enc.scores), why: `${enc.nKey} 个 Key × ${enc.nQuery} 个 Query` },
    { stage: `Encoder ${c.heads} Head Concat`, shape: shapeText(enc.concat), why: `${c.heads} × ${enc.q[0]} = ${enc.concat[0]}` },
    { stage: "Encoder Block 1（含 FFN）", shape: shapeText(src), why: "token 数和主干维度都不变" },
    { stage: `Encoder Block × ${c.layers} 的输出 U`, shape: shapeText(src), why: "提供给 Decoder 的 source memory" },
    { stage: "Decoder Embedding + Position", shape: shapeText(tgt), why: `${c.t} 个 target 前缀位置` },
    { stage: "Decoder Masked Self-Attn 单 Head 的 Score", shape: shapeText(self.scores), why: "目标序列内部，带因果 mask" },
    { stage: "Decoder Cross-Attn 单 Head 的 Q", shape: shapeText(cross.q), why: "Query 来自 Decoder" },
    { stage: "Decoder Cross-Attn 单 Head 的 K、V", shape: `各 ${shapeText(cross.k)}`, why: "Key / Value 来自 Encoder 输出 U" },
    { stage: "Decoder Cross-Attn 单 Head 的 Score", shape: shapeText(cross.scores), why: `${cross.nKey} 个 source Key × ${cross.nQuery} 个 target Query` },
    { stage: "Decoder Cross-Attn 合并输出", shape: shapeText(cross.out), why: `输出 token 数跟 Query，是 ${cross.nQuery}` },
    { stage: `Decoder Block × ${c.layers} 的输出`, shape: shapeText(tgt), why: "每一块都保持目标长度" },
    { stage: "Vocabulary Logits", shape: `|Vocab| × ${c.t}`, why: "每个目标位置一列词表分数" },
  ];
}

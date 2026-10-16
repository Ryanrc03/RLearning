// LLMs, page 5: one Transformer decoder layer. The shape on every edge of the
// block diagram, sinusoidal and learned positional encodings, LayerNorm on one
// token vector, and the d_model = 4 toy walk-through the side panel prints.
// Pure functions, no React; see tests/transformer.test.ts.

import { softmax } from "@/lib/ml/clip";
import { buildCausalMask } from "@/lib/ml/attention";
import { createRng } from "@/lib/ml/random";

export type Shape = number[];

// Every edge and sub-tensor of one layer, with the symbolic and the concrete shape.
export type EdgeShape = { key: string; label: string; symbolic: string; shape: Shape };

export type BlockShapes = {
  B: number;
  T: number;
  dModel: number;
  h: number;
  dK: number;
  dFf: number;
  edges: EdgeShape[];
};

const fmt = (s: Shape) => `(${s.join(", ")})`;

/** Shapes along one decoder layer: tokens in → embedding → attention → LN → MLP → LN → out. */
export function blockShapes(B: number, T: number, dModel: number, h: number, dFf: number): BlockShapes {
  if (dModel % h !== 0) throw new Error("d_model must be divisible by h");
  const dK = dModel / h;
  const edges: EdgeShape[] = [
    { key: "tokens", label: "token id", symbolic: "(B, T)", shape: [B, T] },
    { key: "embed", label: "embedding + position", symbolic: "(B, T, d_model)", shape: [B, T, dModel] },
    { key: "qkv", label: "每个 head 的 Q / K / V", symbolic: "(B, h, T, d_k)", shape: [B, h, T, dK] },
    { key: "weights", label: "attention 权重", symbolic: "(B, h, T, T)", shape: [B, h, T, T] },
    { key: "attn", label: "attention 输出（拼回）", symbolic: "(B, T, d_model)", shape: [B, T, dModel] },
    { key: "ln1", label: "add & LayerNorm", symbolic: "(B, T, d_model)", shape: [B, T, dModel] },
    { key: "hidden", label: "MLP 隐层", symbolic: "(B, T, d_ff)", shape: [B, T, dFf] },
    { key: "mlp", label: "MLP 输出", symbolic: "(B, T, d_model)", shape: [B, T, dModel] },
    { key: "ln2", label: "add & LayerNorm", symbolic: "(B, T, d_model)", shape: [B, T, dModel] },
    { key: "out", label: "送往下一层", symbolic: "(B, T, d_model)", shape: [B, T, dModel] },
  ];
  return { B, T, dModel, h, dK, dFf, edges };
}

export function shapeText(s: Shape): string {
  return fmt(s);
}

// ---------------------------------------------------------------------------
// Positional encodings.

/** Sinusoidal table PE[pos][2i] = sin(pos / 10000^(2i/d)), PE[pos][2i+1] = cos(…); T rows, d columns. */
export function sinusoidalPositions(T: number, d: number, base = 10000): number[][] {
  if (d % 2 !== 0) throw new Error("d must be even");
  return Array.from({ length: T }, (_, pos) =>
    Array.from({ length: d }, (_, j) => {
      const i = Math.floor(j / 2);
      const angle = pos / Math.pow(base, (2 * i) / d);
      return j % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
    }),
  );
}

/** Frequency (1 / wavelength scale) of column pair i: 1 / base^(2i/d). */
export function sinusoidalFrequency(i: number, d: number, base = 10000): number {
  return 1 / Math.pow(base, (2 * i) / d);
}

/** A learned position table as it looks before training: a (T, d) parameter matrix initialised N(0, 0.3²) with a fixed seed. */
export function learnedPositionsInit(T: number, d: number, seed = 5, sd = 0.3): number[][] {
  const rng = createRng(seed);
  // Box–Muller inline so the table does not depend on randomNormal's call order.
  const normal = () => {
    let u = 0;
    while (u === 0) u = rng();
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
  };
  return Array.from({ length: T }, () => Array.from({ length: d }, () => Math.round(normal() * 100) / 100));
}

// ---------------------------------------------------------------------------
// LayerNorm on one token.

export type LayerNormResult = { out: number[]; mu: number; sigma: number };

/** LN(h) = (h − μ) / sqrt(σ² + eps) · γ + β over the d numbers of one token; γ = 1, β = 0 by default. */
export function layerNormVec(v: number[], eps = 0, gamma?: number[], beta?: number[]): LayerNormResult {
  if (v.length === 0) throw new Error("empty vector");
  const mu = v.reduce((s, x) => s + x, 0) / v.length;
  const variance = v.reduce((s, x) => s + (x - mu) ** 2, 0) / v.length;
  const sigma = Math.sqrt(variance);
  const denom = Math.sqrt(variance + eps);
  const out = v.map((x, j) => {
    const hat = denom === 0 ? 0 : (x - mu) / denom;
    return hat * (gamma ? gamma[j] : 1) + (beta ? beta[j] : 0);
  });
  return { out, mu, sigma };
}

// ---------------------------------------------------------------------------
// The toy walk-through: d_model = 4, a three-token context, our token is the last one.

export const DEMO_D_MODEL = 4;
export const DEMO_D_FF = 8;
/** 0-based position of the token we follow; the two tokens before it are its context. */
export const DEMO_POS = 2;

/** Input embeddings of the three tokens 「我」「想」「吃」; the last row is the token the panel follows. */
export const DEMO_CONTEXT: number[][] = [
  [0.6, -0.2, 0.9, 0.1],
  [-0.5, 0.8, 0.3, -0.4],
  [1.2, -0.4, 0.8, 0.3],
];

export const DEMO_TOKEN_VEC: number[] = DEMO_CONTEXT[DEMO_POS];

/** Toy MLP: W1 is (d_ff × d_model), W2 is (d_model × d_ff); hand-picked small weights, biases 0. */
export const DEMO_W1: number[][] = [
  [0.5, -0.3, 0.2, 0.1],
  [-0.4, 0.6, 0.1, 0.3],
  [0.2, 0.2, -0.5, 0.4],
  [0.1, -0.6, 0.3, -0.2],
  [-0.3, 0.1, 0.4, 0.5],
  [0.6, 0.3, -0.2, -0.1],
  [-0.2, -0.4, 0.6, 0.2],
  [0.3, 0.5, 0.1, -0.5],
];

export const DEMO_W2: number[][] = [
  [0.3, -0.2, 0.4, 0.1, -0.3, 0.2, 0.1, -0.4],
  [-0.1, 0.5, 0.2, -0.3, 0.1, -0.2, 0.4, 0.3],
  [0.4, 0.1, -0.3, 0.2, 0.5, -0.1, -0.2, 0.1],
  [-0.2, 0.3, 0.1, 0.4, -0.1, 0.3, -0.5, 0.2],
];

export type BlockDemo = {
  /** Input embedding of the followed token. */
  e: number[];
  /** Its position vector, from whichever table was passed in. */
  pe: number[];
  /** e + pe, the layer's input. */
  x0: number[];
  /** Scores of the followed token against the context (after the causal mask, −∞ for the future). */
  scores: number[];
  /** softmax(scores / sqrt(d)) over the context. */
  attn: number[];
  /** What attention brings back: Σ_j attn_j · V_j with V = context (W_V = I). */
  delta: number[];
  /** x0 + delta. */
  x1: number[];
  ln1: LayerNormResult;
  /** ReLU(W1 · ln1.out), the d_ff hidden activations. */
  hidden: number[];
  /** W2 · hidden. */
  mlp: number[];
  /** ln1.out + mlp. */
  x2: number[];
  ln2: LayerNormResult;
};

function matVec(W: number[][], v: number[]): number[] {
  return W.map((row) => row.reduce((s, w, j) => s + w * v[j], 0));
}

/**
 * One token through one layer with W_Q = W_K = W_V = W_O = I (single head), so
 * every number comes from the context vectors and the two MLP matrices.
 * `positions` is the positional table to add (sinusoidal or learned); its row
 * `DEMO_POS` is used for the followed token and rows < DEMO_POS for the context.
 */
export function applyBlockDemo(positions: number[][], context: number[][] = DEMO_CONTEXT, pos = DEMO_POS, eps = 1e-5): BlockDemo {
  const d = context[0].length;
  const withPos = context.map((row, t) => row.map((x, j) => x + positions[t][j]));
  const e = context[pos];
  const pe = positions[pos];
  const x0 = withPos[pos];
  const mask = buildCausalMask(context.length)[pos];
  const scores = withPos.map((k, j) => (mask[j] === 0 ? k.reduce((s, kj, i) => s + kj * x0[i], 0) / Math.sqrt(d) : -Infinity));
  const attn = softmax(scores);
  const delta = Array.from({ length: d }, (_, i) => withPos.reduce((s, v, j) => s + attn[j] * v[i], 0));
  const x1 = x0.map((x, i) => x + delta[i]);
  const ln1 = layerNormVec(x1, eps);
  const hidden = matVec(DEMO_W1, ln1.out).map((a) => Math.max(0, a));
  const mlp = matVec(DEMO_W2, hidden);
  const x2 = ln1.out.map((x, i) => x + mlp[i]);
  const ln2 = layerNormVec(x2, eps);
  return { e, pe, x0, scores, attn, delta, x1, ln1, hidden, mlp, x2, ln2 };
}

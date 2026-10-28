// Measured numbers from the kernel-level optimisation of GRPO on an RTX 3060 12 GB
// (Chasing-the-Aha-Moment, branch claude/gpu-kernels, docs/kernels/*.md, 2026-10-27).
// No React here; components in components/visualization/gpu/grpo/ read these. See tests/grpo-kernels.test.ts.

/** RTX 3060 (GA106) ceilings. GeForce Ampere halves the tensor-core rate with fp32 accumulate. */
export const RTX3060 = {
  bandwidthGBs: 360,
  tflopsFp32Acc: 25.6,
  tflopsFp16Acc: 51.2,
  tflopsCudaCoreFp32: 12.7,
} as const;

export type KernelCategory = { label: string; ms: number; note?: string; artefact?: boolean };

/**
 * Kernel time of the two halves of one GRPO step (torch.profiler / vLLM profiler).
 * Training half: one fwd+bwd of 6 x 600 tokens. Decode half: per decode step, 6 sequences.
 */
type HalfProfile = { title: string; unit: string; total: number; cats: KernelCategory[] };

export const STEP_PROFILE: Record<"train" | "decode", HalfProfile> = {
  train: {
    title: "训练半步（6 条 × 600 token 的前向 + 反向）",
    unit: "ms",
    total: 5330,
    cats: [
      { label: "GEMM", ms: 3717, note: "cuBLAS bf16，已贴近 fp32 累加上限" },
      { label: "memcpy / fill", ms: 573, note: "大头是 profile 脚本自己的 fp32 logits", artefact: true },
      { label: "逐元素", ms: 401 },
      { label: "softmax", ms: 291, note: "同上，profile 脚本的朴素 log_softmax", artefact: true },
      { label: "attention", ms: 150 },
      { label: "其它", ms: 198 },
    ],
  },
  decode: {
    title: "采样半步（vLLM，每个 decode step，6 条序列）",
    unit: "ms",
    total: 29.6,
    cats: [
      { label: "bnb 4-bit GEMM", ms: 21.96, note: "252 次 launch，只用到 12%–22% 带宽" },
      { label: "bf16 GEMM", ms: 3.2, note: "lm_head、LoRA" },
      { label: "memcpy", ms: 1.42 },
      { label: "逐元素", ms: 0.89 },
      { label: "attention", ms: 0.83 },
      { label: "其它", ms: 1.3 },
    ],
  },
};

export type LayerKey = "q" | "kv" | "gate_up" | "down";

export const LAYERS: Record<LayerKey, { label: string; N: number; K: number; perLayer: number }> = {
  q: { label: "q / o_proj", N: 2048, K: 2048, perLayer: 2 },
  kv: { label: "k / v_proj", N: 256, K: 2048, perLayer: 2 },
  gate_up: { label: "gate / up_proj", N: 11008, K: 2048, perLayer: 1 },
  down: { label: "down_proj", N: 2048, K: 11008, perLayer: 1 },
};

/** Batch rows (decode sequences in flight) the micro-benchmark measured. */
export const MS = [6, 8, 16, 24, 32] as const;
export type MRows = (typeof MS)[number];

/**
 * Median ms per call, CUDA events behind an L2 flush. null = not measured cleanly
 * (the GPU was shared with another process during that row of the final run).
 */
export const GEMM_MS: Record<LayerKey, { bnb: (number | null)[]; triton: (number | null)[] }> = {
  q: { bnb: [0.0532, 0.0532, 0.0543, null, null], triton: [0.044, 0.044, 0.0491, null, null] },
  kv: { bnb: [0.0165, 0.0205, 0.0225, 0.0307, 0.0307], triton: [0.0215, 0.0225, 0.0255, 0.0329, 0.0369] },
  gate_up: { bnb: [0.1526, 0.1526, 0.1536, 0.1556, 0.1577], triton: [0.1444, 0.1445, 0.1577, 0.3052, 0.3748] },
  down: { bnb: [0.2601, 0.2601, 0.2621, 0.2652, 0.2693], triton: [0.1638, 0.1649, 0.1741, 0.3318, 0.3942] },
};

/** Routing rule shipped in aha.kernels.nf4_gemm: Triton only when M <= 16 and N >= 1024. */
export const ROUTE = { maxM: 16, minN: 1024 } as const;

export function routesToTriton(layer: LayerKey, m: number): boolean {
  return m <= ROUTE.maxM && LAYERS[layer].N >= ROUTE.minN;
}

export function gemmMs(layer: LayerKey, m: MRows, impl: "bnb" | "triton"): number | null {
  return GEMM_MS[layer][impl][MS.indexOf(m)];
}

/** Bytes streamed per call: packed nibbles + fp16 absmax per 64 weights (activations ignored). */
export function nf4Bytes(layer: LayerKey): number {
  const { N, K } = LAYERS[layer];
  return (N * K) / 2 + ((N * K) / 64) * 2;
}

/** Achieved share of the 360 GB/s bandwidth for one call. */
export function bandwidthShare(layer: LayerKey, ms: number): number {
  return nf4Bytes(layer) / (ms / 1e3) / 1e9 / RTX3060.bandwidthGBs;
}

/** 4-bit GEMM time of one decoder layer (q, k, v, o, gate_up, down) under a policy, or null if a row is missing. */
export function layerMs(m: MRows, policy: "bnb" | "triton" | "routed"): number | null {
  let sum = 0;
  for (const key of Object.keys(LAYERS) as LayerKey[]) {
    const impl = policy === "routed" ? (routesToTriton(key, m) ? "triton" : "bnb") : policy;
    const v = gemmMs(key, m, impl);
    if (v === null) return null;
    sum += v * LAYERS[key].perLayer;
  }
  return sum;
}

/**
 * Codebook lookup variants for gate_up (N=11008, K=2048, M=6), each timed relative to bitsandbytes'
 * fused kernel in the same run (absolute times drifted between runs because the GPU was shared).
 */
export const DEQUANT_VARIANTS = [
  { id: "fp32gather", label: "两次 fp32 gather", rel: 1.5, note: "每个 nibble 从 16 项码表各读一次 fp32" },
  { id: "where", label: "15 路 where 选择树", rel: 1.06, note: "不访存，用比较和选择拼出码表值" },
  { id: "int32gather", label: "一次 int32 gather", rel: 0.97, note: "256 项表，一次取出两个 bf16" },
  { id: "prmt", label: "PTX prmt 置换树", rel: 0.95, note: "码表放寄存器，7 条 prmt 解一个字节" },
  { id: "nolookup", label: "不查表（结果错误，只计时）", rel: 0.34, note: "去掉查表后的上限：约 40% 带宽" },
] as const;

/** End-to-end vLLM decode, 256 steps, median of 3 (Qwen2.5-3B-Instruct bnb-4bit). */
export const DECODE = [
  { seqs: 6, bnbMs: 29.8, tritonMs: 24.8 },
  { seqs: 24, bnbMs: 61.4, tritonMs: 53.5 },
] as const;

/** Paired GSM8K test (1,319), fixed-run LoRA, temperature 0.2, same seed. */
export const ACCURACY = {
  n: 1319,
  bnb: 0.7733,
  triton: 0.7642,
  bnbOnly: 50,
  tritonOnly: 38,
  mcnemarP: 0.24,
  bnbWallS: 1970,
  tritonWallS: 1878,
} as const;

/** Training-shaped GEMM, M = 2400, TFLOPS. */
export const ACCUMULATE = [
  { shape: "q / o_proj", K: 2048, N: 2048, cublas: 22.2, tritonFp32: 9.2, tritonFp16: 34.1 },
  { shape: "gate / up_proj", K: 2048, N: 11008, cublas: 24.7, tritonFp32: 8.9, tritonFp16: 32.0 },
  { shape: "down_proj", K: 11008, N: 2048, cublas: 26.0, tritonFp32: 8.5, tritonFp16: 25.9 },
] as const;

export const ACCUMULATE_ERR = { cublas: 0.0004, tritonFp16: 0.0005 } as const;

/** Exact two-sided McNemar p-value from the discordant counts. */
export function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.min(b, c);
  let tail = 0;
  let coef = 1; // C(n, 0)
  for (let i = 0; i <= k; i++) {
    tail += coef;
    coef = (coef * (n - i)) / (i + 1);
  }
  return Math.min(1, (2 * tail) / 2 ** n);
}

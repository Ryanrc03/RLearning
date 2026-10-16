// Deep Learning Blocks, page 4: the shapes and costs of conv layers, of an
// Inception block (branches joined by torch.cat along the channel axis) and of
// a residual block (x + f(x), shapes must match). Pure functions; every number
// the Inception figure shows comes from here. See tests/cnn.test.ts.

/** A feature map without its batch axis: (C, H, W). */
export type Shape3 = { c: number; h: number; w: number };

export const fmtShape = (s: Shape3) => `(${s.c}, ${s.h}, ${s.w})`;

// Stride-1 convolution. "same" padding (⌊k/2⌋) keeps H and W; pad 0 shrinks them by k − 1.
export function convOutShape(c: number, h: number, w: number, kernel: number, outC: number, pad = Math.floor(kernel / 2)): Shape3 {
  if (c <= 0 || outC <= 0 || kernel <= 0) throw new Error("channels and kernel must be positive");
  const oh = h + 2 * pad - kernel + 1;
  const ow = w + 2 * pad - kernel + 1;
  if (oh <= 0 || ow <= 0) throw new Error(`kernel ${kernel} with pad ${pad} does not fit a ${h} × ${w} map`);
  return { c: outC, h: oh, w: ow };
}

// Weights inC · outC · k · k plus one bias per output channel.
export function convParams(inC: number, outC: number, kernel: number): number {
  return inC * outC * kernel * kernel + outC;
}

// Multiply–accumulates for one forward pass: every output pixel of every output
// channel sums over inC · k · k inputs.
export function convMacs(inC: number, outC: number, kernel: number, h: number, w: number): number {
  return outC * h * w * inC * kernel * kernel;
}

// torch.cat(..., dim=1): channels add up, H and W must already agree.
export function concatChannels(shapes: readonly Shape3[]): Shape3 {
  if (shapes.length === 0) throw new Error("nothing to concatenate");
  const { h, w } = shapes[0];
  for (const s of shapes) {
    if (s.h !== h || s.w !== w) throw new Error(`cannot concat ${fmtShape(s)} with a ${h} × ${w} map: H and W must match`);
  }
  return { c: shapes.reduce((sum, s) => sum + s.c, 0), h, w };
}

// y = x + f(x): elementwise, so the two shapes must be identical and the result keeps it.
export function residualAdd(x: Shape3, fx: Shape3): Shape3 {
  if (x.c !== fx.c || x.h !== fx.h || x.w !== fx.w) throw new Error(`x + f(x) needs equal shapes, got ${fmtShape(x)} and ${fmtShape(fx)}`);
  return { ...x };
}

// Every branch keeps H and W, so the block's output is (Σ c_i, H, W).
export function inceptionOutShape(input: Shape3, branchChannels: readonly number[]): Shape3 {
  return concatChannels(branchChannels.map((c) => ({ c, h: input.h, w: input.w })));
}

// ---- a branch as a short list of stages ----

export type Stage = { kind: "conv"; kernel: number; outC: number } | { kind: "pool"; kernel: number };
export type BranchSpec = { key: string; label: string; stages: Stage[] };

export type StageCost = { label: string; inC: number; outC: number; kernel: number; params: number; macs: number };
export type BranchCost = { key: string; label: string; outShape: Shape3; params: number; macs: number; stages: StageCost[] };

// Walk a branch's stages through an input map. Convs use "same" padding; a pool
// keeps the shape and costs no parameters (its MACs are ignored here).
export function branchCost(input: Shape3, branch: BranchSpec): BranchCost {
  let shape = { ...input };
  const stages: StageCost[] = [];
  for (const st of branch.stages) {
    if (st.kind === "pool") {
      stages.push({ label: `${st.kernel}×${st.kernel} pool`, inC: shape.c, outC: shape.c, kernel: st.kernel, params: 0, macs: 0 });
      continue;
    }
    const next = convOutShape(shape.c, shape.h, shape.w, st.kernel, st.outC);
    stages.push({
      label: `${st.kernel}×${st.kernel} conv`,
      inC: shape.c,
      outC: st.outC,
      kernel: st.kernel,
      params: convParams(shape.c, st.outC, st.kernel),
      macs: convMacs(shape.c, st.outC, st.kernel, next.h, next.w),
    });
    shape = next;
  }
  return {
    key: branch.key,
    label: branch.label,
    outShape: shape,
    params: stages.reduce((s, x) => s + x.params, 0),
    macs: stages.reduce((s, x) => s + x.macs, 0),
    stages,
  };
}

// ---- Inception block ----

export type InceptionConfig = {
  /** 1×1 conv output channels. */
  b1: number;
  /** 1×1 reduce then 3×3 conv. */
  b2: { reduce: number; out: number };
  /** 1×1 reduce then 5×5 conv. */
  b3: { reduce: number; out: number };
  /** 3×3 max-pool then 1×1 conv output channels. */
  b4: number;
};

export function inceptionBranches(cfg: InceptionConfig): BranchSpec[] {
  return [
    { key: "b1", label: "1×1 conv", stages: [{ kind: "conv", kernel: 1, outC: cfg.b1 }] },
    { key: "b2", label: "1×1 → 3×3 conv", stages: [{ kind: "conv", kernel: 1, outC: cfg.b2.reduce }, { kind: "conv", kernel: 3, outC: cfg.b2.out }] },
    { key: "b3", label: "1×1 → 5×5 conv", stages: [{ kind: "conv", kernel: 1, outC: cfg.b3.reduce }, { kind: "conv", kernel: 5, outC: cfg.b3.out }] },
    { key: "b4", label: "3×3 pool → 1×1 conv", stages: [{ kind: "pool", kernel: 3 }, { kind: "conv", kernel: 1, outC: cfg.b4 }] },
  ];
}

export type BlockCost = { branches: BranchCost[]; out: Shape3; params: number; macs: number };

// forward: y_i = b_i(x) for the four branches, then torch.cat([y1, y2, y3, y4], 1).
export function inceptionBlock(input: Shape3, cfg: InceptionConfig): BlockCost {
  const branches = inceptionBranches(cfg).map((b) => branchCost(input, b));
  const out = concatChannels(branches.map((b) => b.outShape));
  return { branches, out, params: branches.reduce((s, b) => s + b.params, 0), macs: branches.reduce((s, b) => s + b.macs, 0) };
}

// ---- residual block, for contrast ----

// f(x) = two 3×3 convs, C → mid → C; forward returns relu(f(x) + x), so f must
// end back on C channels and the output shape is the input shape whatever mid is.
export function residualBlock(input: Shape3, mid: number): BlockCost {
  const f = branchCost(input, { key: "f", label: "f(x)：3×3 conv → 3×3 conv", stages: [{ kind: "conv", kernel: 3, outC: mid }, { kind: "conv", kernel: 3, outC: input.c }] });
  const out = residualAdd(input, f.outShape);
  return { branches: [f], out, params: f.params, macs: f.macs };
}

// GoogLeNet's inception (3a): a 192 × 28 × 28 input, branches 64 / 96→128 /
// 16→32 / pool→32, output 256 × 28 × 28 with about 164 k parameters.
export const DEMO_INCEPTION: { input: Shape3; cfg: InceptionConfig } = {
  input: { c: 192, h: 28, w: 28 },
  cfg: { b1: 64, b2: { reduce: 96, out: 128 }, b3: { reduce: 16, out: 32 }, b4: 32 },
};

// The figure's slider moves the 3×3 branch's channel count through this range.
export const B2_RANGE = { min: 8, max: 128, step: 8 } as const;

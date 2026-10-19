// CLIP's architecture as numbers: tensor shapes through each tower and the
// parameter count of every module, for the OpenAI CLIP ViT variants. The
// module names (ln_1, attn.in_proj, attn.out_proj, mlp.c_fc, mlp.c_proj, …)
// follow the official / OpenCLIP code so they line up with LoRA target names.
// No React here; see tests/clip-architecture.test.ts.

export type ClipVariant = "ViT-B/32" | "ViT-B/16" | "ViT-L/14";

export type ClipConfig = {
  imageSize: number;
  patch: number;
  visionWidth: number;
  visionLayers: number;
  visionHeads: number;
  textWidth: number;
  textLayers: number;
  textHeads: number;
  embed: number;
  vocab: number;
  context: number;
};

export const CLIP_CONFIGS: Record<ClipVariant, ClipConfig> = {
  "ViT-B/32": { imageSize: 224, patch: 32, visionWidth: 768, visionLayers: 12, visionHeads: 12, textWidth: 512, textLayers: 12, textHeads: 8, embed: 512, vocab: 49_408, context: 77 },
  "ViT-B/16": { imageSize: 224, patch: 16, visionWidth: 768, visionLayers: 12, visionHeads: 12, textWidth: 512, textLayers: 12, textHeads: 8, embed: 512, vocab: 49_408, context: 77 },
  "ViT-L/14": { imageSize: 224, patch: 14, visionWidth: 1024, visionLayers: 24, visionHeads: 16, textWidth: 768, textLayers: 12, textHeads: 12, embed: 768, vocab: 49_408, context: 77 },
};

export function gridSize(c: ClipConfig): number {
  return c.imageSize / c.patch;
}

/** Image tokens: one per patch plus the [CLS] token. */
export function imageTokens(c: ClipConfig): number {
  return gridSize(c) ** 2 + 1;
}

const linear = (inDim: number, outDim: number, bias = true) => inDim * outDim + (bias ? outDim : 0);
const layerNorm = (d: number) => 2 * d;

export type BlockParams = { ln_1: number; in_proj: number; out_proj: number; ln_2: number; c_fc: number; c_proj: number; total: number };

/** One pre-LN residual block: x + attn(ln_1(x)), then x + mlp(ln_2(x)), MLP width 4d. */
export function blockParams(d: number): BlockParams {
  const p = {
    ln_1: layerNorm(d),
    in_proj: linear(d, 3 * d),
    out_proj: linear(d, d),
    ln_2: layerNorm(d),
    c_fc: linear(d, 4 * d),
    c_proj: linear(4 * d, d),
  };
  return { ...p, total: p.ln_1 + p.in_proj + p.out_proj + p.ln_2 + p.c_fc + p.c_proj };
}

export type TowerParams = { embed: number; blocks: number; head: number; total: number };

export function visionParams(c: ClipConfig): TowerParams {
  const d = c.visionWidth;
  // conv1 has no bias; class_embedding; positional_embedding; ln_pre.
  const embed = 3 * c.patch * c.patch * d + d + imageTokens(c) * d + layerNorm(d);
  const blocks = c.visionLayers * blockParams(d).total;
  const head = layerNorm(d) + d * c.embed; // ln_post + proj (no bias)
  return { embed, blocks, head, total: embed + blocks + head };
}

export function textParams(c: ClipConfig): TowerParams {
  const d = c.textWidth;
  const embed = c.vocab * d + c.context * d; // token + positional embedding
  const blocks = c.textLayers * blockParams(d).total;
  const head = layerNorm(d) + d * c.embed; // ln_final + text_projection (no bias)
  return { embed, blocks, head, total: embed + blocks + head };
}

/** Both towers plus the learnable logit_scale. */
export function clipParams(c: ClipConfig): number {
  return visionParams(c).total + textParams(c).total + 1;
}

/** logit_scale is stored as log(1/τ), initialised to log(1/0.07) and clamped so that 1/τ ≤ 100. */
export function logitScale(raw: number): number {
  return Math.min(Math.exp(raw), 100);
}

// The example caption used by the figure. Real CLIP BPE ids are not shown;
// what matters is the layout: [SOS] … [EOS], padded to 77, feature read at [EOS].
export const CLIP_EXAMPLE_TOKENS = ["[SOS]", "a", "photo", "of", "a", "cat", "[EOS]"];

export function eosIndex(tokens: readonly string[]): number {
  return tokens.indexOf("[EOS]");
}

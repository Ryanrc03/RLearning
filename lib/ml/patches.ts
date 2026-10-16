// Patch / visual-token counting for the "image → visual tokens" note.

export function patchesPerSide(imageSize: number, patchSize: number): number {
  if (imageSize % patchSize !== 0) throw new Error("image size must be a multiple of patch size");
  return imageSize / patchSize;
}

// Plain ViT: (H/p) × (W/p) patches, one feature per patch (ignoring [CLS]).
export function patchCount(height: number, width: number, patchSize: number): number {
  return patchesPerSide(height, patchSize) * patchesPerSide(width, patchSize);
}

// Qwen2-VL style: patch 14, then an MLP merges each 2×2 block into one token,
// plus <|vision_start|> and <|vision_end|> around the image (Qwen2-VL paper, §2.1).
export function qwen2vlTokens(height: number, width: number) {
  const patches = patchCount(height, width, 14);
  const merged = patchCount(height, width, 28);
  return { patches, merged, withSpecial: merged + 2 };
}

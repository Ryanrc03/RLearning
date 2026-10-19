// MultiSticker project walkthrough data. Every number is copied from the
// medium-scale run artifacts in github.com/Ryanrc03/MultiSticker
// (organized_runs/rebuild_medium/*.json and the head_only training log); the
// helpers derive the ratios, rankings and parameter counts the page quotes.
// No React here; see tests/multisticker.test.ts.

export type MsMethod = "direct_clip" | "head_only" | "image_lora" | "text_lora" | "dual_lora";
export type MsMetricKey = "r1" | "r5" | "r10" | "r30" | "mrr" | "g1" | "g5" | "g10" | "g30";
export type MsMetrics = Record<MsMetricKey, number>;

export const MS_METHODS: MsMethod[] = ["direct_clip", "head_only", "image_lora", "text_lora", "dual_lora"];

export const MS_METHOD_INFO: Record<MsMethod, { label: string; short: string; trainable: string }> = {
  direct_clip: { label: "direct_clip（冻结 CLIP）", short: "direct", trainable: "不训练：上下文直接和贴纸图做 CLIP 相似度" },
  head_only: { label: "head_only", short: "head", trainable: "只训 IntentGuidedRetriever 头 + intent 分类头" },
  image_lora: { label: "image_lora", short: "image", trainable: "头 + 图像编码器里的 LoRA" },
  text_lora: { label: "text_lora", short: "text", trainable: "头 + 文本编码器里的 LoRA" },
  dual_lora: { label: "dual_lora", short: "dual", trainable: "头 + 文本和图像两侧的 LoRA" },
};

// Validation metrics (4,998 samples, 6,758-sticker bank), memory = retrieved_topk.
export const MS_RESULTS: Record<MsMethod, MsMetrics> = {
  direct_clip: { r1: 0.0002, r5: 0.0012, r10: 0.0014, r30: 0.0028, mrr: 0.0013, g1: 0.6335, g5: 0.8778, g10: 0.9084, g30: 0.9588 },
  head_only: { r1: 0.011, r5: 0.0296, r10: 0.054, r30: 0.1263, mrr: 0.0282, g1: 0.7933, g5: 0.8619, g10: 0.878, g30: 0.9406 },
  image_lora: { r1: 0.0108, r5: 0.0376, r10: 0.0576, r30: 0.1188, mrr: 0.0302, g1: 0.7063, g5: 0.8812, g10: 0.9044, g30: 0.955 },
  text_lora: { r1: 0.0102, r5: 0.0312, r10: 0.0504, r30: 0.119, mrr: 0.028, g1: 0.7623, g5: 0.8661, g10: 0.888, g30: 0.942 },
  dual_lora: { r1: 0.01, r5: 0.0326, r10: 0.0524, r30: 0.1315, mrr: 0.0286, g1: 0.6275, g5: 0.8816, g10: 0.9064, g30: 0.954 },
};

// Memory ablation: same head_only model, memory text replaced by the literal
// string "memory disabled". direct_clip only reads the context, so its numbers
// do not move (0.0028 either way).
export const MS_NO_MEMORY_HEAD: MsMetrics = { r1: 0.0048, r5: 0.0082, r10: 0.0154, r30: 0.0412, mrr: 0.0107, g1: 0.7915, g5: 0.8567, g10: 0.8754, g30: 0.9324 };
export const MS_NO_MEMORY_DIRECT_R30 = 0.0028;

export const MS_METRIC_INFO: Record<MsMetricKey, { label: string; group: "exact" | "group" }> = {
  r1: { label: "Exact R@1", group: "exact" },
  r5: { label: "Exact R@5", group: "exact" },
  r10: { label: "Exact R@10", group: "exact" },
  r30: { label: "Exact R@30", group: "exact" },
  mrr: { label: "MRR", group: "exact" },
  g1: { label: "Group R@1", group: "group" },
  g5: { label: "Group R@5", group: "group" },
  g10: { label: "Group R@10", group: "group" },
  g30: { label: "Group R@30", group: "group" },
};

export function bestMethod(metric: MsMetricKey, methods: readonly MsMethod[] = MS_METHODS): MsMethod {
  return methods.reduce((best, m) => (MS_RESULTS[m][metric] > MS_RESULTS[best][metric] ? m : best), methods[0]);
}

export function lift(after: number, before: number): number {
  return before === 0 ? Infinity : after / before;
}

// Data funnel, from the head_only log and dataset_summary.
export const MS_FUNNEL = [
  { key: "rows", label: "聊天行", value: 8_951_733, note: "U-Sticker 的 67 个 JSON 文件，每行一条消息" },
  { key: "sticker_rows", label: "带贴纸的行", value: 370_222, note: "png 194,033 · gif 58,160 · webm 118,029" },
  { key: "samples", label: "sticker-reply 样本", value: 368_503, note: "按 12 小时空档切成 8,129 个 session，每次发贴纸是一个样本" },
  { key: "filtered", label: "过频次过滤的训练样本", value: 181_758, note: "只留在训练集里出现 ≥ 2 次的贴纸，否则无从学起" },
  { key: "train", label: "实际训练 / 验证", value: 30_000, note: "训练抽 30,000 条（可用 28,819），验证 4,998 条" },
] as const;

export const MS_DATA = {
  jsonFiles: 67,
  sessions: 8_129,
  sessionGapHours: 12,
  stickerPool: 7_011,
  bank: 6_758,
  trainUsed: 28_819,
  val: 4_998,
  valByMedia: { png: 1_676, gif: 2_284, webm: 1_038 },
  mediaRows: { png: 194_033, gif: 58_160, webm: 118_029 },
} as const;

// Training histories (5 epochs). For image_lora / dual_lora the per-epoch
// validation scores against a bank re-encoded at the start of that epoch; the
// final numbers above re-encode the bank once more with the final LoRA.
export type MsEpoch = { loss: number; r30: number; g30: number };
export type MsRun = MsMethod | "head_no_memory";
export const MS_HISTORY: Record<Exclude<MsRun, "direct_clip">, MsEpoch[]> = {
  head_only: [
    { loss: 8.0537, r30: 0.0552, g30: 0.9206 },
    { loss: 7.5887, r30: 0.1034, g30: 0.9212 },
    { loss: 7.3876, r30: 0.1126, g30: 0.9384 },
    { loss: 7.2113, r30: 0.1405, g30: 0.9414 },
    { loss: 7.0296, r30: 0.1263, g30: 0.9406 },
  ],
  head_no_memory: [
    { loss: 8.356, r30: 0.0234, g30: 0.9162 },
    { loss: 7.8914, r30: 0.0276, g30: 0.9312 },
    { loss: 7.6896, r30: 0.0314, g30: 0.9332 },
    { loss: 7.5197, r30: 0.044, g30: 0.9348 },
    { loss: 7.3443, r30: 0.0412, g30: 0.9324 },
  ],
  text_lora: [
    { loss: 7.8512, r30: 0.1186, g30: 0.9294 },
    { loss: 7.3565, r30: 0.1317, g30: 0.9332 },
    { loss: 7.0262, r30: 0.1461, g30: 0.9378 },
    { loss: 6.6253, r30: 0.1146, g30: 0.9444 },
    { loss: 6.1606, r30: 0.119, g30: 0.942 },
  ],
  image_lora: [
    { loss: 4.0427, r30: 0.0258, g30: 0.961 },
    { loss: 3.6173, r30: 0.0618, g30: 0.944 },
    { loss: 3.3868, r30: 0.0736, g30: 0.9314 },
    { loss: 3.2488, r30: 0.0772, g30: 0.9476 },
    { loss: 3.073, r30: 0.0712, g30: 0.9434 },
  ],
  dual_lora: [
    { loss: 3.9672, r30: 0.0476, g30: 0.9602 },
    { loss: 3.4579, r30: 0.0754, g30: 0.9424 },
    { loss: 3.1897, r30: 0.0756, g30: 0.9244 },
    { loss: 2.9491, r30: 0.0948, g30: 0.9232 },
    { loss: 2.6646, r30: 0.098, g30: 0.9378 },
  ],
};

// Mean seconds per training epoch from the same histories.
export const MS_EPOCH_SECONDS: Record<Exclude<MsMethod, "direct_clip">, number> = {
  head_only: 2.65,
  text_lora: 105.34,
  image_lora: 10731.83,
  dual_lora: 11071.28,
};

// Per-media validation metrics (exact R@30, group R@30).
export type MsMedia = "png" | "gif" | "webm";
export const MS_PER_MEDIA: Record<Exclude<MsMethod, "direct_clip"> | "head_no_memory", Record<MsMedia, { r30: number; g30: number; r5: number }>> = {
  head_only: { png: { r5: 0.0197, r30: 0.1062, g30: 0.9594 }, gif: { r5: 0.0499, r30: 0.1935, g30: 0.9422 }, webm: { r5: 0.001, r30: 0.0106, g30: 0.9066 } },
  image_lora: { png: { r5: 0.0185, r30: 0.0752, g30: 0.9636 }, gif: { r5: 0.067, r30: 0.1948, g30: 0.9645 }, webm: { r5: 0.0039, r30: 0.0222, g30: 0.92 } },
  text_lora: { png: { r5: 0.0286, r30: 0.099, g30: 0.9582 }, gif: { r5: 0.0468, r30: 0.1843, g30: 0.9461 }, webm: { r5: 0.001, r30: 0.0077, g30: 0.9066 } },
  dual_lora: { png: { r5: 0.0304, r30: 0.0973, g30: 0.9624 }, gif: { r5: 0.0464, r30: 0.2062, g30: 0.9549 }, webm: { r5: 0.0058, r30: 0.0222, g30: 0.9383 } },
  head_no_memory: { png: { r5: 0.0125, r30: 0.0859, g30: 0.9558 }, gif: { r5: 0.0079, r30: 0.0236, g30: 0.9225 }, webm: { r5: 0.0019, r30: 0.0077, g30: 0.9162 } },
};

// Eight fixed validation samples the training script logs every epoch: the
// rank of the observed (gold) sticker among 6,758 and whether each of the
// top-5 shares the gold sticker's majority intent group.
export type MsSampleRun = Exclude<MsMethod, "direct_clip"> | "head_no_memory";
export type MsSample = {
  id: string;
  domain: string;
  intent: string;
  media: MsMedia;
  context: string;
  runs: Record<MsSampleRun, { rank: number; top5: boolean[] }>;
};

const T = true;
const F = false;
export const MS_SAMPLES: MsSample[] = [
  {
    id: "62_session_0018#turn51173", domain: "Finance", intent: "neutral_acknowledgment", media: "gif",
    context: "4b1336c7: Ты сделал деньги || b3e57a72: That's the hope || b3e57a72: If this billionaire wins, it could force Facebook and other platforms || b3e57a72: to be mo…",
    runs: {
      head_no_memory: { rank: 1369, top5: [T, T, T, T, T] }, head_only: { rank: 70, top5: [T, F, F, T, T] },
      text_lora: { rank: 19, top5: [F, T, T, F, T] }, image_lora: { rank: 24, top5: [F, T, T, T, F] }, dual_lora: { rank: 14, top5: [T, T, F, T, F] },
    },
  },
  {
    id: "62_session_0018#turn47900", domain: "Finance", intent: "neutral_acknowledgment", media: "gif",
    context: "6bac7332: Конечно, количество обмена также имеет значение || f640b3c3: А что если возникнут проблемы во время высадки || f640b3c3: [sticker:1269403972611866873.…",
    runs: {
      head_no_memory: { rank: 1869, top5: [T, T, T, T, T] }, head_only: { rank: 391, top5: [T, T, T, T, T] },
      text_lora: { rank: 1577, top5: [T, T, T, T, F] }, image_lora: { rank: 213, top5: [T, T, F, T, F] }, dual_lora: { rank: 154, top5: [T, T, F, T, T] },
    },
  },
  {
    id: "58_session_0003#turn2247", domain: "Media Sharing", intent: "celebration_approval", media: "png",
    context: "None: [sticker:5910981387166420143.png] || 13970572: #USER_ID, #USER_ID has increased your reputation. 🏆 Your reputation 77 || 13970572: #USER_ID, #USER_ID has …",
    runs: {
      head_no_memory: { rank: 750, top5: [F, F, F, F, T] }, head_only: { rank: 1155, top5: [F, F, F, F, F] },
      text_lora: { rank: 607, top5: [F, F, F, T, F] }, image_lora: { rank: 239, top5: [F, F, F, T, F] }, dual_lora: { rank: 37, top5: [T, F, F, F, F] },
    },
  },
  {
    id: "58_session_0003#turn2497", domain: "Media Sharing", intent: "neutral_acknowledgment", media: "png",
    context: "None: [sticker:5924520919379741096.png] || d921fa96: [sticker:5911076142734905386.png] || None: [sticker:5974547581752053638.png] || c9327094: || None: [sticker…",
    runs: {
      head_no_memory: { rank: 136, top5: [T, T, T, T, T] }, head_only: { rank: 148, top5: [T, T, T, T, T] },
      text_lora: { rank: 166, top5: [T, T, T, T, T] }, image_lora: { rank: 230, top5: [T, T, T, T, T] }, dual_lora: { rank: 64, top5: [F, T, F, T, T] },
    },
  },
  {
    id: "40_session_0001#turn35277", domain: "Game", intent: "confusion_curiosity", media: "png",
    context: "6e039260: cb || 5531d655: ??? || 6e039260: hi || 6e039260: im not his? || 5531d655: hi || 6e039260: im back || 6e039260: BAHAHAH || 7edf9063: || 5531d655: wym …",
    runs: {
      head_no_memory: { rank: 3229, top5: [T, T, T, F, F] }, head_only: { rank: 6193, top5: [T, T, T, F, T] },
      text_lora: { rank: 2965, top5: [T, T, F, T, T] }, image_lora: { rank: 129, top5: [F, F, T, F, T] }, dual_lora: { rank: 341, top5: [F, T, T, T, F] },
    },
  },
  {
    id: "40_session_0001#turn575946", domain: "Game", intent: "humor_teasing", media: "webm",
    context: "4ad53b3d: -1mm/roam mh rg || 610f6751: Or mm also can || 610f6751: Whichever you find || 4ad53b3d: okay cn || 610f6751: Before I go lose 7 in a row || 4ad53b3d: …",
    runs: {
      head_no_memory: { rank: 773, top5: [T, T, T, T, T] }, head_only: { rank: 1227, top5: [T, T, T, T, T] },
      text_lora: { rank: 112, top5: [T, T, T, T, T] }, image_lora: { rank: 1233, top5: [T, T, T, T, T] }, dual_lora: { rank: 973, top5: [T, T, T, T, T] },
    },
  },
  {
    id: "40_session_0001#turn524076", domain: "Game", intent: "encouragement_support", media: "gif",
    context: "51e3f78c: HGAAHA || 5fb35712: is actly fun || b7fef7a4: good meh bro setting me up for failure || 5fb35712: we won leh || b7fef7a4: cb slow ash || 5fb35712: yah",
    runs: {
      head_no_memory: { rank: 1741, top5: [F, T, T, F, T] }, head_only: { rank: 2315, top5: [T, T, T, T, T] },
      text_lora: { rank: 455, top5: [T, T, T, F, T] }, image_lora: { rank: 678, top5: [T, T, T, T, T] }, dual_lora: { rank: 1199, top5: [T, T, T, T, T] },
    },
  },
  {
    id: "52_session_0001#turn2840", domain: "Media Sharing", intent: "neutral_acknowledgment", media: "png",
    context: "bc545aa2: || a5945ded: [sticker:1250018251174314422.png] || 2a9d2b8c: [sticker:5837150843513605959.webm] || bc545aa2: || b7cb4dcb: || 7adb54bb: [sticker:5262929…",
    runs: {
      head_no_memory: { rank: 1376, top5: [T, F, T, T, T] }, head_only: { rank: 5348, top5: [T, T, T, T, T] },
      text_lora: { rank: 2625, top5: [T, T, T, T, T] }, image_lora: { rank: 2269, top5: [F, T, T, T, T] }, dual_lora: { rank: 1896, top5: [F, T, T, T, T] },
    },
  },
];

/** Exact Recall@k for one sample: is the gold sticker in the top k? */
export function exactHit(rank: number, k: number): boolean {
  return rank <= k;
}

/** Group Recall@k for one sample: does any of the first k share the gold group? Only k ≤ 5 is known from the logs. */
export function groupHit(top5: readonly boolean[], k: number): boolean {
  if (k > top5.length) throw new Error("only the top-5 groups are logged");
  return top5.slice(0, k).some(Boolean);
}

// Trainable parameters. IntentGuidedRetriever: LayerNorm(1536) → Linear(1536,
// 512) → GELU → Dropout → Linear(512, 512), then the intent classifier
// LayerNorm(512) → Linear(512, groups). LoRA r = 8 on every out_proj, c_fc
// and c_proj of the 12-layer CLIP ViT-B-32 text tower (width 512) and/or image
// tower (width 768): per layer r·(2d) + r·(d + 4d) + r·(4d + d) = 12·r·d.
export const MS_CLIP = { textWidth: 512, imageWidth: 768, layers: 12, embed: 512, loraR: 8, loraAlpha: 16 };

// The projection MLP only; the intent classifier adds 512·groups more, and the
// number of majority-intent groups is not in the logged artifacts.
export function headParams(embed = MS_CLIP.embed): number {
  const inDim = 3 * embed;
  return 2 * inDim + (inDim * 512 + 512) + (512 * embed + embed);
}

export function loraParams(width: number, layers = MS_CLIP.layers, r = MS_CLIP.loraR): number {
  return layers * 12 * r * width;
}

export function trainableParams(method: MsMethod): number {
  if (method === "direct_clip") return 0;
  const head = headParams();
  const text = method === "text_lora" || method === "dual_lora" ? loraParams(MS_CLIP.textWidth) : 0;
  const image = method === "image_lora" || method === "dual_lora" ? loraParams(MS_CLIP.imageWidth) : 0;
  return head + text + image;
}

// The README's Figure 1 example, used by the signal-composer UI.
export const MS_FIGURE1 = {
  chat: [
    { who: "Alice", text: "this is good" },
    { who: "Bob", text: "I would prefer this be more common because I run into this exact thing quite often" },
    { who: "Alice", text: "yeah" },
    { who: "Bob", text: "i just use a flag because it's more obvious to me" },
    { who: "Alice", text: "well..." },
  ],
  history: [
    { session: "Session A", summary: "A user shared a quote about TF2 engineers." },
    { session: "Session B", summary: "Another mentioned confusing F-Droid with F-List." },
    { session: "Session C", summary: "There were detections of a link and offensive content." },
  ],
  intent: "humor_teasing: The reply is a playful joke, likely a sticker with a humorous face or a funny meme.",
} as const;

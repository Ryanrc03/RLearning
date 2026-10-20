// LLMs, BERT vs MacBERT: the same Chinese sentence corrupted four ways for
// masked-LM pre-training. bert-base-chinese masks single characters with
// [MASK]; whole-word masking (WWM) masks every character of a word; N-gram
// masking masks runs of 1–4 words; MacBERT masks words / n-grams like WWM +
// N-gram but swaps them for a similar word instead of [MASK]. The sentence and
// the choices are modelled on the example in Table 1 of Cui et al. (2020). Pure functions, no React;
// see tests/macbert.test.ts.

export type MaskStrategy = "bert" | "wwm" | "ngram" | "macbert";

/** The demo sentence after word segmentation (the paper uses LTP). The model input is still one token per character. */
export const DEMO_WORDS: string[] = ["使用", "语言", "模型", "来", "预测", "下", "一个", "词", "的", "概率"];

/** Similar words MacBERT swaps in, keyed by the span of original words they replace. */
export const SIMILAR: Record<string, string> = { 语言模型: "语法建模", 预测: "预见", 概率: "几率" };

/** What each strategy picks, as [firstWord, lastWord] spans; `bert` picks single characters instead. */
const BERT_CHARS = [4, 7]; // 模, 预
const SPANS: Record<Exclude<MaskStrategy, "bert">, [number, number][]> = {
  wwm: [[2, 2], [4, 4]], // 模型, 预测
  ngram: [[1, 2], [4, 4]], // 语言模型 (2-gram), 预测
  macbert: [[1, 2], [4, 4], [9, 9]], // 语言模型, 预测, 概率
};

export type CorruptedToken = {
  /** What the model reads at this position. */
  input: string;
  /** The original character, which the loss asks the model to recover. */
  target: string;
  kind: "keep" | "mask" | "swap";
};

export const MASK = "[MASK]";

/** Character offset where each word starts. */
function wordStarts(words: string[]): number[] {
  const starts: number[] = [];
  let at = 0;
  for (const w of words) {
    starts.push(at);
    at += w.length;
  }
  return starts;
}

/** Corrupt the demo sentence with one strategy; one output token per original character. */
export function corrupt(strategy: MaskStrategy, words: string[] = DEMO_WORDS): CorruptedToken[] {
  const chars = words.join("").split("");
  const out: CorruptedToken[] = chars.map((c) => ({ input: c, target: c, kind: "keep" }));
  if (strategy === "bert") {
    for (const i of BERT_CHARS) out[i] = { input: MASK, target: chars[i], kind: "mask" };
    return out;
  }
  const starts = wordStarts(words);
  for (const [a, b] of SPANS[strategy]) {
    const from = starts[a];
    const original = words.slice(a, b + 1).join("");
    const swap = strategy === "macbert" ? SIMILAR[original] : undefined;
    if (strategy === "macbert" && (!swap || swap.length !== original.length)) throw new Error(`no same-length similar word for ${original}`);
    for (let k = 0; k < original.length; k++) {
      out[from + k] = swap ? { input: swap[k], target: original[k], kind: "swap" } : { input: MASK, target: original[k], kind: "mask" };
    }
  }
  return out;
}

export type CorruptionStats = {
  /** Positions that carry a loss term. */
  predicted: number;
  /** [MASK] tokens in the input: the thing fine-tuning inputs never contain. */
  maskTokens: number;
  /** Whole words the corrupted positions cover, and how many of them are touched only partly. */
  wordsTouched: number;
  partialWords: number;
};

export function stats(tokens: CorruptedToken[], words: string[] = DEMO_WORDS): CorruptionStats {
  const starts = wordStarts(words);
  let wordsTouched = 0;
  let partialWords = 0;
  words.forEach((w, i) => {
    const hit = tokens.slice(starts[i], starts[i] + w.length).filter((t) => t.kind !== "keep").length;
    if (hit > 0) wordsTouched++;
    if (hit > 0 && hit < w.length) partialWords++;
  });
  return {
    predicted: tokens.filter((t) => t.kind !== "keep").length,
    maskTokens: tokens.filter((t) => t.kind === "mask").length,
    wordsTouched,
    partialWords,
  };
}

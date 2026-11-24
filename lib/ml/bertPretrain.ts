// LLMs, the BERT course chapter: MLM and NSP pre-training on one shared
// encoder, then fine-tuning. Every probability here is an assumed teaching
// value, not a model's output. No React; see tests/bert-pretrain.test.ts.

import { sigmoid } from "./rlhf";
import { softmax } from "./clip";

/** −log p of the correct class: cross-entropy against a one-hot label. */
export function crossEntropy(probs: readonly number[], target: number): number {
  const p = probs[target];
  if (!(p > 0 && p <= 1)) throw new Error("target probability must be in (0, 1]");
  return -Math.log(p);
}

/** Binary cross-entropy for one example; p is the predicted probability of y = 1. */
export function binaryCrossEntropy(p: number, y: 0 | 1): number {
  if (!(p > 0 && p < 1)) throw new Error("p must be in (0, 1)");
  return y === 1 ? -Math.log(p) : -Math.log(1 - p);
}

/** Mean of the per-position MLM losses over the selected positions M. */
export function meanLoss(losses: readonly number[]): number {
  if (!losses.length) throw new Error("no masked positions");
  return losses.reduce((a, b) => a + b, 0) / losses.length;
}

/** Sigmoid on one logit and softmax on the two logits (z, 0) give the same probability. */
export function sigmoidAsSoftmax(z: number): { viaSigmoid: number; viaSoftmax: number } {
  return { viaSigmoid: sigmoid(z), viaSoftmax: softmax([z, 0])[0] };
}

export const MLM_SENTENCE = ["the", "cat", "sat", "on", "the", "mat"] as const;

export type MlmExample = {
  /** 0-based position that is replaced by [MASK]. */
  position: number;
  target: string;
  /** Assumed predictions; the target comes first. They sum to 1. */
  candidates: readonly { token: string; p: number }[];
};

/** The slide's example masks "cat"; "mat" is a second position to switch to. */
export const MLM_EXAMPLES: readonly MlmExample[] = [
  { position: 1, target: "cat", candidates: [{ token: "cat", p: 0.75 }, { token: "dog", p: 0.15 }, { token: "boy", p: 0.08 }, { token: "car", p: 0.02 }] },
  { position: 5, target: "mat", candidates: [{ token: "mat", p: 0.6 }, { token: "floor", p: 0.25 }, { token: "sofa", p: 0.1 }, { token: "roof", p: 0.05 }] },
];

export function mlmInput(example: MlmExample): string[] {
  return MLM_SENTENCE.map((tok, i) => (i === example.position ? "[MASK]" : tok));
}

export function mlmExampleLoss(example: MlmExample): number {
  return crossEntropy(example.candidates.map((c) => c.p), 0);
}

export const NSP_SENTENCE_A = "calculus is a branch of math";

export type NspExample = {
  key: "next" | "random";
  label: "IsNext" | "NotNext";
  y: 0 | 1;
  sentenceB: string;
  /** Assumed predicted probability that B follows A. */
  pIsNext: number;
};

export const NSP_EXAMPLES: readonly NspExample[] = [
  { key: "next", label: "IsNext", y: 1, sentenceB: "it was developed by newton and leibniz", pIsNext: 0.8 },
  { key: "random", label: "NotNext", y: 0, sentenceB: "panda is native to south central china", pIsNext: 0.1 },
];

export const nspLoss = (e: NspExample) => binaryCrossEntropy(e.pIsNext, e.y);

/** The slide's joint example: one sequence, one NSP label, two masked positions. */
export const JOINT_TOKENS = ["[CLS]", "calculus", "is", "a", "[MASK]", "of", "math", "[SEP]", "it", "[MASK]", "developed", "by", "newton", "and", "leibniz", "[SEP]"] as const;

export const JOINT_EXAMPLE = {
  nsp: { label: "IsNext", y: 1 as const, pIsNext: 0.8 },
  /** Positions in JOINT_TOKENS, the original tokens, and assumed probabilities of the correct token. */
  masks: [
    { position: 4, target: "branch", p: 0.6 },
    { position: 9, target: "was", p: 0.9 },
  ],
} as const;

export type JointLoss = {
  nsp: number;
  mlmEach: number[];
  /** Mean over the masked positions. */
  mlm: number;
  /** L_pretrain = L_MLM + L_NSP. */
  total: number;
  /** The slide's picture: the three terms simply added. */
  sumOfThree: number;
};

export function jointLoss(example: typeof JOINT_EXAMPLE = JOINT_EXAMPLE): JointLoss {
  const nsp = binaryCrossEntropy(example.nsp.pIsNext, example.nsp.y);
  const mlmEach = example.masks.map((m) => -Math.log(m.p));
  const mlm = meanLoss(mlmEach);
  return { nsp, mlmEach, mlm, total: mlm + nsp, sumOfThree: nsp + mlmEach.reduce((a, b) => a + b, 0) };
}

export type BertSize = {
  name: "BERT Base" | "BERT Large";
  layers: number;
  hidden: number;
  heads: number;
  /** Millions of parameters, as reported in the paper. */
  paramsM: number;
  /** Cloud TPUs used for pre-training, as reported in the paper. */
  tpus: number;
  days: number;
};

/** Devlin et al. (2019). The lecture slide prints 235M for Large; the paper says 340M. */
export const BERT_SIZES: readonly BertSize[] = [
  { name: "BERT Base", layers: 12, hidden: 768, heads: 12, paramsM: 110, tpus: 16, days: 4 },
  { name: "BERT Large", layers: 24, hidden: 1024, heads: 16, paramsM: 340, tpus: 64, days: 4 },
];
export const SLIDE_LARGE_PARAMS_M = 235;

export type FinetuneTask = {
  key: "sentiment" | "ner" | "qa";
  name: string;
  input: string;
  /** Which encoder outputs the head reads. */
  reads: string;
  head: string;
  output: string;
  example: string[];
  /** Positions of `example` whose hidden vectors feed the head. */
  used: number[];
  exampleOutput: string;
};

export const FINETUNE_TASKS: readonly FinetuneTask[] = [
  {
    key: "sentiment", name: "Sentiment Classification", input: "一段文本",
    reads: "[CLS] 的最终隐藏向量", head: "分类头：线性层 + softmax", output: "正 / 负等类别的概率",
    example: ["[CLS]", "this", "movie", "is", "wonderful", "[SEP]"], used: [0], exampleOutput: "P(positive), P(negative)",
  },
  {
    key: "ner", name: "NER", input: "一段文本",
    reads: "每个 token 的最终隐藏向量", head: "每个位置各接同一个分类头", output: "每个 token 的实体类别",
    example: ["[CLS]", "newton", "lived", "in", "england", "[SEP]"], used: [1, 2, 3, 4], exampleOutput: "PER · O · O · LOC",
  },
  {
    key: "qa", name: "Extractive QA", input: "问题 + 上下文",
    reads: "上下文各 token 的隐藏向量", head: "起点打分与终点打分两个向量", output: "答案在上下文里的起点和终点",
    example: ["[CLS]", "who", "?", "[SEP]", "developed", "by", "newton", "[SEP]"], used: [4, 5, 6], exampleOutput: "start = newton，end = newton",
  },
];

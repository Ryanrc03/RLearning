// Post-training, page 1: the SFT loss. A chat-templated sample is one token
// row; the loss is the same next-token cross-entropy as pre-training, but the
// prompt positions get label −100 (ignored) so only response tokens count.
// Pure functions, no React; see tests/sft.test.ts.

export type SftRole = "prompt" | "response";

/**
 * One position of a templated sample. `p` is the toy probability the current
 * model gives this token given everything before it; `special` marks chat
 * template tokens such as <|user|>.
 */
export type SftToken = { text: string; role: SftRole; p: number; special?: boolean };

/** The label PyTorch's cross_entropy skips (`ignore_index`); HF trainers use the same value. */
export const IGNORE_INDEX = -100;

const P = (text: string, p: number, special = false): SftToken => ({ text, role: "prompt", p, special });
const R = (text: string, p: number, special = false): SftToken => ({ text, role: "response", p, special });

/**
 * Two demo samples. Prompt tokens are hard to predict (the user could have
 * asked anything), so their p is low; template tokens are near-certain.
 * The end-of-turn token belongs to the response: the model must learn to stop.
 */
export const SFT_SAMPLES: Record<"chat" | "extract", { label: string; tokens: SftToken[] }> = {
  chat: {
    label: "短指令、长回答",
    tokens: [
      P("<|user|>", 0.98, true),
      P("推荐", 0.04),
      P("一部", 0.12),
      P("科幻", 0.06),
      P("电影", 0.3),
      P("<|assistant|>", 0.95, true),
      R("《星际穿越》", 0.18),
      R("，", 0.62),
      R("讲", 0.35),
      R("父女", 0.22),
      R("和", 0.55),
      R("时间", 0.48),
      R("。", 0.8),
      R("<|end|>", 0.7, true),
    ],
  },
  extract: {
    label: "长 prompt、短回答",
    tokens: [
      P("<|user|>", 0.98, true),
      P("下面", 0.05),
      P("是", 0.4),
      P("一条", 0.2),
      P("评论", 0.08),
      P("：", 0.5),
      P("屏幕", 0.03),
      P("很", 0.25),
      P("亮", 0.15),
      P("，", 0.45),
      P("但", 0.2),
      P("电池", 0.06),
      P("一天", 0.1),
      P("就", 0.3),
      P("没电", 0.12),
      P("。", 0.6),
      P("情感", 0.04),
      P("是", 0.5),
      P("？", 0.35),
      P("<|assistant|>", 0.95, true),
      R("负面", 0.4),
      R("<|end|>", 0.85, true),
    ],
  },
};

/** Which positions contribute to the loss. With `maskPrompt` off, every token counts (plain LM loss on the whole sample). */
export function lossMask(tokens: SftToken[], maskPrompt: boolean): boolean[] {
  return tokens.map((t) => !maskPrompt || t.role === "response");
}

/** Token ids → labels: same ids, prompt positions replaced by IGNORE_INDEX when masked. */
export function buildLabels(ids: number[], tokens: SftToken[], maskPrompt: boolean): number[] {
  if (ids.length !== tokens.length) throw new Error("ids and tokens differ in length");
  const mask = lossMask(tokens, maskPrompt);
  return ids.map((id, i) => (mask[i] ? id : IGNORE_INDEX));
}

export type SftLoss = {
  /** −log p for every position, counted or not. */
  nll: number[];
  counted: boolean[];
  /** Number of positions that count. */
  count: number;
  /** Sum of the counted terms. */
  sum: number;
  /** sum / count: what the trainer reports and backpropagates. */
  mean: number;
  /** Share of `sum` that comes from prompt positions (0 when the prompt is masked). */
  promptShare: number;
  /** Mean −log p over response tokens only, independent of the mask. */
  responseMean: number;
};

/** The SFT objective for one sample: mean of −log p over the positions the mask keeps. */
export function sftLoss(tokens: SftToken[], maskPrompt: boolean): SftLoss {
  const nll = tokens.map((t) => {
    if (!(t.p > 0 && t.p <= 1)) throw new Error(`probability out of range: ${t.p}`);
    return -Math.log(t.p);
  });
  const counted = lossMask(tokens, maskPrompt);
  let sum = 0;
  let promptSum = 0;
  let count = 0;
  let respSum = 0;
  let respCount = 0;
  nll.forEach((v, i) => {
    if (tokens[i].role === "response") {
      respSum += v;
      respCount++;
    }
    if (!counted[i]) return;
    sum += v;
    count++;
    if (tokens[i].role === "prompt") promptSum += v;
  });
  return {
    nll,
    counted,
    count,
    sum,
    mean: count === 0 ? 0 : sum / count,
    promptShare: sum === 0 ? 0 : promptSum / sum,
    responseMean: respCount === 0 ? 0 : respSum / respCount,
  };
}

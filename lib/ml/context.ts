// Prompt assembly and context-window budgeting for the LLM Engineering chapter.
// Pure functions, no React; see tests/context.test.ts.

// ---------- Page 1: the four prompt layers ----------

export type PromptLayers = { role: boolean; fewShot: boolean; cot: boolean; constraints: boolean };
export type BlockKey = "role" | "fewShot" | "task" | "cot" | "constraints";
export type PromptBlock = { key: BlockKey; text: string };

// One realistic task: classify a user review as 正面 / 负面 / 中性 and give a reason.
// The task block is always present; the other four are the layers the reader toggles.
export const PROMPT_TEXTS: Record<BlockKey, string> = {
  role: "你是一家电商平台的客服质检员，负责判断用户评论的情感倾向。你读过大量评论，知道「还行」「凑合」这类词通常偏中性，而不是负面。",
  fewShot:
    "例子：\n评论：物流很快，包装也仔细，下次还买。\n标签：正面。理由：对物流和包装都给了好评，并表示会复购。\n评论：用了三天就坏了，客服也不回消息。\n标签：负面。理由：产品质量和售后都被否定。\n评论：东西收到了，和描述一样。\n标签：中性。理由：只陈述事实，没有明显的好恶。",
  task: "请把下面这条用户评论分成 正面 / 负面 / 中性，并给出理由。\n评论：价格比上次贵了点，不过味道还是那个味道。",
  cot: "先想再答：先找出评论里提到的每个方面（价格、味道……）各自是褒是贬，再衡量哪个更重，最后才给标签。",
  constraints: "要求：标签只能是 正面 / 负面 / 中性 三选一；理由不超过 30 字；按「标签：X。理由：Y」的格式输出，不要加其他内容。",
};

export const LAYER_ORDER: BlockKey[] = ["role", "fewShot", "task", "cot", "constraints"];

export const ALL_LAYERS: PromptLayers = { role: true, fewShot: true, cot: true, constraints: true };
export const NO_LAYERS: PromptLayers = { role: false, fewShot: false, cot: false, constraints: false };

// Blocks in the order the model reads them: role → few-shot → task → CoT → constraints.
export function assemblePrompt(layers: PromptLayers): { blocks: PromptBlock[]; text: string } {
  const on: Record<BlockKey, boolean> = { role: layers.role, fewShot: layers.fewShot, task: true, cot: layers.cot, constraints: layers.constraints };
  const blocks = LAYER_ORDER.filter((k) => on[k]).map((key) => ({ key, text: PROMPT_TEXTS[key] }));
  return { blocks, text: blocks.map((b) => b.text).join("\n\n") };
}

// A rough tokenizer good enough to compare prompts against each other: every
// CJK character (including CJK punctuation) is one token, every run of Latin
// letters or digits is one token, ASCII punctuation and whitespace are free.
const TOKEN_RE = /[　-〿㐀-鿿＀-￯]|[A-Za-z0-9]+/g;

export function estimateTokens(text: string): number {
  return (text.match(TOKEN_RE) ?? []).length;
}

// ---------- Page 2: what else is in the context window ----------

export type SegmentKey = "system" | "prompt" | "shortMemory" | "longMemory" | "rag" | "tools" | "state" | "user";

export type Segment = {
  key: SegmentKey;
  name: string;
  tokens: number;
  what: string;
  /** Can a harness shrink it (summarise, re-rank, truncate) without losing the task? */
  compressible: boolean;
};

const FULL_PROMPT_TOKENS = estimateTokens(assemblePrompt(ALL_LAYERS).text);

// Illustrative sizes for one turn of a customer-support assistant. Everything
// except the engineered prompt is a round number; the prompt is measured.
export const SEGMENTS: Segment[] = [
  { key: "system", name: "system", tokens: 1200, what: "产品级的系统提示：身份、安全规则、输出格式", compressible: false },
  { key: "prompt", name: "拼好的 prompt", tokens: FULL_PROMPT_TOKENS, what: "上一页拼出来的任务指令：角色、例子、先想再答、限制", compressible: false },
  { key: "shortMemory", name: "短期记忆摘要", tokens: 600, what: "前面 20 轮对话压成的一段摘要", compressible: true },
  { key: "longMemory", name: "长期记忆取回", tokens: 900, what: "从 vector DB 按相似度取回的 3 条用户历史", compressible: true },
  { key: "rag", name: "RAG 片段", tokens: 3200, what: "检索到的 4 段商品文档，每段约 800", compressible: true },
  { key: "tools", name: "工具结果", tokens: 2400, what: "一次订单查询返回的 JSON 原文", compressible: true },
  { key: "state", name: "状态", tokens: 300, what: "当前任务阶段、已完成的步骤、待填的变量", compressible: true },
  { key: "user", name: "用户这轮", tokens: 150, what: "用户刚发来的那条评论", compressible: false },
];

export const BUDGETS = [8000, 32000, 128000] as const;

export type BudgetRow = Segment & { enabled: boolean; cumulative: number; fits: boolean };
export type FillResult = { used: number; overflow: boolean; excess: number; rows: BudgetRow[] };

// Walk the segments in window order, accumulating the enabled ones. A row
// `fits` when the cumulative total up to and including it is within budget.
export function fillBudget(segments: Segment[], enabled: Record<string, boolean>, budget: number): FillResult {
  let cumulative = 0;
  const rows = segments.map((s) => {
    const on = enabled[s.key] !== false;
    if (on) cumulative += s.tokens;
    return { ...s, enabled: on, cumulative, fits: !on || cumulative <= budget };
  });
  const used = cumulative;
  return { used, overflow: used > budget, excess: Math.max(0, used - budget), rows };
}

// When the window overflows: the largest enabled compressible segment and how
// small it has to get for everything to fit again (null when nothing can give).
export function whatToCut(fill: FillResult): { key: SegmentKey; name: string; tokens: number; keep: number } | null {
  if (!fill.overflow) return null;
  const candidates = fill.rows.filter((r) => r.enabled && r.compressible);
  if (candidates.length === 0) return null;
  const biggest = candidates.reduce((a, b) => (b.tokens > a.tokens ? b : a));
  return { key: biggest.key, name: biggest.name, tokens: biggest.tokens, keep: Math.max(0, biggest.tokens - fill.excess) };
}

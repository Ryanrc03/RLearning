"use client";

import { useState } from "react";
import { useLang } from "@/components/i18n/LangProvider";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import type { Lang } from "@/lib/i18n";
import { GRPO3060, MODEL_LABEL, type ModelKey } from "@/lib/ml/grpo3060";
import { MODEL_COLOR } from "./colors";

// Four GSM8K test problems, five models, verbatim outputs. The tab picks the
// problem; every card shows one model's answer with its verdict and length.
// Questions and outputs are verbatim English data, shown untranslated on both pages.

type Tag = (typeof GRPO3060.samples)[number]["tag"];

const TAGS: Tag[] = ["format", "reasoning", "hacked", "style"];
const ORDER: ModelKey[] = ["instruct", "sft", "base200", "base500", "fixed500"];
const TONE: Record<Tag, string> = { format: " is-warn", reasoning: " is-good", hacked: " is-bad", style: "" };

const zh = {
  problems: { format: "① 答案栏写了整句", reasoning: "② 多想一步", hacked: "③ 被刷成一行算式", style: "④ 都对时的写法" } as Record<Tag, string>,
  narr: {
    format: "未训练的模型推理是对的，算出了 576，但 <answer> 写了一整句话，还没闭合标签，取不出答案，判错。未训练模型丢的分有很大一部分是这种。训过的四个模型都把标签写完整了；SFT 和第一轮写得最短，修正版仍然像未训练模型那样一步步推，只是收了尾。",
    reasoning: "题里有四个条件：1 个坏的、20% 没熟、2 个酸的、剩下是好的。未训练和 SFT 都漏了「1 个坏的」答 18；第一轮 200 步和修正版把四个条件逐条列出再减，答对 17；第一轮 500 步的减法已经乱了。SFT 学的是金标的写法，没学到多检查一步。",
    hacked: "第一轮 500 步的推理只剩一行 2 * 3 * 60 = 180$，连乘法都错了。标签齐全、答案是整数，四项格式分全拿，只有 correctness 是 0。这就是 reward hacking 在单条样本上的样子：信封完美，内容空了。修正版写两句：3 * 2 = 6 双，6 * $60 = $360；答案栏写的是 $360，不是纯数字，所以拿不到 int 那 0.25 分，它也没去刷。",
    style: "都答对时差别在写法：未训练模型在答案栏写句子，SFT 是金标那种两行算式，两轮 GRPO 用一两句自然语言把算式串起来。第一轮 500 步最短，但在简单题上短不是问题，问题出在需要多想一步的题上。",
  } as Record<Tag, string>,
  title: "同一道题，五个模型的原始输出",
  description: "从 GSM8K test 挑的四道题，每张卡片是一个模型逐字的输出（温度 0.2）。右上角是对错和输出 token 数。",
  footnote: "题号是 GSM8K test 里的下标。对错按答案栏里最后一个数字归一化后与标准答案比对。",
  problemAria: "选择题目",
  reset: "重置",
  questionHead: (idx: number, gold: string) => `GSM8K test #${idx} · 标准答案 ${gold}`,
  right: "✓ 对",
  wrong: "✗ 错",
};

const COPY: Record<Lang, typeof zh> = {
  zh,
  en: {
    problems: { format: "① Sentence in the answer", reasoning: "② One more step", hacked: "③ Hacked to one line", style: "④ Style when all are right" },
    narr: {
      format: "The untrained model reasons correctly and gets 576, but it writes a whole sentence in <answer> and never closes the tag, so no answer can be extracted and it is graded wrong. A large share of the points the untrained model loses go this way. All four trained models write the tags in full; SFT and the first run write the shortest, while the fixed run still reasons step by step like the untrained model, only now it finishes properly.",
      reasoning: "The problem has four conditions: 1 bad, 20% unripe, 2 sour, and the rest good. The untrained model and SFT both miss the “1 bad” and answer 18; the first run at 200 steps and the fixed run list all four conditions one by one before subtracting, and get 17 right; by 500 steps the first run's subtraction has fallen apart. SFT learned the gold solutions' style, not the habit of checking one more step.",
      hacked: "At 500 steps the first run's reasoning is down to a single line, 2 * 3 * 60 = 180$, and it even gets the multiplication wrong. The tags are all there and the answer is an integer, so it collects all four format rewards; only correctness is 0. This is what reward hacking looks like in a single sample: a perfect envelope with nothing inside. The fixed run writes two sentences: 3 * 2 = 6 pairs, 6 * $60 = $360. Its answer field reads $360, not a bare number, so it misses the 0.25 int points, and it did not try to farm them either.",
      style: "When every model is right, the difference is in style: the untrained model writes a sentence in the answer field, SFT writes the gold solutions' two lines of arithmetic, and both GRPO runs string the arithmetic together with a sentence or two of natural language. The first run at 500 steps is the shortest, but being short is no problem on easy problems; the trouble shows up on problems that need one more step of thought.",
    },
    title: "The same problem, raw outputs from five models",
    description: "Four problems picked from GSM8K test; each card is one model's verbatim output (temperature 0.2). The top-right corner shows whether it is right and how many tokens it output.",
    footnote: "The problem number is its index in GSM8K test. An answer is graded by normalizing the last number in the answer field and comparing it with the reference answer.",
    problemAria: "Choose a problem",
    reset: "Reset",
    questionHead: (idx, gold) => `GSM8K test #${idx} · reference answer ${gold}`,
    right: "✓ right",
    wrong: "✗ wrong",
  },
};

export default function G3SampleCompare() {
  const lang = useLang();
  const copy = COPY[lang];
  const problems = TAGS.map((key) => ({ key, label: copy.problems[key] }));
  const [tag, setTag] = useState<Tag>("hacked");
  const s = GRPO3060.samples.find((x) => x.tag === tag)!;

  return (
    <VisualizationFrame title={copy.title} description={copy.description} footnote={copy.footnote}>
      <div className="viz-row">
        <Tabs options={problems} value={tag} onChange={setTag} ariaLabel={copy.problemAria} />
        <button type="button" className="viz-btn" onClick={() => setTag("hacked")}>{copy.reset}</button>
      </div>
      <div className="viz-panel g3-question">
        <h5 className="nocase">{copy.questionHead(s.idx, s.gold)}</h5>
        <p>{s.question}</p>
      </div>
      <div className="g3-cards">
        {ORDER.map((m) => {
          const a = s.answers[m];
          return (
            <div className={`viz-card g3-card${a.correct ? " is-right" : " is-wrong"}`} key={m} style={{ borderTopColor: MODEL_COLOR[m] }}>
              <div className="g3-card-head">
                <h6>{MODEL_LABEL[m][lang]}</h6>
                <span className={`g3-verdict${a.correct ? " is-right" : " is-wrong"}`}>{a.correct ? copy.right : copy.wrong} · {a.tokens} tok</span>
              </div>
              <pre className="g3-out">{a.output}</pre>
            </div>
          );
        })}
      </div>
      <div className={`viz-narr${TONE[tag]}`}>{copy.narr[tag]}</div>
    </VisualizationFrame>
  );
}

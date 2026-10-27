"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { GRPO3060, MODEL_LABEL, type ModelKey } from "@/lib/ml/grpo3060";
import { MODEL_COLOR } from "./colors";

// Four GSM8K test problems, five models, verbatim outputs. The tab picks the
// problem; every card shows one model's answer with its verdict and length.

type Tag = (typeof GRPO3060.samples)[number]["tag"];

const PROBLEMS: { key: Tag; label: string }[] = [
  { key: "format", label: "① 答案栏写了整句" },
  { key: "reasoning", label: "② 多想一步" },
  { key: "hacked", label: "③ 被刷成一行算式" },
  { key: "style", label: "④ 都对时的写法" },
];
const ORDER: ModelKey[] = ["instruct", "sft", "base200", "base500", "fixed500"];

const NARR: Record<Tag, { tone: string; text: string }> = {
  format: {
    tone: " is-warn",
    text: "未训练的模型推理是对的，算出了 576，但 <answer> 写了一整句话，还没闭合标签，取不出答案，判错。未训练模型丢的分有很大一部分是这种。训过的四个模型都把标签写完整了；SFT 和第一轮写得最短，修正版仍然像未训练模型那样一步步推，只是收了尾。",
  },
  reasoning: {
    tone: " is-good",
    text: "题里有四个条件：1 个坏的、20% 没熟、2 个酸的、剩下是好的。未训练和 SFT 都漏了「1 个坏的」答 18；第一轮 200 步和修正版把四个条件逐条列出再减，答对 17；第一轮 500 步的减法已经乱了。SFT 学的是金标的写法，没学到多检查一步。",
  },
  hacked: {
    tone: " is-bad",
    text: "第一轮 500 步的推理只剩一行 2 * 3 * 60 = 180$，连乘法都错了。标签齐全、答案是整数，四项格式分全拿，只有 correctness 是 0。这就是 reward hacking 在单条样本上的样子：信封完美，内容空了。修正版写两句：3 * 2 = 6 双，6 * $60 = $360；答案栏写的是 $360，不是纯数字，所以拿不到 int 那 0.25 分，它也没去刷。",
  },
  style: {
    tone: "",
    text: "都答对时差别在写法：未训练模型在答案栏写句子，SFT 是金标那种两行算式，两轮 GRPO 用一两句自然语言把算式串起来。第一轮 500 步最短，但在简单题上短不是问题，问题出在需要多想一步的题上。",
  },
};

export default function G3SampleCompare() {
  const [tag, setTag] = useState<Tag>("hacked");
  const s = GRPO3060.samples.find((x) => x.tag === tag)!;

  return (
    <VisualizationFrame
      title="同一道题，五个模型的原始输出"
      description="从 GSM8K test 挑的四道题，每张卡片是一个模型逐字的输出（温度 0.2）。右上角是对错和输出 token 数。"
      footnote="题号是 GSM8K test 里的下标。对错按答案栏里最后一个数字归一化后与标准答案比对。"
    >
      <div className="viz-row">
        <Tabs options={PROBLEMS} value={tag} onChange={setTag} ariaLabel="选择题目" />
        <button type="button" className="viz-btn" onClick={() => setTag("hacked")}>重置</button>
      </div>
      <div className="viz-panel g3-question">
        <h5 className="nocase">GSM8K test #{s.idx} · 标准答案 {s.gold}</h5>
        <p>{s.question}</p>
      </div>
      <div className="g3-cards">
        {ORDER.map((m) => {
          const a = s.answers[m];
          return (
            <div className={`viz-card g3-card${a.correct ? " is-right" : " is-wrong"}`} key={m} style={{ borderTopColor: MODEL_COLOR[m] }}>
              <div className="g3-card-head">
                <h6>{MODEL_LABEL[m]}</h6>
                <span className={`g3-verdict${a.correct ? " is-right" : " is-wrong"}`}>{a.correct ? "✓ 对" : "✗ 错"} · {a.tokens} tok</span>
              </div>
              <pre className="g3-out">{a.output}</pre>
            </div>
          );
        })}
      </div>
      <div className={`viz-narr${NARR[tag].tone}`}>{NARR[tag].text}</div>
    </VisualizationFrame>
  );
}

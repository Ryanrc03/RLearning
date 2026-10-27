"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars, { type BarRow } from "@/components/visualization/ml/primitives/Bars";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { GRPO3060, MODEL_LABEL, type ModelKey } from "@/lib/ml/grpo3060";
import { MODEL_COLOR } from "./colors";

// Headline results of the 3060 project: five models × three eval sets, one
// metric at a time. The dataset tab is the primary control; the metric chips
// switch what the bars measure.

type Dataset = "gsm8k_test" | "aime2024" | "aime2025";
type Metric = "acc" | "format" | "len";

const DATASETS: { key: Dataset; label: string }[] = [
  { key: "gsm8k_test", label: "GSM8K test · 1,319 题" },
  { key: "aime2024", label: "AIME 2024 · 30 题" },
  { key: "aime2025", label: "AIME 2025 · 30 题" },
];
const METRICS: { key: Metric; label: string }[] = [
  { key: "acc", label: "准确率" },
  { key: "format", label: "完整格式率" },
  { key: "len", label: "平均回答 token" },
];
const ORDER: ModelKey[] = ["instruct", "sft", "base200", "base500", "fixed500"];
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function G3ResultsFigure() {
  const [ds, setDs] = useState<Dataset>("gsm8k_test");
  const [metric, setMetric] = useState<Metric>("acc");
  const vals = ORDER.map((m) => GRPO3060.eval[m][ds][metric]);
  const max = metric === "len" ? 512 : 1;
  const rows: BarRow[] = ORDER.map((m, i) => ({
    label: MODEL_LABEL[m],
    value: vals[i],
    max,
    color: MODEL_COLOR[m],
    text: metric === "len" ? vals[i].toFixed(0) : pct(vals[i]),
  }));
  const reset = () => {
    setDs("gsm8k_test");
    setMetric("acc");
  };
  const e = (m: ModelKey) => GRPO3060.eval[m][ds];

  let tone = "";
  let narr = "";
  if (ds === "gsm8k_test" && metric === "acc") {
    tone = " is-good";
    narr = `修正版 500 步 ${pct(e("fixed500").acc)} 最高，比未训练高 ${((e("fixed500").acc - e("instruct").acc) * 100).toFixed(1)} 个点，比 SFT 高 ${((e("fixed500").acc - e("sft").acc) * 100).toFixed(1)} 个点。第一轮训满 500 步反而只有 ${pct(e("base500").acc)}，比不训还差；它在 200 步时其实到过 ${pct(e("base200").acc)}。`;
  } else if (ds === "gsm8k_test" && metric === "format") {
    narr = `未训练模型 ${pct(e("instruct").format)} 的回答格式完整，剩下的不是没写标签就是在 <answer> 里写整句话。训过的四个模型都在 98% 以上：格式是最容易学会的东西，所以也是最先被刷的东西。`;
  } else if (ds === "gsm8k_test") {
    tone = " is-warn";
    narr = `第一轮 500 步平均只写 ${e("base500").len.toFixed(0)} token，修正版 ${e("fixed500").len.toFixed(0)}，几乎和未训练的 ${e("instruct").len.toFixed(0)} 一样长。SFT 的 ${e("sft").len.toFixed(0)} 是在模仿 GSM8K 金标的两行算式。`;
  } else if (metric === "acc") {
    tone = " is-bad";
    narr = `AIME 上五个模型都接近 0：3B 的模型在 GSM8K 上学到的东西迁移不到竞赛题，这和论文里 8B 的结论一致。`;
  } else if (metric === "format") {
    tone = " is-warn";
    narr = `AIME 上第一轮 500 步的格式率最高（${pct(e("base500").format)}），修正版只有 ${pct(e("fixed500").format)}。不是修正版格式变差：它保持长推理，大多数题在 512 token 的评测上限处被截断，</answer> 来不及写。第一轮格式好，只是因为它什么都写得短。`;
  } else {
    narr = `修正版在 AIME 上平均 ${e("fixed500").len.toFixed(0)} token，贴着 512 的上限；第一轮 ${e("base500").len.toFixed(0)}。要公平比 AIME，评测的 max_tokens 得提到 1024 以上。`;
  }

  return (
    <VisualizationFrame
      title="五个模型，三个评测集"
      description="同一个 Qwen2.5-3B-Instruct：不训练、SFT、第一轮 GRPO 的 200 步和 500 步、修正版 GRPO 500 步。评测温度 0.2，最多生成 512 token，答案按数值归一化后比对。"
      footnote="全部数字来自 RTX 3060 上的真实运行，评测集全量。第一轮 200 步那一行是从 checkpoint-200 重新评测的。"
    >
      <div className="viz-row">
        <Tabs options={DATASETS} value={ds} onChange={setDs} ariaLabel="评测集" />
        <div className="viz-chips" role="group" aria-label="指标">
          {METRICS.map((m) => (
            <button key={m.key} type="button" className={`viz-chip${metric === m.key ? " is-on" : ""}`} onClick={() => setMetric(m.key)}>{m.label}</button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>
      <Bars rows={rows} />
      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

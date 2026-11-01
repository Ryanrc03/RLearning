"use client";

import { useState } from "react";
import { useLang } from "@/components/i18n/LangProvider";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars, { type BarRow } from "@/components/visualization/ml/primitives/Bars";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import type { Lang } from "@/lib/i18n";
import { GRPO3060, MODEL_LABEL, type ModelKey } from "@/lib/ml/grpo3060";
import { MODEL_COLOR } from "./colors";

// Headline results of the 3060 project: five models × three eval sets, one
// metric at a time. The dataset tab is the primary control; the metric chips
// switch what the bars measure.

type Dataset = "gsm8k_test" | "aime2024" | "aime2025";
type Metric = "acc" | "format" | "len";
/** One model's results on the selected eval set. */
type Ev = (m: ModelKey) => (typeof GRPO3060.eval)[ModelKey][Dataset];

const DATASET_KEYS: Dataset[] = ["gsm8k_test", "aime2024", "aime2025"];
const METRIC_KEYS: Metric[] = ["acc", "format", "len"];
const ORDER: ModelKey[] = ["instruct", "sft", "base200", "base500", "fixed500"];
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const zh = {
  datasets: { gsm8k_test: "GSM8K test · 1,319 题", aime2024: "AIME 2024 · 30 题", aime2025: "AIME 2025 · 30 题" } as Record<Dataset, string>,
  metrics: { acc: "准确率", format: "完整格式率", len: "平均回答 token" } as Record<Metric, string>,
  title: "五个模型，三个评测集",
  description: "同一个 Qwen2.5-3B-Instruct：不训练、SFT、第一轮 GRPO 的 200 步和 500 步、修正版 GRPO 500 步。评测温度 0.2，最多生成 512 token，答案按数值归一化后比对。",
  footnote: "全部数字来自 RTX 3060 上的真实运行，评测集全量。第一轮 200 步那一行是从 checkpoint-200 重新评测的。",
  datasetAria: "评测集",
  metricAria: "指标",
  reset: "重置",
  gsmAcc: (e: Ev) => `修正版 500 步 ${pct(e("fixed500").acc)} 最高，比未训练高 ${((e("fixed500").acc - e("instruct").acc) * 100).toFixed(1)} 个点，比 SFT 高 ${((e("fixed500").acc - e("sft").acc) * 100).toFixed(1)} 个点。第一轮训满 500 步反而只有 ${pct(e("base500").acc)}，比不训还差；它在 200 步时其实到过 ${pct(e("base200").acc)}。`,
  gsmFormat: (e: Ev) => `未训练模型 ${pct(e("instruct").format)} 的回答格式完整，剩下的不是没写标签就是在 <answer> 里写整句话。训过的四个模型都在 98% 以上：格式是最容易学会的东西，所以也是最先被刷的东西。`,
  gsmLen: (e: Ev) => `第一轮 500 步平均只写 ${e("base500").len.toFixed(0)} token，修正版 ${e("fixed500").len.toFixed(0)}，几乎和未训练的 ${e("instruct").len.toFixed(0)} 一样长。SFT 的 ${e("sft").len.toFixed(0)} 是在模仿 GSM8K 金标的两行算式。`,
  aimeAcc: `AIME 上五个模型都接近 0：3B 的模型在 GSM8K 上学到的东西迁移不到竞赛题，这和论文里 8B 的结论一致。`,
  aimeFormat: (e: Ev) => `AIME 上第一轮 500 步的格式率最高（${pct(e("base500").format)}），修正版只有 ${pct(e("fixed500").format)}。不是修正版格式变差：它保持长推理，大多数题在 512 token 的评测上限处被截断，</answer> 来不及写。第一轮格式好，只是因为它什么都写得短。`,
  aimeLen: (e: Ev) => `修正版在 AIME 上平均 ${e("fixed500").len.toFixed(0)} token，贴着 512 的上限；第一轮 ${e("base500").len.toFixed(0)}。要公平比 AIME，评测的 max_tokens 得提到 1024 以上。`,
};

const COPY: Record<Lang, typeof zh> = {
  zh,
  en: {
    datasets: { gsm8k_test: "GSM8K test · 1,319 problems", aime2024: "AIME 2024 · 30 problems", aime2025: "AIME 2025 · 30 problems" },
    metrics: { acc: "Accuracy", format: "Format rate", len: "Mean response tokens" },
    title: "Five models, three eval sets",
    description: "The same Qwen2.5-3B-Instruct: untrained, SFT, the first GRPO run at 200 and 500 steps, and the fixed GRPO run at 500 steps. Evaluated at temperature 0.2 with at most 512 generated tokens; answers are compared after numeric normalization.",
    footnote: "Every number comes from real runs on an RTX 3060, on the full eval sets. The first run's 200-step row was re-evaluated from checkpoint-200.",
    datasetAria: "Eval set",
    metricAria: "Metric",
    reset: "Reset",
    gsmAcc: (e) => `The fixed run at 500 steps scores highest, ${pct(e("fixed500").acc)}: ${((e("fixed500").acc - e("instruct").acc) * 100).toFixed(1)} points above the untrained model and ${((e("fixed500").acc - e("sft").acc) * 100).toFixed(1)} points above SFT. The first run, trained the full 500 steps, reaches only ${pct(e("base500").acc)}, worse than not training at all; at step 200 it had actually reached ${pct(e("base200").acc)}.`,
    gsmFormat: (e) => `${pct(e("instruct").format)} of the untrained model's responses have a complete format; the rest either leave out the tags or write a whole sentence inside <answer>. All four trained models are above 98%: format is the easiest thing to learn, so it is also the first thing to get farmed.`,
    gsmLen: (e) => `At 500 steps the first run writes only ${e("base500").len.toFixed(0)} tokens on average; the fixed run writes ${e("fixed500").len.toFixed(0)}, almost as long as the untrained model's ${e("instruct").len.toFixed(0)}. SFT's ${e("sft").len.toFixed(0)} imitates the two-line arithmetic of the GSM8K gold solutions.`,
    aimeAcc: "All five models are near 0 on AIME: what a 3B model learns on GSM8K does not transfer to competition problems, consistent with the paper's finding for its 8B model.",
    aimeFormat: (e) => `On AIME the first run at 500 steps has the highest format rate (${pct(e("base500").format)}), and the fixed run only ${pct(e("fixed500").format)}. That is not the fixed run's format getting worse: it keeps reasoning at length, most problems get truncated at the 512-token evaluation limit, and </answer> never gets written. The first run's format looks good only because it writes everything short.`,
    aimeLen: (e) => `On AIME the fixed run averages ${e("fixed500").len.toFixed(0)} tokens, right up against the 512 limit; the first run averages ${e("base500").len.toFixed(0)}. For a fair AIME comparison, the eval's max_tokens has to go up to 1024 or more.`,
  },
};

export default function G3ResultsFigure() {
  const lang = useLang();
  const copy = COPY[lang];
  const datasets = DATASET_KEYS.map((key) => ({ key, label: copy.datasets[key] }));
  const [ds, setDs] = useState<Dataset>("gsm8k_test");
  const [metric, setMetric] = useState<Metric>("acc");
  const vals = ORDER.map((m) => GRPO3060.eval[m][ds][metric]);
  const max = metric === "len" ? 512 : 1;
  const rows: BarRow[] = ORDER.map((m, i) => ({
    label: MODEL_LABEL[m][lang],
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
    narr = copy.gsmAcc(e);
  } else if (ds === "gsm8k_test" && metric === "format") {
    narr = copy.gsmFormat(e);
  } else if (ds === "gsm8k_test") {
    tone = " is-warn";
    narr = copy.gsmLen(e);
  } else if (metric === "acc") {
    tone = " is-bad";
    narr = copy.aimeAcc;
  } else if (metric === "format") {
    tone = " is-warn";
    narr = copy.aimeFormat(e);
  } else {
    narr = copy.aimeLen(e);
  }

  return (
    <VisualizationFrame title={copy.title} description={copy.description} footnote={copy.footnote}>
      <div className="viz-row">
        <Tabs options={datasets} value={ds} onChange={setDs} ariaLabel={copy.datasetAria} />
        <div className="viz-chips" role="group" aria-label={copy.metricAria}>
          {METRIC_KEYS.map((key) => (
            <button key={key} type="button" className={`viz-chip${metric === key ? " is-on" : ""}`} onClick={() => setMetric(key)}>{copy.metrics[key]}</button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={reset}>{copy.reset}</button>
      </div>
      <Bars rows={rows} />
      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

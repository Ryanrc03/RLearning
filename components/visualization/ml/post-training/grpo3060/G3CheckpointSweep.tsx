"use client";

import { useState } from "react";
import { useLang } from "@/components/i18n/LangProvider";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import type { Lang } from "@/lib/i18n";
import { GRPO3060, peakCheckpoint, sweep, type RunKey, type SweepPoint } from "@/lib/ml/grpo3060";
import { MODEL_COLOR, RUN_COLOR } from "./colors";

// Every saved checkpoint of both runs, re-evaluated on the same 300 GSM8K test
// problems. Two buttons focus one run and dim the other; the reference lines
// are the untouched model and SFT on the same 300 problems.

const W = 720;
const H = 300;
type Focus = "all" | RunKey;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

/** Both sweeps, the fixed run's checkpoints from step 250 on, run 1's peak, and the two reference accuracies. */
type Sweeps = { base: SweepPoint[]; fixed: SweepPoint[]; fixedLate: SweepPoint[]; peak: SweepPoint; instAcc: number; sftAcc: number };

const zh = {
  narrBase: ({ base, peak }: Sweeps) => `第一轮：100 步 ${pct(base[0].acc)}，200 步到峰值 ${pct(peak.acc)}，之后一路掉到 500 步的 ${pct(base.at(-1)!.acc)}。右图同一时间回答从 ${base[0].len.toFixed(0)} token 缩到 ${base.at(-1)!.len.toFixed(0)}：长度跌破约 130 token 以后，准确率开始跟着掉。如果只留最后一个 checkpoint，会得出「GRPO 不如不训」的结论。`,
  narrFixed: ({ fixed, fixedLate }: Sweeps) => `修正版：50 步 ${pct(fixed[0].acc)}，250 步以后一直在 ${pct(Math.min(...fixedLate.map((p) => p.acc)))} 到 ${pct(Math.max(...fixedLate.map((p) => p.acc)))} 之间，最后 ${pct(fixed.at(-1)!.acc)}。回答长度全程在 ${Math.round(Math.min(...fixed.map((p) => p.len)))} 到 ${Math.round(Math.max(...fixed.map((p) => p.len)))} token。没有峰值，只有平台：什么时候停都不亏。`,
  narrAll: ({ instAcc, sftAcc }: Sweeps) => `同一批 300 道题上，未训练 ${pct(instAcc)}，SFT ${pct(sftAcc)}。两轮 GRPO 前 200 步走得差不多，分叉发生在 200 步以后：第一轮的长度继续往下掉，修正版停住了。点上面两个按钮分别看。`,
  title: "每个 checkpoint 重新评测：峰值，还是平台",
  description: "把两次运行存下的每个 checkpoint 拿出来，在 GSM8K test 的前 300 题上重新评测。第 0 步是未训练的模型。",
  footnote: "第一轮每 100 步存一次，修正版每 50 步存一次。虚线是同一 300 题上的参考：灰色未训练，绿色 SFT。",
  showBase: "看第一轮",
  showFixed: "看修正版",
  reset: "重置",
  figureLabel: ({ base, fixed, peak }: Sweeps) => `第一轮峰值在第 ${peak.step} 步 ${pct(peak.acc)}，500 步 ${pct(base.at(-1)!.acc)}；修正版 500 步 ${pct(fixed.at(-1)!.acc)}`,
  stepAxis: "checkpoint 步数",
  accuracyAxis: "准确率",
  accuracyTitle: "GSM8K 准确率（300 题）",
  untrainedRef: (acc: number) => `未训练 ${pct(acc)}`,
  peak: (acc: number) => `峰值 ${pct(acc)}`,
  lengthTitle: "平均回答长度",
  legendBase: "第一轮：β = 0，格式分和 correctness 一样重",
  legendFixed: "修正版：β = 0.04，Dr. GRPO，格式分减半并门控",
};

const COPY: Record<Lang, typeof zh> = {
  zh,
  en: {
    narrBase: ({ base, peak }) => `First run: ${pct(base[0].acc)} at step 100, a peak of ${pct(peak.acc)} at step 200, then all the way down to ${pct(base.at(-1)!.acc)} at step 500. Over the same span the right panel shows responses shrinking from ${base[0].len.toFixed(0)} tokens to ${base.at(-1)!.len.toFixed(0)}: once length drops below about 130 tokens, accuracy starts falling with it. Keep only the last checkpoint and you would conclude that GRPO is worse than not training.`,
    narrFixed: ({ fixed, fixedLate }) => `Fixed run: ${pct(fixed[0].acc)} at step 50; from step 250 on it stays between ${pct(Math.min(...fixedLate.map((p) => p.acc)))} and ${pct(Math.max(...fixedLate.map((p) => p.acc)))}, ending at ${pct(fixed.at(-1)!.acc)}. Response length stays between ${Math.round(Math.min(...fixed.map((p) => p.len)))} and ${Math.round(Math.max(...fixed.map((p) => p.len)))} tokens throughout. No peak, just a plateau: whenever you stop, you lose nothing.`,
    narrAll: ({ instAcc, sftAcc }) => `On the same 300 problems, the untrained model scores ${pct(instAcc)} and SFT ${pct(sftAcc)}. The two GRPO runs track each other for the first 200 steps and split after that: the first run's length keeps falling, while the fixed run's holds. Use the two buttons above to look at each run.`,
    title: "Re-evaluating every checkpoint: a peak, or a plateau",
    description: "Every checkpoint saved by the two runs, re-evaluated on the first 300 problems of GSM8K test. Step 0 is the untrained model.",
    footnote: "The first run saved a checkpoint every 100 steps, the fixed run every 50. The dashed lines are references on the same 300 problems: gray for the untrained model, green for SFT.",
    showBase: "Show first run",
    showFixed: "Show fixed run",
    reset: "Reset",
    figureLabel: ({ base, fixed, peak }) => `The first run peaks at step ${peak.step} with ${pct(peak.acc)} and ends at ${pct(base.at(-1)!.acc)} at step 500; the fixed run reaches ${pct(fixed.at(-1)!.acc)} at step 500`,
    stepAxis: "checkpoint step",
    accuracyAxis: "accuracy",
    accuracyTitle: "GSM8K accuracy (300 problems)",
    untrainedRef: (acc) => `untrained ${pct(acc)}`,
    peak: (acc) => `peak ${pct(acc)}`,
    lengthTitle: "Mean response length",
    legendBase: "First run: β = 0, format rewards as heavy as correctness",
    legendFixed: "Fixed run: β = 0.04, Dr. GRPO, format rewards halved and gated",
  },
};

export default function G3CheckpointSweep() {
  const copy = COPY[useLang()];
  const [focus, setFocus] = useState<Focus>("all");
  const [instAcc, instLen] = GRPO3060.sweepRefs.instruct;
  const [sftAcc] = GRPO3060.sweepRefs.sft;
  const runs: RunKey[] = ["base", "fixed"];
  const op = (r: RunKey) => (focus === "all" || focus === r ? 1 : 0.25);
  const pts = (r: RunKey, key: "acc" | "len") => [[0, key === "acc" ? instAcc : instLen] as const, ...sweep(r).map((p) => [p.step, p[key]] as const)];
  const peak = peakCheckpoint("base");
  const base = sweep("base");
  const fixed = sweep("fixed");
  const fixedLate = fixed.filter((p) => p.step >= 250);

  const sweeps: Sweeps = { base, fixed, fixedLate, peak, instAcc, sftAcc };

  const narr =
    focus === "base"
      ? { tone: " is-warn", text: copy.narrBase(sweeps) }
      : focus === "fixed"
        ? { tone: " is-good", text: copy.narrFixed(sweeps) }
        : { tone: "", text: copy.narrAll(sweeps) };

  return (
    <VisualizationFrame title={copy.title} description={copy.description} footnote={copy.footnote}>
      <div className="viz-row">
        <button type="button" className={`viz-btn${focus === "base" ? " is-on" : ""}`} onClick={() => setFocus("base")}>{copy.showBase}</button>
        <button type="button" className={`viz-btn${focus === "fixed" ? " is-on" : ""}`} onClick={() => setFocus("fixed")}>{copy.showFixed}</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("all")}>{copy.reset}</button>
      </div>
      <Figure width={W} height={H} label={copy.figureLabel(sweeps)}>
        <Plot box={{ x: 0, y: 0, w: W / 2, h: H }} xDomain={[0, 500]} yDomain={[0.55, 0.8]} xTicks={[0, 100, 200, 300, 400, 500]} yTicks={[0.55, 0.6, 0.65, 0.7, 0.75, 0.8]} xLabel={copy.stepAxis} yLabel={copy.accuracyAxis} title={copy.accuracyTitle} format={(t) => `${Math.round(t * 100)}%`} xFormat={(v) => String(v)}>
          {(f) => (
            <>
              <line x1={f.x0} x2={f.x1} y1={f.y(instAcc)} y2={f.y(instAcc)} stroke={MODEL_COLOR.instruct} strokeWidth={1.4} strokeDasharray="5 4" />
              <line x1={f.x0} x2={f.x1} y1={f.y(sftAcc)} y2={f.y(sftAcc)} stroke={MODEL_COLOR.sft} strokeWidth={1.4} strokeDasharray="5 4" />
              <text x={f.x1 - 4} y={f.y(sftAcc) - 5} fontSize={11} textAnchor="end" fill="#2f7d5a">SFT {pct(sftAcc)}</text>
              <text x={f.x1 - 4} y={f.y(instAcc) + 14} fontSize={11} textAnchor="end" fill="#76796f">{copy.untrainedRef(instAcc)}</text>
              {runs.map((r) => (
                <g key={r} opacity={op(r)} style={{ transition: "opacity .3s" }}>
                  <Curve frame={f} points={pts(r, "acc")} color={RUN_COLOR[r]} width={2} />
                  {pts(r, "acc").map(([x, y]) => (
                    <circle key={x} cx={f.x(x)} cy={f.y(y)} r={3.5} fill={RUN_COLOR[r]} stroke="#fff" strokeWidth={1.2} />
                  ))}
                </g>
              ))}
              <g opacity={op("base")}>
                <text x={f.x(peak.step)} y={f.y(peak.acc) - 9} fontSize={11} textAnchor="middle" fill="#30332c">{copy.peak(peak.acc)}</text>
              </g>
            </>
          )}
        </Plot>
        <Plot box={{ x: W / 2, y: 0, w: W / 2, h: H }} xDomain={[0, 500]} yDomain={[0, 300]} xTicks={[0, 100, 200, 300, 400, 500]} yTicks={[0, 100, 200, 300]} xLabel={copy.stepAxis} yLabel="token" title={copy.lengthTitle}>
          {(f) => (
            <>
              {runs.map((r) => (
                <g key={r} opacity={op(r)} style={{ transition: "opacity .3s" }}>
                  <Curve frame={f} points={pts(r, "len")} color={RUN_COLOR[r]} width={2} />
                  {pts(r, "len").map(([x, y]) => (
                    <circle key={x} cx={f.x(x)} cy={f.y(y)} r={3.5} fill={RUN_COLOR[r]} stroke="#fff" strokeWidth={1.2} />
                  ))}
                </g>
              ))}
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: RUN_COLOR.base }} />{copy.legendBase}</span>
        <span><i style={{ background: RUN_COLOR.fixed }} />{copy.legendFixed}</span>
      </div>
      <div className={`viz-narr${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

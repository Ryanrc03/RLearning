"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import { GRPO3060, peakCheckpoint, sweep, type RunKey } from "@/lib/ml/grpo3060";
import { MODEL_COLOR, RUN_COLOR } from "./colors";

// Every saved checkpoint of both runs, re-evaluated on the same 300 GSM8K test
// problems. Two buttons focus one run and dim the other; the reference lines
// are the untouched model and SFT on the same 300 problems.

const W = 720;
const H = 300;
type Focus = "all" | RunKey;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export default function G3CheckpointSweep() {
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

  const narr =
    focus === "base"
      ? { tone: " is-warn", text: `第一轮：100 步 ${pct(base[0].acc)}，200 步到峰值 ${pct(peak.acc)}，之后一路掉到 500 步的 ${pct(base.at(-1)!.acc)}。右图同一时间回答从 ${base[0].len.toFixed(0)} token 缩到 ${base.at(-1)!.len.toFixed(0)}：长度跌破约 130 token 以后，准确率开始跟着掉。如果只留最后一个 checkpoint，会得出「GRPO 不如不训」的结论。` }
      : focus === "fixed"
        ? { tone: " is-good", text: `修正版：50 步 ${pct(fixed[0].acc)}，250 步以后一直在 ${pct(Math.min(...fixedLate.map((p) => p.acc)))} 到 ${pct(Math.max(...fixedLate.map((p) => p.acc)))} 之间，最后 ${pct(fixed.at(-1)!.acc)}。回答长度全程在 ${Math.round(Math.min(...fixed.map((p) => p.len)))} 到 ${Math.round(Math.max(...fixed.map((p) => p.len)))} token。没有峰值，只有平台：什么时候停都不亏。` }
        : { tone: "", text: `同一批 300 道题上，未训练 ${pct(instAcc)}，SFT ${pct(sftAcc)}。两轮 GRPO 前 200 步走得差不多，分叉发生在 200 步以后：第一轮的长度继续往下掉，修正版停住了。点上面两个按钮分别看。` };

  return (
    <VisualizationFrame
      title="每个 checkpoint 重新评测：峰值，还是平台"
      description="把两次运行存下的每个 checkpoint 拿出来，在 GSM8K test 的前 300 题上重新评测。第 0 步是未训练的模型。"
      footnote="第一轮每 100 步存一次，修正版每 50 步存一次。虚线是同一 300 题上的参考：灰色未训练，绿色 SFT。"
    >
      <div className="viz-row">
        <button type="button" className={`viz-btn${focus === "base" ? " is-on" : ""}`} onClick={() => setFocus("base")}>看第一轮</button>
        <button type="button" className={`viz-btn${focus === "fixed" ? " is-on" : ""}`} onClick={() => setFocus("fixed")}>看修正版</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("all")}>重置</button>
      </div>
      <Figure width={W} height={H} label={`第一轮峰值在第 ${peak.step} 步 ${pct(peak.acc)}，500 步 ${pct(base.at(-1)!.acc)}；修正版 500 步 ${pct(fixed.at(-1)!.acc)}`}>
        <Plot box={{ x: 0, y: 0, w: W / 2, h: H }} xDomain={[0, 500]} yDomain={[0.55, 0.8]} xTicks={[0, 100, 200, 300, 400, 500]} yTicks={[0.55, 0.6, 0.65, 0.7, 0.75, 0.8]} xLabel="checkpoint 步数" yLabel="准确率" title="GSM8K 准确率（300 题）" format={(t) => `${Math.round(t * 100)}%`}>
          {(f) => (
            <>
              <line x1={f.x0} x2={f.x1} y1={f.y(instAcc)} y2={f.y(instAcc)} stroke={MODEL_COLOR.instruct} strokeWidth={1.4} strokeDasharray="5 4" />
              <line x1={f.x0} x2={f.x1} y1={f.y(sftAcc)} y2={f.y(sftAcc)} stroke={MODEL_COLOR.sft} strokeWidth={1.4} strokeDasharray="5 4" />
              <text x={f.x1 - 4} y={f.y(sftAcc) - 5} fontSize={11} textAnchor="end" fill="#2f7d5a">SFT {pct(sftAcc)}</text>
              <text x={f.x1 - 4} y={f.y(instAcc) + 14} fontSize={11} textAnchor="end" fill="#76796f">未训练 {pct(instAcc)}</text>
              {runs.map((r) => (
                <g key={r} opacity={op(r)} style={{ transition: "opacity .3s" }}>
                  <Curve frame={f} points={pts(r, "acc")} color={RUN_COLOR[r]} width={2} />
                  {pts(r, "acc").map(([x, y]) => (
                    <circle key={x} cx={f.x(x)} cy={f.y(y)} r={3.5} fill={RUN_COLOR[r]} stroke="#fff" strokeWidth={1.2} />
                  ))}
                </g>
              ))}
              <g opacity={op("base")}>
                <text x={f.x(peak.step)} y={f.y(peak.acc) - 9} fontSize={11} textAnchor="middle" fill="#30332c">峰值 {pct(peak.acc)}</text>
              </g>
            </>
          )}
        </Plot>
        <Plot box={{ x: W / 2, y: 0, w: W / 2, h: H }} xDomain={[0, 500]} yDomain={[0, 300]} xTicks={[0, 100, 200, 300, 400, 500]} yTicks={[0, 100, 200, 300]} xLabel="checkpoint 步数" yLabel="token" title="平均回答长度">
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
        <span><i style={{ background: RUN_COLOR.base }} />第一轮：β = 0，格式分和 correctness 一样重</span>
        <span><i style={{ background: RUN_COLOR.fixed }} />修正版：β = 0.04，Dr. GRPO，格式分减半并门控</span>
      </div>
      <div className={`viz-narr${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

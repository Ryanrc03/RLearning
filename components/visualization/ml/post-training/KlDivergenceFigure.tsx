"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import {
  MODEL_LABEL,
  bucketLabels,
  gsm8kAccuracy,
  gsm8kLength,
  lengthDistribution,
  lengthKl,
  lengthKlTerms,
  type Direction,
  type ModelKey,
} from "@/lib/ml/grpo3060";

// KL page of Post-training: real completion-length distributions from the 3060
// runs. Pick a trained model; its distribution is drawn over the untouched
// Instruct model's, and below each bucket the term p·ln(p/q) that the KL adds up.

const W = 720;
const H = 380;
const TOP_H = 220;
const REF_FILL = "#cfcab4";
const MODELS: { key: Exclude<ModelKey, "instruct">; label: string }[] = [
  { key: "base500", label: "第一轮 500 步（β = 0）" },
  { key: "base200", label: "第一轮 200 步" },
  { key: "fixed500", label: "修正版 500 步（β = 0.04）" },
  { key: "sft", label: "SFT" },
];
const DEFAULT_MODEL = "base500";
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

function niceMax(v: number): number {
  const steps = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 3];
  return steps.find((s) => s >= v) ?? Math.ceil(v);
}

export default function KlDivergenceFigure() {
  const [model, setModel] = useState<Exclude<ModelKey, "instruct">>(DEFAULT_MODEL);
  const [dir, setDir] = useState<Direction>("reverse");

  const labels = bucketLabels();
  const ref = lengthDistribution("instruct");
  const pol = lengthDistribution(model);
  const terms = lengthKlTerms(model, dir);
  const kl = lengthKl(model, dir);
  const termMax = niceMax(Math.max(...terms.map((t) => Math.abs(t))));
  const n = labels.length;
  const reset = () => {
    setModel(DEFAULT_MODEL);
    setDir("reverse");
  };

  const accRef = gsm8kAccuracy("instruct");
  const acc = gsm8kAccuracy(model);
  const lenRef = gsm8kLength("instruct");
  const len = gsm8kLength(model);
  const biggest = terms.indexOf(Math.max(...terms));
  // The narration always quotes the direction GRPO penalises, whichever chip is on.
  const revTerms = lengthKlTerms(model, "reverse");
  const revKl = lengthKl(model, "reverse");

  const narr: Record<typeof model, { tone: string; text: string }> = {
    base500: {
      tone: " is-bad",
      text: `第一轮训到 500 步：${pct(pol[1])} 的回答挤进 ${labels[1]} token 这一格，参考模型只有 ${(ref[1] * 100).toFixed(1)}% 在这里。在 KL(π ‖ π_ref) 里这一格单独贡献 ${revTerms[1].toFixed(2)} nats，总共 ${revKl.toFixed(2)}。β = 0 时训练从来没算过这个数，日志里的 kl 一直是 0；准确率 ${pct(accRef)} → ${pct(acc)}。`,
    },
    base200: {
      tone: " is-warn",
      text: `同一轮的 200 步 checkpoint：分布已经往短处挪了一半，KL ${kl.toFixed(2)}，但这时去掉的主要是废话，准确率反而是 ${pct(acc)}。漂移本身不一定是坏事，坏的是之后没人拉住它。`,
    },
    fixed500: {
      tone: " is-good",
      text: `修正版训到 500 步：两组柱子几乎重合，KL 只有 ${kl.toFixed(3)}，是第一轮的 1/${Math.round(lengthKl("base500", dir) / kl)}。平均 ${len.toFixed(0)} token，参考是 ${lenRef.toFixed(0)}；准确率 ${pct(acc)}。β·KL 让策略只在参考模型会写的回答里挑更对的。`,
    },
    sft: {
      tone: " is-warn",
      text: `SFT 也走得很远（KL ${kl.toFixed(2)}，平均 ${len.toFixed(0)} token），因为它在模仿 GSM8K 金标那种两行算式；准确率却从 ${pct(accRef)} 升到 ${pct(acc)}。KL 只量离参考多远，不量好坏：远离参考要有可信的理由，SFT 的理由是人写的示范。`,
    },
  };
  const dirNote =
    dir === "reverse"
      ? "KL(π ‖ π_ref)：按策略自己的概率加权，策略在参考很少去的格子里放了很多概率时罚得最重；GRPO 的 loss 用的是这个方向。"
      : `KL(π_ref ‖ π)：按参考的概率加权，参考常去、策略却不去的格子罚得最重；换个方向数值从 ${lengthKl(model, "reverse").toFixed(3)} 变成 ${kl.toFixed(3)}，KL 不对称。`;

  return (
    <VisualizationFrame
      title="KL 散度：训练后的回答长度分布离参考模型有多远"
      description="每个模型在 GSM8K test 1,319 题上的回答长度，按 token 数分成 8 格。灰色是未训练的 Instruct 模型（参考 π_ref），蓝色是选中的模型 π。下面一排是每一格对 KL 的贡献 p·ln(p/q)，加起来就是上面那个数。"
      footnote="数据来自 RTX 3060 上 Qwen2.5-3B-Instruct 的真实运行（4-bit + LoRA）。每格加 1 平滑后再算 KL，单位 nats。训练里的 KL 是逐 token 的，这里用回答长度分布来看同一件事：策略的行为离参考有多远。"
    >
      <div className="viz-row kl-controls">
        <Tabs options={MODELS} value={model} onChange={setModel} ariaLabel="选择模型" />
        <div className="viz-chips" role="group" aria-label="KL 的方向">
          <button type="button" className={`viz-chip${dir === "reverse" ? " is-on" : ""}`} onClick={() => setDir("reverse")}>KL(π ‖ π_ref)</button>
          <button type="button" className={`viz-chip${dir === "forward" ? " is-on" : ""}`} onClick={() => setDir("forward")}>KL(π_ref ‖ π)</button>
        </div>
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <Figure width={W} height={H} label={`${MODEL_LABEL[model].zh} 的回答长度分布与参考模型的 KL 为 ${kl.toFixed(3)} nats`}>
        <Plot box={{ x: 0, y: 0, w: W, h: TOP_H }} xDomain={[0, n]} yDomain={[0, 0.7]} xTicks={[]} yTicks={[0, 0.2, 0.4, 0.6]} yLabel="占比" title="回答长度分布（token）" format={(v) => `${Math.round(v * 100)}%`}>
          {(f) => (
            <>
              {labels.map((lab, i) => {
                const bw = (f.x(1) - f.x(0)) * 0.36;
                const cx = f.x(i + 0.5);
                return (
                  <g key={lab}>
                    <rect x={cx - bw - 1} y={f.y(ref[i])} width={bw} height={f.y0 - f.y(ref[i])} fill={REF_FILL} rx={2} style={{ transition: "y .3s, height .3s" }} />
                    <rect x={cx + 1} y={f.y(pol[i])} width={bw} height={f.y0 - f.y(pol[i])} fill="var(--v1)" rx={2} style={{ transition: "y .3s, height .3s" }} />
                    <text x={cx} y={f.y0 + 15} fontSize={11} textAnchor="middle" fill="#76796f">{lab}</text>
                    {i === biggest && dir === "reverse" && (
                      <text x={cx + 1 + bw / 2} y={f.y(pol[i]) - 6} fontSize={11} textAnchor="middle" fill="#30332c">{pct(pol[i])}</text>
                    )}
                  </g>
                );
              })}
            </>
          )}
        </Plot>
        <Plot box={{ x: 0, y: TOP_H, w: W, h: H - TOP_H }} xDomain={[0, n]} yDomain={[-termMax, termMax]} xTicks={[]} yTicks={[-termMax, 0, termMax]} yLabel="nats" title={`每一格的贡献 ${dir === "reverse" ? "p·ln(p/q)" : "q·ln(q/p)"}，合计 KL = ${kl.toFixed(3)}`} format={(v) => (Math.abs(v) < 1e-9 ? "0" : v.toFixed(termMax < 0.1 ? 2 : 1))}>
          {(f) => (
            <>
              <line x1={f.x0} x2={f.x1} y1={f.y(0)} y2={f.y(0)} stroke="#76796f" strokeWidth={1} />
              {terms.map((t, i) => {
                const bw = (f.x(1) - f.x(0)) * 0.5;
                const cx = f.x(i + 0.5);
                const top = Math.min(f.y(t), f.y(0));
                return (
                  <rect key={i} x={cx - bw / 2} y={top} width={bw} height={Math.abs(f.y(t) - f.y(0))} fill={t >= 0 ? "var(--v2)" : "#9a9c8d"} rx={2} style={{ transition: "y .3s, height .3s" }} />
                );
              })}
            </>
          )}
        </Plot>
      </Figure>

      <div className="viz-legend">
        <span><i style={{ background: REF_FILL }} />参考 π_ref：未训练的 Instruct</span>
        <span><i style={{ background: "var(--v1)" }} />选中的模型 π</span>
        <span><i style={{ background: "var(--v2)" }} />正贡献：这一格比参考多</span>
        <span><i style={{ background: "#9a9c8d" }} />负贡献：这一格比参考少</span>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>KL（nats）</small><b>{kl.toFixed(3)}</b></div>
        <div><small>平均回答长度</small><b>{len.toFixed(0)}</b><span className="delta">参考 {lenRef.toFixed(0)}</span></div>
        <div><small>GSM8K test 准确率</small><b>{pct(acc)}</b><span className="delta">参考 {pct(accRef)}</span></div>
      </div>

      <div className={`viz-narr${narr[model].tone}`}>
        {narr[model].text} <span className="viz-k">{dirNote}</span>
      </div>
    </VisualizationFrame>
  );
}

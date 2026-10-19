"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { HACK, simulateTraining, type RewardScheme, type TrainPoint } from "@/lib/ml/rewardHacking";

// Page 5 of Post-training: the same toy policy trained twice, once with the
// length bonus added straight onto correctness and once with it gated on a
// correct answer and capped. Drag the training step: the reward the training
// log shows rises in both runs, the held-out accuracy does not.

const W = 720;
const H = 300;
const DEFAULT_STEP = 60;
const SCHEMES: { key: RewardScheme; label: string; color: string; formula: string }[] = [
  { key: "additive", label: "长度奖励直接加", color: "var(--v2)", formula: "r = 1[对] + α·L" },
  { key: "gated", label: "门控在正确上 + 上限", color: "var(--v3)", formula: `r = 1[对]·(1 + α·min(L, ${HACK.cap}))` },
];
const LEN_MAX = 1.5 * HACK.maxLength;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export default function RewardHackingFigure() {
  const [step, setStep] = useState(DEFAULT_STEP);
  const runs = useMemo(() => ({ additive: simulateTraining("additive"), gated: simulateTraining("gated") }), []);
  const add = runs.additive;
  const gate = runs.gated;
  const peak = add.reduce((m, p) => (p.accuracy > m.accuracy ? p : m));
  const truncStep = add.find((p) => p.length > HACK.maxLength)?.step ?? HACK.steps + 1;
  const a = add[step];
  const gt = gate[step];
  const pts = (run: TrainPoint[], key: "reward" | "accuracy", upto: number = HACK.steps) => run.slice(0, upto + 1).map((p) => [p.step, p[key]] as const);

  const tone = step < peak.step ? "" : step < truncStep ? " is-warn" : " is-bad";
  const narr =
    step < peak.step
      ? `第 ${step} 步：两条路都在变好。回答从 ${HACK.startLength} token 写到 ${a.length.toFixed(0)} token，推理更充分，准确率真的在涨（直接加 ${pct(a.accuracy)}，门控 ${pct(gt.accuracy)}）。到这里长度奖励看起来是个好主意。`
      : step < truncStep
        ? `第 ${step} 步：「直接加」那一路开始堆字。平均 ${a.length.toFixed(0)} token，其中约 ${a.fillerTokens.toFixed(0)} 是有用长度之外的凑字；reward ${a.reward.toFixed(2)} 还在涨，准确率已经从第 ${peak.step} 步的峰值 ${pct(peak.accuracy)} 掉到 ${pct(a.accuracy)}。只看训练曲线，一切正常。`
        : `第 ${step} 步：「直接加」那一路想写 ${a.length.toFixed(0)} token，超过 ${HACK.maxLength} 的生成上限，最后一行答案被截掉：准确率 ${pct(a.accuracy)}，reward 却是全程最高的 ${a.reward.toFixed(2)}。门控那一路长度停在 ${gt.length.toFixed(0)} 附近，准确率 ${pct(gt.accuracy)}。`;

  return (
    <VisualizationFrame
      title="Reward hacking：reward 曲线在涨，准确率在跌"
      description="同一个玩具策略训练两次，只换奖励。它有两个旋钮：推理能力（难改）和回答长度（好改）。左边是训练日志里每步 64 个样本的平均 reward，右边是大 held-out 集上的真实准确率。"
    >
      <div className="viz-row rh-controls">
        <Slider label="训练步" value={step} min={0} max={HACK.steps} step={1} onChange={setStep} display={String(step)} id="rh-step" />
        <button type="button" className="viz-btn" onClick={() => setStep(DEFAULT_STEP)}>重置</button>
      </div>

      <Figure width={W} height={H} label={`第 ${step} 步：直接加 reward ${a.reward.toFixed(2)}、准确率 ${pct(a.accuracy)}；门控 reward ${gt.reward.toFixed(2)}、准确率 ${pct(gt.accuracy)}`}>
        <Plot box={{ x: 0, y: 0, w: W / 2, h: H }} xDomain={[0, HACK.steps]} yDomain={[0, 2]} xTicks={[0, 100, 200, 300]} yTicks={[0, 0.5, 1, 1.5, 2]} xLabel="训练步" yLabel="batch 平均 reward" title="训练时看得见的：reward">
          {(f) => (
            <>
              {SCHEMES.map((s) => (
                <g key={s.key}>
                  <Curve frame={f} points={pts(runs[s.key], "reward")} color={s.color} width={1.2} opacity={0.22} />
                  <Curve frame={f} points={pts(runs[s.key], "reward", step)} color={s.color} width={1.8} />
                </g>
              ))}
              <Marker frame={f} x={step} y={a.reward} color="var(--v2)" r={4} />
              <Marker frame={f} x={step} y={gt.reward} color="var(--v3)" r={4} />
            </>
          )}
        </Plot>
        <Plot box={{ x: W / 2, y: 0, w: W / 2, h: H }} xDomain={[0, HACK.steps]} yDomain={[0, 1]} xTicks={[0, 100, 200, 300]} yTicks={[0, 0.25, 0.5, 0.75, 1]} xLabel="训练步" yLabel="held-out 准确率" title="真正想要的：答对没有" format={(v) => pct(v)}>
          {(f) => (
            <>
              {SCHEMES.map((s) => (
                <g key={s.key}>
                  <Curve frame={f} points={pts(runs[s.key], "accuracy")} color={s.color} width={1.2} opacity={0.22} />
                  <Curve frame={f} points={pts(runs[s.key], "accuracy", step)} color={s.color} width={2} />
                </g>
              ))}
              {step >= peak.step && (
                <g>
                  <circle cx={f.x(peak.step)} cy={f.y(peak.accuracy)} r={3.5} fill="#fff" stroke="var(--v2)" strokeWidth={1.5} />
                  <text x={f.x(peak.step)} y={f.y(peak.accuracy) - 8} fontSize={11} textAnchor="middle" fill="#30332c">峰值 {pct(peak.accuracy)}</text>
                </g>
              )}
              <Marker frame={f} x={step} y={a.accuracy} color="var(--v2)" r={4} />
              <Marker frame={f} x={step} y={gt.accuracy} color="var(--v3)" r={4} />
            </>
          )}
        </Plot>
      </Figure>

      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5>第 {step} 步，一个平均回答长什么样</h5>
        <div className="rh-rows">
          {SCHEMES.map((s) => {
            const p = runs[s.key][step];
            return (
              <div className="rh-row" key={s.key}>
                <div>
                  <b style={{ color: s.color }}>{s.label}</b>
                  <small className="viz-mono">{s.formula}</small>
                </div>
                <div className="rh-len" aria-label={`${p.length.toFixed(0)} token，有用 ${p.usefulTokens.toFixed(0)}，凑字 ${p.fillerTokens.toFixed(0)}`}>
                  <div className="viz-stack">
                    <span style={{ width: `${(p.usefulTokens / LEN_MAX) * 100}%`, background: "var(--v1)", transition: "width .3s" }} />
                    {p.fillerTokens > 0 && <span style={{ width: `${(p.fillerTokens / LEN_MAX) * 100}%`, background: "var(--v4)", transition: "width .3s" }} />}
                  </div>
                  <i className="rh-limit" style={{ left: `${(HACK.maxLength / LEN_MAX) * 100}%` }} title={`生成上限 ${HACK.maxLength}`} />
                </div>
                <div className="viz-mono rh-nums">
                  {p.length.toFixed(0)} tok · r {p.reward.toFixed(2)} · acc {pct(p.accuracy)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="viz-legend">
          <span><i style={{ background: "var(--v1)" }} />有用推理（≤ {HACK.usefulLength} token）</span>
          <span><i style={{ background: "var(--v4)" }} />超出有用长度的凑字</span>
          <span><i style={{ background: "var(--vcrit)", width: 2 }} />生成上限 {HACK.maxLength} token，超过就被截断</span>
        </div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

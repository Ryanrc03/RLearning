"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/components/i18n/LangProvider";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import type { Lang } from "@/lib/i18n";
import { HACK, simulateTraining, type RewardScheme, type TrainPoint } from "@/lib/ml/rewardHacking";

// Page 5 of Post-training: the same toy policy trained twice, once with the
// length bonus added straight onto correctness and once with it gated on a
// correct answer and capped. Drag the training step: the reward the training
// log shows rises in both runs, the held-out accuracy does not.

const W = 720;
const H = 300;
const DEFAULT_STEP = 60;
const SCHEMES: { key: RewardScheme; color: string }[] = [
  { key: "additive", color: "var(--v2)" },
  { key: "gated", color: "var(--v3)" },
];
const LEN_MAX = 1.5 * HACK.maxLength;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

/** The step on the slider, both runs at that step, and the additive run's accuracy peak. */
type At = { step: number; a: TrainPoint; gt: TrainPoint; peak: TrainPoint };

const zh = {
  title: "Reward hacking：reward 曲线在涨，准确率在跌",
  description: "同一个玩具策略训练两次，只换奖励。它有两个旋钮：推理能力（难改）和回答长度（好改）。左边是训练日志里每步 64 个样本的平均 reward，右边是大 held-out 集上的真实准确率。",
  scheme: { additive: "长度奖励直接加", gated: "门控在正确上 + 上限" } as Record<RewardScheme, string>,
  formula: { additive: "r = 1[对] + α·L", gated: `r = 1[对]·(1 + α·min(L, ${HACK.cap}))` } as Record<RewardScheme, string>,
  stepSlider: "训练步",
  reset: "重置",
  figureLabel: ({ step, a, gt }: At) => `第 ${step} 步：直接加 reward ${a.reward.toFixed(2)}、准确率 ${pct(a.accuracy)}；门控 reward ${gt.reward.toFixed(2)}、准确率 ${pct(gt.accuracy)}`,
  stepAxis: "训练步",
  rewardAxis: "batch 平均 reward",
  rewardTitle: "训练时看得见的：reward",
  accuracyAxis: "held-out 准确率",
  accuracyTitle: "真正想要的：答对没有",
  peak: (acc: number) => `峰值 ${pct(acc)}`,
  rowsTitle: (step: number) => `第 ${step} 步，一个平均回答长什么样`,
  lengthAria: (p: TrainPoint) => `${p.length.toFixed(0)} token，有用 ${p.usefulTokens.toFixed(0)}，凑字 ${p.fillerTokens.toFixed(0)}`,
  limitTitle: (max: number) => `生成上限 ${max}`,
  usefulLegend: (n: number) => `有用推理（≤ ${n} token）`,
  fillerLegend: "超出有用长度的凑字",
  limitLegend: (max: number) => `生成上限 ${max} token，超过就被截断`,
  narrEarly: ({ step, a, gt }: At) => `第 ${step} 步：两条路都在变好。回答从 ${HACK.startLength} token 写到 ${a.length.toFixed(0)} token，推理更充分，准确率真的在涨（直接加 ${pct(a.accuracy)}，门控 ${pct(gt.accuracy)}）。到这里长度奖励看起来是个好主意。`,
  narrPadding: ({ step, a, peak }: At) => `第 ${step} 步：「直接加」那一路开始堆字。平均 ${a.length.toFixed(0)} token，其中约 ${a.fillerTokens.toFixed(0)} 是有用长度之外的凑字；reward ${a.reward.toFixed(2)} 还在涨，准确率已经从第 ${peak.step} 步的峰值 ${pct(peak.accuracy)} 掉到 ${pct(a.accuracy)}。只看训练曲线，一切正常。`,
  narrTruncated: ({ step, a, gt }: At) => `第 ${step} 步：「直接加」那一路想写 ${a.length.toFixed(0)} token，超过 ${HACK.maxLength} 的生成上限，最后一行答案被截掉：准确率 ${pct(a.accuracy)}，reward 却是全程最高的 ${a.reward.toFixed(2)}。门控那一路长度停在 ${gt.length.toFixed(0)} 附近，准确率 ${pct(gt.accuracy)}。`,
};

const COPY: Record<Lang, typeof zh> = {
  zh,
  en: {
    title: "Reward hacking: the reward curve rises while accuracy falls",
    description: "The same toy policy trained twice, changing only the reward. It has two knobs: reasoning ability (hard to change) and response length (easy to change). The left panel is the mean reward over each step's 64 samples, as the training log shows it; the right panel is the true accuracy on a large held-out set.",
    scheme: { additive: "Additive length reward", gated: "Gated on correctness + cap" },
    formula: { additive: "r = 1[correct] + α·L", gated: `r = 1[correct]·(1 + α·min(L, ${HACK.cap}))` },
    stepSlider: "Training step",
    reset: "Reset",
    figureLabel: ({ step, a, gt }) => `Step ${step}: additive reward ${a.reward.toFixed(2)}, accuracy ${pct(a.accuracy)}; gated reward ${gt.reward.toFixed(2)}, accuracy ${pct(gt.accuracy)}`,
    stepAxis: "training step",
    rewardAxis: "batch mean reward",
    rewardTitle: "What training sees: reward",
    accuracyAxis: "held-out accuracy",
    accuracyTitle: "What we actually want: correct answers",
    peak: (acc) => `peak ${pct(acc)}`,
    rowsTitle: (step) => `Step ${step}: what an average response looks like`,
    lengthAria: (p) => `${p.length.toFixed(0)} tokens, ${p.usefulTokens.toFixed(0)} useful, ${p.fillerTokens.toFixed(0)} filler`,
    limitTitle: (max) => `Generation limit ${max}`,
    usefulLegend: (n) => `Useful reasoning (≤ ${n} tokens)`,
    fillerLegend: "Filler beyond the useful length",
    limitLegend: (max) => `Generation limit of ${max} tokens; anything longer is truncated`,
    narrEarly: ({ step, a, gt }) => `Step ${step}: both paths are improving. Responses grow from ${HACK.startLength} to ${a.length.toFixed(0)} tokens, the reasoning gets fuller, and accuracy really is rising (additive ${pct(a.accuracy)}, gated ${pct(gt.accuracy)}). So far a length reward looks like a good idea.`,
    narrPadding: ({ step, a, peak }) => `Step ${step}: the “additive” path starts padding. Responses average ${a.length.toFixed(0)} tokens, about ${a.fillerTokens.toFixed(0)} of them filler beyond the useful length; the reward, ${a.reward.toFixed(2)}, is still rising, but accuracy has already fallen from its peak of ${pct(peak.accuracy)} at step ${peak.step} to ${pct(a.accuracy)}. Judging by the training curve alone, everything looks fine.`,
    narrTruncated: ({ step, a, gt }) => `Step ${step}: the “additive” path wants to write ${a.length.toFixed(0)} tokens, past the ${HACK.maxLength}-token generation limit, so the final answer line gets cut off: accuracy ${pct(a.accuracy)}, while the reward is the highest of the whole run at ${a.reward.toFixed(2)}. The gated path's length settles near ${gt.length.toFixed(0)}, with accuracy ${pct(gt.accuracy)}.`,
  },
};

export default function RewardHackingFigure() {
  const copy = COPY[useLang()];
  const [step, setStep] = useState(DEFAULT_STEP);
  const runs = useMemo(() => ({ additive: simulateTraining("additive"), gated: simulateTraining("gated") }), []);
  const add = runs.additive;
  const gate = runs.gated;
  const peak = add.reduce((m, p) => (p.accuracy > m.accuracy ? p : m));
  const truncStep = add.find((p) => p.length > HACK.maxLength)?.step ?? HACK.steps + 1;
  const a = add[step];
  const gt = gate[step];
  const pts = (run: TrainPoint[], key: "reward" | "accuracy", upto: number = HACK.steps) => run.slice(0, upto + 1).map((p) => [p.step, p[key]] as const);

  const at: At = { step, a, gt, peak };
  const tone = step < peak.step ? "" : step < truncStep ? " is-warn" : " is-bad";
  const narr = step < peak.step ? copy.narrEarly(at) : step < truncStep ? copy.narrPadding(at) : copy.narrTruncated(at);

  return (
    <VisualizationFrame title={copy.title} description={copy.description}>
      <div className="viz-row rh-controls">
        <Slider label={copy.stepSlider} value={step} min={0} max={HACK.steps} step={1} onChange={setStep} display={String(step)} id="rh-step" />
        <button type="button" className="viz-btn" onClick={() => setStep(DEFAULT_STEP)}>{copy.reset}</button>
      </div>

      <Figure width={W} height={H} label={copy.figureLabel(at)}>
        <Plot box={{ x: 0, y: 0, w: W / 2, h: H }} xDomain={[0, HACK.steps]} yDomain={[0, 2]} xTicks={[0, 100, 200, 300]} yTicks={[0, 0.5, 1, 1.5, 2]} xLabel={copy.stepAxis} yLabel={copy.rewardAxis} title={copy.rewardTitle}>
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
        <Plot box={{ x: W / 2, y: 0, w: W / 2, h: H }} xDomain={[0, HACK.steps]} yDomain={[0, 1]} xTicks={[0, 100, 200, 300]} yTicks={[0, 0.25, 0.5, 0.75, 1]} xLabel={copy.stepAxis} yLabel={copy.accuracyAxis} title={copy.accuracyTitle} format={(v) => pct(v)}>
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
                  <text x={f.x(peak.step)} y={f.y(peak.accuracy) - 8} fontSize={11} textAnchor="middle" fill="#30332c">{copy.peak(peak.accuracy)}</text>
                </g>
              )}
              <Marker frame={f} x={step} y={a.accuracy} color="var(--v2)" r={4} />
              <Marker frame={f} x={step} y={gt.accuracy} color="var(--v3)" r={4} />
            </>
          )}
        </Plot>
      </Figure>

      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5>{copy.rowsTitle(step)}</h5>
        <div className="rh-rows">
          {SCHEMES.map((s) => {
            const p = runs[s.key][step];
            return (
              <div className="rh-row" key={s.key}>
                <div>
                  <b style={{ color: s.color }}>{copy.scheme[s.key]}</b>
                  <small className="viz-mono">{copy.formula[s.key]}</small>
                </div>
                <div className="rh-len" aria-label={copy.lengthAria(p)}>
                  <div className="viz-stack">
                    <span style={{ width: `${(p.usefulTokens / LEN_MAX) * 100}%`, background: "var(--v1)", transition: "width .3s" }} />
                    {p.fillerTokens > 0 && <span style={{ width: `${(p.fillerTokens / LEN_MAX) * 100}%`, background: "var(--v4)", transition: "width .3s" }} />}
                  </div>
                  <i className="rh-limit" style={{ left: `${(HACK.maxLength / LEN_MAX) * 100}%` }} title={copy.limitTitle(HACK.maxLength)} />
                </div>
                <div className="viz-mono rh-nums">
                  {p.length.toFixed(0)} tok · r {p.reward.toFixed(2)} · acc {pct(p.accuracy)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="viz-legend">
          <span><i style={{ background: "var(--v1)" }} />{copy.usefulLegend(HACK.usefulLength)}</span>
          <span><i style={{ background: "var(--v4)" }} />{copy.fillerLegend}</span>
          <span><i style={{ background: "var(--vcrit)", width: 2 }} />{copy.limitLegend(HACK.maxLength)}</span>
        </div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

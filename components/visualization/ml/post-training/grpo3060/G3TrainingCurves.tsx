"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot, { type PlotFrame } from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { BINS, GRPO3060, RUN_LABEL, series, smoothedAt, smoothedSeries, type RunKey } from "@/lib/ml/grpo3060";
import { CURVE_COLOR } from "./colors";

// The real training logs of both runs, averaged per 10 steps. Drag the step:
// the cursor runs through three panels (where the reward comes from, answer
// length, per-token KL). The other run is drawn faint for comparison.

const W = 720;
const H = 400;
const TOP = 210;
const RUNS: { key: RunKey; label: string }[] = [
  { key: "base", label: "第一轮：β = 0" },
  { key: "fixed", label: "修正版：β = 0.04 + 三处修改" },
];
const DEFAULT_BIN = BINS - 1;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

function Cursor({ f, step }: { f: PlotFrame; step: number }) {
  return <line x1={f.x(step)} x2={f.x(step)} y1={f.y1} y2={f.y0} stroke="#3b4234" strokeWidth={1} strokeDasharray="3 3" opacity={0.55} />;
}

export default function G3TrainingCurves() {
  const [run, setRun] = useState<RunKey>("base");
  const [bin, setBin] = useState(DEFAULT_BIN);
  const other: RunKey = run === "base" ? "fixed" : "base";
  const step = GRPO3060.curves[run].step[bin];
  // Every readout is the trailing 50-step mean: one 10-step bin is only 10 problems.
  const v = (k: Parameters<typeof smoothedAt>[1], r: RunKey = run) => smoothedAt(r, k, bin);
  const reset = () => {
    setRun("base");
    setBin(DEFAULT_BIN);
  };

  const acc = v("correct") / 2;
  const startAcc = smoothedAt(run, "correct", 4) / 2; // first 50 steps
  const startLen = smoothedAt(run, "len", 4);
  const vsStart = acc - startAcc > 0.04 ? `比前 50 步的 ${pct(startAcc)} 还高` : acc - startAcc < -0.04 ? `比前 50 步的 ${pct(startAcc)} 低` : `和前 50 步的 ${pct(startAcc)} 持平`;
  let tone = "";
  let narr: string;
  if (step < 100) {
    narr = `第 ${step} 步：刚开始，回答 ${v("len").toFixed(0)} token，batch 准确率 ${pct(acc)}，格式分 ${v("format").toFixed(2)}。前 100 步两轮还看不出差别；往后拖。`;
  } else if (run === "base") {
    if (step <= 250) {
      narr = `第 ${step} 步：回答从前 50 步的 ${startLen.toFixed(0)} token 缩到 ${v("len").toFixed(0)}，先去掉的是废话，batch 准确率 ${pct(acc)}，${vsStart}。格式分已经涨到 ${v("format").toFixed(2)}，正在追上 correctness。`;
    } else if (step <= 380) {
      tone = " is-warn";
      narr = `第 ${step} 步：回答跌破 130 token（现在 ${v("len").toFixed(0)}），int 和 xml count 两项几乎吃满，格式分 ${v("format").toFixed(2)}。准确率开始往下走（${pct(acc)}），总 reward ${v("reward").toFixed(2)} 还在高位。只看总 reward，看不出任何问题。`;
    } else {
      tone = " is-bad";
      narr = `第 ${step} 步：回答只剩 ${v("len").toFixed(0)} token，batch 准确率 ${pct(acc)}，${vsStart}；总 reward ${v("reward").toFixed(2)} 却比开头高。右下的 KL 一直是 0：β = 0 时训练根本不算它，那条平线是没测，不是没漂。`;
    }
  } else if (step >= 160 && step <= 210) {
    tone = " is-warn";
    narr = `第 ${step} 步：修正版的低谷。batch 准确率掉到 ${pct(acc)}，回答反而变长到 ${v("len").toFixed(0)} token。两轮按同一顺序采题，第一轮在这一段也从 81% 掉到 75%，后来的四组实验也都掉：是这一段的训练题更难、要写得更长，修正版掉得最深；210 步以后恢复。`;
  } else {
    tone = step >= 250 && acc - startAcc >= -0.04 ? " is-good" : "";
    narr = `第 ${step} 步：回答 ${v("len").toFixed(0)} token，batch 准确率 ${pct(acc)}，${vsStart}。格式分减半又门控在 ≥ 30 词的推理上，只涨到 ${v("format").toFixed(2)}；逐 token 的 KL ${v("kl").toFixed(4)}，慢慢涨，被 β 罚着。淡色线是第一轮。`;
  }

  return (
    <VisualizationFrame
      title="训练日志：总 reward 涨了，涨的是哪一部分"
      description="两次运行的真实训练日志。细线是每 10 步的平均，粗线是最近 50 步的滑动平均（每步只有 1 道题，10 步只有 10 道题，噪声很大）。上图拆开总 reward：蓝色 correctness（答对得 2 分），橙色四项格式分之和；下面是回答长度和逐 token 的 KL(π_θ ‖ π_ref)。"
      footnote="修正版的格式分权重是第一轮的一半，所以两条橙线的绝对值不能直接比。batch 准确率 = correctness 奖励 / 2，下面的读数都是最近 50 步的平均。"
    >
      <div className="viz-row g3-controls">
        <Tabs options={RUNS} value={run} onChange={setRun} ariaLabel="选择运行" />
        <Slider label="训练步" value={bin} min={0} max={BINS - 1} step={1} onChange={setBin} display={String(step)} id="g3-step" />
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <Figure width={W} height={H} label={`${RUN_LABEL[run]} 第 ${step} 步：correctness ${v("correct").toFixed(2)}，格式分 ${v("format").toFixed(2)}，长度 ${v("len").toFixed(0)}`}>
        <Plot box={{ x: 0, y: 0, w: W, h: TOP }} xDomain={[0, 500]} yDomain={[-0.6, 2.8]} xTicks={[0, 100, 200, 300, 400, 500]} yTicks={[-0.5, 0, 0.5, 1, 1.5, 2, 2.5]} yLabel="奖励" title="奖励从哪来">
          {(f) => (
            <>
              <line x1={f.x0} x2={f.x1} y1={f.y(0)} y2={f.y(0)} stroke="#76796f" strokeWidth={0.8} />
              {(["correct", "format"] as const).map((k) => (
                <Curve key={`o${k}`} frame={f} points={smoothedSeries(other, k)} color={CURVE_COLOR[k]} width={1} opacity={0.2} />
              ))}
              <Curve frame={f} points={smoothedSeries(run, "reward")} color={CURVE_COLOR.reward} width={1.2} opacity={0.55} />
              {(["correct", "format"] as const).map((k) => (
                <g key={k}>
                  <Curve frame={f} points={series(run, k)} color={CURVE_COLOR[k]} width={1} opacity={0.3} />
                  <Curve frame={f} points={smoothedSeries(run, k)} color={CURVE_COLOR[k]} width={2.2} />
                </g>
              ))}
              <Cursor f={f} step={step} />
              <Marker frame={f} x={step} y={v("correct")} color={CURVE_COLOR.correct} r={4} />
              <Marker frame={f} x={step} y={v("format")} color={CURVE_COLOR.format} r={4} />
            </>
          )}
        </Plot>
        <Plot box={{ x: 0, y: TOP, w: W / 2, h: H - TOP }} xDomain={[0, 500]} yDomain={[0, 450]} xTicks={[0, 250, 500]} yTicks={[0, 150, 300, 450]} xLabel="训练步" yLabel="token" title="平均回答长度">
          {(f) => (
            <>
              <Curve frame={f} points={smoothedSeries(other, "len")} color={CURVE_COLOR.len} width={1} opacity={0.2} />
              <Curve frame={f} points={series(run, "len")} color={CURVE_COLOR.len} width={1} opacity={0.3} />
              <Curve frame={f} points={smoothedSeries(run, "len")} color={CURVE_COLOR.len} width={2.2} />
              <Cursor f={f} step={step} />
              <Marker frame={f} x={step} y={v("len")} color={CURVE_COLOR.len} r={4} />
            </>
          )}
        </Plot>
        <Plot box={{ x: W / 2, y: TOP, w: W / 2, h: H - TOP }} xDomain={[0, 500]} yDomain={[0, 0.02]} xTicks={[0, 250, 500]} yTicks={[0, 0.005, 0.01, 0.015, 0.02]} xLabel="训练步" title="逐 token KL(π_θ ‖ π_ref)" format={(t) => (t === 0 ? "0" : t < 1 ? t.toFixed(3) : String(t))}>
          {(f) => (
            <>
              <Curve frame={f} points={smoothedSeries(other, "kl")} color={CURVE_COLOR.kl} width={1} opacity={0.25} />
              <Curve frame={f} points={series(run, "kl")} color={CURVE_COLOR.kl} width={2} />
              {run === "base" && (
                <text x={(f.x0 + f.x1) / 2} y={f.y(0.008)} fontSize={11.5} textAnchor="middle" fill="#b23a3a">β = 0：没算，不是 0 漂移</text>
              )}
              <Cursor f={f} step={step} />
              <Marker frame={f} x={step} y={v("kl")} color={CURVE_COLOR.kl} r={4} />
            </>
          )}
        </Plot>
      </Figure>

      <div className="viz-legend">
        <span><i style={{ background: CURVE_COLOR.correct }} />correctness（满分 2）</span>
        <span><i style={{ background: CURVE_COLOR.format }} />格式分之和：int + strict + soft + xml count</span>
        <span><i style={{ background: CURVE_COLOR.reward }} />总 reward</span>
        <span><i style={{ background: CURVE_COLOR.len }} />回答长度</span>
        <span><i style={{ background: CURVE_COLOR.kl }} />KL</span>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>batch 准确率（近 50 步）</small><b>{pct(acc)}</b><span className="delta">前 50 步 {pct(startAcc)}</span></div>
        <div><small>格式分之和</small><b>{v("format").toFixed(2)}</b></div>
        <div><small>总 reward</small><b>{v("reward").toFixed(2)}</b></div>
        <div><small>回答长度</small><b>{v("len").toFixed(0)}</b></div>
        <div><small>KL / token</small><b>{v("kl").toFixed(4)}</b></div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

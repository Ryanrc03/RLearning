"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { didEstimate, didRegression } from "@/lib/ml/causal";

// Page 3 of Causal Inference. A feature ships in Shanghai only; Beijing is the
// control. Shanghai always sits higher (permanent gap), a holiday month moves
// everyone (the slider), and the feature adds +3 minutes. DiD subtracts both
// nuisances; the second scenario gives Shanghai an extra trend of its own and
// the estimate absorbs it one for one.

type Scene = "parallel" | "diverge";
const SCENES: { key: Scene; label: string }[] = [
  { key: "parallel", label: "平行趋势成立" },
  { key: "diverge", label: "上海本来就涨得快" },
];
const SH_BEFORE = 30;
const BJ_BEFORE = 24;
const EFFECT = 3;
const EXTRA = 2.5;
const TREND_MIN = -6;
const TREND_STEP = 0.5;
const TREND_STEPS = 24;
const DEFAULT_IDX = Math.round((4 - TREND_MIN) / TREND_STEP);
const Y_DOMAIN: [number, number] = [14, 44];
const C_SH = "#2a78d6";
const C_BJ = "#76796f";
const C_EFF = "#1baf7a";
const C_BAD = "#d03b3b";

const f1 = (x: number) => x.toFixed(1);
const signed = (x: number) => `${x < 0 ? "−" : "+"}${Math.abs(x).toFixed(1)}`;

export default function DidFigure() {
  const [scene, setScene] = useState<Scene>("parallel");
  const [idx, setIdx] = useState(DEFAULT_IDX);
  const trend = TREND_MIN + idx * TREND_STEP;
  const extra = scene === "diverge" ? EXTRA : 0;

  const r = useMemo(() => {
    const cells = { treatBefore: SH_BEFORE, treatAfter: SH_BEFORE + trend + extra + EFFECT, ctrlBefore: BJ_BEFORE, ctrlAfter: BJ_BEFORE + trend };
    const est = didEstimate(cells);
    const reg = didRegression([
      { treated: 1, post: 0, y: cells.treatBefore },
      { treated: 1, post: 1, y: cells.treatAfter },
      { treated: 0, post: 0, y: cells.ctrlBefore },
      { treated: 0, post: 1, y: cells.ctrlAfter },
    ]);
    return { cells, est, reg };
  }, [trend, extra]);

  const { cells, est, reg } = r;
  const biased = Math.abs(est.did - EFFECT) > 1e-9;
  const narr = biased
    ? `上海除了功能的 +${EFFECT}，这个月自己还多涨了 ${f1(EXTRA)} 分钟（比如本地有活动），北京没有。北京的变化 ${signed(est.controlTrend)} 只能替上海减掉共同的那部分，DiD = ${signed(est.did)}：平行趋势不成立时，上海自己多出来的 ${f1(EXTRA)} 被 DiD 当成了功能的效果。`
    : `只比上海前后得 ${signed(est.beforeAfter)}，把这个月所有人的变化 ${signed(trend)} 也算进去了；只比两城事后得 ${signed(est.crossSection)}，把上海本来就比北京高的 ${f1(SH_BEFORE - BJ_BEFORE)} 也算进去了。北京前后 ${signed(est.controlTrend)} 替上海说出了「没上功能本来会怎样」，减掉它，DiD = ${signed(est.did)}，正好是真实效应 +${EFFECT}。拖滑块，前后对比跟着动，DiD 不动。`;

  return (
    <VisualizationFrame
      title="双重差分：减掉时间趋势，再减掉两组本来的差距"
      description="一个功能只在上海上线，北京做对照；纵轴是人均日使用时长（分钟，模拟数据）。虚线是上海「没上功能本来会走到哪」，由北京的变化平移得到；绿色那一段就是 DiD。"
    >
      <div className="viz-row">
        <Tabs options={SCENES} value={scene} onChange={setScene} ariaLabel="情景" />
        <button type="button" className="viz-btn" onClick={() => { setScene("parallel"); setIdx(DEFAULT_IDX); }}>重置</button>
      </div>
      <Slider label="共同时间趋势（这个月所有人都发生的事，分钟）" value={idx} min={0} max={TREND_STEPS} step={1} onChange={setIdx} display={signed(trend)} id="did-trend" />

      <Figure width={720} height={320} label={`共同趋势 ${signed(trend)}，上海前后 ${signed(est.beforeAfter)}，北京前后 ${signed(est.controlTrend)}，DiD ${signed(est.did)}`} minWidth={520}>
        <Plot box={{ x: 0, y: 0, w: 430, h: 320 }} xDomain={[-0.25, 1.65]} yDomain={Y_DOMAIN} xTicks={[0, 1]} yTicks={[15, 20, 25, 30, 35, 40]} xFormat={(v) => (v === 0 ? "上线前一个月" : "上线后一个月")} yLabel="人均日使用时长 (分钟)" format={(v) => String(Math.round(v))}>
          {(f) => {
            const sh0 = f.y(cells.treatBefore);
            const sh1 = f.y(cells.treatAfter);
            const bj0 = f.y(cells.ctrlBefore);
            const bj1 = f.y(cells.ctrlAfter);
            const cf1 = f.y(est.counterfactual);
            const xb = f.x(1) + 14;
            return (
              <>
                <line x1={f.x(0)} y1={bj0} x2={f.x(1)} y2={bj1} stroke={C_BJ} strokeWidth={2.2} style={{ transition: "y2 .3s" }} />
                <line x1={f.x(0)} y1={sh0} x2={f.x(1)} y2={cf1} stroke={C_SH} strokeWidth={1.6} strokeDasharray="6 4" opacity={0.7} style={{ transition: "y2 .3s" }} />
                <line x1={f.x(0)} y1={sh0} x2={f.x(1)} y2={sh1} stroke={C_SH} strokeWidth={2.2} style={{ transition: "y2 .3s" }} />
                {[
                  { x: 0, y: sh0, c: C_SH, t: f1(cells.treatBefore), dx: -9, dy: 4, anchor: "end" as const },
                  { x: 1, y: sh1, c: C_SH, t: f1(cells.treatAfter), dx: 0, dy: -10, anchor: "middle" as const },
                  { x: 0, y: bj0, c: C_BJ, t: f1(cells.ctrlBefore), dx: -9, dy: 4, anchor: "end" as const },
                  { x: 1, y: bj1, c: C_BJ, t: f1(cells.ctrlAfter), dx: 0, dy: 17, anchor: "middle" as const },
                ].map((p, i) => (
                  <g key={i} style={{ transition: "transform .3s" }} transform={`translate(${f.x(p.x)} ${p.y})`}>
                    <circle r={5} fill={p.c} stroke="#fff" strokeWidth={1.5} />
                    <text x={p.dx} y={p.dy} fontSize={11.5} fontWeight={600} textAnchor={p.anchor} fill={p.c} className="mono">{p.t}</text>
                  </g>
                ))}
                <g style={{ transition: "transform .3s" }} transform={`translate(${f.x(1)} ${cf1})`}>
                  <circle r={4} fill="#fff" stroke={C_SH} strokeWidth={1.5} strokeDasharray="2 2" />
                  <text x={9} y={4} fontSize={11} fill={C_SH} opacity={0.8} className="mono">反事实 {f1(est.counterfactual)}</text>
                </g>
                <g style={{ transition: "transform .3s" }}>
                  <line x1={xb + 86} y1={sh1} x2={xb + 86} y2={cf1} stroke={biased ? C_BAD : C_EFF} strokeWidth={2.5} style={{ transition: "y1 .3s, y2 .3s" }} />
                  <line x1={xb + 80} y1={sh1} x2={xb + 92} y2={sh1} stroke={biased ? C_BAD : C_EFF} strokeWidth={2} style={{ transition: "y1 .3s, y2 .3s" }} />
                  <line x1={xb + 80} y1={cf1} x2={xb + 92} y2={cf1} stroke={biased ? C_BAD : C_EFF} strokeWidth={2} style={{ transition: "y1 .3s, y2 .3s" }} />
                  <text x={xb + 98} y={(sh1 + cf1) / 2 - 2} fontSize={12} fontWeight={700} fill={biased ? C_BAD : C_EFF} className="mono" style={{ transition: "y .3s" }}>DiD</text>
                  <text x={xb + 98} y={(sh1 + cf1) / 2 + 12} fontSize={12} fontWeight={700} fill={biased ? C_BAD : C_EFF} className="mono" style={{ transition: "y .3s" }}>{signed(est.did)}</text>
                </g>
                <text x={f.x(0)} y={sh0 - 14} fontSize={12} textAnchor="middle" fill={C_SH} fontWeight={600} style={{ transition: "y .3s" }}>上海（上线）</text>
                <text x={f.x(0)} y={bj0 + 22} fontSize={12} textAnchor="middle" fill={C_BJ} fontWeight={600}>北京（对照）</text>
              </>
            );
          }}
        </Plot>

        <g transform="translate(455 0)">
          <text x={0} y={22} fontSize={12.5} fontWeight={600} fill="#30332c">三种算法，同一张图</text>
          {[
            ["只比上海前后", est.beforeAfter, trend !== 0 ? `多算了放假 ${signed(trend)}` : "这次碰巧对"],
            ["只比两城事后", est.crossSection, `多算了城市差距 ${signed(SH_BEFORE - BJ_BEFORE)}`],
            ["北京的变化", est.controlTrend, "替上海估「本来会怎样」"],
            ["双重差分", est.did, biased ? `真实效应 +${EFFECT}，多出 ${signed(est.did - EFFECT)}` : `真实效应 +${EFFECT}`],
          ].map(([k, v, hint], i) => (
            <g key={k as string} transform={`translate(0 ${48 + i * 50})`}>
              <text x={0} y={0} fontSize={11.5} fill="#76796f">{k as string}</text>
              <text x={250} y={0} fontSize={14} fontWeight={700} textAnchor="end" fill={i === 3 ? (biased ? C_BAD : C_EFF) : "#30332c"} className="mono">{signed(v as number)}</text>
              <text x={0} y={16} fontSize={10.5} fill="#9a9a90">{hint as string}</text>
              <line x1={0} y1={26} x2={250} y2={26} stroke="#e4dfcb" />
            </g>
          ))}
          <text x={0} y={262} fontSize={11.5} fill="#76796f">回归写法：y = β₀ + β₁·上海 + β₂·上线后 + β₃·上海×上线后</text>
          <text x={0} y={282} fontSize={11.5} fill="#30332c" className="mono">β₀ {f1(reg.b0)}  β₁ {signed(reg.b1)}  β₂ {signed(reg.b2)}  β₃ {signed(reg.b3)}</text>
          <text x={0} y={300} fontSize={10.5} fill="#9a9a90">β₃ 就是 DiD：四个格子用 β 写出来，交叉项只在「上海 × 上线后」那一格出现。</text>
        </g>
      </Figure>

      <table className="viz-table" style={{ marginTop: 12 }}>
        <thead>
          <tr><th>格子</th><th className="num">上海 (treated)</th><th className="num">上线后 (post)</th><th className="num">y（分钟）</th><th>用 β 写</th></tr>
        </thead>
        <tbody>
          <tr><td>北京，上线前</td><td className="num">0</td><td className="num">0</td><td className="num">{f1(cells.ctrlBefore)}</td><td>β₀</td></tr>
          <tr><td>北京，上线后</td><td className="num">0</td><td className="num">1</td><td className="num">{f1(cells.ctrlAfter)}</td><td>β₀ + β₂</td></tr>
          <tr><td>上海，上线前</td><td className="num">1</td><td className="num">0</td><td className="num">{f1(cells.treatBefore)}</td><td>β₀ + β₁</td></tr>
          <tr><td>上海，上线后</td><td className="num">1</td><td className="num">1</td><td className="num">{f1(cells.treatAfter)}</td><td>β₀ + β₁ + β₂ + β₃</td></tr>
        </tbody>
      </table>

      <div className={`viz-narr${biased ? " is-bad" : " is-good"}`}>{narr}</div>
    </VisualizationFrame>
  );
}

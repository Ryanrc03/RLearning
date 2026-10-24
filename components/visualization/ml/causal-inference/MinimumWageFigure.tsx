"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { didEstimate, didRegression, waldTest } from "@/lib/ml/causal";

// Page 4 of Causal Inference: Card & Krueger (1994), Table 3, "FTE employment
// before / after, all available observations". New Jersey raised its minimum
// wage on 1 April 1992; Pennsylvania did not. The step player walks the four
// means through the DiD and the paper's own standard error.

const CELLS = { treatBefore: 20.44, treatAfter: 21.03, ctrlBefore: 23.33, ctrlAfter: 21.17 };
const SE_NJ = 0.54;
const SE_PA = 1.25;
const SE_DID = 1.36;
const DID_PAPER = 2.76;
const Y_DOMAIN: [number, number] = [16, 26];
const C_NJ = "#2a78d6";
const C_PA = "#76796f";
const C_EFF = "#1baf7a";
const C_BAD = "#d03b3b";

const STEPS = [
  "四个平均数",
  "只看新泽西前后",
  "只看宾州前后",
  "双重差分",
  "这个数可靠吗",
];

const f2 = (x: number) => x.toFixed(2);
const signed = (x: number) => `${x < 0 ? "−" : "+"}${Math.abs(x).toFixed(2)}`;

export default function MinimumWageFigure() {
  const [step, setStep] = useState(0);
  const r = useMemo(() => {
    const est = didEstimate(CELLS);
    const reg = didRegression([
      { treated: 1, post: 0, y: CELLS.treatBefore },
      { treated: 1, post: 1, y: CELLS.treatAfter },
      { treated: 0, post: 0, y: CELLS.ctrlBefore },
      { treated: 0, post: 1, y: CELLS.ctrlAfter },
    ]);
    const w = waldTest(DID_PAPER, SE_DID);
    return { est, reg, w };
  }, []);
  const { est, reg, w } = r;

  const narrs = [
    `1992 年 2 到 3 月和 11 到 12 月，研究者给新泽西和宾州的 410 家快餐店各打了一次电话，问每家店有多少全职等价（FTE）员工。4 月 1 日新泽西把最低工资从 4.25 美元提到 5.05 美元，宾州没动。四个格子就是四组店的平均人数。`,
    `只看新泽西：涨工资前平均 ${f2(CELLS.treatBefore)} 人，涨后 ${f2(CELLS.treatAfter)} 人，变化 ${signed(est.beforeAfter)}（标准误 ${SE_NJ}）。像是什么都没发生。但那一年经济本身在怎么走，这个数字里分不出来。`,
    `再看隔壁没涨工资的宾州：${f2(CELLS.ctrlBefore)} 到 ${f2(CELLS.ctrlAfter)}，变化 ${signed(est.controlTrend)}（标准误 ${SE_PA}）。1992 年快餐业整体在收缩。如果新泽西什么都不做，大概也会这样跌。`,
    `双重差分：新泽西的变化 ${signed(est.beforeAfter)} 减去宾州的变化 ${signed(est.controlTrend)}，得 ${signed(est.did)} FTE（论文印的是 ${signed(DID_PAPER)}，四舍五入的差别）。虚线是新泽西「没涨工资本来会走到哪」：从 ${f2(CELLS.treatBefore)} 按宾州的跌幅平移到 ${f2(est.counterfactual)}。教科书说涨最低工资会裁人，这里的估计是每家店反而多了将近 3 个人。`,
    `估计 ${signed(DID_PAPER)}，标准误 ${SE_DID}，t = ${f2(w.t)}，双侧 p = ${w.p.toFixed(3)}。按 α = 5% 能拒绝「涨工资对就业没有影响」。但只是刚过线，而且只有一次政策、两个州、一次电话调查；这个结果之所以重要，是因为它和当时的教科书预测方向相反，而不是因为它有多精确。`,
  ];
  const tone = step === 4 ? " is-good" : step === 1 ? " is-warn" : "";
  const hi = (cell: "nb" | "na" | "pb" | "pa") => {
    const on = step === 0 || (step === 1 && (cell === "nb" || cell === "na")) || (step === 2 && (cell === "pb" || cell === "pa")) || step >= 3;
    return on ? undefined : { opacity: 0.35 };
  };

  return (
    <VisualizationFrame
      title="Card & Krueger (1994)：四个平均数算出一个因果效应"
      description="每家快餐店的全职等价员工数（FTE），新泽西涨最低工资前后与宾州对照。数字来自论文 Table 3；按「下一步」把它们走一遍。"
    >
      <StepPlayer step={step} total={STEPS.length} onStep={setStep} caption={`第 ${step + 1} 步 / 共 ${STEPS.length} 步：${STEPS[step]}`} intervalMs={2600} />

      <Figure width={720} height={320} label={`第 ${step + 1} 步：${STEPS[step]}`} minWidth={520}>
        <Plot box={{ x: 0, y: 0, w: 430, h: 320 }} xDomain={[-0.3, 1.4]} yDomain={Y_DOMAIN} xTicks={[0, 1]} yTicks={[16, 18, 20, 22, 24, 26]} xFormat={(v) => (v === 0 ? "1992 年 2–3 月" : "1992 年 11–12 月")} yLabel="每店 FTE 员工数" format={(v) => String(Math.round(v))}>
          {(f) => {
            const nj0 = f.y(CELLS.treatBefore);
            const nj1 = f.y(CELLS.treatAfter);
            const pa0 = f.y(CELLS.ctrlBefore);
            const pa1 = f.y(CELLS.ctrlAfter);
            const cf = f.y(est.counterfactual);
            const xb = f.x(1) + 14;
            return (
              <>
                {step >= 2 && <line x1={f.x(0)} y1={pa0} x2={f.x(1)} y2={pa1} stroke={C_PA} strokeWidth={2.2} />}
                {step >= 1 && <line x1={f.x(0)} y1={nj0} x2={f.x(1)} y2={nj1} stroke={C_NJ} strokeWidth={2.2} />}
                {step >= 3 && <line x1={f.x(0)} y1={nj0} x2={f.x(1)} y2={cf} stroke={C_NJ} strokeWidth={1.6} strokeDasharray="6 4" opacity={0.7} />}
                {[
                  { x: 0, y: nj0, c: C_NJ, t: f2(CELLS.treatBefore), dim: step === 2, dx: -9, dy: 4 },
                  { x: 1, y: nj1, c: C_NJ, t: f2(CELLS.treatAfter), dim: step === 2, dx: 9, dy: 15 },
                  { x: 0, y: pa0, c: C_PA, t: f2(CELLS.ctrlBefore), dim: step === 1, dx: -9, dy: 4 },
                  { x: 1, y: pa1, c: C_PA, t: f2(CELLS.ctrlAfter), dim: step === 1, dx: 9, dy: -7 },
                ].map((p, i) => (
                  <g key={i} transform={`translate(${f.x(p.x)} ${p.y})`} opacity={p.dim ? 0.35 : 1} style={{ transition: "opacity .3s" }}>
                    <circle r={5} fill={p.c} stroke="#fff" strokeWidth={1.5} />
                    <text x={p.dx} y={p.dy} fontSize={11.5} fontWeight={600} textAnchor={p.x === 0 ? "end" : "start"} fill={p.c} className="mono">{p.t}</text>
                  </g>
                ))}
                {step === 1 && <text x={f.x(0.5)} y={(nj0 + nj1) / 2 - 10} fontSize={12} fontWeight={700} textAnchor="middle" fill={C_NJ} className="mono">{signed(est.beforeAfter)}</text>}
                {step === 2 && <text x={f.x(0.5)} y={(pa0 + pa1) / 2 - 10} fontSize={12} fontWeight={700} textAnchor="middle" fill={C_PA} className="mono">{signed(est.controlTrend)}</text>}
                {step >= 3 && (
                  <>
                    <g transform={`translate(${f.x(1)} ${cf})`}>
                      <circle r={4} fill="#fff" stroke={C_NJ} strokeWidth={1.5} strokeDasharray="2 2" />
                      <text x={9} y={4} fontSize={11} fill={C_NJ} opacity={0.8} className="mono">反事实 {f2(est.counterfactual)}</text>
                    </g>
                    <line x1={xb + 70} y1={nj1} x2={xb + 70} y2={cf} stroke={C_EFF} strokeWidth={2.5} />
                    <line x1={xb + 64} y1={nj1} x2={xb + 76} y2={nj1} stroke={C_EFF} strokeWidth={2} />
                    <line x1={xb + 64} y1={cf} x2={xb + 76} y2={cf} stroke={C_EFF} strokeWidth={2} />
                    <text x={xb + 82} y={(nj1 + cf) / 2 + 4} fontSize={12} fontWeight={700} fill={C_EFF} className="mono">DiD {signed(est.did)}</text>
                  </>
                )}
                <text x={f.x(0)} y={nj0 + 22} fontSize={12} textAnchor="middle" fill={C_NJ} fontWeight={600}>新泽西（涨工资）</text>
                <text x={f.x(0)} y={pa0 - 14} fontSize={12} textAnchor="middle" fill={C_PA} fontWeight={600}>宾州（对照）</text>
              </>
            );
          }}
        </Plot>

        <g transform="translate(455 0)">
          <text x={0} y={22} fontSize={12.5} fontWeight={600} fill="#30332c">Table 3 的四个格子（每店 FTE）</text>
          <g fontSize={11.5}>
            <text x={90} y={46} fill="#76796f" textAnchor="middle">涨前</text>
            <text x={170} y={46} fill="#76796f" textAnchor="middle">涨后</text>
            <text x={240} y={46} fill="#76796f" textAnchor="middle">变化</text>
            <text x={0} y={70} fill={C_NJ} fontWeight={600}>新泽西</text>
            <text x={90} y={70} textAnchor="middle" fill="#30332c" className="mono" style={hi("nb")}>{f2(CELLS.treatBefore)}</text>
            <text x={170} y={70} textAnchor="middle" fill="#30332c" className="mono" style={hi("na")}>{f2(CELLS.treatAfter)}</text>
            <text x={240} y={70} textAnchor="middle" fill={C_NJ} fontWeight={700} className="mono" opacity={step >= 1 ? 1 : 0.2}>{signed(est.beforeAfter)}</text>
            <text x={0} y={94} fill={C_PA} fontWeight={600}>宾州</text>
            <text x={90} y={94} textAnchor="middle" fill="#30332c" className="mono" style={hi("pb")}>{f2(CELLS.ctrlBefore)}</text>
            <text x={170} y={94} textAnchor="middle" fill="#30332c" className="mono" style={hi("pa")}>{f2(CELLS.ctrlAfter)}</text>
            <text x={240} y={94} textAnchor="middle" fill={C_PA} fontWeight={700} className="mono" opacity={step >= 2 ? 1 : 0.2}>{signed(est.controlTrend)}</text>
            <line x1={0} y1={104} x2={262} y2={104} stroke="#e4dfcb" />
            <text x={0} y={122} fill="#30332c" fontWeight={600}>新泽西 − 宾州</text>
            <text x={240} y={122} textAnchor="middle" fill={C_EFF} fontWeight={700} className="mono" opacity={step >= 3 ? 1 : 0.2}>{signed(est.did)}</text>
          </g>
          <g opacity={step >= 3 ? 1 : 0.25} style={{ transition: "opacity .3s" }}>
            <text x={0} y={160} fontSize={11.5} fill="#76796f">回归写法 y = β₀ + β₁·NJ + β₂·after + β₃·NJ×after</text>
            <text x={0} y={178} fontSize={11.5} fill="#30332c" className="mono">β₀ {f2(reg.b0)}  β₁ {signed(reg.b1)}  β₂ {signed(reg.b2)}  β₃ {signed(reg.b3)}</text>
          </g>
          <g opacity={step >= 4 ? 1 : 0.25} style={{ transition: "opacity .3s" }}>
            <text x={0} y={216} fontSize={11.5} fill="#76796f">论文报告的标准误与检验</text>
            <text x={0} y={236} fontSize={11.5} fill="#30332c" className="mono">估计 {signed(DID_PAPER)}  SE {SE_DID}  t = {f2(w.t)}</text>
            <text x={0} y={254} fontSize={11.5} fill={w.p < 0.05 ? C_EFF : C_BAD} fontWeight={600} className="mono">双侧 p = {w.p.toFixed(3)}{w.p < 0.05 ? " < 0.05" : " ≥ 0.05"}</text>
            <text x={0} y={274} fontSize={10.5} fill="#9a9a90">95% 区间约 {f2(DID_PAPER - 1.96 * SE_DID)} 到 {f2(DID_PAPER + 1.96 * SE_DID)}：刚好不含 0。</text>
          </g>
        </g>
      </Figure>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>新泽西前后</small><b>{signed(est.beforeAfter)}</b></div>
        <div><small>宾州前后</small><b>{signed(est.controlTrend)}</b></div>
        <div><small>只比事后两州</small><b>{signed(est.crossSection)}</b></div>
        <div><small>新泽西反事实</small><b>{f2(est.counterfactual)}</b></div>
        <div><small>DiD（四个均值）</small><b>{signed(est.did)}</b></div>
        <div><small>t / p（论文 SE）</small><b>{f2(w.t)} / {w.p.toFixed(3)}</b></div>
      </div>

      <div className={`viz-narr${tone}`}>{narrs[step]}</div>
    </VisualizationFrame>
  );
}

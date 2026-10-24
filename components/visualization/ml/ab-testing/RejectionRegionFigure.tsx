"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { normalPdf, power, rejectionRegion } from "@/lib/ml/clt";

// Page 3 of A/B Testing: the same 36 bowls, but now the rule is fixed before
// weighing. Pick α, and the critical value x̄* follows: everything left of it
// is the rejection region, whose area under H0 is exactly α. Switch what the
// auntie is really doing to see β (the misses) and power (the catches).

const MU0 = 200;
const SIGMA = 24;
const N = 36;
const SE = SIGMA / Math.sqrt(N);
const DOMAIN: [number, number] = [176, 212];
const ALPHAS = [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2];
const DEFAULT_ALPHA_IDX = 4;
type Effect = "4" | "8" | "12";
const EFFECTS: { key: Effect; label: string }[] = [
  { key: "4", label: "阿姨真少给 4 g" },
  { key: "8", label: "真少给 8 g" },
  { key: "12", label: "真少给 12 g" },
];
const DEFAULT_EFFECT: Effect = "8";
const C_H0 = "#76796f";
const C_H1 = "#2a78d6";
const C_ALPHA = "#d03b3b";
const C_BETA = "#eb6834";
const INK = "#30332c";

function segment(mean: number, from: number, to: number, steps = 60): (readonly [number, number])[] {
  const pts: (readonly [number, number])[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    pts.push([x, normalPdf(x, mean, SE)]);
  }
  return pts;
}
const H0_CURVE = segment(MU0, DOMAIN[0], DOMAIN[1], 128);
const Y_MAX = normalPdf(MU0, MU0, SE) * 1.22;

const pct = (p: number) => `${(p * 100).toFixed(p < 0.01 ? 1 : 0)}%`;
const pathOf = (f: { x: (v: number) => number; y: (v: number) => number; y0: number }, pts: (readonly [number, number])[]) =>
  `M${f.x(pts[0][0])} ${f.y0} ${pts.map((p) => `L${f.x(p[0])} ${f.y(p[1])}`).join(" ")} L${f.x(pts[pts.length - 1][0])} ${f.y0} Z`;

export default function RejectionRegionFigure() {
  const [aIdx, setAIdx] = useState(DEFAULT_ALPHA_IDX);
  const [effect, setEffect] = useState<Effect>(DEFAULT_EFFECT);
  const alpha = ALPHAS[aIdx];
  const eff = Number(effect);
  const mu1 = MU0 - eff;
  const region = rejectionRegion(alpha, "less");
  const zStar = region.lower!;
  const xStar = MU0 + zStar * SE;
  const delta = -eff / SE;
  const pow = power(delta, alpha, "less");
  const beta = 1 - pow;

  const h1Curve = segment(mu1, DOMAIN[0], DOMAIN[1], 128);
  const alphaArea = segment(MU0, DOMAIN[0], xStar);
  const betaArea = segment(mu1, xStar, DOMAIN[1]);
  const powerArea = segment(mu1, DOMAIN[0], xStar);

  const narr =
    alpha <= 0.005
      ? `α = ${pct(alpha)}：线画得很严，只有 36 碗平均低于 ${xStar.toFixed(1)} g 才算抓到。诚实的阿姨几乎不会被冤枉，但真少给 ${eff} g 时 power 掉到 ${pct(pow)}，${pct(beta)} 的机会放过她。严不是免费的。`
      : alpha >= 0.2
        ? `α = ${pct(alpha)}：临界值放宽到 ${xStar.toFixed(1)} g，真少给 ${eff} g 时 power 有 ${pct(pow)}，可代价是诚实的阿姨也有五分之一的机会被判「少给」。这条线不是越松越好。`
        : pow >= 0.8
          ? `α = ${pct(alpha)}：36 碗平均低于 ${xStar.toFixed(1)} g（z < ${zStar.toFixed(2)}）才判阿姨少给；诚实时误判的概率是 ${pct(alpha)}。如果她真少给 ${eff} g，抓到的概率（power）是 ${pct(pow)}，这个 n 够用。`
          : `α = ${pct(alpha)}：只有 36 碗平均低于 ${xStar.toFixed(1)} g（z < ${zStar.toFixed(2)}）才判阿姨少给，诚实时被冤枉的概率就是 ${pct(alpha)}。如果她真少给 ${eff} g，抓到的概率（power）只有 ${pct(pow)}，有 ${pct(beta)} 的机会放过她。想两边都好，只能多称几碗。`;
  const tone = alpha >= 0.2 ? " is-bad" : alpha <= 0.005 || pow < 0.8 ? " is-warn" : " is-good";

  return (
    <VisualizationFrame
      title="拒绝域：先定 α，临界线就定了；α 和 β 此消彼长"
      description="还是 36 碗、SE = 4 g、单侧 H1：μ < 200。灰线是 H0（阿姨诚实）下平均值的分布，蓝线是 H1（真少给）下的分布。虚线左边是拒绝域：红色面积 = α，橙色面积 = β（漏抓），蓝色面积 = power（抓到）。"
    >
      <div className="viz-row">
        <Tabs options={EFFECTS} value={effect} onChange={setEffect} ariaLabel="真实情况" />
        <button type="button" className="viz-btn" onClick={() => { setAIdx(DEFAULT_ALPHA_IDX); setEffect(DEFAULT_EFFECT); }}>重置</button>
      </div>
      <Slider label="显著性水平 α" value={aIdx} min={0} max={ALPHAS.length - 1} step={1} onChange={setAIdx} display={pct(alpha)} id="rr-alpha" />

      <Figure width={720} height={320} label={`α = ${pct(alpha)}，临界值 ${xStar.toFixed(1)} g，β = ${pct(beta)}，power = ${pct(pow)}`} minWidth={520}>
        <Plot box={{ x: 0, y: 0, w: 720, h: 320 }} xDomain={DOMAIN} yDomain={[0, Y_MAX]} xTicks={[176, 180, 184, 188, 192, 196, 200, 204, 208, 212]} yTicks={[]} xLabel="36 碗的平均值（g）" format={(v) => String(v)}>
          {(f) => (
            <>
              <path d={pathOf(f, powerArea)} fill={C_H1} opacity={0.16} style={{ transition: "d .3s" }} />
              <path d={pathOf(f, betaArea)} fill={C_BETA} opacity={0.3} style={{ transition: "d .3s" }} />
              <path d={pathOf(f, alphaArea)} fill={C_ALPHA} opacity={0.45} style={{ transition: "d .3s" }} />
              <Curve frame={f} points={h1Curve} color={C_H1} width={2} />
              <Curve frame={f} points={H0_CURVE} color={C_H0} width={2} />
              <line x1={f.x(xStar)} x2={f.x(xStar)} y1={f.y0} y2={f.y1 + 4} stroke={INK} strokeWidth={1.2} strokeDasharray="5 3" style={{ transition: "x1 .3s, x2 .3s" }} />
              <text x={f.x(xStar)} y={f.y1 + 1} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={INK} className="mono" style={{ transition: "x .3s" }}>
                x̄* = {xStar.toFixed(1)} g（z* = {zStar.toFixed(2)}）
              </text>
              <text x={f.x(xStar) - 6} y={f.y0 - 10} fontSize={11.5} fontWeight={600} textAnchor="end" fill={C_ALPHA} style={{ transition: "x .3s" }}>← 拒绝 H0</text>
              <text x={f.x(xStar) + 6} y={f.y0 - 10} fontSize={11.5} textAnchor="start" fill={C_H0} style={{ transition: "x .3s" }}>不拒绝 →</text>
              <text x={f.x(mu1)} y={f.y(normalPdf(mu1, mu1, SE)) - 8} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={C_H1} style={{ transition: "x .3s" }}>H1：μ = {mu1} g</text>
              <text x={f.x(MU0)} y={f.y(normalPdf(MU0, MU0, SE)) - 8} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={C_H0}>H0：μ = 200 g</text>
              <text x={f.x(Math.min(xStar, mu1 + 1)) - 4} y={f.y(normalPdf(mu1, mu1, SE) * 0.35)} fontSize={11.5} fontWeight={600} textAnchor="end" fill={C_H1} className="mono" style={{ transition: "x .3s" }}>power {pct(pow)}</text>
              <text x={f.x(Math.max(xStar, mu1) + 1.2)} y={f.y(normalPdf(mu1, mu1, SE) * 0.22)} fontSize={11.5} fontWeight={600} textAnchor="start" fill={C_BETA} className="mono" style={{ transition: "x .3s" }}>β {pct(beta)}</text>
              <text x={f.x(xStar) - 4} y={f.y0 - 1 - Math.max(8, (f.y0 - f.y(normalPdf(xStar, MU0, SE))) * 0.4)} fontSize={11} fontWeight={600} textAnchor="end" fill={C_ALPHA} className="mono" style={{ transition: "x .3s, y .3s" }}>α {pct(alpha)}</text>
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: C_ALPHA, opacity: 0.6 }} />α：H0 成立却被拒绝（冤枉诚实的阿姨）</span>
        <span><i style={{ background: C_BETA, opacity: 0.45 }} />β：H1 成立却没拒绝（放过了）</span>
        <span><i style={{ background: C_H1, opacity: 0.3 }} />power = 1 − β</span>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>临界值 z*</small><b>{zStar.toFixed(2)}</b></div>
        <div><small>临界值 x̄*</small><b>{xStar.toFixed(1)} g</b></div>
        <div><small>α（Type I error）</small><b>{pct(alpha)}</b></div>
        <div><small>β（Type II error）</small><b>{pct(beta)}</b></div>
        <div><small>power = 1 − β</small><b>{pct(pow)}</b></div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { normalCdf, normalPdf, oneSampleZTest } from "@/lib/ml/clt";

// Page 2 of A/B Testing: the canteen says a bowl of rice is 200 g. You weigh 36
// bowls. If the auntie is honest (H0), the CLT says the average of 36 bowls is
// N(200, 4²). Drag the average you observed and watch how surprising it would
// be under H0: the shaded tail is the p-value.

const MU0 = 200;
const SIGMA = 24;
const N = 36;
const SE = SIGMA / Math.sqrt(N);
const DOMAIN: [number, number] = [184, 216];
const DEFAULT_XBAR = 192;
type Alt = "two-sided" | "less";
const DEFAULT_ALT: Alt = "two-sided";
const C_H0 = "#76796f";
const C_P = "#eb6834";
const INK = "#30332c";

const ALTS: { key: Alt; label: string }[] = [
  { key: "two-sided", label: "双侧：μ ≠ 200" },
  { key: "less", label: "单侧：μ < 200" },
];

function segment(from: number, to: number, steps = 60): (readonly [number, number])[] {
  const pts: (readonly [number, number])[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    pts.push([x, normalPdf(x, MU0, SE)]);
  }
  return pts;
}
const H0_CURVE = segment(DOMAIN[0], DOMAIN[1], 128);
const Y_MAX = normalPdf(MU0, MU0, SE) * 1.18;

const fp = (p: number) => (p < 0.001 ? "< 0.001" : p.toFixed(3));
const pe = (p: number) => (p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`);
const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`;

export default function HypothesisTestFigure() {
  const [xbar, setXbar] = useState(DEFAULT_XBAR);
  const [alt, setAlt] = useState<Alt>(DEFAULT_ALT);
  const t = oneSampleZTest(xbar, MU0, SIGMA, N, alt);
  const below = normalCdf(t.z);
  const twoSided = alt === "two-sided";

  // The tail(s) that count as "at least this extreme".
  const tails: (readonly [number, number])[][] = [];
  if (twoSided) {
    const d = Math.abs(xbar - MU0);
    if (MU0 - d > DOMAIN[0]) tails.push(segment(DOMAIN[0], MU0 - d));
    if (MU0 + d < DOMAIN[1]) tails.push(segment(MU0 + d, DOMAIN[1]));
    if (d === 0) tails.length = 0;
  } else {
    tails.push(segment(DOMAIN[0], xbar));
  }

  const wrongWay = !twoSided && xbar > MU0;
  const narr = wrongWay
    ? `单侧检验只看「少给」的方向：36 碗平均 ${xbar.toFixed(1)} g，比 200 还高，z = ${signed(t.z)}，p = ${fp(t.p)}。阿姨没少给的证据等于零，这个方向的问题根本不用问。`
    : t.p < 0.01
      ? `36 碗平均 ${xbar.toFixed(1)} g，z = ${signed(t.z)}。如果阿姨真的按 200 g 打，${twoSided ? "偏离这么远" : "平均低到这个程度"}的概率只有 ${fp(t.p)}。证据很强：要么今天撞上了千分之几的运气，要么 H0 不成立。`
      : t.p < 0.05
        ? `36 碗平均 ${xbar.toFixed(1)} g，z = ${signed(t.z)}，${pe(t.p)}。H0 成立时出现这么极端的结果不到二十分之一，按 5% 的惯例算显著，可以说阿姨少给了。注意这不是「阿姨少给的概率是 95%」。`
        : t.p < 0.2
          ? `36 碗平均 ${xbar.toFixed(1)} g，z = ${signed(t.z)}，${pe(t.p)}。有点可疑，但诚实的阿姨也有 ${(t.p * 100).toFixed(0)}% 的机会称出这样的 36 碗，证据不够。多称一些碗，或者承认看不出来。`
          : `36 碗平均 ${xbar.toFixed(1)} g，z = ${signed(t.z)}，${pe(t.p)}。离 200 的距离不到 ${Math.abs(t.z).toFixed(1)} 个标准误，完全在运气范围之内：这样的数据对 H0 一点威胁都没有。`;
  const tone = wrongWay ? "" : t.p < 0.05 ? " is-good" : t.p < 0.2 ? " is-warn" : "";

  return (
    <VisualizationFrame
      title="假设检验：先假设阿姨没少给，再看你称到的数有多不寻常"
      description="标称 200 g 一碗，单碗标准差 σ = 24 g（秤的历史记录），称了 n = 36 碗。灰线是 H0 成立时 36 碗平均值的分布 N(200, 4²)，橙色阴影面积就是 p-value。拖动你称到的平均值。"
    >
      <div className="viz-row">
        <Tabs options={ALTS} value={alt} onChange={setAlt} ariaLabel="备择假设" />
        <button type="button" className="viz-btn" onClick={() => { setXbar(DEFAULT_XBAR); setAlt(DEFAULT_ALT); }}>重置</button>
      </div>
      <Slider label="36 碗的平均 x̄" value={xbar} min={DOMAIN[0]} max={DOMAIN[1]} step={0.5} onChange={setXbar} display={`${xbar.toFixed(1)} g`} id="ht-xbar" />

      <Figure width={720} height={300} label={`x̄ = ${xbar.toFixed(1)} g，z = ${t.z.toFixed(2)}，p = ${fp(t.p)}`} minWidth={520}>
        <Plot box={{ x: 0, y: 0, w: 720, h: 300 }} xDomain={DOMAIN} yDomain={[0, Y_MAX]} xTicks={[184, 188, 192, 196, 200, 204, 208, 212, 216]} yTicks={[]} format={(v) => `${v} g`}>
          {(f) => (
            <>
              {tails.map((pts, i) => (
                <path key={`fill${i}`} d={`M${f.x(pts[0][0])} ${f.y0} ${pts.map((p) => `L${f.x(p[0])} ${f.y(p[1])}`).join(" ")} L${f.x(pts[pts.length - 1][0])} ${f.y0} Z`} fill={C_P} opacity={0.22} style={{ transition: "d .3s" }} />
              ))}
              <Curve frame={f} points={H0_CURVE} color={C_H0} width={2} />
              <line x1={f.x(MU0)} x2={f.x(MU0)} y1={f.y0} y2={f.y(Y_MAX * 0.9)} stroke={INK} strokeWidth={1} strokeDasharray="3 3" />
              <text x={f.x(MU0) + 5} y={f.y(Y_MAX * 0.9) + 4} fontSize={11.5} fill={INK}>H0：μ = 200 g，SE = σ/√n = {SE.toFixed(0)} g</text>
              {[-3, -2, -1, 0, 1, 2, 3].map((z) => (
                <text key={z} x={f.x(MU0 + z * SE)} y={f.y0 + 29} fontSize={11} textAnchor="middle" fill={C_H0} className="mono">
                  z = {z > 0 ? `+${z}` : z < 0 ? `−${-z}` : "0"}
                </text>
              ))}
              {!twoSided && (
                <line x1={f.x(DOMAIN[0])} x2={f.x(xbar)} y1={f.y0 - 6} y2={f.y0 - 6} stroke={C_P} strokeWidth={2} style={{ transition: "x2 .3s" }} />
              )}
              <Marker frame={f} x={xbar} y={0} color={C_P} label={`x̄ = ${xbar.toFixed(1)} g`} side={xbar < MU0 ? "left" : "right"} r={4.5} />
              {tails.length > 0 && (
                <text x={f.x(twoSided ? MU0 - Math.abs(xbar - MU0) : xbar) - 6} y={f.y(normalPdf(twoSided ? MU0 - Math.abs(xbar - MU0) : xbar, MU0, SE)) - 8} fontSize={11.5} fontWeight={600} textAnchor="end" fill={C_P} className="mono" style={{ transition: "x .3s, y .3s" }}>
                  {twoSided ? `p/2 = ${fp(t.p / 2)}` : `p = ${fp(t.p)}`}
                </text>
              )}
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: C_H0 }} />H0 成立时 x̄ 的分布，N(200, 4²)</span>
        <span><i style={{ background: C_P, opacity: 0.3 }} />{twoSided ? "两边一样极端的面积 = p" : "更低的那一侧面积 = p"}</span>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>你称到的 x̄</small><b>{xbar.toFixed(1)} g</b></div>
        <div><small>z = (x̄ − 200) / 4</small><b>{signed(t.z)}</b></div>
        <div><small>p-value（{twoSided ? "双侧" : "单侧"}）</small><b>{fp(t.p)}</b></div>
        <div><small>H0 成立时 36 碗平均 ≤ x̄ 的概率</small><b>{fp(below)}</b></div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

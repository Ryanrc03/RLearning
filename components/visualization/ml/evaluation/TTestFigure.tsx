"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { createRng } from "@/lib/ml/random";
import {
  drawIndependent,
  drawPaired,
  pairedTTest,
  sampleStats,
  studentTPdf,
  studentTQuantile,
  welchTTest,
  zPValue,
} from "@/lib/ml/ttest";

// Page 6 of Evaluation: average concurrent viewers (K) per livestream slot.
// "独立两组": control slots ~ N(120, 25), treatment slots ~ N(137.5, 40), so the
// variances differ and Welch is the right test. "同一时段前后": each slot has its
// own level (prime time vs late night) and the change adds 12K; paired t sees it,
// Welch on the same numbers does not. Drag n and watch t, df and p; the t density
// is drawn against the normal so the heavy tails at small df are visible.

const SIZES = [3, 4, 5, 6, 8, 10, 15, 20, 30, 50, 100];
const DEFAULT_IDX = 1;
const POOL = 100;
const C_A = "#76796f";
const C_B = "#2a78d6";
const C_T = "#eb6834";
const T_DOMAIN: [number, number] = [-5, 5];

type Mode = "independent" | "paired";
const MODES: { key: Mode; label: string }[] = [
  { key: "independent", label: "独立两组（Welch）" },
  { key: "paired", label: "同一时段前后（配对）" },
];

// Seeded pools: growing n adds slots instead of redrawing the ones already shown.
const IND = drawIndependent(createRng(20), POOL, { mean: 120, sd: 25 }, { mean: 137.5, sd: 40 });
const PAIR_EFFECT = 12;
const PAIR = drawPaired(createRng(120), POOL, { level: 125, levelSd: 35, effect: PAIR_EFFECT, noiseSd: 7 });
const JITTER = (() => {
  const rng = createRng(77);
  return Array.from({ length: POOL }, () => (rng() - 0.5) * 0.36);
})();

function range(xs: number[]): [number, number] {
  return [Math.floor(Math.min(...xs) / 20) * 20, Math.ceil(Math.max(...xs) / 20) * 20];
}
const Y_IND = range([...IND.a, ...IND.b]);
const Y_PAIR = range([...PAIR.before, ...PAIR.after]);

function density(pdf: (x: number) => number, from: number, to: number, steps = 120): (readonly [number, number])[] {
  const pts: (readonly [number, number])[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    pts.push([x, pdf(x)]);
  }
  return pts;
}
const normalPdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

// Three decimals, four when rounding would print a misleading 0.050.
const fp = (p: number) => (p < 0.001 ? "< 0.001" : p.toFixed(3) === "0.050" ? p.toFixed(4) : p.toFixed(3));
const pe = (p: number) => (p < 0.001 ? "p < 0.001" : `p = ${fp(p)}`);
const f1 = (x: number) => x.toFixed(1);
const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}`;

export default function TTestFigure() {
  const [mode, setMode] = useState<Mode>("independent");
  const [idx, setIdx] = useState(DEFAULT_IDX);
  const n = SIZES[idx];
  const paired = mode === "paired";

  const r = useMemo(() => {
    const a = (paired ? PAIR.before : IND.a).slice(0, n);
    const b = (paired ? PAIR.after : IND.b).slice(0, n);
    const sa = sampleStats(a);
    const sb = sampleStats(b);
    const welch = welchTTest(a, b);
    const main = paired ? pairedTTest(a, b) : welch;
    const sd = paired ? sampleStats(b.map((x, i) => x - a[i])).sd : 0;
    const tCrit = studentTQuantile(0.975, main.df);
    return { a, b, sa, sb, welch, main, sd, tCrit, pz: zPValue(main.t) };
  }, [n, paired]);

  const { main } = r;
  const df = main.df;
  const tPts = density((x) => studentTPdf(x, df), T_DOMAIN[0], T_DOMAIN[1]);
  const zPts = density(normalPdf, T_DOMAIN[0], T_DOMAIN[1]);
  const absT = Math.abs(main.t);
  const tails = absT < T_DOMAIN[1] ? [density((x) => studentTPdf(x, df), absT, T_DOMAIN[1], 40), density((x) => studentTPdf(x, df), T_DOMAIN[0], -absT, 40)] : [];
  const tShown = Math.max(-4.8, Math.min(4.8, main.t));
  const sig = main.p < 0.05;
  const zOnly = !paired && !sig && r.pz < 0.05;
  const yDomain = paired ? Y_PAIR : Y_IND;
  const yTicks = [0, 1, 2, 3, 4].map((i) => yDomain[0] + ((yDomain[1] - yDomain[0]) * i) / 4);
  const dotR = n <= 30 ? 3.2 : 2.2;
  const dfText = paired ? String(df) : `≈ ${f1(df)}`;

  const narr = paired
    ? sig && r.welch.p >= 0.05
      ? `同一批 ${n} 个直播时段，改前改后各测一次。时段之间差很大（改前 s = ${f1(r.sa.sd)}K），但每个时段自己的前后差很稳（s_d = ${f1(r.sd)}K）。配对 t 只看差值：t = ${main.t.toFixed(2)}，df = ${df}，${pe(main.p)}；当成两组独立样本用 Welch，时段间的差异全算进噪声，${pe(r.welch.p)}，测不出来。`
      : sig
        ? `${n} 个时段时两种算法都显著，但配对 ${pe(main.p)}，独立 Welch 才 ${fp(r.welch.p)}：配对把时段本身的高低减掉了，同样 +${PAIR_EFFECT}K 的效果，配对用少得多的样本就能测出来。`
        : `只有 ${n} 个时段，df = ${df}，t 分布尾巴很厚，临界值要到 ±${r.tCrit.toFixed(2)}。配对 t = ${main.t.toFixed(2)}，${pe(main.p)}，还不够；当成独立两组 ${pe(r.welch.p)}，更没戏。往右拖。`
    : zOnly
      ? `每组只有 ${n} 场，df ${dfText}，t 分布的尾巴比正态厚得多。同一个 t = ${main.t.toFixed(2)}：查 t 分布 ${pe(main.p)}，不显著；误当正态查 ${pe(r.pz)}，小于 0.05。用 z 检验就会把运气当成效果。往右拖，看两条曲线合拢。`
      : !sig
        ? `每组 ${n} 场，B 平均高 ${f1(main.diff)}K，但两组的 s 是 ${f1(r.sa.sd)}K 和 ${f1(r.sb.sd)}K，标准误 ${f1(main.se)}K，t = ${main.t.toFixed(2)} 还不够大，${pe(main.p)}。这个差可能是运气，样本再多一些。`
        : n < 30
          ? `每组 ${n} 场，t = ${main.t.toFixed(2)}，df ${dfText}，${pe(main.p)}，小于 0.05，显著。此时 t 的临界值 ${r.tCrit.toFixed(2)} 仍大于 z 的 1.96：t 检验替小样本多要了一截证据。`
          : `每组 ${n} 场，df ${dfText}，t 分布已经和正态几乎重合（临界值 ${r.tCrit.toFixed(2)} 对 1.96），t 和 z 给出几乎一样的 p（${fp(main.p)} 对 ${fp(r.pz)}）：两者的区别只在小样本。`;

  const tone = zOnly ? " is-bad" : sig ? " is-good" : " is-warn";

  return (
    <VisualizationFrame
      title="t 检验：样本少时，t 分布的尾巴比正态厚"
      description="每个点是一场直播的平均在线人数（K，模拟数据）。左图是两组样本和均值，右图是这次的 t 统计量落在 t 分布（橙）上的位置，虚线是正态分布；橙色阴影面积就是双侧 p。"
    >
      <div className="viz-row">
        <Tabs options={MODES} value={mode} onChange={setMode} ariaLabel="样本结构" />
        <button type="button" className="viz-btn" onClick={() => { setMode("independent"); setIdx(DEFAULT_IDX); }}>重置</button>
      </div>
      <Slider label={paired ? "直播时段数 n" : "每组场次 n"} value={idx} min={0} max={SIZES.length - 1} step={1} onChange={setIdx} display={String(n)} id="tt-n" />

      <Figure width={720} height={300} label={`n = ${n}，t = ${main.t.toFixed(2)}，df ${dfText}，p ${fp(main.p)}`} minWidth={520}>
        <Plot box={{ x: 0, y: 0, w: 270, h: 300 }} xDomain={[0, 2]} yDomain={yDomain} xTicks={[]} yTicks={yTicks} yLabel="平均在线人数 (K)" format={(v) => String(Math.round(v))}>
          {(f) => (
            <>
              {paired &&
                r.a.map((y, i) => (
                  <line key={`l${i}`} x1={f.x(0.5 + JITTER[i] * 0.4)} y1={f.y(y)} x2={f.x(1.5 + JITTER[i] * 0.4)} y2={f.y(r.b[i])} stroke="#c9c4ad" strokeWidth={1} opacity={n > 30 ? 0.5 : 0.9} />
                ))}
              {r.a.map((y, i) => (
                <circle key={`a${i}`} cx={f.x(0.5 + JITTER[i] * (paired ? 0.4 : 1))} cy={f.y(y)} r={dotR} fill={C_A} opacity={0.75} />
              ))}
              {r.b.map((y, i) => (
                <circle key={`b${i}`} cx={f.x(1.5 + JITTER[i] * (paired ? 0.4 : 1))} cy={f.y(y)} r={dotR} fill={C_B} opacity={0.75} />
              ))}
              {[
                { c: 0.5, m: r.sa.mean, color: C_A },
                { c: 1.5, m: r.sb.mean, color: C_B },
              ].map((g) => (
                <g key={g.c} style={{ transition: "transform .3s" }} transform={`translate(0 ${f.y(g.m)})`}>
                  <line x1={f.x(g.c - 0.32)} x2={f.x(g.c + 0.32)} y1={0} y2={0} stroke={g.color} strokeWidth={2.5} />
                  <text x={f.x(g.c)} y={-6} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={g.color} className="mono">x̄ {f1(g.m)}</text>
                </g>
              ))}
              <text x={f.x(0.5)} y={f.y0 + 16} fontSize={12} textAnchor="middle" fill={C_A}>{paired ? "改前" : "A 对照"}</text>
              <text x={f.x(1.5)} y={f.y0 + 16} fontSize={12} textAnchor="middle" fill={C_B}>{paired ? "改后" : "B 实验"}</text>
            </>
          )}
        </Plot>
        <Plot box={{ x: 290, y: 0, w: 430, h: 300 }} xDomain={T_DOMAIN} yDomain={[0, 0.43]} xTicks={[-4, -2, 0, 2, 4]} yTicks={[]} xLabel={paired ? "t = d̄ / (s_d / √n)" : "t = (x̄_B − x̄_A) / √(s²_A/n + s²_B/n)"}>
          {(f) => (
            <>
              {tails.map((pts, i) => (
                <Curve key={i} frame={f} points={pts} color={C_T} width={0} area />
              ))}
              {[-1, 1].map((s) => (
                <g key={s}>
                  <line x1={f.x(s * 1.96)} x2={f.x(s * 1.96)} y1={f.y0} y2={f.y(0.36)} stroke={C_A} strokeWidth={1} strokeDasharray="2 3" />
                  <line x1={f.x(s * Math.min(r.tCrit, 4.95))} x2={f.x(s * Math.min(r.tCrit, 4.95))} y1={f.y0} y2={f.y(0.4)} stroke={C_T} strokeWidth={1} strokeDasharray="4 3" style={{ transition: "x1 .3s, x2 .3s" }} />
                </g>
              ))}
              <text x={f.x(Math.min(r.tCrit, 4.95)) - 4} y={f.y(0.4) + 4} fontSize={11} fill={C_T} textAnchor="end" className="mono">t* {r.tCrit.toFixed(2)}</text>
              <text x={f.x(-1.96) - 4} y={f.y(0.36) + 4} fontSize={11} fill={C_A} textAnchor="end" className="mono">z* 1.96</text>
              <Curve frame={f} points={zPts} color={C_A} width={1.6} dashed />
              <Curve frame={f} points={tPts} color={C_T} width={2.2} />
              <Marker frame={f} x={tShown} y={0} color="#30332c" label={`t = ${main.t.toFixed(2)}${Math.abs(main.t) > 4.8 ? " →" : ""}`} side="above" r={4} />
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: C_T }} />t 分布，df {dfText}</span>
        <span><i style={{ background: C_A, opacity: 0.6 }} />正态 N(0, 1)（虚线）</span>
        <span><i style={{ background: C_T, opacity: 0.25 }} />|t| 以外的面积 = 双侧 p</span>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>{paired ? "改前" : "A"} x̄ / s</small><b>{f1(r.sa.mean)} / {f1(r.sa.sd)}</b></div>
        <div><small>{paired ? "改后" : "B"} x̄ / s</small><b>{f1(r.sb.mean)} / {f1(r.sb.sd)}</b></div>
        <div><small>{paired ? "差值 d̄ / s_d" : "差 x̄_B − x̄_A"}</small><b>{paired ? `${signed(main.diff)} / ${f1(r.sd)}` : signed(main.diff)}</b></div>
        <div><small>{paired ? "配对 t / df" : "Welch t / df"}</small><b>{main.t.toFixed(2)} / {paired ? df : f1(df)}</b></div>
        <div><small>{paired ? "p（配对 t）" : "p（t 分布）"}</small><b>{fp(main.p)}</b></div>
        <div><small>{paired ? "p（当成独立两组 Welch）" : "p（误当正态 z）"}</small><b>{fp(paired ? r.welch.p : r.pz)}</b></div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

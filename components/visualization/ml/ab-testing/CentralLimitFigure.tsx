"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { createRng } from "@/lib/ml/random";
import { histogram, maxCdfGap, normalPdf, POPULATIONS, sampleMeans, skewness, type PopulationKey } from "@/lib/ml/clt";

// Page 1 of A/B Testing: pick a population that is anything but normal (a flat
// die, a right-skewed delivery time, a two-humped rating), draw n of them, take
// the average, repeat 2000 times. Drag n and watch the histogram of averages
// turn into the bell N(μ, σ²/n) drawn on top of it.

const SIZES = [1, 2, 3, 5, 10, 30, 100];
const DEFAULT_IDX = 0;
const DEFAULT_POP: PopulationKey = "dice";
const POP_DRAWS = 4000;
const REPS = 2000;
const C_POP = "#76796f";
const C_MEAN = "#2a78d6";
const C_NORM = "#eb6834";
const INK = "#30332c";

const POP_OPTIONS = (Object.keys(POPULATIONS) as PopulationKey[]).map((key) => ({ key, label: POPULATIONS[key].label }));
// Spacing of the values a single draw can take; 0 for a continuous population.
const LATTICE: Record<PopulationKey, number> = { dice: 1, delivery: 0, ratings: 2 };

// Seeded once: the population picture and the averages never change between reloads.
const POP_HIST = Object.fromEntries(
  (Object.keys(POPULATIONS) as PopulationKey[]).map((key) => {
    const pop = POPULATIONS[key];
    const rng = createRng(17);
    const draws = Array.from({ length: POP_DRAWS }, () => pop.draw(rng));
    return [key, histogram(draws, pop.domain[0], pop.domain[1], pop.bin)];
  }),
) as Record<PopulationKey, ReturnType<typeof histogram>>;

// Bin width for the averages: narrower as n grows, but always an odd multiple of the
// lattice spacing so a discrete average never lands on a bin edge.
function meanBin(key: PopulationKey, n: number): number {
  const pop = POPULATIONS[key];
  const target = pop.bin / Math.sqrt(n);
  const lat = LATTICE[key];
  if (lat === 0) return target;
  const unit = lat / n;
  let m = Math.max(1, Math.floor(target / unit));
  if (m % 2 === 0) m -= 1;
  return Math.max(1, m) * unit;
}

function niceTicks(lo: number, hi: number, count = 5): number[] {
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Number(t.toFixed(6)));
  return out;
}

const f2 = (x: number) => x.toFixed(2);
const fmtTick = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1));

export default function CentralLimitFigure() {
  const [key, setKey] = useState<PopulationKey>(DEFAULT_POP);
  const [idx, setIdx] = useState(DEFAULT_IDX);
  const n = SIZES[idx];
  const pop = POPULATIONS[key];

  const r = useMemo(() => {
    const means = sampleMeans(createRng(41), pop, n, REPS);
    const se = pop.sd / Math.sqrt(n);
    const bin = meanBin(key, n);
    // Put a bin centre on the lattice origin (the smallest value a draw can take).
    const origin = LATTICE[key] === 0 ? pop.domain[0] : pop.domain[0] + pop.bin / 2;
    const lo = origin - bin / 2 - bin * Math.ceil((origin - bin / 2 - pop.domain[0]) / bin);
    const hist = histogram(means, lo, pop.domain[1] + bin, bin);
    const m = means.reduce((s, x) => s + x, 0) / means.length;
    const sdHat = Math.sqrt(means.reduce((s, x) => s + (x - m) * (x - m), 0) / (means.length - 1));
    const span = pop.domain[1] - pop.domain[0];
    const half = Math.max(4.5 * se, span / 8);
    const view: [number, number] = [Math.max(pop.domain[0], pop.mean - half), Math.min(pop.domain[1], pop.mean + half)];
    const curve: (readonly [number, number])[] = [];
    for (let i = 0; i <= 120; i++) {
      const x = view[0] + ((view[1] - view[0]) * i) / 120;
      curve.push([x, normalPdf(x, pop.mean, se)]);
    }
    const yMax = Math.max(...hist.density, normalPdf(pop.mean, pop.mean, se)) * 1.12;
    return { se, bin, hist, sdHat, view, curve, yMax, gap: maxCdfGap(means, pop.mean, se), skew: skewness(means) };
  }, [key, n, pop]);

  const popHist = POP_HIST[key];
  const popYMax = Math.max(...popHist.density) * 1.15;
  const zoomed = r.view[0] > pop.domain[0] + 1e-9 || r.view[1] < pop.domain[1] - 1e-9;
  const nearNormal = r.gap < 0.06 && Math.abs(r.skew) < 0.5;

  const narr =
    n === 1
      ? `n = 1：右图就是总体本身，${pop.label}一次一个数，离正态还有 ${f2(r.gap)}，偏度 ${f2(r.skew)}。往右拖 n，看每 n 个取一次平均之后会变成什么形状。`
      : n < 30
        ? nearNormal
          ? `每 ${n} 个取一次平均：形状已经很接近钟形（离正态 ${f2(r.gap)}，偏度 ${f2(r.skew)}），宽度收到 σ/√n = ${f2(r.se)} ${pop.unit}。总体长什么样已经不重要了。`
          : `每 ${n} 个取一次平均：宽度已经收到 σ/√n = ${f2(r.se)} ${pop.unit}，但形状还带着总体的影子（偏度 ${f2(r.skew)}，离正态 ${f2(r.gap)}）。越偏的总体，需要越大的 n。`
        : `n = ${n}：几乎就是正态了（离正态 ${f2(r.gap)}，偏度 ${f2(r.skew)}）。宽度 σ/√n = ${f2(r.se)} ${pop.unit}，是单次的 1/√${n} ≈ ${(1 / Math.sqrt(n)).toFixed(2)}；${zoomed ? "右图横轴已经跟着放大，" : ""}实际算出的标准差 ${f2(r.sdHat)} 和理论值几乎一样。`;
  const tone = n === 1 ? " is-warn" : nearNormal ? " is-good" : " is-warn";

  return (
    <VisualizationFrame
      title="中心极限定理：不管总体什么形状，平均值都长成钟形"
      description={`左图是总体：${POP_DRAWS} 次单独的${pop.label}。右图是把 n 次的结果取平均、重复 ${REPS} 遍得到的直方图，橙线是定理说的 N(μ, σ²/n)。`}
    >
      <div className="viz-row">
        <Tabs options={POP_OPTIONS} value={key} onChange={setKey} ariaLabel="总体" />
        <button type="button" className="viz-btn" onClick={() => { setKey(DEFAULT_POP); setIdx(DEFAULT_IDX); }}>重置</button>
      </div>
      <Slider label="每次平均几个 n" value={idx} min={0} max={SIZES.length - 1} step={1} onChange={setIdx} display={String(n)} id="clt-n" />

      <Figure width={720} height={300} label={`${pop.label}，n = ${n}，σ/√n = ${f2(r.se)}，离正态 ${f2(r.gap)}`} minWidth={520}>
        <Plot box={{ x: 0, y: 0, w: 330, h: 300 }} xDomain={pop.domain} yDomain={[0, popYMax]} xTicks={niceTicks(pop.domain[0], pop.domain[1])} yTicks={[]} xLabel={`一次${pop.label}（${pop.unit}）`} title="总体" xFormat={fmtTick}>
          {(f) => (
            <>
              {popHist.counts.map((c, i) =>
                c === 0 ? null : (
                  <rect key={i} x={f.x(popHist.edges[i]) + 0.5} y={f.y(popHist.density[i])} width={Math.max(1, f.x(popHist.edges[i + 1]) - f.x(popHist.edges[i]) - 1)} height={f.y0 - f.y(popHist.density[i])} fill={C_POP} opacity={0.6} />
                ),
              )}
              <line x1={f.x(pop.mean)} x2={f.x(pop.mean)} y1={f.y0} y2={f.y1 + 6} stroke={INK} strokeWidth={1} strokeDasharray="3 3" />
              <text x={f.x(pop.mean) + 4} y={f.y1 + 14} fontSize={11} fill={INK} className="mono">μ = {f2(pop.mean)}</text>
            </>
          )}
        </Plot>
        <Plot box={{ x: 350, y: 0, w: 370, h: 300 }} xDomain={r.view} yDomain={[0, r.yMax]} xTicks={niceTicks(r.view[0], r.view[1])} yTicks={[]} xLabel={`${n} 次的平均（${pop.unit}）${zoomed ? "，横轴已放大" : ""}`} title={`${REPS} 个样本均值`} xFormat={fmtTick}>
          {(f) => (
            <>
              {r.hist.counts.map((c, i) => {
                const a = r.hist.edges[i];
                const b = r.hist.edges[i + 1];
                if (c === 0 || b < r.view[0] || a > r.view[1]) return null;
                const x0 = f.x(Math.max(a, r.view[0]));
                const x1 = f.x(Math.min(b, r.view[1]));
                return <rect key={i} x={x0 + 0.5} y={f.y(r.hist.density[i])} width={Math.max(1, x1 - x0 - 1)} height={f.y0 - f.y(r.hist.density[i])} fill={C_MEAN} opacity={0.55} style={{ transition: "y .3s, height .3s" }} />;
              })}
              <Curve frame={f} points={r.curve} color={C_NORM} width={2.2} />
              <line x1={f.x(pop.mean - r.se)} x2={f.x(pop.mean + r.se)} y1={f.y1 + 10} y2={f.y1 + 10} stroke={C_NORM} strokeWidth={1.5} />
              <text x={f.x(pop.mean)} y={f.y1 + 4} fontSize={11} textAnchor="middle" fill={C_NORM} className="mono">±σ/√n = {f2(r.se)}</text>
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: C_POP, opacity: 0.6 }} />总体（单次）</span>
        <span><i style={{ background: C_MEAN, opacity: 0.55 }} />{n} 次的平均，重复 {REPS} 遍</span>
        <span><i style={{ background: C_NORM }} />N(μ, σ²/n)</span>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>总体均值 μ</small><b>{f2(pop.mean)}</b></div>
        <div><small>总体标准差 σ</small><b>{f2(pop.sd)}</b></div>
        <div><small>理论 σ/√n</small><b>{f2(r.se)}</b></div>
        <div><small>均值实际的标准差</small><b>{f2(r.sdHat)}</b></div>
        <div><small>离正态还有多远</small><b>{f2(r.gap)}</b></div>
        <div><small>偏度</small><b>{f2(r.skew)}</b></div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

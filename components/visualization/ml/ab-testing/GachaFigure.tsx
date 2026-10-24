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
import { binomialCdf, binomialCriticalLow, binomialPmf, countTrue, drawPulls, normalPdf, proportionTest } from "@/lib/ml/clt";

// Page 4 of A/B Testing, the worked example. The banner says SSR is 1%. Under
// H0 the number of SSR in n pulls is Binomial(n, 0.01); the bars are that
// distribution, the curve is the CLT shortcut N(0.01n, n·0.01·0.99). Red bars
// are the rejection region at α = 5% (one-sided: "less than advertised"). Drag
// n and switch whether the game is honest or secretly running 0.7%.

const P0 = 0.01;
const ALPHA = 0.05;
const SIZES = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const DEFAULT_IDX = 3;
const POOL = 10000;
type Truth = "honest" | "nerfed";
const TRUTHS: { key: Truth; label: string; rate: number; seed: number }[] = [
  { key: "honest", label: "官方诚实：真的是 1%", rate: 0.01, seed: 31 },
  { key: "nerfed", label: "暗改了：其实只有 0.7%", rate: 0.007, seed: 34 },
];
const DEFAULT_TRUTH: Truth = "nerfed";
const NERFED_RATE = 0.007;
const C_H0 = "#76796f";
const C_NORM = "#eb6834";
const C_REJ = "#d03b3b";
const C_OBS = "#2a78d6";

// One seeded pull stream per scenario: growing n keeps the pulls already shown.
const PULLS: Record<Truth, boolean[]> = Object.fromEntries(TRUTHS.map((t) => [t.key, drawPulls(createRng(t.seed), POOL, t.rate)])) as Record<Truth, boolean[]>;

const fp = (p: number) => (p < 0.001 ? "< 0.001" : p.toFixed(3));
const pe = (p: number) => (p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`);
const pct = (p: number) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;

export default function GachaFigure() {
  const [idx, setIdx] = useState(DEFAULT_IDX);
  const [truth, setTruth] = useState<Truth>(DEFAULT_TRUTH);
  const n = SIZES[idx];

  const r = useMemo(() => {
    const k = countTrue(PULLS[truth], n);
    const test = proportionTest(k, n, P0, "less");
    const mean = n * P0;
    const sd = Math.sqrt(n * P0 * (1 - P0));
    const kStar = binomialCriticalLow(n, P0, ALPHA);
    const rejected = kStar >= 0 && k <= kStar;
    const pow = kStar >= 0 ? binomialCdf(kStar, n, NERFED_RATE) : 0;
    const lo = Math.max(0, Math.floor(mean - 4.5 * sd));
    const hi = Math.max(12, Math.ceil(mean + 4.5 * sd));
    const bars: { k: number; p: number }[] = [];
    for (let i = lo; i <= hi; i++) bars.push({ k: i, p: binomialPmf(i, n, P0) });
    const curve: (readonly [number, number])[] = [];
    for (let i = 0; i <= 120; i++) {
      const x = lo - 0.5 + ((hi - lo + 1) * i) / 120;
      curve.push([x, normalPdf(x, mean, sd)]);
    }
    const yMax = Math.max(...bars.map((b) => b.p), normalPdf(mean, mean, sd)) * 1.18;
    return { k, test, mean, sd, kStar, rejected, pow, lo, hi, bars, curve, yMax };
  }, [n, truth]);

  const approxOk = n * P0 >= 10;
  const approxNote = approxOk ? "" : ` n·p₀ = ${(n * P0).toFixed(1)} < 10，正态近似给的 p（${fp(r.test.pNormal)}）和精确值（${fp(r.test.pExact)}）差得不小，这时要信二项分布。`;
  const narr =
    truth === "honest"
      ? r.rejected
        ? `官方其实没骗人，可这 ${n} 抽只出了 ${r.k} 张（期望 ${r.mean.toFixed(1)}），精确 ${pe(r.test.pExact)} < 0.05，按规矩得判它「暗改了」。这就是 Type I error：α = 5% 说的就是诚实官方被冤枉的概率。${approxNote}`
        : `官方诚实：${n} 抽出了 ${r.k} 张，期望 ${r.mean.toFixed(1)}，精确 ${pe(r.test.pExact)}，落在 H0 下的正常范围，不进拒绝域。${r.kStar >= 0 ? `偶尔也会撞上 k ≤ ${r.kStar} 的那 5%，那就是 Type I error。` : `n 这么小时连 0 张都不够罕见（P(k = 0) > 5%），拒绝域是空的，什么结果都告不倒官方。`}${approxNote}`
      : r.rejected
        ? `n = ${n} 时出了 ${r.k} 张，期望应有 ${r.mean.toFixed(1)}，精确 ${pe(r.test.pExact)} < 0.05，进了拒绝域 k ≤ ${r.kStar}：可以说概率不是公示的 1%。真实 0.7% 时这个 n 的 power 是 ${pct(r.pow)}。${approxNote}`
        : `一个人的 ${n} 抽：出了 ${r.k} 张，期望 ${r.mean.toFixed(1)}，精确 ${pe(r.test.pExact)}，告不倒官方。真实只有 0.7% 时这个 n 的 power 只有 ${pct(r.pow)}：就算真暗改了，多半也抓不到。往右拖，让全服玩家一起记。${approxNote}`;
  const tone = truth === "honest" ? (r.rejected ? " is-bad" : "") : r.rejected ? " is-good" : " is-warn";

  return (
    <VisualizationFrame
      title="抽卡：公示 1% 的 SSR，抽 n 次出 k 张，能不能说它暗改了"
      description="H0：p = 1%，H1：p < 1%（单侧）。柱子是 H0 成立时 k 的分布 Binomial(n, 0.01)，橙线是中心极限定理给的正态近似，红柱是 α = 5% 的拒绝域，蓝点是你（或全服玩家）实际抽到的张数。"
    >
      <div className="viz-row">
        <Tabs options={TRUTHS} value={truth} onChange={setTruth} ariaLabel="真实概率" />
        <button type="button" className="viz-btn" onClick={() => { setIdx(DEFAULT_IDX); setTruth(DEFAULT_TRUTH); }}>重置</button>
      </div>
      <Slider label="一共抽了 n 次" value={idx} min={0} max={SIZES.length - 1} step={1} onChange={setIdx} display={String(n)} id="gacha-n" />

      <Figure width={720} height={300} label={`n = ${n}，出了 ${r.k} 张，期望 ${r.mean.toFixed(1)}，精确 ${pe(r.test.pExact)}`} minWidth={520}>
        <Plot box={{ x: 0, y: 0, w: 720, h: 300 }} xDomain={[r.lo - 0.5, r.hi + 0.5]} yDomain={[0, r.yMax]} xTicks={niceInt(r.lo, r.hi)} yTicks={[]} xLabel="n 抽里出的 SSR 张数 k" format={(v) => String(Math.round(v))}>
          {(f) => {
            const w = Math.max(1, (f.x(1) - f.x(0)) * 0.8);
            return (
              <>
                {r.bars.map((b) => {
                  const rej = r.kStar >= 0 && b.k <= r.kStar;
                  return <rect key={b.k} x={f.x(b.k) - w / 2} y={f.y(b.p)} width={w} height={Math.max(0, f.y0 - f.y(b.p))} fill={rej ? C_REJ : C_H0} opacity={rej ? 0.75 : 0.45} style={{ transition: "y .3s, height .3s" }} />;
                })}
                <Curve frame={f} points={r.curve} color={C_NORM} width={2} />
                {r.kStar >= 0 && (
                  <>
                    <line x1={f.x(r.kStar + 0.5)} x2={f.x(r.kStar + 0.5)} y1={f.y0} y2={f.y1 + 8} stroke={C_REJ} strokeWidth={1.2} strokeDasharray="5 3" />
                    <text x={f.x(r.kStar + 0.5) - 5} y={f.y1 + 14} fontSize={11.5} fontWeight={600} textAnchor="end" fill={C_REJ} className="mono">拒绝域 k ≤ {r.kStar}</text>
                  </>
                )}
                <line x1={f.x(r.mean)} x2={f.x(r.mean)} y1={f.y0} y2={f.y(normalPdf(r.mean, r.mean, r.sd))} stroke={C_H0} strokeWidth={1} strokeDasharray="2 3" />
                <text x={f.x(r.mean) + 5} y={f.y1 + 14} fontSize={11.5} fill={C_H0} className="mono">H0 期望 {r.mean.toFixed(1)}</text>
                <Marker frame={f} x={Math.min(Math.max(r.k, r.lo), r.hi)} y={0} color={C_OBS} label={`抽到 k = ${r.k}${r.k < r.lo ? " ←" : r.k > r.hi ? " →" : ""}`} side="above" r={5} />
              </>
            );
          }}
        </Plot>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: C_H0, opacity: 0.5 }} />H0 下 k 的分布 Binomial(n, 0.01)</span>
        <span><i style={{ background: C_REJ, opacity: 0.8 }} />拒绝域（面积 ≤ 5%）</span>
        <span><i style={{ background: C_NORM }} />正态近似 N(0.01n, n·0.01·0.99)</span>
        <span><i style={{ background: C_OBS }} />你抽到的</span>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>抽了 / 出了</small><b>{n} / {r.k}</b></div>
        <div><small>观测概率 p̂</small><b>{(r.test.pHat * 100).toFixed(2)}%</b></div>
        <div><small>H0 下期望 0.01 n</small><b>{r.mean.toFixed(1)}</b></div>
        <div><small>精确二项 p-value</small><b>{fp(r.test.pExact)}</b></div>
        <div><small>正态近似 p-value</small><b>{fp(r.test.pNormal)}</b></div>
        <div><small>拒绝域</small><b>{r.kStar >= 0 ? `k ≤ ${r.kStar}` : "空"}</b></div>
        <div><small>真是 0.7% 时这个 n 的 power</small><b>{pct(r.pow)}</b></div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

function niceInt(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span <= 15 ? 1 : span <= 30 ? 2 : span <= 60 ? 5 : span <= 120 ? 10 : 20;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(t);
  return out;
}

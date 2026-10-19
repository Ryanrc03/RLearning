"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import {
  type ConversionKind,
  correctedCvr,
  DELAY_PROFILES,
  DEMO_IMPRESSIONS,
  demoDelays,
  empiricalCdf,
  JOIN_WINDOWS,
  joinWithWindow,
  lognormalCdf,
} from "@/lib/ml/sampleJoin";

// Recommender Systems, last page: 400 impressions, 40 of them really convert,
// each after its own delay. Every converter is a dot at (delay, share arrived),
// so the dots trace the delay CDF. Drag the join window W: dots left of the
// line become positives, the rest are written into training as negatives.

const W = 720;
const H = 300;
const DEFAULT_KIND: ConversionKind = "order";
const DEFAULT_IDX = 2; // 2 hours
const X_TICKS = [0.5, 1, 2, 6, 24, 72, 168];
const C_POS = "#1baf7a";
const C_NEG = "#d03b3b";
const C_MODEL = "#2a78d6";

const lg = Math.log10;
const short = (h: number) => (h < 1 ? `${Math.round(h * 60)}m` : h < 24 ? `${h}h` : `${h / 24}d`);
const long = (h: number) => (h < 24 ? `${h} 小时` : `${h / 24} 天`);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const MODEL_XS = Array.from({ length: 81 }, (_, i) => -1 + (i / 80) * (lg(400) + 1));

export default function SampleJoinFigure() {
  const [kind, setKind] = useState<ConversionKind>(DEFAULT_KIND);
  const [idx, setIdx] = useState(DEFAULT_IDX);
  const w = JOIN_WINDOWS[idx];
  const profile = DELAY_PROFILES[kind];
  const delays = demoDelays(kind);
  const r = joinWithWindow(delays, DEMO_IMPRESSIONS, w);
  const expected = lognormalCdf(w, profile.medianHours, profile.sigma);
  const fixed = correctedCvr(r.measuredCvr, expected);
  const cdf = empiricalCdf(delays);
  const model = MODEL_XS.map((x) => [x, lognormalCdf(10 ** x, profile.medianHours, profile.sigma)] as const);
  const n = r.trueConversions;

  const reset = () => {
    setKind(DEFAULT_KIND);
    setIdx(DEFAULT_IDX);
  };

  const other = kind === "order" ? "切到「付费」，同一个窗口会漏掉大半。" : "对比「下单」，几小时的窗口就够了。";
  let tone = "is-good";
  let narr = `W = ${long(w)}：${r.labelled}/${n} 个真实转化都在窗口内到达，测得 CVR ${pct(r.measuredCvr)}，接近真实的 ${pct(r.trueCvr)}；样本 ${long(w)} 后出炉，标签和新鲜度都说得过去。${other}`;
  if (r.capture < 0.6) {
    tone = "is-bad";
    narr = `W = ${long(w)}：${n} 个真实转化只有 ${r.labelled} 个在窗口里到达，另外 ${r.falseNegatives} 个曝光被当成负样本写进训练集。测得 CVR ${pct(r.measuredCvr)} 只有真实 ${pct(r.trueCvr)} 的 ${Math.round(r.capture * 100)}%，模型会系统性地低估转化。${r.labelled > 0 && expected < 0.3 ? `这时除以 F(W) = ${pct(expected)} 校正得 ${pct(fixed)}：分母太小，几个样本的偶然就被放大十几倍。` : ""}往右拖窗口。`;
  } else if (r.capture < 0.95) {
    tone = "is-warn";
    narr = `W = ${long(w)}：抓到 ${r.labelled}/${n}，还有 ${r.falseNegatives} 个慢转化被标成负样本。按历史延迟分布，这个窗口应到 ${pct(expected)} 的转化，把测得 CVR 除以它，校正后 ≈ ${pct(fixed)}。`;
  } else if (w >= 72) {
    tone = "is-warn";
    narr = `W = ${long(w)}：几乎全标对了（${r.labelled}/${n}），代价是每条样本要等 ${long(w)} 才进训练，模型学到的是 ${long(w)} 前的用户；keyed state 里也要挂着 ${long(w)} 的全部曝光。`;
  }

  return (
    <VisualizationFrame
      title="样本拼接：转化晚到，窗口一关就成了负样本"
      description="400 次曝光里有 40 次真的会转化。每个点是一次转化：横轴是它晚于曝光多久到达（对数刻度），纵轴是到这时为止已到达的转化占比。虚线是历史延迟分布。"
    >
      <div className="viz-controls">
        <Tabs
          ariaLabel="转化类型"
          value={kind}
          onChange={setKind}
          options={(Object.keys(DELAY_PROFILES) as ConversionKind[]).map((k) => ({ key: k, label: DELAY_PROFILES[k].label }))}
        />
        <Slider label="join 窗口 W" value={idx} min={0} max={JOIN_WINDOWS.length - 1} step={1} onChange={setIdx} display={long(w)} id="sj-window" />
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <Figure width={W} height={H} label={`窗口 ${long(w)}，${n} 个转化标对 ${r.labelled} 个，测得 CVR ${pct(r.measuredCvr)}`}>
        <Plot
          box={{ x: 0, y: 0, w: W, h: H }}
          xDomain={[-1, lg(400)]}
          yDomain={[0, 1]}
          xTicks={X_TICKS.map(lg)}
          yTicks={[]}
          format={(v) => short(Number((10 ** v).toPrecision(3)))}
          xLabel="转化晚于曝光多久（对数刻度）"
          yLabel="已到达的转化占比"
        >
          {(f) => (
            <g>
              {[0.25, 0.5, 0.75, 1].map((t) => (
                <g key={t}>
                  <line x1={f.x0} y1={f.y(t)} x2={f.x1} y2={f.y(t)} stroke="#e4dfcb" />
                  <text x={f.x0 - 6} y={f.y(t) + 4} fontSize={11} textAnchor="end" fill="#76796f">{`${t * 100}%`}</text>
                </g>
              ))}
              <rect x={f.x0} y={f.y1} width={Math.max(0, f.x(lg(w)) - f.x0)} height={f.y0 - f.y1} fill="#fdf3cd" opacity={0.6} style={{ transition: "width .25s" }} />
              <text x={f.x0 + 8} y={f.y1 + 14} fontSize={11.5} fill="#8a6d00" fontWeight={600}>窗口内到达 → 正样本</text>
              <Curve frame={f} points={model} color={C_MODEL} dashed width={1.5} opacity={0.8} />
              {cdf.map(([d, s], i) => {
                const pos = d <= w;
                return <circle key={i} cx={f.x(lg(d))} cy={f.y(s)} r={4} fill={pos ? C_POS : "#fff"} stroke={pos ? C_POS : C_NEG} strokeWidth={1.6} style={{ transition: "fill .25s, stroke .25s" }} />;
              })}
              <line x1={f.x(lg(w))} y1={f.y1} x2={f.x(lg(w))} y2={f.y0} stroke="#3b4234" strokeWidth={2} strokeDasharray="5 3" style={{ transition: "x1 .25s, x2 .25s" }} />
              <text x={Math.min(f.x(lg(w)) + 6, f.x1 - 64)} y={f.y1 + 30} fontSize={11.5} fill="#3b4234" fontWeight={600}>W = {short(w)}</text>
              <Marker frame={f} x={lg(w)} y={r.capture} color={C_POS} label={`${r.labelled}/${n} 标成 1`} side={w >= 72 ? "left" : "right"} guides />
            </g>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: C_POS }} />窗口内到达，label = 1</span>
        <span><i style={{ background: "#fff", border: `1.6px solid ${C_NEG}` }} />窗口关了才到，被写成 label = 0</span>
        <span><i style={{ background: C_MODEL, height: 2, verticalAlign: 3 }} />历史延迟分布 F(W)</span>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>真实 CVR</small><b>{pct(r.trueCvr)}</b></div>
        <div><small>拼出来的 CVR</small><b>{pct(r.measuredCvr)}</b></div>
        <div><small>漏标成负样本</small><b>{r.falseNegatives}</b><span className="delta">/ {n}</span></div>
        <div><small>除以 F(W) 校正后</small><b>{pct(fixed)}</b></div>
        <div><small>样本出炉 / state 挂着</small><b>{short(w)}</b><span className="delta">的曝光</span></div>
      </div>

      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

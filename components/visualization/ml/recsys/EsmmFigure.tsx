"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { esmmCvr, esmmScenario, LEVELS, observedCvrByLevel, trueCvr } from "@/lib/ml/esmm";

// Recommender Systems, CTR / CVR / ESMM: 20 000 seeded impressions on nine
// levels of one feature. The slider sets how strongly click propensity follows
// that feature; the clicked subset drifts to the high levels, and the CVR you
// would read off clicked samples drifts away from the impression-space truth.
// The ESMM towers are trained on impression labels only (click, click ∧ conv).

const W = 720;
const H = 290;
const C_IMP = "#c9c4ad";
const C_CLICK = "#2a78d6";
const C_NAIVE = "#eb6834";
const C_ESMM = "#1baf7a";
const C_TRUE = "#30332c";
const DEFAULT_SLOPE = 1.5;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const fine = Array.from({ length: 41 }, (_, k) => -2 + k * 0.1);

export default function EsmmFigure() {
  const [slope, setSlope] = useState(DEFAULT_SLOPE);
  const s = useMemo(() => esmmScenario(slope), [slope]);
  const observed = observedCvrByLevel(s.rows);
  const impShare = s.rows.map((r) => r.imp / s.impressions);
  const clickShare = s.rows.map((r) => (s.clicks === 0 ? 0 : r.click / s.clicks));
  const highImp = s.rows.filter((r) => r.x >= 1).reduce((a, r) => a + r.imp, 0) / s.impressions;
  const highClick = s.rows.filter((r) => r.x >= 1).reduce((a, r) => a + r.click, 0) / s.clicks;
  const gap = s.clickSpace - s.impressionSpace;
  const maxClicks = Math.max(...s.rows.map((r) => r.click));

  const narr =
    slope === 0
      ? `s = 0：点不点和兴趣分无关，点击样本是曝光的随机抽样。点击样本上的 CVR ${pct(s.clickSpace)}，曝光空间的真实 CVR ${pct(s.impressionSpace)}，两者只差抽样噪声。往右拖，让高兴趣的人更爱点。`
      : `s = ${slope.toFixed(2)}：兴趣分 ≥ 1 的人只占曝光的 ${pct(highImp, 0)}，却占了点击的 ${pct(highClick, 0)}，而他们本来就更容易转化。所以只看点击样本，CVR 是 ${pct(s.clickSpace)}，比上线要打分的全部曝光上的 ${pct(s.impressionSpace)} 高 ${(gap * 100).toFixed(1)} 个点：CVR 模型训练时见到的人和上线时要打分的人不是同一群。低兴趣那几档点击寥寥（${s.rows[0].click === 0 ? "最左一档一次点击都没有" : `最左一档只有 ${s.rows[0].click} 次`}），CVR 在那里几乎没有标签。ESMM 不在点击子集上单独算 CVR 的 loss，只用全部曝光上的 click 和 click∧conv 两个标签训练两个塔，pCVR 在曝光上平均 ${pct(s.esmmImpressionSpace)}。`;
  const tone = gap > 0.1 ? " is-bad" : gap > 0.04 ? " is-warn" : " is-good";

  return (
    <VisualizationFrame
      title="CVR 的样本选择偏差：训练看点击，上线看曝光"
      description="2 万次曝光按一个特征「兴趣分」分成 9 档。点击概率随兴趣分上升，坡度由滑块控制；点击后的转化概率也随兴趣分上升，坡度固定。所有数都是这个固定种子的模拟算出来的。"
    >
      <div className="viz-row">
        <Slider label="点击随兴趣分变化的坡度 s" value={slope} min={0} max={2.5} step={0.25} onChange={setSlope} display={slope.toFixed(2)} id="esmm-slope" />
        <button type="button" className="viz-btn" onClick={() => setSlope(DEFAULT_SLOPE)}>重置</button>
      </div>

      <Figure width={W} height={H} label={`坡度 ${slope}，点击样本 CVR ${pct(s.clickSpace)}，曝光空间 CVR ${pct(s.impressionSpace)}，ESMM ${pct(s.esmmImpressionSpace)}`}>
        <Plot
          box={{ x: 0, y: 0, w: 350, h: H }}
          xDomain={[-2.4, 2.4]}
          yDomain={[0, 0.35]}
          xTicks={[-2, -1, 0, 1, 2]}
          yTicks={[0, 0.1, 0.2, 0.3]}
          title="每档占曝光 / 点击的比例"
          xLabel="兴趣分 x"
        >
          {(f) =>
            LEVELS.map((x, k) => {
              const bw = 11;
              return (
                <g key={x}>
                  <rect x={f.x(x) - bw - 1} y={f.y(impShare[k])} width={bw} height={f.y0 - f.y(impShare[k])} fill={C_IMP} rx={2} />
                  <rect x={f.x(x) + 1} y={f.y(Math.min(0.35, clickShare[k]))} width={bw} height={f.y0 - f.y(Math.min(0.35, clickShare[k]))} fill={C_CLICK} rx={2} style={{ transition: "y .3s, height .3s" }} />
                </g>
              );
            })
          }
        </Plot>
        <Plot
          box={{ x: 370, y: 0, w: 350, h: H }}
          xDomain={[-2.2, 2.2]}
          yDomain={[0, 1]}
          xTicks={[-2, -1, 0, 1, 2]}
          yTicks={[0, 0.25, 0.5, 0.75, 1]}
          title="CVR(x)：点了之后转化的概率"
          xLabel="兴趣分 x"
        >
          {(f) => (
            <>
              <Curve frame={f} points={fine.map((x) => [x, trueCvr(x)] as const)} color={C_TRUE} dashed width={1.5} />
              <Curve frame={f} points={fine.map((x) => [x, esmmCvr(s.esmm, x)] as const)} color={C_ESMM} width={2.5} opacity={0.85} />
              {LEVELS.map((x, k) => {
                const o = observed[k];
                if (o === null) return <text key={x} x={f.x(x)} y={f.y0 - 6} fontSize={11} textAnchor="middle" fill={C_NAIVE}>无</text>;
                const r = 2.5 + 6 * Math.sqrt(s.rows[k].click / maxClicks);
                return <circle key={x} cx={f.x(x)} cy={f.y(o)} r={r} fill={C_NAIVE} fillOpacity={0.75} stroke="#fff" strokeWidth={1} style={{ transition: "cy .3s, r .3s" }} />;
              })}
            </>
          )}
        </Plot>
      </Figure>

      <div className="viz-legend">
        <span><i style={{ background: C_IMP }} />曝光的分布（不随 s 变）</span>
        <span><i style={{ background: C_CLICK }} />点击的分布</span>
        <span><i style={{ background: C_NAIVE, borderRadius: 6 }} />每档 转化 / 点击（点越大点击越多）</span>
        <span><i style={{ background: C_TRUE, height: 2, verticalAlign: 3 }} />真实 CVR(x)</span>
        <span><i style={{ background: C_ESMM, height: 3, verticalAlign: 3 }} />ESMM 的 pCVR 塔</span>
      </div>

      <div className="viz-grid2 wide-left" style={{ marginTop: 12 }}>
        <div className="viz-panel">
          <h5>平均 CVR：在哪个空间上平均</h5>
          <Bars
            rows={[
              { label: "点击样本上", hint: "转化 / 点击", value: s.clickSpace, max: 0.6, color: C_NAIVE, text: pct(s.clickSpace) },
              { label: "曝光空间（真实）", hint: "Σ CVR(x) / 曝光", value: s.impressionSpace, max: 0.6, color: C_TRUE, text: pct(s.impressionSpace) },
              { label: "ESMM pCVR", hint: "在曝光上平均", value: s.esmmImpressionSpace, max: 0.6, color: C_ESMM, text: pct(s.esmmImpressionSpace) },
            ]}
          />
        </div>
        <div className="viz-stat">
          <div><small>曝光（CTR、CTCVR 的样本）</small><b>{s.impressions.toLocaleString("en-US")}</b></div>
          <div><small>点击（CVR 的样本）</small><b>{s.clicks.toLocaleString("en-US")}</b><span className="delta">{pct(s.clicks / s.impressions)}</span></div>
          <div><small>转化</small><b>{s.conversions.toLocaleString("en-US")}</b><span className="delta">CTCVR {pct(s.conversions / s.impressions, 2)}</span></div>
        </div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

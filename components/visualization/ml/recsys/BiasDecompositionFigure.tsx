"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import {
  BIAS_POINTS,
  DECOMP,
  DECOMP_CLICK_RATE,
  DECOMP_SETS,
  gapExplainedByPool,
  kendall,
  POOL_ROWS,
  rankOrder,
  spearman,
  type Stage,
  STAGE_LABEL,
} from "@/lib/ml/biasDecomposition";

// Recommender Systems, Day 5: (1) 26 learned click models, GAUC on the biased
// test tab1 vs on the random-exposure set, with the rank agreement computed
// here; (2) the same three models on tab1, on the tab1 rows whose video is in
// the random pool, and on random: ranking drops with the pool, calibration only
// with random exposure.

type View = "scatter" | "decomp";
const VIEWS = [
  { key: "scatter" as View, label: "26 个模型的排名" },
  { key: "decomp" as View, label: "落差拆分：视频池 vs 选择" },
];
const STAGE_COLOR: Record<Stage, string> = { "Day 1": "var(--v4)", "Day 2": "var(--v1)", "Day 3": "var(--v3)", "Day 4": "var(--v2)", "Day 5": "var(--vcrit)" };
const SET_COLOR = ["var(--v1)", "#9a9c8d", "var(--v3)"];
const W = 720;
const H = 320;

export default function BiasDecompositionFigure() {
  const [view, setView] = useState<View>("scatter");
  const sorted = useMemo(() => [...BIAS_POINTS].sort((a, b) => b.tab1 - a.tab1), []);
  const [k, setK] = useState(0);
  const rho = useMemo(() => spearman(BIAS_POINTS.map((p) => p.tab1), BIAS_POINTS.map((p) => p.random)), []);
  const tau = useMemo(() => kendall(BIAS_POINTS.map((p) => p.tab1), BIAS_POINTS.map((p) => p.random)), []);
  const rT = useMemo(() => rankOrder(BIAS_POINTS, "tab1"), []);
  const rR = useMemo(() => rankOrder(BIAS_POINTS, "random"), []);
  const p = sorted[k];

  const reset = () => {
    setView("scatter");
    setK(0);
  };

  const narr =
    view === "scatter"
      ? {
          tone: rT.get(p.run) === rR.get(p.run) ? "is-good" : Math.abs((rT.get(p.run) ?? 0) - (rR.get(p.run) ?? 0)) <= 3 ? "is-warn" : "is-bad",
          text: `#${p.run}（${STAGE_LABEL[p.stage]}，${p.features}）：tab1 GAUC ${p.tab1.toFixed(4)}，排第 ${rT.get(p.run)}；random ${p.random.toFixed(4)} [${p.lo.toFixed(4)}, ${p.hi.toFixed(4)}]，排第 ${rR.get(p.run)}。26 个模型两边排名的 Spearman ${rho.toFixed(3)}、Kendall ${tau.toFixed(2)}：树 < 深度 < 序列的大方向一致，头部几个模型的 random 区间互相重叠，次序换来换去。`,
        }
      : {
          tone: "is-good",
          text: `tab1 里视频属于 random 池的 ${POOL_ROWS.rows.toLocaleString("en-US")} 条曝光（${POOL_ROWS.users} 个用户、${POOL_ROWS.videos.toLocaleString("en-US")} 个视频）：这些视频由推荐策略推给用户，GAUC 就已经掉到 random 的水平，LightGBM 从 tab1 到 random 的落差有 ${Math.round(gapExplainedByPool(DECOMP[0]) * 100)}% 在这里出现，DIN ${Math.round(gapExplainedByPool(DECOMP[2]) * 100)}%。校准比却仍是 1.05 左右，只有真的随机推给用户时才跳到 2.65–2.70。排序的落差来自视频池，校准的落差来自选择。`,
        };

  return (
    <VisualizationFrame
      title="有偏集和随机集：排名大体一致，落差各有来源"
      description="左边切换两个视图。散点：kuairank Day 1–5 的 26 个 click 模型，横轴是有偏 test tab 1 的 GAUC，纵轴是随机曝光集的 GAUC；拖动选一个模型看它在两边的名次。拆分：同一个模型在三个集合上的 GAUC 与校准比。"
      footnote="数据：kuairank docs/figures/day5_bias_points.json（26 个模型，random 列带用户 bootstrap 95% 区间）与 docs/DEBIAS.zh-CN.md §5.2。Spearman / Kendall 在本页由这 26 对数计算。拆分视图的纵轴从 0.60 开始。"
    >
      <div className="viz-controls">
        <Tabs ariaLabel="视图" value={view} onChange={setView} options={VIEWS} />
        {view === "scatter" && (
          <Slider label="按 tab1 名次选模型" value={k} min={0} max={sorted.length - 1} step={1} onChange={setK} display={`#${p.run}`} id="bias-model" />
        )}
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>
      <Figure width={W} height={H} label={view === "scatter" ? `Spearman ${rho.toFixed(3)}` : "视频池与选择的拆分"}>
        {view === "scatter" ? (
          <Plot box={{ x: 0, y: 0, w: W, h: H }} xDomain={[0.64, 0.665]} yDomain={[0.605, 0.64]} xTicks={[0.64, 0.645, 0.65, 0.655, 0.66, 0.665]} yTicks={[0.61, 0.62, 0.63, 0.64]} format={(v) => v.toFixed(3)} xLabel="test tab 1 GAUC（有偏）" yLabel="random GAUC（无偏）">
            {(f) => (
              <>
                <line x1={f.x(p.tab1)} y1={f.y(Math.max(0.605, p.lo))} x2={f.x(p.tab1)} y2={f.y(Math.min(0.64, p.hi))} stroke={STAGE_COLOR[p.stage]} strokeWidth={5} opacity={0.3} strokeLinecap="round" />
                {BIAS_POINTS.map((q) => (
                  <circle key={q.run} cx={f.x(q.tab1)} cy={f.y(q.random)} r={q.run === p.run ? 7 : 4.5} fill={STAGE_COLOR[q.stage]} stroke={q.run === p.run ? "#3b4234" : "#fff"} strokeWidth={q.run === p.run ? 2 : 1} opacity={q.run === p.run ? 1 : 0.85} style={{ transition: "r .2s" }} />
                ))}
                <text x={f.x(p.tab1) + 10} y={f.y(p.random) - 8} fontSize={11.5} fontWeight={600} fill="#3b4234">#{p.run}</text>
                <text x={f.x0 + 8} y={f.y1 + 14} fontSize={11.5} fill="#3b4234">Spearman {rho.toFixed(3)} · Kendall {tau.toFixed(2)} · n = {BIAS_POINTS.length}</text>
              </>
            )}
          </Plot>
        ) : (
          <>
            <Plot box={{ x: 0, y: 0, w: 450, h: H }} xDomain={[0, 3]} yDomain={[0.6, 0.67]} xTicks={[]} yTicks={[0.6, 0.62, 0.64, 0.66]} format={(v) => v.toFixed(2)} yLabel="click GAUC" title="排序：GAUC">
              {(f) => (
                <>
                  {DECOMP.map((r, m) => (
                    <g key={r.model}>
                      {r.gauc.map((g, s) => {
                        const bw = 26;
                        const x = f.x(m + 0.5) + (s - 1) * (bw + 4) - bw / 2;
                        return (
                          <g key={s}>
                            <rect x={x} y={f.y(g)} width={bw} height={f.y0 - f.y(g)} fill={SET_COLOR[s]} opacity={0.85} />
                            <text x={x + bw / 2} y={f.y(g) - 4} fontSize={9.5} textAnchor="middle" fill="#3b4234" className="mono">{g.toFixed(3)}</text>
                          </g>
                        );
                      })}
                      <text x={f.x(m + 0.5)} y={f.y0 + 16} fontSize={11} textAnchor="middle" fill="#3b4234">{r.model} #{r.run}</text>
                    </g>
                  ))}
                </>
              )}
            </Plot>
            <Plot box={{ x: 470, y: 0, w: 250, h: H }} xDomain={[0, 2]} yDomain={[0, 3]} xTicks={[]} yTicks={[0, 1, 2, 3]} format={(v) => v.toFixed(0)} yLabel="预测均值 / 实际率" title="校准比">
              {(f) => (
                <>
                  <line x1={f.x0} y1={f.y(1)} x2={f.x1} y2={f.y(1)} stroke="#3b4234" strokeDasharray="4 3" opacity={0.6} />
                  {DECOMP.filter((r) => r.calib[0] !== null).map((r, m) => (
                    <g key={r.model}>
                      {r.calib.map((c, s) => {
                        const bw = 18;
                        const x = f.x(m + 0.5) + (s - 1) * (bw + 3) - bw / 2;
                        return (
                          <g key={s}>
                            <rect x={x} y={f.y(c ?? 0)} width={bw} height={f.y0 - f.y(c ?? 0)} fill={SET_COLOR[s]} opacity={0.85} />
                            <text x={x + bw / 2} y={f.y(c ?? 0) - 4} fontSize={9.5} textAnchor="middle" fill="#3b4234" className="mono">{(c ?? 0).toFixed(2)}</text>
                          </g>
                        );
                      })}
                      <text x={f.x(m + 0.5)} y={f.y0 + 16} fontSize={11} textAnchor="middle" fill="#3b4234">{r.model}</text>
                    </g>
                  ))}
                </>
              )}
            </Plot>
          </>
        )}
      </Figure>
      <div className="viz-legend">
        {view === "scatter"
          ? (Object.keys(STAGE_LABEL) as Stage[]).map((s) => (
              <span key={s}><i style={{ background: STAGE_COLOR[s] }} />{STAGE_LABEL[s]}</span>
            ))
          : DECOMP_SETS.map((s, i) => (
              <span key={s}><i style={{ background: SET_COLOR[i] }} />{s}（点击率 {DECOMP_CLICK_RATE[i]}）</span>
            ))}
      </div>
      <div className={`viz-narr ${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

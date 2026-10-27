"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { BIAS_WORLD, clickProb, simulateBias } from "@/lib/ml/exposureBias";

// Recommender Systems: a recommender that knows each user's taste shows liked
// authors more often (selectivity λ). The "model" is the user×author click rate
// those logs make possible. Left: one user's history, authors sorted by true
// taste. Right: GAUC of that feature on the recommender's own test exposures
// (blue) and on random exposures (green) as λ grows.

const W = 720;
const H = 300;
const LAMBDAS = Array.from({ length: 13 }, (_, i) => i * 0.25);
const C_STD = "var(--v1)";
const C_RAND = "var(--v3)";
const C_P = "var(--v4)";
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function ExposureBiasFigure() {
  const [li, setLi] = useState(5);
  const lambda = LAMBDAS[li];
  const all = useMemo(() => LAMBDAS.map((l) => simulateBias(l)), []);
  const r = all[li];
  const sorted = [...r.example].sort((a, b) => a.z - b.z);
  const maxShown = Math.max(8, ...all[all.length - 1].example.map((e) => e.shown));
  const even = BIAS_WORLD.history / BIAS_WORLD.authors;

  // left panel geometry
  const LX0 = 44;
  const LX1 = 340;
  const LY0 = H - 40;
  const LY1 = 30;
  const bw = (LX1 - LX0) / sorted.length;
  const ly = (n: number) => LY0 - (n / maxShown) * (LY0 - LY1);
  const py = (p: number) => LY0 - p * (LY0 - LY1);

  let tone = "is-good";
  let narr = `λ = 0：推荐策略不挑，常规日志和随机曝光是同一个分布。点击率 ${pct(r.ctrStandard)} 对 ${pct(r.ctrRandom)}，「用户×作者历史点击率」在两边的 GAUC 都约 ${r.gaucStandard.toFixed(2)}，差别只是抽样噪声。往右拖。`;
  if (lambda > 0 && lambda < 1) {
    tone = "is-warn";
    narr = `λ = ${lambda.toFixed(2)}：推荐开始偏向用户喜欢的作者，日志点击率升到 ${pct(r.ctrStandard)}，随机曝光不变（${pct(r.ctrRandom)}）。两条 GAUC 曲线开始分开。`;
  } else if (lambda >= 1) {
    tone = "is-bad";
    narr = `λ = ${lambda.toFixed(2)}：日志点击率 ${pct(r.ctrStandard)}，是随机曝光 ${pct(r.ctrRandom)} 的 ${(r.ctrStandard / r.ctrRandom).toFixed(1)} 倍。推荐曝光的作者 ${pct(r.coverageStandard)} 在历史里出现过，特征有话可说，GAUC ${r.gaucStandard.toFixed(3)}；随机曝光的作者只有 ${pct(r.coverageRandom)} 见过，其余只能给先验，GAUC 掉到 ${r.gaucRandom.toFixed(3)}。按日志基率打分，在随机集上平均高估 ${r.calibRandom.toFixed(1)} 倍。`;
  }

  return (
    <VisualizationFrame
      title="推荐策略越挑，日志上的分数越不能代表真实偏好"
      description={`玩具世界：${BIAS_WORLD.users} 个用户、${BIAS_WORLD.authors} 个作者，每个用户对每个作者有一个真实口味 z。推荐系统按 exp(λ·z) 的概率挑作者，攒出 ${BIAS_WORLD.history} 条历史；打分器是这段历史里「这个用户点这位作者的比例」。每个用户再各有 ${BIAS_WORLD.test} 条推荐曝光和 ${BIAS_WORLD.random} 条随机曝光用来评估。`}
      footnote={`点击概率 = σ(${BIAS_WORLD.slope}·z ${BIAS_WORLD.offset})，历史点击率用 (clicks + ${BIAS_WORLD.smoothA}·基率) / (n + ${BIAS_WORLD.smoothA}) 平滑，基率取历史日志的点击率。固定种子，刷新不变。`}
    >
      <div className="viz-controls">
        <Slider label="λ：推荐策略有多挑" value={li} min={0} max={LAMBDAS.length - 1} step={1} onChange={setLi} display={lambda.toFixed(2)} id="eb-lambda" />
        <button type="button" className="viz-btn" onClick={() => setLi(5)}>重置</button>
      </div>
      <Figure width={W} height={H} label={`λ ${lambda}：推荐集 GAUC ${r.gaucStandard.toFixed(3)}，随机集 GAUC ${r.gaucRandom.toFixed(3)}`}>
        <text x={LX0} y={16} fontSize={11.5} fontWeight={600} fill="#3b4234">用户 1 的历史：每位作者被推荐了几次</text>
        {[0, Math.round(maxShown / 2), maxShown].map((t) => (
          <g key={t}>
            <line x1={LX0} y1={ly(t)} x2={LX1} y2={ly(t)} stroke="#e4dfcb" />
            <text x={LX0 - 6} y={ly(t) + 4} fontSize={10.5} textAnchor="end" fill="#76796f">{t}</text>
          </g>
        ))}
        {sorted.map((e, i) => {
          const h = LY0 - ly(e.shown);
          return (
            <g key={e.author}>
              <rect x={LX0 + i * bw + 0.6} y={LY0 - h} width={Math.max(1, bw - 1.2)} height={h} fill={C_STD} opacity={0.75} style={{ transition: "y .3s, height .3s" }} />
              {e.clicks > 0 && <rect x={LX0 + i * bw + 0.6} y={LY0 - ((LY0 - LY1) * e.clicks) / maxShown} width={Math.max(1, bw - 1.2)} height={((LY0 - LY1) * e.clicks) / maxShown} fill={C_STD} style={{ transition: "y .3s, height .3s" }} />}
            </g>
          );
        })}
        <line x1={LX0} y1={ly(even)} x2={LX1} y2={ly(even)} stroke={C_RAND} strokeWidth={1.6} strokeDasharray="5 3" />
        <text x={LX1} y={ly(even) - 5} fontSize={10.5} textAnchor="end" fill={C_RAND}>随机曝光：每位平均 {even} 次</text>
        <path
          d={sorted.map((e, i) => `${i === 0 ? "M" : "L"}${LX0 + (i + 0.5) * bw} ${py(clickProb(e.z))}`).join(" ")}
          fill="none"
          stroke={C_P}
          strokeWidth={1.6}
        />
        <text x={LX1 + 4} y={LY1 + 4} fontSize={10.5} fill={C_P}>p=1</text>
        <text x={LX1 + 4} y={LY0 + 4} fontSize={10.5} fill={C_P}>0</text>
        <text x={LX0} y={LY0 + 16} fontSize={10.5} fill="#76796f">← 不喜欢</text>
        <text x={LX1} y={LY0 + 16} fontSize={10.5} textAnchor="end" fill="#76796f">喜欢 →</text>
        <text x={(LX0 + LX1) / 2} y={LY0 + 30} fontSize={10.5} textAnchor="middle" fill="#76796f">60 位作者按真实口味 z 排序</text>

        <Plot box={{ x: 370, y: 0, w: 350, h: H }} xDomain={[0, 3]} yDomain={[0.45, 0.72]} xTicks={[0, 1, 2, 3]} yTicks={[0.5, 0.6, 0.7]} format={(v) => (v < 0.45 || v > 3 ? "" : String(Math.round(v * 100) / 100))} xLabel="λ：推荐策略有多挑" title="用户×作者历史点击率的 GAUC">
          {(f) => (
            <>
              <line x1={f.x0} y1={f.y(0.5)} x2={f.x1} y2={f.y(0.5)} stroke="#9a9c8d" strokeDasharray="3 3" />
              <Curve frame={f} points={all.map((s) => [s.lambda, s.gaucStandard] as const)} color={C_STD} width={2.2} />
              <Curve frame={f} points={all.map((s) => [s.lambda, s.gaucRandom] as const)} color={C_RAND} width={2.2} />
              <Marker frame={f} x={lambda} y={r.gaucStandard} color={C_STD} label={r.gaucStandard.toFixed(3)} side="above" />
              <Marker frame={f} x={lambda} y={r.gaucRandom} color={C_RAND} label={r.gaucRandom.toFixed(3)} side="below" />
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: C_STD, opacity: 0.75 }} />推荐曝光（深色部分是点了的）</span>
        <span><i style={{ background: C_P, height: 2, verticalAlign: 3 }} />真实点击概率（右侧刻度 0–1）</span>
        <span><i style={{ background: C_STD }} />推荐测试集 GAUC</span>
        <span><i style={{ background: C_RAND }} />随机曝光集 GAUC</span>
      </div>
      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>点击率 推荐 / 随机</small><b>{pct(r.ctrStandard)}</b><span className="delta">/ {pct(r.ctrRandom)}</span></div>
        <div><small>作者在历史里见过</small><b>{pct(r.coverageStandard)}</b><span className="delta">/ {pct(r.coverageRandom)}</span></div>
        <div><small>GAUC 推荐 / 随机</small><b>{r.gaucStandard.toFixed(3)}</b><span className="delta">/ {r.gaucRandom.toFixed(3)}</span></div>
        <div><small>随机集校准比</small><b>{r.calibRandom.toFixed(2)}</b></div>
      </div>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

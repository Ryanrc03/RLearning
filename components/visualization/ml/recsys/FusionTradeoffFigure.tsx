"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { FUSION_TOY, fusedGauc, fusionMean, fusionToy, pearson, REAL_FUSION } from "@/lib/ml/multiTask";

// Recommender Systems, multi-task: one ranking score from two heads,
// score = log p_click + w · log p_like. The toy's click and like labels are
// nearly unrelated, so w trades one GAUC for the other. The panel shows the
// three weight settings kuairank evaluated on PLE #31's heads.

const C_CLICK = "var(--v1)";
const C_LIKE = "var(--v2)";
const C_MEAN = "#3b4234";
const W = 440;
const H = 300;
const WS = Array.from({ length: 41 }, (_, i) => i * 0.05);

export default function FusionTradeoffFigure() {
  const [w, setW] = useState(0);
  const rows = useMemo(() => fusionToy(), []);
  const curve = useMemo(() => WS.map((x) => ({ w: x, ...fusedGauc(rows, x) })), [rows]);
  const corr = useMemo(() => pearson(rows.map((r) => +r.click), rows.map((r) => +r.like)), [rows]);
  const likeRate = rows.filter((r) => r.like).length / rows.length;
  const cur = fusedGauc(rows, w);
  const at0 = curve[0];
  const best = curve.reduce((b, p) => (p.mean > b.mean ? p : b), curve[0]);

  const tone = w === 0 ? "is-bad" : Math.abs(w - best.w) < 0.11 ? "is-good" : "is-warn";
  const narr =
    w === 0
      ? `w = 0：只用 click 头排序。click GAUC ${cur.click.toFixed(3)}，like GAUC 只有 ${cur.like.toFixed(3)}：两个标签相关系数 ${corr.toFixed(2)}，会点进去的不一定会点赞。kuairank 的 PLE 只用 click 头时，like GAUC 是 0.493。`
      : `w = ${w.toFixed(2)}：like GAUC 从 ${at0.like.toFixed(3)} 升到 ${cur.like.toFixed(3)}，click 从 ${at0.click.toFixed(3)} 降到 ${cur.click.toFixed(3)}，两者均值 ${cur.mean.toFixed(3)}。${Math.abs(w - best.w) < 0.11 ? "这一带是均值最高的地方。" : w > best.w ? `均值在 w ≈ ${best.w.toFixed(2)} 最高，再往右是拿 click 换 like。` : "继续往右，均值还在涨。"}融合不是免费的：选权重就是在决定业务更看重哪个目标。`;

  return (
    <VisualizationFrame
      title="一个排序分，两个目标：乘法融合是一笔交换"
      description={`玩具：${FUSION_TOY.users} 个用户各 ${FUSION_TOY.items} 条曝光，点击率约 ${Math.round((rows.filter((r) => r.click).length / rows.length) * 100)}%、点赞率约 ${Math.round(likeRate * 100)}%，两个标签几乎无关。两个头各自打分，融合分 = log p_click + w · log p_like。拖 w，看每个用户内 click 和 like 的 GAUC 怎么变。`}
      footnote={`玩具数据：点击、点赞的潜在倾向相关系数 ${FUSION_TOY.rho}，每个头看到自己的倾向加噪声（标准差 ${FUSION_TOY.headNoise}）。右侧是 kuairank 的真实数字：PLE #31 的四个头，test tab 1，来自 docs/MTL.zh-CN.md §7。`}
    >
      <div className="viz-controls">
        <Slider label="w：like 头的权重" value={w} min={0} max={2} step={0.05} onChange={setW} display={w.toFixed(2)} id="fusion-w" />
        <button type="button" className="viz-btn" onClick={() => setW(0)}>重置</button>
      </div>
      <div className="viz-grid2 wide-left">
        <Figure width={W} height={H} label={`w ${w}：click GAUC ${cur.click.toFixed(3)}，like GAUC ${cur.like.toFixed(3)}`} minWidth={360}>
          <Plot box={{ x: 0, y: 0, w: W, h: H }} xDomain={[0, 2]} yDomain={[0.5, 0.82]} xTicks={[0, 0.5, 1, 1.5, 2]} yTicks={[0.5, 0.6, 0.7, 0.8]} xLabel="w（like 头的权重）" yLabel="用户内 GAUC">
            {(f) => (
              <>
                <Curve frame={f} points={curve.map((p) => [p.w, p.click] as const)} color={C_CLICK} width={2.2} />
                <Curve frame={f} points={curve.map((p) => [p.w, p.like] as const)} color={C_LIKE} width={2.2} />
                <Curve frame={f} points={curve.map((p) => [p.w, p.mean] as const)} color={C_MEAN} width={1.6} dashed />
                <line x1={f.x(w)} y1={f.y1} x2={f.x(w)} y2={f.y0} stroke="#9a9c8d" strokeDasharray="4 3" />
                <Marker frame={f} x={w} y={cur.click} color={C_CLICK} label={cur.click.toFixed(3)} side="right" />
                <Marker frame={f} x={w} y={cur.like} color={C_LIKE} label={cur.like.toFixed(3)} side="right" />
              </>
            )}
          </Plot>
        </Figure>
        <div className="viz-panel">
          <h5>kuairank：PLE #31，test tab 1</h5>
          <table className="viz-table">
            <thead>
              <tr><th>(click, lv, like)</th><th className="num">click</th><th className="num">like</th><th className="num">三目标均值</th></tr>
            </thead>
            <tbody>
              {REAL_FUSION.map((s) => (
                <tr key={s.label}>
                  <td>{s.label}<br /><span className="viz-mono">({s.w.join(", ")})</span></td>
                  <td className="num">{s.tab1[0].toFixed(4)}</td>
                  <td className="num">{s.tab1[2].toFixed(4)}</td>
                  <td className="num">{fusionMean(s.tab1).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="viz-k" style={{ marginTop: 10 }}>
            valid 上选出的 (1, 0.5, 0.25) 让 like +0.042、click −0.012；三目标均值是 click、long_view、like 三个 GAUC 的平均。
          </p>
        </div>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: C_CLICK }} />click GAUC</span>
        <span><i style={{ background: C_LIKE }} />like GAUC</span>
        <span><i style={{ background: C_MEAN, height: 2, verticalAlign: 3 }} />两者均值</span>
      </div>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

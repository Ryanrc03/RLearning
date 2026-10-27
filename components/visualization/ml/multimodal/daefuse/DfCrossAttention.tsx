"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { crossAttend } from "@/lib/ml/daefuse";

// Section 3.3, Eq. 4: cross-attention between the two modalities' tokens.
// Four tokens per modality (person, car, wall, road) with 4-d features whose
// axes are named so the numbers can be read. W_q = W_k = W_v = I, so the
// scores are plain dot products; the real model learns the three projections.

type Dir = "ir2vis" | "vis2ir";
const NAMES = ["人", "车", "墙", "路"];
const DIMS = ["人形热源", "车辆轮廓", "纹理", "背景"];
const IR = [
  [4, 0, 0.2, 0.4],
  [0.6, 1, 0.1, 0.6],
  [0, 0, 0.2, 2.4],
  [0, 0, 0, 3],
];
const VIS = [
  [1.2, 0, 0.8, 1.6],
  [0, 4, 1.2, 0.4],
  [0, 0, 3.6, 1.2],
  [0.2, 0, 0.8, 2.4],
];
const C_IR = "#2a78d6";
const C_VIS = "#1baf7a";
const fmtV = (v: number[]) => `[${v.map((x) => x.toFixed(1)).join(", ")}]`;

export default function DfCrossAttention() {
  const [dir, setDir] = useState<Dir>("ir2vis");
  const [qi, setQi] = useState(0);
  const Qs = dir === "ir2vis" ? IR : VIS;
  const KV = dir === "ir2vis" ? VIS : IR;
  const qName = dir === "ir2vis" ? "红外" : "可见光";
  const kName = dir === "ir2vis" ? "可见光" : "红外";
  const qc = dir === "ir2vis" ? C_IR : C_VIS;
  const kc = dir === "ir2vis" ? C_VIS : C_IR;
  const row = crossAttend(Qs[qi], KV, KV);
  const matrix = Qs.map((q) => crossAttend(q, KV, KV).weights);
  const top = row.weights.indexOf(Math.max(...row.weights));

  return (
    <VisualizationFrame
      title="Cross-attention：一种模态的 query 去另一种模态里找对应的信息"
      description="每种模态 4 个 token（人、车、墙、路），每个 token 是一个 4 维特征，维度依次叫「人形热源、车辆轮廓、纹理、背景」。选方向和 query，看 q·k / √d → softmax → 对 value 加权求和。"
      footnote="示意值：特征是手写的，W_q = W_k = W_v = I，d_k = 4。论文式 (4) 写的是 α → β 一个方向；图 2 画的是两个方向都做，各得到一组 attention-guided embedding。"
    >
      <div className="viz-row">
        <Tabs options={[{ key: "ir2vis", label: "Q = 红外，K / V = 可见光" }, { key: "vis2ir", label: "Q = 可见光，K / V = 红外" }]} value={dir} onChange={(d) => { setDir(d); setQi(d === "ir2vis" ? 0 : 1); }} ariaLabel="方向" />
      </div>
      <div className="viz-row">
        <span className="viz-k">{qName}的 query：</span>
        <div className="viz-chips" role="group" aria-label="query token">
          {NAMES.map((n, i) => (
            <button key={n} type="button" className={`viz-chip${qi === i ? " is-on" : ""}`} aria-pressed={qi === i} onClick={() => setQi(i)}>{n}</button>
          ))}
        </div>
      </div>
      <div className="viz-grid2 wide-left">
        <div className="viz-panel">
          <h5>q = {qName}「{NAMES[qi]}」 = <span className="viz-mono" style={{ color: qc }}>{fmtV(Qs[qi])}</span></h5>
          <div className="viz-scroll"><table className="viz-table">
            <thead><tr><th style={{ whiteSpace: "nowrap" }}>{kName}</th><th className="num">k</th><th className="num">q·k / 2</th><th>权重</th></tr></thead>
            <tbody>
              {KV.map((k, i) => (
                <tr key={i} style={{ fontWeight: i === top ? 600 : 400 }}>
                  <td style={{ color: kc }}>{NAMES[i]}</td>
                  <td className="num">{fmtV(k)}</td>
                  <td className="num">{row.scores[i].toFixed(2)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div className="viz-stack" style={{ width: 56, display: "inline-flex", verticalAlign: "middle" }}><span style={{ width: `${row.weights[i] * 100}%`, background: kc }} /></div>
                    <span className="viz-mono" style={{ marginLeft: 6 }}>{(row.weights[i] * 100).toFixed(0)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="viz-mono" style={{ marginTop: 8 }}>输出 = Σ 权重 · v = {fmtV(row.out)}</p>
          <p className="viz-k">各维：{DIMS.map((d, i) => `${d} ${row.out[i].toFixed(2)}`).join("　")}</p>
        </div>
        <div className="viz-panel">
          <h5>整张 attention 矩阵（行 = {qName} query）</h5>
          <svg viewBox="0 0 200 190" role="img" aria-label="4 × 4 cross-attention 权重矩阵">
            {NAMES.map((n, j) => <text key={`c${j}`} x={58 + j * 36} y={14} fontSize={10} textAnchor="middle" fill={kc}>{n}</text>)}
            {matrix.map((r, i) => (
              <g key={i}>
                <text x={30} y={42 + i * 36} fontSize={10} textAnchor="end" fill={qc}>{NAMES[i]}</text>
                {r.map((w, j) => (
                  <g key={j}>
                    <rect x={40 + j * 36} y={22 + i * 36} width={34} height={34} rx={3} fill="#2a78d6" fillOpacity={0.08 + w * 0.85} stroke={i === qi ? "#3b4234" : "none"} strokeWidth={i === qi ? 2 : 0} />
                    <text x={57 + j * 36} y={43 + i * 36} fontSize={9.5} textAnchor="middle" fill={w > 0.5 ? "#fff" : "#30332c"} className="mono">{(w * 100).toFixed(0)}</text>
                  </g>
                ))}
              </g>
            ))}
          </svg>
          <p className="viz-k">每行加起来是 100%。</p>
        </div>
      </div>
      <div className="viz-narr">
        {dir === "ir2vis" && qi === 0
          ? `红外的「人」是一个很强的热源向量。它和可见光的「人」点积最大（${row.scores[0].toFixed(2)}），拿走 ${(row.weights[0] * 100).toFixed(0)}% 的权重，于是输出里多了可见光那边人的纹理分量（${row.out[2].toFixed(2)}）。红外本来看不到衣服的纹理，现在从可见光里「借」来了。这比直接把两边特征逐元素相加强：相加时每个位置只能和同一位置相加，attention 让它按内容去找。`
          : dir === "vis2ir" && qi === 1
            ? `反过来：可见光的「车」去红外里找，和红外的「车」最像（${(row.weights[1] * 100).toFixed(0)}%），借回来的是红外那边车的少量热源信息。两个方向各做一次，两组输出拼接后交给解码器。`
            : `${qName}的「${NAMES[qi]}」把 ${(row.weights[top] * 100).toFixed(0)}% 的权重给了${kName}的「${NAMES[top]}」。权重由内容相似度决定，不由位置决定：这就是 cross-attention 比逐元素相加多出来的东西。`}
      </div>
    </VisualizationFrame>
  );
}

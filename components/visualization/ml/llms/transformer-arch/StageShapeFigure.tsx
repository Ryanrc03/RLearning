"use client";

import { useState } from "react";
import { BASE, causalAllowed, shapeText, stageShapes, type AttentionStage } from "@/lib/ml/transformerArch";
import { BahFrame, Legend, P } from "../bahdanau/shared";

const STAGES: { key: AttentionStage; label: string }[] = [
  { key: "encSelf", label: "Encoder Self-Attn" },
  { key: "decSelf", label: "Decoder Masked Self-Attn" },
  { key: "decCross", label: "Decoder Cross-Attn" },
];
const CELL = 34;
const GX = 96;
const GY = 58;

export default function StageShapeFigure() {
  const [stage, setStage] = useState<AttentionStage>("decCross");
  const s = stageShapes(stage);
  const allowed = causalAllowed(BASE.t);
  const rows: [string, string, string][] = [
    ["Q（单 head）", shapeText(s.q), `${s.querySource}，${s.nQuery} 个位置`],
    ["K（单 head）", shapeText(s.k), `${s.keySource}，${s.nKey} 个位置`],
    ["V（单 head）", shapeText(s.v), `${s.keySource}，${s.nKey} 个位置`],
    ["Score = KᵀQ", shapeText(s.scores), `${s.nKey} 个 Key × ${s.nQuery} 个 Query${s.causal ? "，带因果 mask" : ""}`],
    ["单 head 输出", shapeText(s.headOut), "一个 Query 一列"],
    [`${BASE.heads} 个 head 拼接`, shapeText(s.concat), `${BASE.heads} × ${s.headOut[0]} = ${s.concat[0]}`],
    ["经过 W_O 的输出", shapeText(s.out), "列数跟 Query"],
  ];
  const gw = s.nQuery * CELL;
  const gh = s.nKey * CELL;

  return (
    <BahFrame
      title="图 7 · 三处 Attention 的形状：Q、K、V 各有几列"
      description={`固定 m = ${BASE.m}、t = ${BASE.t}、d_model = ${BASE.dModel}、${BASE.heads} 个 head。选一处 Attention，看它的 Q、K、V、Score 和输出。`}
      footnote={<>列向量写法：每个 token 一列，Score 写成 KᵀQ，行是 Key、列是 Query。PyTorch 一类每个 token 一行的代码算的是 QKᵀ，形状是它的转置（这里是 {shapeText(s.scoresRowConvention)}），内容相同。所有形状都由同一份配置推出。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择 Attention">
        {STAGES.map((x) => (
          <button key={x.key} type="button" aria-pressed={stage === x.key} className={`viz-btn${stage === x.key ? " is-on" : ""}`} onClick={() => setStage(x.key)}>{x.label}</button>
        ))}
      </div>
      <div className="viz-grid2 wide-left">
        <div className="viz-scroll">
          <table className="viz-table">
            <thead><tr><th>量</th><th>形状</th><th>来自 / 说明</th></tr></thead>
            <tbody>
              {rows.map(([name, shape, note]) => (
                <tr key={name}><td>{name}</td><td className="viz-mono"><b>{shape}</b></td><td>{note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <svg viewBox="0 0 280 230" role="img" aria-label={`Score 矩阵示意：${s.nKey} 行 Key，${s.nQuery} 列 Query${s.causal ? "，上三角以外的位置被因果 mask 挡住" : ""}`} style={{ maxWidth: 300 }}>
          <text x={GX + gw / 2} y={18} fontSize={10} fontWeight={600} textAnchor="middle" fill={P.ink}>Score 矩阵 {shapeText(s.scores)}</text>
          <text x={GX + gw / 2} y={34} fontSize={9} textAnchor="middle" fill={P.sub}>列：Query（{s.querySource}）</text>
          {Array.from({ length: s.nQuery }, (_, j) => (
            <text key={j} x={GX + j * CELL + CELL / 2} y={GY - 7} fontSize={9} textAnchor="middle" fill={P.ink}>q{j + 1}</text>
          ))}
          {Array.from({ length: s.nKey }, (_, i) => (
            <g key={i}>
              <text x={GX - 7} y={GY + i * CELL + CELL / 2 + 3} fontSize={9} textAnchor="end" fill={P.ink}>k{i + 1}</text>
              {Array.from({ length: s.nQuery }, (_, j) => {
                const ok = !s.causal || allowed[j][i];
                return (
                  <g key={j}>
                    <rect x={GX + j * CELL + 1} y={GY + i * CELL + 1} width={CELL - 2} height={CELL - 2} rx={4} fill={ok ? P.attFill : P.surface} stroke={ok ? P.att : P.grey} strokeWidth={ok ? 1.2 : 0.8} strokeDasharray={ok ? undefined : "3 3"} />
                    {!ok && <text x={GX + j * CELL + CELL / 2} y={GY + i * CELL + CELL / 2 + 4} fontSize={11} textAnchor="middle" fill={P.sub}>×</text>}
                  </g>
                );
              })}
            </g>
          ))}
          <text x={GX - 34} y={GY + gh / 2} fontSize={9} textAnchor="middle" fill={P.sub} transform={`rotate(-90 ${GX - 34} ${GY + gh / 2})`}>行：Key（{s.keySource}）</text>
          <text x={GX + gw / 2} y={GY + gh + 18} fontSize={9} textAnchor="middle" fill={P.sub}>softmax 沿每一列（对 Key）归一化</text>
        </svg>
      </div>
      <Legend items={[{ tone: "att", label: "可以读的位置" }, { tone: "grey", label: "被因果 mask 挡住（只在 Masked Self-Attn 里有）" }]} />
      <div className={`viz-narr ${stage === "decCross" ? "is-good" : ""}`} aria-live="polite">
        {stage === "encSelf" && <>Encoder Self-Attention：Q、K、V 都来自 Encoder 自己的 {BASE.m} 个位置，Score 是 {shapeText(s.scores)} 的方阵，输出 {shapeText(s.out)}。</>}
        {stage === "decSelf" && <>Decoder Masked Self-Attention：Q、K、V 都来自 Decoder 的 {BASE.t} 个位置，Score 是 {shapeText(s.scores)}，后面的 Key 被挡住（图中的 ×）。输出 {shapeText(s.out)}。</>}
        {stage === "decCross" && <>Decoder Cross-Attention：Query 来自 Decoder 的 {BASE.t} 个位置，Key 和 Value 来自 Encoder 输出 U 的 {BASE.m} 个位置。Score 是 {shapeText(s.scores)}（{BASE.m} 个 Key × {BASE.t} 个 Query），输出是 {shapeText(s.out)}：列数是 {BASE.t}，跟 Query，不跟 Key。</>}
      </div>
    </BahFrame>
  );
}

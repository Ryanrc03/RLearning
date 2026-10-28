"use client";
import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { rankDecay } from "@/lib/ml/scoreFusion";

export default function RankDecayFigure() {
  const [alpha, setAlpha] = useState(1);
  const [beta, setBeta] = useState(1);
  const ranks = Array.from({ length: 20 }, (_, i) => i+1);
  const x = (r: number) => 60 + (r-1)/19 * 600;
  const y = (value: number) => 285 - value * 230;
  const first = rankDecay(1, alpha, beta);
  const last = rankDecay(20, alpha, beta);
  return <div className="ranking-viz chapter34-viz"><VisualizationFrame title="Rank Decay Explorer" description="纵轴固定为 0–1，观察 α 与 β 怎样改变名次贡献。">
    <div className="viz-body">
      <Slider label="α · 衰减指数" value={alpha} min={0.2} max={3} step={0.1} display={alpha.toFixed(1)} onChange={setAlpha} />
      <Slider label="β · 平滑" value={beta} min={0} max={10} step={0.5} display={beta.toFixed(1)} onChange={setBeta} />
      <button type="button" className="viz-btn" onClick={() => { setAlpha(1); setBeta(1); }}>重置</button>
      <Figure width={720} height={340} label={`排名衰减曲线，alpha ${alpha}，beta ${beta}`}>
        {[0,0.25,0.5,0.75,1].map(t => <g key={t}><line x1={60} x2={660} y1={y(t)} y2={y(t)} stroke="var(--vline)" /><text x={48} y={y(t)+4} textAnchor="end" fill="var(--muted)" fontSize={12}>{t}</text></g>)}
        <line x1={60} x2={660} y1={285} y2={285} stroke="var(--muted)" />
        {[1,5,10,15,20].map(r => <text key={r} x={x(r)} y={305} textAnchor="middle" fill="var(--muted)" fontSize={12}>{r}</text>)}
        <text x={360} y={330} textAnchor="middle" fill="var(--muted)" fontSize={12}>名次 r</text>
        <text x={60} y={28} fill="var(--ink)" fontSize={13}>f(r) = 1 / (r^{alpha.toFixed(1)} + {beta.toFixed(1)})</text>
        <polyline points={ranks.map(r => `${x(r)},${y(rankDecay(r,alpha,beta))}`).join(" ")} fill="none" stroke="var(--v1)" strokeWidth={2.5} />
        {ranks.map(r => <circle key={r} cx={x(r)} cy={y(rankDecay(r,alpha,beta))} r={3} fill="var(--v1)"><title>{`r=${r}, f(r)=${rankDecay(r,alpha,beta).toFixed(5)}`}</title></circle>)}
      </Figure>
      <p className="viz-narr" aria-live="polite">第 1 名贡献 {first.toFixed(4)}，第 20 名贡献 {last.toFixed(4)}；后者是前者的 {(last/first*100).toFixed(1)}%。增大 α 会压低 r&gt;1 的贡献；增大 β 会降低绝对贡献，同时缩小名次间的相对差距。</p>
    </div>
  </VisualizationFrame></div>;
}

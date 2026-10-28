"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { mixtureTimeOptimum, watchTimeTransform } from "@/lib/ml/watchTime";

const anchors = [0, 1, 9, 99];
const points = Array.from({ length: 301 }, (_, t) => watchTimeTransform(t));
const x = (t: number) => 55 + t / 300 * 625;
const y = (p: number) => 242 - p * 210;
const mixture = mixtureTimeOptimum([1, 9], [0.5, 0.5]);

export default function WatchTimeFigure() {
  const [seconds, setSeconds] = useState(9);
  const v = watchTimeTransform(seconds);
  return <div className="ranking-viz chapter34-viz">
    <VisualizationFrame title="观看时长 → Soft Label → 理想 Logit → exp 推理" description="时间单位固定为秒，假设单个确定目标被精确拟合。这里是代数变换，不是在浏览器里训练模型。">
      <div className="viz-row"><Slider label="观看时长 t（秒）" min={0} max={300} value={seconds} onChange={setSeconds} display={`${seconds}s`} /><button type="button" className="viz-btn" onClick={() => setSeconds(9)}>重置</button></div>
      <Figure width={720} height={290} minWidth={500} label={`标签曲线 y=t/(1+t)。当前 t=${seconds} 秒，y=${v.label.toFixed(4)}；标出 t=0、1、9、99 的位置。`}>
        {[0, 0.5, 1].map((p) => <g key={p}><line x1="55" x2="680" y1={y(p)} y2={y(p)} stroke="var(--vline)" /><text x="44" y={y(p)+4} textAnchor="end" fontSize="12" fill="var(--muted)">{p}</text></g>)}
        {[0, 100, 200, 300].map((t) => <text key={t} x={x(t)} y="263" textAnchor="middle" fontSize="12" fill="var(--muted)">{t}</text>)}
        <text x="58" y="18" fill="var(--ink)" fontSize="12">y = t / (1 + t)</text><text x="680" y="283" textAnchor="end" fill="var(--muted)" fontSize="12">观看时长 t / 秒</text>
        <path d={points.map((p,i)=>`${i===0?'M':'L'}${x(p.time)},${y(p.label)}`).join(' ')} stroke="var(--v1)" strokeWidth="2.5" fill="none" />
        {anchors.map((t)=><circle key={t} cx={x(t)} cy={y(watchTimeTransform(t).label)} r="4" fill="var(--paper)" stroke="var(--v1)" strokeWidth="2"><title>{`t=${t}，y=${watchTimeTransform(t).label.toFixed(2)}`}</title></circle>)}
        <line x1={x(seconds)} x2={x(seconds)} y1={y(v.label)} y2="242" stroke="var(--v2)" strokeDasharray="4 3" />
        <circle cx={x(seconds)} cy={y(v.label)} r="6" fill="var(--v2)" />
      </Figure>
      <div className="viz-stat"><div><small>真实时长 t</small><b>{seconds} s</b></div><div><small>训练标签 y = p*</small><b>{v.label.toFixed(6)}</b></div><div><small>理想 z = ln(t)</small><b>{seconds===0?'−∞':v.logit.toFixed(4)}</b></div><div><small>推理 exp(z)</small><b>{v.inferred.toFixed(2)} s</b></div></div>
      <div className="viz-scroll"><table className="viz-table"><caption>曲线上的四个关键点（由公式计算）</caption><thead><tr><th>t / 秒</th>{anchors.map(t=><th key={t}>{t}</th>)}</tr></thead><tbody><tr><th>y</th>{anchors.map(t=><td key={t}>{watchTimeTransform(t).label.toFixed(2)}</td>)}</tr></tbody></table></div>
      <div className="viz-narr" aria-live="polite">{seconds===0?'t = 0 时标签为 0，理想 logit 只能趋向 −∞；任何有限 z 的 Sigmoid 都大于 0。exp(−∞) 的极限为 0。':`t=${seconds} 秒映射成 y=${v.label.toFixed(6)}。越接近 1，同样的时长差被压缩得越明显；按理想 logit 反变换仍得到 ${v.inferred.toFixed(2)} 秒。`}</div>
      <details className="chapter34-details"><summary>Show Derivation · 为什么 exp(z) = t？</summary><div className="ranking-equation">exp(z)/(1 + exp(z)) = t/(1 + t)<br />exp(z)(1 + t) = t(1 + exp(z))<br />exp(z) = t</div><p>仅对固定、可精确拟合的目标成立。若同一输入对应 1 秒或 9 秒，各一半概率，则 p*={mixture.label.toFixed(2)}，代理时长={mixture.proxy.toFixed(4)} 秒，而平均时长={mixture.mean.toFixed(1)} 秒。</p></details>
    </VisualizationFrame>
  </div>;
}

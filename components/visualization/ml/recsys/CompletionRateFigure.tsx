"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import Bars from "@/components/visualization/ml/primitives/Bars";
import { completionScore, lengthBaseline } from "@/lib/ml/watchTime";

type Video = { duration: number; prediction: number; baseline: number; manual: boolean };
const initial: Video[] = [{duration:15,prediction:0.5,baseline:0.5,manual:false},{duration:180,prediction:0.3,baseline:0.1,manual:false}];
const colors = ["var(--v1)","var(--v2)"];
const px=(L:number)=>55+(L-5)/295*625;
const py=(p:number)=>235-p*205;
const curve = Array.from({length:296},(_,i)=>({L:i+5,p:lengthBaseline(i+5)}));
const pct=(p:number)=>`${(100*p).toFixed(1)}%`;

export default function CompletionRateFigure() {
  const [videos,setVideos]=useState<Video[]>(initial);
  const [selected,setSelected]=useState<"a"|"b">("a");
  const [mode,setMode]=useState<"raw"|"normalized">("raw");
  const index=selected==='a'?0:1;
  const v=videos[index];
  const normalized=videos.map(d=>completionScore(d.prediction,d.baseline));
  const scores=videos.map((d,i)=>mode==='raw'?d.prediction:normalized[i].score);
  const order=[0,1].sort((a,b)=>scores[b]-scores[a] || a-b);
  const tie=Math.abs(scores[0]-scores[1])<1e-10;
  const change=(update:Partial<Video>)=>setVideos(prev=>prev.map((d,i)=>i===index?{...d,...update}:d));
  const reset=()=>{setVideos(initial);setSelected('a');setMode('raw');};
  return <div className="ranking-viz chapter34-viz">
    <VisualizationFrame title="完播率：原始概率与同长度基准的相对表现" description="示例数据。实心点是预测概率，空心点是当前基准。曲线 f_demo(L)=0.5 exp(−ln(5)(L−15)/165) 仅作教学示意，不是真实业务统计。">
      <div className="viz-row"><Tabs options={[{key:'raw',label:'Raw Completion'},{key:'normalized',label:'Normalized Completion'}]} value={mode} onChange={setMode} ariaLabel="完播排序方式" /><button type="button" className="viz-btn" onClick={reset}>重置</button></div>
      <div className="viz-row"><Tabs options={[{key:'a',label:'编辑 Video A'},{key:'b',label:'编辑 Video B'}]} value={selected} onChange={setSelected} ariaLabel="选择编辑视频" /><button type="button" className="viz-btn" onClick={()=>{setVideos([{...initial[0],prediction:.4},initial[1]]);setMode('normalized');setSelected('a');}}>课程例子：0.80 vs 3.00</button></div>
      <div className="chapter34-controls">
        <Slider label="视频时长 L（秒）" min={5} max={300} value={v.duration} display={`${v.duration}s`} onChange={duration=>change({duration,baseline:Math.round(lengthBaseline(duration)*1000)/1000,manual:false})} />
        <Slider label="预测完播概率" min={0} max={1} step={0.01} value={v.prediction} display={pct(v.prediction)} onChange={prediction=>change({prediction})} />
        <Slider label="长度基准 f(L)" min={0} max={1} step={0.001} value={v.baseline} display={pct(v.baseline)} onChange={baseline=>change({baseline,manual:true})} />
      </div>
      <div className="viz-k">改变时长会恢复该视频的曲线基准（四舍五入到 0.001）；手动调整基准仅覆盖此点，不改变示意曲线。</div>
      <Figure width={720} height={280} minWidth={500} label="随视频时长增加而下降的教学基准曲线，以及 A、B 的预测完播率与基准点">
        {[0,.5,1].map(p=><g key={p}><line x1="55" x2="680" y1={py(p)} y2={py(p)} stroke="var(--vline)" /><text x="44" y={py(p)+4} textAnchor="end" fill="var(--muted)" fontSize="12">{pct(p)}</text></g>)}
        {[15,100,180,300].map(L=><text key={L} x={px(L)} y="256" textAnchor="middle" fill="var(--muted)" fontSize="12">{L}</text>)}
        <text x="58" y="17" fill="var(--ink)" fontSize="12">预测 / 基准完播概率</text><text x="680" y="276" textAnchor="end" fill="var(--muted)" fontSize="12">视频时长 L / 秒</text>
        <path d={curve.map((p,i)=>`${i===0?'M':'L'}${px(p.L)},${py(p.p)}`).join(' ')} stroke="var(--muted)" strokeWidth="2" fill="none" />
        {videos.map((d,i)=><g key={i}><line x1={px(d.duration)} x2={px(d.duration)} y1={py(d.prediction)} y2={py(d.baseline)} stroke={colors[i]} strokeDasharray="4 3" /><circle cx={px(d.duration)} cy={py(d.baseline)} r="7" fill="var(--paper)" stroke={colors[i]} strokeWidth="2" /><circle cx={px(d.duration)} cy={py(d.prediction)} r="4" fill={colors[i]} /><text x={px(d.duration)+9} y={py(d.prediction)-9} fill={colors[i]} fontSize="12">{i===0?'A':'B'}</text></g>)}
      </Figure>
      <div className="viz-scroll"><table className="viz-table"><caption>当前参数（基准很小时使用可见的分母下限 0.01）</caption><thead><tr><th>视频</th><th>L / 秒</th><th>p_finish</th><th>f(L)</th><th>p / max(f,0.01)</th></tr></thead><tbody>{videos.map((d,i)=><tr key={i}><th>Video {i===0?'A':'B'}</th><td>{d.duration}</td><td>{pct(d.prediction)}</td><td>{pct(d.baseline)}{d.manual?'（手动）':''}</td><td>{normalized[i].score.toFixed(4)}{normalized[i].protected?'（已保护）':''}</td></tr>)}</tbody></table></div>
      <div className="ranking-equation">{mode==='raw'?'S = p_finish':'S = p_finish / max(f(L), 0.01)'} · 柱长仅在当前模式内比较</div>
      <Bars rows={order.map(i=>({label:`Video ${i===0?'A':'B'}${tie?' · 并列':` · 第 ${order.indexOf(i)+1} 名`}`,value:scores[i],max:mode==='raw'?1:Math.max(...scores,1),color:colors[i],text:scores[i].toFixed(4)}))} />
      <div className="viz-narr" aria-live="polite">{tie?'当前两视频并列。':`当前 Video ${order[0]===0?'A':'B'} 排在前面。`}{mode==='raw'?'原始概率回答的是“达到 80% 观看阈值的可能性”，不是内容质量。':'归一化比较相对于同长度基准的表现；分数可大于 1，且不保证消除所有长度偏差。'}{normalized.some(d=>d.protected)?' 当前有基准低于 0.01，已触发分母保护；这会改变原始比值，需由业务验证。':''}</div>
    </VisualizationFrame>
  </div>;
}

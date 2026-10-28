"use client";
import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Slider from "@/components/visualization/ml/primitives/Slider";
export default function AdvantageFigure(){
 const [ret,setRet]=useState(1),[value,setValue]=useState(.6); const advantage=ret-value;
 return <div className="ranking-viz ppo-viz"><VisualizationFrame title="比预期好多少？" description="教学用 Monte Carlo 样本估计 Â = G − V；固定状态下改变观察到的 return 或 critic 预测。">
 <Slider label="Return G" min={-1} max={2} step={.1} value={ret} display={ret.toFixed(1)} onChange={setRet}/><Slider label="Critic V(s)" min={-1} max={2} step={.1} value={value} display={value.toFixed(1)} onChange={setValue}/>
 <div className="ppo-equation" aria-live="polite" style={{color:advantage>1e-9?"var(--v3)":advantage< -1e-9?"var(--v2)":"var(--muted)"}}>Â = {ret.toFixed(1)} − ({value.toFixed(1)}) = {advantage.toFixed(1)}</div>
 <p className="viz-narr">{Math.abs(advantage)<1e-9?"Zero：符合预期，这个样本的 advantage 加权策略项为零。":advantage>0?"Positive：比预期好，策略目标鼓励提高这个 sampled action 的概率。":"Negative：比预期差，策略目标鼓励降低这个 sampled action 的概率。"} 这是单个样本的优化激励，不保证共享参数更新后每个概率都按此方向变化。</p>
 </VisualizationFrame></div>;
}

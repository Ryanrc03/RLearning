"use client";
import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import Figure from "@/components/visualization/ml/primitives/Figure";
import { computeGae, groupAdvantages, clipObjective } from "@/lib/ml/ppo";
export default function PpoVsGrpoFigure(){
 const [mode,setMode]=useState<"ppo"|"grpo">("ppo");
 const {advantages}=computeGae([0,0,1],[.4,.6,.8]); const group=groupAdvantages([1,1,0,0]);
 const isPpo=mode==="ppo";
 return <div className="ranking-viz ppo-viz"><VisualizationFrame title="同一道题：基线从哪里来？" description="教学示例：What is 12 × 13? 三个决策只是简化轨迹，不代表真实 tokenizer 的三个 token。">
 <Tabs options={[{key:"ppo",label:"PPO · Critic + GAE"},{key:"grpo",label:"GRPO · Group Rewards"}]} value={mode} onChange={setMode} ariaLabel="PPO 与 GRPO 对照"/>
 <Figure width={660} height={205} minWidth={510} label={isPpo?"PPO：一个正确回答，Critic 估值，GAE，更新 Actor 和 Critic":"GRPO：四个回答，组内均值和标准差，更新 Actor"}>
 <text x="330" y="25" textAnchor="middle" fill="var(--ink)" fontSize="14">What is 12 × 13?</text>
 {(isPpo?["156"]:["156","156","144","169"]).map((answer,i)=>{const x=isPpo?250:10+i*164;return <g key={i}><rect x={x} y="48" width="150" height="52" rx="6" fill="var(--paper)" stroke={answer==="156"?"var(--v3)":"var(--v2)"}/><text x={x+75} y="70" fill="var(--ink)" textAnchor="middle" fontSize="13">{answer}</text><text x={x+75} y="89" fill="var(--muted)" textAnchor="middle" fontSize="11">Reward = {answer==="156"?1:0}</text></g>})}
 <path d="M330 105 V123 l-4 -4 m4 4 l4 -4" stroke="var(--muted)" fill="none"/>
 <rect x="60" y="129" width="540" height="58" rx="6" stroke={isPpo?"var(--v3)":"var(--v1)"} fill="var(--paper)"/><text x="330" y="152" textAnchor="middle" fill="var(--ink)" fontSize="12">{isPpo?"Critic V=[0.4, 0.6, 0.8] → GAE → Â=[0.6, 0.4, 0.2]":"Group μ=0.5, σ=0.5 → A=[1, 1, −1, −1]"}</text><text x="330" y="174" textAnchor="middle" fill="var(--muted)" fontSize="12">{isPpo?"Clipped Policy Update + Value Regression":"Clipped Policy Update · 无 Value Regression"}</text>
 </Figure>
 {isPpo?<div className="viz-scroll"><table className="viz-table"><caption>γ=λ=1，terminal value=0；ρ=1.5，ε=0.2</caption><thead><tr><th>决策</th><th>Vold</th><th>Â</th><th>Ĝ=Â+Vold</th><th>min objective</th></tr></thead><tbody>{advantages.map((a,i)=><tr key={i}><th>t={i+1}</th><td>{[.4,.6,.8][i]}</td><td>{a.toFixed(1)}</td><td>1.0</td><td>{clipObjective(1.5,a,.2).objective.toFixed(2)}</td></tr>)}</tbody></table></div>:<div className="viz-scroll"><table className="viz-table"><caption>总体标准差，忽略数值 ε；ρ=1.5，clip ε=0.2</caption><thead><tr><th>回答</th><th>Reward</th><th>组内 A</th><th>min objective</th></tr></thead><tbody>{group.advantages.map((a,i)=><tr key={i}><th>{i+1}</th><td>{[1,1,0,0][i]}</td><td>{a.toFixed(1)}</td><td>{clipObjective(1.5,a,.2).objective.toFixed(2)}</td></tr>)}</tbody></table></div>}
 <p className="viz-narr" aria-live="polite">{isPpo?"PPO 为每个 prefix 估值，GAE 把 TD residual 向前传递；Actor 拟合策略目标，Critic 拟合固定 return target。":"原始 outcome GRPO 用同一 prompt 的组内相对分数作 advantage，一条回答内的多个 token 共用该值。省去 Critic，增加同题多回答采样。"} 两者都使用 reward 和 clipped policy optimization；是否加入 reference KL 是另外的设计。</p>
 </VisualizationFrame></div>;
}

"use client";
import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
const stages=[
 {name:"初始化",input:"SFT checkpoint、prompt dataset、奖励定义",output:"Actor、Critic、冻结 Reference 与 Reward",models:"装载逻辑角色，可分离或共享 backbone",update:"尚未更新",formula:"Actor θ₀ → frozen πref"},
 {name:"Rollout",input:"一批 prompts + 当前 Actor",output:"固定 tokens、attention/response masks、old logps",models:"Actor sampling，无梯度",update:"不更新；保存采样分布统计量",formula:"aₜ ∼ πold(· | sₜ)"},
 {name:"奖励与参照",input:"本批固定回答",output:"task scores、ref logps、逐 token shaped rewards",models:"冻结 Reward / 规则 + Reference",update:"不更新",formula:"rₜ = rtask,ₜ − β(log πold − log πref)"},
 {name:"估计 Value",input:"本批回答的每个动作之前的 prefix",output:"old values，必要时 bootstrap value",models:"Critic，无梯度前向",update:"不更新，冻结这批 rollout 的估值",formula:"Vold,ₜ = Vφold(sₜ)"},
 {name:"GAE 与 Targets",input:"固定 rewards、old values、终止信息",output:"advantages、return targets（detach）",models:"纯计算，不调用模型",update:"不更新",formula:"Âₜ = δₜ + γλÂₜ₊₁；Ĝₜ = Âₜ + Vold,ₜ"},
 {name:"Actor Update",input:"同一批 tokens、old logps、advantages、mask",output:"new logps、ratio、policy loss",models:"当前 Actor 重新前向，有梯度",update:"Actor 的可训练参数 θ",formula:"Lπ = −masked_mean[min(ρÂ, clip(ρ)Â)]"},
 {name:"Critic Update",input:"同一批 prefixes、固定 return targets、mask",output:"new values、value loss",models:"当前 Critic 重新前向，有梯度",update:"Critic 的可训练参数 φ（共享时联合优化）",formula:"LV = ½ masked_mean[(Vφ − Ĝ)²]"},
 {name:"多轮 Mini-batches",input:"同一 rollout，打乱并分 mini-batch",output:"重复 Actor / Critic optimization",models:"Actor + Critic 多次 forward/backward",update:"可继续更新；old logps / Â / Ĝ 保持固定",formula:"PPO epoch ≠ 重新生成 response"},
 {name:"Next Rollout",input:"更新后的 Actor + 新 prompts",output:"新回答与新的 old statistics",models:"Actor 重新采样，回到第 1 步",update:"本轮结束，下一批采样策略刷新",formula:"πold ← 当前 πθ（逻辑快照）"},
];
export default function PipelineFigure(){
 const [step,setStep]=useState(0);const s=stages[step];
 return <div className="ranking-viz ppo-viz"><VisualizationFrame title="一轮 PPO：采样一次，在固定数据上优化多次" description="选择一个步骤查看数据流；训练阶段仅第 5–7 步更新参数。">
 <div className="ppo-steps">{stages.map((stage,i)=><button key={stage.name} type="button" className={`viz-btn${i===step?" is-on":""}`} aria-pressed={i===step} onClick={()=>setStep(i)}>{i}. {stage.name}</button>)}</div>
 <Figure width={660} height={125} minWidth={510} label="固定 rollout 经过评分、估值、GAE，训练 Actor 与 Critic，然后采样下一批">
 {["Prompt / Rollout","Reward + V + Ref","GAE / Targets","Actor + Critic"].map((label,i)=><g key={label}><rect x={10+i*164} y="18" width="148" height="52" rx="6" fill="var(--paper)" stroke={i===3?"var(--v3)":"var(--v1)"} strokeWidth={((step===1&&i===0)||([2,3].includes(step)&&i===1)||(step===4&&i===2)||([5,6,7].includes(step)&&i===3))?3:1}/><text x={84+i*164} y="49" fontSize="11" fill="var(--ink)" textAnchor="middle">{label}</text>{i<3&&<path d={`M${159+i*164} 43 h14 l-4 -4 m4 4 l-4 4`} fill="none" stroke="var(--muted)"/>}</g>)}
 <path d="M575 74 V100 H85 V74 m-4 5 l4 -5 l4 5" fill="none" stroke="var(--v3)"/><text x="330" y="118" textAnchor="middle" fill="var(--muted)" fontSize="11">更新后的 Actor → 下一批 rollout；不是每个 PPO epoch 都重采样</text>
 </Figure>
 <div className="viz-panel" aria-live="polite"><h5>Step {step} — {s.name}</h5><dl className="ppo-fields"><dt>Inputs</dt><dd>{s.input}</dd><dt>Outputs</dt><dd>{s.output}</dd><dt>模型运行</dt><dd>{s.models}</dd><dt>参数更新</dt><dd>{s.update}</dd></dl><div className="ppo-equation">{s.formula}</div></div>
 <div className="viz-row"><button className="viz-btn" type="button" disabled={step===0} onClick={()=>setStep(step-1)}>上一步</button><button className="viz-btn" type="button" disabled={step===8} onClick={()=>setStep(step+1)}>下一步</button><button className="viz-btn" type="button" onClick={()=>setStep(0)}>重置流程</button></div>
 </VisualizationFrame></div>;
}

"use client";
import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
const roles = [
  {name:"Actor / Policy",color:"var(--v1)",train:"可训练",input:"Prompt + token prefix",output:"下一 token 的概率分布；采样回答",init:"SFT Policy",purpose:"生成回答，并用 clipped policy loss 改进生成策略。",relation:"Rollout 时保存 old log probabilities；更新时重新前向得到 new log probabilities。"},
  {name:"Critic / Value",color:"var(--v3)",train:"可训练",input:"Prompt + token prefix（动作之前的状态）",output:"每个生成位置的标量 V(s_t)",init:"预训练或 SFT backbone + Value Head",purpose:"估计预期未来回报，供 GAE 构造 advantage；拟合固定的 return targets。",relation:"Actor 与 Critic 可共享 backbone；Value Head 与语言模型输出头承担不同任务。"},
  {name:"Reward Model",color:"var(--v2)",train:"冻结 / 规则",input:"Prompt + 完整回答",output:"回答质量分数 R",init:"用偏好数据训练的评分模型；也可替换为规则",purpose:"评价实际生成结果。例：156 得 1，错误答案得 0。",relation:"Reward 和 Critic 的预测共同构造训练信号；Reward 不等于 Value，也不等于 Advantage。"},
  {name:"Reference",color:"var(--v4)",train:"冻结",input:"Rollout 中相同的 prefix 与 sampled token",output:"该 token 的 reference log probability",init:"初始 Actor 的冻结参考策略",purpose:"提供 RLHF 的 KL 正则化参照，减缓策略相对起点的漂移。",relation:"Reference 通常跨轮固定；Old Policy 随新 rollout 刷新，两者用途不同。"},
];
export default function RoleArchitectureFigure(){
 const [selected,setSelected]=useState(0); const r=roles[selected];
 return <div className="ranking-viz ppo-viz"><VisualizationFrame title="四种角色：谁生成、谁估值、谁评分、谁作参照？" description="点击卡片查看详情。颜色表示逻辑职责，可训练状态用文字标明。">
 <div className="ppo-role-grid">{roles.map((role,i)=><button type="button" key={role.name} className="ppo-role" aria-pressed={selected===i} onClick={()=>setSelected(i)} style={{borderColor:role.color,boxShadow:selected===i?`inset 0 0 0 1px ${role.color}`:undefined}}><b style={{color:role.color}}>{role.name}</b><span>{role.train}</span></button>)}</div>
 <Figure width={660} height={228} minWidth={510} label="Actor 产生 rollout，Critic、Reward、Reference 各自提供 value、score、log probabilities，再形成 Actor 和 Critic 的训练信号">
 <defs><marker id="ppo-role-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10" fill="var(--muted)"/></marker></defs>
 <text x="20" y="25" fill="var(--muted)" fontSize="12">Prompt → Actor → Rollout（tokens / old logps）</text>
 {[0,1,2,3].map((i)=><g key={i} opacity={selected===i?1:.45}><rect x={15+i*161} y="50" width="145" height="60" rx="7" fill="var(--paper)" stroke={roles[i].color} strokeWidth="2"/><text x={87+i*161} y="75" textAnchor="middle" fontSize="12" fill={roles[i].color}>{roles[i].name}</text><text x={87+i*161} y="96" textAnchor="middle" fontSize="11" fill="var(--muted)">{["new log πθ","Vφ(s)","task reward","log πref"][i]}</text><path d={`M${87+i*161} 111 V142 H330 V163`} fill="none" stroke="var(--muted)" markerEnd="url(#ppo-role-arrow)"/></g>)}
 <rect x="125" y="170" width="410" height="42" rx="6" fill="var(--paper)" stroke="var(--vline)"/><text x="330" y="196" textAnchor="middle" fontSize="12" fill="var(--ink)">Shaped reward → GAE → Policy loss + Value loss</text>
 </Figure>
 <div className="viz-panel" aria-live="polite"><h5>{r.name} · {r.train}</h5><dl className="ppo-fields"><dt>Input</dt><dd>{r.input}</dd><dt>Output</dt><dd>{r.output}</dd><dt>初始化</dt><dd>{r.init}</dd><dt>作用</dt><dd>{r.purpose}</dd><dt>关系</dt><dd>{r.relation}</dd></dl></div>
 <p className="viz-k">四种逻辑角色 ≠ 四套完整 backbone。Old Policy 是本批 rollout 的采样策略或保存的统计量；它没有被画成第五个常驻大模型。</p>
 </VisualizationFrame></div>;
}

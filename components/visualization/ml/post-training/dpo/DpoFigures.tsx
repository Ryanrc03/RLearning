"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Curve from "@/components/visualization/ml/primitives/Curve";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { normalizeWeights, btExample, dpoPair, optimalDistribution } from "@/lib/ml/dpo";
import { klDivergence, klTerms } from "@/lib/ml/klDivergence";
import { sigmoid } from "@/lib/ml/rlhf";

const fmt = (x: number) => Number.isFinite(x) ? x.toFixed(4) : "∞";
const pct = (x: number) => `${(100*x).toFixed(2)}%`;
function Reset({ onClick }: { onClick: () => void }) { return <button type="button" className="viz-btn" onClick={onClick}>重置</button>; }
function Stats({ items }: { items: [string, ReactNode][] }) { return <div className="viz-stat">{items.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>; }

/** Binary KL example for the DPO derivation; linked from the existing KL note. */
export function KlToyFigure() {
  const [p0, setP] = useState(0.2), [q0, setQ] = useState(0.8);
  const p = normalizeWeights([p0, 1-p0]), q = normalizeWeights([q0, 1-q0]);
  const terms = klTerms(p,q), total = klDivergence(p,q);
  return <VisualizationFrame title="KL 实验：负的一项，非负的总和" description="两个结果的概率自动补足为 1；蓝色 P，橙色 Q。单位 nats，使用自然对数。">
    <div className="viz-controls"><Slider label="P(结果 1)" min={0.01} max={0.99} step={0.01} value={p0} onChange={setP}/><Slider label="Q(结果 1)" min={0.01} max={0.99} step={0.01} value={q0} onChange={setQ}/><button type="button" className="viz-btn" onClick={() => setQ(p0)}>令 Q = P</button><Reset onClick={() => {setP(0.2);setQ(0.8);}}/></div>
    <Bars rows={p.flatMap((v,i) => [{label:`结果 ${i+1} · P`,value:v,color:"var(--v1)",text:pct(v)},{label:`结果 ${i+1} · Q`,value:q[i],color:"var(--v2)",text:pct(q[i])}])}/>
    <div className="viz-scroll"><table className="viz-table"><thead><tr><th>结果</th><th>P · ln(P/Q)</th><th>贡献</th></tr></thead><tbody>{terms.map((v,i) => <tr key={i}><td>{i+1}</td><td className="viz-mono">{p[i].toFixed(2)} × ln({p[i].toFixed(2)}/{q[i].toFixed(2)})</td><td className="num">{fmt(v)}</td></tr>)}</tbody></table></div>
    <Stats items={[["KL(P ‖ Q)",fmt(total)],["KL(Q ‖ P)",fmt(klDivergence(q,p))]]}/>
    <div className={`viz-narr ${total < 1e-10 ? "is-good" : ""}`} aria-live="polite">{total < 1e-10 ? "P = Q，每一项都是 0。" : `总和 ${fmt(total)} ≥ 0；${terms.some(t => t < 0) ? "某项为负，是因为该结果 P < Q。" : "观察两组柱子的概率差。"}`} 默认例子恰好两个方向相等；把 P 调到 0.30，就能看到 KL 通常不对称。</div>
  </VisualizationFrame>;
}

export function BradleyTerryFigure() {
  const [abilities, setAbilities] = useState<[number,number,number]>([1,1,1]);
  const model = btExample(abilities);
  const points: [number,number][] = Array.from({length:81},(_,i) => { const x = -4+i/10;return [x,sigmoid(x)]; });
  return <VisualizationFrame title="Bradley–Terry：让比赛记录更可能发生" description="固定数据：A 对 B 为 8 胜 4 负；A 对 C 为 3 胜 5 负。NLL 为 20 场比赛的总损失。">
    <div className="viz-controls">{abilities.map((a,i) => <Slider key={i} label={`α${"ABC"[i]}`} value={a} display={a.toFixed(3)} min={0.1} max={3} step={0.01} onChange={v => setAbilities(old => old.map((n,j) => i === j ? v : n) as [number,number,number])}/>)}<button type="button" className="viz-btn" onClick={() => setAbilities([1,0.5,5/3])}>载入 MLE</button><Reset onClick={() => setAbilities([1,1,1])}/></div>
    <Bars rows={[["A 胜 B",model.ab,8/12],["A 胜 C",model.ac,3/8]].map(([label,p,observed]) => ({label:String(label),value:Number(p),color:"var(--v1)",text:pct(Number(p)),hint:`观察比例 ${pct(Number(observed))}`}))}/>
    <Figure width={720} height={230} label="Sigmoid 曲线：横轴 log αA − log αB，纵轴 A 胜 B 概率"><Plot box={{x:0,y:0,w:720,h:230}} xDomain={[-4,4]} yDomain={[0,1]} xLabel="sA − sB" yLabel="P(A ≻ B)">{frame => <><Curve frame={frame} points={points} color="var(--v1)"/><circle cx={frame.x(model.difference)} cy={frame.y(model.ab)} r={5} fill="var(--v2)"/></>}</Plot></Figure>
    <Stats items={[["Likelihood L",model.likelihood.toExponential(4)],["log L",fmt(model.logLikelihood)],["NLL = −log L",fmt(model.nll)],["单场 A 胜 B loss",fmt(-Math.log(model.ab))]]}/>
    <div className="viz-narr" aria-live="polite">当前预测 A 胜 B {pct(model.ab)}、A 胜 C {pct(model.ac)}。载入 MLE 后分别匹配 8/12 与 3/8；把所有 α 同乘一个正数，概率与 NLL 都不变。单场赢家越可信，该场 loss 越低；有输有赢的数据应拟合胜率，而非把 A 的胜率全推到 1。</div>
  </VisualizationFrame>;
}

const derivation = [
  {title:"1 · 带 KL 代价的奖励最大化", formula:"maxπ  Eπ[r(x,y)] − β KL(π ‖ πref)", detail:"固定 prompt x，在概率和为 1 的分布中找最大值。β > 0；π 只能在 reference 的支持集内分配概率。"},
  {title:"2 · 最优策略是奖励重加权", formula:"π*(y|x) = πref(y|x) exp(r(x,y)/β) / Z(x)", detail:"Z(x) = Σy πref(y|x) exp(r(x,y)/β)，使总概率等于 1。它依赖 prompt，不依赖被比较的某一个回答。"},
  {title:"3 · 用策略表达隐式 reward", formula:"r(x,y) = β log[π*(y|x)/πref(y|x)] + β log Z(x)", detail:"两边取 log 后移项。这是 reward 到最优 policy 的变量替换，不是说任意训练中策略已达到某个已知 reward 的最优解。"},
  {title:"4 · 同一 prompt 的归一化项抵消", formula:"rw − rl = β log(π*w/πref,w) − β log(π*l/πref,l)", detail:"展开为 [β log(π*w/πref,w) + β log Z(x)] − [β log(π*l/πref,l) + β log Z(x)]。共同的 +β log Z(x) 和 −β log Z(x) 正好抵消；不同 prompt 不能直接这样消。"},
  {title:"5 · 把 π* 参数化为 πθ，拟合偏好", formula:"m = β [(log πθ,w − log πref,w) − (log πθ,l − log πref,l)]\nℓDPO = −log σ(m) = softplus(−m)", detail:"在偏好数据集上求平均。reference 冻结；梯度通过 chosen 和 rejected 的 policy 序列 log-prob 回传到同一组 θ，无需独立 reward model。"},
];
export function DpoDerivationFigure() {
  const [step,setStep] = useState(0), now = derivation[step];
  return <VisualizationFrame title="五步推导：reward 换成 policy" description="先看当前等式，再展开解释；正文保留完整 LaTeX 公式。">
    <StepPlayer step={step} total={derivation.length} onStep={setStep} intervalMs={5000} caption={`${step+1} / ${derivation.length}`}/>
    <div className="viz-panel" aria-live="polite"><h5>{now.title}</h5><div className="viz-mono" style={{overflowWrap:"anywhere",whiteSpace:"pre-wrap"}}>{now.formula}</div><details key={step}><summary>展开这一步的解释</summary><p>{now.detail}</p></details></div>
    <div className="viz-narr">{step === 3 ? "关键：同一个 x → 同一个 Z(x) → 奖励差不需要计算 Z。" : now.detail}</div>
  </VisualizationFrame>;
}

const INPUT_LABELS = ["Policy chosen log πθ(yw|x)","Policy rejected log πθ(yl|x)","Reference chosen log πref(yw|x)","Reference rejected log πref(yl|x)"];
export function DpoLossFigure() {
  const [inputs,setInputs] = useState<[string,string,string,string]>(["-3","-4","-3","-4"]);
  const [beta,setBeta] = useState(0.1);
  const nums = inputs.map(Number) as [number,number,number,number];
  const pairMassValid = (a:number,b:number) => Math.exp(a)+Math.exp(b) <= 1+1e-12;
  const valid = inputs.every((v,i) => v.trim() !== "" && Number.isFinite(nums[i]) && nums[i] <= 0 && nums[i] >= -1000000) && pairMassValid(nums[0],nums[1]) && pairMassValid(nums[2],nums[3]);
  const result = valid ? dpoPair(nums,beta) : null;
  return <VisualizationFrame title="DPO Loss Calculator" description="固定 prompt：解释什么是过拟合。Chosen：训练集记得太熟，换题就错；Rejected：训练数据越多就越会过拟合。以下是整段回答的自然对数概率。">
    <div className="viz-grid2">{inputs.map((value,i) => <label key={i} className="viz-panel">{INPUT_LABELS[i]}<input aria-label={INPUT_LABELS[i]} type="number" min={-1000000} max={0} step={0.1} value={value} style={{display:"block",width:"100%",minWidth:0}} onChange={e => setInputs(old => old.map((v,j) => i===j ? e.target.value : v) as [string,string,string,string])}/></label>)}</div>
    <div className="viz-controls"><Slider label="β · loss" min={0.01} max={2} step={0.01} value={beta} onChange={setBeta}/><button type="button" className="viz-btn" onClick={() => setInputs(["-4","-7","-3","-4"])}>两者都降、margin 却增</button><Reset onClick={() => {setInputs(["-3","-4","-3","-4"]);setBeta(0.1);}}/></div>
    {result ? <><Stats items={[["Chosen log ratio",fmt(result.chosenRatio)],["Rejected log ratio",fmt(result.rejectedRatio)],["未缩放 relative margin Δ",fmt(result.relativeMargin)],["Preference margin m = βΔ",fmt(result.margin)],["σ(m) · 模型偏好概率",fmt(result.probability)],["单对 DPO loss",fmt(result.loss)]]}/><div className="viz-narr" aria-live="polite">{result.relativeMargin === 0 ? "相对优势为 0，loss = ln 2 ≈ 0.6931。" : `相对优势 Δ = ${fmt(result.relativeMargin)}；模型偏好概率 ${pct(result.probability)}，loss = ${fmt(result.loss)}。`} σ(m) 是偏好模型的预测，不是已验证的人类胜率。β 在这里缩放已有 margin；不能据此把单对 loss 的变化等同于训练后 KL 的变化。</div></> : <p className="viz-narr is-bad" role="alert">请输入 −1,000,000 到 0 的有限 log 概率；同一模型两个互斥回答的概率之和不能超过 1。</p>}
  </VisualizationFrame>;
}

const REF = [0.2,0.5,0.3], REWARDS = [2,0.6,-0.5], RESPONSES = ["Chosen","Neutral","Rejected"];
export function DpoDistributionFigure() {
  const [beta,setBeta] = useState(1);
  const policy = optimalDistribution(REF,REWARDS,beta);
  return <VisualizationFrame title="A · 分布如何移动：理论最优策略" description="三个回答穷尽这个玩具空间。固定 reference = [0.2, 0.5, 0.3]，假设 reward = [2.0, 0.6, −0.5]；蓝色为 SFT，橙色为 π*。">
    <div className="viz-controls"><Slider label="β · KL 代价" value={beta} min={0.1} max={5} step={0.05} onChange={setBeta}/><Reset onClick={() => setBeta(1)}/></div>
    <Bars rows={RESPONSES.flatMap((label,i) => [{label:`${label} · Reference`,value:REF[i],color:"var(--v1)",text:pct(REF[i])},{label:`${label} · Optimized`,value:policy[i],color:"var(--v2)",text:pct(policy[i])}])}/>
    <Stats items={[["π*(Chosen)",pct(policy[0])],["π*(Rejected)",pct(policy[2])],["KL(π* ‖ πref)",fmt(klDivergence(policy,REF))],["Σ π*",fmt(policy.reduce((a,b) => a+b,0))]]}/>
    <div className="viz-narr" aria-live="polite">β = {beta.toFixed(2)}，Chosen 的概率从 {pct(REF[0])} 变成 {pct(policy[0])}。β 越小，固定 reward 的重加权越激进；越大越贴近 reference。这是 KL 约束目标的闭式解，不是 DPO 的逐步训练动画；实际 DPO 不需要这组三个显式 reward。</div>
  </VisualizationFrame>;
}

const PIPELINE = [
  ["Preference Dataset", "同一 prompt x 及人工标注的 chosen yw / rejected yl；训练 batch 已固定，不需要每步在线生成新回答。"],
  ["两个模型，四次打分", "Reference 与 Policy 各自对 chosen、rejected 做 teacher-forced 前向。两条 policy 分支共享 θ；reference 权重固定。"],
  ["Sequence log probabilities", "对 response token 的 log 概率求和，mask 掉 prompt 和 padding。两模型使用一致的 tokenizer、模板、截断与 EOS 约定。"],
  ["Relative log probability ratios", "chosen: log πθ,w − log πref,w；rejected: log πθ,l − log πref,l；相减得到 Δ。"],
  ["DPO Loss", "m = βΔ，loss = softplus(−m)。对 batch 求平均；无需显式奖励模型，也没有 critic。"],
  ["Backpropagation → Update Policy", "只有 policy 两路保留梯度，optimizer 更新 θ。reference 使用 no_grad / stop-gradient，固定 reference log-prob 也可预计算缓存。"],
];
export function DpoPipelineFigure() {
  const [step,setStep] = useState(0);
  return <VisualizationFrame title="B · DPO 训练流水线：梯度走向哪里" description="蓝色实线：可训练 Policy；灰色虚线：冻结 Reference。点击下一步跟随一批偏好对。">
    <StepPlayer step={step} total={PIPELINE.length} onStep={setStep} intervalMs={4000} caption={`${step+1} / ${PIPELINE.length}`}/>
    <div className="viz-stages"><div className={`viz-stage ${step===0 ? "is-current" : ""}`}><span className="dot"/><div><b>Preference Dataset</b><p>x + Chosen yw + Rejected yl</p></div></div></div>
    <div style={{textAlign:"center"}} aria-hidden="true">↓ 两个回答送入两个分支 ↓</div>
    <div className="viz-grid2"><div className="viz-panel" style={{borderColor:"var(--vfixed)",borderStyle:"dashed",boxShadow:step===1 ? "0 0 0 2px var(--vfixed)" : undefined}}><h5>Reference · Frozen</h5><p>yw → log πref,w<br/>yl → log πref,l</p><b>不回传梯度 · 固定权重</b></div><div className="viz-panel" style={{borderColor:"var(--v1)",borderWidth:2,boxShadow:step===1 ? "0 0 0 2px var(--v1)" : undefined}}><h5>Policy · Trainable</h5><p>yw → log πθ,w<br/>yl → log πθ,l</p><b>两路共享 θ · 接收梯度</b></div></div>
    <div style={{textAlign:"center"}} aria-hidden="true">↓ 序列求和 → 相对比值 → loss ↓</div>
    <div className="viz-stages">{PIPELINE.slice(2).map(([title],i) => <div key={title} className={`viz-stage ${step===i+2 ? "is-current" : ""}`}><span className="dot"/><b>{title}</b></div>)}</div>
    <div className="viz-narr" aria-live="polite"><b>{PIPELINE[step][0]}：</b>{PIPELINE[step][1]}{step===5 && " 更新后回到 Policy 前向；Reference 保持原值。"}</div>
  </VisualizationFrame>;
}

"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { trainToyBatch } from "@/lib/ml/deepseek-moe";

const examples = [
  { name: "A：目标 猫", scores: [Math.log(4), Math.log(2), 0, 0] },
  { name: "B：目标 狗", scores: [0, 0, Math.log(4), Math.log(2)] },
];
const expertOutputs = [2, 4, 2, 4];
const result = trainToyBatch({
  scoresByToken: examples.map((example) => example.scores),
  expertOutputs,
  sharedOutput: 1,
  targetIndices: [0, 1],
  outputClassIndices: [0, 1],
  vocabularySize: 3,
  topK: 2,
  balanceAlpha: 0.01,
  learningRate: 0.1,
});
const labels = ["给定两个 token", "① Router 选专家", "② 专家输出求和", "③ 下一词交叉熵", "④ 负载均衡", "⑤ 反传与更新"];
const stages = ["输入", "路由", "合并", "LM loss", "均衡", "更新"];
const number = (value: number, digits = 4) => value.toFixed(digits).replace("-", "−");

export default function DeepSeekMoETraining() {
  const [step, setStep] = useState(0);
  const narrative = [
    "两条训练样本共用同一组专家参数。真实预训练用大词表和向量 FFN；这里只设三个候选词、每个专家输出一个标量，才能把每一步算在纸面上。",
    "A 的 softmax 门值是 0.5、0.25、0.125、0.125，选专家 1、2；B 的分数反过来，选专家 3、4。共享专家对两条样本都执行。top-k 决定计算哪些 FFN，门值仍来自对全部四个分数的 softmax。",
    `A 和 B 都得到 logit ${number(result.tokens[0].output)}：共享专家给 1，选中的两个路由专家给 0.5 × 2 + 0.25 × 4 = 2。对各自的 token，另外两个路由专家不执行 FFN 前向。`,
    `玩具 LM head 根据各自 hidden state，给 A 的“猫”和 B 的“狗”加上 ${number(result.tokens[0].output)} 的 logit；标签恰好与预测方向一致。另两个词的 logit 固定为 0。正确词概率是 ${number(result.tokens[0].targetProbability)}；每条样本交 −log p = ${number(result.tokens[0].loss)}。`,
    `本 batch 四个专家各被选中一次，fᵢ 都是 1；平均 softmax 分数 Pᵢ 相加为 1。α = 0.01，所以均衡项 ${number(result.balanceLoss)}；总损失 ${number(result.totalLoss)}。若两条都挤到专家 1、2，同一公式会给 0.0150。`,
    `主损失对共享输出的梯度是 ${number(result.sharedGradient)}，对专家 1 的输出是 ${number(result.expertGradients[0])}，专家 2 是 ${number(result.expertGradients[1])}。这些梯度还会继续传回前面的 Transformer 模块；本表只展开专家标量。为看清方向，用学习率 0.1 做一次示意 SGD：共享标量从 1 变为 ${number(result.updatedSharedOutput)}，专家 1 从 2 变为 ${number(result.updatedExpertOutputs[0])}。原论文实际用 AdamW；均衡项给 router 额外梯度。`,
  ];

  return <VisualizationFrame
    title="一次完整训练：两个 token、一组专家、一个 batch"
    description="这里放大 MoE 子层的梯度；真实训练还会更新 attention、embedding、词表头等 Transformer 参数。三个候选词与 SGD 更新都是示意值。"
    footnote="示意值：专家输出 [2, 4, 2, 4]，共享输出 1，top-2 / 4，词表 3 类，α = 0.01，示意学习率 0.1。论文的真实 16B 训练使用词表交叉熵、AdamW 和专家级负载均衡损失。"
  >
    <StepPlayer step={step} total={labels.length} onStep={setStep} onReset={() => setStep(0)} caption={labels[step]} intervalMs={2200} />
    <Figure width={700} height={105} minWidth={620} label={`训练流程，当前阶段：${labels[step]}`}>
      {stages.map((stage, i) => {
        const x = 12 + i * 116;
        const color = i === 0 ? "#d9b24a" : i === 1 || i === 4 ? "#2a78d6" : i === 5 ? "#1baf7a" : "#eb6834";
        const fill = i === 0 ? "#fbf1cf" : i === 1 || i === 4 ? "#dbe8f8" : i === 5 ? "#d9f1e6" : "#fbe3d8";
        return <g key={stage} opacity={step === i ? 1 : step > i ? 0.7 : 0.35} style={{ transition: "opacity .2s" }}>
          <rect x={x} y="26" width="102" height="47" rx="6" fill={fill} stroke={color} strokeWidth={step === i ? 2.8 : 1.5} />
          <text x={x + 51} y="55" textAnchor="middle" fontSize="11" fontWeight={step === i ? 700 : 500} fill="#3b4234">{stage}</text>
          {i < stages.length - 1 && <path d={`M ${x + 102} 49 H ${x + 114}`} stroke="#76796f" strokeWidth="1.4" />}
        </g>;
      })}
    </Figure>

    <div className="viz-scroll">
      <table className="viz-table" style={{ minWidth: 610 }}>
        <thead><tr><th>训练样本</th><th>路由专家</th><th>MoE 输出</th><th>词表 logits：猫 / 狗 / 鱼</th><th>目标词概率</th><th>CE loss</th></tr></thead>
        <tbody>{result.tokens.map((token, i) => {
          const logits = [0, 0, 0];
          logits[token.outputClassIndex] = token.output;
          return <tr key={examples[i].name}>
            <td>{examples[i].name}</td>
            <td>{step >= 1 ? token.selected.map((expert) => expert + 1).join("、") : "—"}</td>
            <td className="num">{step >= 2 ? number(token.output, 3) : "—"}</td>
            <td className="num">{step >= 3 ? logits.map((logit) => number(logit, 1)).join(" / ") : "—"}</td>
            <td className="num">{step >= 3 ? number(token.targetProbability) : "—"}</td>
            <td className="num">{step >= 3 ? number(token.loss) : "—"}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    {step >= 4 && <div className="viz-stat" style={{ marginTop: 10 }}>
      <div><small>平均语言模型损失</small><b>{number(result.meanLanguageLoss)}</b></div>
      <div><small>专家级均衡项</small><b>{number(result.balanceLoss)}</b></div>
      <div><small>总损失</small><b>{number(result.totalLoss)}</b></div>
    </div>}
    {step >= 5 && <div className="viz-scroll" style={{ marginTop: 10 }}>
      <table className="viz-table" style={{ minWidth: 540 }}>
        <thead><tr><th>示意参数</th><th>原值</th><th>平均 LM loss 的梯度</th><th>一次 SGD 后</th></tr></thead>
        <tbody>
          <tr><td>共享专家</td><td className="num">1.0000</td><td className="num">{number(result.sharedGradient)}</td><td className="num">{number(result.updatedSharedOutput)}</td></tr>
          {expertOutputs.map((value, i) => <tr key={i}><td>路由专家 {i + 1}</td><td className="num">{number(value)}</td><td className="num">{number(result.expertGradients[i])}</td><td className="num">{number(result.updatedExpertOutputs[i])}</td></tr>)}
        </tbody>
      </table>
    </div>}
    <div className={`viz-narr${step === 4 ? " is-warn" : step === 5 ? " is-good" : ""}`}>{narrative[step]}</div>
  </VisualizationFrame>;
}

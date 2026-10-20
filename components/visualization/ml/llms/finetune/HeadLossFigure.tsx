"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { crossEntropy, LABELS, logitGrad, softmax, type Label } from "@/lib/ml/finetune";

// BERT fine-tuning, figure 3: one sentence through the head. The [CLS]
// vector goes through Linear 768 → 3; the three logits become probabilities;
// the loss is −log p of the true class, and the gradient on the logits is
// p − y. Three moments of training (logits are 示意 values; everything after
// them is computed).

type Stage = "init" | "mid" | "end";

const EXAMPLES: { text: string; label: Label; logits: Record<Stage, number[]> }[] = [
  { text: "国补到账了，价格很划算", label: 2, logits: { init: [0.02, -0.01, 0.03], mid: [-0.8, 0.1, 1.2], end: [-2.1, -0.6, 3.0] } },
  { text: "国补什么时候发", label: 1, logits: { init: [0.01, 0.02, -0.02], mid: [0.3, 0.5, 0.1], end: [-0.9, 2.2, -0.7] } },
  { text: "等了一个月国补还没到账，客服也不回消息", label: 0, logits: { init: [-0.02, 0.01, 0.0], mid: [0.9, 0.4, -0.6], end: [2.6, 0.3, -1.8] } },
];

const STAGES: { key: Stage; label: string }[] = [
  { key: "init", label: "分类头刚初始化" },
  { key: "mid", label: "训练 1 个 epoch 后" },
  { key: "end", label: "训练结束" },
];

const COLORS = ["#eb6834", "#76796f", "#1baf7a"];
const f3 = (x: number) => (Object.is(Math.round(x * 1000), -0) ? "0.000" : x.toFixed(3)).replace("-", "−");

export default function HeadLossFigure() {
  const [ex, setEx] = useState(0);
  const [stage, setStage] = useState<Stage>("init");
  const e = EXAMPLES[ex];
  const z = e.logits[stage];
  const p = softmax(z);
  const loss = crossEntropy(p, e.label);
  const g = logitGrad(p, e.label);
  const pred = p.indexOf(Math.max(...p));
  const batchLoss = EXAMPLES.reduce((s, x) => s + crossEntropy(softmax(x.logits[stage]), x.label), 0) / EXAMPLES.length;

  const narr = (() => {
    if (stage === "init")
      return { tone: " is-warn", text: `分类头的权重按 std = 0.02 随机初始化，三个 logits 都接近 0，softmax 后三个概率都约等于 1/3。loss = −log ${f3(p[e.label])} = ${f3(loss)}，正好是 ln 3 ≈ 1.099：三分类瞎猜的 loss。训练开始时看到 1.10 左右是正常的，明显偏离就说明标签或头有问题。` };
    if (stage === "mid")
      return { tone: "", text: `一个 epoch 后，正确类「${LABELS[e.label]}」的 logit 被推高，p = ${f3(p[e.label])}，loss 降到 ${f3(loss)}。梯度 p − y 在正确类上是负的（${f3(g[e.label])}），在其他类上是正的：梯度下降会继续抬高正确类、压低其他类，力度正比于还差多少。` };
    return { tone: " is-good", text: `训练结束，p(${LABELS[e.label]}) = ${f3(p[e.label])}，loss 只剩 ${f3(loss)}，梯度几乎为 0：已经学会的样本几乎不再推动参数，训练的力气都花在还错的样本上。三条的平均 loss（batch loss）是 ${f3(batchLoss)}。` };
  })();

  return (
    <VisualizationFrame
      title="一条评论过分类头：logits、概率、loss、梯度"
      description="选一条评论和训练进度。logits 是示意值；softmax、交叉熵和梯度 p − y 都按公式算出。橙、灰、绿分别是负面、中性、正面，黑框是这条的真实标签。"
    >
      <div className="viz-row" style={{ marginBottom: 8 }}>
        <div className="viz-chips">
          {EXAMPLES.map((x, i) => (
            <button key={i} type="button" className={`viz-chip${ex === i ? " is-on" : ""}`} onClick={() => setEx(i)}>
              {x.text.length > 10 ? `${x.text.slice(0, 10)}…` : x.text} · {LABELS[x.label]}
            </button>
          ))}
        </div>
      </div>
      <div className="viz-row">
        <Tabs options={STAGES} value={stage} onChange={setStage} ariaLabel="训练进度" />
      </div>

      <table className="viz-table" aria-label="三个类别的 logits、概率和梯度">
        <thead>
          <tr>
            <th>类别</th>
            <th className="num">logit z</th>
            <th>p = softmax(z)</th>
            <th className="num">p</th>
            <th className="num">∂L/∂z = p − y</th>
          </tr>
        </thead>
        <tbody>
          {LABELS.map((name, k) => (
            <tr key={k} style={{ fontWeight: k === e.label ? 600 : 400, outline: k === e.label ? "1.5px solid #3b4234" : undefined }}>
              <td style={{ color: COLORS[k] }}>{k} {name}{k === e.label ? "（真实）" : ""}</td>
              <td className="num">{z[k].toFixed(2).replace("-", "−")}</td>
              <td style={{ width: "34%" }}>
                <div className="viz-bar-track"><span style={{ width: `${p[k] * 100}%`, background: COLORS[k], transition: "width .35s" }} /></div>
              </td>
              <td className="num">{f3(p[k])}</td>
              <td className="num" style={{ color: g[k] < -0.01 ? "#1baf7a" : g[k] > 0.01 ? "#eb6834" : undefined }}>
                {f3(g[k])} {g[k] < -0.01 ? "↑ 推高" : g[k] > 0.01 ? "↓ 压低" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="viz-stat" style={{ marginTop: 10 }}>
        <div><small>预测（argmax）</small><b style={{ color: COLORS[pred] }}>{LABELS[pred]}</b></div>
        <div><small>这条的 loss = −log p_y</small><b>{f3(loss)}</b></div>
        <div><small>三条的 batch loss</small><b>{f3(batchLoss)}</b></div>
        <div><small>瞎猜的 loss ln 3</small><b>{f3(Math.log(3))}</b></div>
      </div>

      <div className={`viz-narr${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

"use client";

import { useState } from "react";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { BASE, DIVISOR_PRESETS, DIVISOR_SCORES, headDim, scaledWeights } from "@/lib/ml/transformerArch";
import { BahFrame, P } from "../bahdanau/shared";

const D_K = headDim(BASE.dModel, BASE.heads);
const STANDARD = Math.sqrt(D_K);
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export default function ScaledDivisorFigure() {
  const [c, setC] = useState(STANDARD);
  const w = scaledWeights(DIVISOR_SCORES, c);
  const tone = c < STANDARD ? "is-warn" : c > STANDARD ? "is-warn" : "is-good";

  return (
    <BahFrame
      title="图 2 · 除数实验：同一组分数，除以不同的数再 softmax"
      description={`两个 Key 的原始分数固定为 [${DIVISOR_SCORES.join(", ")}]。拖动除数 c，看 softmax([8 / c, 0]) 怎么变。d_k = ${D_K} 时论文用的除数是 √${D_K} = ${STANDARD}。`}
      footnote={<>教学示例：分数是固定的构造值。它只说明除数怎样改变 softmax 的尖锐程度，不能据此断言换一种缩放训练出的模型一定更好或更差。</>}
    >
      <Slider label="除数 c" min={1} max={100} step={1} value={c} display={String(c)} onChange={setC} />
      <div className="viz-controls" role="group" aria-label="预设除数">
        {DIVISOR_PRESETS.map((v) => (
          <button key={v} type="button" aria-pressed={c === v} className={`viz-btn${c === v ? " is-on" : ""}`} onClick={() => setC(v)}>c = {v}{v === STANDARD ? "（√d_k）" : ""}</button>
        ))}
        <button type="button" className="viz-btn" onClick={() => setC(STANDARD)}>重置</button>
      </div>
      <Bars
        rows={[
          { label: `Key 1 · 缩放后分数 ${(DIVISOR_SCORES[0] / c).toFixed(2)}`, value: w[0], color: P.att, text: pct(w[0]) },
          { label: `Key 2 · 缩放后分数 ${(DIVISOR_SCORES[1] / c).toFixed(2)}`, value: w[1], color: P.enc, text: pct(w[1]) },
        ]}
      />
      <div className={`viz-narr ${tone}`} aria-live="polite">
        c = {c}：softmax([{(DIVISOR_SCORES[0] / c).toFixed(2)}, 0]) = [{pct(w[0])}, {pct(w[1])}]。
        {c < STANDARD && " 除数偏小，分数差被保留得很大，权重几乎全压在 Key 1 上；softmax 落在平坦的饱和区，梯度很小。"}
        {c === STANDARD && " 这是 √d_k = 8：两个 Key 都拿到了明显的权重，分布既不是一边倒，也没有被抹平。"}
        {c > STANDARD && " 除数偏大，分数差被压小，两个 Key 的权重趋向各一半，Attention 分不出该看谁。"}
      </div>
    </BahFrame>
  );
}

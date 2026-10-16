"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Kind = "gen" | "clip";

const SEQ: { t: string; part: "vis" | "prompt" | "answer" }[] = [
  { t: "V1", part: "vis" },
  { t: "…", part: "vis" },
  { t: "Vk", part: "vis" },
  { t: "图里", part: "prompt" },
  { t: "是", part: "prompt" },
  { t: "什么？", part: "prompt" },
  { t: "一只", part: "answer" },
  { t: "猫", part: "answer" },
  { t: "在", part: "answer" },
  { t: "沙发上", part: "answer" },
  { t: "<eos>", part: "answer" },
];

const ROWS: [string, string, string][] = [
  ["监督信号", "图像 + prompt 对应的目标文字", "哪张图和哪段文字是同一对"],
  ["模型输出", "每个位置一个词表大小的分布", "一个 N×N 相似度矩阵"],
  ["loss 作用在", "答案 token 的位置（prompt、视觉位置通常不计）", "整个 batch 的每一行、每一列"],
  ["图像表示", "多个 visual token，供 LLM 逐词读取", "一个全局向量"],
  ["负例", "不需要显式负例：词表里其他词就是“错的”", "batch 内其他样本"],
  ["学到的能力", "看图生成、问答、推理", "图文检索、zero-shot 分类"],
];

export default function LossComparison() {
  const [kind, setKind] = useState<Kind>("gen");
  return (
    <VisualizationFrame
      title="两种训练目标：生成式 CE vs CLIP 对比损失"
      description="同样是“让图和文对上”，两种目标的监督信号、输出形式和 loss 位置完全不同。"
      footnote="两者不是互斥的：有的模型在不同阶段或同一阶段混合使用多种目标，这里只对比两种最典型的形式。"
    >
      <div className="viz-controls">
        <div className="viz-tabs" role="tablist" aria-label="loss 类型">
          <button type="button" role="tab" aria-selected={kind === "gen"} className={`viz-tab${kind === "gen" ? " is-on" : ""}`} onClick={() => setKind("gen")}>Generative CE</button>
          <button type="button" role="tab" aria-selected={kind === "clip"} className={`viz-tab${kind === "clip" ? " is-on" : ""}`} onClick={() => setKind("clip")}>CLIP Contrastive</button>
        </div>
      </div>

      {kind === "gen" ? (
        <div className="viz-panel">
          <h5 className="nocase">一条训练样本 · loss 只算在答案上</h5>
          <div className="tok-strip">
            {SEQ.map((s, i) => (
              <span key={i} className={`tok ${s.part === "vis" ? "is-vis" : s.part === "prompt" ? "is-text" : "is-done"}`}>
                {s.t}
                <small>{s.part === "answer" ? "CE ✓" : "不计"}</small>
              </span>
            ))}
          </div>
          <p className="viz-k" style={{ marginTop: 8 }}>
            L_gen = −Σ_t log p(y_t | I, x, y_&lt;t)，t 只遍历答案位置。“猫”这个位置的预测要对，模型就得从 visual token 里读出“这是一只猫”。
          </p>
        </div>
      ) : (
        <div className="viz-panel">
          <h5 className="nocase">一个 batch · loss 作用在整个矩阵上</h5>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 34px)", gap: 4 }} aria-label="3×3 相似度矩阵，对角线为正例">
            {Array.from({ length: 9 }, (_, k) => {
              const pos = Math.floor(k / 3) === k % 3;
              return <span key={k} style={{ height: 34, borderRadius: 4, display: "grid", placeItems: "center", fontSize: 11, background: pos ? "#e9f7e9" : "#fbeaea", border: pos ? "2px solid var(--vgood)" : "1px solid var(--vline)" }}>{pos ? "+" : "−"}</span>;
            })}
          </div>
          <p className="viz-k" style={{ marginTop: 8 }}>
            L = ½(L_I→T + L_T→I)：按行、按列各做一次 softmax 交叉熵，把对角线推高。细节见 CLIP 实验台。
          </p>
        </div>
      )}

      <div className="viz-scroll" style={{ marginTop: 12 }}>
        <table className="viz-table" style={{ minWidth: 460 }}>
          <thead>
            <tr><th /><th style={{ color: kind === "gen" ? "var(--ink)" : undefined }}>生成式 CE</th><th style={{ color: kind === "clip" ? "var(--ink)" : undefined }}>CLIP 对比损失</th></tr>
          </thead>
          <tbody>
            {ROWS.map(([k, a, b]) => (
              <tr key={k}><td>{k}</td><td style={{ opacity: kind === "gen" ? 1 : 0.55 }}>{a}</td><td style={{ opacity: kind === "clip" ? 1 : 0.55 }}>{b}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </VisualizationFrame>
  );
}

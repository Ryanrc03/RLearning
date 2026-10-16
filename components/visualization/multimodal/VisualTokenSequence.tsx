"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const BEFORE = ["请", "描述"];
const AFTER = ["里", "的", "动物"];
const COUNTS = [
  [196, "196 · 不 merge"],
  [49, "49 · 2×2 merge"],
] as const;

type Sel = { kind: "text"; word: string } | { kind: "vis"; k: number } | { kind: "image" };

// A tiny deterministic "embedding" so every token shows the same width but different values.
function stripes(seed: number, vis: boolean) {
  return Array.from({ length: 8 }, (_, i) => {
    const v = Math.abs(Math.sin(seed * 12.9898 + i * 78.233)) % 1;
    return <i key={i} style={{ display: "inline-block", width: 4, height: 10, marginRight: 1, borderRadius: 1, background: vis ? `rgba(42,120,214,${0.2 + v * 0.8})` : `rgba(27,175,122,${0.2 + v * 0.8})` }} />;
  });
}

export default function VisualTokenSequence() {
  const [open, setOpen] = useState(false);
  const [k, setK] = useState<number>(196);
  const [sel, setSel] = useState<Sel>({ kind: "image" });
  const shown = [0, 1, 2, 3, 4, 5, -1, k - 2, k - 1];
  const nText = BEFORE.length + AFTER.length;
  const seqLen = open ? nText + k + 2 : nText + 1;
  const animalSelected = sel.kind === "text" && sel.word === "动物";

  const textTok = (w: string, i: number) => (
    <button key={w} type="button" className={`tok is-text${sel.kind === "text" && sel.word === w ? " is-active" : ""}`} onClick={() => setSel({ kind: "text", word: w })} title="文本 token：词表 id → embedding 表的一行">
      {w}
      <small>{stripes(i + 1, false)}</small>
    </button>
  );

  let detail: string;
  if (sel.kind === "vis") detail = `V${sel.k + 1} 是一个连续的 4096 维向量，由 ViT 对图像区域编码、再经 projector 映射得到。它不是“猫”这个词的 id，词表里也找不到它；两张不同的猫图会得到不同的 V${sel.k + 1}。`;
  else if (sel.kind === "image") detail = open ? "[IMAGE] 占位符已经被替换成一串 visual token，前后加了 <vision_start> / <vision_end> 标记边界。之后 LLM 看到的只是一条更长的 embedding 序列。" : "点 [IMAGE]：这个占位符在进入 LLM 之前会被展开成 k 个 visual token。";
  else if (animalSelected) detail = open ? "“动物”这个位置的 Query 会和它之前所有位置的 Key 做点积，包括每一个 visual token。它们都在可读范围内（标了 ←），权重高的那些 Value 被读进来，所以 LLM 能“看到”图里的区域。" : "先展开 [IMAGE]，再看“动物”这个位置能读到什么。";
  else detail = `“${sel.word}”是文本 token：tokenizer 给出一个离散 id，再查 embedding 表的那一行，得到 4096 维向量。`;

  return (
    <VisualizationFrame
      title="把图片插进文本序列"
      description="同一条 prompt：请 描述 [IMAGE] 里 的 动物。点 [IMAGE] 展开成 visual tokens，点任意 token 看它是什么。绿色是文本 embedding，蓝色是视觉 embedding，宽度相同（同一个 hidden 维度）。"
      footnote="示意图。很多 VLM（LLaVA、Qwen-VL 系列）用占位符替换的方式把视觉 embedding 拼进序列；也有模型（如 Flamingo）用 cross-attention 让文本层去读图像特征，图像不占序列位置。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${open ? " is-on" : " primary"}`} onClick={() => { setOpen((o) => !o); setSel({ kind: "image" }); }}>{open ? "收起 [IMAGE]" : "展开 [IMAGE]"}</button>
        <span className="viz-k">visual token 数</span>
        <div className="viz-chips" role="group" aria-label="visual token 数">
          {COUNTS.map(([c, label]) => (
            <button key={c} type="button" className={`viz-chip mono${k === c ? " is-on" : ""}`} aria-pressed={k === c} onClick={() => setK(c)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="viz-panel">
        <h5 className="nocase">LLM 的输入序列 · 长度 {seqLen} · 每个位置都是 4096 维</h5>
        <div className="tok-strip">
          {BEFORE.map((w, i) => textTok(w, i))}
          {!open ? (
            <button type="button" className={`tok is-vis${sel.kind === "image" ? " is-active" : ""}`} onClick={() => { setOpen(true); setSel({ kind: "image" }); }}>[IMAGE]<small>点我展开</small></button>
          ) : (
            <>
              <span className="tok is-special">⟨vision_start⟩<small>special</small></span>
              {shown.map((i) =>
                i === -1 ? (
                  <span key="gap" className="viz-k">… 共 {k} 个 …</span>
                ) : (
                  <button key={i} type="button" className={`tok is-vis${sel.kind === "vis" && sel.k === i ? " is-active" : ""}`} onClick={() => setSel({ kind: "vis", k: i })} title="每个 Visual Token 是一个连续 Embedding，而不是“猫”这个词的 ID">
                    {animalSelected ? "← " : ""}V{i + 1}
                    <small>{stripes(100 + i, true)}</small>
                  </button>
                ),
              )}
              <span className="tok is-special">⟨vision_end⟩<small>special</small></span>
            </>
          )}
          {AFTER.map((w, i) => textTok(w, i + 10))}
        </div>
        <div className="viz-legend">
          <span><i style={{ background: "#ecf8f3", border: "1px solid #9ad6bf" }} />文本 token：离散 id → 查表</span>
          <span><i style={{ background: "#eaf3fd", border: "1px solid #9cc3ef" }} />视觉 token：连续向量，由图像算出</span>
        </div>
      </div>

      <div className="viz-grid2" style={{ marginTop: 14 }}>
        <div className="viz-narr" style={{ marginTop: 0 }} aria-live="polite">{detail}</div>
        <div className="viz-panel">
          <h5 className="nocase">张量形状（示意，非某个模型的官方参数）</h5>
          <pre className="viz-mono" style={{ margin: 0, padding: 0, background: "none", border: 0, fontSize: 11.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
{`T  = text_embed(ids)   [B, ${nText}, 4096]
V  = ViT(image)        [B, 196, 1024]
${k === 196 ? "V' = projector(V)      [B, 196, 4096]  逐个映射" : "V' = merger(V)         [B, 49, 4096]   相邻 2×2 合一，4:1"}
X  = 替换 [IMAGE]       [B, ${nText} + ${k} + 2, 4096] = [B, ${nText + k + 2}, 4096]`}
          </pre>
        </div>
      </div>
    </VisualizationFrame>
  );
}

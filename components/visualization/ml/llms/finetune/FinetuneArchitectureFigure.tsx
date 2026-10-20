"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { CHINESE_BASE_PARAMS, headParams, softmax } from "@/lib/ml/finetune";

// BERT fine-tuning, figure 1: the model itself for one sentence. Columns are
// token positions; bottom to top: tokens and attention mask, the summed
// embeddings, encoder layer 1, layers 2–11 folded, layer 12 (attention fan
// from [CLS] to every real token), the per-position outputs. Only the [CLS]
// output continues into the pooler, the new Linear(768, 3) head and softmax;
// the loss box exists only in training. Buttons focus "what is new" and
// "what the gradient updates".

type Focus = "none" | "new" | "grad";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const CY = "#d9b24a";
const INK = "#3b4234";
const GREY = "#9a9c8d";
const F1 = "#dbe8f8";
const F2 = "#fbe3d8";
const F3 = "#d9f1e6";
const FY = "#fbf1cf";
const MUTED = "#76796f";
const W = 700;
const H = 414;

const TOKENS = ["[CLS]", "国", "补", "到", "账", "了", "[SEP]", "[PAD]"];
const PAD = TOKENS.length - 1;
const colX = (i: number) => 132 + i * 50;
const CW = 42;
const LEFT = colX(0) - CW / 2 - 6;
const RIGHT = colX(PAD) + CW / 2 + 6;

// Rows, top to bottom.
const Y_OUT = 58;
const L12 = 98;
const MID = 196;
const L1 = 222;
const Y_EMB = 322;
const Y_TOK = 360;
const Y_MASK = 394;

const HX = 540;
const HW = 152;
const DEMO_LOGITS = [-2.1, -0.6, 3.0]; // 示意值：训练结束时「国补到账了」的 logits
const LABELS = ["负面", "中性", "正面"];
const LABEL_COLOR = [C2, MUTED, C3];

const fmt = (n: number) => n.toLocaleString("en-US");

function Layer({ y, n, dim, bold, fan }: { y: number; n: number; dim: boolean; bold: boolean; fan: boolean }) {
  const sw = bold ? 2.2 : 1.3;
  return (
    <g opacity={dim ? 0.28 : 1} style={{ transition: "opacity .3s" }}>
      <text x={8} y={y + 22} fontSize={10.5} fontWeight={600} fill={INK}>第 {n} 层</text>
      <text x={8} y={y + 36} fontSize={8.5} fill={MUTED}>[8, 768] → [8, 768]</text>
      <text x={8} y={y + 64} fontSize={8.5} fill={MUTED}>FFN 每个位置各算一次</text>
      {/* attention sublayer */}
      <rect x={LEFT} y={y} width={RIGHT - LEFT} height={34} rx={5} fill={F1} stroke={C1} strokeWidth={sw} />
      <text x={RIGHT - 6} y={y + 12} fontSize={8.5} textAnchor="end" fill={C1}>多头自注意力</text>
      {fan &&
        TOKENS.slice(0, PAD).map((_, j) => (
          <line key={j} x1={colX(0)} y1={y + 6} x2={colX(j)} y2={y + 30} stroke={C1} strokeWidth={1} opacity={0.75} />
        ))}
      {fan && <text x={colX(PAD)} y={y + 28} fontSize={8} textAnchor="middle" fill={GREY}>mask 掉</text>}
      {/* residual + LayerNorm */}
      <rect x={LEFT} y={y + 37} width={RIGHT - LEFT} height={9} rx={3} fill={F3} stroke={C3} strokeWidth={1} />
      <text x={(LEFT + RIGHT) / 2} y={y + 44.5} fontSize={7.5} textAnchor="middle" fill={C3}>残差 + LayerNorm</text>
      {/* feed-forward, applied to every position separately */}
      {TOKENS.map((_, i) => (
        <rect key={i} x={colX(i) - CW / 2} y={y + 50} width={CW} height={22} rx={4} fill={F1} stroke={C1} strokeWidth={sw * 0.8} />
      ))}
      <text x={colX(0)} y={y + 64} fontSize={8} textAnchor="middle" fill={C1}>FFN</text>
      <rect x={LEFT} y={y + 75} width={RIGHT - LEFT} height={9} rx={3} fill={F3} stroke={C3} strokeWidth={1} />
      <text x={(LEFT + RIGHT) / 2} y={y + 82.5} fontSize={7.5} textAnchor="middle" fill={C3}>残差 + LayerNorm</text>
    </g>
  );
}

const NARR: Record<Focus, { text: string; tone: string }> = {
  none: {
    text: "一句「国补到账了」补到 8 个位置，从下往上：每个 token 查三张嵌入表相加，过 12 层编码器，每层都是「多头自注意力 + FFN」，形状始终是 [8, 768]。顶上每个位置都有一个输出向量，但只有 [CLS] 那一个被送进右边的 pooler、分类头和 softmax。点上面两个按钮看哪些是新的、梯度更新到哪里。",
    tone: "",
  },
  new: {
    text: `新的只有右边橙色的分类头：一个 768 × 3 的权重加 3 个偏置，共 ${fmt(headParams(768, 3))} 个参数，随机初始化。左边整座编码器、嵌入表和绿色的 pooler（约 ${fmt(CHINESE_BASE_PARAMS)} 个参数）都从 hfl/chinese-macbert-base 原样载入。[CLS] 不是新加的东西：它是词表里本来就有的第 101 号 token，预训练时就在每句话的开头。`,
    tone: " is-warn",
  },
  grad: {
    text: "全参数微调时，梯度从 loss 出发，经分类头、pooler 回到第 12 层的 [CLS] 输出，再顺着注意力的连线分到每一个真实位置，一层层传回第 1 层和嵌入表。所以更新的不是「[CLS] 这个 token」，而是整个模型：[CLS] 只是读出结果的那个位置。被 mask 的 [PAD] 不被任何位置读取，拿不到梯度；其余 7 个位置顶层的输出虽然没接分类头，它们下面每一层的计算都参与了更新。",
    tone: " is-good",
  },
};

export default function FinetuneArchitectureFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const isNew = focus === "new";
  const isGrad = focus === "grad";
  const dimBody = isNew;
  const p = softmax(DEMO_LOGITS);
  const narr = NARR[focus];
  const padDim = isGrad ? 0.25 : 1;

  return (
    <VisualizationFrame
      title="微调时的模型：MacBERT 编码器 + 一个新的分类头"
      description="每一列是一个 token 位置，从下往上是输入、嵌入、12 层编码器、每个位置的输出。颜色按含义：黄色是 token 与张量，蓝色是注意力和 FFN，绿色是残差、LayerNorm 和 pooler，橙色是新加的分类头，灰色虚线只在训练时存在。"
      footnote={<>softmax 的三个概率是示意值。参数量：bert-base-uncased 的 BertModel 有 109,482,240 个参数，换成 21,128 行的中文词表，按论文数字换算得 {fmt(CHINESE_BASE_PARAMS)}（MacBERT-base 与 bert-base-chinese 结构相同）。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${isNew ? " is-on" : ""}`} onClick={() => setFocus("new")}>哪些是新的</button>
        <button type="button" className={`viz-btn${isGrad ? " is-on" : ""}`} onClick={() => setFocus("grad")}>梯度更新到哪里</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr.text} style={{ minWidth: 620 }}>
          <defs>
            <marker id="fta-ink" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={INK} /></marker>
            <marker id="fta-grey" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={GREY} /></marker>
            <marker id="fta-orange" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C2} /></marker>
          </defs>

          {/* outputs of layer 12 */}
          <g opacity={dimBody ? 0.28 : 1}>
            <text x={8} y={Y_OUT + 10} fontSize={10.5} fontWeight={600} fill={INK}>每个位置的输出</text>
            <text x={8} y={Y_OUT + 24} fontSize={8.5} fill={MUTED}>[8, 768]</text>
            {TOKENS.map((t, i) => (
              <g key={i} opacity={i === PAD ? padDim * 0.6 : i === 0 ? 1 : 0.55}>
                <rect x={colX(i) - CW / 2} y={Y_OUT} width={CW} height={26} rx={4} fill={FY} stroke={CY} strokeWidth={i === 0 ? 2 : 1} />
                <text x={colX(i)} y={Y_OUT + 17} fontSize={8.5} textAnchor="middle" fill={INK}>h{i === 0 ? "[CLS]" : `_${t.replace(/[[\]]/g, "")}`}</text>
              </g>
            ))}
            <text x={(colX(1) + colX(PAD)) / 2} y={Y_OUT - 8} fontSize={8.5} textAnchor="middle" fill={MUTED}>其余位置的输出不接分类头</text>
          </g>

          <Layer y={L12} n={12} dim={dimBody} bold={isGrad} fan />
          <g opacity={dimBody ? 0.28 : 1}>
            <text x={(LEFT + RIGHT) / 2} y={MID + 4} fontSize={10} textAnchor="middle" fill={C1}>⋮ 第 2 到 11 层，结构相同，每层参数各不相同</text>
          </g>
          <Layer y={L1} n={1} dim={dimBody} bold={isGrad} fan={false} />

          {/* embeddings */}
          <g opacity={dimBody ? 0.28 : 1}>
            <text x={8} y={Y_EMB + 12} fontSize={10.5} fontWeight={600} fill={INK}>嵌入</text>
            <text x={8} y={Y_EMB + 25} fontSize={8.5} fill={MUTED}>token + segment + position</text>
            {TOKENS.map((_, i) => (
              <rect key={i} x={colX(i) - CW / 2} y={Y_EMB} width={CW} height={24} rx={4} fill={FY} stroke={CY} strokeWidth={isGrad && i !== PAD ? 2 : 1} opacity={i === PAD ? padDim : 1} />
            ))}
            <text x={colX(0)} y={Y_EMB + 15} fontSize={8} textAnchor="middle" fill={INK}>E[CLS]</text>
          </g>

          {/* input tokens and attention mask */}
          <g opacity={dimBody ? 0.28 : 1}>
            <text x={8} y={Y_TOK + 15} fontSize={10.5} fontWeight={600} fill={INK}>输入 token</text>
            <text x={8} y={Y_MASK + 12} fontSize={9} fill={MUTED}>attention_mask</text>
            {TOKENS.map((t, i) => {
              const special = t.startsWith("[");
              return (
                <g key={i} opacity={i === PAD ? padDim : 1}>
                  <rect x={colX(i) - CW / 2} y={Y_TOK} width={CW} height={22} rx={4} fill={special && i !== PAD ? INK : "#fff"} stroke={i === PAD ? GREY : INK} strokeDasharray={i === PAD ? "3 2" : undefined} />
                  <text x={colX(i)} y={Y_TOK + 15} fontSize={special ? 9 : 11} textAnchor="middle" fill={special && i !== PAD ? "#fff" : i === PAD ? GREY : INK}>{t}</text>
                  <text x={colX(i)} y={Y_MASK + 12} fontSize={10} textAnchor="middle" fill={i === PAD ? GREY : C1}>{i === PAD ? 0 : 1}</text>
                </g>
              );
            })}
          </g>

          {/* [CLS] output → head */}
          <path d={`M ${colX(0)} ${Y_OUT} L ${colX(0)} 30 L ${HX - 4} 30`} fill="none" stroke={INK} strokeWidth={isGrad ? 2 : 1.4} markerEnd="url(#fta-ink)" opacity={dimBody ? 0.5 : 1} />
          <text x={colX(3)} y={25} fontSize={8.5} textAnchor="middle" fill={INK}>只取 [CLS] 这一列：[1, 768]</text>

          <g opacity={isNew ? 0.28 : 1}>
            <rect x={HX} y={12} width={HW} height={38} rx={6} fill={F3} stroke={C3} strokeWidth={isGrad ? 2.2 : 1.4} />
            <text x={HX + HW / 2} y={27} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={INK}>pooler（载入的）</text>
            <text x={HX + HW / 2} y={41} fontSize={8.5} textAnchor="middle" fill={MUTED}>Linear 768 → 768 + tanh</text>
            <line x1={HX + HW / 2} y1={50} x2={HX + HW / 2} y2={64} stroke={INK} strokeWidth={1.3} markerEnd="url(#fta-ink)" />
            <text x={HX + HW / 2 + 6} y={60} fontSize={8} fill={MUTED}>dropout 0.1</text>
          </g>

          <rect x={HX} y={66} width={HW} height={44} rx={6} fill={F2} stroke={C2} strokeWidth={isNew || isGrad ? 2.6 : 1.4} />
          <text x={HX + HW / 2} y={83} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={INK}>分类头（新）</text>
          <text x={HX + HW / 2} y={98} fontSize={8.5} textAnchor="middle" fill={MUTED}>Linear 768 → 3 · {fmt(headParams(768, 3))} 个参数</text>

          <g opacity={isNew ? 0.28 : 1}>
            <line x1={HX + HW / 2} y1={110} x2={HX + HW / 2} y2={124} stroke={INK} strokeWidth={1.3} markerEnd="url(#fta-ink)" />
            <rect x={HX} y={126} width={HW} height={84} rx={6} fill="#fff" stroke={C2} strokeWidth={1.2} />
            <text x={HX + 8} y={141} fontSize={10} fontWeight={600} fill={INK}>softmax → 三个概率</text>
            {LABELS.map((l, k) => (
              <g key={k} transform={`translate(${HX + 8} ${150 + k * 18})`}>
                <text x={0} y={10} fontSize={9} fill={LABEL_COLOR[k]}>{l}</text>
                <rect x={30} y={2} width={80} height={9} rx={2} fill="#f1efe6" />
                <rect x={30} y={2} width={80 * p[k]} height={9} rx={2} fill={LABEL_COLOR[k]} />
                <text x={HW - 16} y={10} fontSize={9} textAnchor="end" fill={INK}>{p[k].toFixed(2)}</text>
              </g>
            ))}
          </g>

          {/* training only */}
          <g opacity={isNew ? 0.28 : 1}>
            <line x1={HX + HW / 2} y1={210} x2={HX + HW / 2} y2={226} stroke={GREY} strokeWidth={1.3} strokeDasharray="4 3" markerEnd="url(#fta-grey)" />
            <rect x={HX} y={228} width={HW} height={46} rx={6} fill="#fff" stroke={GREY} strokeDasharray="4 3" strokeWidth={isGrad ? 2 : 1.2} />
            <text x={HX + HW / 2} y={245} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={INK}>交叉熵 −log p_y</text>
            <text x={HX + HW / 2} y={261} fontSize={8.5} textAnchor="middle" fill={MUTED}>标签 y = 2 正面 · 只在训练时</text>
          </g>

          {/* backward path: loss → head → pooler → the [CLS] output, then down through every layer */}
          <g opacity={isGrad ? 1 : isNew ? 0.15 : 0.45} style={{ transition: "opacity .3s" }}>
            <path d={`M ${HX + HW - 8} 228 L ${HX + HW - 8} 40`} fill="none" stroke={C2} strokeWidth={isGrad ? 2 : 1.3} strokeDasharray="5 3" markerEnd="url(#fta-orange)" />
            <path d={`M ${HX - 4} 38 L ${colX(0) + 8} 38 L ${colX(0) + 8} ${Y_OUT - 2}`} fill="none" stroke={C2} strokeWidth={isGrad ? 2 : 1.3} strokeDasharray="5 3" markerEnd="url(#fta-orange)" />
            <path d={`M ${RIGHT + 18} ${Y_OUT + 13} L ${RIGHT + 18} ${Y_EMB + 12}`} fill="none" stroke={C2} strokeWidth={isGrad ? 2 : 1.3} strokeDasharray="5 3" markerEnd="url(#fta-orange)" />
            <text x={HX} y={300} fontSize={9.5} fontWeight={600} fill={C2}>反向传播（虚线）</text>
            <text x={HX} y={315} fontSize={8.5} fill={C2}>loss → 分类头 → pooler → [CLS] 输出，</text>
            <text x={HX} y={328} fontSize={8.5} fill={C2}>再沿每层的注意力传到所有真实位置，</text>
            <text x={HX} y={341} fontSize={8.5} fill={C2}>一直回到嵌入表；[PAD] 没有梯度</text>
          </g>
          {isGrad && (
            <text x={colX(PAD)} y={Y_EMB - 6} fontSize={8} textAnchor="middle" fill={GREY}>无梯度</text>
          )}
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: FY, border: `1px solid ${CY}` }} />token、嵌入与输出向量</span>
        <span><i style={{ background: F1, border: `1px solid ${C1}` }} />注意力与 FFN（载入）</span>
        <span><i style={{ background: F3, border: `1px solid ${C3}` }} />残差、LayerNorm、pooler（载入）</span>
        <span><i style={{ background: F2, border: `1px solid ${C2}` }} />新加的分类头</span>
        <span><i style={{ background: "#fff", border: `1px dashed ${GREY}` }} />只在训练时存在</span>
      </div>
      <div className={`viz-narr${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

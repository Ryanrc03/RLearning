"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { CHINESE_BASE_PARAMS, headParams } from "@/lib/ml/finetune";

// BERT fine-tuning, figure 1: the whole three-class fine-tuning pipeline in one
// row. Blue = the pretrained encoder, green = the [CLS] pooler, yellow = the
// tensors, orange = the new head, grey dashed = what exists only in training
// (labels, loss, the backward pass). Two buttons focus "what is new" and
// "what is training-only".

type Focus = "none" | "new" | "train";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const CY = "#d9b24a";
const GREY = "#9a9c8d";
const F1 = "#dbe8f8";
const F2 = "#fbe3d8";
const F3 = "#d9f1e6";
const FY = "#fbf1cf";
const INK = "#30332c";
const MUTED = "#76796f";
const W = 680;
const H = 236;
const BW = 100;
const XS = [8, 120, 232, 344, 456, 568];
const ROW = 58;
const BH = 62;

const fmt = (n: number) => n.toLocaleString("en-US");

function Box({ i, y = ROW, h = BH, title, lines, color, fill, dashed, dim, bold }: { i: number; y?: number; h?: number; title: string; lines: string[]; color: string; fill: string; dashed?: boolean; dim?: boolean; bold?: boolean }) {
  return (
    <g transform={`translate(${XS[i]} ${y})`} opacity={dim ? 0.28 : 1} style={{ transition: "opacity .3s" }}>
      <rect width={BW} height={h} rx={6} fill={fill} stroke={color} strokeWidth={bold ? 2.4 : 1.4} strokeDasharray={dashed ? "4 3" : undefined} />
      <text x={BW / 2} y={16} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={INK}>{title}</text>
      {lines.map((l, k) => (
        <text key={k} x={BW / 2} y={31 + k * 12} fontSize={8.5} textAnchor="middle" fill={MUTED}>{l}</text>
      ))}
    </g>
  );
}

function Arrow({ from, y = ROW + BH / 2, label, dim }: { from: number; y?: number; label?: string; dim?: boolean }) {
  const x1 = XS[from] + BW;
  const x2 = XS[from + 1];
  return (
    <g opacity={dim ? 0.28 : 1}>
      <line x1={x1 + 1} y1={y} x2={x2 - 3} y2={y} stroke={MUTED} strokeWidth={1.3} markerEnd="url(#ftp-ink)" />
      {label && <text x={(x1 + x2) / 2} y={y - 5} fontSize={8} textAnchor="middle" fill={MUTED}>{label}</text>}
    </g>
  );
}

const NARR: Record<Focus, { text: string; tone: string }> = {
  none: {
    text: "从左到右是一次前向：一批带标签的句子被切成字、补齐成 [batch, L] 的 id，过 12 层 MacBERT，取 [CLS] 位置的向量，经一个 768 → 3 的线性层得到三个 logits，softmax 成三个概率。下面一排灰色虚线只在训练时存在。点上面两个按钮分别看。",
    tone: "",
  },
  new: {
    text: `真正「新」的只有橙色这一块：一个 768 × 3 的权重和 3 个偏置，共 ${fmt(headParams(768, 3))} 个参数，随机初始化。蓝色编码器的约 ${fmt(CHINESE_BASE_PARAMS)} 个参数和绿色的 pooler 都从 hfl/chinese-macbert-base 原样载入。MacBERT 预训练时的 MLM 头和 SOP 头在这里用不上，直接丢掉。`,
    tone: " is-warn",
  },
  train: {
    text: "标签、交叉熵和反向传播只在训练时存在。loss 对 logits 的梯度是 p − y，再一路传回分类头、pooler 和 12 层编码器，全部参数一起更新，这就是全参数微调。推理时只走上面一排：argmax 三个概率就是预测。",
    tone: " is-good",
  },
};

export default function FinetunePipelineFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const dimMain = focus === "train";
  const dimNotNew = focus === "new";
  const dimTrain = focus === "new";
  const narr = NARR[focus];

  return (
    <VisualizationFrame
      title="三分类微调的全流程"
      description="上面一排是前向，下面一排是只在训练时存在的部分。颜色按含义：蓝色是预训练好的编码器，绿色是 [CLS] 的 pooler，黄色是张量，橙色是新加的分类头，灰色虚线是训练专用。"
      footnote={<>参数量：bert-base-uncased 的 BertModel 有 109,482,240 个参数，把 30,522 行的英文词表换成 21,128 行的中文词表，按论文数字换算得 {fmt(CHINESE_BASE_PARAMS)}（MacBERT-base 与 bert-base-chinese 结构相同）。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "new" ? " is-on" : ""}`} onClick={() => setFocus("new")}>哪些是新的</button>
        <button type="button" className={`viz-btn${focus === "train" ? " is-on" : ""}`} onClick={() => setFocus("train")}>哪些只在训练时</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr.text} style={{ minWidth: 600 }}>
          <defs>
            <marker id="ftp-ink" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={MUTED} /></marker>
            <marker id="ftp-grey" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={GREY} /></marker>
          </defs>

          <text x={8} y={22} fontSize={11} fontWeight={600} fill={INK} opacity={dimMain ? 0.28 : 1}>前向：训练和推理都走</text>
          <text x={8} y={38} fontSize={9} fill={MUTED} opacity={dimMain ? 0.28 : 1}>形状按 batch = 32、补齐长度 L = 64 写</text>

          <Box i={0} title="一批句子" lines={["「国补到账了」", "「国补什么时候发」", "…… 32 条"]} color={CY} fill={FY} dim={dimMain || dimNotNew} />
          <Arrow from={0} dim={dimMain || dimNotNew} />
          <Box i={1} title="Tokenizer" lines={["按字切，加 [CLS] [SEP]", "补 [PAD]，截到 128", "input_ids [32, 64]"]} color={CY} fill={FY} dim={dimMain || dimNotNew} />
          <Arrow from={1} dim={dimMain || dimNotNew} />
          <Box i={2} title="MacBERT 编码器" lines={["12 层 · H = 768", "预训练权重载入", "[32, 64, 768]"]} color={C1} fill={F1} dim={dimMain || dimNotNew} />
          <Arrow from={2} dim={dimMain || dimNotNew} />
          <Box i={3} title="取 [CLS] + pooler" lines={["768→768 + tanh", "载入，后接 dropout", "[32, 768]"]} color={C3} fill={F3} dim={dimMain || dimNotNew} />
          <Arrow from={3} dim={dimMain} />
          <Box i={4} title="分类头（新）" lines={["Linear 768 → 3", `${fmt(headParams(768, 3))} 个参数`, "logits [32, 3]"]} color={C2} fill={F2} bold={focus === "new"} dim={dimMain} />
          <Arrow from={4} dim={dimMain || dimNotNew} />
          <Box i={5} title="softmax" lines={["负面 / 中性 / 正面", "三个概率和为 1", "推理：取 argmax"]} color={C2} fill={F2} dim={dimMain || dimNotNew} />

          {/* training-only row */}
          <g opacity={dimTrain ? 0.28 : 1} style={{ transition: "opacity .3s" }}>
            <text x={8} y={152} fontSize={11} fontWeight={600} fill={GREY}>只在训练时</text>
            <Box i={0} y={160} h={44} title="标签 y" lines={["0 负面 · 1 中性 · 2 正面"]} color={GREY} fill="#fff" dashed bold={focus === "train"} />
            <line x1={XS[0] + BW} y1={182} x2={XS[5] - 3} y2={182} stroke={GREY} strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#ftp-grey)" />
            <line x1={XS[5] + BW / 2} y1={ROW + BH + 1} x2={XS[5] + BW / 2} y2={157} stroke={GREY} strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#ftp-grey)" />
            <Box i={5} y={160} h={44} title="交叉熵 loss" lines={["−log p_y，batch 平均"]} color={GREY} fill="#fff" dashed bold={focus === "train"} />
            <path d={`M ${XS[5] + 10} ${206} C ${XS[5] - 40} ${228}, ${XS[2] + 120} ${228}, ${XS[2] + BW / 2} ${ROW + BH + 4}`} fill="none" stroke={GREY} strokeWidth={focus === "train" ? 2 : 1.3} strokeDasharray="4 3" markerEnd="url(#ftp-grey)" />
            <text x={XS[3] + 30} y={226} fontSize={8.5} fill={GREY} textAnchor="middle">反向传播：梯度 p − y 流回分类头、pooler 和 12 层编码器</text>
          </g>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: F1, border: `1px solid ${C1}` }} />预训练好的编码器</span>
        <span><i style={{ background: F3, border: `1px solid ${C3}` }} />[CLS] pooler</span>
        <span><i style={{ background: FY, border: `1px solid ${CY}` }} />数据与张量</span>
        <span><i style={{ background: F2, border: `1px solid ${C2}` }} />新加的分类头</span>
        <span><i style={{ background: "#fff", border: `1px dashed ${GREY}` }} />只在训练时存在</span>
      </div>
      <div className={`viz-narr${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

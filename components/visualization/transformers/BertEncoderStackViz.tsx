"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Focus = "none" | "layer" | "heads";

// Blue = self-attention, orange = feed-forward, green = residual + LayerNorm, yellow = the tensors going in and out.
const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const CY = "#d9b24a";
const T1 = "#dbe8f8";
const T2 = "#fbe3d8";
const T3 = "#d9f1e6";
const TY = "#fbf1cf";
const LAYER_FILL = "#eef3fb";
const INK = "#30332c";
const LINE = "#76796f";
const W = 640;
const H = 320;

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: "左边是整体：输入向量穿过 L 层一模一样的编码器层，每层进出都是 [11, 768]，形状不变、内容越来越带上下文。右边把其中一层打开：蓝色是自注意力，橙色是前馈网络，绿色是残差加 LayerNorm，黄色是进出的张量。BERT_BASE 是 12 层、768 维、12 头；BERT_LARGE 是 24 层、1024 维、16 头。",
  },
  layer: {
    text: "一层两步。第一步多头自注意力（蓝）：每个位置看整句，没有因果掩码，只遮 padding；12 个头各算一种关系，每头 64 维，拼回 768 维。第二步前馈网络（橙）：每个位置各自过一个 768 → 3072 → 768 的两层 MLP，GELU 激活。两步都带残差连接和 LayerNorm（绿），所以叠 12 层也训得动。",
    tone: "is-warn",
  },
  heads: {
    text: "顶层出来 11 个 768 维向量，怎么用看任务。句子级任务只取位置 0 的 h_0，过 pooler（一层 dense + tanh）再接分类头（橙）；token 级任务（NER、问答起止）每个位置各接一个头（绿）。预训练时另有 MLM 头接所有位置、NSP 头接 h_0（虚线），微调时这两个头丢掉。",
    tone: "is-good",
  },
};

function marker(color: string) {
  return color === C1 ? "url(#enc-blue)" : color === C2 ? "url(#enc-orange)" : color === C3 ? "url(#enc-green)" : color === CY ? "url(#enc-yellow)" : "url(#enc-grey)";
}

function Bar({ x, y, w, h, title, sub, fill, stroke, dim, bold, dash }: { x: number; y: number; w: number; h: number; title: string; sub?: string; fill: string; stroke: string; dim?: boolean; bold?: boolean; dash?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={dim ? 0.25 : 1}>
      <rect width={w} height={h} rx={5} fill={fill} stroke={stroke} strokeWidth={bold ? 2.2 : 1.3} strokeDasharray={dash ? "4 3" : undefined} />
      <text x={w / 2} y={sub ? 13 : h / 2 + 3.5} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={INK}>{title}</text>
      {sub && <text x={w / 2} y={26} fontSize={8} textAnchor="middle" fill={LINE}>{sub}</text>}
    </g>
  );
}

function Up({ x, y1, y2, color, dim, bold }: { x: number; y1: number; y2: number; color: string; dim?: boolean; bold?: boolean }) {
  return <line x1={x} y1={y1} x2={x} y2={y2 + 5} stroke={color} strokeWidth={bold ? 2 : 1.4} markerEnd={marker(color)} opacity={dim ? 0.25 : 1} />;
}

export default function BertEncoderStackViz() {
  const [focus, setFocus] = useState<Focus>("none");
  const onLayer = focus === "layer";
  const onHeads = focus === "heads";
  const dimStackBody = onLayer || onHeads; // the plain layers and the input bar
  const dimHeads = onLayer;
  const dimRight = onHeads;
  const narr = NARR[focus];
  const LX = 20;
  const LW = 272;
  const RX = 384;
  const RW = 200;

  return (
    <VisualizationFrame
      title="编码器：L 层同构的层叠起来，每层里是注意力加前馈"
      description="左边是整体，自下而上穿过 L 层；右边把一层打开。点按钮分别看一层内部的两步，和顶层输出被哪些头接走。"
      footnote={<>数字按 BERT_BASE：12 层、H = 768、12 个头 × 64 维、前馈中间层 3072。BERT_LARGE：24 层、H = 1024、16 个头、中间层 4096。LayerNorm 在残差相加之后（post-LN），与原始 Transformer 相同。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${onLayer ? " is-on" : ""}`} onClick={() => setFocus("layer")}>打开一层</button>
        <button type="button" className={`viz-btn${onHeads ? " is-on" : ""}`} onClick={() => setFocus("heads")}>看输出怎么用</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr.text}>
          <defs>
            <marker id="enc-blue" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C1} /></marker>
            <marker id="enc-orange" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C2} /></marker>
            <marker id="enc-green" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C3} /></marker>
            <marker id="enc-yellow" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={CY} /></marker>
            <marker id="enc-grey" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#9a9c8d" /></marker>
          </defs>

          {/* left: the stack */}
          <text x={LX + LW / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234" opacity={onLayer ? 0.25 : 1}>整体：L 层叠起来</text>
          <Bar x={LX} y={22} w={84} h={32} title="pooler → 句子级头" sub="只用 h_0（[CLS]）" fill={T2} stroke={C2} dim={dimHeads} bold={onHeads} />
          <Bar x={LX + 94} y={22} w={84} h={32} title="token 级头" sub="每个 h_i 各接一个" fill={T3} stroke={C3} dim={dimHeads} bold={onHeads} />
          <Bar x={LX + 188} y={22} w={84} h={32} title="MLM / NSP 头" sub="只在预训练时存在" fill="#fff" stroke="#9a9c8d" dim={dimHeads} bold={onHeads} dash />
          <Up x={LX + 42} y1={66} y2={54} color={C2} dim={dimHeads} bold={onHeads} />
          <Up x={LX + 136} y1={66} y2={54} color={C3} dim={dimHeads} bold={onHeads} />
          <Up x={LX + 230} y1={66} y2={54} color="#9a9c8d" dim={dimHeads} bold={onHeads} />
          <Bar x={LX} y={66} w={LW} h={24} title="输出 h_0 … h_10　[11, 768]" fill={TY} stroke={CY} dim={dimHeads} bold={onHeads} />
          <Up x={LX + LW / 2} y1={100} y2={90} color={CY} dim={dimStackBody} />
          <Bar x={LX} y={100} w={LW} h={22} title="编码器层 12" fill={onLayer ? T1 : LAYER_FILL} stroke={C1} dim={onHeads} bold={onLayer} />
          <Up x={LX + LW / 2} y1={132} y2={122} color={C1} dim={dimStackBody} />
          <Bar x={LX} y={132} w={LW} h={22} title="编码器层 11" fill={LAYER_FILL} stroke={C1} dim={dimStackBody} />
          <text x={LX + LW / 2} y={172} fontSize={14} textAnchor="middle" fill={C1} opacity={dimStackBody ? 0.25 : 1}>⋮</text>
          <Bar x={LX} y={184} w={LW} h={22} title="编码器层 2" fill={LAYER_FILL} stroke={C1} dim={dimStackBody} />
          <Up x={LX + LW / 2} y1={216} y2={206} color={C1} dim={dimStackBody} />
          <Bar x={LX} y={216} w={LW} h={22} title="编码器层 1" fill={LAYER_FILL} stroke={C1} dim={dimStackBody} />
          <Up x={LX + LW / 2} y1={252} y2={238} color={CY} dim={dimStackBody} />
          <Bar x={LX} y={252} w={LW} h={24} title="输入 x_0 … x_10　[11, 768]" fill={TY} stroke={CY} dim={dimStackBody} />
          <text x={LX + LW / 2} y={296} fontSize={8.5} textAnchor="middle" fill={LINE} opacity={dimStackBody ? 0.25 : 1}>每层形状不变：[11, 768] 进，[11, 768] 出</text>
          <text x={LX + LW / 2} y={309} fontSize={8.5} textAnchor="middle" fill={LINE} opacity={dimStackBody ? 0.25 : 1}>BASE 12 层 · LARGE 24 层</text>

          {/* zoom connector */}
          <g opacity={dimRight ? 0.25 : 1}>
            <path d={`M${LX + LW} 111 L ${RX - 20} 111 L ${RX - 20} 60`} fill="none" stroke={C1} strokeWidth={onLayer ? 1.6 : 1.1} strokeDasharray="4 3" />
            <path d={`M${LX + LW} 111 L ${RX - 20} 111 L ${RX - 20} 292`} fill="none" stroke={C1} strokeWidth={onLayer ? 1.6 : 1.1} strokeDasharray="4 3" />
          </g>

          {/* right: one layer */}
          <text x={RX + RW / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234" opacity={dimRight ? 0.25 : 1}>一层里面</text>
          <Bar x={RX} y={48} w={RW} h={22} title="x′（送往上一层）　[11, 768]" fill={TY} stroke={CY} dim={dimRight} />
          <Up x={RX + RW / 2} y1={100} y2={70} color={CY} dim={dimRight} bold={onLayer} />
          <Bar x={RX} y={100} w={RW} h={22} title="Add & LayerNorm" fill={T3} stroke={C3} dim={dimRight} bold={onLayer} />
          <Up x={RX + RW / 2} y1={134} y2={122} color={C3} dim={dimRight} bold={onLayer} />
          <Bar x={RX} y={134} w={RW} h={34} title="前馈网络 FFN" sub="768 → 3072 → 768 · GELU · 每个位置各自过" fill={T2} stroke={C2} dim={dimRight} bold={onLayer} />
          <Up x={RX + RW / 2} y1={186} y2={168} color={C2} dim={dimRight} bold={onLayer} />
          <Bar x={RX} y={186} w={RW} h={22} title="Add & LayerNorm" fill={T3} stroke={C3} dim={dimRight} bold={onLayer} />
          <Up x={RX + RW / 2} y1={222} y2={208} color={C3} dim={dimRight} bold={onLayer} />
          <Bar x={RX} y={222} w={RW} h={34} title="多头自注意力" sub="12 头 × 64 维 → 768 · 双向，只遮 padding" fill={T1} stroke={C1} dim={dimRight} bold={onLayer} />
          <Up x={RX + RW / 2} y1={282} y2={256} color={C1} dim={dimRight} bold={onLayer} />
          <Bar x={RX} y={282} w={RW} h={22} title="x（来自下一层）　[11, 768]" fill={TY} stroke={CY} dim={dimRight} />

          {/* residual paths */}
          <g opacity={dimRight ? 0.25 : 1}>
            <path d={`M${RX} 293 L ${RX - 14} 293 L ${RX - 14} 197 L ${RX - 2} 197`} fill="none" stroke={C3} strokeWidth={onLayer ? 2 : 1.4} markerEnd="url(#enc-green)" />
            <text x={RX - 18} y={248} fontSize={8} fontWeight={600} textAnchor="end" fill={C3}>残差</text>
            <path d={`M${RX + RW} 197 L ${RX + RW + 14} 197 L ${RX + RW + 14} 111 L ${RX + RW + 2} 111`} fill="none" stroke={C3} strokeWidth={onLayer ? 2 : 1.4} markerEnd="url(#enc-green)" />
            <text x={RX + RW + 18} y={158} fontSize={8} fontWeight={600} fill={C3}>残差</text>
          </g>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: T1, border: `1px solid ${C1}` }} />自注意力 / 编码器层</span>
        <span><i style={{ background: T2, border: `1px solid ${C2}` }} />前馈网络 / 句子级头</span>
        <span><i style={{ background: T3, border: `1px solid ${C3}` }} />残差 + LayerNorm / token 级头</span>
        <span><i style={{ background: TY, border: `1px solid ${CY}` }} />进出的张量 [11, 768]</span>
      </div>
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

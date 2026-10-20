"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";

type Focus = "all" | "forward" | "backward";

const INK = "#3b4234";
const MUTED = "#76796f";
const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GREEN = "#1baf7a";
const YELLOW = "#d9b24a";
const TRAIN = "#8b8e83";

function Box({ x, y, w, h, title, subtitle, stroke, fill, opacity = 1 }: {
  x: number; y: number; w: number; h: number; title: string; subtitle?: string;
  stroke: string; fill: string; opacity?: number;
}) {
  return <g opacity={opacity} style={{ transition: "opacity .2s" }}>
    <rect x={x} y={y} width={w} height={h} rx="5" fill={fill} stroke={stroke} strokeWidth="1.7" />
    <text x={x + w / 2} y={y + (subtitle ? h / 2 - 2 : h / 2 + 4)} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>{title}</text>
    {subtitle && <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" fontSize="9.5" fill={MUTED}>{subtitle}</text>}
  </g>;
}

function Arrow({ x1, y1, x2, y2, opacity = 1, training = false }: {
  x1: number; y1: number; x2: number; y2: number; opacity?: number; training?: boolean;
}) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2}
    stroke={training ? TRAIN : INK} strokeWidth={training ? 1.8 : 1.6}
    strokeDasharray={training ? "5 4" : undefined}
    markerEnd={training ? "url(#moe-e2e-back)" : "url(#moe-e2e-next)"}
    opacity={opacity} style={{ transition: "opacity .2s" }} />;
}

export default function DeepSeekMoEEndToEnd() {
  const [focus, setFocus] = useState<Focus>("all");
  const forwardOpacity = focus === "backward" ? 0.68 : 1;
  const backwardOpacity = focus === "forward" ? 0.2 : 1;
  const narrative = focus === "forward"
    ? "前向时，token 依次经过 embedding、第 1 层 dense Transformer、后 27 层含 MoE 的 Transformer，再由词表头得到下一词 logits。每层 attention 都会运行；每个 MoE 层只执行共享专家和该 token 选中的路由专家。"
    : focus === "backward"
      ? "训练时，LM loss 的梯度沿词表头、所有经过的 Transformer 层回到 embedding；attention、首层 dense FFN、共享专家、已选路由专家和 router 都更新。均衡损失另给 router 训练信号；未选专家没有这条 token 的 FFN 主损失梯度。"
      : "实线从上到下是前向计算，灰色虚线向上是反向传播。右边放大后 27 层中的一个 MoE FFN；图把重复的层压成一个框，训练时它们各有自己的参数。";

  return <VisualizationFrame
    title="DeepSeekMoE 16B：整机前向与反向训练"
    description="一张图把 28 层 Transformer、MoE 内部和两个损失放在同一条训练路径上。"
    footnote="论文配置：28 层，d_model=2048；第 1 层使用 dense FFN，第 2–28 层使用 MoE。每个 MoE 层为 2 个共享专家 + 64 个路由专家，每 token 选 6 个路由专家。图省略了每层归一化和残差连接的具体接线。"
  >
    <div className="viz-row">
      <button type="button" className={`viz-btn${focus === "forward" ? " is-on" : ""}`} onClick={() => setFocus("forward")}>看前向计算</button>
      <button type="button" className={`viz-btn${focus === "backward" ? " is-on" : ""}`} onClick={() => setFocus("backward")}>看反向更新</button>
      <button type="button" className="viz-btn" onClick={() => setFocus("all")}>重置</button>
    </div>
    <Figure width={700} height={600} minWidth={620} label={narrative}>
      <defs>
        <marker id="moe-e2e-next" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 8 4 L 0 8 Z" fill={INK} /></marker>
        <marker id="moe-e2e-back" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 8 4 L 0 8 Z" fill={TRAIN} /></marker>
      </defs>
      <text x="82" y="22" fontSize="11" fontWeight="700" fill={INK}>完整模型 · 每个 token 的前向路径</text>
      <text x="390" y="22" fontSize="10" fill={MUTED}>右侧只放大一个 MoE FFN</text>

      <Arrow x1={210} y1={68} x2={210} y2={91} opacity={forwardOpacity} />
      <Arrow x1={210} y1={129} x2={210} y2={153} opacity={forwardOpacity} />
      <Arrow x1={210} y1={213} x2={210} y2={239} opacity={forwardOpacity} />
      <Arrow x1={210} y1={350} x2={210} y2={381} opacity={forwardOpacity} />
      <Arrow x1={210} y1={421} x2={210} y2={450} opacity={forwardOpacity} />
      <Arrow x1={210} y1={489} x2={210} y2={538} opacity={backwardOpacity} training />

      <Box x={82} y={36} w={256} h={32} title="输入 token 序列" stroke={YELLOW} fill="#fbf1cf" opacity={forwardOpacity} />
      <Box x={82} y={91} w={256} h={38} title="Token embedding" subtitle="可训练参数" stroke={YELLOW} fill="#fbf1cf" opacity={forwardOpacity} />
      <Box x={82} y={153} w={256} h={60} title="Transformer 第 1 层" subtitle="Attention + dense FFN · 两者都训练" stroke={BLUE} fill="#dbe8f8" opacity={forwardOpacity} />

      <g opacity={forwardOpacity} style={{ transition: "opacity .2s" }}>
        <rect x="69" y="239" width="282" height="111" rx="6" fill="#f8fbfd" stroke={BLUE} strokeWidth="1.8" />
        <text x="210" y="260" textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>Transformer 第 2–28 层 × 27</text>
        <rect x="90" y="276" width="110" height="40" rx="4" fill="#dbe8f8" stroke={BLUE} strokeWidth="1.5" />
        <text x="145" y="300" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK}>Attention</text>
        <Arrow x1={201} y1={296} x2={219} y2={296} />
        <rect x="220" y="276" width="110" height="40" rx="4" fill="#fbe3d8" stroke={ORANGE} strokeWidth="1.5" />
        <text x="275" y="300" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK}>MoE FFN</text>
        <text x="210" y="337" textAnchor="middle" fontSize="9.5" fill={MUTED}>每层均有残差和归一化 · 各层独立训练</text>
        <line x1="351" y1="296" x2="383" y2="296" stroke={ORANGE} strokeWidth="1.5" />
      </g>

      <Box x={82} y={381} w={256} h={40} title="词表预测头 → 下一词 logits" subtitle="可训练参数" stroke={ORANGE} fill="#fbe3d8" opacity={forwardOpacity} />
      <Box x={82} y={450} w={256} h={39} title="下一词交叉熵 L_LM" stroke={TRAIN} fill="#fff" opacity={backwardOpacity} />

      <g opacity={forwardOpacity} style={{ transition: "opacity .2s" }}>
        <rect x="387" y="213" width="288" height="248" rx="5" fill="#fff" stroke="#c9d2cc" />
        <text x="531" y="235" textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>放大：任意一层的 MoE FFN</text>
        <Box x={496} y={250} w={70} h={29} title="输入 h" stroke={YELLOW} fill="#fbf1cf" />
        <path d="M 531 279 V 294 H 449 V 310 M 531 294 H 601 V 310" fill="none" stroke={INK} strokeWidth="1.5" />
        <Box x={398} y={310} w={103} h={38} title="共享专家 × 2" subtitle="每 token 必经" stroke={GREEN} fill="#d9f1e6" />
        <Box x={550} y={310} w={102} h={38} title="Router" subtitle="从 64 个选 6 个" stroke={BLUE} fill="#dbe8f8" />
        <Arrow x1={601} y1={348} x2={601} y2={366} />
        <Box x={550} y={366} w={102} h={34} title="路由专家 × 6" stroke={ORANGE} fill="#fbe3d8" />
        <path d="M 449 348 V 420 H 531 M 601 400 V 420 H 531" fill="none" stroke={INK} strokeWidth="1.5" />
        <Box x={478} y={420} w={106} h={30} title="加权求和 → h′" stroke={GREEN} fill="#d9f1e6" />
      </g>

      <path d="M 652 330 H 665 V 495 H 653" fill="none" stroke={TRAIN} strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#moe-e2e-back)" opacity={backwardOpacity} />
      <Box x={513} y={476} w={139} h={38} title="专家均衡损失" subtitle="给 router 额外梯度" stroke={TRAIN} fill="#fff" opacity={backwardOpacity} />
      <path d="M 583 514 V 556 H 339" fill="none" stroke={TRAIN} strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#moe-e2e-back)" opacity={backwardOpacity} />
      <Box x={82} y={538} w={256} h={38} title="总损失 → 反传 → AdamW" stroke={TRAIN} fill="#fff" opacity={backwardOpacity} />

      <g opacity={backwardOpacity} style={{ transition: "opacity .2s" }}>
        <path d="M 82 557 H 27 V 111" fill="none" stroke={TRAIN} strokeWidth="1.8" strokeDasharray="5 4" markerEnd="url(#moe-e2e-back)" />
        <Arrow x1={27} y1={110} x2={80} y2={110} training />
        <Arrow x1={27} y1={181} x2={80} y2={181} training />
        <Arrow x1={27} y1={296} x2={67} y2={296} training />
        <Arrow x1={27} y1={400} x2={80} y2={400} training />
        <text x="12" y="529" fontSize="10" fill={MUTED}>梯度 ↑</text>
      </g>
      <text x="82" y="594" fontSize="10" fill={MUTED}>实线：前向计算　灰色虚线：训练时反传　未选中的路由 FFN 不接收该 token 的主损失梯度</text>
    </Figure>
    <div className={`viz-narr${focus === "forward" ? " is-warn" : focus === "backward" ? " is-good" : ""}`}>{narrative}</div>
  </VisualizationFrame>;
}

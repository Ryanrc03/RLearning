"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";

type Focus = "all" | "fine" | "shared";
type Kind = "standard" | "fine" | "shared";

const BLUE = "#2a78d6";
const ORANGE = "#de673c";
const GREEN = "#1b9b70";
const YELLOW = "#c69c38";
const INK = "#303a35";
const MUTED = "#68726d";
const FAINT = "#b8c2bb";

function Line({ x1, y1, x2, y2, color = INK, faint = false }: {
  x1: number; y1: number; x2: number; y2: number; color?: string; faint?: boolean;
}) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={faint ? FAINT : color} strokeWidth={faint ? 1 : 1.8} markerEnd={faint ? undefined : "url(#moe-paper-arrow)"} />;
}

function Rect({ x, y, w, h, label, color = INK, fill = "#fff", small = false }: {
  x: number; y: number; w: number; h: number; label: string; color?: string; fill?: string; small?: boolean;
}) {
  return <g>
    <rect x={x} y={y} width={w} height={h} fill={fill} stroke={color} strokeWidth="1.5" />
    <text x={x + w / 2} y={y + h / 2 + (small ? 3 : 4)} textAnchor="middle" fontSize={small ? 9 : 11} fontWeight="600" fill={INK}>{label}</text>
  </g>;
}

function ArchitecturePanel({ x, kind, dim }: { x: number; kind: Kind; dim: boolean }) {
  const isStandard = kind === "standard";
  const isShared = kind === "shared";
  const count = isStandard ? 4 : isShared ? 7 : 8;
  const selected = isStandard ? [0, 2] : isShared ? [0, 2, 5] : [0, 2, 5, 7];
  const expertW = isStandard ? 36 : 19;
  const step = isStandard ? 47 : isShared ? 22 : 24;
  const first = isStandard ? x + 29 : isShared ? x + 75 : x + 18;
  const routerX = x + 87;
  const center = x + 119;
  const title = isStandard ? "(a) 常规稀疏 MoE" : isShared ? "(c) DeepSeekMoE" : "(b) 细粒度专家";
  const subtitle = isStandard ? "4 个大专家，选 2 个" : isShared ? "1 个共享 + 7 个路由，选 3 个" : "8 个小专家，选 4 个";
  return <g opacity={dim ? 0.2 : 1} style={{ transition: "opacity .2s" }}>
    <text x={x + 119} y="131" textAnchor="middle" fontSize="13" fontWeight="700" fill={INK}>{title}</text>
    <text x={x + 119} y="149" textAnchor="middle" fontSize="10" fill={MUTED}>{subtitle}</text>

    {Array.from({ length: count }, (_, i) => {
      const expertCenter = first + i * step + expertW / 2;
      const active = selected.includes(i);
      return <g key={i}>
        <Line x1={center} y1={297} x2={expertCenter} y2={258} color={ORANGE} faint={!active} />
        <Line x1={expertCenter} y1={236} x2={center} y2={209} color={ORANGE} faint={!active} />
      </g>;
    })}
    <Line x1={center} y1={371} x2={center} y2={326} color={BLUE} />
    {isShared && <g>
      <path d={`M ${center} 369 V 355 H ${x + 35} V 258`} fill="none" stroke={GREEN} strokeWidth="1.8" markerEnd="url(#moe-paper-arrow)" />
      <Line x1={x + 35} y1={236} x2={center} y2={209} color={GREEN} />
    </g>}
    <Line x1={center} y1={189} x2={center} y2={175} />

    <Rect x={center - 35} y={156} w={70} h={19} label="输出 h′" small />
    <Rect x={center - 30} y={189} w={60} h={20} label="Σ" color={INK} small />
    {isShared && <Rect x={x + 14} y={236} w={42} h={22} label="S" color={GREEN} fill="#e2f2eb" />}
    {Array.from({ length: count }, (_, i) => <Rect
      key={i} x={first + i * step} y={236} w={expertW} h={22}
      label={`E${i + 1}`} small={!isStandard}
      color={selected.includes(i) ? ORANGE : FAINT}
      fill={selected.includes(i) ? "#fbe9df" : "#fff"}
    />)}
    <Rect x={routerX} y={297} w={64} h={29} label="Router" color={BLUE} fill="#e5eef9" />
    <Rect x={center - 35} y={371} w={70} h={22} label="输入 h" color={YELLOW} fill="#faf2db" />
    <text x={center} y="414" textAnchor="middle" fontSize="10" fill={MUTED}>{isStandard ? "2 × F" : isShared ? "(1 + 3) × F/2" : "4 × F/2"} 激活计算</text>
    <text x={center} y="431" textAnchor="middle" fontSize="10" fill={MUTED}>总专家参数 ≈ 4F</text>
  </g>;
}

export default function DeepSeekMoEArchitecture() {
  const [focus, setFocus] = useState<Focus>("all");
  const narrative = focus === "fine"
    ? "细粒度拆分：把单个 FFN 专家缩成原来一半，专家数从 4 增到 8；同样激活计算可组合 4 个小专家。图中 F 代表一个大专家的 FFN 计算量。"
    : focus === "shared"
      ? "共享专家 S 绕过 Router，每个 token 必经；Router 只从 7 个小专家里选 3 个。选中的 3 路与共享的 1 路相加，总激活计算仍约为 2F。"
      : "从左到右看结构变化：先把大专家拆细，再把一个小专家固定为共享路径。彩色实线是本 token 执行的路径，浅灰线是未选中的路由路径；这里只比较 FFN 位置。";

  return <VisualizationFrame
    title="DeepSeekMoE 架构：从常规 MoE 到共享专家"
    description="参照论文 Figure 1 的三段结构关系重绘。图中 4→8 个专家是便于比较的示意；真实 16B 配置见图下注释。"
    footnote="论文 16B：28 层、d_model=2048；首层 dense FFN，后 27 层用 MoE。每个 MoE 层有 2 个共享 + 64 个路由专家，每 token 选 6 个路由专家；单专家为普通 FFN 的 1/4。"
  >
    <div className="viz-row">
      <button type="button" className={`viz-btn${focus === "fine" ? " is-on" : ""}`} onClick={() => setFocus("fine")}>看细粒度</button>
      <button type="button" className={`viz-btn${focus === "shared" ? " is-on" : ""}`} onClick={() => setFocus("shared")}>看共享专家</button>
      <button type="button" className="viz-btn" onClick={() => setFocus("all")}>重置</button>
    </div>
    <Figure width={760} height={468} minWidth={660} label={narrative}>
      <defs><marker id="moe-paper-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 Z" fill="#68726d" /></marker></defs>
      <text x="15" y="19" fontSize="11" fontWeight="700" fill={INK}>Transformer 中的位置</text>
      <Rect x={15} y={31} w={120} h={32} label="输入 hidden state" color={YELLOW} fill="#faf2db" />
      <Line x1={135} y1={47} x2={156} y2={47} />
      <Rect x={157} y={31} w={116} h={32} label="Attention + 残差" color={BLUE} fill="#e5eef9" />
      <Line x1={273} y1={47} x2={294} y2={47} />
      <Rect x={295} y={27} w={192} h={40} label="FFN 位置 → MoE" color={ORANGE} fill="#fbe9df" />
      <Line x1={487} y1={47} x2={508} y2={47} />
      <Rect x={509} y={31} w={111} h={32} label="Residual" color={GREEN} fill="#e2f2eb" />
      <text x="15" y="89" fontSize="10" fill={MUTED}>16B 模型：第 1 层保留 dense FFN；第 2–28 层在这个位置使用 (c) 的结构。</text>
      <line x1="15" y1="103" x2="745" y2="103" stroke={FAINT} />
      <ArchitecturePanel x={10} kind="standard" dim={focus !== "all"} />
      <ArchitecturePanel x={261} kind="fine" dim={focus === "shared"} />
      <ArchitecturePanel x={512} kind="shared" dim={focus === "fine"} />
      <line x1="255" y1="119" x2="255" y2="440" stroke="#d4dcd5" />
      <line x1="506" y1="119" x2="506" y2="440" stroke="#d4dcd5" />
      <line x1="15" y1="446" x2="745" y2="446" stroke={FAINT} />
      <text x="15" y="462" fontSize="10" fill={MUTED}>示意：F 为一个大专家的参数和计算单位；橙色 = 已选路由专家，绿色 = 共享专家，浅灰 = 未选中。</text>
    </Figure>
    <div className={`viz-narr${focus === "shared" ? " is-good" : focus === "fine" ? " is-warn" : ""}`}>{narrative}</div>
  </VisualizationFrame>;
}

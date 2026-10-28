"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

// Figure 2 (left) of "Attention Is All You Need", redrawn left to right, with
// the three linear projections that produce Q, K, V put in front of it.
// One button focuses the scoring half (QKᵀ / √d_k, mask, softmax), the other
// the value half (A V).

type Focus = "none" | "score" | "value";
type Tag = "score" | "value" | "both";

// Blue = attention computation, yellow = tensors, grey = the optional mask.
const C1 = "#2a78d6";
const CY = "#d9b24a";
const CG = "#9a9c8d";
const T1 = "#dbe8f8";
const TY = "#fbf1cf";
const INK = "#3b4234";
const MUTED = "#76796f";
const W = 680;
const H = 300;

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: "论文 Figure 2 左半边，前面补上了产生 Q、K、V 的三个线性层。一个头里，X 先乘三个 512 × 64 的矩阵，再走 MatMul → Scale → Mask → SoftMax → MatMul。T 是序列长度，中间那张 (T, T) 的表就是「每个位置看每个位置多少」。",
  },
  score: {
    text: "打分这半边：Q Kᵀ 给出 T × T 个点积。论文脚注的理由：q、k 每一维独立、均值 0、方差 1 时，q·k 的方差是 d_k；d_k = 64 时标准差是 8，分数一大 softmax 就几乎变成 one-hot，梯度很小。除以 √64 = 8 把方差拉回 1。Mask 只在 decoder 的 self-attention 里用：未来位置加 −∞，softmax 之后权重正好是 0。",
    tone: "is-warn",
  },
  value: {
    text: "取值这半边：A 的每一行是一组和为 1 的权重，乘 V 就是把 T 个 value 按权重平均，输出 (T, 64)。这是一个头；base 有 8 个头并行，各出 64 维，拼回 512 再乘 W_O。K 和 V 必须来自同一串（行数一样），Q 可以来自另一串，cross-attention 就靠这一点。",
    tone: "is-good",
  },
};

const MARK: Record<string, string> = { [C1]: "sdp-blue", [CY]: "sdp-yellow", [CG]: "sdp-grey" };

type BoxProps = { x: number; y: number; w: number; h: number; title: string; sub?: string; fill: string; stroke: string; dim: boolean; bold: boolean };

function Box({ x, y, w, h, title, sub, fill, stroke, dim, bold }: BoxProps) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={dim ? 0.28 : 1} style={{ transition: "opacity .25s" }}>
      <rect width={w} height={h} rx={5} fill={fill} stroke={stroke} strokeWidth={bold ? 2.4 : 1.3} />
      <text x={w / 2} y={sub ? h / 2 - 2 : h / 2 + 3.5} fontSize={10} fontWeight={600} textAnchor="middle" fill={INK}>{title}</text>
      {sub && <text x={w / 2} y={h / 2 + 11} fontSize={8.5} textAnchor="middle" fill={MUTED}>{sub}</text>}
    </g>
  );
}

function Wire({ d, color, dim, bold }: { d: string; color: string; dim: boolean; bold: boolean }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={bold ? 2.4 : 1.4} markerEnd={`url(#${MARK[color]})`} opacity={dim ? 0.28 : 1} style={{ transition: "opacity .25s" }} />;
}

export default function ScaledDotProductDiagram() {
  const [focus, setFocus] = useState<Focus>("none");
  const p = (t: Tag) => ({ dim: focus !== "none" && t !== "both" && t !== focus, bold: focus !== "none" && t === focus });
  const narr = NARR[focus];
  const rows = [
    { y: 50, w: "W_Q", t: "Q", tag: "score" as Tag },
    { y: 125, w: "W_K", t: "K", tag: "score" as Tag },
    { y: 200, w: "W_V", t: "V", tag: "value" as Tag },
  ];

  return (
    <VisualizationFrame
      title="Scaled Dot-Product Attention：一个头里的五步"
      description="从输入 X 到一个头的输出，每一步标出形状（按论文 base：d_model = 512、d_k = d_v = 64）。点按钮分开看打分和取值两半。"
      footnote={<>结构来自论文 Figure 2（左）和 §3.2.1；公式 Attention(Q, K, V) = softmax(QKᵀ / √d_k) V。T 是序列长度；cross-attention 里 Q 的行数 T_q 和 K、V 的行数 T_kv 可以不同，中间的表变成 (T_q, T_kv)。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "score" ? " is-on" : ""}`} onClick={() => setFocus("score")}>看打分：QKᵀ / √d_k</button>
        <button type="button" className={`viz-btn${focus === "value" ? " is-on" : ""}`} onClick={() => setFocus("value")}>看取值：A · V</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr.text} style={{ minWidth: 560 }}>
          <defs>
            {Object.entries(MARK).map(([color, id]) => (
              <marker key={id} id={id} viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={color} /></marker>
            ))}
          </defs>

          <text x={500} y={30} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>softmax(Q Kᵀ / √d_k) · V</text>

          <Box x={16} y={110} w={80} h={60} title="X" sub="(T, 512)" fill={TY} stroke={CY} dim={false} bold={false} />
          {rows.map((r) => (
            <g key={r.w}>
              <Wire d={`M96 140 L 110 140 L 110 ${r.y + 15} L 122 ${r.y + 15}`} color={CY} {...p(r.tag)} />
              <Box x={126} y={r.y} w={90} h={30} title={`Linear ${r.w}`} sub="512 × 64" fill={T1} stroke={C1} {...p(r.tag)} />
              <Wire d={`M216 ${r.y + 15} L 236 ${r.y + 15}`} color={C1} {...p(r.tag)} />
              <Box x={240} y={r.y + 2} w={60} h={26} title={r.t} sub="(T, 64)" fill={TY} stroke={CY} {...p(r.tag)} />
            </g>
          ))}

          {/* scoring half */}
          <Wire d="M300 65 L 316 65 L 316 96 L 326 96" color={CY} {...p("score")} />
          <Wire d="M300 140 L 316 140 L 316 112 L 326 112" color={CY} {...p("score")} />
          <text x={306} y={128} fontSize={8.5} fill={INK} opacity={p("score").dim ? 0.28 : 1}>Kᵀ</text>
          <Box x={330} y={85} w={70} h={38} title="MatMul" sub="Q Kᵀ → (T, T)" fill={T1} stroke={C1} {...p("score")} />
          <Wire d="M400 104 L 414 104" color={C1} {...p("score")} />
          <Box x={418} y={85} w={70} h={38} title="Scale" sub="÷ √d_k = ÷ 8" fill={T1} stroke={C1} {...p("score")} />
          <Wire d="M488 104 L 502 104" color={C1} {...p("score")} />
          <Box x={506} y={85} w={60} h={38} title="Mask" sub="可选 · 加 −∞" fill="#fff" stroke={CG} {...p("score")} />
          <Wire d="M566 104 L 580 104" color={CG} {...p("score")} />
          <Box x={584} y={85} w={80} h={38} title="SoftMax" sub="每行和为 1" fill={T1} stroke={C1} {...p("score")} />

          {/* value half */}
          <Wire d="M624 123 L 624 191" color={CY} {...p("value")} />
          <text x={630} y={160} fontSize={9} fontWeight={600} fill={INK} opacity={p("value").dim ? 0.28 : 1}>A</text>
          <text x={630} y={172} fontSize={8.5} fill={MUTED} opacity={p("value").dim ? 0.28 : 1}>(T, T)</text>
          <Wire d="M300 215 L 580 215" color={CY} {...p("value")} />
          <text x={440} y={209} fontSize={8.5} textAnchor="middle" fill={MUTED} opacity={p("value").dim ? 0.28 : 1}>V 的 T 行，按 A 的权重加起来</text>
          <Box x={584} y={195} w={80} h={40} title="MatMul" sub="A V → (T, 64)" fill={T1} stroke={C1} {...p("value")} />
          <Wire d="M624 235 L 624 251" color={C1} {...p("value")} />
          <Box x={548} y={255} w={116} h={34} title="一个头的输出 (T, 64)" sub="8 个头拼成 512 → W_O" fill={TY} stroke={CY} {...p("value")} />

          <text x={16} y={264} fontSize={9} fill={INK}>self-attention：三条线都从同一个 X 出发。</text>
          <text x={16} y={279} fontSize={9} fill={INK}>cross-attention：W_Q 吃 decoder 的向量，W_K、W_V 吃 encoder 输出 H。</text>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: T1, border: `1px solid ${C1}` }} />attention 里的计算（线性层、MatMul、Scale、SoftMax）</span>
        <span><i style={{ background: TY, border: `1px solid ${CY}` }} />张量和它的形状</span>
        <span><i style={{ background: "#fff", border: `1px solid ${CG}` }} />可选的 mask</span>
      </div>
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

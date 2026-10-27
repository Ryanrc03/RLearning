"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

// Figure 1 of "Attention Is All You Need", redrawn: an encoder stack and a
// decoder stack, with the three places the paper uses attention (§3.2.3).
// The buttons focus encoder/decoder self-attention or encoder–decoder (cross)
// attention and dim everything else.

type Focus = "none" | "self" | "cross";
type Tag = "self" | "cross" | "other";

// Blue = attention, orange = feed-forward and the output head, green = residual + LayerNorm, yellow = tensors.
const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const CY = "#d9b24a";
const T1 = "#dbe8f8";
const T2 = "#fbe3d8";
const T3 = "#d9f1e6";
const TY = "#fbf1cf";
const INK = "#3b4234";
const MUTED = "#76796f";
const FRAME = "#f4f7fc";
const W = 680;
const H = 420;

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: "论文 Figure 1 重画。左边 encoder 读英文「Hi I am Ryan」，右边 decoder 已经写出「你好 我 是」，要预测下一个词。三个蓝色块是同一个函数 softmax(QKᵀ/√d_k)V，论文 3.2.3 节把它用在三个地方，区别只在 Q、K、V 从哪来。数字按 base：每边 6 层、d_model = 512、8 个头。",
  },
  self: {
    text: "self-attention：Q、K、V 从同一串向量投影出来。encoder 里 4 个英文 token 互相看，A 是 4 × 4，不加 mask；decoder 的第一个子层也是 self-attention，但加了因果 mask：第 i 个位置只能看自己和前面的位置，A 是 3 × 3 的下三角，训练时一次喂整句也不会偷看答案。",
    tone: "is-warn",
  },
  cross: {
    text: "cross-attention（论文叫 encoder-decoder attention）：Q 来自 decoder 上一个子层，K 和 V 来自 encoder 最后一层的输出 H。A 是 3 × 4：行是 3 个中文位置，列是 4 个英文 token，每个中文位置都能看整句英文。encoder 只算一次，6 层 decoder 各有自己的 W_Q、W_K、W_V，读的是同一个 H。",
    tone: "is-good",
  },
};

const MARK: Record<string, string> = { [C1]: "tam-blue", [C2]: "tam-orange", [C3]: "tam-green", [CY]: "tam-yellow" };

type BoxProps = { x: number; y: number; w: number; h: number; title: string; sub?: string; fill: string; stroke: string; dim: boolean; bold: boolean };

function Box({ x, y, w, h, title, sub, fill, stroke, dim, bold }: BoxProps) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={dim ? 0.28 : 1} style={{ transition: "opacity .25s" }}>
      <rect width={w} height={h} rx={5} fill={fill} stroke={stroke} strokeWidth={bold ? 2.4 : 1.3} />
      <text x={w / 2} y={sub ? 13 : h / 2 + 3.5} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={INK}>{title}</text>
      {sub && <text x={w / 2} y={25} fontSize={8} textAnchor="middle" fill={MUTED}>{sub}</text>}
    </g>
  );
}

type PathProps = { d: string; color: string; dim: boolean; bold: boolean; arrow?: boolean };

function Wire({ d, color, dim, bold, arrow = true }: PathProps) {
  return <path d={d} fill="none" stroke={color} strokeWidth={bold ? 2.4 : 1.4} markerEnd={arrow ? `url(#${MARK[color]})` : undefined} opacity={dim ? 0.28 : 1} style={{ transition: "opacity .25s" }} />;
}

function Label({ x, y, text, color, dim, anchor = "middle", size = 9, weight = 600 }: { x: number; y: number; text: string; color: string; dim: boolean; anchor?: "start" | "middle" | "end"; size?: number; weight?: number }) {
  return <text x={x} y={y} fontSize={size} fontWeight={weight} textAnchor={anchor} fill={color} opacity={dim ? 0.28 : 1}>{text}</text>;
}

export default function TransformerAttentionMap() {
  const [focus, setFocus] = useState<Focus>("none");
  const dim = (t: Tag) => focus !== "none" && t !== focus;
  const bold = (t: Tag) => focus !== "none" && t === focus;
  const narr = NARR[focus];
  const p = (t: Tag) => ({ dim: dim(t), bold: bold(t) });

  // Encoder column (centre 165) and decoder column (centre 505).
  const EX = 70;
  const EW = 190;
  const EC = EX + EW / 2;
  const DX = 410;
  const DW = 190;
  const DC = DX + DW / 2;

  return (
    <VisualizationFrame
      title="论文 Figure 1：attention 用在 Transformer 的三个地方"
      description="左边 encoder 读源句，右边 decoder 一个词一个词写译文。点按钮分别看 self-attention 和 cross-attention 的 Q、K、V 从哪里来。"
      footnote={<>结构与数字来自 Vaswani et al. 2017 的 Figure 1、§3.1、§3.2.3 和 Table 3（base：N = 6、d_model = 512、h = 8、d_k = d_v = 64、d_ff = 2048）。例句、T = 4 和 3 是示意；原论文做的是英译德、英译法。LayerNorm 在残差相加之后（post-LN）。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "self" ? " is-on" : ""}`} onClick={() => setFocus("self")}>看 self-attention</button>
        <button type="button" className={`viz-btn${focus === "cross" ? " is-on" : ""}`} onClick={() => setFocus("cross")}>看 cross-attention</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr.text} style={{ minWidth: 560 }}>
          <defs>
            {Object.entries(MARK).map(([color, id]) => (
              <marker key={id} id={id} viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={color} /></marker>
            ))}
          </defs>

          {/* column titles */}
          <Label x={EC} y={36} text="Encoder：读源句" color={INK} dim={false} size={11} />
          <Label x={DC} y={36} text="Decoder：写译文" color={INK} dim={false} size={11} />
          <Label x={EC} y={84} text="encoder 只跑一遍；它的输出 H" color={MUTED} dim={dim("cross")} size={8.5} weight={500} />
          <Label x={EC} y={97} text="被 decoder 每一层的 cross-attention 共用" color={MUTED} dim={dim("cross")} size={8.5} weight={500} />

          {/* ---------------- encoder ---------------- */}
          <rect x={48} y={176} width={234} height={196} rx={8} fill={FRAME} stroke="#c9d6ea" opacity={focus === "cross" ? 0.4 : 1} />
          <Label x={290} y={192} text="× 6" color={C1} dim={focus === "cross"} anchor="start" size={10} />
          <Box x={EX} y={384} w={EW} h={28} title="Input Embedding + 位置编码" sub="Hi I am Ryan → (4, 512)" fill={TY} stroke={CY} {...p("other")} dim={focus === "cross"} />
          {/* stream into the self-attention ticks */}
          <Wire d={`M${EC} 384 L ${EC} 350`} color={CY} arrow={false} {...p("self")} />
          <Wire d={`M${EC - 40} 350 L ${EC + 40} 350`} color={CY} arrow={false} {...p("self")} />
          {[-40, 0, 40].map((dx, i) => (
            <g key={dx}>
              <Wire d={`M${EC + dx} 350 L ${EC + dx} 337`} color={CY} {...p("self")} />
              <Label x={EC + dx + 5} y={347} text={"QKV"[i]} color={INK} dim={dim("self")} anchor="start" size={8.5} />
            </g>
          ))}
          <Box x={EX} y={300} w={EW} h={32} title="Multi-Head Self-Attention" sub="Q、K、V 都来自 encoder · A：4 × 4" fill={T1} stroke={C1} {...p("self")} />
          <Wire d={`M${EC} 300 L ${EC} 291`} color={C1} {...p("other")} />
          <Box x={EX} y={266} w={EW} h={20} title="Add & Norm" fill={T3} stroke={C3} {...p("other")} />
          <Wire d={`M${EC} 266 L ${EC} 255`} color={C3} {...p("other")} />
          <Box x={EX} y={220} w={EW} h={30} title="Feed Forward" sub="每个位置各自过 512 → 2048 → 512" fill={T2} stroke={C2} {...p("other")} />
          <Wire d={`M${EC} 220 L ${EC} 213`} color={C2} {...p("other")} />
          <Box x={EX} y={188} w={EW} h={20} title="Add & Norm" fill={T3} stroke={C3} {...p("other")} />
          {/* residuals */}
          <Wire d={`M${EC} 368 L 60 368 L 60 276 L ${EX - 4} 276`} color={C3} {...p("other")} />
          <Wire d={`M${EC} 258 L 60 258 L 60 198 L ${EX - 4} 198`} color={C3} {...p("other")} />
          {/* encoder output */}
          <Wire d={`M${EC} 188 L ${EC} 157`} color={CY} {...p("cross")} />
          <Box x={EX} y={128} w={EW} h={24} title="encoder 输出 H　(4, 512)" fill={TY} stroke={CY} {...p("cross")} />
          <Wire d={`M${EX + EW} 140 L 360 140 L 360 262 L ${DX + 85} 262`} color={CY} arrow={false} {...p("cross")} />
          <Wire d={`M${DX + 45} 262 L ${DX + 45} 255`} color={CY} {...p("cross")} />
          <Wire d={`M${DX + 85} 262 L ${DX + 85} 255`} color={CY} {...p("cross")} />
          <Label x={DX + 40} y={259} text="K" color={INK} dim={dim("cross")} anchor="end" size={8.5} />
          <Label x={DX + 80} y={259} text="V" color={INK} dim={dim("cross")} anchor="end" size={8.5} />

          {/* ---------------- decoder ---------------- */}
          <rect x={398} y={92} width={224} height={280} rx={8} fill={FRAME} stroke="#c9d6ea" opacity={focus === "cross" || focus === "self" ? 0.6 : 1} />
          <Label x={628} y={108} text="× 6" color={C1} dim={false} anchor="start" size={10} />
          <Box x={DX} y={384} w={DW} h={28} title="Output Embedding + 位置编码" sub="已生成的 你好 我 是（右移一位）→ (3, 512)" fill={TY} stroke={CY} {...p("other")} dim={focus === "cross"} />
          <Wire d={`M${DC} 384 L ${DC} 352`} color={CY} arrow={false} {...p("self")} />
          <Wire d={`M${DC - 40} 352 L ${DC + 40} 352`} color={CY} arrow={false} {...p("self")} />
          {[-40, 0, 40].map((dx, i) => (
            <g key={dx}>
              <Wire d={`M${DC + dx} 352 L ${DC + dx} 339`} color={CY} {...p("self")} />
              <Label x={DC + dx + 5} y={349} text={"QKV"[i]} color={INK} dim={dim("self")} anchor="start" size={8.5} />
            </g>
          ))}
          <Box x={DX} y={306} w={DW} h={28} title="Masked Multi-Head Self-Attention" sub="Q、K、V 都来自 decoder · 因果 mask · A：3 × 3" fill={T1} stroke={C1} {...p("self")} />
          <Wire d={`M${DC} 306 L ${DC} 297`} color={C1} {...p("other")} />
          <Box x={DX} y={274} w={DW} h={18} title="Add & Norm" fill={T3} stroke={C3} {...p("other")} />
          {/* Q for the cross-attention comes from the decoder stream */}
          <Wire d={`M${DX + 150} 274 L ${DX + 150} 255`} color={CY} {...p("cross")} />
          <Label x={DX + 145} y={268} text="Q" color={INK} dim={dim("cross")} anchor="end" size={8.5} />
          <Box x={DX} y={218} w={DW} h={32} title="Multi-Head Cross-Attention" sub="Q 来自 decoder，K、V 来自 encoder · A：3 × 4" fill={T1} stroke={C1} {...p("cross")} />
          <Wire d={`M${DC} 218 L ${DC} 205`} color={C1} {...p("other")} />
          <Box x={DX} y={182} w={DW} h={18} title="Add & Norm" fill={T3} stroke={C3} {...p("other")} />
          <Wire d={`M${DC} 182 L ${DC} 171`} color={C3} {...p("other")} />
          <Box x={DX} y={136} w={DW} h={30} title="Feed Forward" sub="512 → 2048 → 512" fill={T2} stroke={C2} {...p("other")} />
          <Wire d={`M${DC} 136 L ${DC} 127`} color={C2} {...p("other")} />
          <Box x={DX} y={104} w={DW} h={18} title="Add & Norm" fill={T3} stroke={C3} {...p("other")} />
          <Wire d={`M${DC} 104 L ${DC} 81`} color={CY} {...p("other")} />
          <Box x={DX} y={48} w={DW} h={28} title="Linear + Softmax" sub="下一个词的概率 → Ryan" fill={T2} stroke={C2} {...p("other")} />
          {/* residuals */}
          <Wire d={`M${DC} 368 L 612 368 L 612 283 L ${DX + DW + 4} 283`} color={C3} {...p("other")} />
          <Wire d={`M${DX + 150} 266 L 612 266 L 612 191 L ${DX + DW + 4} 191`} color={C3} {...p("other")} />
          <Wire d={`M${DC} 174 L 612 174 L 612 113 L ${DX + DW + 4} 113`} color={C3} {...p("other")} />
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: T1, border: `1px solid ${C1}` }} />attention（同一个函数，三处用法）</span>
        <span><i style={{ background: T2, border: `1px solid ${C2}` }} />前馈网络 / 输出头</span>
        <span><i style={{ background: T3, border: `1px solid ${C3}` }} />残差 + LayerNorm</span>
        <span><i style={{ background: TY, border: `1px solid ${CY}` }} />张量：embedding、Q/K/V 的来源、H</span>
      </div>
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

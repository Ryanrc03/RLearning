"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

// DIN note, "Architecture › 核心": the activation unit as implemented in
// kurec/models/din.py. Inputs q (target, 48), k_i (history item part, 48), their
// difference and product, plus the feedback embedding (16) → 208 → 64 → 32 → 1.
// The scalar weights are not softmax-normalised before the weighted sum.

type Focus = "none" | "inputs" | "sum";

const BLUE = "#2a78d6";
const BLUE_F = "#dbe8f8";
const YELLOW = "#d9b24a";
const YELLOW_F = "#fbf1cf";
const INK = "#3b4234";
const GREY = "#9a9c8d";

function B({ x, y, w, h, s, f, t, dash, strong }: { x: number; y: number; w: number; h: number; s: string; f: string; t: string[]; dash?: boolean; strong: boolean }) {
  const lh = 12;
  const top = y + h / 2 - ((t.length - 1) * lh) / 2 + 3.5;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={f} stroke={s} strokeWidth={strong ? 2.4 : 1.3} strokeDasharray={dash ? "5 3" : undefined} />
      {t.map((line, i) => (
        <text key={i} x={x + w / 2} y={top + i * lh} fontSize={i === 0 ? 10.5 : 9.5} fontWeight={i === 0 ? 600 : 400} textAnchor="middle" fill={i === 0 ? INK : "#5d6156"}>
          {line}
        </text>
      ))}
    </g>
  );
}

const A = ({ d }: { d: string }) => <path d={d} fill="none" stroke={INK} strokeWidth={1.2} markerEnd="url(#au-arrow)" />;

export default function DinAttentionUnitFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const op = (g: Exclude<Focus, "none">) => (focus === "none" || focus === g ? 1 : 0.3);
  const strong = (g: Exclude<Focus, "none">) => focus === g;

  const narr =
    focus === "inputs"
      ? { tone: "is-warn", text: "MLP 的输入不只是 q 和 k_i 拼在一起：差 q − k_i 和逐元素积 q ⊙ k_i 把「哪几维相同、哪几维不同」直接摆给网络，一层 ReLU 网络很难自己从拼接里学出乘法。kuairank 再拼上这条历史的反馈 embedding，所以同 tag 但划走的、同 tag 且看完的可以拿到不同的权重。4 × 48 + 16 = 208 维。" }
      : focus === "sum"
        ? { tone: "is-good", text: "每条历史得到一个标量 w_i，乘上它的 64 维元素 e_i，padding 位置乘 mask 归零，再对 N 个位置求和。没有 softmax：Σ w_i 不被压成 1，用户历史里和候选相关的东西越多，输出向量越长，后面的网络能读到「匹配了多少」而不只是「匹配了谁」。" }
        : { tone: "", text: "这个小 MLP 对 batch 里每个样本的每条历史各跑一次：输入 [B, N, 208]，输出 [B, N] 个权重。点按钮看输入怎么构造、权重怎么用。" };

  return (
    <VisualizationFrame
      title="activation unit：给每条历史打一个和候选相关的权重"
      description="kurec/models/din.py 里的结构，d = 16，item 字段为 vid、aid、tag。黄色是张量，蓝色是可学习的层，墨色框是没有参数的运算。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "inputs" ? " is-on" : ""}`} onClick={() => setFocus("inputs")}>四种交互</button>
        <button type="button" className={`viz-btn${focus === "sum" ? " is-on" : ""}`} onClick={() => setFocus("sum")}>不做 softmax</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 680 250" role="img" aria-label="DIN activation unit 结构" style={{ minWidth: 560 }}>
          <defs>
            <marker id="au-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={INK} />
            </marker>
          </defs>
          <g opacity={op("inputs")} style={{ transition: "opacity .3s" }}>
            <B x={10} y={24} w={110} h={36} s={YELLOW} f={YELLOW_F} t={["候选 q", "[48]"]} strong={strong("inputs")} />
            <B x={10} y={84} w={110} h={36} s={YELLOW} f={YELLOW_F} t={["历史 k_i", "e_i 的 item 部分 [48]"]} strong={strong("inputs")} />
            <B x={10} y={196} w={110} h={36} s={YELLOW} f={YELLOW_F} t={["反馈 e_fb,i", "[16]"]} strong={strong("inputs")} />
            <B x={146} y={128} w={96} h={28} s={INK} f="#fff" t={["q − k_i"]} strong={strong("inputs")} />
            <B x={146} y={164} w={96} h={28} s={INK} f="#fff" t={["q ⊙ k_i"]} strong={strong("inputs")} />
            <B x={268} y={24} w={80} h={208} s={YELLOW} f={YELLOW_F} t={["拼接", "[208]", "= 4 × 48", "+ 16"]} strong={strong("inputs")} />
            <A d="M120 42 L264 42" />
            <A d="M120 102 L264 102" />
            <A d="M120 214 L264 214" />
            <A d="M70 60 Q70 70 146 136" />
            <A d="M120 112 Q130 160 142 172" />
            <A d="M242 142 L264 142" />
            <A d="M242 178 L264 178" />
          </g>
          <g opacity={focus === "none" ? 1 : 0.5} style={{ transition: "opacity .3s" }}>
            <B x={374} y={36} w={120} h={36} s={BLUE} f={BLUE_F} t={["FC 208 → 64", "ReLU"]} strong={false} />
            <B x={374} y={90} w={120} h={36} s={BLUE} f={BLUE_F} t={["FC 64 → 32", "ReLU"]} strong={false} />
            <B x={374} y={144} w={120} h={36} s={BLUE} f={BLUE_F} t={["FC 32 → 1"]} strong={false} />
            <A d="M348 54 L370 54" />
            <A d="M434 72 L434 86" />
            <A d="M434 126 L434 140" />
          </g>
          <g opacity={op("sum")} style={{ transition: "opacity .3s" }}>
            <B x={520} y={144} w={64} h={36} s={BLUE} f={BLUE_F} t={["w_i", "标量"]} strong={strong("sum")} />
            <B x={520} y={30} w={150} h={52} s={INK} f="#fff" t={["Σ_i mask_i · w_i · e_i", "对 N 个位置求和", "不除以 Σ w_j"]} strong={strong("sum")} />
            <B x={600} y={144} w={70} h={36} s={YELLOW} f={YELLOW_F} t={["用户兴趣", "[64]"]} strong={strong("sum")} />
            <A d="M494 162 L516 162" />
            <A d="M552 144 L552 86" />
            <A d="M635 82 L635 140" />
            <text x={374} y={214} fontSize={10} fill={GREY}>softmax 版本会是 w_i / Σ_j w_j，权重和恒为 1，</text>
            <text x={374} y={228} fontSize={10} fill={GREY}>「历史里有多少相关的」这一信息被抹掉；DIN 论文去掉了这一步。</text>
          </g>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: YELLOW_F, border: `1.3px solid ${YELLOW}` }} />张量</span>
        <span><i style={{ background: BLUE_F, border: `1.3px solid ${BLUE}` }} />可学习的层</span>
        <span><i style={{ background: "#fff", border: `1.3px solid ${INK}` }} />无参数运算</span>
      </div>
      <div className={`viz-narr ${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

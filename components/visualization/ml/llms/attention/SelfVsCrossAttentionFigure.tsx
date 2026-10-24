"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import { attention, buildCausalMask, DEMO_ATTENTION, DEMO_CROSS, DEMO_DEC, DEMO_E, DEMO_TARGET, DEMO_TOKENS, selfAttention } from "@/lib/ml/attention";
import type { Matrix } from "@/lib/ml/clip";

// The paper's three uses of attention (§3.2.3) on one toy translation,
// "Hi I am Ryan" → "你好 我 是 …": encoder self-attention (4 × 4), decoder
// masked self-attention (3 × 3, lower triangle) and cross-attention (3 × 4).
// Every weight comes from lib/ml/attention.ts.

type Mode = "enc" | "dec" | "cross";

// Blue = source-side (encoder) tokens, orange = generated (decoder) tokens, ink = the query being followed.
const C1 = "#2a78d6";
const C2 = "#eb6834";
const T1 = "#dbe8f8";
const T2 = "#fbe3d8";
const INK = "#3b4234";
const MUTED = "#76796f";
const MASKED = "#efeee8";

const ENC = selfAttention(DEMO_E, DEMO_ATTENTION);
const SRC = [...DEMO_TOKENS] as string[];
const TGT = [...DEMO_TARGET] as string[];
const CAUSAL: Matrix = buildCausalMask(TGT.length);

type Spec = { label: string; q: string[]; kv: string[]; qSide: "enc" | "dec"; kvSide: "enc" | "dec"; A: Matrix; masked: boolean };

const SPECS: Record<Mode, Spec> = {
  enc: { label: "Encoder self-attention", q: SRC, kv: SRC, qSide: "enc", kvSide: "enc", A: ENC.A, masked: false },
  dec: { label: "Decoder masked self-attention", q: TGT, kv: TGT, qSide: "dec", kvSide: "dec", A: attention(DEMO_DEC, DEMO_DEC, DEMO_ATTENTION, CAUSAL).A, masked: true },
  // K, V come from the encoder output; the stepper's E' stands in for it.
  cross: { label: "Cross-attention", q: TGT, kv: SRC, qSide: "dec", kvSide: "enc", A: attention(DEMO_DEC, ENC.updated!, DEMO_CROSS).A, masked: false },
};

const MODES: Mode[] = ["enc", "dec", "cross"];
const num = (v: number) => v.toFixed(2);
const side = (s: "enc" | "dec") => (s === "enc" ? { fill: T1, stroke: C1, text: "来自 encoder（英文源句）" } : { fill: T2, stroke: C2, text: "来自 decoder（已写出的中文）" });

const SVG_W = 720;
const SVG_H = 196;
const QY = 34;
const KY = 140;
const BOX_W = 74;
const BOX_H = 30;
const xs = (n: number) => (n === 4 ? [210, 370, 530, 690].map((x) => x - 20) : [250, 450, 650].map((x) => x - 20));

export default function SelfVsCrossAttentionFigure() {
  const [mode, setMode] = useState<Mode>("cross");
  const [focus, setFocus] = useState(2);
  const s = SPECS[mode];
  const f = Math.min(focus, s.q.length - 1);
  const row = s.A[f];
  const top = row.indexOf(Math.max(...row));
  const qx = xs(s.q.length);
  const kx = xs(s.kv.length);
  const qSide = side(s.qSide);
  const kvSide = side(s.kvSide);
  const hidden = s.masked ? s.kv.filter((_, j) => j > f) : [];
  const visible = s.kv.filter((_, j) => !s.masked || j <= f);

  const pick = (m: Mode) => {
    setMode(m);
    setFocus(SPECS[m].q.length - 1);
  };

  const narr =
    mode === "enc"
      ? { text: `encoder self-attention：Q、K、V 都从这 4 个英文 token 投影出来，A 是 4 × 4。聚焦 ${s.q[f]}：权重最大的是 ${s.kv[top]}（${num(row[top])}）。每一行都能看整句，前后都能看；BERT 的每一层只有这一种 attention。` }
      : mode === "dec"
        ? { text: `decoder masked self-attention：Q、K、V 都来自已经写出的中文，A 是 3 × 3，对角线右上方被 mask 成 0。聚焦「${s.q[f]}」：它只能看${visible.map((t) => `「${t}」`).join("")}${hidden.length ? `，看不到${hidden.map((t) => `「${t}」`).join("")}` : ""}。GPT 这类 decoder-only 模型只有这一种 attention。`, tone: "is-warn" }
        : { text: `cross-attention：Q 来自 decoder 的 3 个中文位置，K、V 来自 encoder 输出的 4 个英文 token，A 是 3 × 4，不是方阵。聚焦「${s.q[f]}」：权重最大的是 ${s.kv[top]}（${num(row[top])}）。${s.q[f] === "是" ? "「是」后面要写的正是 Ryan，它到源句里把 Ryan 的 value 拿了过来。" : ""}这里不加 mask：源句整句早就已知。`, tone: "is-good" };

  return (
    <VisualizationFrame
      title="Self vs Cross：同一个公式，Q 和 K、V 从哪里来"
      description="一句玩具翻译：encoder 读「Hi I am Ryan」，decoder 已经写出「你好 我 是」。切换论文里 attention 的三种用法，再选一个 query 看它的那一行权重。"
      footnote={<>权重由 lib/ml/attention.ts 现算：d = 4 的手造向量和手选矩阵，示意值，不是训练出来的模型。encoder 一侧的 K、V 用上面步进图算出的 E′ 代替 encoder 最后一层的输出；cross-attention 的 W_Q、W_K 是挑过的，让权重像翻译那样落在对应的词上。真实模型里这种对齐是训练学出来的。</>}
    >
      <div className="viz-tabs" role="tablist" aria-label="attention 的用法" style={{ marginBottom: 10 }}>
        {MODES.map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={`viz-tab${mode === m ? " is-on" : ""}`} onClick={() => pick(m)}>
            {SPECS[m].label}
          </button>
        ))}
      </div>
      <div className="viz-row">
        <span className="viz-k">Query</span>
        <div className="viz-chips" role="group" aria-label="跟哪个 query">
          {s.q.map((t, i) => (
            <button key={t} type="button" className={`viz-chip${f === i ? " is-on" : ""}`} aria-pressed={f === i} onClick={() => setFocus(i)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <Figure width={SVG_W} height={SVG_H} label={`${s.label}：${s.q[f]} 对 ${s.kv.join("、")} 的权重 ${row.map(num).join("、")}`} minWidth={560}>
        <text x={8} y={QY + 12} fontSize={12} fontWeight={700} fill={INK}>Query</text>
        <text x={8} y={QY + 27} fontSize={10} fill={qSide.stroke}>{qSide.text}</text>
        <text x={8} y={KY + 12} fontSize={12} fontWeight={700} fill={INK}>Key、Value</text>
        <text x={8} y={KY + 27} fontSize={10} fill={kvSide.stroke}>{kvSide.text}</text>

        {s.kv.map((t, j) => {
          const off = s.masked && j > f;
          if (off) return null;
          const w = row[j];
          const x0 = qx[f];
          const x1 = kx[j];
          const lx = x0 + (x1 - x0) * 0.62;
          const ly = QY + BOX_H + (KY - QY - BOX_H) * 0.62;
          return (
            <g key={t}>
              <line x1={x0} y1={QY + BOX_H} x2={x1} y2={KY} stroke={C1} strokeWidth={1 + w * 10} strokeLinecap="round" opacity={0.25 + w * 0.75} style={{ transition: "stroke-width .3s, opacity .3s" }} />
              <text x={lx} y={ly + 4} fontSize={11} textAnchor="middle" className="mono" fill={j === top ? C1 : MUTED} fontWeight={j === top ? 700 : 500} stroke="#fff" strokeWidth={3} paintOrder="stroke">{num(w)}</text>
            </g>
          );
        })}

        {s.q.map((t, i) => {
          const on = i === f;
          return (
            <g key={t} onClick={() => setFocus(i)} style={{ cursor: "pointer" }}>
              <rect x={qx[i] - BOX_W / 2} y={QY} width={BOX_W} height={BOX_H} rx={7} fill={on ? INK : qSide.fill} stroke={on ? INK : qSide.stroke} strokeWidth={1.3} style={{ transition: "fill .25s" }} />
              <text x={qx[i]} y={QY + 19.5} fontSize={13} fontWeight={600} textAnchor="middle" fill={on ? "#fff" : INK}>{t}</text>
            </g>
          );
        })}
        {s.kv.map((t, j) => {
          const off = s.masked && j > f;
          return (
            <g key={t}>
              <rect x={kx[j] - BOX_W / 2} y={KY} width={BOX_W} height={BOX_H} rx={7} fill={off ? MASKED : kvSide.fill} stroke={off ? "#c9c4ad" : kvSide.stroke} strokeWidth={1.3} />
              <text x={kx[j]} y={KY + 19.5} fontSize={13} fontWeight={600} textAnchor="middle" fill={off ? MUTED : INK}>{t}</text>
              {off && <text x={kx[j]} y={KY - 8} fontSize={10} textAnchor="middle" fill={MUTED}>mask：−∞ → 0</text>}
            </g>
          );
        })}
      </Figure>

      <div className="viz-grid2 wide-left" style={{ marginTop: 8 }}>
        <div className="mx-wrap">
          <div className="viz-k" style={{ marginBottom: 4 }}>A 的形状：{s.q.length} × {s.kv.length}（行 = query，列 = key）</div>
          <table className="mx" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th className="row-h"></th>
                {s.kv.map((t) => <th key={t} className="col-h" scope="col" style={{ color: kvSide.stroke }}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {s.A.map((r, i) => {
                const on = i === f;
                return (
                  <tr key={i} style={{ opacity: on ? 1 : 0.55, transition: "opacity .25s" }}>
                    <th className="row-h" scope="row" style={{ color: qSide.stroke, fontWeight: on ? 700 : 500 }}>{s.q[i]}</th>
                    {r.map((v, j) => {
                      const off = s.masked && j > i;
                      const dark = !off && v > 0.5;
                      return (
                        <td key={j}>
                          <button
                            type="button"
                            className={`mx-cell${on ? " is-sel" : ""}${dark ? " is-dark" : ""}${off ? " is-masked" : ""}`}
                            style={{ width: 52, height: 30, fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...(off ? {} : { background: `rgba(42, 120, 214, ${(0.06 + v * 0.8).toFixed(2)})`, color: dark ? "#fff" : INK }) }}
                            aria-label={`${s.q[i]} 看 ${s.kv[j]}：${off ? "被 mask" : num(v)}`}
                            onClick={() => setFocus(i)}
                          >
                            {off ? "0" : num(v)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <table className="viz-table">
          <tbody>
            <tr><td>Q</td><td className="viz-mono" style={{ whiteSpace: "nowrap" }}>({s.q.length}, d_k)</td><td style={{ color: qSide.stroke }}>{s.qSide === "enc" ? "encoder" : "decoder"}</td></tr>
            <tr><td>K、V</td><td className="viz-mono" style={{ whiteSpace: "nowrap" }}>({s.kv.length}, d_k)</td><td style={{ color: kvSide.stroke }}>{s.kvSide === "enc" ? "encoder" : "decoder"}</td></tr>
            <tr><td>A = softmax(QKᵀ/√d_k)</td><td className="viz-mono" style={{ whiteSpace: "nowrap" }}>({s.q.length}, {s.kv.length})</td><td>{s.masked ? "下三角" : "不加 mask"}</td></tr>
            <tr><td>输出 A V</td><td className="viz-mono" style={{ whiteSpace: "nowrap" }}>({s.q.length}, d_v)</td><td>跟 Q 一样多行</td></tr>
          </tbody>
        </table>
      </div>

      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

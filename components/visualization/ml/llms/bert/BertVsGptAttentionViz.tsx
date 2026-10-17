"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const TOKENS = ["the", "cat", "sat", "on", "the", "mat", "because", "it", "was", "tired"];
const N = TOKENS.length;
const CELL = 22;
const PAD_L = 56;
const PAD_T = 60;
const W = PAD_L + N * CELL + 4;
const HGT = PAD_T + N * CELL + 4;
const BLUE = "var(--v1)";
const ORANGE = "var(--v2)";
const MASKED_PER_SEQ = Math.round(N * 0.15);

function Matrix({ causal, sel, color, label }: { causal: boolean; sel: number; color: string; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${HGT}`} role="img" aria-label={label} style={{ maxWidth: W }}>
      <text x={PAD_L} y={10} fontSize={9} fill="#8e8d78">列：能看到的位置（key）</text>
      <text x={8} y={PAD_T - 6} fontSize={9} fill="#8e8d78">行：query</text>
      {TOKENS.map((t, j) => (
        <text key={`c${j}`} x={PAD_L + j * CELL + CELL / 2} y={PAD_T - 8} fontSize={8.5} fill={j === sel ? "#30332c" : "#76796f"} fontWeight={j === sel ? 600 : 400} textAnchor="start" transform={`rotate(-55 ${PAD_L + j * CELL + CELL / 2} ${PAD_T - 8})`}>{t}</text>
      ))}
      {TOKENS.map((t, i) => (
        <text key={`r${i}`} x={PAD_L - 6} y={PAD_T + i * CELL + CELL / 2 + 3} fontSize={8.5} textAnchor="end" fill={i === sel ? "#30332c" : "#76796f"} fontWeight={i === sel ? 600 : 400}>{t}</text>
      ))}
      {TOKENS.map((_, i) =>
        TOKENS.map((__, j) => {
          const allowed = !causal || j <= i;
          const isRow = i === sel;
          return (
            <rect
              key={`${i}-${j}`}
              x={PAD_L + j * CELL + 1}
              y={PAD_T + i * CELL + 1}
              width={CELL - 2}
              height={CELL - 2}
              rx={2}
              fill={allowed ? color : "#f0eee4"}
              opacity={allowed ? (isRow ? 0.95 : 0.3) : 1}
            />
          );
        }),
      )}
      <rect x={PAD_L} y={PAD_T + sel * CELL} width={N * CELL} height={CELL} fill="none" stroke="#30332c" strokeWidth={1.2} rx={2} />
    </svg>
  );
}

export default function BertVsGptAttentionViz() {
  const [sel, setSel] = useState(5);
  const next = sel + 1 < N ? TOKENS[sel + 1] : "（序列结束符）";
  const leftCount = sel;
  const rightCount = N - 1 - sel;

  const chipBase = { cursor: "default" as const, display: "inline-grid" as const, textAlign: "center" as const, lineHeight: 1.25, padding: "4px 8px" };

  const narr = `位置 ${sel} 的“${TOKENS[sel]}”：BERT 把它换成 [MASK]，用左边 ${leftCount} 个和右边 ${rightCount} 个词一起预测它，注意力矩阵这一行全是满的；GPT 只能看位置 0 到 ${sel}（${sel + 1} 个词，含自己），要预测的是下一个词“${next}”，这一行从位置 ${sel + 1} 起全被因果掩码挡住。两个模型的编码器层结构几乎一样，差别只在这张掩码和“预测什么”。`;

  return (
    <VisualizationFrame
      title="BERT vs GPT：同一个位置，谁能看到谁，预测什么"
      description="点一个词。左边是 BERT 的填空：遮住它，两侧都可见。右边是 GPT 的续写：只看左边，预测下一个。下面是两个模型 10×10 的注意力掩码。"
      footnote={<>为了并排比较，这里省略了 BERT 的 [CLS] / [SEP] 和 GPT 的起始符。有损失的位置数：BERT 每个序列约 15%（这句 {N} 个词里 {MASKED_PER_SEQ} 个），GPT 每个位置都预测下一个词（{N} 个）。这就是为什么同样一遍数据，GPT 拿到的监督信号更多，而 BERT 每个预测看到的上下文更多。</>}
    >
      <div className="viz-controls">
        <span className="viz-k">选一个位置：</span>
        <div className="viz-chips">
          {TOKENS.map((t, i) => (
            <button key={i} type="button" className={`viz-chip mono${i === sel ? " is-on" : ""}`} aria-pressed={i === sel} onClick={() => setSel(i)}>{i}·{t}</button>
          ))}
        </div>
      </div>

      <div className="viz-grid2">
        <div className="viz-panel">
          <h5>BERT · 填空（掩码语言模型）</h5>
          <div className="viz-chips">
            {TOKENS.map((t, i) => (
              <span key={i} className="viz-chip mono" style={i === sel ? { ...chipBase, background: "#3b4234", color: "#fff", borderColor: "#3b4234" } : { ...chipBase, borderColor: BLUE, color: "var(--ink)" }}>
                <b>{i === sel ? "[MASK]" : t}</b>
                <small style={{ fontSize: 10, opacity: 0.85 }}>{i === sel ? `预测 ${t}` : "可见"}</small>
              </span>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <Matrix causal={false} sel={sel} color={BLUE} label={`BERT 的注意力掩码：每一行都能看到全部 ${N} 列。`} />
          </div>
          <p className="viz-k">每个位置看全部 {N} 个位置。被遮的词从两侧的上下文里被猜回来。</p>
        </div>
        <div className="viz-panel">
          <h5>GPT · 续写（自回归语言模型）</h5>
          <div className="viz-chips">
            {TOKENS.map((t, i) => {
              const visible = i <= sel;
              const isTarget = i === sel + 1;
              const style = visible
                ? { ...chipBase, borderColor: ORANGE, color: "var(--ink)", background: i === sel ? "#fdf1ea" : "#fff" }
                : isTarget
                  ? { ...chipBase, borderStyle: "dashed", borderColor: "#30332c", color: "var(--ink)" }
                  : { ...chipBase, opacity: 0.3 };
              return (
                <span key={i} className="viz-chip mono" style={style}>
                  <b>{isTarget ? "?" : t}</b>
                  <small style={{ fontSize: 10, opacity: 0.85 }}>{visible ? (i === sel ? "当前" : "可见") : isTarget ? `预测 ${t}` : "挡住"}</small>
                </span>
              );
            })}
          </div>
          <div style={{ marginTop: 10 }}>
            <Matrix causal sel={sel} color={ORANGE} label={`GPT 的因果掩码：第 ${sel} 行只能看到前 ${sel + 1} 列。`} />
          </div>
          <p className="viz-k">每个位置只看自己和左边。位置 {sel} 的输出被训练去预测“{next}”。</p>
        </div>
      </div>

      <div className="viz-panel" style={{ marginTop: 14 }}>
        <h5>一个 {N} 词的序列里，有损失的位置</h5>
        <div className="viz-bars" role="img" aria-label={`BERT ${MASKED_PER_SEQ} 个位置有损失，GPT ${N} 个位置有损失。`}>
          <div className="viz-bar-row" style={{ gridTemplateColumns: "150px minmax(0, 1fr) auto" }}>
            <span className="viz-bar-label">BERT：被遮的 15%</span>
            <div className="viz-bar-track"><span style={{ width: `${(MASKED_PER_SEQ / N) * 100}%`, background: BLUE }} /></div>
            <span className="viz-bar-val">{MASKED_PER_SEQ} / {N}</span>
          </div>
          <div className="viz-bar-row" style={{ gridTemplateColumns: "150px minmax(0, 1fr) auto" }}>
            <span className="viz-bar-label">GPT：每个位置</span>
            <div className="viz-bar-track"><span style={{ width: "100%", background: ORANGE }} /></div>
            <span className="viz-bar-val">{N} / {N}</span>
          </div>
        </div>
      </div>

      <div className="viz-narr">{narr}</div>
    </VisualizationFrame>
  );
}

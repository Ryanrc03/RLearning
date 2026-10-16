"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { buildMask, DEMO_SCORES, maskedAttention, type MaskKind } from "@/lib/ml/attention";

const TOKENS = ["I", "love", "machine", "learning"];
const D_K = 4;
const fmt = (x: number) => (x === -Infinity ? "−∞" : x.toFixed(2));

export default function AttentionMaskExplorer() {
  const [kind, setKind] = useState<MaskKind>("causal");
  const [sel, setSel] = useState<[number, number]>([1, 2]);
  const [qi, kj] = sel;
  const mask = useMemo(() => buildMask(kind, TOKENS.length), [kind]);
  const weights = useMemo(() => maskedAttention(DEMO_SCORES, mask, D_K), [mask]);
  const allowed = mask[qi][kj] === 0;
  const scaled = DEMO_SCORES[qi][kj] / Math.sqrt(D_K);

  return (
    <VisualizationFrame
      title="Attention Mask：哪个位置能读哪个位置"
      description="纵轴是 Query（正在算表示的位置），横轴是 Key（被读的位置）。格子里是 softmax 之后的注意力权重。点任一格看它为什么被允许或禁止。"
      footnote="QKᵀ 的原始分数是示意数值，d_k = 4。Mask 只决定信息能不能流过去，整张表仍然是一次矩阵运算同时算出的。"
    >
      <div className="viz-controls">
        <div className="viz-tabs" role="tablist" aria-label="mask 类型">
          <button type="button" role="tab" aria-selected={kind === "causal"} className={`viz-tab${kind === "causal" ? " is-on" : ""}`} onClick={() => setKind("causal")}>Causal（decoder-style，如 GPT）</button>
          <button type="button" role="tab" aria-selected={kind === "bidirectional"} className={`viz-tab${kind === "bidirectional" ? " is-on" : ""}`} onClick={() => setKind("bidirectional")}>Bidirectional（encoder-style，如 BERT）</button>
        </div>
      </div>
      <div className="viz-grid2 wide-left">
        <div className="viz-panel">
          <h5 className="nocase">softmax(QKᵀ/√d_k + M)，每行和为 1</h5>
          <div className="mx-wrap">
            <table className="mx">
              <thead>
                <tr>
                  <th className="row-h">Q ↓ / K →</th>
                  {TOKENS.map((t, j) => <th key={j} className="col-h" scope="col">{j + 1}<br />{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {TOKENS.map((t, i) => (
                  <tr key={i}>
                    <th className="row-h" scope="row">{i + 1} {t}</th>
                    {TOKENS.map((u, j) => {
                      const ok = mask[i][j] === 0;
                      const w = weights[i][j];
                      return (
                        <td key={j}>
                          <button
                            type="button"
                            className={`mx-cell${ok ? "" : " is-masked"}${qi === i && kj === j ? " is-sel" : ""}${ok && w > 0.55 ? " is-dark" : ""}`}
                            style={ok ? { background: `rgba(42, 120, 214, ${0.08 + w * 0.85})` } : undefined}
                            aria-pressed={qi === i && kj === j}
                            aria-label={`Query ${t} 读 Key ${u}：${ok ? `允许，权重 ${w.toFixed(3)}` : "禁止，权重 0"}`}
                            onClick={() => setSel([i, j])}
                          >
                            {ok ? w.toFixed(2) : "✕ 0"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="viz-legend">
            <span><i style={{ background: "rgba(42,120,214,.6)" }} />允许：M = 0</span>
            <span><i style={{ background: "repeating-linear-gradient(135deg,#f3f1e7 0 3px,#e9e6d6 3px 6px)", border: "1px solid var(--vline)" }} />✕ 禁止：M = −∞，权重为 0</span>
          </div>
        </div>
        <div className="viz-panel" aria-live="polite">
          <h5 className="nocase">位置 {qi + 1}「{TOKENS[qi]}」读位置 {kj + 1}「{TOKENS[kj]}」</h5>
          <table className="viz-table">
            <tbody>
              <tr><td>原始分数 q·k</td><td className="num">{DEMO_SCORES[qi][kj].toFixed(2)}</td></tr>
              <tr><td>÷ √d_k</td><td className="num">{scaled.toFixed(2)}</td></tr>
              <tr><td>+ M_ij</td><td className="num">{fmt(mask[qi][kj])}</td></tr>
              <tr><td>softmax 后权重</td><td className="num">{weights[qi][kj].toFixed(3)}</td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 10 }}>
            {kind === "bidirectional"
              ? "Bidirectional 下每个位置都能读整句话，包括后面的词。这是 BERT 这类 encoder 的设置：输入全部已知，任务是理解而不是预测下一个词。"
              : allowed
                ? kj === qi
                  ? "位置可以读自己（j = i）。"
                  : `j = ${kj + 1} ≤ i = ${qi + 1}：这是“过去”的位置，生成第 ${qi + 2} 个词时它已经存在，读它不算作弊。`
                : `j = ${kj + 1} > i = ${qi + 1}：这是“未来”的位置。训练时它的值其实就在矩阵里，但如果允许读，模型就能直接抄答案；推理时它根本还不存在。所以加 −∞，e^(−∞) = 0。`}
          </p>
        </div>
      </div>
    </VisualizationFrame>
  );
}

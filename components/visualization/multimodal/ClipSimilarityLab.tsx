"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { argmax, CLIP_PAIRS, clipLoss, lerpMatrix, S_AFTER, S_BEFORE, subMatrix } from "@/lib/ml/clip";

type View = "cos" | "i2t" | "t2i";
const N = 3;
const PAIRS = CLIP_PAIRS.slice(0, N);
const BEFORE = subMatrix(S_BEFORE, N);
const AFTER = subMatrix(S_AFTER, N);

const fmt = (x: number, d = 3) => x.toFixed(d);

// D1 + D2: one similarity matrix, three readings of it, and a temperature knob.
export default function ClipSimilarityLab() {
  const [progress, setProgress] = useState(1);
  const [tau, setTau] = useState(0.1);
  const [view, setView] = useState<View>("cos");
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const [si, sj] = sel;

  const S = useMemo(() => lerpMatrix(BEFORE, AFTER, progress), [progress]);
  const r = useMemo(() => clipLoss(S, tau), [S, tau]);
  const atLow = useMemo(() => clipLoss(S, 0.05), [S]);
  const atHigh = useMemo(() => clipLoss(S, 0.5), [S]);

  // Value shown in cell (i, j) for the current view. T→I is a softmax down column j.
  const cell = (i: number, j: number) => (view === "cos" ? S[i][j] : view === "i2t" ? r.probI2T[i][j] : r.probT2I[j][i]);
  const isTop = (i: number, j: number) =>
    view === "i2t" ? argmax(r.probI2T[i]) === j : view === "t2i" ? argmax(r.probT2I[j]) === i : false;
  const shade = (i: number, j: number) => (view === "cos" ? Math.max(0, (S[i][j] - 0.05) / 0.9) : cell(i, j));

  const rowTop = argmax(r.probI2T[si]);
  const rowRight = rowTop === si;
  const stage = progress === 0 ? "Before alignment" : progress === 1 ? "After alignment" : `插值 ${Math.round(progress * 100)}%`;

  return (
    <VisualizationFrame
      title="CLIP 相似度矩阵实验台"
      description="行是图像，列是文字，对角线是标注好的正确配对。切换训练状态、拖动 τ、点任意格子，看概率和双向 loss 怎样重新计算。"
      footnote="相似度是手工构造的教学数值，不来自真实 CLIP 模型；中间的插值只是两个状态的线性混合，不代表真实训练轨迹。所有概率与 loss 都由当前矩阵实时计算。"
    >
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="训练状态">
          <button type="button" className={`viz-chip${progress === 0 ? " is-on" : ""}`} aria-pressed={progress === 0} onClick={() => setProgress(0)}>Before alignment</button>
          <button type="button" className={`viz-chip${progress === 1 ? " is-on" : ""}`} aria-pressed={progress === 1} onClick={() => setProgress(1)}>After alignment</button>
        </div>
        <label>
          插值
          <input type="range" min={0} max={1} step={0.05} value={progress} onChange={(e) => setProgress(Number(e.target.value))} aria-label="在 Before 与 After 之间插值" />
          <span className="viz-mono">{Math.round(progress * 100)}%</span>
        </label>
        <label>
          温度 τ
          <input type="range" min={0.05} max={0.5} step={0.01} value={tau} onChange={(e) => setTau(Number(e.target.value))} aria-label="temperature τ" />
          <span className="viz-mono">{fmt(tau, 2)}</span>
        </label>
      </div>

      <div className="viz-tabs" role="tablist" aria-label="矩阵显示内容" style={{ marginBottom: 12 }}>
        {([
          ["cos", "Cosine S"],
          ["i2t", "Image→Text 概率（按行）"],
          ["t2i", "Text→Image 概率（按列）"],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} className={`viz-tab${view === key ? " is-on" : ""}`} onClick={() => setView(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="viz-grid2 wide-left">
        <div className="viz-panel">
          <h5 className="nocase">{stage} · {view === "cos" ? "S_ij = u_iᵀ t_j" : view === "i2t" ? "每一行和为 1" : "每一列和为 1"}</h5>
          <div className="mx-wrap">
            <table className="mx">
              <thead>
                <tr>
                  <th aria-label="图像 \ 文字" />
                  {PAIRS.map((p, j) => (
                    <th key={j} className="col-h" scope="col">T{j + 1}<br />{p.text}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PAIRS.map((p, i) => (
                  <tr key={i}>
                    <th className="row-h" scope="row"><span className="emoji" aria-hidden>{p.emoji}</span>I{i + 1} {p.image}</th>
                    {PAIRS.map((q, j) => {
                      const a = shade(i, j);
                      const pos = i === j;
                      return (
                        <td key={j}>
                          <button
                            type="button"
                            className={`mx-cell${pos ? " is-pos" : ""}${si === i && sj === j ? " is-sel" : ""}${a > 0.55 ? " is-dark" : ""}`}
                            style={{ background: `rgba(42, 120, 214, ${0.06 + a * 0.84})` }}
                            aria-pressed={si === i && sj === j}
                            aria-label={`图像 ${p.image} 与文字“${q.text}”，${pos ? "正配对" : "batch 内非对应"}，值 ${fmt(cell(i, j))}`}
                            onClick={() => setSel([i, j])}
                          >
                            {pos && <span className="mx-tag" aria-hidden>✓</span>}
                            {fmt(cell(i, j), view === "cos" ? 2 : 3)}
                            {isTop(i, j) && <span className="mx-top" aria-hidden>▲</span>}
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
            <span><i style={{ border: "2px solid var(--vgood)", background: "#fff" }} />✓ 对角线：标注的正配对</span>
            <span><i style={{ border: "1px solid var(--vline)", background: "#fff" }} />其余：batch 内非对应 pair</span>
            {view !== "cos" && <span>▲ 该{view === "i2t" ? "行" : "列"}概率最高</span>}
            <span>颜色越深数值越大</span>
          </div>
        </div>

        <div className="viz-panel" aria-live="polite">
          <h5 className="nocase">选中的格子</h5>
          <p>
            <b>{PAIRS[si].emoji} I{si + 1}</b> × <b>“{PAIRS[sj].text}”</b>
            <br />
            <span className="viz-k">{si === sj ? "✓ 正配对（对角线）" : "batch 内非对应 pair：当作负例，但不保证语义上一定不相关"}</span>
          </p>
          <table className="viz-table">
            <tbody>
              <tr><td>cosine similarity S</td><td className="num">{fmt(S[si][sj])}</td></tr>
              <tr><td>logit Z = S / τ</td><td className="num">{fmt(S[si][sj], 3)} / {fmt(tau, 2)} = {fmt(r.logits[si][sj], 2)}</td></tr>
              <tr><td>P(T{sj + 1} | I{si + 1})，按行 softmax</td><td className="num">{fmt(r.probI2T[si][sj])}</td></tr>
              <tr><td>P(I{si + 1} | T{sj + 1})，按列 softmax</td><td className="num">{fmt(r.probT2I[sj][si])}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="viz-panel" style={{ marginTop: 14 }}>
        <h5 className="nocase">{PAIRS[si].emoji} I{si + 1} 这一行：Image → Text 的概率分布</h5>
        <div className="viz-bars">
          {PAIRS.map((p, j) => (
            <div className="viz-bar-row" key={j}>
              <span className="viz-bar-label">{j === si ? "✓ " : ""}{p.text}</span>
              <span className="viz-bar-track"><span style={{ width: `${r.probI2T[si][j] * 100}%`, background: j === si ? "var(--vgood)" : "var(--vcrit)" }} /></span>
              <span className="viz-bar-val">{fmt(r.probI2T[si][j])}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="viz-stat" style={{ marginTop: 14 }}>
        <div><small>L_I→T（按行）</small><b>{fmt(r.lossI2T)}</b></div>
        <div><small>L_T→I（按列）</small><b>{fmt(r.lossT2I)}</b></div>
        <div><small>L = ½(L_I→T + L_T→I)</small><b>{fmt(r.loss)}</b></div>
        <div><small>这一行的 −log P(正确)</small><b>{fmt(r.rowLossI2T[si])}</b></div>
      </div>

      <div className={`viz-narr ${rowRight ? "is-good" : "is-bad"}`}>
        {rowRight ? (
          <>I{si + 1} 的正确文字已经是这一行里相似度最高的。减小 τ 会放大 logit 之间的差距，softmax 更尖，这一行的 loss 变小：τ = 0.05 时 {fmt(atLow.rowLossI2T[si])}，τ = 0.5 时 {fmt(atHigh.rowLossI2T[si])}。</>
        ) : (
          <>I{si + 1} 这一行里相似度最高的是“{PAIRS[rowTop].text}”，配错了。减小 τ 会让模型对这个错误<b>更自信</b>，loss 反而变大：τ = 0.05 时 {fmt(atLow.rowLossI2T[si])}，τ = 0.5 时 {fmt(atHigh.rowLossI2T[si])}。τ 不是越小越好。</>
        )}
      </div>
    </VisualizationFrame>
  );
}

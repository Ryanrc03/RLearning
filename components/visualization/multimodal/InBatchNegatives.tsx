"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { CLIP_PAIRS, clipLoss, DUP_PAIRS, multiPositiveRowLoss, S_AFTER, S_DUP, subMatrix } from "@/lib/ml/clip";

const TAU = 0.1;
const fmt = (x: number, d = 3) => x.toFixed(d);

// D3: how many candidate pairs a batch of N creates, and what "negative" really means there.
export default function InBatchNegatives() {
  const [n, setN] = useState(3);
  const [dup, setDup] = useState(false);
  const useDup = dup && n === 4;
  const pairs = useDup ? DUP_PAIRS : CLIP_PAIRS.slice(0, n);
  const S = useMemo(() => (useDup ? S_DUP : subMatrix(S_AFTER, n)), [useDup, n]);
  const r = useMemo(() => clipLoss(S, TAU), [S]);
  const row0 = r.logits[0];
  const single = r.rowLossI2T[0];
  const multi = multiPositiveRowLoss(row0, [0, 3]);
  // Pairs that are semantically correct even though they are off the diagonal.
  const isHiddenPos = (i: number, j: number) => useDup && ((i === 0 && j === 3) || (i === 3 && j === 0));

  return (
    <VisualizationFrame
      title="正例与 In-Batch Negatives"
      description="一个 batch 有 N 对图文，就有 N² 个候选组合。改 batch size，看正例和“batch 内非对应”各有多少，以及随机猜测时的 loss 基线 log N。"
      footnote={`矩阵取自 After alignment 的教学数值，τ = ${TAU}。真实 CLIP 的 batch 是 32,768。`}
    >
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="batch size">
          {[2, 3, 4].map((k) => (
            <button key={k} type="button" className={`viz-chip mono${n === k ? " is-on" : ""}`} aria-pressed={n === k} onClick={() => { setN(k); if (k !== 4) setDup(false); }}>N = {k}</button>
          ))}
        </div>
        <label className="viz-check">
          <input type="checkbox" checked={dup} onChange={(e) => { setDup(e.target.checked); if (e.target.checked) setN(4); }} />
          第 4 对换成“另一只猫”
        </label>
      </div>

      <div className="viz-grid2">
        <div className="viz-panel">
          <h5 className="nocase">{n} × {n} = {n * n} 个候选位置</h5>
          <div className="mx-wrap">
            <table className="mx">
              <thead>
                <tr>
                  <th aria-label="图像 \ 文字" />
                  {pairs.map((p, j) => <th key={j} className="col-h" scope="col">T{j + 1}<br />{p.text}</th>)}
                </tr>
              </thead>
              <tbody>
                {pairs.map((p, i) => (
                  <tr key={i}>
                    <th className="row-h" scope="row"><span className="emoji" aria-hidden>{p.emoji}</span>I{i + 1}</th>
                    {pairs.map((_, j) => {
                      const pos = i === j;
                      const hidden = isHiddenPos(i, j);
                      return (
                        <td key={j}>
                          <span
                            className={`mx-cell${pos ? " is-pos" : ""}`}
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "default", background: pos ? "#e9f7e9" : hidden ? "#fff4d6" : "#fbeaea", borderColor: hidden ? "var(--v4)" : undefined }}
                          >
                            {pos ? "正例" : hidden ? "假负例" : "负例"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="viz-panel">
          <h5 className="nocase">计数与 loss</h5>
          <table className="viz-table">
            <tbody>
              <tr><td>标注正配对（对角线）</td><td className="num">N = {n}</td></tr>
              <tr><td>batch 内非对应位置</td><td className="num">N² − N = {n * n - n}</td></tr>
              <tr><td>每张图的候选文字</td><td className="num">{n}（1 正 + {n - 1} 负）</td></tr>
              <tr><td>随机猜测的 loss 基线 log N</td><td className="num">{fmt(Math.log(n))}</td></tr>
              <tr><td>当前矩阵的 L</td><td className="num">{fmt(r.loss)}</td></tr>
            </tbody>
          </table>
          <p className="viz-k" style={{ marginTop: 8 }}>
            负例不需要额外采样，batch 里别人的文字就是负例。N 越大，每一行 softmax 要压过的对手越多，基线 log N 也越高。
          </p>
        </div>
      </div>

      <div className={`viz-narr ${useDup ? "is-warn" : ""}`}>
        {useDup ? (
          <>T4“一只猫趴在窗台上”也正确描述了 I1，但单正例的标签只认对角线，于是 I1 这一行把它当负例往下压：I1 的 −log P(T1) = <b>{fmt(single)}</b>。若用 multi-positive mask 把 T1、T4 都算作正例，loss 变成 −log(P(T1)+P(T4)) = <b>{fmt(multi)}</b>。</>
        ) : (
          <>标签只是“谁和谁是同一对”，不是语义判断。batch 里出现两张猫图、或者同一张图有多条 caption 时，非对角线上也可能是正确描述。勾选上面的选项看一个例子。</>
        )}
      </div>
    </VisualizationFrame>
  );
}

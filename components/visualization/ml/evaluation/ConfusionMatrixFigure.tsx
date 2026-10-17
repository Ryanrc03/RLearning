"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import ConfusionGrid from "@/components/visualization/ml/primitives/ConfusionGrid";
import { accuracy, confusion, DOG_CAT, type Confusion } from "@/lib/ml/metrics";

// Page 1 of Evaluation: the ten animals from the notes. Click any animal to flip
// the model's guess and watch the four cells and accuracy follow; the second
// tab shows why accuracy stops meaning anything at 990 dogs to 10 cats.

type Mode = "ten" | "imbalanced";
type Lazy = "all-dog" | "finds-cats";

const BIG: Record<Lazy, Confusion> = {
  "all-dog": { tp: 990, fp: 10, fn: 0, tn: 0 },
  "finds-cats": { tp: 940, fp: 5, fn: 50, tn: 5 },
};

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

export default function ConfusionMatrixFigure() {
  const [mode, setMode] = useState<Mode>("ten");
  const [preds, setPreds] = useState<boolean[]>([...DOG_CAT.preds]);
  const [lazy, setLazy] = useState<Lazy>("all-dog");

  const labels = DOG_CAT.labels;
  const c = mode === "ten" ? confusion(labels, preds) : BIG[lazy];
  const acc = accuracy(c);
  const total = c.tp + c.fp + c.fn + c.tn;
  const flip = (i: number) => setPreds((p) => p.map((v, j) => (j === i ? !v : v)));
  const reset = () => {
    setPreds([...DOG_CAT.preds]);
    setLazy("all-dog");
  };

  const narr =
    mode === "ten"
      ? `${total} 只动物里猜对了 ${c.tp + c.tn} 只，accuracy ${pct(acc)}。对角线上是猜对的：TP ${c.tp} 只真 dog 被猜成 dog，TN ${c.tn} 只真 cat 被猜成 cat。另外两格是猜错的：FP ${c.fp} 只 cat 被当成 dog，FN ${c.fn} 只 dog 被当成 cat。点任何一只动物，把模型对它的猜测翻过来。`
      : lazy === "all-dog"
        ? `一个什么都不看、全猜 dog 的模型：990 只 dog 全对，10 只 cat 全错，accuracy 仍有 ${pct(acc)}。它一只猫都没认出来，但 accuracy 看起来比大多数认真训练的模型都高。`
        : `换一个真的会认猫的模型：认出 5 只 cat，代价是把 50 只 dog 错当成 cat。它明显更有用，accuracy 却只有 ${pct(acc)}，比全猜 dog 还低。所以下一页要把「猜 dog 的里面对了多少」和「真 dog 里找出了多少」分开看。`;

  return (
    <VisualizationFrame
      title="Confusion Matrix：四个格子装下所有预测"
      description="每一列是真实标签，每一行是模型猜的。左边标签页是笔记里的 10 只动物，右边把数据换成 990 只 dog 对 10 只 cat。"
    >
      <div className="viz-row">
        <div className="viz-tabs" role="tablist" aria-label="数据集">
          <button type="button" role="tab" aria-selected={mode === "ten"} className={`viz-tab${mode === "ten" ? " is-on" : ""}`} onClick={() => setMode("ten")}>10 只动物</button>
          <button type="button" role="tab" aria-selected={mode === "imbalanced"} className={`viz-tab${mode === "imbalanced" ? " is-on" : ""}`} onClick={() => setMode("imbalanced")}>990 只 dog、10 只 cat</button>
        </div>
        {mode === "imbalanced" && (
          <div className="viz-chips" aria-label="模型">
            <button type="button" className={`viz-chip${lazy === "all-dog" ? " is-on" : ""}`} onClick={() => setLazy("all-dog")}>全猜 dog</button>
            <button type="button" className={`viz-chip${lazy === "finds-cats" ? " is-on" : ""}`} onClick={() => setLazy("finds-cats")}>会认猫、也会错</button>
          </div>
        )}
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <div className="viz-grid2 wide-left">
        <div className="viz-panel">
          <h5>{mode === "ten" ? "样本：上面是真实标签，下面是模型的猜测" : "样本：1000 只动物"}</h5>
          {mode === "ten" ? (
            <div className="cm-samples">
              {labels.map((y, i) => {
                const p = preds[i];
                const right = y === p;
                return (
                  <button type="button" key={i} className={`cm-sample ${right ? "is-right" : "is-wrong"}`} onClick={() => flip(i)} aria-label={`第 ${i + 1} 只：真的是 ${y ? "dog" : "cat"}，猜 ${p ? "dog" : "cat"}，点击翻转`}>
                    <span className="em" aria-hidden>{y ? "🐶" : "🐱"}</span>
                    <small>猜 {p ? "🐶" : "🐱"}</small>
                    <span className="mark">{right ? "✓" : "✗"}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="viz-stack" aria-hidden>
                <span style={{ width: "99%", background: "#2a78d6" }} />
                <span style={{ width: "1%", background: "#eb6834" }} />
              </div>
              <div className="viz-legend">
                <span><i style={{ background: "#2a78d6" }} />990 只 dog</span>
                <span><i style={{ background: "#eb6834" }} />10 只 cat</span>
              </div>
              <p className="viz-k" style={{ marginTop: 8 }}>
                {lazy === "all-dog" ? "模型：不看输入，一律回答 dog。" : "模型：认出 5 只 cat，但把 50 只 dog 错当成 cat。"}
              </p>
            </div>
          )}
        </div>
        <div className="viz-panel">
          <h5>混淆矩阵</h5>
          <ConfusionGrid c={c} />
        </div>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>accuracy = (TP + TN) / 全部</small><b>{c.tp + c.tn} / {total} = {pct(acc)}</b></div>
        <div><small>模型猜 dog 的次数（TP + FP）</small><b>{c.tp + c.fp}</b></div>
        <div><small>真的是 dog 的数量（TP + FN）</small><b>{c.tp + c.fn}</b></div>
      </div>

      <div className={`viz-narr${mode === "imbalanced" ? " is-warn" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}

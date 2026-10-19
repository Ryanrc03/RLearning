"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { ADS, crossWeightsAtScale, fitModel, fmWeightsAtScale, HELD_OUT, makeCells, type ModelName, trueCtr, USERS } from "@/lib/ml/featureCross";

// Recommender Systems, feature crossing: five age groups × five ad types, one
// cell (50+ × 游戏) never shown. Pick a model; it is trained in the browser on
// the other 24 cells and its CTR table is drawn next to the truth.

const MODELS: { key: ModelName; label: string }[] = [
  { key: "lr", label: "LR（只相加）" },
  { key: "cross", label: "LR + 手工交叉" },
  { key: "fm", label: "FM（k = 2）" },
  { key: "dcn", label: "DCN（1 层 cross）" },
];
const SCALE_USERS = 1_000_000;
const SCALE_ADS = 100_000;
const SCALE_K = 16;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const big = (n: number) => (n >= 1e8 ? `${(n / 1e8).toFixed(0)} 亿` : n >= 1e4 ? `${(n / 1e4).toFixed(0)} 万` : String(n));

function Table({ title, ctr, mark }: { title: string; ctr: (i: number, j: number) => number; mark: "truth" | "pred" }) {
  return (
    <div className="viz-panel">
      <h5>{title}</h5>
      <div className="mx-wrap">
        <table className="mx" aria-label={title}>
          <thead>
            <tr>
              <th />
              {ADS.map((a) => <th key={a} className="col-h">{a}</th>)}
            </tr>
          </thead>
          <tbody>
            {USERS.map((u, i) => (
              <tr key={u}>
                <th className="row-h">{u}</th>
                {ADS.map((a, j) => {
                  const p = ctr(i, j);
                  const alpha = Math.min(1, p / 0.2) * 0.85;
                  const held = i === HELD_OUT.user && j === HELD_OUT.ad;
                  return (
                    <td key={a}>
                      <span
                        className={`mx-cell${alpha > 0.5 ? " is-dark" : ""}${held && mark === "pred" ? " is-sel" : ""}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "default",
                          background: `rgba(42, 120, 214, ${alpha.toFixed(3)})`,
                          borderStyle: held ? "dashed" : undefined,
                          borderColor: held ? "#d03b3b" : undefined,
                        }}
                      >
                        {pct(p)}
                        {held && <span className="mx-tag">{mark === "truth" ? "没曝光" : "猜"}</span>}
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
  );
}

export default function FeatureCrossFigure() {
  const [model, setModel] = useState<ModelName>("lr");
  const cells = useMemo(() => makeCells(), []);
  const fit = useMemo(() => fitModel(model, cells), [model, cells]);
  const heldErr = Math.abs(fit.heldOutPred - fit.heldOutTrue);
  const young = fit.pred[0][0];

  const narr = {
    lr: `LR 的 logit 只能是「年龄的分 + 广告类型的分」，同一个年龄差在所有广告上一样大。可真实数据里 18–24 对游戏 ${pct(trueCtr(0, 0))}、对理财只有 ${pct(trueCtr(0, 4))}，50+ 正好反过来。LR 只能取个折中：18–24 × 游戏它只给 ${pct(young)}，训练格平均差 ${(fit.trainAbsErr * 100).toFixed(2)} 个点，没见过的 50+ × 游戏被它猜成 ${pct(fit.heldOutPred)}。`,
    cross: `给每个「年龄 × 广告类型」配一个独立的交叉权重，见过的 24 格都拟合上了（平均差 ${(fit.trainAbsErr * 100).toFixed(2)} 个点）。但 50+ × 游戏那一格从来没有样本，它的交叉权重没收到过一次梯度，还是 0，预测退回成加法部分的 ${pct(fit.heldOutPred)}，真实是 ${pct(fit.heldOutTrue)}。放大到 ${big(SCALE_USERS)} 用户 × ${big(SCALE_ADS)} 广告，这种权重有 ${big(crossWeightsAtScale(SCALE_USERS, SCALE_ADS))} 个，绝大多数格子一条样本都没有。`,
    fm: `FM 给每个年龄段、每种广告各一个 2 维向量，交叉项是两个向量的内积。50+ 的向量从它和美妆、理财等的样本里学，游戏的向量从年轻人点游戏的样本里学，两个从没一起出现过的向量做内积，猜出 ${pct(fit.heldOutPred)}，真实 ${pct(fit.heldOutTrue)}。放大到 ${big(SCALE_USERS)} × ${big(SCALE_ADS)}，k = ${SCALE_K} 的 FM 只要 ${big(fmWeightsAtScale(SCALE_USERS, SCALE_ADS, SCALE_K))} 个向量参数。`,
    dcn: `DCN 把两个 2 维 embedding 拼成 x₀，过一层 cross：x₁ = x₀(x₀ᵀw) + b + x₀，x₀ᵀw 是一个数，乘回 x₀ 就造出了 x₀ 各维两两相乘的项。交叉同样是通过共享的 embedding 学的，所以没见过的 50+ × 游戏也猜得出：${pct(fit.heldOutPred)}，真实 ${pct(fit.heldOutTrue)}。再叠一层能到三阶，每层只多 w、b 两个和 x₀ 等长的向量。`,
  }[model];
  const tone = model === "lr" ? " is-bad" : heldErr > 0.02 ? " is-warn" : " is-good";

  return (
    <VisualizationFrame
      title="特征交叉：没见过的组合也要猜对"
      description="5 个年龄段 × 5 种广告，每格 2 万次模拟曝光，点击率里有「年龄 × 广告类型」的交互。红色虚线那一格（50+ × 游戏）从未曝光，不进训练。选一个模型，它在其余 24 格上训练，右表是它给出的 CTR。"
    >
      <div className="viz-row">
        <Tabs options={MODELS} value={model} onChange={setModel} ariaLabel="选择模型" />
        <button type="button" className="viz-btn" onClick={() => setModel("lr")}>重置</button>
      </div>

      <div className="viz-grid2">
        <Table title="真实 CTR" ctr={trueCtr} mark="truth" />
        <Table title={`${MODELS.find((m) => m.key === model)?.label} 的预测`} ctr={(i, j) => fit.pred[i][j]} mark="pred" />
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>训练 24 格平均误差</small><b>{(fit.trainAbsErr * 100).toFixed(2)} 个点</b></div>
        <div><small>训练 log loss</small><b>{fit.trainLogLoss.toFixed(4)}</b></div>
        <div><small>50+ × 游戏：预测 / 真实</small><b>{pct(fit.heldOutPred, 2)} / {pct(fit.heldOutTrue, 2)}</b></div>
        <div><small>这个玩具上的参数数</small><b>{fit.params}</b></div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

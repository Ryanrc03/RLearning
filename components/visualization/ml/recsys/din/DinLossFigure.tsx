"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import {
  DEMO_CANDIDATES,
  DEMO_HISTORY,
  FB_LABEL,
  HEAD,
  scoreCandidate,
  TAG_ANGLE,
} from "@/lib/ml/din";

// DIN note, "Loss functions": build one training example — ten history events,
// one candidate with its label — and score it with mean pooling and with DIN.
// Weights, pooled score, p and the BCE loss are computed in lib/ml/din.ts with a
// hand-set 2-D activation (示意); the real activation is the learned MLP above.

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GREY = "#9a9c8d";
const FB_COLOR = { skip: GREY, click: BLUE, long: BLUE } as const;
const FB_OPACITY = { skip: 1, click: 0.45, long: 1 } as const;

export default function DinLossFigure() {
  const [ci, setCi] = useState(0);
  const cand = DEMO_CANDIDATES[ci];
  const r = scoreCandidate(cand.tag, cand.label);
  const all = DEMO_CANDIDATES.map((c) => scoreCandidate(c.tag, c.label));
  const sumDin = all.reduce((s, x) => s + x.lossDin, 0);
  const sumMean = all.reduce((s, x) => s + x.lossMean, 0);
  const maxW = Math.max(...r.din.weights, 0.01);

  const better = r.lossDin < r.lossMean;
  const narr = `候选是「${cand.tag}」，用户${cand.label ? "点了" : "没点"}（y = ${cand.label}）。DIN 只给和它相关的历史权重：${r.din.weights.filter((w) => w > 0).length} 条非零，加权和 z = ${r.din.score.toFixed(2)}，p = ${r.pDin.toFixed(2)}，BCE = ${r.lossDin.toFixed(3)}；均值池化每条 0.10，z = ${r.mean.score.toFixed(2)}，p = ${r.pMean.toFixed(2)}，BCE = ${r.lossMean.toFixed(3)}。${better ? "这一条上 DIN 的 loss 更小。" : "这一条上均值池化反而更小。"} 三个候选加起来：DIN ${sumDin.toFixed(3)}，均值 ${sumMean.toFixed(3)}。`;

  return (
    <VisualizationFrame
      title="一条训练样本：同一段历史，换一个候选，权重就换一套"
      description="用户最近 10 条曝光（最上面最早），每条有一个 tag 和一种反馈。选一个候选视频，看两种池化给每条历史的权重、得到的分数和 BCE loss。"
      footnote={`示意值：tag 是平面上的单位向量（萌宠 ${TAG_ANGLE["萌宠"]}°、美食 ${TAG_ANGLE["美食"]}°、搞笑 ${TAG_ANGLE["搞笑"]}°、游戏 ${TAG_ANGLE["游戏"]}°、汽车 ${TAG_ANGLE["汽车"]}°）；e_i = s(反馈)·k_i，s = 划走 −0.6 / 点击 1 / 长播 1.4；w_i = max(0, cos(q, k_i)) × (0.5 / 1 / 1.3)；p = σ(${HEAD.bias} + ${HEAD.slope}·z)，z = ⟨池化向量, q⟩。真实模型里 w_i 由上一张图的 MLP 学出来。`}
    >
      <div className="viz-controls">
        <div className="viz-chips">
          {DEMO_CANDIDATES.map((c, i) => (
            <button key={c.tag} type="button" className={`viz-chip${i === ci ? " is-on" : ""}`} onClick={() => setCi(i)}>
              候选：{c.tag}（y = {c.label}）
            </button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={() => setCi(0)}>重置</button>
      </div>
      <div className="viz-grid2 wide-left">
        <div className="viz-scroll">
          <table className="viz-table" style={{ minWidth: 380 }}>
            <thead>
              <tr><th>#</th><th>tag</th><th>反馈</th><th className="num">均值</th><th>DIN 权重 w_i</th></tr>
            </thead>
            <tbody>
              {DEMO_HISTORY.map((e, i) => {
                const w = r.din.weights[i];
                return (
                  <tr key={i} style={{ opacity: w > 0 ? 1 : 0.55 }}>
                    <td className="num">{i + 1}</td>
                    <td style={{ fontWeight: e.tag === cand.tag ? 700 : 400 }}>{e.tag}</td>
                    <td><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: FB_COLOR[e.fb], opacity: FB_OPACITY[e.fb], marginRight: 5 }} />{FB_LABEL[e.fb]}</td>
                    <td className="num">0.10</td>
                    <td>
                      <span style={{ display: "inline-block", verticalAlign: "middle", height: 9, width: `${(70 * w) / maxW}px`, background: BLUE, borderRadius: 2, transition: "width .3s", marginRight: 6 }} />
                      <span className="viz-mono">{w.toFixed(2)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="viz-panel">
          <h5>这条样本的 loss</h5>
          <table className="viz-table">
            <thead>
              <tr><th></th><th className="num">均值池化</th><th className="num">DIN</th></tr>
            </thead>
            <tbody>
              <tr><td>z = ⟨池化, q⟩</td><td className="num">{r.mean.score.toFixed(2)}</td><td className="num">{r.din.score.toFixed(2)}</td></tr>
              <tr><td>p = σ(b + c·z)</td><td className="num">{r.pMean.toFixed(3)}</td><td className="num">{r.pDin.toFixed(3)}</td></tr>
              <tr><td>label y</td><td className="num">{cand.label}</td><td className="num">{cand.label}</td></tr>
              <tr><td><b>BCE</b></td><td className="num" style={{ color: ORANGE }}><b>{r.lossMean.toFixed(3)}</b></td><td className="num" style={{ color: BLUE }}><b>{r.lossDin.toFixed(3)}</b></td></tr>
            </tbody>
          </table>
          <p className="viz-k" style={{ marginTop: 10 }}>
            均值池化对三个候选用的是同一个历史向量，只靠和 q 的内积区分；DIN 先按候选重新加权历史，再求和。
          </p>
        </div>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: BLUE }} />长播</span>
        <span><i style={{ background: BLUE, opacity: 0.45 }} />点击</span>
        <span><i style={{ background: GREY }} />划走</span>
      </div>
      <div className={`viz-narr ${better ? "is-good" : "is-warn"}`}>{narr}</div>
    </VisualizationFrame>
  );
}

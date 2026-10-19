"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { intentLoss, MS_INTENT_WEIGHT, MS_TAU, retrievalLoss, stickerNegatives, totalLoss, uniformLoss } from "@/lib/ml/multistickerLoss";

// One training query, computed end to end: the gold sticker's cosine
// similarity against 6,757 seeded negatives, the full-bank softmax CE, its
// gradient, and the 0.2-weighted intent loss.

const NEGS = stickerNegatives();
const BIN = 0.01;
const BINS = Array.from({ length: 60 }, (_, i) => i * BIN);
const COUNTS = BINS.map((b) => NEGS.filter((s) => s >= b && s < b + BIN).length);
const MAXC = Math.max(...COUNTS);
const CURVE = Array.from({ length: 51 }, (_, i) => 0.1 + i * 0.01).map((s) => [s, retrievalLoss(s, NEGS).loss] as const);
const UNIFORM = uniformLoss();
const HEAD_LOSS = 7.03;
const P_GROUPS = [0.2, 0.5, 0.9];

export default function MsLossWalkthrough() {
  const [s, setS] = useState(0.3);
  const [pg, setPg] = useState(0.5);
  const r = retrievalLoss(s, NEGS);
  const li = intentLoss(pg);
  const total = totalLoss(r.loss, li);
  const hx = (v: number) => 30 + (v / 0.6) * 370;

  const narr = r.rank === 1
    ? `答案已经排第 1，可 p(答案) 只有 ${(r.pGold * 100).toFixed(2)}%，loss 还有 ${r.loss.toFixed(2)}：6,757 张负例每张只分到一点点概率，加起来仍是大头。全库 softmax 会一直推，直到答案和其他贴纸拉开足够大的距离。`
    : r.rank <= 30
      ? `答案排第 ${r.rank}，进了前 30（Exact R@30 算命中）。loss ${r.loss.toFixed(2)}，比瞎猜的 ${UNIFORM.toFixed(2)} 低 ${(UNIFORM - r.loss).toFixed(2)}，相当于 p(答案) 是均匀概率的 ${(r.pGold * 6758).toFixed(1)} 倍。`
      : `答案的相似度 ${s.toFixed(2)}，前面还有 ${(r.rank - 1).toLocaleString("en-US")} 张负例。梯度 ∂L/∂s = ${r.gradGold.toFixed(1)}：答案被往上拉，每张负例按自己的概率被往下压。`;

  return (
    <VisualizationFrame
      title="训练目标：一条 query 的 loss 是怎么算出来的"
      description="拖动答案贴纸和 query 的余弦相似度。左边是另外 6,757 张贴纸的相似度分布（示意：种子固定的 N(0.20, 0.05)，真实模型里每条 query 都不一样），右边是 loss 随答案相似度的变化。"
      footnote={`τ = ${MS_TAU}，意图损失权重 λ = ${MS_INTENT_WEIGHT}。右图虚线：瞎猜的 log 6758 = ${UNIFORM.toFixed(2)}，以及 head_only 第 5 个 epoch 的平均训练 loss ${HEAD_LOSS}（它已经包含 λ·意图损失）。`}
    >
      <Slider label="答案的相似度 s_gold" value={s} min={0.1} max={0.6} step={0.01} onChange={setS} display={s.toFixed(2)} id="ms-sgold" />
      <div className="viz-row" style={{ gap: 8, marginBottom: 6 }}>
        <span className="viz-k">意图分类头给答案意图组的概率：</span>
        <div className="viz-chips" role="group" aria-label="意图概率">
          {P_GROUPS.map((p) => (
            <button key={p} type="button" className={`viz-chip${pg === p ? " is-on" : ""}`} aria-pressed={pg === p} onClick={() => setPg(p)}>p = {p}</button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={() => { setS(0.3); setPg(0.5); }}>重置</button>
      </div>
      <Figure width={720} height={240} label={`s_gold = ${s.toFixed(2)}，排第 ${r.rank}，loss ${r.loss.toFixed(2)}`} minWidth={600}>
        <text x={30} y={16} fontSize={12.5} fontWeight={600} fill="#30332c">6,757 张负例的相似度，和答案的位置</text>
        {BINS.map((b, i) => {
          const h = (COUNTS[i] / MAXC) * 150;
          const right = b >= s;
          return <rect key={b} x={hx(b) + 0.5} y={200 - h} width={(BIN / 0.6) * 370 - 1} height={h} fill={right ? "var(--v2)" : "#cfcab4"} opacity={right ? 0.9 : 0.8} />;
        })}
        <line x1={30} y1={200} x2={400} y2={200} stroke="#76796f" />
        {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((t) => (
          <text key={t} x={hx(t)} y={215} fontSize={10.5} textAnchor="middle" fill="#76796f">{t.toFixed(1)}</text>
        ))}
        <text x={215} y={232} fontSize={11} textAnchor="middle" fill="#30332c">余弦相似度</text>
        <line x1={hx(s)} y1={30} x2={hx(s)} y2={200} stroke="var(--v3)" strokeWidth={2.5} style={{ transition: "x1 .2s, x2 .2s" }} />
        <text x={Math.min(hx(s) + 6, 330)} y={42} fontSize={11.5} fontWeight={700} fill="#087a08">答案 · 第 {r.rank.toLocaleString("en-US")} 名</text>
        <text x={Math.min(hx(s) + 6, 330)} y={57} fontSize={10.5} fill="#b2541e">橙色 = 比答案更像的负例</text>

        <Plot box={{ x: 420, y: 0, w: 300, h: 238 }} xDomain={[0.1, 0.6]} yDomain={[2, 11]} xTicks={[0.1, 0.2, 0.3, 0.4, 0.5, 0.6]} yTicks={[2, 4, 6, 8, 10]} xLabel="s_gold" title="检索 loss" format={(v) => (v < 1 ? v.toFixed(1) : String(v))}>
          {(f) => (
            <>
              <line x1={f.x0} x2={f.x1} y1={f.y(UNIFORM)} y2={f.y(UNIFORM)} stroke="#b9b39b" strokeDasharray="4 3" />
              <text x={f.x1 - 2} y={f.y(UNIFORM) - 4} fontSize={10} textAnchor="end" fill="#76796f">瞎猜 8.82</text>
              <line x1={f.x0} x2={f.x1} y1={f.y(HEAD_LOSS)} y2={f.y(HEAD_LOSS)} stroke="var(--v1)" strokeDasharray="4 3" />
              <text x={f.x1 - 2} y={f.y(HEAD_LOSS) - 4} fontSize={10} textAnchor="end" fill="var(--v1)">head_only 7.03</text>
              <Curve frame={f} points={CURVE} color="#3b4234" width={2} />
              <circle cx={f.x(s)} cy={f.y(r.loss)} r={5.5} fill="var(--v3)" stroke="#fff" strokeWidth={1.5} style={{ transition: "cx .2s, cy .2s" }} />
            </>
          )}
        </Plot>
      </Figure>
      <table className="viz-table">
        <thead><tr><th>步骤</th><th>公式</th><th className="num">这条 query</th></tr></thead>
        <tbody>
          <tr><td>① 答案的 logit</td><td>s_gold / τ</td><td className="num">{s.toFixed(2)} / {MS_TAU} = {r.goldLogit.toFixed(3)}</td></tr>
          <tr><td>② 全库的 log-sum-exp</td><td>log Σ<sub>j=1..6758</sub> e<sup>s_j/τ</sup></td><td className="num">{r.logZ.toFixed(3)}</td></tr>
          <tr><td>③ 答案的概率</td><td>e<sup>①−②</sup></td><td className="num">{(r.pGold * 100).toFixed(3)}%（均匀猜是 0.015%）</td></tr>
          <tr><td>④ 检索 loss</td><td>② − ①</td><td className="num">{r.loss.toFixed(3)}</td></tr>
          <tr><td>⑤ 意图 loss</td><td>−log p(答案的意图组)</td><td className="num">−log {pg} = {li.toFixed(3)}</td></tr>
          <tr><td>⑥ 总 loss</td><td>④ + {MS_INTENT_WEIGHT} × ⑤</td><td className="num"><b>{total.toFixed(3)}</b></td></tr>
          <tr><td>⑦ 对 s_gold 的梯度</td><td>(p − 1) / τ</td><td className="num">{r.gradGold.toFixed(2)}（负号：沿反方向走，s_gold 变大）</td></tr>
          <tr><td>⑧ 最难的负例</td><td>p<sub>j</sub> / τ 把它往下压</td><td className="num">p = {(r.pHardest * 100).toFixed(3)}%，前 10 难的合计占负例总推力 {(r.top10Share * 100).toFixed(1)}%</td></tr>
        </tbody>
      </table>
      <div className={`viz-narr${r.rank <= 30 ? " is-good" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}

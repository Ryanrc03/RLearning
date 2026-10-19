"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import {
  bestBeta,
  betaPoint,
  expectation,
  fitBradleyTerry,
  LOG_BETA_DEFAULT,
  LOG_BETA_MAX,
  LOG_BETA_MIN,
  logBetaGrid,
  preferProb,
  RLHF_DEMO,
  sweepBeta,
} from "@/lib/ml/rlhf";

// Page 3 of Post-training. Labelers' pairwise votes are fitted into reward-model
// scores (Bradley–Terry); the slider sets the KL coefficient β of
// max E[r] − β·KL(π‖π_ref), whose optimum π ∝ π_ref·exp(r/β) is drawn exactly.
// Left plot: what the reward model sees. Right plot: what an expert would grade.

const W = 720;
const H = 230;
const C_REF = "#cfcab4";
const C_POL = "#2a78d6";
const C_RM = "#eb6834";
const C_Q = "#1baf7a";
const MUTED = "#76796f";
const pct = (p: number) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;

export default function RlhfFigure() {
  const [logBeta, setLogBeta] = useState(LOG_BETA_DEFAULT);
  const beta = 10 ** logBeta;
  const demo = RLHF_DEMO;
  const reward = useMemo(() => fitBradleyTerry(demo.wins), [demo]);
  const sweep = useMemo(() => sweepBeta(demo, reward, logBetaGrid(LOG_BETA_MIN, LOG_BETA_MAX, 81)), [demo, reward]);
  const best = bestBeta(sweep);
  const ref = demo.candidates.map((c) => c.ref);
  const refQuality = expectation(ref, demo.candidates.map((c) => c.quality));
  const refReward = expectation(ref, reward);
  const now = betaPoint(demo, reward, beta);
  const top = now.policy.indexOf(Math.max(...now.policy));
  const kE = demo.candidates.findIndex((c) => c.key === "E");
  const pAE = preferProb(reward[0], reward[kE]);
  const klMax = Math.ceil(sweep[0].kl * 2) / 2;
  const keysWhere = (keep: (i: number) => boolean) => demo.candidates.filter((_, i) => keep(i)).map((c) => c.key).join("、");
  const gainers = keysWhere((i) => now.policy[i] > ref[i] + 0.01);
  const losers = keysWhere((i) => now.policy[i] < ref[i] - 0.01);

  const tone = now.quality < refQuality ? "is-bad" : now.kl < 0.05 ? "is-warn" : now.quality >= best.quality - 0.015 ? "is-good" : "is-warn";
  const narr =
    tone === "is-bad"
      ? `β = ${beta.toFixed(2)}：KL 罚得太轻，策略把 ${pct(now.policy[kE])} 的概率压到了 RM 最喜欢的客套回答 E 上。RM 分涨到 ${now.reward.toFixed(2)}，专家分却跌到 ${now.quality.toFixed(2)}，比 SFT 模型的 ${refQuality.toFixed(2)} 还低，这就是 reward hacking。`
      : tone === "is-good"
        ? `β = ${beta.toFixed(2)}：离参考模型 KL ${now.kl.toFixed(2)} nats，概率从 ${losers} 挪给了 ${gainers}，专家分 ${now.quality.toFixed(2)}，接近这条曲线的最高点（β ≈ ${best.beta.toFixed(2)}）。往左再拖，RM 分还会涨，专家分开始掉。`
        : now.kl < 0.05
          ? `β = ${beta.toFixed(2)}：KL 罚得太重，策略几乎不敢离开参考模型（KL ${now.kl.toFixed(3)}），专家分 ${now.quality.toFixed(2)} 和 SFT 差不多，偏好数据白收集了。往左拖。`
          : `β = ${beta.toFixed(2)}：KL ${now.kl.toFixed(2)}，概率最多的是 ${demo.candidates[top].key}（${pct(now.policy[top])}）。RM 分 ${now.reward.toFixed(2)}、专家分 ${now.quality.toFixed(2)}：${beta < best.beta ? "已经过了专家分的峰值，RM 分的上涨开始是在刷 E。" : "还在上升段，可以再放松一点约束。"}`;

  return (
    <VisualizationFrame
      title="RLHF：偏好拟合出奖励，β 决定离参考模型多远"
      description="同一个 prompt 的五个回答。标注员每对比了 20 次，用 Bradley–Terry 拟合出 RM 分；专家分是 RM 看不到的真实质量。拖 β，看最优策略 π ∝ π_ref · exp(r / β) 怎么分配概率。"
    >
      <div className="rlhf-controls">
        <Slider label="KL 系数 β" value={logBeta} min={LOG_BETA_MIN} max={LOG_BETA_MAX} step={0.01} onChange={setLogBeta} display={beta.toFixed(2)} id="rlhf-beta" />
        <button type="button" className="viz-btn" onClick={() => setLogBeta(LOG_BETA_DEFAULT)}>重置</button>
      </div>

      <div className="viz-panel rlhf-panel">
        <h5 className="nocase">prompt：{demo.prompt}</h5>
        <table className="viz-table rlhf-table">
          <thead>
            <tr>
              <th>回答</th>
              <th className="num">RM 分 r</th>
              <th className="num">专家分</th>
              <th>π_ref（灰）→ π_β（蓝）</th>
            </tr>
          </thead>
          <tbody>
            {demo.candidates.map((c, i) => (
              <tr key={c.key} className={i === top ? "is-top" : undefined}>
                <td><b>{c.key}</b> {c.text}</td>
                <td className="num">{reward[i] >= 0 ? "+" : ""}{reward[i].toFixed(2)}</td>
                <td className="num">{c.quality.toFixed(1)}</td>
                <td>
                  <div className="rlhf-bars">
                    <span className="rlhf-bar"><i style={{ width: `${c.ref * 100}%`, background: C_REF }} /></span>
                    <span className="viz-mono">{pct(c.ref)}</span>
                    <span className="rlhf-bar"><i style={{ width: `${now.policy[i] * 100}%`, background: C_POL }} /></span>
                    <span className="viz-mono">{pct(now.policy[i])}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="viz-k rlhf-bt">
          Bradley–Terry：P(A ≻ E) = σ(r_A − r_E) = σ({reward[0].toFixed(2)} − {reward[kE].toFixed(2)}) = {pAE.toFixed(2)}。标注员 20 次里有 {demo.wins[kE][0]} 次选了 E，RM 就学到了「客套更好」。
        </p>
      </div>

      <Figure width={W} height={H} label={`β ${beta.toFixed(2)}：KL ${now.kl.toFixed(2)}，RM 分 ${now.reward.toFixed(2)}，专家分 ${now.quality.toFixed(2)}`}>
        <Plot box={{ x: 0, y: 4, w: W / 2, h: H - 4 }} xDomain={[0, klMax]} yDomain={[0, 1.2]} xTicks={[0, 1, 2]} yTicks={[0, 0.4, 0.8, 1.2]} xLabel="KL(π ‖ π_ref)，nats" yLabel="E[RM 分]" title="RM 看到的：一直在涨">
          {(f) => (
            <>
              <Curve frame={f} points={sweep.map((p) => [p.kl, p.reward] as const)} color={C_RM} />
              <circle cx={f.x(0)} cy={f.y(refReward)} r={3.5} fill={MUTED} />
              <Marker frame={f} x={now.kl} y={now.reward} color={C_POL} label={`β ${beta.toFixed(2)}`} side={now.kl > klMax * 0.7 ? "below" : "right"} guides />
            </>
          )}
        </Plot>
        <Plot box={{ x: W / 2, y: 4, w: W / 2, h: H - 4 }} xDomain={[0, klMax]} yDomain={[0.2, 0.7]} xTicks={[0, 1, 2]} yTicks={[0.2, 0.3, 0.4, 0.5, 0.6, 0.7]} xLabel="KL(π ‖ π_ref)，nats" yLabel="E[专家分]" title="真实质量：先升后降">
          {(f) => (
            <>
              <line x1={f.x0} x2={f.x1} y1={f.y(refQuality)} y2={f.y(refQuality)} stroke={MUTED} strokeDasharray="4 4" />
              <text x={f.x1 - 4} y={f.y(refQuality) + 14} fontSize={11} textAnchor="end" fill={MUTED}>SFT 模型 {refQuality.toFixed(2)}</text>
              <Curve frame={f} points={sweep.map((p) => [p.kl, p.quality] as const)} color={C_Q} />
              <circle cx={f.x(best.kl)} cy={f.y(best.quality)} r={4} fill="#fff" stroke={C_Q} strokeWidth={2} />
              <Marker frame={f} x={now.kl} y={now.quality} color={C_POL} label={`${now.quality.toFixed(2)}`} side={now.kl > klMax * 0.7 ? "left" : "right"} guides />
            </>
          )}
        </Plot>
      </Figure>

      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { CANDIDATES, matchStats } from "@/lib/systems/ads/matching";

const DEFAULT_T = 0.6;
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function MatchingPlayground() {
  const [threshold, setThreshold] = useState(DEFAULT_T);
  const s = matchStats(threshold);

  let narr: string;
  let tone = "";
  if (threshold >= 0.95) {
    narr = `只接受确定性匹配：precision ${pct(s.precision)}，但 ${s.conversions} 个转化里只有 ${Math.round(s.coverage * s.conversions)} 个被关联上。漏掉的转化在训练里全变成了 label 0：模型会系统性地低估 CVR。`;
    tone = "is-warn";
  } else if (s.falsePositives >= 3) {
    narr = `阈值很低，几乎所有转化都“找到了”点击，但 ${s.accepted} 个接受的匹配里有 ${s.falsePositives} 个是错的。错配会把功劳记到无关的点击上：那些点击得到错误的 label 1，广告主的报表也虚高。`;
    tone = "is-bad";
  } else {
    narr = `阈值 ${threshold.toFixed(2)}：接受 ${s.accepted} 个匹配，错配 ${s.falsePositives} 个，漏配 ${s.falseNegatives} 个。没有哪个阈值两头都好；该选哪里取决于下游更怕假正例（报表虚高、label 污染）还是更怕覆盖率低（低估 CVR）。`;
  }

  return (
    <VisualizationFrame
      title={"Identity Matching Playground"}
      description="8 个转化、12 个候选触点，每个候选有一个匹配分数。拖动阈值，分数 ≥ 阈值的候选被接受为同一个人。"
      footnote={<>Toy Example：候选、信号、分数和“真值”都是编出来的，只为了让 trade-off 看得见；真实系统拿不到真值，只能靠抽样标注或对照实验去估计 precision。所有信号都假定已获得用户同意并符合平台规则。</>}
    >
      <div className="viz-slider">
        <span>Confidence threshold</span>
        <input type="range" min={0.3} max={1} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label="匹配阈值" />
        <b>{threshold.toFixed(2)}</b>
      </div>

      <div className="ads-funnel">
        <div className={s.precision >= 0.8 ? "is-good" : s.precision < 0.65 ? "is-bad" : ""}><small>Precision（接受的里有多少是对的）</small><b>{pct(s.precision)}</b></div>
        <div className={s.recall >= 0.8 ? "is-good" : s.recall < 0.5 ? "is-bad" : ""}><small>Recall（真匹配里找回多少）</small><b>{pct(s.recall)}</b></div>
        <div className={s.coverage < 0.5 ? "is-bad" : ""}><small>Coverage（有匹配的转化占比）</small><b>{pct(s.coverage)}</b></div>
        <div className={s.falsePositives ? "is-bad" : ""}><small>False positive → 错误的 label 1</small><b>{s.falsePositives}</b></div>
        <div className={s.falseNegatives ? "is-bad" : ""}><small>False negative → 漏掉的 label 1</small><b>{s.falseNegatives}</b></div>
      </div>

      <div className="ads-table-wrap" style={{ marginTop: 10 }}>
        <table className="viz-table">
          <thead>
            <tr><th>转化</th><th>候选触点</th><th>方法 · 信号</th><th className="num">分数</th><th>判定</th><th>toy 真值</th></tr>
          </thead>
          <tbody>
            {CANDIDATES.map((c) => {
              const accepted = c.score >= threshold;
              const verdict = accepted ? (c.truth ? <span className="ads-tag is-good">接受 · 对</span> : <span className="ads-tag is-bad">接受 · 错配</span>) : c.truth ? <span className="ads-tag is-warn">拒绝 · 漏配</span> : <span className="ads-tag">拒绝</span>;
              return (
                <tr key={`${c.conversionId}-${c.touchpointId}`} className={accepted ? "" : "is-dim"}>
                  <td className="viz-mono">{c.conversionId}</td>
                  <td className="viz-mono">{c.touchpointId}</td>
                  <td><b style={{ fontWeight: 600 }}>{c.method}</b> · {c.signals}</td>
                  <td className="num">{c.score.toFixed(2)}</td>
                  <td>{verdict}</td>
                  <td>{c.truth ? "同一人" : "不是"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="viz-controls" style={{ marginTop: 10, marginBottom: 0 }}>
        <button type="button" className="viz-btn" onClick={() => setThreshold(1)}>只用确定性匹配</button>
        <button type="button" className="viz-btn" onClick={() => setThreshold(0.3)}>阈值压到最低</button>
        <button type="button" className="viz-btn" onClick={() => setThreshold(DEFAULT_T)}>Reset</button>
      </div>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

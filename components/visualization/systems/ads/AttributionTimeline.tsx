"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { CLICKS, PURCHASE, fmt, hm } from "@/lib/systems/ads/case";
import { LABEL_POLICIES, POLICIES, attribute, clickLabel, type AttributionPolicy, type LabelPolicy } from "@/lib/systems/ads/attribution";

const T0 = hm(9, 40);
const T1 = hm(10, 40);
const W = 640;
const X0 = 30;
const X1 = W - 30;
const x = (t: number) => X0 + ((t - T0) / (T1 - T0)) * (X1 - X0);
const DEFAULT_WINDOW = 60;
const LABEL_WINDOW = 24 * 60;
const COLORS: Record<string, string> = { click_100: "#2a78d6", click_101: "#eb6834" };

export default function AttributionTimeline() {
  const [policy, setPolicy] = useState<AttributionPolicy>("last_click");
  const [labelPolicy, setLabelPolicy] = useState<LabelPolicy>("follow_attribution");
  const [windowMin, setWindowMin] = useState(DEFAULT_WINDOW);
  const credits = attribute(CLICKS, PURCHASE.time, windowMin, policy);
  const labels = CLICKS.map((c) => clickLabel(c, credits, PURCHASE.time, LABEL_WINDOW, labelPolicy));
  const wStart = Math.max(T0, PURCHASE.time - windowMin);
  const reset = () => { setPolicy("last_click"); setLabelPolicy("follow_attribution"); setWindowMin(DEFAULT_WINDOW); };

  const differs = labelPolicy === "any_conversion_in_window" && credits.some((c, i) => (c.credit > 0 ? 1 : 0) !== labels[i]);
  const noneEligible = credits.every((c) => !c.eligible);
  const narr = noneEligible
    ? `窗口只有 ${windowMin} 分钟，两次点击都在窗口外：这次购买在报表里不归因给任何广告。注意，用户确实买了；“没归因”只是这条规则下的结论。`
    : differs
      ? "报表按归因规则只把 credit 给了一个点击，但这里的训练 label 规则是“点击后 24 小时内同一用户在该广告主有转化即为正”，两个点击都是 label 1。归因结果和训练 label 是两件事，按各自的用途定义。"
      : `${POLICIES.find((p) => p.id === policy)!.name}：${credits.filter((c) => c.credit > 0).map((c) => `${c.touchpointId} 得 ${c.credit.toFixed(2)}`).join("，")}。label 跟随归因时，credit > 0 的点击记 1；但多触点模型里 credit 是小数，label 仍然只能是 0 或 1，这时“跟随归因”本身就需要一条额外的规则。`;

  return (
    <VisualizationFrame
      title="Attribution Timeline"
      description="Ad A、Ad B 两次点击，30 分钟后购买。换归因规则和窗口看 credit 怎么分；换 label 规则看训练 label 是否跟着变。"
      footnote="归因窗口在这里用分钟只是为了画得下；真实系统常见的是以天计的 click-through / view-through 窗口。时间与 ID 均为模拟数据。"
    >
      <div className="viz-controls">
        <div className="viz-tabs" role="tablist" aria-label="归因规则">
          {POLICIES.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={policy === p.id} className={`viz-tab${policy === p.id ? " is-on" : ""}`} onClick={() => setPolicy(p.id)}>{p.name}</button>
          ))}
        </div>
      </div>
      <div className="viz-slider">
        <span>归因窗口</span>
        <input type="range" min={10} max={60} step={5} value={windowMin} onChange={(e) => setWindowMin(Number(e.target.value))} aria-label="归因窗口（分钟）" />
        <b>{windowMin} min</b>
      </div>

      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} 150`} role="img" aria-label={narr}>
          <rect x={x(wStart)} y={34} width={x(PURCHASE.time) - x(wStart)} height={64} fill="#efeafd" rx={4} />
          <text x={x(wStart) + 4} y={46} fontSize={10} fill="#6a55d8">归因窗口 {windowMin} min</text>
          <line x1={X0} y1={90} x2={X1} y2={90} stroke="#c9c9c9" />
          {[hm(9, 40), hm(9, 50), hm(10, 0), hm(10, 10), hm(10, 20), hm(10, 30), hm(10, 40)].map((t) => (
            <g key={t}><line x1={x(t)} y1={88} x2={x(t)} y2={92} stroke="#a8a8a8" /><text x={x(t)} y={106} fontSize={9.5} textAnchor="middle" fill="#8b8b8b">{fmt(t)}</text></g>
          ))}
          {CLICKS.map((c, i) => {
            const cr = credits[i];
            const h = 40 * cr.credit;
            return (
              <g key={c.id} opacity={cr.eligible ? 1 : 0.4}>
                <rect x={x(c.time) - 9} y={88 - h} width={18} height={h} fill={COLORS[c.id]} rx={2} />
                <circle cx={x(c.time)} cy={90} r={5} fill={COLORS[c.id]} />
                <text x={x(c.time)} y={122} fontSize={10.5} textAnchor="middle" fill="#3f3f3f">{c.label}</text>
                <text x={x(c.time)} y={136} fontSize={9.5} textAnchor="middle" className="mono" fill="#8b8b8b">{c.id}</text>
                <text x={x(c.time)} y={84 - h} fontSize={10} textAnchor="middle" fill={COLORS[c.id]} className="mono">{cr.credit.toFixed(2)}</text>
              </g>
            );
          })}
          <rect x={x(PURCHASE.time) - 6} y={84} width={12} height={12} fill="#1baf7a" transform={`rotate(45 ${x(PURCHASE.time)} 90)`} />
          <text x={x(PURCHASE.time)} y={122} fontSize={10.5} textAnchor="middle" fill="#3f3f3f">Purchase</text>
          <text x={x(PURCHASE.time)} y={136} fontSize={9.5} textAnchor="middle" className="mono" fill="#8b8b8b">{PURCHASE.id}</text>
          <text x={X0} y={16} fontSize={10.5} fontWeight={600} fill="#3f3f3f">柱高 = attribution credit</text>
        </svg>
      </div>

      <div className="ads-section">
        <h5>训练 label 规则</h5>
        <div className="viz-tabs" role="tablist" aria-label="label 规则">
          {LABEL_POLICIES.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={labelPolicy === p.id} className={`viz-tab${labelPolicy === p.id ? " is-on" : ""}`} onClick={() => setLabelPolicy(p.id)}>{p.name}</button>
          ))}
        </div>
        <div className="ads-table-wrap" style={{ marginTop: 8 }}>
          <table className="viz-table">
            <thead><tr><th>Click</th><th>归因判定</th><th className="num">Credit（报表）</th><th className="num">CVR label（训练）</th></tr></thead>
            <tbody>
              {CLICKS.map((c, i) => (
                <tr key={c.id} className={credits[i].credit > 0 !== (labels[i] === 1) ? "is-hit" : ""}>
                  <td className="viz-mono">{c.id} · {c.ad}</td>
                  <td>{credits[i].reason}</td>
                  <td className="num">{credits[i].credit.toFixed(2)}</td>
                  <td className="num">{labels[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="viz-k" style={{ marginTop: 4 }}>{LABEL_POLICIES.find((p) => p.id === labelPolicy)!.blurb}</div>
      </div>

      <div className="viz-controls" style={{ marginTop: 10, marginBottom: 0 }}>
        <button type="button" className="viz-btn" onClick={reset}>Reset</button>
      </div>
      <div className={`viz-narr${differs ? " is-warn" : noneEligible ? " is-bad" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}

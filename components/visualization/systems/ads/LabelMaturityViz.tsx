"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { LATE, ids } from "@/lib/systems/ads/case";
import { labelAt } from "@/lib/systems/ads/attribution";

type Strategy = "emit_and_correct" | "treat_missing_as_negative";
const W = 640;
const X0 = 24;
const X1 = W - 24;
const HOURS = 8 * 24;
const x = (h: number) => X0 + (h / HOURS) * (X1 - X0);
const CONV_H = (LATE.conversionTime - LATE.clickTime) / 60;
const WINDOW_H = LATE.labelWindow / 60;
const DEFAULT_NOW = 30;

export default function LabelMaturityViz() {
  const [nowH, setNowH] = useState(DEFAULT_NOW);
  const [strategy, setStrategy] = useState<Strategy>("emit_and_correct");
  const [converts, setConverts] = useState(true);
  const conv = converts ? LATE.conversionTime : null;
  const s = labelAt(LATE.clickTime, conv, LATE.labelWindow, LATE.clickTime + nowH * 60, strategy);
  const reset = () => { setNowH(DEFAULT_NOW); setStrategy("emit_and_correct"); setConverts(true); };

  const tone = s.status === "positive" ? "is-good" : s.status === "final_negative" && converts && nowH * 60 >= LATE.conversionTime - LATE.clickTime ? "is-bad" : s.mature ? "" : "is-warn";
  const statusText = s.status === "pending" ? (s.revision ? "provisional" : "未写出") : s.status === "positive" ? (s.mature ? "final" : "positive（未到期）") : "final";

  return (
    <VisualizationFrame
      title="Label Window：什么时候 label 才算数"
      description={`另一个场景：${LATE.clickId}（Ad C）在第 0 小时被点击，用户 ${CONV_H} 小时后才下单。label window 是 7 天。拖动“现在”，看训练表里这条样本此刻的 label。`}
      footnote="7 天窗口、52 小时延迟都是示意值。真实的窗口长度由业务决定，也常按转化类型（购买、注册、付费）不同而不同。"
    >
      <div className="viz-controls">
        <div className="viz-tabs" role="tablist" aria-label="样本写出策略">
          <button type="button" role="tab" aria-selected={strategy === "emit_and_correct"} className={`viz-tab${strategy === "emit_and_correct" ? " is-on" : ""}`} onClick={() => setStrategy("emit_and_correct")}>先写 provisional，之后修正</button>
          <button type="button" role="tab" aria-selected={strategy === "treat_missing_as_negative"} className={`viz-tab${strategy === "treat_missing_as_negative" ? " is-on" : ""}`} onClick={() => setStrategy("treat_missing_as_negative")}>1 小时没转化就定成 0</button>
        </div>
        <label className="viz-check"><input type="checkbox" checked={converts} onChange={() => setConverts((v) => !v)} />这次点击之后用户确实下单了</label>
      </div>
      <div className="viz-slider">
        <span>现在 = 点击后</span>
        <input type="range" min={0} max={HOURS} step={1} value={nowH} onChange={(e) => setNowH(Number(e.target.value))} aria-label="点击后经过的小时数" />
        <b>{nowH} h</b>
      </div>

      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} 110`} role="img" aria-label={s.explain}>
          <rect x={x(0)} y={30} width={x(WINDOW_H) - x(0)} height={34} fill="#efeafd" rx={4} />
          <text x={x(0) + 4} y={42} fontSize={10} fill="#6a55d8">label window：7 天</text>
          {strategy === "treat_missing_as_negative" && <><line x1={x(1)} y1={24} x2={x(1)} y2={70} stroke="#d03b3b" strokeDasharray="3 3" /><text x={x(1) + 4} y={24} fontSize={9.5} fill="#d03b3b">1 h 截止</text></>}
          <line x1={X0} y1={64} x2={X1} y2={64} stroke="#c9c9c9" />
          {Array.from({ length: 9 }, (_, d) => (
            <g key={d}><line x1={x(d * 24)} y1={62} x2={x(d * 24)} y2={66} stroke="#a8a8a8" /><text x={x(d * 24)} y={80} fontSize={9.5} textAnchor="middle" fill="#8b8b8b">D{d}</text></g>
          ))}
          <circle cx={x(0)} cy={64} r={5} fill="#2a78d6" />
          {converts && <rect x={x(CONV_H) - 6} y={58} width={12} height={12} fill="#1baf7a" transform={`rotate(45 ${x(CONV_H)} 64)`} />}
          {converts && <text x={x(CONV_H)} y={96} fontSize={10} textAnchor="middle" fill="#0b7a4b">购买 +{CONV_H}h</text>}
          <line x1={x(nowH)} y1={18} x2={x(nowH)} y2={74} stroke="#3f3f3f" strokeWidth={1.5} />
          <text x={Math.min(x(nowH) + 4, W - 40)} y={14} fontSize={10} fill="#3f3f3f">现在</text>
        </svg>
      </div>

      <div className="ads-funnel">
        <div><small>sample_id</small><b style={{ fontSize: 12 }}>{ids.sample(LATE.clickId)}</b></div>
        <div className={s.label === 1 ? "is-good" : ""}><small>label</small><b>{s.revision === 0 ? "—" : s.label}</b></div>
        <div><small>label_status</small><b style={{ fontSize: 13 }}>{statusText}</b></div>
        <div><small>label_revision</small><b>{s.revision || "—"}</b></div>
      </div>

      <div className="viz-controls" style={{ marginTop: 10, marginBottom: 0 }}>
        <button type="button" className="viz-btn" onClick={() => setNowH(1)}>点击后 1 h</button>
        <button type="button" className="viz-btn" onClick={() => setNowH(CONV_H)}>转化那一刻</button>
        <button type="button" className="viz-btn" onClick={() => setNowH(WINDOW_H)}>窗口结束</button>
        <button type="button" className="viz-btn" onClick={reset}>Reset</button>
      </div>
      <div className={`viz-narr ${tone}`}>{s.explain}</div>
    </VisualizationFrame>
  );
}

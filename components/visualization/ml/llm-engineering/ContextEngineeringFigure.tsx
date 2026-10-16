"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { BUDGETS, fillBudget, SEGMENTS, whatToCut, type SegmentKey } from "@/lib/ml/context";

// Page 2 of LLM Engineering: the context window as a token budget bar. Eight
// segments fill it in reading order; tick them on and off, switch the window
// size, and watch the bar overflow past the budget line.

const COLOR: Record<SegmentKey, string> = {
  system: "#76796f",
  prompt: "#2a78d6",
  shortMemory: "#1baf7a",
  longMemory: "#0ca30c",
  rag: "#eda100",
  tools: "#eb6834",
  state: "#c9c4ad",
  user: "#3b4234",
};

const ALL_ON: Record<SegmentKey, boolean> = Object.fromEntries(SEGMENTS.map((s) => [s.key, true])) as Record<SegmentKey, boolean>;
const fmt = (n: number) => n.toLocaleString();
const kfmt = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n));

export default function ContextEngineeringFigure() {
  const [enabled, setEnabled] = useState<Record<SegmentKey, boolean>>(ALL_ON);
  const [budget, setBudget] = useState<number>(BUDGETS[0]);
  const fill = fillBudget(SEGMENTS, enabled, budget);
  const cut = whatToCut(fill);
  const scale = Math.max(fill.used, budget);
  const budgetPct = (budget / scale) * 100;
  const onRows = fill.rows.filter((r) => r.enabled);
  const toggle = (k: SegmentKey) => setEnabled((e) => ({ ...e, [k]: !e[k] }));

  const narr = fill.overflow
    ? `${onRows.length} 段一共 ${fmt(fill.used)} token，超出 ${kfmt(budget)} 的窗口 ${fmt(fill.excess)} 个：模型根本装不下，更别说留地方回答。必须压缩或截断。${cut ? `最大的可压段是「${cut.name}」${fmt(cut.tokens)} token，至少要压到 ${fmt(cut.keep)} 以内（比如只留最相关的两段，或者把 JSON 换成一句摘要）；` : ""}不压的话多数 harness 会从最早的内容开始丢，先丢的往往是记忆。`
    : onRows.length === 0
      ? `什么都没进窗口，模型看到的是空的。勾上任一段。`
      : `${onRows.length} 段一共 ${fmt(fill.used)} token，${kfmt(budget)} 的窗口还剩 ${fmt(budget - fill.used)} 个给回答。模型看到的就是这根条从左到右的全部内容：上一页的 prompt 只占其中 ${fmt(fill.rows.find((r) => r.key === "prompt")?.tokens ?? 0)} 个。${budget > BUDGETS[0] ? "窗口大了装得下，但每一段都要花钱、花时间，而且被无关内容稀释的注意力不会因为窗口大就回来。" : ""}`;

  return (
    <VisualizationFrame
      title="上下文窗口：一根 token 预算条，prompt 只是其中一段"
      description="一个客服助手回答一轮时，模型实际读到的八段内容，按在窗口里的先后顺序排。勾掉一段它就不进窗口；右上角换窗口大小。"
    >
      <div className="viz-row">
        <div className="viz-chips" role="group" aria-label="窗口大小">
          {BUDGETS.map((b) => (
            <button key={b} type="button" className={`viz-chip mono${budget === b ? " is-on" : ""}`} aria-pressed={budget === b} onClick={() => setBudget(b)}>{kfmt(b)}</button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={() => { setEnabled(ALL_ON); setBudget(BUDGETS[0]); }}>重置</button>
      </div>

      <div style={{ position: "relative", paddingTop: 18, paddingBottom: 4 }}>
        <div className="viz-stack" role="img" aria-label={`窗口 ${budget} token，已用 ${fill.used}${fill.overflow ? `，超出 ${fill.excess}` : ""}`} style={{ height: 22 }}>
          {fill.rows.map((r) => (
            <span key={r.key} style={{ width: r.enabled ? `${(r.tokens / scale) * 100}%` : 0, background: COLOR[r.key], transition: "width .3s", marginLeft: r.enabled ? undefined : 0 }} />
          ))}
        </div>
        {fill.overflow && (
          <div aria-hidden style={{ position: "absolute", top: 18, bottom: 4, left: `${budgetPct}%`, right: 0, background: "repeating-linear-gradient(135deg, rgba(208,59,59,.55) 0 4px, rgba(255,255,255,.35) 4px 8px)", borderRadius: "0 4px 4px 0" }} />
        )}
        <div aria-hidden style={{ position: "absolute", top: 12, bottom: 0, left: `${budgetPct}%`, borderLeft: `2px ${fill.overflow ? "solid #d03b3b" : "dashed #3b4234"}`, transition: "left .3s" }} />
        <span aria-hidden style={{ position: "absolute", top: 0, left: `${budgetPct}%`, transform: budgetPct > 85 ? "translateX(-100%)" : undefined, fontSize: 11, fontWeight: 600, color: fill.overflow ? "#d03b3b" : "#3b4234", whiteSpace: "nowrap", padding: "0 4px", transition: "left .3s" }}>
          预算 {fmt(budget)}
        </span>
      </div>
      <div className="viz-legend">
        {SEGMENTS.map((s) => (
          <span key={s.key} style={{ opacity: enabled[s.key] ? 1 : 0.4 }}><i style={{ background: COLOR[s.key] }} />{s.name}</span>
        ))}
        {fill.overflow && <span><i style={{ background: "repeating-linear-gradient(135deg, rgba(208,59,59,.55) 0 3px, rgba(255,255,255,.35) 3px 6px)" }} />超出预算</span>}
      </div>

      <table className="viz-table" style={{ marginTop: 12 }}>
        <thead>
          <tr><th>进窗口</th><th>这是什么</th><th className="num">token</th><th className="num">累计</th></tr>
        </thead>
        <tbody>
          {fill.rows.map((r) => (
            <tr key={r.key} style={{ opacity: r.enabled ? 1 : 0.5 }}>
              <td style={{ whiteSpace: "nowrap" }}>
                <label className="viz-check">
                  <input type="checkbox" checked={r.enabled} onChange={() => toggle(r.key)} />
                  <i aria-hidden style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: COLOR[r.key] }} />
                  {r.name}
                </label>
              </td>
              <td>{r.what}{r.compressible ? "" : <span className="viz-k">（不可压）</span>}</td>
              <td className="num">{r.enabled ? fmt(r.tokens) : "—"}</td>
              <td className="num" style={{ color: r.enabled && !r.fits ? "#d03b3b" : undefined, fontWeight: r.enabled && !r.fits ? 600 : undefined }}>{r.enabled ? fmt(r.cumulative) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>已用</small><b>{fmt(fill.used)}</b></div>
        <div><small>窗口预算</small><b>{fmt(budget)}</b></div>
        <div><small>{fill.overflow ? "超出" : "剩给回答"}</small><b style={{ color: fill.overflow ? "#d03b3b" : "#087a08" }}>{fill.overflow ? `−${fmt(fill.excess)}` : fmt(budget - fill.used)}</b></div>
      </div>

      <div className={`viz-narr${fill.overflow ? " is-bad" : onRows.length === 0 ? " is-warn" : " is-good"}`}>{narr}</div>
    </VisualizationFrame>
  );
}

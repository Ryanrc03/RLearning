"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { ceilDiv } from "@/lib/algorithms/binarySearch";

// Why (p + k - 1) // k: lay the pile out hour by hour and compare three integer formulas with math.ceil.
export default function CeilDivExplorer() {
  const [p, setP] = useState(10);
  const [k, setK] = useState(3);
  const full = Math.floor(p / k);
  const rest = p % k;
  const want = Math.ceil(p / k);
  const rows = [
    { expr: "p // k", value: full, note: "向下取整：有余数时少算最后那个不满的小时。" },
    { expr: "(p + k) // k", value: Math.floor((p + k) / k), note: "有余数时对；刚好整除时多算一小时。" },
    { expr: "(p + k - 1) // k", value: ceilDiv(p, k), note: "加 k-1 刚好让任何正余数进位，整除时不进位。" },
  ];
  const hours = Array.from({ length: want }, (_, i) => (i < full ? k : rest));

  return (
    <VisualizationFrame
      title="向上取整：为什么是 (p + k - 1) // k"
      description="拖动香蕉数 p 和速度 k。每格是一小时，最后一小时就算没吃满也要算一整小时。"
    >
      <div className="viz-row">
        <label className="viz-slider"><span>p = <b>{p}</b> 根</span><input type="range" min={1} max={24} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label="香蕉数 p" /><span /></label>
        <label className="viz-slider"><span>k = <b>{k}</b> 根/小时</span><input type="range" min={1} max={10} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="速度 k" /><span /></label>
      </div>
      <div className="viz-panel">
        <h5 className="nocase">按小时摆开：{p} 根，每小时最多 {k} 根 → {want} 小时</h5>
        <div className="ceil-hours">
          {hours.map((eaten, i) => (
            <div key={i} className={`ceil-hour${eaten < k ? " is-partial" : ""}`}>
              <small>Hour {i + 1}</small>
              <div className="ceil-cells">{Array.from({ length: k }, (_, j) => <span key={j} className={j < eaten ? "is-eaten" : "is-empty"} />)}</div>
              <small>{eaten} 根{eaten < k ? "，仍算 1 小时" : ""}</small>
            </div>
          ))}
        </div>
      </div>
      <table className="viz-table">
        <thead><tr><th>公式</th><th className="num">结果</th><th>math.ceil(p / k) = {want}</th><th>说明</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.expr}><td className="viz-mono">{r.expr}</td><td className="num">{r.value}</td><td className={r.value === want ? "ceil-ok" : "ceil-no"}>{r.value === want ? "✓ 一致" : `✗ 差 ${r.value - want > 0 ? "+" : ""}${r.value - want}`}</td><td>{r.note}</td></tr>)}
        </tbody>
      </table>
      <div className={`viz-narr${rest === 0 ? " is-warn" : ""}`}>
        {rest === 0
          ? `${p} 刚好被 ${k} 整除。这时 (p + k) // k 多算了一小时，而 (p + k - 1) // k = (${p} + ${k - 1}) // ${k} = ${ceilDiv(p, k)}：加的 ${k - 1} 不够凑出下一个 ${k}，所以不进位。`
          : `${p} = ${full} × ${k} + ${rest}，余 ${rest} 根要再占一小时。(p + k - 1) // k = (${p} + ${k - 1}) // ${k} = ${ceilDiv(p, k)}：只要余数 ≥ 1，加上 ${k - 1} 就凑满一个 ${k}，正好进一位。`}
      </div>
    </VisualizationFrame>
  );
}

"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { SCENARIOS, STAGES, reconcile, type ScenarioId } from "@/lib/systems/ads/reconcile";

type Mode = "shadow" | "ab";
const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);
const signed = (x: number | null) => (x === null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`);

export default function ReconciliationDashboard() {
  const [mode, setMode] = useState<Mode>("shadow");
  const [scenario, setScenario] = useState<ScenarioId>("healthy");
  const r = useMemo(() => reconcile(scenario, mode), [scenario, mode]);
  const sc = SCENARIOS.find((s) => s.id === scenario)!;
  const reset = () => { setMode("shadow"); setScenario("healthy"); };

  let narr: string;
  let tone = "";
  if (mode === "ab") {
    narr = r.firstDiverged === "assignment"
      ? `SRM 检验 p = ${r.srmP!.toExponential(1)}：两组人数比例偏离设计的 50/50，分流本身坏了。在修好分流之前，下游任何指标差异都不可信。`
      : "A/B 两组是不同的用户，sample ID 集合本来就不可能一样，D_sample 和 D_label 不适用。各层按“每个分配用户”比 rate；rate 的差可能是 bug，也可能正是候选算法的真实效果。要定位 bug，得用同一份输入跑 Shadow 对账。";
    tone = r.firstDiverged ? "is-bad" : "";
  } else if (!r.firstDiverged) {
    narr = `${sc.story} AUC 差 ${(r.aucB - r.aucA).toFixed(4)}：A/A 也不会严格等于 0，只要落在历史 A/A 的波动范围内就算正常。`;
    tone = "is-good";
  } else {
    narr = `差异第一次出现在 ${STAGES.find((s) => s.id === r.firstDiverged)!.name}。${sc.story} 它下游的每一层都会继承这个差异，所以排查时从上往下找“第一处”，而不是盯着最后的 AUC。`;
    tone = "is-bad";
  }

  return (
    <VisualizationFrame
      title="Experiment Reconciliation Dashboard"
      description="同一批 toy 流量跑过 baseline（A）和候选（B）两条 pipeline。选一个故障场景，看每一层的数量、drop rate、集合差 D_sample 和 label 差 D_label，找到差异第一次出现的地方。"
      footnote="所有数字由一个 toy 生成器算出：600 个用户、1200 次点击，约 150 个转化，其中一部分被 Pixel 和 Events API 各报一次。AUC 为示意值，不来自真实训练。A/A 波动带 ±0.002 也是示意，真实系统要用历史 A/A 或 bootstrap 估计。"
    >
      <div className="viz-controls">
        <div className="viz-tabs" role="tablist" aria-label="对比方式">
          <button type="button" role="tab" aria-selected={mode === "shadow"} className={`viz-tab${mode === "shadow" ? " is-on" : ""}`} onClick={() => setMode("shadow")}>Shadow（同输入成对对账）</button>
          <button type="button" role="tab" aria-selected={mode === "ab"} className={`viz-tab${mode === "ab" ? " is-on" : ""}`} onClick={() => setMode("ab")}>A/B（随机分组）</button>
        </div>
        <label>
          场景
          <select value={scenario} onChange={(e) => setScenario(e.target.value as ScenarioId)} aria-label="故障场景">
            {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      <div className="ads-table-wrap">
        <table className="viz-table" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th>Stage</th>
              <th className="num">A</th>
              <th className="num">B</th>
              <th className="num">{mode === "shadow" ? "Δcount" : "rate A / B"}</th>
              <th className="num">Drop A / B</th>
              <th className="num">D_sample</th>
              <th className="num">D_label</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => {
              const name = STAGES.find((s) => s.id === row.stage)!;
              const first = row.stage === r.firstDiverged;
              return (
                <tr key={row.stage} className={first ? "is-first" : row.diverged ? "is-hit" : ""}>
                  <td><b style={{ fontWeight: 600 }}>{name.name}</b><div className="viz-k">{row.metric ?? name.unit}</div></td>
                  <td className="num">{row.stage === "auc" ? r.aucA.toFixed(4) : row.countA}</td>
                  <td className="num">{row.stage === "auc" ? r.aucB.toFixed(4) : row.countB}</td>
                  <td className="num">{row.rateA !== undefined ? `${row.rateA.toFixed(2)} / ${row.rateB!.toFixed(2)}` : signed(row.countDelta)}</td>
                  <td className="num">{row.dropA === null ? "—" : `${pct(row.dropA)} / ${pct(row.dropB)}`}</td>
                  <td className="num">{mode === "ab" && row.stage !== "training" && row.stage !== "auc" ? "不适用" : pct(row.dSample)}</td>
                  <td className="num">{pct(row.dLabel)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="viz-controls" style={{ marginTop: 10, marginBottom: 0 }}>
        <button type="button" className="viz-btn" onClick={reset}>Reset</button>
      </div>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

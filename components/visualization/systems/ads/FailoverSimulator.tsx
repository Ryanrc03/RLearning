"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { DEFAULT_FAILOVER, EXPECTED_SAMPLES, simulateFailover, type FailoverParams } from "@/lib/systems/ads/failover";

export default function FailoverSimulator() {
  const [p, setP] = useState<FailoverParams>(DEFAULT_FAILOVER);
  const [step, setStep] = useState(0);
  const set = (patch: Partial<FailoverParams>) => setP((prev) => ({ ...prev, ...patch }));
  const r = simulateFailover(p);
  const last = r.steps.length - 1;
  const cur = r.steps[step];
  const shown = r.steps.slice(0, step + 1).flatMap((s, i) => s.writes.map((w) => ({ ...w, step: i })));
  const done = step === last;
  const reset = () => { setP(DEFAULT_FAILOVER); setStep(0); };

  // Region cards reflect the current step.
  const aState = cur.down === "A" ? "down" : step === 3 ? "zombie" : cur.writer === "A" ? "writer" : "standby";
  const bState = cur.writer === "B" ? "writer" : "standby";
  const stateText: Record<string, string> = { writer: "Writer", standby: "Standby（只复制，不写）", down: "宕机", zombie: "恢复了，以为自己还是 writer" };

  let verdict = "";
  let tone = "";
  if (done) {
    const s102 = r.table.filter((row) => row.sampleId === EXPECTED_SAMPLES[1]);
    const zombieWon = s102.some((row) => row.epoch === 1);
    if (r.duplicates === 0 && r.missing.length === 0 && r.staleAccepted === 0) {
      verdict = "最终表正好两行，每个逻辑样本一行，没有来自旧 epoch 的写入。Fencing 挡住了僵尸 writer，唯一键 upsert 吸收了 B 重放带来的重复：两样缺一不可，而且都必须在最终 commit 的地方生效。";
      tone = "is-good";
    } else {
      const parts: string[] = [];
      if (r.duplicates) parts.push(`重复 ${r.duplicates} 行${p.uniqueKey ? "" : "（append-only 表不认识“同一个 sample”）"}`);
      if (r.missing.length) parts.push(`缺失 ${r.missing.join("、")}（B 跳过了 A 没提交的数据，fencing 又正确地拒绝了僵尸，于是没人补上）`);
      if (r.staleAccepted) parts.push(`接受了 ${r.staleAccepted} 次旧 epoch 的写入${zombieWon ? "，表里的 click_102 样本来自旧的 identity 模型" : ""}（没有 fencing，sink 分不清谁是现任 writer）`);
      if (!r.missing.length && p.resume === "latest" && zombieWon) parts.push("click_102 看起来没丢，只是因为僵尸碰巧补上了，这不能当成设计的一部分");
      verdict = `${parts.join("；")}。`;
      tone = "is-bad";
    }
  }

  return (
    <VisualizationFrame
      title="Disaster Recovery Simulation"
      description="Region A 写训练样本表，Region B 待命。按“下一步”推进：A 正常提交 → A 在提交前宕机 → B 接管并重放 → A 带着旧 epoch 回来。先选好 sink 的三个设置，再走一遍。"
      footnote="简化模型：一个协调服务负责选 writer 并发放递增的 epoch，样本表是唯一的最终 commit authority。真实系统里这些角色可能由 ZooKeeper / etcd、事务型存储或 Kafka 事务的 producer epoch 承担。"
    >
      <div className="viz-controls">
        <label className="viz-check"><input type="checkbox" checked={p.fencing} onChange={() => { set({ fencing: !p.fencing }); setStep(0); }} />Sink 检查 epoch（fencing）</label>
        <label className="viz-check"><input type="checkbox" checked={p.uniqueKey} onChange={() => { set({ uniqueKey: !p.uniqueKey }); setStep(0); }} />按 sample_id 唯一键 upsert</label>
        <div className="viz-tabs" role="tablist" aria-label="B 从哪开始读">
          <button type="button" role="tab" aria-selected={p.resume === "replicated_checkpoint"} className={`viz-tab${p.resume === "replicated_checkpoint" ? " is-on" : ""}`} onClick={() => { set({ resume: "replicated_checkpoint" }); setStep(0); }}>B 从复制来的 checkpoint 重放</button>
          <button type="button" role="tab" aria-selected={p.resume === "latest"} className={`viz-tab${p.resume === "latest" ? " is-on" : ""}`} onClick={() => { set({ resume: "latest" }); setStep(0); }}>B 从最新 offset 开始</button>
        </div>
      </div>

      <div className="ads-steps" style={{ marginBottom: 10 }}>
        {r.steps.map((s, i) => (
          <button key={s.title} type="button" className={`viz-chip${i === step ? " is-on" : ""}`} onClick={() => setStep(i)}>{i + 1}. {s.title}</button>
        ))}
      </div>

      <div className="ads-regions">
        {(["A", "B"] as const).map((region) => {
          const st = region === "A" ? aState : bState;
          return (
            <div key={region} className={`ads-region is-${st}`}>
              <b>Region {region}</b> <span className="viz-k">{stateText[st]}</span>
              <div className="viz-mono" style={{ marginTop: 4 }}>
                {region === "A" ? (step >= 2 ? "epoch 1（过期）" : "epoch 1") : step >= 2 ? "epoch 2" : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: 10 }}>{cur.detail}</p>

      <div className="ads-section">
        <h5>Sink 收到的写入</h5>
        <div className="ads-table-wrap">
          <table className="viz-table">
            <thead><tr><th>步</th><th>sample_id</th><th>来自</th><th>epoch</th><th>结果</th></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={5} className="viz-k">还没有写入</td></tr>}
              {shown.map((w, i) => (
                <tr key={i} className={w.step === step ? "is-hit" : ""}>
                  <td>{w.step + 1}</td>
                  <td className="viz-mono">{w.sampleId}</td>
                  <td>Region {w.region}</td>
                  <td className="num">{w.epoch}</td>
                  <td><span className={`ads-tag ${!w.accepted ? "is-good" : w.step >= 2 && w.epoch === 1 ? "is-bad" : "is-info"}`}>{w.reason}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {done && (
        <div className="ads-section">
          <h5>最终样本表</h5>
          <div className="ads-funnel">
            <div className={r.duplicates ? "is-bad" : "is-good"}><small>重复的逻辑样本</small><b>{r.duplicates}</b></div>
            <div className={r.missing.length ? "is-bad" : "is-good"}><small>缺失的逻辑样本</small><b>{r.missing.length}</b></div>
            <div className={r.staleAccepted ? "is-bad" : "is-good"}><small>被接受的旧 epoch 写入</small><b>{r.staleAccepted}</b></div>
            <div><small>表里的行数（应为 2）</small><b>{r.table.length}</b></div>
          </div>
        </div>
      )}

      <div className="viz-controls" style={{ marginTop: 10, marginBottom: 0 }}>
        <button type="button" className="viz-btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>← 上一步</button>
        <button type="button" className="viz-btn primary" onClick={() => setStep((s) => Math.min(last, s + 1))} disabled={done}>下一步 →</button>
        <button type="button" className="viz-btn" onClick={() => setStep(last)}>直接看结果</button>
        <button type="button" className="viz-btn" onClick={reset}>Reset</button>
      </div>
      <div className={`viz-narr ${tone}`}>{done ? verdict : `第 ${step + 1} 步 / 共 ${last + 1} 步。走到最后一步才看得到最终表。`}</div>
    </VisualizationFrame>
  );
}

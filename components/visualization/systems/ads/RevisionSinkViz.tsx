"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { SINK_MODES, applyWrites, type SinkMode } from "@/lib/systems/ads/dedup";

const NARR: Record<SinkMode, { text: string; tone: string }> = {
  insert_ignore: { text: "第一条写进去以后，同一个 sample_id 的任何后续写入都被当成“重复”丢掉了，包括那条真正的修正。label 永远停在 provisional 0。对 label 修正来说，“同一个 ID”不等于“同一条数据”。", tone: "is-bad" },
  last_write_wins: { text: "修正被写进去了，但故障恢复时重放的旧消息（revision 1）后到，又把 label 改回了 0。最后写入的不一定是最新的：重放、重试和跨 Region 复制都会打乱到达顺序。", tone: "is-bad" },
  version_aware: { text: "只有 revision 更大的写入才覆盖：修正（revision 2）生效，重放的 revision 1 被忽略。最终 label = 1，而且无论这三条消息以什么顺序、重复多少次到达，结果都一样。", tone: "is-good" },
};

export default function RevisionSinkViz() {
  const [mode, setMode] = useState<SinkMode>("insert_ignore");
  const steps = applyWrites(mode);
  const final = steps[steps.length - 1].row;
  const sql = SINK_MODES.find((m) => m.id === mode)!.sql;

  return (
    <VisualizationFrame
      title="Label Revision：同一个 sample_id，能不能直接 DROP？"
      description="接着第 03 章的迟到转化：click_200 的样本先写 provisional 0，52 小时后修正为 1，之后一次故障恢复又把旧版本重放了一遍。换三种写入方式看最终 label。"
    >
      <div className="viz-controls">
        <div className="viz-tabs" role="tablist" aria-label="写入方式">
          {SINK_MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={`viz-tab${mode === m.id ? " is-on" : ""}`} onClick={() => setMode(m.id)}>{m.name}</button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={() => setMode("insert_ignore")}>Reset</button>
      </div>
      <pre className="ads-pre">{sql}</pre>

      <div className="ads-table-wrap" style={{ marginTop: 10 }}>
        <table className="viz-table">
          <thead><tr><th>#</th><th>到达的写入</th><th className="num">label</th><th className="num">revision</th><th>结果</th><th>表里现在</th></tr></thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={i} className={s.applied ? "" : "is-dim"}>
                <td>{i + 1}</td>
                <td>{s.write.note}</td>
                <td className="num">{s.write.label}</td>
                <td className="num">{s.write.revision}</td>
                <td><span className={`ads-tag ${s.applied ? "is-info" : ""}`}>{s.applied ? "写入" : "忽略"}</span></td>
                <td className="viz-mono">label={s.row.label}, rev={s.row.revision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ads-funnel" style={{ marginTop: 10 }}>
        <div className={final.label === 1 ? "is-good" : "is-bad"}><small>最终 label（应为 1）</small><b>{final.label}</b></div>
        <div><small>最终 label_revision</small><b>{final.revision}</b></div>
      </div>
      <div className={`viz-narr ${NARR[mode].tone}`}>{NARR[mode].text}</div>
    </VisualizationFrame>
  );
}

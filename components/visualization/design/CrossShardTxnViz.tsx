"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Mode = "2pc" | "saga";
type Row = { who: string; act: string; alice: string; bob: string; lock?: boolean; bad?: boolean; good?: boolean };

const STEPS: Record<Mode, Row[]> = {
  "2pc": [
    { who: "协调者", act: "问两个分片：Alice −5、Bob +5，你们准备好了吗（prepare）", alice: "100（锁住）", bob: "50（锁住）", lock: true },
    { who: "分片 1", act: "Alice 余额够，写好日志，回答“可以”", alice: "100（锁住）", bob: "50（锁住）", lock: true },
    { who: "分片 2", act: "Bob 的账户被冻结，回答“不行”", alice: "100（锁住）", bob: "50（锁住）", lock: true, bad: true },
    { who: "协调者", act: "有人说不行，通知所有人回滚（abort），释放锁", alice: "100", bob: "50", good: true },
  ],
  saga: [
    { who: "步骤 1", act: "分片 1 扣 Alice 5 元，本地事务直接提交", alice: "95", bob: "50" },
    { who: "步骤 2", act: "分片 2 给 Bob 加 5 元：失败，账户被冻结", alice: "95", bob: "50", bad: true },
    { who: "补偿 1", act: "执行步骤 1 的反向操作：给 Alice 退回 5 元", alice: "100", bob: "50", good: true },
  ],
};

const NARR: Record<Mode, string[]> = {
  "2pc": [
    "两阶段提交（2PC）：第一阶段，协调者先问所有参与的分片“能不能做”，能做的分片把要改的行锁住，但先不真正提交。",
    "分片 1 准备好了。注意它从现在开始一直锁着 Alice 的账户，别人改不了，要等协调者的最终决定。",
    "分片 2 不行。只要有一个说不行，整个事务就不能提交。",
    "第二阶段：协调者通知所有人回滚，两边余额都没变，锁才释放。结果是强一致的。代价写在这：整个过程中两边都被锁着，慢；协调者如果在第二阶段之前挂了，所有分片会一直锁着等它，很脆弱。",
  ],
  saga: [
    "Saga：不加全局锁，把大事务拆成一串本地事务，每一步自己提交。步骤 1 已经提交，Alice 现在是 95。",
    "步骤 2 失败了。此时 Alice 少了 5 元、Bob 没多 5 元，钱暂时“不见了”，这个中间状态别人是能看到的。",
    "补偿：对已经完成的每一步，按相反顺序执行它的反向操作。给 Alice 退回 5 元，最终两边都恢复。Saga 快、不锁，代价是中间有一段不一致，而且每一步都要设计好补偿操作（退款、取消订单、释放库存）。",
  ],
};

export default function CrossShardTxnViz() {
  const [mode, setMode] = useState<Mode>("2pc");
  const [i, setI] = useState(0);
  const rows = STEPS[mode];
  const cur = rows[i];
  return (
    <VisualizationFrame
      title="跨分片转账：Alice 给 Bob 转 5 元，两人在不同分片上"
      description="Alice 在分片 1，Bob 在分片 2。这次 Bob 那边会失败。比较两种保证一致性的做法。"
    >
      <div className="viz-chips" role="group" aria-label="方案" style={{ marginBottom: 10 }}>
        {([["2pc", "两阶段提交（2PC）"], ["saga", "Saga（补偿）"]] as [Mode, string][]).map(([k, l]) => (
          <button key={k} type="button" className={`viz-chip${mode === k ? " is-on" : ""}`} onClick={() => { setMode(k); setI(0); }}>{l}</button>
        ))}
      </div>
      <div className="viz-controls">
        <button type="button" className="viz-btn" disabled={i === 0} onClick={() => setI(i - 1)}>← 上一步</button>
        <span className="viz-mono">第 {i + 1} / {rows.length} 步</span>
        <button type="button" className="viz-btn primary" disabled={i === rows.length - 1} onClick={() => setI(i + 1)}>下一步 →</button>
      </div>
      <table className="viz-table">
        <thead><tr><th>谁</th><th>做了什么</th><th className="num">分片 1：Alice</th><th className="num">分片 2：Bob</th></tr></thead>
        <tbody>
          {rows.slice(0, i + 1).map((r, k) => (
            <tr key={k} style={k === i ? { background: "#fdf9e9" } : undefined}>
              <td>{r.who}</td>
              <td style={{ color: r.bad ? "#d03b3b" : r.good ? "#0b7a4b" : undefined }}>{r.act}</td>
              <td className="num" style={{ color: r.lock ? "#8a6d00" : r.alice !== "100" ? "#d03b3b" : undefined }}>{r.alice}</td>
              <td className="num" style={{ color: r.lock ? "#8a6d00" : undefined }}>{r.bob}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`viz-narr${cur.bad ? " is-bad" : cur.good ? " is-good" : cur.lock ? " is-warn" : ""}`}>{NARR[mode][i]}</div>
    </VisualizationFrame>
  );
}

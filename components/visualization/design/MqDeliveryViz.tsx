"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Tab = "semantics" | "groups" | "dlq";
type Mode = "most" | "least" | "exactly";

const MODES: Record<Mode, { name: string; steps: string[]; crashAfter: number; result: string; count: number; narr: string; tone: string }> = {
  most: {
    name: "At most once（至多一次）",
    steps: ["从队列取到消息", "先告诉队列“收到了”（ack）", "再去扣款"],
    crashAfter: 1,
    result: "扣款 0 次：消息丢了",
    count: 0,
    narr: "先 ack 再处理。ack 之后、扣款之前崩了：队列以为你处理完了，不会再发；你其实没扣。消息永远丢了。好处是绝不会重复，适合丢一条无所谓的数据，比如监控指标、日志采样。",
    tone: "is-bad",
  },
  least: {
    name: "At least once（至少一次）",
    steps: ["从队列取到消息", "先去扣款", "再告诉队列“收到了”（ack）"],
    crashAfter: 1,
    result: "扣款 2 次：消息重复了",
    count: 2,
    narr: "先处理再 ack。扣款之后、ack 之前崩了：队列没收到 ack，过一会儿把同一条消息重新投给你，你又扣了一次。好处是绝不会丢，代价是可能重复。这是最常用的模式，配合消费端的幂等（记住处理过的消息 ID）来去重。",
    tone: "is-warn",
  },
  exactly: {
    name: "Exactly once（恰好一次）",
    steps: ["从队列取到消息", "扣款，并在同一个事务里记下“消息 m7 已处理”", "告诉队列“收到了”（ack）"],
    crashAfter: 1,
    result: "扣款 1 次：重投的那次被识别出来跳过",
    count: 1,
    narr: "还是会在 ack 前崩，队列还是会重投。区别是扣款和“记下 m7 已处理”在同一个数据库事务里完成：重投来了，一查 m7 处理过，直接 ack 跳过。所以“恰好一次”不是队列单方面做到的，而是“至少一次投递 + 消费端幂等”。Kafka 的 exactly-once 也是在这个思路上用事务实现的。",
    tone: "is-good",
  },
};

const MSGS = [
  { id: "m1", key: "user-7" }, { id: "m2", key: "user-3" }, { id: "m3", key: "user-7" }, { id: "m4", key: "user-9" },
  { id: "m5", key: "user-3" }, { id: "m6", key: "user-1" }, { id: "m7", key: "user-7" }, { id: "m8", key: "user-9" },
];
const PART = (key: string) => [...key].reduce((a, c) => a + c.charCodeAt(0), 0) % 3;
const PCOLOR = ["#2a78d6", "#eb6834", "#1baf7a"];

export default function MqDeliveryViz() {
  const [tab, setTab] = useState<Tab>("semantics");
  const [mode, setMode] = useState<Mode>("least");
  const [crash, setCrash] = useState(false);
  const [consumers, setConsumers] = useState(2);
  const [retry, setRetry] = useState(0);
  const m = MODES[mode];

  const assign = (p: number) => (consumers === 0 ? -1 : p % consumers);
  const idle = Math.max(0, consumers - 3);

  return (
    <VisualizationFrame
      title="消息队列的三件事：投递语义、分区与消费组、失败与死信"
      description="切换上面的标签。每个标签下面有自己的控件。"
    >
      <div className="viz-chips" role="tablist" style={{ marginBottom: 12 }}>
        {([["semantics", "投递语义"], ["groups", "分区与消费组"], ["dlq", "失败与死信"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`viz-chip${tab === k ? " is-on" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "semantics" && (
        <>
          <div className="viz-controls">
            <div className="viz-chips" role="group" aria-label="投递语义">
              {(Object.keys(MODES) as Mode[]).map((k) => (
                <button key={k} type="button" className={`viz-chip${mode === k ? " is-on" : ""}`} onClick={() => { setMode(k); setCrash(false); }}>{MODES[k].name}</button>
              ))}
            </div>
            <button type="button" className={`viz-btn${crash ? " is-on" : ""}`} onClick={() => setCrash(!crash)}>{crash ? "撤销崩溃" : "第 2 步之后消费者崩了"}</button>
          </div>
          <div className="viz-panel">
            <h5>消费者处理“给 user-7 扣 5 元”这条消息</h5>
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
              {m.steps.map((s, i) => (
                <li key={s} style={{ color: crash && i > m.crashAfter ? "#a8a693" : "#30332c", textDecoration: crash && i > m.crashAfter ? "line-through" : undefined }}>
                  {s}
                  {crash && i === m.crashAfter && <b style={{ color: "#d03b3b", marginLeft: 8 }}>✕ 这里崩了</b>}
                </li>
              ))}
              {crash && <li style={{ color: "#76796f" }}>重启后：{mode === "most" ? "队列认为已经 ack，不再投递" : "队列没收到 ack，重新投递同一条消息"}</li>}
            </ol>
            <p style={{ marginTop: 10 }}>结果：<b style={{ color: !crash ? "#30332c" : m.count === 1 ? "#0b7a4b" : "#d03b3b" }}>{crash ? m.result : "没崩的时候三种模式都只扣 1 次"}</b></p>
          </div>
          <div className={`viz-narr${crash ? ` ${m.tone}` : ""}`}>{crash ? m.narr : "三种模式在一切正常时没有区别，差别全在“崩在哪一步”。点右边的按钮让消费者在第 2 步之后崩掉。"}</div>
        </>
      )}

      {tab === "groups" && (
        <>
          <div className="viz-controls">
            <label><span className="viz-k">组 A 的消费者数</span><input type="range" min={1} max={5} value={consumers} onChange={(e) => setConsumers(Number(e.target.value))} /><span className="viz-mono">{consumers}</span></label>
          </div>
          <div className="viz-grid2">
            <div className="viz-panel">
              <h5>一个 topic，3 个分区（partition key = 用户 ID）</h5>
              {[0, 1, 2].map((p) => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span className="viz-mono" style={{ width: 28, color: PCOLOR[p] }}>P{p}</span>
                  {MSGS.filter((x) => PART(x.key) === p).map((x) => (
                    <span key={x.id} className="viz-mono" style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: PCOLOR[p], color: "#fff" }}>{x.id} {x.key}</span>
                  ))}
                </div>
              ))}
              <p className="viz-k" style={{ marginTop: 6 }}>同一个用户的消息永远进同一个分区，所以同一个用户的消息之间有顺序；不同分区之间没有顺序。</p>
            </div>
            <div className="viz-panel">
              <h5>谁在读哪个分区</h5>
              <p style={{ marginBottom: 6 }}><b>组 A（训练数据）</b></p>
              {Array.from({ length: consumers }, (_, c) => {
                const parts = [0, 1, 2].filter((p) => assign(p) === c);
                return <div key={c} className="viz-mono" style={{ fontSize: 12 }}>消费者 A{c + 1}：{parts.length ? parts.map((p) => `P${p}`).join("、") : <span style={{ color: "#d03b3b" }}>闲着，没有分区可读</span>}</div>;
              })}
              <p style={{ margin: "10px 0 6px" }}><b>组 B（监控）</b></p>
              <div className="viz-mono" style={{ fontSize: 12 }}>消费者 B1：P0、P1、P2（全部，自己记自己的 offset）</div>
            </div>
          </div>
          <div className={`viz-narr${idle ? " is-warn" : ""}`}>
            {idle
              ? `组 A 有 ${consumers} 个消费者，但只有 3 个分区。一个分区同一时刻只能被组里的一个消费者读，多出来的 ${idle} 个只能闲着。所以分区数是一个组并行度的上限：想加速消费，得先加分区。`
              : `一个分区同一时刻只分给组里的一个消费者，这样同一分区里的消息按顺序处理。组 A 有 ${consumers} 个消费者，3 个分区分给他们，并行度是 ${Math.min(consumers, 3)}。组 B 是另一个消费组，和 A 互不影响，各自从头读一遍全部消息。拖动滑块看消费者多于分区时会怎样。`}
          </div>
        </>
      )}

      {tab === "dlq" && (
        <>
          <div className="viz-controls">
            <button type="button" className="viz-btn primary" disabled={retry >= 4} onClick={() => setRetry(retry + 1)}>{retry === 0 ? "处理 m5" : retry < 3 ? "再试一次" : "第 3 次也失败了"}</button>
            <button type="button" className="viz-btn" onClick={() => setRetry(0)}>重置</button>
          </div>
          <div className="viz-grid2">
            <div className="viz-panel">
              <h5>主队列</h5>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["m5", "m6", "m7", "m8"].map((x) => (
                  <span key={x} className="viz-mono" style={{ fontSize: 12, padding: "3px 8px", borderRadius: 4, background: x === "m5" && retry >= 4 ? "#f3f1e8" : x === "m5" ? "#fdf3e3" : "#2a78d6", color: x === "m5" && retry >= 4 ? "#c9c4ad" : x === "m5" ? "#8a6d00" : "#fff", border: x === "m5" && retry > 0 && retry < 4 ? "1px solid #eda100" : "1px solid transparent" }}>{x === "m5" && retry >= 4 ? "（已移走）" : x}</span>
                ))}
              </div>
              <p className="viz-k" style={{ marginTop: 8 }}>{retry === 0 ? "m5 是一条坏消息：字段缺失，怎么处理都会抛异常。" : retry < 4 ? `m5 第 ${retry} 次失败，放回去等一会儿再试。m6、m7、m8 ${retry >= 2 ? "被它堵在后面" : "在等"}。` : "m5 移走后，后面的消息继续正常处理。"}</p>
            </div>
            <div className="viz-panel">
              <h5>死信队列（DLQ）</h5>
              {retry >= 4 ? <span className="viz-mono" style={{ fontSize: 12, padding: "3px 8px", borderRadius: 4, background: "#d03b3b", color: "#fff" }}>m5（失败 3 次）</span> : <span className="viz-k">空</span>}
              <p className="viz-k" style={{ marginTop: 8 }}>{retry >= 4 ? "工程师之后来看它为什么失败，修好代码后可以把它放回主队列重放。" : "重试超过上限的消息会被移到这里。"}</p>
            </div>
          </div>
          <div className={`viz-narr${retry >= 4 ? " is-good" : retry > 0 ? " is-warn" : ""}`}>
            {retry === 0 ? "有些消息永远处理不了：格式坏了、引用的数据被删了。如果无限重试，它会一直堵在队列头上。点“处理 m5”。" : retry < 4 ? "失败就重试，通常带退避。但这条消息本身是坏的，重试多少次都一样，而它后面的消息全被拖住。" : "重试 n 次仍然失败，就把它移到一个单独的死信队列，主队列继续往下走。死信队列要有告警，否则坏消息会悄悄堆满没人管。"}
          </div>
        </>
      )}
    </VisualizationFrame>
  );
}

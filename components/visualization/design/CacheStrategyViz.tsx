"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Pattern = "aside" | "readthrough" | "writethrough" | "writebehind";
type Action = "none" | "read" | "write" | "crash";
type Scene = { steps: string[]; cache: string; db: string; narr: string; tone?: string };

const PATTERNS: Record<Pattern, { name: string; who: string }> = {
  aside: { name: "Cache-aside", who: "应用自己管缓存" },
  readthrough: { name: "Read-through", who: "缓存替应用去读数据库" },
  writethrough: { name: "Write-through", who: "写缓存，缓存同步写数据库" },
  writebehind: { name: "Write-behind", who: "写缓存，缓存稍后异步写数据库" },
};

const SCENES: Record<Pattern, Record<Action, Scene>> = {
  aside: {
    none: { steps: [], cache: "空", db: "x = 1", narr: "最常见的模式：缓存只是应用旁边的一个字典，应用自己决定什么时候读它、什么时候填它。点“读 x”。" },
    read: { steps: ["应用查缓存：没有（miss）", "应用自己去查数据库：x = 1", "应用把 x = 1 写进缓存", "下次再读：缓存直接命中"], cache: "x = 1", db: "x = 1", narr: "第一次读 miss，应用自己回源数据库，再顺手填进缓存。数据库是唯一的真相，缓存只是加速。缓存挂了，应用直接读数据库，慢一点但不出错。" },
    write: { steps: ["应用写数据库：x = 2", "应用删掉缓存里的 x（不是改成 2）", "下次读 miss，从数据库读到 2 再填回"], cache: "已删除", db: "x = 2", narr: "写的时候先写数据库，再删缓存。为什么是删不是改？两个请求同时改时，“改缓存”的顺序可能和“改数据库”的顺序不一样，缓存会留下旧值；删掉让下一次读自己去拿最新的，最省心。", tone: "is-good" },
    crash: { steps: ["缓存节点挂了", "应用发现连不上缓存，直接读数据库", "数据库压力变大，但数据不会错"], cache: "挂了", db: "x = 2", narr: "缓存挂了只影响速度，不影响正确性，因为真相一直在数据库里。这是 cache-aside 被用得最多的原因。", tone: "is-good" },
  },
  readthrough: {
    none: { steps: [], cache: "空", db: "x = 1", narr: "Read-through 把“miss 了去数据库读”这件事交给缓存层自己做，应用永远只跟缓存说话。点“读 x”。" },
    read: { steps: ["应用问缓存要 x", "缓存没有，缓存自己去数据库读 x = 1", "缓存存下来，返回给应用"], cache: "x = 1", db: "x = 1", narr: "和 cache-aside 读的步骤一样，区别是谁来做：这里是缓存库或者缓存服务替应用回源。应用代码更简单，但缓存层要知道怎么读数据库。", tone: "is-good" },
    write: { steps: ["Read-through 只管读", "写通常配合 write-through 或者直接写库再失效缓存"], cache: "x = 1", db: "x = 2", narr: "Read-through 只解决读的问题。写的时候一般和 write-through 搭配，或者像 cache-aside 那样写库后删缓存。" },
    crash: { steps: ["缓存层挂了", "应用只认识缓存，读请求全部失败"], cache: "挂了", db: "x = 1", narr: "应用把缓存当成了数据入口，缓存挂了读也就挂了，除非应用另外写了直连数据库的兜底。", tone: "is-bad" },
  },
  writethrough: {
    none: { steps: [], cache: "x = 1", db: "x = 1", narr: "Write-through：写的时候写缓存，缓存同步写数据库，两边都写成功才返回。点“写 x = 2”。" },
    read: { steps: ["应用读缓存：命中 x = 1", "缓存一直和数据库一致，读起来总是新的"], cache: "x = 1", db: "x = 1", narr: "因为每次写都同步更新了缓存，读几乎总是命中，而且读到的就是最新值。" },
    write: { steps: ["应用写缓存：x = 2", "缓存同步写数据库：x = 2", "两边都成功，才告诉应用“写好了”"], cache: "x = 2", db: "x = 2", narr: "缓存和数据库立刻一致。代价是每次写都要等两个地方都写完，写变慢；而且很多写进缓存的数据可能根本没人读，白白占地方。适合读多写少、要求读到最新的数据。", tone: "is-good" },
    crash: { steps: ["写到一半缓存挂了", "数据库那一步没执行，应用收到失败", "应用重试，数据不丢"], cache: "挂了", db: "x = 1", narr: "同步写的好处：没写完就不会说成功，所以不会丢数据。坏处是缓存挂了写也跟着失败。" },
  },
  writebehind: {
    none: { steps: [], cache: "x = 1", db: "x = 1", narr: "Write-behind（也叫 write-back）：写进缓存就立刻返回，缓存攒一批再异步刷进数据库。点“写 x = 2”。" },
    read: { steps: ["应用读缓存：命中最新值", "数据库里可能还是旧的，但应用只读缓存"], cache: "x = 2", db: "x = 1", narr: "读的人从缓存拿到的是最新值。但如果有别的系统直接查数据库，会看到旧的。" },
    write: { steps: ["应用写缓存：x = 2，立刻返回", "缓存过几百毫秒，把攒的一批写一次性刷进数据库"], cache: "x = 2", db: "x = 1（稍后变 2）", narr: "写非常快，数据库的写压力也被合并成批量写。适合写特别多、丢一点也能接受的数据，比如浏览计数、指标、分析数据。", tone: "is-good" },
    crash: { steps: ["应用写缓存：x = 2，已返回成功", "还没来得及刷进数据库，缓存挂了", "x = 2 永远丢了，数据库里还是 1"], cache: "挂了", db: "x = 1", narr: "这就是 write-behind 的代价：已经告诉用户“成功了”的数据，可能因为缓存挂掉而丢失。所以订单、支付这种数据绝不用它。", tone: "is-bad" },
  },
};

function Box({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0, border: `1.5px solid ${bad ? "#d03b3b" : "#e4dfcb"}`, borderRadius: 8, background: bad ? "#f5e3e3" : "#fff", padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#76796f" }}>{label}</div>
      <div className="viz-mono" style={{ fontSize: 13, fontWeight: 600, color: bad ? "#d03b3b" : "#30332c" }}>{value}</div>
    </div>
  );
}

export default function CacheStrategyViz() {
  const [pattern, setPattern] = useState<Pattern>("aside");
  const [action, setAction] = useState<Action>("none");
  const s = SCENES[pattern][action];
  return (
    <VisualizationFrame
      title="四种缓存模式：读一次、写一次、缓存挂了"
      description="先选一种模式，再依次点三个按钮。上面三个框是应用、缓存、数据库此刻的状态。"
    >
      <div className="viz-chips" role="group" aria-label="缓存模式" style={{ marginBottom: 10 }}>
        {(Object.keys(PATTERNS) as Pattern[]).map((k) => (
          <button key={k} type="button" className={`viz-chip${pattern === k ? " is-on" : ""}`} onClick={() => { setPattern(k); setAction("none"); }}>{PATTERNS[k].name}</button>
        ))}
      </div>
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "read" ? " is-on" : ""}`} onClick={() => setAction("read")}>读 x</button>
        <button type="button" className={`viz-btn${action === "write" ? " is-on" : ""}`} onClick={() => setAction("write")}>写 x = 2</button>
        <button type="button" className={`viz-btn${action === "crash" ? " is-on" : ""}`} onClick={() => setAction("crash")}>缓存挂了</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
        <span className="viz-k">{PATTERNS[pattern].who}</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <Box label="应用" value="app" />
        <span style={{ color: "#c9c4ad" }}>⇄</span>
        <Box label="缓存（Redis）" value={s.cache} bad={s.cache === "挂了"} />
        <span style={{ color: "#c9c4ad" }}>⇄</span>
        <Box label="数据库" value={s.db} />
      </div>
      {s.steps.length > 0 && (
        <div className="viz-panel">
          <h5>发生了什么</h5>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
            {s.steps.map((x) => <li key={x}>{x}</li>)}
          </ol>
        </div>
      )}
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Role = "system" | "user" | "assistant" | "tool";
type Kind = "fixed" | "user" | "assistant" | "tool_result";
type Msg = { id: string; role: Role; kind: Kind; label: string; tokens: number };
type NodeId = "assemble" | "model" | "decide" | "gate" | "execute" | "append" | "budget" | "stop";
type Step = { node: NodeId; narr: string; add?: Msg; tone?: "good" | "bad" | "warn"; call?: number };

const BASE: Msg[] = [
  { id: "sys", role: "system", kind: "fixed", label: "系统提示：角色、环境、规则", tokens: 1200 },
  { id: "mem", role: "system", kind: "fixed", label: "CLAUDE.md / AGENTS.md 项目约定", tokens: 600 },
  { id: "schema", role: "system", kind: "fixed", label: "工具定义（Read / Edit / Bash …）的 JSON schema", tokens: 3500 },
  { id: "u1", role: "user", kind: "user", label: "tests/test_dates.py 挂了，修一下", tokens: 40 },
];

type Call = { tool?: string; thought: string; use: Msg; result?: Msg };

const CALLS: Call[] = [
  {
    tool: "Bash",
    thought: "第 1 次调用：模型读完上下文，决定先跑测试看失败信息，于是返回一个 tool_use，而不是文字。",
    use: { id: "a1", role: "assistant", kind: "assistant", label: "tool_use · Bash(pytest tests/test_dates.py -x)", tokens: 60 },
    result: { id: "r1", role: "tool", kind: "tool_result", label: "FAILED test_leap_year：2000-02-29 被判为无效日期", tokens: 420 },
  },
  {
    tool: "Read",
    thought: "第 2 次调用：模型看到失败信息，想看源码。它看到的上下文已经比第 1 次多了一段测试输出。",
    use: { id: "a2", role: "assistant", kind: "assistant", label: "tool_use · Read(src/dates.py)", tokens: 40 },
    result: { id: "r2", role: "tool", kind: "tool_result", label: "src/dates.py 全文（88 行）", tokens: 1800 },
  },
  {
    tool: "Edit",
    thought: "第 3 次调用：找到原因，发出 Edit。注意模型只是生成了一段 old / new 字符串，真正改文件的是 harness。",
    use: { id: "a3", role: "assistant", kind: "assistant", label: "tool_use · Edit(src/dates.py)：补上 year % 400 == 0 分支", tokens: 180 },
    result: { id: "r3", role: "tool", kind: "tool_result", label: "已替换 1 处", tokens: 30 },
  },
  {
    tool: "Bash",
    thought: "第 4 次调用：改完再跑一次测试确认。这一步是模型自己选择的验证，不是 harness 强制的。",
    use: { id: "a4", role: "assistant", kind: "assistant", label: "tool_use · Bash(pytest tests/test_dates.py -x)", tokens: 60 },
    result: { id: "r4", role: "tool", kind: "tool_result", label: "1 passed in 0.12s", tokens: 90 },
  },
  {
    thought: "第 5 次调用：测试通过，模型写总结，这次回复里没有任何 tool_use。",
    use: { id: "a5", role: "assistant", kind: "assistant", label: "文本回复：已修复，is_leap_year 少了被 400 整除的分支", tokens: 150 },
  },
];

function buildSteps(maxTurns: number): Step[] {
  const steps: Step[] = [
    { node: "assemble", narr: "harness 把系统提示、项目约定、工具 schema 和用户消息拼成一次请求。到这里模型还没出场：它看到的永远只是这一串消息。" },
  ];
  CALLS.forEach((call, index) => {
    const n = index + 1;
    if (steps.some((step) => step.node === "budget" || step.node === "stop")) return;
    if (n > maxTurns) {
      steps.push({
        node: "budget",
        tone: "bad",
        narr: `第 ${n} 次调用前预算检查失败：max_turns = ${maxTurns}。harness 终止循环并返回 error_max_turns。任务没完成，但也不会无限烧钱，这是循环唯一的硬刹车。`,
      });
      return;
    }
    steps.push({ node: "model", call: n, add: call.use, narr: call.thought });
    if (call.result) {
      steps.push({ node: "decide", call: n, narr: "回复里带 tool_use，于是走执行分支。模型自己不能运行任何东西，它只是在“请求”。" });
      steps.push({ node: "gate", call: n, narr: `执行前，harness 先过一遍权限规则和 PreToolUse hook（下一篇细讲）。这次 ${call.tool} 被放行。` });
      steps.push({ node: "execute", call: n, narr: `harness 真的去运行 ${call.tool}。这一步发生在模型之外：进程、文件系统、网络都在这里。` });
      steps.push({
        node: "append",
        call: n,
        add: call.result,
        narr: `输出作为 tool_result 追加到消息列表，占 ${call.result.tokens} token。工具输出是上下文增长的主要来源。然后回到循环顶端，再调一次模型。`,
      });
    } else {
      steps.push({ node: "decide", call: n, narr: "这次回复里没有 tool_use。" });
      steps.push({ node: "stop", call: n, tone: "good", narr: "没有工具调用 = 模型认为任务完成。harness 把文本返回给用户，循环结束。整个 agent 的骨架就是这一个 while 循环。" });
    }
  });
  return steps;
}

const KIND_COLOR: Record<Kind, string> = { fixed: "var(--vfixed)", user: "var(--v3)", assistant: "var(--v1)", tool_result: "var(--v2)" };
const KIND_LABEL: Record<Kind, string> = { fixed: "固定部分（系统提示 + 约定 + 工具 schema）", user: "用户消息", assistant: "模型输出", tool_result: "工具输出" };
const FINAL_TOTAL = BASE.reduce((sum, m) => sum + m.tokens, 0) + CALLS.reduce((sum, c) => sum + c.use.tokens + (c.result?.tokens ?? 0), 0);

type NodeSpec = { id: NodeId; x: number; y: number; w: number; label: string };
const NODES: NodeSpec[] = [
  { id: "assemble", x: 16, y: 12, w: 150, label: "组装上下文" },
  { id: "model", x: 16, y: 72, w: 150, label: "调用模型" },
  { id: "decide", x: 16, y: 132, w: 150, label: "回复里有 tool_use？" },
  { id: "stop", x: 206, y: 132, w: 140, label: "返回回复 · 停止" },
  { id: "gate", x: 16, y: 192, w: 150, label: "权限 / Hook 闸门" },
  { id: "execute", x: 16, y: 252, w: 150, label: "执行工具" },
  { id: "append", x: 206, y: 252, w: 140, label: "追加 tool_result" },
  { id: "budget", x: 206, y: 192, w: 140, label: "迭代 < max_turns？" },
];

function LoopDiagram({ current, tone }: { current: NodeId; tone?: Step["tone"] }) {
  const fill = (id: NodeId) => {
    if (id !== current) return "#fff";
    if (tone === "bad") return "var(--vcrit)";
    if (tone === "good") return "var(--vgood)";
    return "var(--v1)";
  };
  return (
    <svg viewBox="0 0 360 300" role="img" aria-label="agent 循环流程图：组装上下文，调用模型，判断回复里是否有 tool_use；有则经过权限与 Hook 闸门、执行工具、追加 tool_result，再经迭代预算检查回到调用模型；没有则返回回复并停止。">
      <defs>
        <marker id="loop-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#8e8d78" />
        </marker>
      </defs>
      <g fill="none" stroke="#8e8d78" strokeWidth="1.3" markerEnd="url(#loop-arrow)">
        <path d="M91,46 V70" />
        <path d="M91,106 V130" />
        <path d="M91,166 V190" />
        <path d="M91,226 V250" />
        <path d="M166,149 H204" />
        <path d="M166,269 H204" />
        <path d="M276,250 V228" />
        <path d="M276,190 V89 H168" />
      </g>
      <g fontSize="10" fill="#8e8d78">
        <text x="172" y="144">否</text>
        <text x="96" y="182">是</text>
        <text x="282" y="241">是</text>
        <text x="284" y="112">回到循环顶端</text>
      </g>
      {NODES.map((node) => {
        const isCurrent = node.id === current;
        const strokeColor = isCurrent ? fill(node.id) : node.id === "stop" || node.id === "budget" ? "#c9c4ad" : "#a9a58f";
        return (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width={node.w} height="34" rx={node.id === "decide" || node.id === "budget" ? 17 : 5} fill={fill(node.id)} stroke={strokeColor} strokeWidth={isCurrent ? 2 : 1.2} />
            <text x={node.x + node.w / 2} y={node.y + 21} textAnchor="middle" fontSize="12" fontWeight={isCurrent ? 600 : 500} fill={isCurrent ? "#fff" : "#30332c"}>{node.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function AgentLoopSim() {
  const [maxTurns, setMaxTurns] = useState(6);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const steps = useMemo(() => buildSteps(maxTurns), [maxTurns]);
  const atEnd = i >= steps.length - 1;
  const isPlaying = playing && !atEnd;

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => setI((v) => Math.min(v + 1, steps.length - 1)), 1100);
    return () => window.clearTimeout(timer);
  }, [isPlaying, i, steps.length]);

  const step = steps[i];
  const messages = useMemo(() => {
    const added = steps.slice(0, i + 1).flatMap((s) => (s.add ? [s.add] : []));
    return [...BASE, ...added];
  }, [steps, i]);
  const newId = step.add?.id;
  const totals = (["fixed", "user", "assistant", "tool_result"] as Kind[]).map((kind) => ({ kind, tokens: messages.filter((m) => m.kind === kind).reduce((sum, m) => sum + m.tokens, 0) }));
  const total = totals.reduce((sum, t) => sum + t.tokens, 0);
  const callNo = step.call ?? (step.node === "budget" ? maxTurns + 1 : 0);

  const reset = () => { setI(0); setPlaying(false); };

  return (
    <VisualizationFrame
      title="一次完整的 agent 循环"
      description="任务：修一个失败的测试。按步骤看 harness 怎样把消息列表交给模型、把模型的 tool_use 变成真实动作、再把结果塞回列表，直到模型不再调用工具。"
      footnote={<>token 数是示意值，但比例接近真实情况：固定部分（尤其是工具 schema）在第一轮就很大，之后的增长几乎全来自工具输出。把 max_turns 调到 4 以下，看看预算刹车长什么样。</>}
    >
      <div className="viz-controls">
        <button className="viz-btn" onClick={() => { setPlaying(false); setI((v) => Math.max(v - 1, 0)); }} disabled={i === 0}>上一步</button>
        <button className="viz-btn primary" onClick={() => { setPlaying(false); setI((v) => Math.min(v + 1, steps.length - 1)); }} disabled={atEnd}>下一步</button>
        <button className={`viz-btn${isPlaying ? " is-on" : ""}`} onClick={() => { if (atEnd) setI(0); setPlaying(!isPlaying); }}>{isPlaying ? "暂停" : "播放"}</button>
        <button className="viz-btn" onClick={reset}>重置</button>
        <label>
          <span className="viz-k">max_turns</span>
          <input type="range" min={1} max={6} value={maxTurns} onChange={(e) => { setMaxTurns(Number(e.target.value)); setI(0); setPlaying(false); }} />
          <span className="viz-mono">{maxTurns}</span>
        </label>
        <span className="viz-k">步骤 {i + 1} / {steps.length}{callNo > 0 ? ` · 第 ${Math.min(callNo, maxTurns)} 次调用` : ""}</span>
      </div>
      <div className="viz-grid2">
        <div className="viz-panel">
          <h5>循环状态机</h5>
          <LoopDiagram current={step.node} tone={step.tone} />
        </div>
        <div className="viz-panel">
          <h5>模型看到的消息列表 · {messages.length} 条</h5>
          <ul className="viz-msgs">
            {messages.map((m) => (
              <li key={m.id} className={`viz-msg${m.id === newId ? " is-new" : ""}`}>
                <span className="role">{m.role}</span>
                <span>{m.label}</span>
                <span className="tok">{m.tokens.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={`viz-narr${step.tone === "bad" ? " is-bad" : step.tone === "good" ? " is-good" : ""}`}>{step.narr}</div>
      <div className="viz-panel" style={{ marginTop: 14 }}>
        <h5>上下文占用 · {total.toLocaleString()} tokens</h5>
        <div className="viz-stack" role="img" aria-label={`上下文共 ${total} token：${totals.map((t) => `${KIND_LABEL[t.kind]} ${t.tokens}`).join("，")}`}>
          {totals.map((t) => t.tokens > 0 && <span key={t.kind} style={{ width: `${(t.tokens / FINAL_TOTAL) * 100}%`, background: KIND_COLOR[t.kind] }} />)}
        </div>
        <div className="viz-legend">
          {totals.map((t) => (
            <span key={t.kind}><i style={{ background: KIND_COLOR[t.kind] }} />{KIND_LABEL[t.kind]} · {t.tokens.toLocaleString()}</span>
          ))}
        </div>
      </div>
    </VisualizationFrame>
  );
}

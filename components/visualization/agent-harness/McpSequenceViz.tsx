"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Lane = "model" | "harness" | "server";
type Step = { from: Lane; to: Lane | null; label: string; narr: string };

const LANE_X: Record<Lane, number> = { model: 70, harness: 240, server: 410 };
const LANE_LABEL: Record<Lane, string> = { model: "模型", harness: "Harness（MCP client）", server: "MCP server · github" };

const STEPS: Step[] = [
  { from: "harness", to: null, label: "读 .mcp.json，启动 github server", narr: "配置写明 server 怎么来：stdio 是 harness 拉起的本地子进程，http 是远程 URL。会话一开始 harness 就连上它。" },
  { from: "harness", to: "server", label: "initialize（协议版本、客户端能力）", narr: "MCP 是一个带握手的协议。双方先交换版本和能力，之后才谈工具。" },
  { from: "server", to: "harness", label: "capabilities：tools · resources · prompts", narr: "server 声明自己提供什么。这篇只看 tools。" },
  { from: "harness", to: "server", label: "tools/list", narr: "harness 问：你有哪些工具？" },
  { from: "server", to: "harness", label: "14 个工具，每个带 JSON schema", narr: "每个工具有名字、描述、参数 schema，和 harness 内置工具的格式一样。" },
  { from: "harness", to: "model", label: "注册为 mcp__github__create_issue 等，进入工具列表", narr: "模型看不出哪个工具是本地的、哪个来自 MCP：都是 tool list 里的一项。工具太多时 harness 可以先只给名字，要用时再载入 schema（tool search）。" },
  { from: "model", to: "harness", label: "tool_use · mcp__github__create_issue {title, body}", narr: "模型像调用本地工具一样发出 tool_use。" },
  { from: "harness", to: null, label: "权限检查：deny → ask → allow，规则如 mcp__github__*", narr: "MCP 工具走同一道闸门。没有 allow 规则就会询问；PreToolUse hook 也照常运行。" },
  { from: "harness", to: "server", label: "tools/call create_issue", narr: "harness 把参数原样转给 server。" },
  { from: "server", to: null, label: "server 调 GitHub API", narr: "真正的副作用发生在 server 进程里。harness 和模型都碰不到 GitHub 的凭证，这是 MCP 的隔离价值。" },
  { from: "server", to: "harness", label: "result：issue #42 已创建", narr: "结果回来。超过上限的输出会被截断或落盘，而不是整段塞进上下文。" },
  { from: "harness", to: "model", label: "tool_result", narr: "回到循环。对模型来说，这和一条 Bash 跑完没有区别。" },
];

const ROW_H = 34;
const TOP = 46;
const HEIGHT = TOP + STEPS.length * ROW_H + 16;

export default function McpSequenceViz() {
  const [i, setI] = useState(0);
  const [servers, setServers] = useState(3);
  const [toolsPer, setToolsPer] = useState(14);
  const [toolSearch, setToolSearch] = useState(true);
  const step = STEPS[i];
  const full = servers * toolsPer * 250;
  const deferred = servers * toolsPer * 20 + 2 * 250;
  const used = toolSearch ? deferred : full;

  return (
    <VisualizationFrame
      title="一个 MCP 工具从接入到被调用"
      description="模型、harness（扮演 MCP client）和一个 GitHub MCP server 之间的时序。按步骤走一遍，再用下面的滑块看“接太多 server”会给上下文带来多大压力。"
      footnote={<>MCP 解决的是“每接一个外部系统都要改 harness 代码”的问题：server 用标准协议描述自己的工具，harness 只需要会说这门协议。代价是每个工具的 schema 都要占上下文，所以才有延迟加载。</>}
    >
      <div className="viz-controls">
        <button className="viz-btn" onClick={() => setI((v) => Math.max(v - 1, 0))} disabled={i === 0}>上一步</button>
        <button className="viz-btn primary" onClick={() => setI((v) => Math.min(v + 1, STEPS.length - 1))} disabled={i === STEPS.length - 1}>下一步</button>
        <button className="viz-btn" onClick={() => setI(0)}>重置</button>
        <span className="viz-k">步骤 {i + 1} / {STEPS.length}</span>
      </div>
      <div className="viz-panel viz-scroll">
        <svg viewBox={`0 0 480 ${HEIGHT}`} role="img" aria-label={`MCP 时序图，当前第 ${i + 1} 步：${step.label}`}>
          <defs>
            <marker id="mcp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
          </defs>
          {(Object.keys(LANE_X) as Lane[]).map((lane) => (
            <g key={lane}>
              <rect x={LANE_X[lane] - 66} y="6" width="132" height="26" rx="5" fill={lane === "harness" ? "#3b4234" : "#fff"} stroke="#a9a58f" />
              <text x={LANE_X[lane]} y="23" textAnchor="middle" fontSize="11.5" fontWeight="600" fill={lane === "harness" ? "#fff" : "#30332c"}>{LANE_LABEL[lane]}</text>
              <line x1={LANE_X[lane]} x2={LANE_X[lane]} y1="34" y2={HEIGHT - 6} stroke="#d9d3bb" strokeDasharray="3 4" />
            </g>
          ))}
          {STEPS.map((s, index) => {
            const y = TOP + index * ROW_H + 18;
            const active = index <= i;
            const isCurrent = index === i;
            const color = isCurrent ? "var(--v1)" : "#6f7266";
            if (s.to === null) {
              return (
                <g key={index} opacity={active ? 1 : 0.22} color={color}>
                  <rect x={LANE_X[s.from] - 90} y={y - 12} width="180" height="24" rx="4" fill={isCurrent ? "#eef5fd" : "#fff"} stroke={color} />
                  <text x={LANE_X[s.from]} y={y + 4} textAnchor="middle" fontSize="10.5" fill="#30332c">{s.label}</text>
                </g>
              );
            }
            const x1 = LANE_X[s.from];
            const x2 = LANE_X[s.to];
            const dir = x2 > x1 ? 1 : -1;
            return (
              <g key={index} opacity={active ? 1 : 0.22} color={color}>
                <line x1={x1} x2={x2 - dir * 4} y1={y} y2={y} stroke={color} strokeWidth={isCurrent ? 2 : 1.3} markerEnd="url(#mcp-arrow)" />
                <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" fontSize="10.5" fill="#30332c">{s.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="viz-narr">{step.narr}</div>
      <div className="viz-panel" style={{ marginTop: 14 }}>
        <h5>接太多工具的代价</h5>
        <div className="viz-controls" style={{ marginBottom: 8 }}>
          <label><span className="viz-k">server 数</span><input type="range" min={1} max={6} value={servers} onChange={(e) => setServers(Number(e.target.value))} /><span className="viz-mono">{servers}</span></label>
          <label><span className="viz-k">每个 server 的工具数</span><input type="range" min={5} max={40} value={toolsPer} onChange={(e) => setToolsPer(Number(e.target.value))} /><span className="viz-mono">{toolsPer}</span></label>
          <label className="viz-check"><input type="checkbox" checked={toolSearch} onChange={(e) => setToolSearch(e.target.checked)} />tool search：先只给名字，用到再载入 schema</label>
        </div>
        <div className="viz-stack" role="img" aria-label={`工具定义占用 ${used} token，约为 200k 窗口的 ${((used / 200000) * 100).toFixed(1)}%`}>
          <span style={{ width: `${Math.min((used / 60000) * 100, 100)}%`, background: toolSearch ? "var(--v3)" : "var(--v2)" }} />
        </div>
        <p className="viz-k" style={{ marginTop: 6 }}>
          {servers * toolsPer} 个工具的定义每次调用都要随请求发出：{toolSearch ? "开启 tool search 后" : "全量加载时"}约 <b>{used.toLocaleString()}</b> token（按每个 schema 250、名字 20 估算），占 200k 窗口的 {((used / 200000) * 100).toFixed(1)}%。{!toolSearch && full > 20000 ? "这些 token 在模型做任何事之前就已经花掉了，而且大部分工具这次根本用不上。" : ""}
        </p>
      </div>
    </VisualizationFrame>
  );
}

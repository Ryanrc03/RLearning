"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Layer = { id: string; title: string; items: string; what: string; without: string; cc: string; hermes: string };

const LAYERS: Layer[] = [
  {
    id: "context",
    title: "上下文组装",
    items: "系统提示 · CLAUDE.md / AGENTS.md · 记忆 · 对话历史 · 压缩",
    what: "决定模型每一次调用“看见什么”。harness 把固定的系统提示、项目约定文件、长期记忆和到目前为止的消息拼成一次请求；上下文快满时做压缩，把旧消息换成摘要。",
    without: "模型每次都从零开始，不知道项目约定，也记不住上一轮做过什么；或者上下文无限增长直到请求失败。",
    cc: "CLAUDE.md 按目录层级拼接；上下文接近上限时自动压缩，前后有 PreCompact / PostCompact hook。",
    hermes: "context_engine 与 context_compressor；SOUL.md、memories/ 目录。",
  },
  {
    id: "loop",
    title: "循环与预算",
    items: "while 有 tool_use → 执行 · max_turns · 费用上限 · 超时",
    what: "agent 的骨架：调用模型，有 tool_use 就执行并把结果追加回去，直到模型不再调用工具。预算（最大轮数、费用、时间）是这个循环唯一的硬刹车。",
    without: "要么模型答一句就停（退化成聊天机器人），要么卡在死循环里反复重试同一个失败的命令。",
    cc: "headless 模式的 --max-turns；Agent SDK 的 maxTurns 与 maxBudgetUsd。",
    hermes: "run_conversation() 里的 while 循环，max_iterations 默认 90。",
  },
  {
    id: "tools",
    title: "工具层",
    items: "工具注册表 · JSON schema · Read / Edit / Bash / WebFetch …",
    what: "把“能做的事”描述成模型可读的 schema，再把模型返回的 tool_use 翻译成真实的函数调用、子进程或 HTTP 请求。",
    without: "模型只能生成文本，所有动作都要人来复制粘贴执行。",
    cc: "内置工具与 MCP 工具进入同一个 tool list；工具很多时用 tool search 延迟加载 schema。",
    hermes: "tools/*.py 在 import 时向 registry.register() 登记，toolsets 决定哪些对模型可见。",
  },
  {
    id: "gate",
    title: "闸门",
    items: "权限模式 · allow / ask / deny 规则 · Hook",
    what: "在“模型想做”和“真的做了”之间插一层策略：按规则放行、询问或拒绝，并允许用脚本在工具调用前后介入。",
    without: "模型读到的任何一段文本（网页、issue、日志）都可能让它执行 rm -rf 或推送到生产分支。",
    cc: "permissions.allow / ask / deny；PreToolUse、PostToolUse、Stop 等 hook 事件。",
    hermes: "tools/approval.py 的危险命令审批；shell_hooks 兼容 Claude Code 风格的 JSON 决定。",
  },
  {
    id: "ext",
    title: "扩展",
    items: "Subagent · Skill · MCP",
    what: "三种加能力的方式：subagent 给子任务一个独立的上下文窗口；skill 把流程知识按需加载；MCP 把外部服务的工具接进同一个 tool list。",
    without: "所有事都塞进一个上下文，所有流程都写死在系统提示里，每接一个外部系统都要改 harness 代码。",
    cc: ".claude/agents/*.md、.claude/skills/*/SKILL.md、.mcp.json。",
    hermes: "delegate_tool、skills/ 目录、mcp_tool。",
  },
  {
    id: "goal",
    title: "目标与验证",
    items: "done 条件 · Stop hook · 测试 / 评估 · 人类审核",
    what: "回答“怎么算做完了”。模型倾向于在“看起来完成”时停下；验证层用测试、脚本或另一个模型去核对，不过就把它推回循环。",
    without: "模型说“已修复”就结束了，而测试其实还在失败。",
    cc: "Stop hook 返回 decision: block 让它继续；/goal 用一个小模型按条件判断。",
    hermes: "iteration_budget 配合自定义验证脚本。",
  },
];

export default function HarnessAnatomy() {
  const [selected, setSelected] = useState<string>("loop");
  const layer = LAYERS.find((l) => l.id === selected) ?? LAYERS[0];

  return (
    <VisualizationFrame
      title="模型之外的一切：harness 的六层"
      description="模型只做一件事：读一串 token，写一串 token。其余全是 harness。点一层，看它负责什么、没有它会怎样、在 Claude Code 和 Hermes 里各对应什么。"
    >
      <div className="viz-grid2">
        <div>
          <div className="viz-endcap user">用户的任务 · “把这个 bug 修了”</div>
          <div className="viz-arrow">↓ 文本</div>
          <div className="viz-panel" style={{ padding: 10 }}>
            <h5>Harness</h5>
            <div className="viz-layers">
              {LAYERS.map((l) => (
                <button key={l.id} className={`viz-layer${l.id === selected ? " is-on" : ""}`} onClick={() => setSelected(l.id)} aria-pressed={l.id === selected}>
                  <b>{l.title}</b>
                  <small>{l.items}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="viz-arrow">↓ 消息列表 + 工具 schema　　↑ 文本或 tool_use</div>
          <div className="viz-endcap model">模型 · token 进，token 出</div>
        </div>
        <div className="viz-panel">
          <h5>{layer.title}</h5>
          <p><b>它做什么</b><br />{layer.what}</p>
          <p style={{ marginTop: 10 }}><b>没有它会怎样</b><br />{layer.without}</p>
          <p style={{ marginTop: 10 }}><b>Claude Code 里</b><br />{layer.cc}</p>
          <p style={{ marginTop: 10 }}><b>Hermes Agent 里</b><br />{layer.hermes}</p>
        </div>
      </div>
    </VisualizationFrame>
  );
}

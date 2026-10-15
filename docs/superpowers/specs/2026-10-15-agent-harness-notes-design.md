# Agent Harness 笔记系列 — 设计文档

日期：2026-10-15　状态：已按自治模式确定并实施

## 目标

把"agent harness"这组概念（最小循环 → 工具调用 → 权限 → Hook → Subagent → Skill → MCP → Goal / 停止条件）整理成 RLearning 上的一组笔记，可视化优先，部署到 https://rlearning-gamma.vercel.app/ 。读者是作者本人与想自己搭 harness 的工程师；每篇回答"是什么 / 为什么存在 / 怎样运作 / 代价是什么"。

## 范围

- 四篇 MDX 笔记，放在 `content/ai-infra/agent-harness/`，导航分类 AI Infrastructure › Agent Harness。
- 八个交互式 React 可视化，放在 `components/visualization/agent-harness/`，用一个轻量 `VisualizationFrame` 包裹，样式集中在 `styles/visualization.css`。
- 不做：iframe lab 页、暗色模式（站点当前只有浅色）、运行时服务。

## 笔记与可视化

| # | slug | 标题 | 可视化 |
| --- | --- | --- | --- |
| 1 | `agent-loop` | Agent 的最小循环 | `AgentLoopSim`：逐步播放一次"修复失败测试"的循环，消息列表增长、上下文占用、迭代预算；`HarnessAnatomy`：模型与 harness 的分层图，点击每层看职责 |
| 2 | `tools-permissions-hooks` | 工具调用、权限与 Hook | `ToolCallGate`：选一个工具调用，配置权限模式 / 规则 / Hook，看调用怎样穿过 PreToolUse → 权限 → 执行 → PostToolUse |
| 3 | `subagents-skills-mcp` | Subagent、Skill 与 MCP | `SubagentContextViz`：主上下文 vs 委派给 subagent 的 token 对比与并行时间；`SkillDisclosureViz`：渐进披露三层的加载与 token；`McpSequenceViz`：initialize → tools/list → tools/call 的时序，以及工具数对上下文的压力 |
| 4 | `goals-and-harness-design` | Goal、停止条件与设计自己的 Harness | `GoalLoopSim`：Stop hook 做验证闸门的循环，含预算上限；`HarnessDesigner`：按任务原型生成 harness 规格卡，并可切换每个旋钮看风险 |

## 架构

- 内容：MDX 直接 import 客户端组件（与 `LabFrame` 相同模式）。
- 注册：`content/notes.ts` 加四条；`app/notes/[...slug]/page.tsx` 加四个 import；`content/navigation.ts` 的 ai-infra topics 改为 "GPU · Inference · Agent Harness"。
- 组件约定：`"use client"`；无外部依赖；状态全在组件内；SVG 用 viewBox 自适应；配色沿用 dataviz 参考调色板（slot 1 蓝 `#2a78d6`、slot 2 橙 `#eb6834`、slot 3 青 `#1baf7a`、状态色 good `#0ca30c` / critical `#d03b3b`），文字只用站点墨色。
- 可访问性：按钮有可见文字；图有 `role="img"` 与 `aria-label`；`prefers-reduced-motion` 下不播放动画。
- 事实来源：Claude Code 官方文档（由 claude-code-guide 子代理核对），Hermes Agent 源码作第二个例子。

## 测试

`npm run typecheck`、`npm run lint`、`npm run build` 全过；本地预览四篇笔记在桌面与手机宽度下无横向溢出；部署后 curl 四个 URL 返回 200。

## 实施顺序

1. 样式与 `VisualizationFrame`。
2. 八个可视化组件（先 1、2 篇的，再 3、4 篇的）。
3. 四篇 MDX 与注册。
4. 构建、预览、修正。
5. 分支合并到 main 并推送，等待 Vercel，验证线上。

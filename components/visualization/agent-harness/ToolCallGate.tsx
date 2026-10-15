"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Tool = "Read" | "Edit" | "Bash" | "MCP";
type Call = { id: string; tool: Tool; display: string; path?: string; cmd?: string; output: string };

const CALLS: Call[] = [
  { id: "read-app", tool: "Read", display: "Read(src/app.ts)", path: "src/app.ts", output: "src/app.ts 的内容（120 行）" },
  { id: "edit-app", tool: "Edit", display: "Edit(src/app.ts)", path: "src/app.ts", output: "已替换 1 处" },
  { id: "npm-test", tool: "Bash", display: "Bash(npm test)", cmd: "npm test", output: "12 passed" },
  { id: "git-push", tool: "Bash", display: "Bash(git push origin main)", cmd: "git push origin main", output: "main → origin/main 已推送" },
  { id: "rm-rf", tool: "Bash", display: "Bash(rm -rf node_modules)", cmd: "rm -rf node_modules", output: "目录已删除" },
  { id: "read-env", tool: "Read", display: "Read(.env)", path: ".env", output: "API_KEY=sk-…（密钥进了上下文）" },
  { id: "edit-env", tool: "Edit", display: "Edit(.env)", path: ".env", output: ".env 已改写" },
  { id: "mcp-issue", tool: "MCP", display: "mcp__github__create_issue", output: "issue #42 已创建" },
];

type RuleKind = "deny" | "ask" | "allow";
type Rule = { id: string; kind: RuleKind; text: string; match: (c: Call) => boolean };
const RULES: Rule[] = [
  { id: "deny-env", kind: "deny", text: "Read(./.env)", match: (c) => c.tool === "Read" && c.path === ".env" },
  { id: "deny-rm", kind: "deny", text: "Bash(rm -rf *)", match: (c) => !!c.cmd?.startsWith("rm -rf ") },
  { id: "ask-push", kind: "ask", text: "Bash(git push *)", match: (c) => !!c.cmd?.startsWith("git push ") },
  { id: "allow-npm", kind: "allow", text: "Bash(npm *)", match: (c) => !!c.cmd?.startsWith("npm ") },
  { id: "allow-mcp", kind: "allow", text: "mcp__github__*", match: (c) => c.tool === "MCP" },
];
const DEFAULT_RULES: Record<string, boolean> = { "deny-env": true, "deny-rm": true, "ask-push": true, "allow-npm": true, "allow-mcp": false };

type HookDef = { id: string; event: "PreToolUse" | "PostToolUse"; matcher: string; text: string };
const HOOKS: HookDef[] = [
  { id: "protect-env", event: "PreToolUse", matcher: "Edit|Write", text: "protect-env.sh：目标是 .env 就 exit 2 拦下" },
  { id: "format", event: "PostToolUse", matcher: "Edit", text: "format.sh：改完文件自动跑 prettier" },
];
const DEFAULT_HOOKS: Record<string, boolean> = { "protect-env": true, format: true };

type Mode = "default" | "acceptEdits" | "dontAsk" | "bypassPermissions";
const MODES: { id: Mode; label: string; note: string }[] = [
  { id: "default", label: "default（Manual）", note: "只有读取不问；改文件、跑命令、外部工具都要问。" },
  { id: "acceptEdits", label: "acceptEdits", note: "读取和文件编辑不问；Bash 和 MCP 仍要问。" },
  { id: "dontAsk", label: "dontAsk", note: "凡是本来要问的，一律拒绝。给 CI 和脚本用。" },
  { id: "bypassPermissions", label: "bypassPermissions", note: "不问，直接执行。只该在隔离容器里用。" },
];

type Status = "pass" | "block" | "ask" | "skip";
type Stage = { id: string; title: string; status: Status; detail: string; waitsForUser?: boolean };
type Decision = "allow" | "deny" | null;
const KIND_COLOR: Record<RuleKind, string> = { deny: "var(--vcrit)", ask: "var(--v4)", allow: "var(--vgood)" };

function evaluate(call: Call, mode: Mode, rules: Record<string, boolean>, hooks: Record<string, boolean>, decision: Decision) {
  const stages: Stage[] = [];
  let blocked: string | null = null;
  let needUser = false;
  const skip = (id: string, title: string, detail: string) => stages.push({ id, title, status: "skip", detail });

  stages.push({ id: "emit", title: "模型发出 tool_use", status: "pass", detail: `${call.display} · 到这里什么都还没发生，只是模型的一段 JSON。` });

  const preOn = hooks["protect-env"];
  if (!preOn) skip("pre", "PreToolUse hook", "没有配置 PreToolUse hook。");
  else if (call.tool !== "Edit") skip("pre", "PreToolUse hook", `matcher "Edit|Write" 不匹配 ${call.tool}，脚本根本不运行。`);
  else if (call.path === ".env") {
    blocked = "PreToolUse hook protect-env.sh exit 2 — .env 受保护，不允许修改";
    stages.push({ id: "pre", title: "PreToolUse hook", status: "block", detail: "protect-env.sh 从 stdin 读到 tool_input.file_path 是 .env，exit 2，stderr 作为理由回给模型。hook 在权限检查之前运行，在 bypassPermissions 下同样拦得住。" });
  } else stages.push({ id: "pre", title: "PreToolUse hook", status: "pass", detail: "protect-env.sh 运行了，exit 0 且没有输出 = 不表态，交给权限系统。" });

  const deny = RULES.find((r) => r.kind === "deny" && rules[r.id] && r.match(call));
  if (blocked) skip("deny", "deny 规则", "未到达。");
  else if (deny) {
    blocked = `deny 规则 ${deny.text} 命中`;
    stages.push({ id: "deny", title: "deny 规则", status: "block", detail: `${deny.text} 命中。deny 在所有模式下都生效，包括 bypassPermissions；allow 规则也无法给 deny 开例外。` });
  } else stages.push({ id: "deny", title: "deny 规则", status: "pass", detail: "没有 deny 规则命中。" });

  const ask = RULES.find((r) => r.kind === "ask" && rules[r.id] && r.match(call));
  if (blocked) skip("ask", "ask 规则", "未到达。");
  else if (ask) {
    if (mode === "dontAsk") {
      blocked = `ask 规则 ${ask.text} 命中，dontAsk 模式把所有询问改为拒绝`;
      stages.push({ id: "ask", title: "ask 规则", status: "block", detail: `${ask.text} 命中。dontAsk 模式下没有人可问，于是直接拒绝。` });
    } else {
      needUser = true;
      stages.push({ id: "ask", title: "ask 规则", status: "ask", detail: `${ask.text} 命中：显式 ask 规则在任何模式下都会弹出确认，bypassPermissions 也不例外。` });
    }
  } else stages.push({ id: "ask", title: "ask 规则", status: "pass", detail: "没有 ask 规则命中。" });

  if (blocked || needUser) skip("allow", "allow 规则 / 模式默认", blocked ? "未到达。" : "已经要问了，这一步不再判断。");
  else {
    const allow = RULES.find((r) => r.kind === "allow" && rules[r.id] && r.match(call));
    if (mode === "bypassPermissions") stages.push({ id: "allow", title: "allow 规则 / 模式默认", status: "pass", detail: "bypassPermissions：不看 allow 规则，直接放行。这个模式下 allow 规则没有意义。" });
    else if (allow) stages.push({ id: "allow", title: "allow 规则 / 模式默认", status: "pass", detail: `${allow.text} 命中，不询问。` });
    else if (call.tool === "Read") stages.push({ id: "allow", title: "allow 规则 / 模式默认", status: "pass", detail: "读取工作目录内的文件在任何模式下都不问。" });
    else if (call.tool === "Edit" && mode === "acceptEdits") stages.push({ id: "allow", title: "allow 规则 / 模式默认", status: "pass", detail: "acceptEdits：文件编辑自动通过。" });
    else if (mode === "dontAsk") {
      blocked = "没有规则放行，dontAsk 模式直接拒绝";
      stages.push({ id: "allow", title: "allow 规则 / 模式默认", status: "block", detail: "本来要弹确认的调用，在 dontAsk 下被拒绝。CI 里就该这样：要么事先 allow，要么不做。" });
    } else {
      needUser = true;
      stages.push({ id: "allow", title: "allow 规则 / 模式默认", status: "ask", detail: `${mode} 模式下 ${call.tool} 没有被任何 allow 规则覆盖，弹出确认。` });
    }
  }

  const waiting = !blocked && needUser && decision === null;
  if (blocked) skip("user", "用户确认", "未到达。");
  else if (needUser) {
    if (decision === null) stages.push({ id: "user", title: "用户确认", status: "ask", detail: "等待你的决定。", waitsForUser: true });
    else if (decision === "deny") {
      blocked = "用户拒绝";
      stages.push({ id: "user", title: "用户确认", status: "block", detail: "你拒绝了。拒绝会作为 tool_result 回给模型，它可以换一种做法。" });
    } else stages.push({ id: "user", title: "用户确认", status: "pass", detail: "你允许了。真实界面里还可以选“本次会话内都允许”，等于临时加一条 allow 规则。" });
  } else skip("user", "用户确认", "不需要确认。");

  if (blocked || waiting) skip("exec", "执行工具", blocked ? "未到达。" : "等待确认。");
  else stages.push({ id: "exec", title: "执行工具", status: "pass", detail: `harness 执行 ${call.display} → ${call.output}` });

  if (blocked || waiting) skip("post", "PostToolUse hook", blocked ? "未到达。" : "等待确认。");
  else if (!hooks.format) skip("post", "PostToolUse hook", "没有配置 PostToolUse hook。");
  else if (call.tool !== "Edit") skip("post", "PostToolUse hook", `matcher "Edit" 不匹配 ${call.tool}。`);
  else stages.push({ id: "post", title: "PostToolUse hook", status: "pass", detail: "format.sh 跑了 prettier。PostToolUse 无法撤销已发生的调用，只能善后或把反馈塞回给模型。" });

  if (waiting) skip("result", "tool_result 回到模型", "等待确认。");
  else if (blocked) stages.push({ id: "result", title: "tool_result 回到模型", status: "block", detail: `模型收到的是一条错误：“blocked: ${blocked}”。它没有崩溃，只是知道这条路走不通，下一轮会换办法。` });
  else stages.push({ id: "result", title: "tool_result 回到模型", status: "pass", detail: `模型收到“${call.output}”，循环继续。` });

  return { stages, blocked, waiting };
}

export default function ToolCallGate() {
  const [callId, setCallId] = useState(CALLS[2].id);
  const [mode, setMode] = useState<Mode>("default");
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [hooks, setHooks] = useState(DEFAULT_HOOKS);
  const [decision, setDecision] = useState<Decision>(null);
  const [shown, setShown] = useState(1);

  const call = CALLS.find((c) => c.id === callId) ?? CALLS[0];
  const result = useMemo(() => evaluate(call, mode, rules, hooks, decision), [call, mode, rules, hooks, decision]);
  const { stages } = result;
  const current = stages[Math.min(shown, stages.length) - 1];
  const stuck = current?.waitsForUser && decision === null;
  const done = shown >= stages.length;

  const restart = () => { setDecision(null); setShown(1); };
  const pickCall = (id: string) => { setCallId(id); restart(); };
  const modeInfo = MODES.find((m) => m.id === mode)!;

  let narr = "按“下一步”看这次调用怎样穿过闸门。";
  let tone = "";
  if (done) {
    if (result.blocked) { narr = `结果：被拦下。${result.blocked}。注意拦截发生在哪一层：越靠前越便宜，PreToolUse hook 和 deny 规则都不需要人在场。`; tone = " is-bad"; }
    else { narr = "结果：执行了。回头看哪些阶段是“跳过”的：闸门不是每层都做事，但每层都可以做事。"; tone = " is-good"; }
  } else if (stuck) { narr = "停在用户确认。这就是“人在回路”的那一刻：harness 把决定权交出去，循环暂停。"; tone = " is-warn"; }

  return (
    <VisualizationFrame
      title="一次工具调用怎样穿过闸门"
      description="选一个模型想做的调用，调整权限模式、规则和 hook，然后一步步看它在哪一层被放行、询问或拦下。顺序按 Claude Code 的文档：hook 在前，然后 deny → ask → allow，最后才执行。"
      footnote={<>试几个组合：关掉 protect-env hook 再发 Edit(.env)，看 acceptEdits 会不会放过它；把模式切到 bypassPermissions 再发 rm -rf，看 deny 规则还在不在；切到 dontAsk 发 git push，看 ask 规则变成了什么。</>}
    >
      <div className="viz-grid2 wide-left">
        <div>
          <div className="viz-panel">
            <h5>模型想做的调用</h5>
            <div className="viz-chips">
              {CALLS.map((c) => <button key={c.id} className={`viz-chip mono${c.id === callId ? " is-on" : ""}`} onClick={() => pickCall(c.id)}>{c.display}</button>)}
            </div>
          </div>
          <div className="viz-panel" style={{ marginTop: 10 }}>
            <h5>权限模式</h5>
            <div className="viz-controls" style={{ marginBottom: 6 }}>
              <select value={mode} onChange={(e) => { setMode(e.target.value as Mode); restart(); }} aria-label="权限模式">
                {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <p className="viz-k">{modeInfo.note}</p>
          </div>
          <div className="viz-panel" style={{ marginTop: 10 }}>
            <h5>permissions 规则</h5>
            <ul style={{ display: "grid", gap: 4 }}>
              {RULES.map((r) => (
                <li key={r.id}>
                  <label className="viz-check">
                    <input type="checkbox" checked={!!rules[r.id]} onChange={(e) => { setRules({ ...rules, [r.id]: e.target.checked }); restart(); }} />
                    <span style={{ color: KIND_COLOR[r.kind], fontWeight: 600, minWidth: 40 }}>{r.kind}</span>
                    <span className="viz-mono">{r.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="viz-panel" style={{ marginTop: 10 }}>
            <h5>hooks</h5>
            <ul style={{ display: "grid", gap: 4 }}>
              {HOOKS.map((h) => (
                <li key={h.id}>
                  <label className="viz-check">
                    <input type="checkbox" checked={!!hooks[h.id]} onChange={(e) => { setHooks({ ...hooks, [h.id]: e.target.checked }); restart(); }} />
                    <span><span className="viz-mono">{h.event} · matcher &quot;{h.matcher}&quot;</span><br /><span className="viz-k">{h.text}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div>
          <div className="viz-controls">
            <button className="viz-btn primary" onClick={() => setShown((v) => Math.min(v + 1, stages.length))} disabled={done || stuck}>下一步</button>
            <button className="viz-btn" onClick={() => setShown(stages.length)} disabled={done || stuck}>跑完</button>
            <button className="viz-btn" onClick={restart}>重置</button>
          </div>
          <ol className="viz-stages">
            {stages.map((s, index) => {
              const revealed = index < shown;
              const isCurrent = index === shown - 1;
              return (
                <li key={s.id} className={`viz-stage${revealed ? ` is-${s.status}` : " is-skip"}${isCurrent ? " is-current" : ""}`}>
                  <span className="dot" aria-hidden="true" />
                  <span>
                    <b>{s.title}</b>
                    <small>{revealed ? s.detail : "…"}</small>
                    {revealed && s.waitsForUser && decision === null && (
                      <span className="viz-chips" style={{ marginTop: 6 }}>
                        <button className="viz-chip" onClick={() => setDecision("allow")}>允许</button>
                        <button className="viz-chip" onClick={() => setDecision("deny")}>拒绝</button>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Turn = { claim: string; claimsLint: boolean; ranLint: boolean; failed: number; lint: number };
const TURNS: Turn[] = [
  { claim: "修好了日期解析，测试应该过了。", claimsLint: false, ranLint: false, failed: 3, lint: 2 },
  { claim: "补上了闰年分支，再跑一次。", claimsLint: false, ranLint: false, failed: 1, lint: 2 },
  { claim: "时区边界也处理了，测试全绿，lint 也没问题。", claimsLint: true, ranLint: false, failed: 0, lint: 2 },
  { claim: "清掉了未使用的 import，lint 干净了。", claimsLint: true, ranLint: true, failed: 0, lint: 0 },
];
type Verifier = "command" | "prompt";
type Outcome = { turn: number; claim: string; verdict: string; kind: "block" | "good" | "warn"; stop: boolean; failed: number; lint: number };

function simulate(hookOn: boolean, verifier: Verifier, cap: number, fooled: boolean): Outcome[] {
  const out: Outcome[] = [];
  let blocks = 0;
  for (let t = 0; t < TURNS.length; t++) {
    const turn = TURNS[t];
    const base = { turn: t + 1, claim: turn.claim, failed: turn.failed, lint: turn.lint };
    if (!hookOn) {
      out.push({ ...base, verdict: "没有闸门。模型说完就停，harness 把回复交给用户。", kind: turn.failed + turn.lint > 0 ? "block" : "good", stop: true });
      break;
    }
    let met: boolean;
    let reason: string;
    if (verifier === "command") {
      met = turn.failed === 0 && turn.lint === 0;
      reason = met ? "npm test 与 npm run lint 都通过" : `npm test：${turn.failed} failed；npm run lint：${turn.lint} errors`;
    } else {
      if (turn.failed > 0) { met = false; reason = `transcript 里的测试输出显示 ${turn.failed} failed`; }
      else if (turn.ranLint && turn.lint === 0) { met = true; reason = "transcript 里有测试通过和 lint 通过的输出"; }
      else if (turn.claimsLint && fooled) { met = true; reason = "模型说 lint 没问题，评估器只读 transcript、不能跑命令，于是信了"; }
      else { met = false; reason = "测试通过了，但 transcript 里没有 lint 的输出，不能算满足"; }
    }
    if (met) {
      const leftover = turn.failed + turn.lint;
      out.push({ ...base, verdict: `验证：满足 — ${reason}。放行停止。${leftover ? `可实际上还剩 ${leftover} 个问题。` : ""}`, kind: leftover ? "block" : "good", stop: true });
      break;
    }
    blocks += 1;
    if (blocks >= cap) {
      out.push({ ...base, verdict: `验证：不满足 — ${reason}。但已连续 block ${blocks} 次达到上限，harness 不再拦，强制停止。`, kind: "warn", stop: true });
      break;
    }
    out.push({ ...base, verdict: `验证：不满足 — ${reason}。Stop hook 返回 {"decision":"block","reason":"…"}，模型带着理由继续。`, kind: "block", stop: false });
  }
  return out;
}

export default function GoalLoopSim() {
  const [hookOn, setHookOn] = useState(true);
  const [verifier, setVerifier] = useState<Verifier>("command");
  const [cap, setCap] = useState(8);
  const [fooled, setFooled] = useState(true);
  const [shown, setShown] = useState(1);
  const outcomes = useMemo(() => simulate(hookOn, verifier, cap, fooled), [hookOn, verifier, cap, fooled]);
  const visible = outcomes.slice(0, shown);
  const last = visible[visible.length - 1];
  const finished = shown >= outcomes.length;
  const reset = () => setShown(1);

  const maxBar = 3;
  const BAR_W = 46;

  return (
    <VisualizationFrame
      title="Stop hook 当验证闸门：模型说“做完了”，然后呢"
      description="目标：测试全过且 lint 干净。每一轮模型都会宣称完成；闸门决定是真的停下，还是把它推回循环。切换验证方式和上限，看结局怎样变化。"
      footnote={<>三种结局对应三种 harness 设计：没有闸门就只能信模型；用命令验证最可靠，但要有可运行的检查；用模型读 transcript 判断最灵活，但它看不见没发生的事。连续 block 上限是防死循环的保险。</>}
    >
      <div className="viz-controls">
        <label className="viz-check"><input type="checkbox" checked={hookOn} onChange={(e) => { setHookOn(e.target.checked); reset(); }} />启用 Stop hook</label>
        <label>
          <span className="viz-k">验证方式</span>
          <select value={verifier} disabled={!hookOn} onChange={(e) => { setVerifier(e.target.value as Verifier); reset(); }} aria-label="验证方式">
            <option value="command">command：真的跑 npm test && npm run lint</option>
            <option value="prompt">prompt：小模型只读 transcript 判断（/goal）</option>
          </select>
        </label>
        <label><span className="viz-k">连续 block 上限</span><input type="range" min={1} max={8} value={cap} disabled={!hookOn} onChange={(e) => { setCap(Number(e.target.value)); reset(); }} /><span className="viz-mono">{cap}</span></label>
        <label className="viz-check"><input type="checkbox" checked={fooled} disabled={!hookOn || verifier !== "prompt"} onChange={(e) => { setFooled(e.target.checked); reset(); }} />第 3 轮的口头声明能骗过 prompt 评估器</label>
      </div>
      <div className="viz-controls">
        <button className="viz-btn primary" onClick={() => setShown((v) => Math.min(v + 1, outcomes.length))} disabled={finished}>下一轮</button>
        <button className="viz-btn" onClick={() => setShown(outcomes.length)} disabled={finished}>跑完</button>
        <button className="viz-btn" onClick={reset}>重置</button>
      </div>
      <div className="viz-grid2 wide-left">
        <ol className="viz-turns">
          {visible.map((o) => (
            <li key={o.turn} className="viz-turn">
              <span className="no">第 {o.turn} 轮</span>
              <span>
                <span>模型：“{o.claim}”</span>
                <span className={`verdict is-${o.kind}`}>{o.verdict}</span>
              </span>
            </li>
          ))}
          {!finished && <li className="viz-turn is-dim"><span className="no">第 {shown + 1} 轮</span><span>…</span></li>}
        </ol>
        <div className="viz-panel">
          <h5>每轮验证时剩下的问题</h5>
          <svg viewBox="0 0 300 150" role="img" aria-label={visible.map((o) => `第 ${o.turn} 轮：${o.failed} 个失败测试，${o.lint} 个 lint 错误`).join("；")}>
            <line x1="30" x2="290" y1="120" y2="120" stroke="#d9d3bb" />
            {visible.map((o, idx) => {
              const x0 = 40 + idx * 64;
              const h1 = (o.failed / maxBar) * 90;
              const h2 = (o.lint / maxBar) * 90;
              return (
                <g key={o.turn}>
                  <rect x={x0} y={120 - h1} width={BAR_W / 2 - 1} height={h1} rx="3" fill="var(--v1)" />
                  <rect x={x0 + BAR_W / 2 + 1} y={120 - h2} width={BAR_W / 2 - 1} height={h2} rx="3" fill="var(--v2)" />
                  <text x={x0 + BAR_W / 4} y={116 - h1} textAnchor="middle" fontSize="11" fill="#30332c" className="mono">{o.failed}</text>
                  <text x={x0 + (3 * BAR_W) / 4} y={116 - h2} textAnchor="middle" fontSize="11" fill="#30332c" className="mono">{o.lint}</text>
                  <text x={x0 + BAR_W / 2} y="138" textAnchor="middle" fontSize="11" fill="#76796f">第 {o.turn} 轮</text>
                </g>
              );
            })}
          </svg>
          <div className="viz-legend"><span><i style={{ background: "var(--v1)" }} />失败的测试</span><span><i style={{ background: "var(--v2)" }} />lint 错误</span></div>
        </div>
      </div>
      {last && finished && (
        <div className={`viz-narr${last.kind === "good" ? " is-good" : last.kind === "warn" ? " is-warn" : " is-bad"}`}>
          {last.kind === "good" && "结局：在第 " + last.turn + " 轮真正完成后停下。闸门没有多拦一次，也没有少拦一次。"}
          {last.kind === "block" && "结局：停下来了，但问题还在。模型的“完成”与真实的完成之间的差距，就是 harness 要补的那一层。"}
          {last.kind === "warn" && "结局：上限触发，带着问题停下。上限的意义是别让一个永远过不了的检查把预算烧光；触发了就该让人来看。"}
        </div>
      )}
    </VisualizationFrame>
  );
}

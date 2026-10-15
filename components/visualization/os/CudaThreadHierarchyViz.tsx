"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Mode = "hierarchy" | "divergence" | "latency";
type Cond = "even" | "lt8" | "lt32";

const WARP = 32;
const BLOCKS = 6;
const COND: Record<Cond, { code: string; test: (tid: number) => boolean; note: string }> = {
  even: { code: "if (tid % 2 == 0)", test: (t) => t % 2 === 0, note: "一半 lane 走 if，一半走 else，warp 得把两条路都走一遍。" },
  lt8: { code: "if (tid < 8)", test: (t) => t < 8, note: "只有 8 个 lane 走 if，但 warp 仍要为它们单独跑一遍，其余 24 个 lane 空转。" },
  lt32: { code: "if (tid < 32)", test: (t) => t < 32, note: "条件和 warp 边界对齐：这个 warp 里 32 个 lane 全走 if，没有发散。另一个 warp 会全走 else，也没有发散。" },
};

function Lanes({ active, exec, label }: { active: boolean[]; exec: "none" | "if" | "else"; label: string }) {
  const size = 11;
  const gap = 2;
  const W = WARP * (size + gap);
  return (
    <svg viewBox={`0 0 ${W} ${size + 14}`} role="img" aria-label={label} style={{ maxWidth: 480 }}>
      {active.map((on, i) => (
        <rect key={i} x={i * (size + gap)} y={0} width={size} height={size} rx={2}
          fill={exec === "none" ? "#2a78d6" : on ? (exec === "if" ? "#2a78d6" : "#eb6834") : "#e4dfcb"} />
      ))}
      <text x={0} y={size + 11} fontSize={8} fill="#76796f">lane 0</text>
      <text x={W} y={size + 11} fontSize={8} fill="#76796f" textAnchor="end">lane 31</text>
    </svg>
  );
}

function Hierarchy() {
  const [blockSize, setBlockSize] = useState(200);
  const warps = Math.ceil(blockSize / WARP);
  const tail = blockSize % WARP || WARP;
  const idle = warps * WARP - blockSize;
  const util = Math.round((blockSize / (warps * WARP)) * 100);
  const size = 9;
  const gap = 2;
  const laneW = WARP * (size + gap);
  const H = warps * (size + gap) + 4;
  return (
    <>
      <div className="viz-controls">
        <label><span className="viz-k">blockDim.x</span><input type="range" min={8} max={288} step={8} value={blockSize} onChange={(e) => setBlockSize(Number(e.target.value))} /><span className="viz-mono">{blockSize}</span></label>
        <span className="viz-k">grid 固定 {BLOCKS} 个 block，共 {BLOCKS * blockSize} 个线程</span>
      </div>
      <div className="viz-grid2 wide-left">
        <div className="viz-panel">
          <h5>grid → block → warp → lane</h5>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }} aria-hidden>
            {Array.from({ length: BLOCKS }, (_, b) => (
              <div key={b} style={{ flex: 1, height: 22, borderRadius: 3, background: b === 0 ? "#3b4234" : "#efede4", color: b === 0 ? "#fff" : "#76796f", fontSize: 10, display: "grid", placeItems: "center" }}>block {b}</div>
            ))}
          </div>
          <p className="viz-k" style={{ marginBottom: 6 }}>block 0 展开：{warps} 个 warp，每行 32 个 lane</p>
          <svg viewBox={`0 0 ${laneW + 40} ${H}`} role="img" aria-label={`一个 ${blockSize} 线程的 block 被切成 ${warps} 个 warp，最后一个 warp 只有 ${tail} 个 lane 在用。`}>
            {Array.from({ length: warps }, (_, w) => (
              <g key={w} transform={`translate(0 ${w * (size + gap)})`}>
                <text x={0} y={size - 1} fontSize={8} fill="#76796f">w{w}</text>
                {Array.from({ length: WARP }, (_, l) => {
                  const tid = w * WARP + l;
                  return <rect key={l} x={40 + l * (size + gap)} y={0} width={size} height={size} rx={1.5} fill={tid < blockSize ? "#2a78d6" : "#e4dfcb"} />;
                })}
              </g>
            ))}
          </svg>
        </div>
        <div className="viz-panel">
          <h5>这个 block 在 SM 上</h5>
          <table className="viz-table">
            <tbody>
              <tr><td>warp 数</td><td className="num">{warps}</td></tr>
              <tr><td>尾部 warp 用了</td><td className="num">{tail} / 32</td></tr>
              <tr><td>空转 lane</td><td className="num">{idle}</td></tr>
              <tr><td>lane 利用率</td><td className="num">{util}%</td></tr>
            </tbody>
          </table>
          <p className="viz-k" style={{ marginTop: 8 }}>硬件调度的最小单位是 warp，不是线程。{idle > 0 ? `${blockSize} 不是 32 的倍数，硬件仍然要发射 ${warps} 个完整的 warp，${idle} 个 lane 白占着执行单元。` : "block 大小是 32 的倍数，没有 lane 浪费。"}</p>
        </div>
      </div>
      <div className={`viz-narr${idle > 0 ? " is-warn" : ""}`}>
        CPU 线程是独立的调度实体，内核一个一个地调度它们。CUDA 的“线程”只是 warp 里的一条 lane：同一个 warp 的 32 个 lane 永远在同一个周期执行同一条指令。所以 block 大小通常取 32 的倍数，常见是 128 或 256。
      </div>
    </>
  );
}

function Divergence() {
  const [cond, setCond] = useState<Cond>("even");
  const [step, setStep] = useState(0);
  const mask = useMemo(() => Array.from({ length: WARP }, (_, t) => COND[cond].test(t)), [cond]);
  const nIf = mask.filter(Boolean).length;
  const diverged = nIf > 0 && nIf < WARP;
  const steps = diverged
    ? [
        { exec: "none" as const, active: mask, title: "1 · 求值条件，生成活跃掩码", text: `32 个 lane 同时算一次条件。结果是一个 32 位掩码：${nIf} 个 1，${WARP - nIf} 个 0。` },
        { exec: "if" as const, active: mask, title: "2 · 执行 if 分支", text: `warp 发射 if 分支里的每条指令，只有掩码为 1 的 ${nIf} 个 lane 真的写结果，其余 ${WARP - nIf} 个跟着走但被屏蔽。` },
        { exec: "else" as const, active: mask.map((m) => !m), title: "3 · 执行 else 分支", text: `掩码取反，再把 else 分支的指令发射一遍。刚才干活的 ${nIf} 个 lane 这回轮到空转。` },
        { exec: "none" as const, active: mask, title: "4 · 汇合", text: "两条路都走完，32 个 lane 重新一起执行后面的代码。这个 if/else 总共花了两段时间，平均每个 lane 只有一半时间在干活。" },
      ]
    : [
        { exec: "none" as const, active: mask, title: "1 · 求值条件，生成活跃掩码", text: "32 个 lane 同时算一次条件，掩码全是 1。" },
        { exec: "if" as const, active: mask, title: "2 · 执行 if 分支", text: "所有 lane 都走 if，else 分支一条指令都不用发射。硬件只在掩码既有 1 又有 0 时才走两遍。" },
        { exec: "none" as const, active: mask, title: "3 · 继续", text: "没有发散，没有浪费。让分支条件和 warp 边界对齐，是写 kernel 时最常见的优化之一。" },
      ];
  const cur = steps[Math.min(step, steps.length - 1)];
  const laneUtil = diverged ? 50 : 100;
  return (
    <>
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="分支条件">
          {(Object.keys(COND) as Cond[]).map((c) => (
            <button key={c} type="button" className={`viz-chip mono${cond === c ? " is-on" : ""}`} onClick={() => { setCond(c); setStep(0); }}>{COND[c].code}</button>
          ))}
        </div>
        <button type="button" className="viz-btn primary" disabled={step >= steps.length - 1} onClick={() => setStep((s) => s + 1)}>下一步</button>
        <button type="button" className="viz-btn" onClick={() => setStep(0)}>重置</button>
      </div>
      <div className="viz-panel">
        <h5>warp 0 · {cur.title}</h5>
        <Lanes active={cur.active} exec={cur.exec} label={`${cur.title}：${cur.active.filter(Boolean).length} 个 lane 活跃。`} />
        <div className="viz-legend"><span><i style={{ background: "#2a78d6" }} />执行 if（或未分支）</span><span><i style={{ background: "#eb6834" }} />执行 else</span><span><i style={{ background: "#e4dfcb" }} />被掩码屏蔽，空转</span></div>
        <p style={{ marginTop: 8 }}>{cur.text}</p>
      </div>
      <table className="viz-table">
        <thead><tr><th></th><th>GPU：一个 warp 的 32 个 lane</th><th>CPU：32 个独立线程</th></tr></thead>
        <tbody>
          <tr><td>分支怎么走</td><td>{diverged ? "串行走两遍，用掩码屏蔽不该写的 lane" : "全体走同一条路，一遍"}</td><td>每个线程各走各的，互不等待</td></tr>
          <tr><td>这段代码的 lane 利用率</td><td className="num">{laneUtil}%</td><td className="num">100%</td></tr>
          <tr><td>代价在哪</td><td>发散的分支长度直接变成浪费的周期</td><td>每个线程都要被内核调度一次，切换成本远高于一条指令</td></tr>
        </tbody>
      </table>
      <div className={`viz-narr${diverged ? " is-warn" : " is-good"}`}>{COND[cond].note}</div>
    </>
  );
}

type WCell = "issue" | "stall" | "ready" | null;
function simulateWarps(n: number): { rows: WCell[][]; cycles: number; busy: number } {
  const pattern = [2, 8, 2, 8, 2];
  const phase = Array(n).fill(0);
  const left = Array(n).fill(pattern[0]);
  const rows: WCell[][] = Array.from({ length: n }, () => []);
  let rr = 0;
  let busy = 0;
  let t = 0;
  for (; t < 80; t++) {
    const done = (i: number) => phase[i] >= pattern.length;
    if (phase.every((_, i) => done(i))) break;
    let picked: number | null = null;
    for (let k = 0; k < n; k++) {
      const i = (rr + k) % n;
      if (!done(i) && phase[i] % 2 === 0) { picked = i; rr = i + 1; break; }
    }
    for (let i = 0; i < n; i++) {
      if (done(i)) { rows[i].push(null); continue; }
      const computing = phase[i] % 2 === 0;
      if (i === picked) { rows[i].push("issue"); busy += 1; left[i] -= 1; }
      else if (computing) rows[i].push("ready");
      else { rows[i].push("stall"); left[i] -= 1; }
      if (left[i] === 0) { phase[i] += 1; if (phase[i] < pattern.length) left[i] = pattern[phase[i]]; }
    }
  }
  return { rows, cycles: t, busy };
}

function Latency() {
  const [warps, setWarps] = useState(2);
  const sim = useMemo(() => simulateWarps(warps), [warps]);
  const util = Math.round((sim.busy / sim.cycles) * 100);
  const W = 560;
  const rowH = 14;
  const cw = (W - 24) / Math.max(sim.cycles, 20);
  const H = warps * rowH + 14;
  return (
    <>
      <div className="viz-controls">
        <label><span className="viz-k">SM 上常驻的 warp</span><input type="range" min={1} max={8} value={warps} onChange={(e) => setWarps(Number(e.target.value))} /><span className="viz-mono">{warps}</span></label>
        <span className="viz-k">每个 warp：算 2 个周期，等显存 8 个周期，重复</span>
      </div>
      <div className="viz-panel">
        <h5>warp 调度器每个周期发射一条指令</h5>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${warps} 个 warp 的发射时间线，${sim.cycles} 个周期，发射单元利用率 ${util}%。`}>
          {sim.rows.map((row, i) => (
            <g key={i}>
              <text x={0} y={i * rowH + 10} fontSize={9} fill="#76796f">w{i}</text>
              {row.map((c, t) => c && (
                <rect key={t} x={24 + t * cw} y={i * rowH + 2} width={Math.max(cw - 1, 1)} height={rowH - 4} rx={1}
                  fill={c === "issue" ? "#2a78d6" : c === "stall" ? "#2a78d6" : "#d9d5c4"} opacity={c === "stall" ? 0.2 : 1} />
              ))}
            </g>
          ))}
          <text x={24} y={H - 2} fontSize={8} fill="#a8a693">0</text>
          <text x={24 + sim.cycles * cw} y={H - 2} fontSize={8} fill="#a8a693" textAnchor="end">{sim.cycles} 周期</text>
        </svg>
        <div className="viz-legend"><span><i style={{ background: "#2a78d6" }} />发射指令</span><span><i style={{ background: "#2a78d6", opacity: 0.2 }} />等显存</span><span><i style={{ background: "#d9d5c4" }} />就绪，等调度器</span></div>
      </div>
      <div className="viz-cards" style={{ marginTop: 12 }}>
        <div className="viz-card"><h6>发射单元利用率</h6><p className="viz-mono" style={{ fontSize: 18 }}>{util}%</p><p className="why">{warps} 个 warp，{sim.cycles} 个周期里有 {sim.busy} 个在干活</p></div>
        <div className="viz-card"><h6>GPU 切换 warp</h6><p>0 个周期</p><p className="why">每个 warp 的寄存器都常驻在寄存器文件里，调度器只是换一个 PC 去取指</p></div>
        <div className="viz-card"><h6>CPU 切换线程</h6><p>≈ 1 µs，几千个周期</p><p className="why">要保存和恢复寄存器，还要内核介入；所以 CPU 靠 cache 和乱序执行藏延迟，而不是靠切换</p></div>
      </div>
      <div className={`viz-narr${util < 60 ? " is-warn" : util >= 95 ? " is-good" : ""}`}>
        {warps === 1
          ? "只有一个 warp 时，它每算 2 个周期就要等 8 个周期的显存，发射单元大部分时间空着。GPU 没法像 CPU 那样靠大 cache 把延迟藏掉，它的办法是多塞几个 warp。"
          : util >= 95
            ? `${warps} 个 warp 轮流上场，总有一个是就绪的，显存延迟被完全藏住了。这就是“occupancy”这个指标的意义：常驻 warp 越多，越能把等待填满。上限由寄存器文件和 shared memory 决定。`
            : `${warps} 个 warp 把一部分等待填上了，但还有空隙。继续加 warp，直到每个周期都有就绪的 warp 可发射。`}
      </div>
    </>
  );
}

export default function CudaThreadHierarchyViz() {
  const [mode, setMode] = useState<Mode>("hierarchy");
  const tabs: { id: Mode; label: string }[] = [
    { id: "hierarchy", label: "线程层级" },
    { id: "divergence", label: "分支发散" },
    { id: "latency", label: "延迟隐藏" },
  ];
  return (
    <VisualizationFrame
      title="CUDA 的“线程”到底是什么"
      description="三个小实验：block 怎样被切成 warp、一个 if 怎样让 warp 走两遍、调度器怎样用多个 warp 把显存延迟藏起来。每一个都和 CPU 线程对照。"
      footnote={<>warp 宽度 32 是 NVIDIA GPU 的常量。延迟隐藏实验里“算 2 等 8”是示意比例，真实的显存延迟是几百个周期，所以需要的常驻 warp 更多。</>}
    >
      <div className="viz-chips" role="tablist" style={{ marginBottom: 14 }}>
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={mode === t.id} className={`viz-chip${mode === t.id ? " is-on" : ""}`} onClick={() => setMode(t.id)}>{t.label}</button>
        ))}
      </div>
      {mode === "hierarchy" && <Hierarchy />}
      {mode === "divergence" && <Divergence />}
      {mode === "latency" && <Latency />}
    </VisualizationFrame>
  );
}

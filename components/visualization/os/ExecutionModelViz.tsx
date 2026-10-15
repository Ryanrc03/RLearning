"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Model = "process" | "thread" | "coroutine";
type Workload = "io" | "cpu";
type Seg = { kind: "cpu" | "io"; len: number };
type Cell = "run" | "io" | "ready" | "dead" | null;
type TaskState = "ready" | "io" | "done" | "dead";

const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#7b5cd6", "#d6478f", "#4aa3c7", "#8c8c3a"];
const QUANTUM = 2;
const SWITCH_COST_US: Record<Model, number> = { process: 3, thread: 1, coroutine: 0.05 };
const INFO: Record<Model, { name: string; scheduler: string; memory: string; isolation: string; switchNote: string }> = {
  process: { name: "进程", scheduler: "内核（抢占式）", memory: "独立地址空间 + 页表，MB 级", isolation: "一个崩了，其他照跑", switchNote: "切地址空间，TLB 失效" },
  thread: { name: "线程", scheduler: "内核（抢占式）", memory: "共享地址空间，每个线程一个栈（预留 ~8 MB 虚拟）", isolation: "一个崩了，整个进程死", switchNote: "换寄存器和栈，不换地址空间" },
  coroutine: { name: "协程", scheduler: "用户态（协作式）", memory: "一个 OS 线程，每个协程一个 KB 级的帧", isolation: "一个崩了，整个进程死", switchNote: "一次函数调用的开销" },
};

function segments(w: Workload): Seg[] {
  return w === "io"
    ? [{ kind: "cpu", len: 2 }, { kind: "io", len: 5 }, { kind: "cpu", len: 2 }, { kind: "io", len: 5 }, { kind: "cpu", len: 2 }]
    : [{ kind: "cpu", len: 12 }];
}

type Sim = { rows: Cell[][]; ticks: number; switches: number; crashedAt: number | null; killed: boolean };

function simulate(model: Model, workload: Workload, cores: number, tasks: number, crash: boolean): Sim {
  const segs = segments(workload);
  const effCores = model === "coroutine" ? 1 : cores;
  const preemptive = model !== "coroutine";
  const segIdx = Array(tasks).fill(0);
  const left = Array(tasks).fill(segs[0].len);
  const state: TaskState[] = Array(tasks).fill("ready");
  const ioUntil = Array(tasks).fill(0);
  const cpuDone = Array(tasks).fill(0);
  const rows: Cell[][] = Array.from({ length: tasks }, () => []);
  const running: (number | null)[] = Array(effCores).fill(null);
  const quantumLeft = Array(effCores).fill(0);
  let switches = 0;
  let crashedAt: number | null = null;
  let killed = false;
  let rr = 0;
  const victim = Math.min(2, tasks - 1);

  let t = 0;
  for (; t < 240; t++) {
    for (let i = 0; i < tasks; i++) {
      if (state[i] === "io" && ioUntil[i] <= t) {
        state[i] = "ready";
        segIdx[i] += 1;
        left[i] = segs[segIdx[i]].len;
      }
    }
    const isRunning = (i: number) => running.includes(i);
    for (let c = 0; c < effCores; c++) {
      const cur = running[c];
      const curOk = cur !== null && state[cur] === "ready";
      const othersReady = state.some((s, i) => s === "ready" && !isRunning(i));
      const release = !curOk || (preemptive && quantumLeft[c] === 0 && othersReady);
      if (!release) continue;
      let pick: number | null = null;
      for (let k = 0; k < tasks; k++) {
        const i = (rr + k) % tasks;
        if (state[i] === "ready" && !isRunning(i) && i !== cur) { pick = i; rr = i + 1; break; }
      }
      if (pick === null && curOk) pick = cur;
      if (pick !== cur && pick !== null) switches += 1;
      running[c] = pick;
      quantumLeft[c] = QUANTUM;
    }
    for (let i = 0; i < tasks; i++) {
      const s = state[i];
      rows[i].push(isRunning(i) ? "run" : s === "io" ? "io" : s === "ready" ? "ready" : null);
    }
    for (let c = 0; c < effCores; c++) {
      const i = running[c];
      if (i === null) continue;
      left[i] -= 1;
      cpuDone[i] += 1;
      quantumLeft[c] -= 1;
      if (crash && i === victim && cpuDone[i] === 3 && crashedAt === null) {
        crashedAt = t;
        rows[i][t] = "dead";
        if (model === "process") {
          state[i] = "dead";
          running[c] = null;
        } else {
          killed = true;
          for (let j = 0; j < tasks; j++) if (state[j] !== "done") { state[j] = "dead"; rows[j][t] = "dead"; }
        }
        continue;
      }
      if (left[i] === 0) {
        segIdx[i] += 1;
        if (segIdx[i] >= segs.length) state[i] = "done";
        else { state[i] = "io"; ioUntil[i] = t + 1 + segs[segIdx[i]].len; }
        running[c] = null;
      }
    }
    if (killed || state.every((s) => s === "done" || s === "dead")) { t += 1; break; }
  }
  return { rows, ticks: t, switches, crashedAt, killed };
}

function MemoryLayout({ model, tasks }: { model: Model; tasks: number }) {
  const W = 320;
  const H = 150;
  const label = { fontSize: 9, fill: "#76796f" } as const;
  if (model === "process") {
    const gap = 6;
    const bw = (W - gap * (tasks - 1)) / tasks;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${tasks} 个进程，每个有独立的地址空间、代码、堆和栈。`}>
        {Array.from({ length: tasks }, (_, i) => {
          const x = i * (bw + gap);
          return (
            <g key={i}>
              <rect x={x} y={10} width={bw} height={H - 22} rx={4} fill="#fff" stroke={COLORS[i]} strokeWidth={1.5} />
              <rect x={x + 4} y={18} width={bw - 8} height={16} fill="#efede4" />
              <rect x={x + 4} y={40} width={bw - 8} height={40} fill="#efede4" />
              <rect x={x + 4} y={H - 46} width={bw - 8} height={28} fill={COLORS[i]} opacity={0.35} />
              {bw > 42 && (<><text x={x + bw / 2} y={29} textAnchor="middle" {...label}>代码</text><text x={x + bw / 2} y={63} textAnchor="middle" {...label}>堆</text><text x={x + bw / 2} y={H - 28} textAnchor="middle" {...label}>栈</text></>)}
              <text x={x + bw / 2} y={H - 2} textAnchor="middle" {...label}>P{i + 1}</text>
            </g>
          );
        })}
      </svg>
    );
  }
  const stackW = model === "thread" ? Math.min(40, (W - 16 - 6 * (tasks - 1)) / tasks) : 40;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={model === "thread" ? `一个地址空间，代码和堆共享，${tasks} 个线程各有一个栈。` : `一个地址空间，一个 OS 线程栈，${tasks} 个协程帧放在堆里，由用户态调度器切换。`}>
      <rect x={0} y={10} width={W} height={H - 22} rx={4} fill="#fff" stroke="#3b4234" strokeWidth={1.5} />
      <rect x={8} y={18} width={W - 16} height={16} fill="#efede4" />
      <text x={W / 2} y={29} textAnchor="middle" {...label}>代码（共享）</text>
      <rect x={8} y={40} width={W - 16} height={44} fill="#efede4" />
      <text x={14} y={51} {...label}>堆（共享）</text>
      {model === "thread" ? (
        Array.from({ length: tasks }, (_, i) => {
          const x = 8 + i * (stackW + 6);
          return (
            <g key={i}>
              <rect x={x} y={H - 46} width={stackW} height={28} fill={COLORS[i]} opacity={0.35} />
              <text x={x + stackW / 2} y={H - 28} textAnchor="middle" {...label}>栈{i + 1}</text>
            </g>
          );
        })
      ) : (
        <>
          {Array.from({ length: tasks }, (_, i) => (
            <rect key={i} x={14 + i * 24} y={60} width={18} height={18} rx={2} fill={COLORS[i]} opacity={0.5} />
          ))}
          <text x={14 + tasks * 24 + 4} y={73} {...label}>协程帧（KB 级）</text>
          <rect x={8} y={H - 46} width={stackW} height={28} fill="#c9c4ad" />
          <text x={8 + stackW / 2} y={H - 28} textAnchor="middle" {...label}>线程栈</text>
          <rect x={W - 110} y={H - 46} width={102} height={28} rx={3} fill="#fdf9e9" stroke="#ddc776" />
          <text x={W - 59} y={H - 28} textAnchor="middle" {...label}>用户态调度器</text>
        </>
      )}
      <text x={W / 2} y={H - 2} textAnchor="middle" {...label}>{model === "thread" ? "一个进程" : "一个进程 · 一个 OS 线程"}</text>
    </svg>
  );
}

export default function ExecutionModelViz() {
  const [model, setModel] = useState<Model>("thread");
  const [workload, setWorkload] = useState<Workload>("io");
  const [cores, setCores] = useState(2);
  const [tasks, setTasks] = useState(4);
  const [crash, setCrash] = useState(false);

  const sim = useMemo(() => simulate(model, workload, cores, tasks, crash), [model, workload, cores, tasks, crash]);
  const base = useMemo(() => ({
    process: simulate("process", workload, cores, tasks, false).ticks,
    thread: simulate("thread", workload, cores, tasks, false).ticks,
    coroutine: simulate("coroutine", workload, cores, tasks, false).ticks,
  }), [workload, cores, tasks]);

  const info = INFO[model];
  const overheadUs = sim.switches * SWITCH_COST_US[model];
  const ticks = Math.max(sim.ticks, 24);
  const W = 560;
  const rowH = 16;
  const cw = W / ticks;
  const H = tasks * rowH + 18;

  let narr = "";
  let tone: "" | "is-bad" | "is-warn" | "is-good" = "";
  if (sim.killed) {
    narr = `任务 ${Math.min(3, tasks)} 在第 ${sim.crashedAt! + 1} 个时间片段错误。${info.name}共享同一个地址空间，内核只能杀掉整个进程，其他任务一起没了。感知、规划、控制分成独立进程，就是为了避免这一幕。`;
    tone = "is-bad";
  } else if (sim.crashedAt !== null) {
    narr = `任务 ${Math.min(3, tasks)} 在第 ${sim.crashedAt + 1} 个时间片段错误，但它有自己的地址空间，内核只回收它一个。其余任务照常跑完。这就是用进程做故障隔离的意义。`;
    tone = "is-good";
  } else if (model === "coroutine" && workload === "cpu") {
    narr = `协程只有一个 OS 线程，而且没有人能打断正在算的任务：没有 await，就没有切换点。${cores} 个核里只用了 1 个，总时间 ${sim.ticks} 对比线程的 ${base.thread}。CPU 密集的活不要交给协程。`;
    tone = "is-warn";
  } else if (model === "coroutine") {
    narr = `每个任务一碰到 IO 就主动让出，用户态调度器立刻换下一个，${sim.switches} 次切换总共只花了约 ${overheadUs.toFixed(1)} µs。时间线和线程几乎一样，差别在每次切换的代价和每个任务的内存，这就是它能撑上万个连接的原因。`;
  } else if (workload === "cpu") {
    narr = `${tasks} 个 CPU 密集任务分到 ${cores} 个核上，内核按时间片轮转，谁也不用让谁。总时间 ${sim.ticks}，协程做同样的事要 ${base.coroutine}。${model === "process" ? "代价是每次切换都要换地址空间，TLB 要重新热。" : "线程共享地址空间，切换只换寄存器和栈。"}`;
  } else {
    narr = `任务一进 IO 等待，内核就把核让给别的任务，${cores} 个核几乎没闲着。${sim.switches} 次切换，每次约 ${SWITCH_COST_US[model]} µs。${model === "process" ? "进程切换最贵，因为要换页表。" : "和协程的时间线一样，但每个线程要占一个栈，内核也要为每次切换介入。"}`;
  }

  return (
    <VisualizationFrame
      title="执行模型对比器：进程、线程、协程"
      description="同一批任务，换一种执行模型，看内存布局和调度时间线怎么变。任务由 CPU 计算段和 IO 等待段组成；勾上“任务 3 崩溃”看故障隔离。"
      footnote={<>时间线按抽象时间片画，切换成本按典型数量级估算：进程 ≈ 3 µs、线程 ≈ 1 µs、协程 ≈ 0.05 µs。真实数字取决于硬件和内核，但相对关系稳定。</>}
    >
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="执行模型">
          {(["process", "thread", "coroutine"] as Model[]).map((m) => (
            <button key={m} type="button" className={`viz-chip${model === m ? " is-on" : ""}`} onClick={() => setModel(m)}>{INFO[m].name}</button>
          ))}
        </div>
        <label><span className="viz-k">负载</span>
          <select value={workload} onChange={(e) => setWorkload(e.target.value as Workload)}>
            <option value="io">IO 密集（算 2，等 5）</option>
            <option value="cpu">CPU 密集（算 12）</option>
          </select>
        </label>
        <label><span className="viz-k">核数</span><input type="range" min={1} max={4} value={cores} onChange={(e) => setCores(Number(e.target.value))} /><span className="viz-mono">{cores}</span></label>
        <label><span className="viz-k">任务数</span><input type="range" min={2} max={8} value={tasks} onChange={(e) => setTasks(Number(e.target.value))} /><span className="viz-mono">{tasks}</span></label>
        <label className="viz-check"><input type="checkbox" checked={crash} onChange={(e) => setCrash(e.target.checked)} />任务 {Math.min(3, tasks)} 崩溃</label>
      </div>

      <div className="viz-grid2 wide-left">
        <div className="viz-panel">
          <h5>调度时间线</h5>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${info.name}模式下 ${tasks} 个任务的时间线，共 ${sim.ticks} 个时间片，${sim.switches} 次切换。`}>
            {sim.rows.map((row, i) => (
              <g key={i}>
                <text x={0} y={i * rowH + 11} fontSize={9} fill="#76796f">T{i + 1}</text>
                {row.map((cell, t) => {
                  if (cell === null) return null;
                  const x = 18 + t * ((W - 18) / ticks);
                  const w = (W - 18) / ticks;
                  if (cell === "dead") return <text key={t} x={x + w / 2} y={i * rowH + 12} fontSize={11} textAnchor="middle" fill="#d03b3b">✕</text>;
                  return <rect key={t} x={x} y={i * rowH + 2} width={Math.max(w - 1, 1)} height={rowH - 4} rx={1}
                    fill={cell === "run" ? COLORS[i] : cell === "io" ? COLORS[i] : "#d9d5c4"} opacity={cell === "run" ? 1 : cell === "io" ? 0.22 : 1} />;
                })}
              </g>
            ))}
            {Array.from({ length: Math.floor(ticks / 6) + 1 }, (_, k) => (
              <text key={k} x={18 + k * 6 * cw} y={H - 2} fontSize={8} fill="#a8a693">{k * 6}</text>
            ))}
          </svg>
          <div className="viz-legend"><span><i style={{ background: "#2a78d6" }} />在核上运行</span><span><i style={{ background: "#2a78d6", opacity: 0.22 }} />等 IO</span><span><i style={{ background: "#d9d5c4" }} />就绪但没核</span><span><b style={{ color: "#d03b3b" }}>✕</b> 段错误</span></div>
        </div>
        <div className="viz-panel">
          <h5>内存布局 · {info.name}</h5>
          <MemoryLayout model={model} tasks={tasks} />
        </div>
      </div>

      <table className="viz-table">
        <thead><tr><th></th><th>进程</th><th>线程</th><th>协程</th></tr></thead>
        <tbody>
          <tr><td>谁来调度</td>{(["process", "thread", "coroutine"] as Model[]).map((m) => <td key={m} style={m === model ? { fontWeight: 600 } : undefined}>{INFO[m].scheduler}</td>)}</tr>
          <tr><td>总时间（时间片）</td>{(["process", "thread", "coroutine"] as Model[]).map((m) => <td key={m} className="num" style={m === model ? { fontWeight: 600 } : undefined}>{base[m]}</td>)}</tr>
          <tr><td>每次切换</td>{(["process", "thread", "coroutine"] as Model[]).map((m) => <td key={m} style={m === model ? { fontWeight: 600 } : undefined}>≈ {SWITCH_COST_US[m]} µs，{INFO[m].switchNote}</td>)}</tr>
          <tr><td>每个任务的内存</td>{(["process", "thread", "coroutine"] as Model[]).map((m) => <td key={m} style={m === model ? { fontWeight: 600 } : undefined}>{INFO[m].memory}</td>)}</tr>
          <tr><td>一个任务崩溃</td>{(["process", "thread", "coroutine"] as Model[]).map((m) => <td key={m} style={m === model ? { fontWeight: 600 } : undefined}>{INFO[m].isolation}</td>)}</tr>
        </tbody>
      </table>
      <p className="viz-k" style={{ marginTop: 8 }}>当前：{sim.switches} 次切换 × {SWITCH_COST_US[model]} µs ≈ {overheadUs.toFixed(2)} µs 切换开销，{sim.ticks} 个时间片完成。</p>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

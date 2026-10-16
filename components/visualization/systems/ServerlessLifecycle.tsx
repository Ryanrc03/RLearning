"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Phase = "gateway" | "cold" | "run" | "warm" | "idle" | "gone";
type Step = { phase: Phase; title: string; narr: string; ms: string; tone?: "is-warn" | "is-bad" | "is-good"; instance: "none" | "starting" | "hot" | "idle" };

const PHASES: { id: Phase; label: string }[] = [
  { id: "gateway", label: "请求到网关" },
  { id: "cold", label: "冷启动" },
  { id: "run", label: "执行函数" },
  { id: "warm", label: "热实例复用" },
  { id: "idle", label: "保温等待" },
  { id: "gone", label: "回收" },
];

const STEPS: Step[] = [
  { phase: "gateway", title: "第一个请求到达", narr: "用户上传了一张图，触发“生成缩略图”这个函数。请求先到云厂商的网关，网关查：有没有这个函数的热实例在跑？没有，一个都没有。", ms: "t = 0", instance: "none" },
  { phase: "cold", title: "冷启动：从零起一个实例", narr: "网关找一台空闲机器，拉代码包、启动运行时（Node、Python 或 Java 的虚拟机）、执行你的初始化代码（建数据库连接、加载模型）。这一整段叫冷启动，Python 几百毫秒，Java 可能两三秒。用户在等。", ms: "+ 300 ms 到 3 s", tone: "is-warn", instance: "starting" },
  { phase: "run", title: "执行函数", narr: "实例起来了，把请求交给你的 handler 函数。它读图、缩放、写回对象存储，返回。真正干活的只有这一段。", ms: "+ 120 ms", instance: "hot" },
  { phase: "idle", title: "返回后实例不立刻销毁", narr: "函数返回，响应给用户。但厂商不会马上回收实例，而是让它保温几分钟，赌下一个请求很快会来。保温期间你不付钱（大多数厂商），厂商自己承担这个赌注。", ms: "保温 5 到 15 分钟", instance: "idle" },
  { phase: "warm", title: "第二个请求：直接用热实例", narr: "两秒后又来一张图。网关看到有热实例，直接把请求交给它，跳过冷启动。这次只花执行的 120 毫秒。请求连续时，绝大多数都是热的。", ms: "+ 120 ms", tone: "is-good", instance: "hot" },
  { phase: "gone", title: "空闲太久，回收", narr: "十五分钟没有新请求，实例被销毁，机器还给别人用。下一个请求来时又要冷启动。这就是 serverless 的核心交易：没流量时不占资源不花钱，代价是久违的第一个请求要等。", ms: "实例数回到 0", tone: "is-bad", instance: "none" },
];

const C1 = "#2a78d6";
const LINE = "#76796f";

export default function ServerlessLifecycle() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const W = 640;
  const pw = W / PHASES.length;
  const inst = step.instance;
  return (
    <VisualizationFrame
      title="一次调用的生命周期：冷启动、热实例、回收"
      description="跟着两个请求走一遍。上面是调用经过的阶段，下面是那个实例的状态。"
    >
      <div className="viz-controls">
        <button type="button" className="viz-btn" disabled={i === 0} onClick={() => setI(i - 1)}>← 上一步</button>
        <span className="viz-mono">第 {i + 1} / {STEPS.length} 步</span>
        <button type="button" className="viz-btn primary" disabled={i === STEPS.length - 1} onClick={() => setI(i + 1)}>下一步 →</button>
        <button type="button" className="viz-btn" onClick={() => setI(0)}>回到开头</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} 132`} role="img" aria-label={`${step.title}。${step.narr}`}>
          {PHASES.map((p, k) => {
            const on = p.id === step.phase;
            return (
              <g key={p.id} transform={`translate(${k * pw} 0)`}>
                <rect x={3} y={6} width={pw - 6} height={30} rx={6} fill={on ? C1 : "#fff"} stroke={on ? C1 : "#e4dfcb"} strokeWidth={on ? 2 : 1} />
                <text x={pw / 2} y={25} fontSize={10.5} fontWeight={on ? 700 : 500} textAnchor="middle" fill={on ? "#fff" : "#30332c"}>{p.label}</text>
                {k < PHASES.length - 1 && <text x={pw - 2} y={25} fontSize={11} textAnchor="middle" fill="#c9c4ad">›</text>}
              </g>
            );
          })}
          <text x={0} y={60} fontSize={10} fill={LINE}>实例状态</text>
          <rect x={70} y={48} width={200} height={34} rx={6} fill={inst === "none" ? "#f3f1e8" : inst === "starting" ? "#fdf3e3" : inst === "hot" ? "#eef5fd" : "#f3f7f3"} stroke={inst === "none" ? "#e4dfcb" : inst === "starting" ? "#eda100" : inst === "hot" ? C1 : "#1baf7a"} strokeDasharray={inst === "none" ? "3 3" : undefined} strokeWidth={1.5} />
          <text x={170} y={69} fontSize={11} fontWeight={600} textAnchor="middle" fill={inst === "none" ? "#a8a693" : "#30332c"}>
            {inst === "none" ? "没有实例（0 台）" : inst === "starting" ? "正在启动：拉代码、起运行时、初始化" : inst === "hot" ? "热实例：正在执行 handler" : "热实例：空闲保温中"}
          </text>
          <text x={290} y={69} fontSize={10.5} fill={LINE}>耗时：<tspan fontWeight={600} fill="#30332c">{step.ms}</tspan></text>
          <text x={0} y={112} fontSize={10} fill={LINE}>计费</text>
          <text x={70} y={112} fontSize={10.5} fill="#30332c">{inst === "hot" ? "按这次执行的毫秒数和内存计费" : inst === "starting" ? "多数厂商冷启动不计费，但用户在等" : "不计费"}</text>
        </svg>
      </div>
      <div className={`viz-narr${step.tone ? ` ${step.tone}` : ""}`}><b>{step.title}</b>　{step.narr}</div>
    </VisualizationFrame>
  );
}

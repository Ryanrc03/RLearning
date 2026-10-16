"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "compute" | "bandwidth";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const GREY = "#efede4";
const LINE = "#76796f";
const INK = "#3b4234";
const BAD = "#d03b3b";

const SCALE = 2.2;

function Bar({ x, y, label, value, color, bottleneck }: { x: number; y: number; label: string; value: number; color: string; bottleneck: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <text x={0} y={-4} fontSize={9.5} fill={LINE}>{label}</text>
      <rect width={80 * SCALE} height={16} rx={3} fill={GREY} />
      <rect width={value * SCALE} height={16} rx={3} fill={color} opacity={0.75} stroke={bottleneck ? BAD : "none"} strokeWidth={1.5} />
      <text x={80 * SCALE + 8} y={12} fontSize={10} className="mono" fill={bottleneck ? BAD : INK}>{value}{bottleneck ? " ← 瓶颈" : ""}</text>
    </g>
  );
}

function Kernel({ x, title, sub, mem, comp, base }: { x: number; title: string; sub: string; mem: number; comp: number; base: number }) {
  const time = Math.max(mem, comp);
  const faster = time < base;
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={135} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>{title}</text>
      <rect x={0} y={24} width={270} height={150} rx={6} fill="#fff" stroke={INK} strokeWidth={1.2} />
      <text x={12} y={42} fontSize={9.5} fill={LINE}>{sub}</text>
      <g transform="translate(12 0)">
        <Bar x={0} y={70} label="搬数据要的时间" value={mem} color={C1} bottleneck={mem >= comp} />
        <Bar x={0} y={110} label="计算要的时间" value={comp} color={C2} bottleneck={comp > mem} />
      </g>
      <text x={12} y={158} fontSize={10.5} fill={faster ? "#087a08" : INK}>
        总耗时 ≈ 较长的那个：<tspan className="mono">{time}</tspan>
        {faster ? `（原来 ${base}）` : ""}
      </text>
    </g>
  );
}

export default function ComputeVsMemoryBoundDiagram() {
  const [action, setAction] = useState<Action>("none");
  const W = 600;
  const H = 200;
  const compute = action === "compute";
  const bandwidth = action === "bandwidth";
  const k = (v: number, halve: boolean) => (halve ? v / 2 : v);

  const left = { mem: k(80, bandwidth), comp: k(20, compute) };
  const right = { mem: k(30, bandwidth), comp: k(80, compute) };

  const narr = {
    none: "两个 kernel 都同时在搬数据和做计算，两件事可以重叠，所以总耗时取较长的那个。左边每搬一个字节只算一点点，卡在搬数据上；右边每个字节要反复算很多次，卡在计算上。点上面的按钮。",
    compute: "算力翻倍，计算时间减半。左边：计算从 20 变成 10，但它本来就不是瓶颈，总耗时还是 80，一点没快。右边：计算从 80 变成 40，总耗时跟着减半。",
    bandwidth: "带宽翻倍，搬数据的时间减半。左边：从 80 变成 40，总耗时跟着减半。右边：从 30 变成 15，可它本来就在等计算，总耗时还是 80。",
  }[action];

  return (
    <VisualizationFrame
      title="Compute-bound vs Memory-bound：给哪边加资源才有用"
      description="左右是两个 kernel，各自都要搬数据和做计算。点按钮，看“算力翻倍”和“带宽翻倍”分别让谁变快。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${compute ? " is-on" : ""}`} onClick={() => setAction("compute")}>算力翻倍</button>
        <button type="button" className={`viz-btn${bandwidth ? " is-on" : ""}`} onClick={() => setAction("bandwidth")}>带宽翻倍</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr}>
          <Kernel x={10} title="memory-bound kernel" sub="每搬 1 字节只算一两次（例：小 batch）" mem={left.mem} comp={left.comp} base={80} />
          <line x1={300} y1={10} x2={300} y2={190} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Kernel x={320} title="compute-bound kernel" sub="每搬 1 字节要算很多次（例：大 batch）" mem={right.mem} comp={right.comp} base={80} />
        </svg>
      </div>
      <div className={`viz-narr${action === "none" ? "" : " is-warn"}`}>{narr}</div>
    </VisualizationFrame>
  );
}

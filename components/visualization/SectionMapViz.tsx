"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Node = { title: string; question: string; oneLiner: string; href: string };
type Section = { title: string; description: string; nodes: Node[]; story?: string[] };

const SECTIONS: Record<string, Section> = {
  fundamentals: {
    title: "CS Fundamentals：一台机器怎样同时干很多事",
    description: "三页回答同一个问题的三个层面：谁在跑、怎么等、数据放哪。点一个节点看它的一句话。",
    nodes: [
      { title: "Process vs Thread", question: "谁在跑？", oneLiner: "process 是带着自己一份内存的程序，thread 是 process 里共用这份内存的工人。", href: "/notes/cs/fundamentals/process-vs-thread/" },
      { title: "Thread vs Coroutine", question: "等的时候怎么办？", oneLiner: "thread 等就干等；coroutine 碰到等待自动让出，一个 thread 能挂几万个连接。", href: "/notes/cs/fundamentals/thread-vs-coroutine/" },
      { title: "Memory Hierarchy", question: "数据放哪？", oneLiner: "register、cache、RAM、SSD、HDD 叠成金字塔，越上越快越小，常用的往上挪。", href: "/notes/cs/fundamentals/memory-hierarchy/" },
    ],
    story: ["一个程序跑起来：先是一个 process，里面开几个 thread 吃多核，", "等 IO 的活交给 coroutine，", "数据沿着金字塔在寄存器和硬盘之间上上下下。"],
  },
  os: {
    title: "Operating Systems：内核替程序管什么",
    description: "这一章是 CS Fundamentals 的深入版：同样的概念，讲切换多贵、页表怎么翻译。点一个节点看它的一句话。",
    nodes: [
      { title: "进程、线程、协程，以及 CUDA 里的“线程”", question: "谁调度、切换多贵、崩了连累谁？", oneLiner: "三个问题分清三种执行模型；CUDA 的线程是 warp 里的一条 lane，硬件调度，切换零成本。", href: "/notes/cs/os/processes-threads-coroutines/" },
      { title: "Virtual Memory", question: "地址怎么翻译？", oneLiner: "每个 process 一份虚拟地址空间，页表把它翻译到物理内存，TLB 缓存最近的翻译。", href: "/notes/cs/os/virtual-memory/" },
    ],
    story: ["内核做两件事：决定谁用 CPU（调度），决定谁看到哪块内存（虚拟内存）。", "这两件事加起来，就是“进程”这个隔离边界的全部含义。"],
  },
};

const C1 = "#2a78d6";
const LINE = "#76796f";

export default function SectionMapViz({ section }: { section: keyof typeof SECTIONS }) {
  const cfg = SECTIONS[section];
  const [active, setActive] = useState(0);
  const n = cfg.nodes.length;
  const W = 760;
  const gap = 14;
  const bw = (W - gap * (n - 1)) / n;
  const H = 118;
  const node = cfg.nodes[active];
  return (
    <VisualizationFrame title={cfg.title} description={cfg.description}>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${cfg.title}，共 ${n} 页：${cfg.nodes.map((d) => d.title).join("、")}`}>
          {cfg.nodes.map((d, i) => {
            const x = i * (bw + gap);
            const on = i === active;
            return (
              <g key={d.title} transform={`translate(${x} 0)`} onClick={() => setActive(i)} style={{ cursor: "pointer" }}>
                <rect x={0} y={18} width={bw} height={72} rx={7} fill={on ? "#eef5fd" : "#fff"} stroke={on ? C1 : "#e4dfcb"} strokeWidth={on ? 2 : 1.2} />
                <text x={bw / 2} y={12} fontSize={9} textAnchor="middle" fill={LINE}>第 {i + 1} 页</text>
                <foreignObject x={6} y={24} width={bw - 12} height={62}>
                  <div style={{ fontSize: 11, lineHeight: 1.35, color: "#30332c", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: 4 }}>
                    <b style={{ color: on ? C1 : "#30332c" }}>{d.title}</b>
                    <span style={{ fontSize: 10, color: LINE }}>{d.question}</span>
                  </div>
                </foreignObject>
                {i < n - 1 && <text x={bw + gap / 2} y={58} fontSize={12} textAnchor="middle" fill="#c9c4ad">›</text>}
              </g>
            );
          })}
          <text x={0} y={110} fontSize={9} fill={LINE}>点任意一页</text>
        </svg>
      </div>
      <div className="viz-narr">
        <b>{node.title}</b>　{node.oneLiner}　<a href={node.href}>去读这页 →</a>
      </div>
      {cfg.story && (
        <div className="viz-panel" style={{ marginTop: 12 }}>
          <h5>串起来</h5>
          <p>{cfg.story.join("")}</p>
        </div>
      )}
    </VisualizationFrame>
  );
}

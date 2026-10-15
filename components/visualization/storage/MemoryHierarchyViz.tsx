"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type TierId = "reg" | "cache" | "ram" | "ssd" | "hdd";
type Tier = { id: TierId; name: string; where: string; size: string; latencyNs: number; latency: string; volatile: boolean; manager: string };
type Step = { id: "none" | "first" | "second" | "power"; narr: string; tone?: "is-warn" | "is-bad" | "is-good"; has: TierId[]; path: TierId[]; found?: TierId; lost?: TierId[] };

const TIERS: Tier[] = [
  { id: "reg", name: "register", where: "CPU 核心里", size: "几百字节", latencyNs: 0.3, latency: "< 1 ns", volatile: true, manager: "编译器" },
  { id: "cache", name: "cache", where: "CPU 芯片上", size: "几 MB", latencyNs: 3, latency: "1 到 40 ns", volatile: true, manager: "硬件自动" },
  { id: "ram", name: "RAM", where: "内存条", size: "几十 GB", latencyNs: 100, latency: "≈ 100 ns", volatile: true, manager: "操作系统" },
  { id: "ssd", name: "SSD", where: "主板上", size: "几 TB", latencyNs: 100000, latency: "≈ 100 µs", volatile: false, manager: "文件系统" },
  { id: "hdd", name: "HDD", where: "机箱里", size: "十几 TB", latencyNs: 10000000, latency: "≈ 10 ms", volatile: false, manager: "文件系统" },
];

const STEPS: Record<Step["id"], Step> = {
  none: { id: "none", narr: "文件 x 存在 SSD 上。CPU 要读它时，会从最上面一层开始找，找不到就往下一层。先点“第一次读 x”。", has: ["ssd"], path: [] },
  first: { id: "first", tone: "is-warn", narr: "register 没有，cache 没有，RAM 也没有，一路找到 SSD，等了约 100 µs。拿到以后，x 被沿途抄进 RAM 和 cache，再放进 register 参与计算。上面几层现在都有了 x 的影子，SSD 上的那份没动。", has: ["ssd", "ram", "cache", "reg"], path: ["reg", "cache", "ram", "ssd"], found: "ssd" },
  second: { id: "second", tone: "is-good", narr: "这次在 cache 就找到了，约 1 ns，比第一次快 10 万倍。程序里绝大多数读都是“再读一次”，这就是整座金字塔的意义：把最近用过的东西留在上面。", has: ["ssd", "ram", "cache", "reg"], path: ["reg", "cache"], found: "cache" },
  power: { id: "power", tone: "is-bad", narr: "断电。register、cache、RAM 靠电维持内容，全部清空。SSD 和 HDD 靠闪存或磁记录，x 还在。没保存就断电，丢的就是上面三层里改过的东西。", has: ["ssd"], path: [], lost: ["reg", "cache", "ram"] },
};

const C1 = "#2a78d6";
const C2 = "#eb6834";
const ROW_H = 44;
const GAP = 10;
const W = 770;

export default function MemoryHierarchyViz() {
  const [stepId, setStepId] = useState<Step["id"]>("none");
  const step = STEPS[stepId];
  const H = 26 + TIERS.length * (ROW_H + GAP) + 4;
  const logMin = Math.log10(0.3);
  const logMax = Math.log10(10000000);
  const barW = (ns: number) => 20 + ((Math.log10(ns) - logMin) / (logMax - logMin)) * 150;
  const rowY = (i: number) => 26 + i * (ROW_H + GAP);

  return (
    <VisualizationFrame
      title="存储金字塔：一次读取怎样从上找到下"
      description="从 register 到 HDD 共五层，越上越快越小。右侧 VRAM 是 GPU 自己的一套，和 RAM 平级。点按钮看一次读取经过哪几层、第二次为什么快、断电丢哪几层。"
      footnote={<>延迟条按对数刻度画：每下一层大约慢 100 倍，容量也大约大 100 倍。数字是典型量级，不同机器会有出入。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${stepId === "first" ? " is-on" : ""}`} onClick={() => setStepId("first")}>第一次读 x</button>
        <button type="button" className={`viz-btn${stepId === "second" ? " is-on" : ""}`} onClick={() => setStepId("second")} disabled={stepId === "none" || stepId === "power"}>再读一次 x</button>
        <button type="button" className={`viz-btn${stepId === "power" ? " is-on" : ""}`} onClick={() => setStepId("power")}>断电</button>
        <button type="button" className="viz-btn" onClick={() => setStepId("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={step.narr}>
          <text x={14} y={14} fontSize={9} fill="#8e8d78">层</text>
          <text x={182} y={14} fontSize={9} fill="#8e8d78">本次查找</text>
          <text x={244} y={14} fontSize={9} fill="#8e8d78">容量</text>
          <text x={316} y={14} fontSize={9} fill="#8e8d78">一次访问要等（对数刻度）</text>
          <text x={548} y={14} fontSize={9} fill="#8e8d78">断电</text>
          <text x={588} y={14} fontSize={9} fill="#8e8d78">谁来管</text>
          {TIERS.map((t, i) => {
            const y = rowY(i);
            const inPath = step.path.includes(t.id);
            const found = step.found === t.id;
            const lost = step.lost?.includes(t.id);
            const has = step.has.includes(t.id);
            const width = 116 + i * 8;
            return (
              <g key={t.id} transform={`translate(0 ${y})`}>
                <rect x={14} y={0} width={width} height={ROW_H} rx={5} fill={lost ? "#f5e3e3" : found ? "#eef5fd" : "#fff"} stroke={found ? C1 : lost ? "#d03b3b" : inPath ? "#c9c4ad" : "#e4dfcb"} strokeWidth={found ? 2 : 1.2} />
                <text x={22} y={17} fontSize={11} fontWeight={600} fill="#30332c">{t.name}</text>
                <text x={22} y={31} fontSize={8.5} fill="#76796f">{t.where}</text>
                {has && (
                  <g>
                    <rect x={width - 22} y={12} width={26} height={18} rx={3} fill={lost ? "#f5e3e3" : C1} stroke={lost ? "#d03b3b" : "none"} />
                    <text x={width - 9} y={25} fontSize={10} fontWeight={600} textAnchor="middle" fill={lost ? "#d03b3b" : "#fff"}>{lost ? "✕" : "x"}</text>
                  </g>
                )}
                {inPath && !found && <text x={182} y={27} fontSize={9.5} fill={C2}>没有，往下 ↓</text>}
                {found && <text x={182} y={27} fontSize={9.5} fontWeight={600} fill={C1}>找到了</text>}
                {lost && <text x={182} y={27} fontSize={9.5} fill="#d03b3b">清空</text>}
                <text x={244} y={27} fontSize={10} fill="#30332c" className="mono">{t.size}</text>
                <rect x={316} y={14} width={barW(t.latencyNs)} height={16} rx={3} fill={found ? C1 : "#d9d5c4"} />
                <text x={316 + barW(t.latencyNs) + 6} y={26} fontSize={9.5} fill={found ? C1 : "#76796f"}>{t.latency}</text>
                <text x={548} y={27} fontSize={10} fill={t.volatile ? "#d03b3b" : "#0ca30c"}>{t.volatile ? "丢" : "留"}</text>
                <text x={588} y={27} fontSize={10} fill="#30332c">{t.manager}</text>
              </g>
            );
          })}
          <g transform={`translate(${W - 110} ${rowY(1) + 8})`}>
            <rect x={0} y={0} width={100} height={ROW_H * 2 - 6} rx={5} fill="#fdf9e9" stroke="#ddc776" />
            <text x={8} y={16} fontSize={10} fontWeight={600} fill="#30332c">VRAM（显存）</text>
            <text x={8} y={30} fontSize={8.5} fill="#76796f">GPU 自己的 RAM</text>
            <text x={8} y={42} fontSize={8.5} fill="#76796f">几十 GB，和 RAM 平级</text>
            <text x={8} y={54} fontSize={8.5} fill="#76796f">带宽是 RAM 的 10 倍以上</text>
            <text x={8} y={66} fontSize={8.5} fill="#76796f">数据要经 PCIe 搬进来</text>
            <text x={8} y={78} fontSize={8.5} fill="#d03b3b">断电：丢</text>
          </g>
        </svg>
      </div>
      <div className={`viz-narr${step.tone ? ` ${step.tone}` : ""}`}>{step.narr}</div>
    </VisualizationFrame>
  );
}

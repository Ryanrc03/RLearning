"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

// Draft: pairwise storage comparisons. Used only by content/drafts/cs-fundamentals/*.mdx (not registered).

type Tier = { id: string; name: string; sub?: string; kind: "proc" | "store"; slots?: number };
type Col = { name: string; tiers: Tier[] };
type Move = { from: string; to: string; label: string };
type ColState = { data: Record<string, string[]>; lost?: string[]; fetch?: Move; copy?: Move; note: string };
type Action = { label: string; narr: string; tone?: "is-warn" | "is-bad" | "is-good"; left: ColState; right: ColState };
export type Pair = { title: string; description: string; left: Col; right: Col; initial: { left: ColState; right: ColState; narr: string }; actions: Action[] };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const TIER_H = 52;
const GAP = 16;
const COL_W = 270;

const PAIRS: Record<string, Pair> = {
  "cache-vs-ram": {
    title: "Cache vs RAM：影子和本体",
    description: "两台机器都要读同一个数据 x，左边有 cache，右边没有。点两次“读 x”，看第二次差在哪。",
    left: { name: "有 cache 的机器", tiers: [{ id: "cpu", name: "CPU", kind: "proc" }, { id: "cache", name: "cache", sub: "几十 KB，在 CPU 旁边", kind: "store", slots: 4 }, { id: "ram", name: "RAM", sub: "几十 GB", kind: "store", slots: 8 }] },
    right: { name: "没有 cache 的机器", tiers: [{ id: "cpu", name: "CPU", kind: "proc" }, { id: "ram", name: "RAM", sub: "几十 GB", kind: "store", slots: 8 }] },
    initial: { left: { data: { ram: ["x"] }, note: "x 只在 RAM 里" }, right: { data: { ram: ["x"] }, note: "x 只在 RAM 里" }, narr: "x 一开始都在 RAM 里。左边多了一个 cache，它现在是空的。点“第一次读 x”。" },
    actions: [
      { label: "第一次读 x", narr: "两边都得去 RAM 取，各等约 100 ns。但左边顺手把 x 抄了一份放进 cache。注意 x 没有搬走，RAM 里还有，cache 里的只是影子。", left: { data: { ram: ["x"], cache: ["x"] }, fetch: { from: "ram", to: "cpu", label: "≈ 100 ns" }, copy: { from: "ram", to: "cache", label: "抄一份" }, note: "miss：去 RAM 取，顺手放进 cache" }, right: { data: { ram: ["x"] }, fetch: { from: "ram", to: "cpu", label: "≈ 100 ns" }, note: "去 RAM 取" } },
      { label: "第二次读 x", tone: "is-good", narr: "左边在 cache 里直接找到 x，约 1 ns。右边还是去 RAM，又等 100 ns。程序里绝大多数读都是“再读一次”，所以 cache 让机器快了几十倍，而你的代码一行没改。", left: { data: { ram: ["x"], cache: ["x"] }, fetch: { from: "cache", to: "cpu", label: "≈ 1 ns" }, note: "hit：cache 里有，不用去 RAM" }, right: { data: { ram: ["x"] }, fetch: { from: "ram", to: "cpu", label: "≈ 100 ns" }, note: "还是去 RAM 取" } },
    ],
  },
  "ram-vs-disk": {
    title: "RAM vs Disk：工作台和仓库",
    description: "同一份文档，左边放在 RAM 里，右边存在硬盘上。点“读一次”看快慢，点“断电”看谁还在。",
    left: { name: "文档在 RAM 里", tiers: [{ id: "cpu", name: "CPU", kind: "proc" }, { id: "ram", name: "RAM", sub: "几十 GB，断电就空", kind: "store", slots: 6 }] },
    right: { name: "文档在硬盘上", tiers: [{ id: "cpu", name: "CPU", kind: "proc" }, { id: "ssd", name: "SSD / 硬盘", sub: "几 TB，断电还在", kind: "store", slots: 6 }] },
    initial: { left: { data: { ram: ["文档"] }, note: "在 RAM 里" }, right: { data: { ssd: ["文档"] }, note: "在硬盘上" }, narr: "左边的文档在 RAM 里，右边的在硬盘上。两边的 CPU 都想读它。" },
    actions: [
      { label: "读一次", narr: "左边约 100 ns 拿到。右边约 100 µs，慢 1000 倍；如果是机械硬盘，再慢 100 倍。所以程序干活时会把文件先读进 RAM，在 RAM 里改，改完再写回去。", left: { data: { ram: ["文档"] }, fetch: { from: "ram", to: "cpu", label: "≈ 100 ns" }, note: "直接读" }, right: { data: { ssd: ["文档"] }, fetch: { from: "ssd", to: "cpu", label: "≈ 100 µs，慢 1000 倍" }, note: "等硬盘" } },
      { label: "断电", tone: "is-bad", narr: "左边：RAM 靠电维持内容，断电后文档没了。右边：硬盘靠磁或闪存记录，断电后还在。“没保存就断电”丢的就是 RAM 里那一份。", left: { data: { ram: ["文档"] }, lost: ["ram"], note: "✕ 丢了" }, right: { data: { ssd: ["文档"] }, note: "还在" } },
    ],
  },
  "ram-vs-vram": {
    title: "RAM vs VRAM：各管各的内存",
    description: "一块数据，左边放在 RAM 里，右边放在显存里。分别让 GPU 和 CPU 去用它，看谁要搬家。",
    left: { name: "数据在 RAM 里", tiers: [{ id: "cpu", name: "CPU", kind: "proc" }, { id: "ram", name: "RAM", sub: "CPU 的内存", kind: "store", slots: 5 }, { id: "vram", name: "VRAM（显存）", sub: "GPU 的内存，带宽是 RAM 的 10 倍以上", kind: "store", slots: 5 }, { id: "gpu", name: "GPU", kind: "proc" }] },
    right: { name: "数据在 VRAM 里", tiers: [{ id: "cpu", name: "CPU", kind: "proc" }, { id: "ram", name: "RAM", sub: "CPU 的内存", kind: "store", slots: 5 }, { id: "vram", name: "VRAM（显存）", sub: "GPU 的内存", kind: "store", slots: 5 }, { id: "gpu", name: "GPU", kind: "proc" }] },
    initial: { left: { data: { ram: ["数据"] }, note: "在 RAM 里" }, right: { data: { vram: ["数据"] }, note: "在 VRAM 里" }, narr: "CPU 只能读 RAM，GPU 只能读 VRAM。两者之间隔着一条 PCIe 总线。点按钮看谁要搬家。" },
    actions: [
      { label: "GPU 要算这块数据", tone: "is-warn", narr: "左边：数据在 RAM，GPU 碰不到，得先经 PCIe 拷贝进 VRAM，1 GB 大约要几十毫秒。右边：数据本来就在 VRAM，GPU 直接读，几百纳秒。AI 训练里“把数据搬进 GPU”慢，就是左边这一步。", left: { data: { ram: ["数据"], vram: ["数据"] }, copy: { from: "ram", to: "vram", label: "PCIe 拷贝，≈ 几十 ms / GB" }, fetch: { from: "vram", to: "gpu", label: "再读" }, note: "先搬进 VRAM" }, right: { data: { vram: ["数据"] }, fetch: { from: "vram", to: "gpu", label: "≈ 500 ns" }, note: "直接读" } },
      { label: "CPU 要读这块数据", tone: "is-warn", narr: "反过来也一样。左边 CPU 直接读 RAM。右边数据在 VRAM，CPU 看不见，得先拷回 RAM。所以显存和内存是平级的两块地，各归一个处理器，谁都不是谁的上层。", left: { data: { ram: ["数据"] }, fetch: { from: "ram", to: "cpu", label: "≈ 100 ns" }, note: "直接读" }, right: { data: { vram: ["数据"], ram: ["数据"] }, copy: { from: "vram", to: "ram", label: "PCIe 拷回" }, fetch: { from: "ram", to: "cpu", label: "再读" }, note: "先搬回 RAM" } },
    ],
  },
  "register-vs-cache": {
    title: "Register vs Cache：编译器安排的，和硬件自动的",
    description: "都是 CPU 里最快的那几层。左边看寄存器，右边看 cache，分别让它们处理一个小算式和一堆变量。",
    left: { name: "寄存器（register）", tiers: [{ id: "cpu", name: "CPU 运算单元", kind: "proc" }, { id: "reg", name: "寄存器", sub: "十几个，每个 8 字节，指令直接点名", kind: "store", slots: 6 }, { id: "ram", name: "RAM", kind: "store", slots: 6 }] },
    right: { name: "cache", tiers: [{ id: "cpu", name: "CPU 运算单元", kind: "proc" }, { id: "cache", name: "cache", sub: "几十 KB，程序看不见", kind: "store", slots: 6 }, { id: "ram", name: "RAM", kind: "store", slots: 6 }] },
    initial: { left: { data: { ram: ["a", "b"] }, note: "a、b 在 RAM 里" }, right: { data: { ram: ["a", "b"] }, note: "a、b 在 RAM 里" }, narr: "要算 a + b。左边靠寄存器，右边靠 cache。两个都比 RAM 快得多，差别在谁来决定放什么。" },
    actions: [
      { label: "算 a + b", narr: "左边：编译器生成两条 load 指令，明确把 a、b 搬进两个寄存器，再做加法。哪个变量进寄存器是编译器定的。右边：CPU 读 a 时硬件自动把 a 所在的那一块抄进 cache，程序和编译器都不知道。寄存器是指令的操作对象，cache 是硬件的小动作。", left: { data: { ram: ["a", "b"], reg: ["a", "b"] }, copy: { from: "ram", to: "reg", label: "load r1,a / load r2,b" }, fetch: { from: "reg", to: "cpu", label: "< 1 ns" }, note: "编译器点名搬" }, right: { data: { ram: ["a", "b"], cache: ["a", "b"] }, copy: { from: "ram", to: "cache", label: "硬件自动" }, fetch: { from: "cache", to: "cpu", label: "≈ 1 ns" }, note: "硬件自动抄" } },
      { label: "变量变成 1000 个", tone: "is-warn", narr: "左边：寄存器只有十几个，装不下，编译器只能把多出来的变量放回 RAM，用到再搬，叫 spill。右边：cache 有几十 KB，1000 个整数轻松装下，硬件照样自动管理。所以寄存器快但极少，cache 稍慢但大得多。", left: { data: { ram: ["…"], reg: ["v1", "v2", "v3", "v4", "v5", "v6"] }, copy: { from: "reg", to: "ram", label: "装不下的 spill 回 RAM" }, note: "满了" }, right: { data: { ram: ["…"], cache: ["v1", "v2", "v3", "…", "v999", "v1000"] }, copy: { from: "ram", to: "cache", label: "硬件自动" }, note: "装得下" } },
    ],
  },
};

function Column({ col, state, x, color }: { col: Col; state: ColState; x: number; color: string }) {
  const tierY = (i: number) => 24 + i * (TIER_H + GAP);
  const idx = Object.fromEntries(col.tiers.map((t, i) => [t.id, i]));
  const mid = (id: string) => tierY(idx[id]) + TIER_H / 2;
  const arrow = (m: Move, side: "left" | "right", stroke: string) => {
    const ax = side === "left" ? 12 : COL_W - 12;
    const y1 = mid(m.from);
    const y2 = mid(m.to);
    const tx = side === "left" ? ax + 5 : ax - 5;
    return (
      <g key={m.from + m.to}>
        <line x1={ax} y1={y1} x2={ax} y2={y2} stroke={stroke} strokeWidth={2} markerEnd={`url(#arr-${stroke.replace("#", "")})`} />
        <text x={tx} y={(y1 + y2) / 2 + 3} fontSize={9} fill={stroke} textAnchor={side === "left" ? "start" : "end"}>{m.label}</text>
      </g>
    );
  };
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{col.name}</text>
      {col.tiers.map((t, i) => {
        const y = tierY(i);
        const items = state.data[t.id] ?? [];
        const lost = state.lost?.includes(t.id);
        const proc = t.kind === "proc";
        return (
          <g key={t.id} transform={`translate(0 ${y})`}>
            <rect x={24} y={0} width={COL_W - 48} height={TIER_H} rx={5} fill={proc ? "#3b4234" : lost ? "#f5e3e3" : "#fff"} stroke={proc ? "#3b4234" : lost ? "#d03b3b" : color} strokeWidth={1.4} />
            <text x={32} y={proc ? 31 : 14} fontSize={10} fontWeight={600} fill={proc ? "#fff" : "#30332c"}>{t.name}</text>
            {t.sub && <text x={32} y={25} fontSize={8} fill={LINE}>{t.sub}</text>}
            {!proc && Array.from({ length: t.slots ?? 0 }, (_, s) => {
              const sw = 24;
              const sx = COL_W - 24 - 8 - (t.slots ?? 0) * (sw + 3) + s * (sw + 3);
              const item = items[s];
              return (
                <g key={s}>
                  <rect x={sx} y={31} width={sw} height={16} rx={3} fill={item ? (lost ? "#f5e3e3" : color) : "#f3f1e8"} opacity={item && !lost ? 0.85 : 1} stroke={item ? "none" : "#e4dfcb"} />
                  {item && <text x={sx + sw / 2} y={43} fontSize={9} textAnchor="middle" fill={lost ? "#d03b3b" : "#fff"} fontWeight={600}>{lost ? "✕" : item}</text>}
                </g>
              );
            })}
          </g>
        );
      })}
      {state.copy && arrow(state.copy, "right", C2)}
      {state.fetch && arrow(state.fetch, "left", color)}
      <text x={COL_W / 2} y={tierY(col.tiers.length) + 2} fontSize={9.5} textAnchor="middle" fill={state.lost?.length ? "#d03b3b" : LINE}>{state.note}</text>
    </g>
  );
}

export default function StoragePairDiagram({ pair }: { pair: keyof typeof PAIRS }) {
  const cfg = PAIRS[pair];
  const [step, setStep] = useState(-1);
  const act = step >= 0 ? cfg.actions[step] : null;
  const left = act ? act.left : cfg.initial.left;
  const right = act ? act.right : cfg.initial.right;
  const narr = act ? act.narr : cfg.initial.narr;
  const rows = Math.max(cfg.left.tiers.length, cfg.right.tiers.length);
  const H = 24 + rows * (TIER_H + GAP) + 6;
  const W = COL_W * 2 + 20;
  return (
    <VisualizationFrame title={cfg.title} description={cfg.description}>
      <div className="viz-controls">
        {cfg.actions.map((a, i) => (
          <button key={a.label} type="button" className={`viz-btn${step === i ? " is-on" : ""}`} onClick={() => setStep(i)}>{a.label}</button>
        ))}
        <button type="button" className="viz-btn" onClick={() => setStep(-1)}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr}>
          <defs>
            {[C1, C2].map((c) => (
              <marker key={c} id={`arr-${c.replace("#", "")}`} viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={c} /></marker>
            ))}
          </defs>
          <Column col={cfg.left} state={left} x={0} color={C1} />
          <line x1={W / 2} y1={6} x2={W / 2} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column col={cfg.right} state={right} x={COL_W + 20} color={C1} />
        </svg>
      </div>
      <div className={`viz-narr${act?.tone ? ` ${act.tone}` : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}

"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GREEN = "#1baf7a";
const PURPLE = "#9b6ad6";
const GREY = "#cfcab4";
const INK = "#3b4234";
const MUTED = "#76796f";

type Stage = { title: string; body: string; where: string };

const STAGES: Stage[] = [
  {
    title: "① 一个 program 认领一块输出",
    where: "grid = (N / 64, 4)",
    body: "输出 y 是 M × N（M 是正在生成的序列数，只有 6 到 16）。每个 program 负责 64 列，再沿 K 方向切成 4 份（split-K），这样 N = 2048 的矩阵也能开出 128 个 program，喂满 3060 的 28 个 SM。",
  },
  {
    title: "② 权重保持打包，直接读进寄存器",
    where: "w_bytes: [64, 32] uint8",
    body: "NF4 权重两个数挤一个字节。每次沿 K 走 64 个数（正好是一个量化块），读 64 行 × 32 字节。全程不在显存里展开成 bf16：展开会让搬的字节数变成 4 倍，而这里本来就是在省搬运。",
  },
  {
    title: "③ 一个字节查出两个 bf16",
    where: "prmt.b32 × 7（内联 PTX）",
    body: "高 4 位和低 4 位各是 16 项码表里的一个下标。码表只有 16 个 bf16，正好放进 8 个 32 位寄存器；PTX 的 prmt 指令能按选择子从两个寄存器里挑字节，三层 prmt 树就把一个字节变成两个 bf16，不访存。",
  },
  {
    title: "④ 两次 tensor core 乘法，最后才乘缩放",
    where: "tl.dot(w_hi, xᵀ_even) + tl.dot(w_lo, xᵀ_odd)",
    body: "高 4 位对应偶数位置 k，低 4 位对应奇数位置 k。把 x 也按奇偶拆开，就能做两次普通的 dot，省掉在寄存器里交错重排。同一行在一个量化块里共用一个 absmax，所以先算部分积，再整体乘一次 absmax，乘法次数少 32 倍。",
  },
  {
    title: "⑤ split-K 的 4 份用原子加合起来",
    where: "tl.atomic_add(fp32 out)",
    body: "4 个 program 各算了 K 的四分之一，结果原子加到 fp32 缓冲区，最后转 bf16。原子加的顺序每次不一样，所以结果和 bitsandbytes 在最后几位上不同：这正是后面贪心解码在第 15 个 token 之后才开始分叉的原因。",
  },
];

// Step-through of the Triton small-M NF4 GEMM: where the data sits at each stage and why.
export default function Nf4KernelWalkthrough() {
  const [s, setS] = useState(0);
  const on = (i: number) => (s === i ? 1 : 0.28);

  return (
    <VisualizationFrame
      title="Triton NF4 GEMM 一步一步怎么算"
      description="y = x · Wᵀ，x 是 M × K 的激活（bf16），W 是 N × K 的 NF4 权重。按「下一步」看每个阶段数据在哪、为什么这么做。"
      footnote="代码：Chasing-the-Aha-Moment 仓库 src/aha/kernels/nf4_gemm.py。块大小 BLOCK_N = 64、BLOCK_K = 64、split-K = 4、4 个 warp，是在 3060 上扫过的最优组合。"
    >
      <div className="viz-controls">
        <button type="button" className="viz-btn" disabled={s === 0} onClick={() => setS(s - 1)}>上一步</button>
        <button type="button" className="viz-btn primary" disabled={s === STAGES.length - 1} onClick={() => setS(s + 1)}>下一步</button>
        {STAGES.map((st, i) => (
          <button key={st.title} type="button" className={`viz-btn${s === i ? " is-on" : ""}`} onClick={() => setS(i)}>{i + 1}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 600 250" role="img" aria-label={`当前阶段：${STAGES[s].title}。${STAGES[s].body}`}>
          {/* ① output tiles + split-K */}
          <g opacity={on(0)}>
            <text x={18} y={18} fontSize={10} fill={MUTED}>输出 y（M × N）</text>
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={i} x={18 + i * 20} y={26} width={18} height={26} rx={2} fill={i === 2 ? ORANGE : GREY} opacity={i === 2 ? 0.9 : 0.6} />
            ))}
            <text x={18} y={68} fontSize={9} fill={MUTED}>每块 64 列 = 一个 program</text>
            {Array.from({ length: 4 }).map((_, i) => (
              <rect key={i} x={58 + i * 10} y={76} width={8} height={18} rx={1.5} fill={ORANGE} opacity={0.35 + i * 0.15} />
            ))}
            <text x={104} y={89} fontSize={9} fill={MUTED}>× 4 份 K</text>
          </g>

          {/* ② packed weight bytes */}
          <g opacity={on(1)}>
            <text x={210} y={18} fontSize={10} fill={MUTED}>W 的一块（64 行 × 64 个数）</text>
            {Array.from({ length: 4 }).map((_, r) =>
              Array.from({ length: 8 }).map((__, c) => (
                <rect key={`${r}-${c}`} x={210 + c * 17} y={26 + r * 14} width={15} height={12} rx={1.5} fill={BLUE} opacity={0.25 + ((r + c) % 3) * 0.2} />
              )),
            )}
            <text x={210} y={96} fontSize={9} fill={MUTED} className="mono">1 字节 = [hi:4 | lo:4]</text>
            <text x={210} y={108} fontSize={9} fill={MUTED}>只搬 32 字节 / 行，不在显存展开</text>
          </g>

          {/* ③ prmt lookup */}
          <g opacity={on(2)}>
            <text x={384} y={18} fontSize={10} fill={MUTED}>码表在寄存器里（16 × bf16）</text>
            {Array.from({ length: 8 }).map((_, i) => (
              <g key={i}>
                <rect x={384 + i * 25} y={26} width={23} height={14} rx={2} fill={PURPLE} opacity={0.55} />
                <text x={384 + i * 25 + 11.5} y={36} fontSize={7.5} textAnchor="middle" fill="#fff" className="mono">{`c${i}`}</text>
              </g>
            ))}
            <path d="M 470 44 L 452 60 M 470 44 L 488 60" stroke={PURPLE} strokeWidth={1.2} fill="none" />
            <rect x={430} y={60} width={44} height={14} rx={2} fill={PURPLE} opacity={0.8} />
            <rect x={478} y={60} width={44} height={14} rx={2} fill={PURPLE} opacity={0.8} />
            <text x={452} y={70} fontSize={8} textAnchor="middle" fill="#fff">bf16(hi)</text>
            <text x={500} y={70} fontSize={8} textAnchor="middle" fill="#fff">bf16(lo)</text>
            <text x={384} y={92} fontSize={9} fill={MUTED}>3 层 prmt 树，没有一次访存</text>
          </g>

          {/* ④ two dots then scale */}
          <g opacity={on(3)}>
            <rect x={18} y={136} width={250} height={70} rx={5} fill="#fff" stroke={GREEN} />
            <text x={30} y={156} fontSize={10} fill={INK} className="mono">part = W_hi · x_evenᵀ</text>
            <text x={30} y={174} fontSize={10} fill={INK} className="mono">     + W_lo · x_oddᵀ</text>
            <text x={30} y={196} fontSize={10} fill={GREEN} className="mono" fontWeight={600}>acc += part × absmax</text>
            <text x={18} y={222} fontSize={9} fill={MUTED}>tensor core 做乘加；缩放每块只乘一次</text>
          </g>

          {/* ⑤ atomic add */}
          <g opacity={on(4)}>
            {Array.from({ length: 4 }).map((_, i) => (
              <g key={i}>
                <rect x={330 + i * 34} y={140} width={28} height={18} rx={2} fill={ORANGE} opacity={0.35 + i * 0.15} />
                <path d={`M ${344 + i * 34} 160 L 412 190`} stroke={ORANGE} strokeWidth={1} opacity={0.7} />
              </g>
            ))}
            <rect x={382} y={190} width={60} height={20} rx={3} fill={ORANGE} />
            <text x={412} y={204} fontSize={9} textAnchor="middle" fill="#fff">fp32 输出</text>
            <text x={330} y={228} fontSize={9} fill={MUTED}>atomic_add：顺序不固定，末位会变</text>
          </g>
        </svg>
      </div>
      <div className="viz-narr">
        <strong>{STAGES[s].title}</strong>
        <span className="viz-mono" style={{ marginLeft: 8, color: MUTED }}>{STAGES[s].where}</span>
        <div style={{ marginTop: 6 }}>{STAGES[s].body}</div>
      </div>
    </VisualizationFrame>
  );
}

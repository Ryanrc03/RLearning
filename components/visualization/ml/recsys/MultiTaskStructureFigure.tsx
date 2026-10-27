"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";

// Recommender Systems, multi-task: the three structures kuairank compared on the
// same shared input (kurec/models/mtl.py). Experts in green are shared by every
// task, experts in blue belong to one task; ⊕ is a task's gate (softmax-weighted
// sum of the experts it can see); orange are the per-task towers and heads.

type Arch = "shared" | "mmoe" | "ple";
const ARCHS: { key: Arch; label: string }[] = [
  { key: "shared", label: "shared-bottom" },
  { key: "mmoe", label: "MMoE" },
  { key: "ple", label: "PLE（CGC）" },
];

const BLUE = "#2a78d6";
const BLUE_F = "#dbe8f8";
const ORANGE = "#eb6834";
const ORANGE_F = "#fbe3d8";
const GREEN = "#1baf7a";
const GREEN_F = "#d9f1e6";
const YELLOW = "#d9b24a";
const YELLOW_F = "#fbf1cf";
const INK = "#3b4234";

const TASKS = ["click", "long_view", "like", "follow"];
const TASK_Y = [38, 98, 158, 218];
const MIX_X = 338;

type Expert = { id: string; label: string; y: number; shared: boolean; task?: number };

function experts(arch: Arch): Expert[] {
  if (arch === "shared") return [{ id: "s", label: "共享 MLP 512 · 256", y: 114, shared: true }];
  if (arch === "mmoe") return [0, 1, 2, 3].map((i) => ({ id: `e${i}`, label: `专家 ${i + 1}`, y: 26 + i * 60, shared: true }));
  return [
    { id: "p0", label: "click 专属", y: 14, shared: false, task: 0 },
    { id: "p1", label: "long_view 专属", y: 54, shared: false, task: 1 },
    { id: "s0", label: "共享专家 1", y: 98, shared: true },
    { id: "s1", label: "共享专家 2", y: 138, shared: true },
    { id: "p2", label: "like 专属", y: 182, shared: false, task: 2 },
    { id: "p3", label: "follow 专属", y: 222, shared: false, task: 3 },
  ];
}

const visible = (arch: Arch, e: Expert, t: number) => arch !== "ple" || e.shared || e.task === t;

export default function MultiTaskStructureFigure() {
  const [arch, setArch] = useState<Arch>("mmoe");
  const ex = experts(arch);
  const EH = 28;

  const narr: Record<Arch, { tone: string; text: string }> = {
    shared: { tone: "", text: "一个共享的 MLP，四个任务各接一个小塔。所有任务的梯度都改同一组参数：click、long_view 的正例率 38% / 26%，like 只有 1.5%，等权的 BCE 加起来，共享层主要在为密集任务服务。kuairank：like 对单任务 −0.0128 [−0.0226, −0.0023]。" },
    mmoe: { tone: "is-warn", text: "4 个专家都共享，每个任务有自己的门：从同一个输入 x 算出 4 个 softmax 权重，混合专家输出再进塔。门让任务可以偏向不同的专家，但专家本身仍被所有任务的梯度一起训。kuairank：like −0.0163 [−0.0258, −0.0069]，三种结构里最差。" },
    ple: { tone: "is-good", text: "每个任务有一个只属于自己的专家，另有 2 个共享专家；每个任务的门只在「自己的 + 共享的」3 个专家上加权。like 至少保住了一个不被 click 梯度改写的专家。kuairank：like −0.0104 [−0.0200, −0.0010]，伤得最少；follow 点估计 +0.0182，不显著。" },
  };

  return (
    <VisualizationFrame
      title="三种多任务结构：谁和谁共享参数"
      description="同一个共享输入 x（Day 3 最好模型 #24 的编码：F1 embedding、候选、最近 10 条池化、3 层 cross），上面接四个任务的头。绿色专家被所有任务共享，蓝色专家只属于一个任务，⊕ 是该任务的门。"
    >
      <div className="viz-controls">
        <Tabs ariaLabel="结构" value={arch} onChange={setArch} options={ARCHS} />
        <button type="button" className="viz-btn" onClick={() => setArch("mmoe")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 680 262" role="img" aria-label={`${arch} 结构`} style={{ minWidth: 560 }}>
          <defs>
            <marker id="mt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={INK} />
            </marker>
          </defs>
          <rect x={10} y={106} width={90} height={50} rx={6} fill={YELLOW_F} stroke={YELLOW} strokeWidth={1.3} />
          <text x={55} y={127} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={INK}>共享输入 x</text>
          <text x={55} y={142} fontSize={9.5} textAnchor="middle" fill="#5d6156">#24 的编码</text>
          {ex.map((e) => (
            <g key={e.id}>
              <path d={`M100 131 C 125 131, 125 ${e.y + EH / 2}, 146 ${e.y + EH / 2}`} fill="none" stroke="#b9b8a8" strokeWidth={1} />
              <rect x={150} y={e.y} width={128} height={EH} rx={6} fill={e.shared ? GREEN_F : BLUE_F} stroke={e.shared ? GREEN : BLUE} strokeWidth={1.4} />
              <text x={214} y={e.y + 18} fontSize={10} textAnchor="middle" fill={INK}>{e.label}</text>
            </g>
          ))}
          {TASKS.map((name, t) => {
            const ty = TASK_Y[t];
            return (
              <g key={name}>
                {ex.filter((e) => visible(arch, e, t)).map((e) => (
                  <line key={e.id} x1={278} y1={e.y + EH / 2} x2={arch === "shared" ? 382 : MIX_X - 9} y2={ty} stroke={e.shared ? GREEN : BLUE} strokeWidth={1.1} opacity={0.6} />
                ))}
                {arch !== "shared" && (
                  <g>
                    <circle cx={MIX_X} cy={ty} r={9} fill="#fff" stroke={INK} strokeWidth={1.4} />
                    <text x={MIX_X} y={ty + 4} fontSize={11} textAnchor="middle" fill={INK}>⊕</text>
                    <text x={MIX_X} y={ty - 13} fontSize={9} textAnchor="middle" fill="#5d6156">门 {arch === "mmoe" ? 4 : 3}</text>
                    <line x1={MIX_X + 9} y1={ty} x2={380} y2={ty} stroke={INK} strokeWidth={1.2} markerEnd="url(#mt-arrow)" />
                  </g>
                )}
                <rect x={384} y={ty - 15} width={96} height={30} rx={6} fill={ORANGE_F} stroke={ORANGE} strokeWidth={1.3} />
                <text x={432} y={ty + 4} fontSize={10} textAnchor="middle" fill={INK}>塔 [128]</text>
                <line x1={480} y1={ty} x2={514} y2={ty} stroke={INK} strokeWidth={1.2} markerEnd="url(#mt-arrow)" />
                <rect x={518} y={ty - 15} width={150} height={30} rx={6} fill={ORANGE_F} stroke={ORANGE} strokeWidth={1.3} />
                <text x={593} y={ty + 4} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={INK}>p({name})，BCE</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: GREEN_F, border: `1.4px solid ${GREEN}` }} />所有任务共享的专家</span>
        <span><i style={{ background: BLUE_F, border: `1.4px solid ${BLUE}` }} />任务专属专家</span>
        <span><i style={{ background: ORANGE_F, border: `1.3px solid ${ORANGE}` }} />任务塔与输出</span>
        <span><i style={{ background: "#fff", border: `1.4px solid ${INK}` }} />⊕ 门：softmax 加权求和</span>
      </div>
      <div className={`viz-narr ${narr[arch].tone}`}>{narr[arch].text}</div>
    </VisualizationFrame>
  );
}

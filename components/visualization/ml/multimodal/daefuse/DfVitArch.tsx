"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { cornerData, SIDE, vitForward, vitInit } from "@/lib/ml/daefuseTrain";
import { Cells, diverge } from "./DfTrainKit";
import { gray } from "./DfPixels";

// 2.2 architecture: the smallest ViT the next figures train. 8 × 8 image →
// 16 patches of 2 × 2 → each patch flattened to 4 numbers → linear embedding
// plus a learned position vector → a [CLS] query reads all 16 tokens with
// attention → a linear head. Numbers come from the untrained weights; the
// stages can be focused one at a time.

type Stage = "all" | "patch" | "embed" | "attn" | "head";
const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GREEN = "#1baf7a";
const INK = "#3b4234";
const MUTED = "#76796f";

const NARR: Record<Stage, string> = {
  all: "从左到右四步：切 patch、嵌入、attention、分类头。点上面的按钮一次看一步。这里的数字来自还没训练的随机权重，下一张图会把它训出来。",
  patch: "第 1 步，切 patch：8 × 8 的图切成 4 × 4 = 16 块，每块 2 × 2 = 4 个像素，拉平成 4 个数。标准的 ViT-B/16 把 224 × 224 × 3 的图切成 14 × 14 = 196 块，每块 16 × 16 × 3 = 768 个数。",
  embed: "第 2 步，嵌入：每个 patch 乘同一个矩阵 W_e（4 → 4），再加上它自己位置的位置向量 pos_i，得到一个 token。没有位置向量的话，打乱 patch 的顺序结果不变，模型就分不出「左上角」和「右下角」。ViT-B/16 里这一步是 768 → 768。",
  attn: "第 3 步，attention：一个可学习的 [CLS] query q 和 16 个 token 的 key 做点积、softmax，得到 16 个权重（下面的柱子），再对 value 加权求和得到 z。权重由内容和位置一起决定，所以它可以一步就看全图任意两个角落。标准 ViT 里每个 token 都这样看所有 token，叠 12 层、每层 12 个头；这里只保留 [CLS] 读一次的最小版本。",
  head: "第 4 步，分类头：z（4 个数）乘一个 4 → 2 的矩阵，softmax 成两个类别的概率。整个模型一共 130 个参数；ViT-B/16 约 8,600 万。",
};

export default function DfVitArch() {
  const [stage, setStage] = useState<Stage>("all");
  const { x, f } = useMemo(() => {
    const x = cornerData(2, 41)[1].x;
    return { x, f: vitForward(vitInit(11), x) };
  }, []);
  const dim = (s: Stage) => (stage !== "all" && stage !== s ? 0.25 : 1);
  const bold = (s: Stage) => stage === s;
  const m = Math.max(...f.o);
  const pr = f.o.map((o) => Math.exp(o - m));
  const prob = pr.map((v) => v / (pr[0] + pr[1]));
  const PX = 150;
  const step = 27;

  return (
    <VisualizationFrame
      title="ViT 的结构：切块、嵌入、attention、分类头"
      description="这是下面要训练的最小 ViT。输入是 8 × 8 的图，任务是判断左上角和右下角两块是不是都亮着。"
      footnote="数字是随机初始化（还没训练）的权重算出来的示意值；形状和参数量是真实的：W_e 16 + 偏置 4 + 位置 64 + q 4 + W_k 16 + W_v 16 + 头 10 = 130。"
    >
      <div className="viz-controls">
        {([["patch", "1 切 patch"], ["embed", "2 嵌入 + 位置"], ["attn", "3 attention"], ["head", "4 分类头"]] as [Stage, string][]).map(([s, l]) => (
          <button key={s} type="button" className={`viz-btn${stage === s ? " is-on" : ""}`} onClick={() => setStage(s)}>{l}</button>
        ))}
        <button type="button" className="viz-btn" onClick={() => setStage("all")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 760 300" role="img" aria-label={NARR[stage]} style={{ minWidth: 660 }}>
          <defs>
            <marker id="vitarch-ink" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={INK} /></marker>
          </defs>
          <g opacity={dim("patch")} style={{ transition: "opacity .25s" }}>
            <Cells vals={x} cols={SIDE} x={10} y={40} cell={14} color={(v) => gray(v)} title="输入 8 × 8" />
            {[1, 2, 3].map((k) => (
              <g key={k}>
                <line x1={10 + k * 28} y1={40} x2={10 + k * 28} y2={152} stroke={BLUE} strokeWidth={bold("patch") ? 1.8 : 1} />
                <line x1={10} y1={40 + k * 28} x2={122} y2={40 + k * 28} stroke={BLUE} strokeWidth={bold("patch") ? 1.8 : 1} />
              </g>
            ))}
            <line x1={126} y1={96} x2={144} y2={70} stroke={INK} markerEnd="url(#vitarch-ink)" />
            <text x={PX} y={34} fontSize={10.5} fontWeight={600} fill="#30332c">16 个 patch，每个拉平成 4 个数　(16, 4)</text>
            {f.P.map((pt, i) => <Cells key={i} vals={pt} cols={4} x={PX + i * step} y={42} cell={6} color={(v) => gray(v)} />)}
          </g>

          <g opacity={dim("embed")} style={{ transition: "opacity .25s" }}>
            {f.P.map((_, i) => <line key={i} x1={PX + i * step + 12} y1={52} x2={PX + i * step + 12} y2={76} stroke={BLUE} strokeWidth={bold("embed") ? 1.6 : 0.8} markerEnd="url(#vitarch-ink)" />)}
            <text x={PX + 16 * step + 4} y={68} fontSize={10} fill={MUTED}>× W_e + pos_i</text>
            {f.e.map((ei, i) => <Cells key={i} vals={ei} cols={1} x={PX + i * step + 6} y={80} cell={12} color={(v) => diverge(v, 2)} />)}
            <text x={PX + 16 * step + 4} y={112} fontSize={10.5} fontWeight={600} fill="#30332c">16 个 token</text>
            <text x={PX + 16 * step + 4} y={126} fontSize={10} fill={MUTED}>(16, 4)</text>
          </g>

          <g opacity={dim("attn")} style={{ transition: "opacity .25s" }}>
            <Cells vals={[...vitInit(11).q]} cols={1} x={66} y={190} cell={12} color={(v) => diverge(v, 2)} title="[CLS] query q" />
            <text x={10} y={262} fontSize={10} fill={MUTED}>q · k_i / √4 → softmax</text>
            {f.a.map((a, i) => {
              const h = 70 * a / Math.max(...f.a);
              return (
                <g key={i}>
                  <line x1={84} y1={214} x2={PX + i * step + 12} y2={136} stroke={GREEN} strokeWidth={bold("attn") ? 0.4 + 4 * a : 0.3 + 2 * a} opacity={0.55} />
                  <rect x={PX + i * step + 3} y={250 - h} width={18} height={h} fill={GREEN} opacity={0.85} />
                  <text x={PX + i * step + 12} y={264} fontSize={8.5} textAnchor="middle" fill={MUTED} className="mono">{(a * 100).toFixed(0)}</text>
                </g>
              );
            })}
            <text x={PX} y={282} fontSize={10.5} fontWeight={600} fill="#30332c">attention 权重 a_i（%），16 个加起来是 100%</text>
          </g>

          <g opacity={dim("head")} style={{ transition: "opacity .25s" }}>
            <line x1={PX + 16 * step - 6} y1={200} x2={PX + 16 * step + 14} y2={200} stroke={INK} markerEnd="url(#vitarch-ink)" />
            <text x={PX + 16 * step + 18} y={178} fontSize={10.5} fontWeight={600} fill="#30332c">z = Σ a_i v_i</text>
            <Cells vals={f.z} cols={4} x={PX + 16 * step + 18} y={186} cell={13} color={(v) => diverge(v, 2)} />
            {["两角都亮", "不是"].map((lab, c) => (
              <g key={lab}>
                <text x={PX + 16 * step + 18} y={226 + c * 22} fontSize={10} fill={INK}>{lab}</text>
                <rect x={PX + 16 * step + 70} y={216 + c * 22} width={60} height={13} rx={3} fill="#efede4" />
                <rect x={PX + 16 * step + 70} y={216 + c * 22} width={60 * prob[1 - c]} height={13} rx={3} fill={ORANGE} />
                <text x={PX + 16 * step + 134} y={226 + c * 22} fontSize={9.5} fill={INK} className="mono">{(prob[1 - c] * 100).toFixed(0)}%</text>
              </g>
            ))}
          </g>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: diverge(2, 2) }} />token 里的正数</span>
        <span><i style={{ background: diverge(-2, 2) }} />负数</span>
        <span><i style={{ background: GREEN }} />attention 权重</span>
        <span><i style={{ background: ORANGE }} />输出概率</span>
      </div>
      <div className={`viz-narr${stage === "attn" ? " is-good" : stage === "all" ? "" : " is-warn"}`}>{NARR[stage]}</div>
    </VisualizationFrame>
  );
}

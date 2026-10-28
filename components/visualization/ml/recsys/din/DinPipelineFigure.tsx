"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

// DIN note, "What is it?": the whole path in kuairank. Top row is storage (one
// sorted event array + two pointers per sample, gathered per batch on the GPU);
// bottom row is scoring (shared item embeddings, target attention, DCN-v2 head).
// Colors by meaning: yellow = tensors/arrays, blue = computation, green = shared
// weights, orange = output head, grey dashed = training only, ink = sums.

type Focus = "none" | "storage" | "model";

const BLUE = "#2a78d6";
const BLUE_F = "#dbe8f8";
const ORANGE = "#eb6834";
const ORANGE_F = "#fbe3d8";
const GREEN = "#1baf7a";
const GREEN_F = "#d9f1e6";
const YELLOW = "#d9b24a";
const YELLOW_F = "#fbf1cf";
const INK = "#3b4234";
const GREY = "#9a9c8d";

type BoxProps = { x: number; y: number; w: number; h: number; stroke: string; fill: string; lines: string[]; dashed?: boolean; bold?: number; focus: boolean };

function Box({ x, y, w, h, stroke, fill, lines, dashed, focus }: BoxProps) {
  const lh = 12.5;
  const top = y + h / 2 - ((lines.length - 1) * lh) / 2 + 3.5;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={stroke} strokeWidth={focus ? 2.4 : 1.3} strokeDasharray={dashed ? "5 3" : undefined} />
      {lines.map((t, i) => (
        <text key={i} x={x + w / 2} y={top + i * lh} fontSize={i === 0 ? 10.5 : 9.5} fontWeight={i === 0 ? 600 : 400} textAnchor="middle" fill={i === 0 ? INK : "#5d6156"}>
          {t}
        </text>
      ))}
    </g>
  );
}

const arrow = (d: string, color = INK) => <path d={d} fill="none" stroke={color} strokeWidth={1.3} markerEnd="url(#dp-arrow)" />;

export default function DinPipelineFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const op = (g: Exclude<Focus, "none">) => (focus === "none" || focus === g ? 1 : 0.3);
  const on = (g: Exclude<Focus, "none">) => focus === g;

  const narr =
    focus === "storage"
      ? { tone: "is-warn", text: "存储只有两样：全部 1,166 万条曝光按 (用户, 时间) 排成一个事件数组，常驻 GPU（vid / aid / tag / fb 四列 int32，约 190 MB）；每条样本只记 (lo, hi) 两个指针。训练时一个 batch 只搬指针过去，在 GPU 上算出最近 N 条的下标再 gather，(样本 × N) 的矩阵只在这一个 batch 里短暂存在。" }
      : focus === "model"
        ? { tone: "is-good", text: "打分：历史里每条曝光变成 64 维元素 e_i（vid、aid、tag 三个 16 维加反馈 16 维），候选视频变成 48 维 q，两边共用同一张 item embedding 表。activation unit 给每条历史打一个权重，加权求和成 64 维的用户兴趣，和 F1 的 embedding、稠密特征、q 拼成 605 维的 x₀，后面是 #9 原样的 DCN-v2。" }
        : { tone: "", text: "上一行是 kuairank 怎么存和取用户序列，下一行是 DIN 怎么用它打分。点按钮分别看两半。" };

  return (
    <VisualizationFrame
      title="kuairank 里的 DIN：一条曝光从日志到 pCTR"
      description="黄色是数组和张量，蓝色是计算，绿色是目标与历史共用的 embedding 表，橙色是输出，灰色虚线只在训练时存在。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "storage" ? " is-on" : ""}`} onClick={() => setFocus("storage")}>存储：只存指针</button>
        <button type="button" className={`viz-btn${focus === "model" ? " is-on" : ""}`} onClick={() => setFocus("model")}>打分：target attention</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 680 300" role="img" aria-label="DIN 在 kuairank 中的数据流与模型结构" style={{ minWidth: 560 }}>
          <defs>
            <marker id="dp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={INK} />
            </marker>
          </defs>
          <text x={10} y={22} fontSize={10.5} fontWeight={600} fill={GREY}>存储与取序列（kurec/seq.py）</text>
          <g opacity={op("storage")} style={{ transition: "opacity .3s" }}>
            <Box x={10} y={36} w={140} h={50} stroke={YELLOW} fill={YELLOW_F} lines={["曝光日志", "1,166 万条", "按 用户·时间 排序"]} focus={on("storage")} />
            <Box x={190} y={36} w={150} h={50} stroke={YELLOW} fill={YELLOW_F} lines={["事件数组（GPU buffer）", "vid · aid · tag · fb", "int32，约 190 MB"]} focus={on("storage")} />
            <Box x={190} y={96} w={150} h={40} stroke={YELLOW} fill={YELLOW_F} lines={["样本指针 (lo, hi)", "每条样本 16 B"]} focus={on("storage")} />
            <Box x={380} y={36} w={150} h={100} stroke={BLUE} fill={BLUE_F} lines={["取最近 N 条", "idx = hi − N + j", "mask = idx ≥ lo", "右对齐，左边补 0"]} focus={on("storage")} />
            <Box x={560} y={36} w={110} h={100} stroke={YELLOW} fill={YELLOW_F} lines={["[B, N] 下标", "只在这个", "batch 里存在"]} focus={on("storage")} />
            {arrow("M150 61 L186 61")}
            {arrow("M150 76 Q170 116 186 116")}
            {arrow("M340 61 L376 61")}
            {arrow("M340 116 L376 116")}
            {arrow("M530 86 L556 86")}
          </g>
          {arrow("M615 136 L615 150 L220 150 L220 160")}
          <text x={10} y={160} fontSize={10.5} fontWeight={600} fill={GREY}>打分（kurec/models/din.py）</text>
          <g opacity={op("model")} style={{ transition: "opacity .3s" }}>
            <Box x={10} y={180} w={128} h={52} stroke={GREEN} fill={GREEN_F} lines={["item embedding 表", "vid · aid · tag，d = 16", "目标与历史共用"]} focus={on("model")} />
            <Box x={160} y={164} w={120} h={36} stroke={YELLOW} fill={YELLOW_F} lines={["历史元素 e_i", "[B, N, 64]"]} focus={on("model")} />
            <Box x={160} y={212} w={120} h={36} stroke={YELLOW} fill={YELLOW_F} lines={["候选视频 q", "[B, 48]"]} focus={on("model")} />
            <Box x={300} y={164} w={124} h={84} stroke={BLUE} fill={BLUE_F} lines={["activation unit", "MLP(q, k_i, q − k_i,", "q ⊙ k_i, e_fb)", "→ w_i，不做 softmax"]} focus={on("model")} />
            <Box x={442} y={186} w={62} h={40} stroke={INK} fill="#fff" lines={["Σ w_i e_i", "[B, 64]"]} focus={on("model")} />
            <Box x={522} y={164} w={148} h={84} stroke={BLUE} fill={BLUE_F} lines={["x₀ = [F1 432 | 稠密 61", "| q 48 | 兴趣 64] = 605", "DCN-v2 cross × 3", "MLP 512 · 256 · 128"]} focus={on("model")} />
            <Box x={522} y={262} w={70} h={30} stroke={ORANGE} fill={ORANGE_F} lines={["pCTR"]} focus={on("model")} />
            <Box x={600} y={262} w={70} h={30} stroke={GREY} fill="#fff" dashed lines={["BCE loss"]} focus={on("model")} />
            {arrow("M138 196 L156 184")}
            {arrow("M138 216 L156 228")}
            {arrow("M280 182 L296 190")}
            {arrow("M280 230 L296 222")}
            {arrow("M424 206 L438 206")}
            {arrow("M504 206 L518 206")}
            {arrow("M560 248 L558 258")}
            {arrow("M592 277 L596 277")}
          </g>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: YELLOW_F, border: `1.3px solid ${YELLOW}` }} />数组与张量</span>
        <span><i style={{ background: BLUE_F, border: `1.3px solid ${BLUE}` }} />计算</span>
        <span><i style={{ background: GREEN_F, border: `1.3px solid ${GREEN}` }} />共用的 embedding</span>
        <span><i style={{ background: ORANGE_F, border: `1.3px solid ${ORANGE}` }} />输出</span>
        <span><i style={{ background: "#fff", border: `1.3px dashed ${GREY}` }} />只在训练时</span>
      </div>
      <div className={`viz-narr ${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

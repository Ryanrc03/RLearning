"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { STEP_PROFILE, type KernelCategory } from "@/lib/gpu/grpoKernels";

const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#9b6ad6", "#d6a12a", "#cfcab4"];
const INK = "#3b4234";
const MUTED = "#76796f";
const BAR_X = 8;
const BAR_W = 584;

type Half = "train" | "decode";

// Measured kernel time of one GRPO step on the 3060, split by category, for both halves of the step.
export default function GrpoStepProfile() {
  const [hover, setHover] = useState<{ half: Half; i: number } | null>(null);
  const halves: Half[] = ["decode", "train"];
  const active: KernelCategory | null = hover ? STEP_PROFILE[hover.half].cats[hover.i] : null;
  const activeHalf = hover ? STEP_PROFILE[hover.half] : null;

  return (
    <VisualizationFrame
      title="一步 GRPO 的 kernel 时间花在哪（RTX 3060 实测）"
      description="上面是采样半步，下面是训练半步。条的长度是该类 kernel 占这一半总 kernel 时间的比例。斜线条纹标记的两段后来查明是 profile 脚本自己造成的，真实训练里不存在。"
      footnote="数据：torch.profiler 和 vLLM profiler 的 chrome trace，按 kernel 名字归类。训练半步是 6 条 × 600 token 的一次前向加反向；采样半步按每个 decode step 计。"
    >
      <div className="viz-scroll">
        <svg viewBox="0 0 600 216" role="img" aria-label="采样半步里 bnb 4-bit GEMM 占 74%；训练半步里 GEMM 占 70%，memcpy 和 softmax 两段是 profile 脚本的伪影。" onMouseLeave={() => setHover(null)}>
          <defs>
            <pattern id="grpo-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#fff" opacity="0" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeWidth="2.2" opacity="0.75" />
            </pattern>
          </defs>
          {halves.map((half, hi) => {
            const h = STEP_PROFILE[half];
            const y = 20 + hi * 104;
            let x = BAR_X;
            return (
              <g key={half}>
                <text x={BAR_X} y={y - 6} fontSize={11} fill={INK} fontWeight={600}>{h.title}</text>
                <text x={BAR_X + BAR_W} y={y - 6} fontSize={10} fill={MUTED} textAnchor="end" className="mono">{`合计 ${h.total.toLocaleString("en-US")} ${h.unit}`}</text>
                {h.cats.map((c, i) => {
                  const w = (c.ms / h.total) * BAR_W;
                  const x0 = x;
                  x += w;
                  const on = hover?.half === half && hover.i === i;
                  return (
                    <g key={c.label} onMouseEnter={() => setHover({ half, i })} style={{ cursor: "default" }}>
                      <rect x={x0} y={y} width={Math.max(w - 1.5, 0.5)} height={34} fill={COLORS[i]} opacity={hover && !on ? 0.45 : 0.9} rx={2} />
                      {c.artefact && <rect x={x0} y={y} width={Math.max(w - 1.5, 0.5)} height={34} fill="url(#grpo-hatch)" />}
                      {w > 28 && (
                        <text x={x0 + w / 2} y={y + 21} fontSize={9.5} textAnchor="middle" fill="#fff" fontWeight={600}>
                          {w > 120 ? `${c.label} ${Math.round((c.ms / h.total) * 100)}%` : `${Math.round((c.ms / h.total) * 100)}%`}
                        </text>
                      )}
                    </g>
                  );
                })}
                <g transform={`translate(${BAR_X} ${y + 40})`}>
                  {(() => {
                    let lx = 0;
                    return h.cats.map((c, i) => {
                      const x1 = lx;
                      lx += c.label.length * 9 + 30;
                      return (
                        <g key={c.label} transform={`translate(${x1} 0)`}>
                          <rect y={2} width={9} height={9} rx={2} fill={COLORS[i]} opacity={0.9} />
                          {c.artefact && <rect y={2} width={9} height={9} rx={2} fill="url(#grpo-hatch)" />}
                          <text x={13} y={10} fontSize={9.5} fill={INK}>{c.label}</text>
                        </g>
                      );
                    });
                  })()}
                </g>
                <g transform={`translate(${BAR_X} ${y + 56})`}>
                  <text fontSize={9.5} fill={MUTED} y={10}>
                    {half === "decode"
                      ? "bnb 的 4-bit 矩阵乘一家占了四分之三：P1 要换掉的就是它。"
                      : "GEMM 已经贴着 fp32 累加的上限；要再快只能换累加精度（P3）。"}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="viz-narr" style={{ minHeight: 22 }}>
        {active && activeHalf
          ? `${activeHalf.title}：${active.label} ${active.ms.toLocaleString("en-US")} ${activeHalf.unit}，占 ${((active.ms / activeHalf.total) * 100).toFixed(1)}%。${active.note ?? ""}`
          : "把鼠标移到某一段上，看具体数字和它对应的结论。"}
      </div>
    </VisualizationFrame>
  );
}

"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { ACCUMULATE, ACCUMULATE_ERR, RTX3060 } from "@/lib/gpu/grpoKernels";

const CUBLAS = "#2a78d6";
const TRI32 = "#cfcab4";
const TRI16 = "#eb6834";
const INK = "#3b4234";
const MUTED = "#76796f";
const CRIT = "#c4453c";
const LABEL_W = 104;
const X0 = LABEL_W + 10;
const X_MAX = 560;
const SCALE_MAX = 55;

const SERIES = [
  { key: "cublas", label: "cuBLAS（fp32 累加）", color: CUBLAS },
  { key: "tritonFp32", label: "Triton，fp32 累加", color: TRI32 },
  { key: "tritonFp16", label: "Triton，fp16 累加", color: TRI16 },
] as const;

const x = (tflops: number) => X0 + (tflops / SCALE_MAX) * (X_MAX - X0);

// Measured TFLOPS against the two tensor-core ceilings of a GeForce Ampere card.
export default function AccumulateCeiling() {
  const [show16, setShow16] = useState(true);
  const rowH = 52;
  const height = ACCUMULATE.length * rowH + 46;

  return (
    <VisualizationFrame
      title="同一块卡，两个天花板：累加精度决定 tensor core 的速度"
      description="训练形状的矩阵乘（M = 2400）。红色虚线是 fp32 累加的上限 25.6 TFLOPS，灰色虚线是 fp16 累加的上限 51.2 TFLOPS。cuBLAS 永远用 fp32 累加，所以它最多只能碰到红线。"
      footnote={`误差：和 fp32 精确结果比的相对 Frobenius 误差，cuBLAS fp16 是 ${ACCUMULATE_ERR.cublas}，Triton fp16 累加是 ${ACCUMULATE_ERR.tritonFp16}，两者的余弦相似度都是 1.0000。fp16 累加的部分和每 32 个 K 就转回 fp32 一次，所以误差几乎不涨。Triton 的 fp32 累加版本只有 9 TFLOPS，是 Triton 3.4 对这种分段循环流水做得差，不代表硬件。`}
    >
      <div className="viz-controls">
        <label className="viz-check">
          <input type="checkbox" checked={show16} onChange={(e) => setShow16(e.target.checked)} />
          显示 fp16 累加的结果
        </label>
      </div>
      <div className="viz-legend" style={{ marginTop: 0, marginBottom: 10 }}>
        {SERIES.filter((s) => show16 || s.key !== "tritonFp16").map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
        ))}
        <span>单位：TFLOPS</span>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 600 ${height}`} role="img" aria-label="三种矩阵形状下 cuBLAS、Triton fp32 累加和 Triton fp16 累加的吞吐，和 25.6、51.2 两条上限的位置">
          {[0, 10, 20, 30, 40, 50].map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={14} y2={height - 26} stroke="#eeeae0" />
              <text x={x(t)} y={height - 12} fontSize={9} textAnchor="middle" fill={MUTED} className="mono">{t}</text>
            </g>
          ))}
          <line x1={x(RTX3060.tflopsFp32Acc)} x2={x(RTX3060.tflopsFp32Acc)} y1={8} y2={height - 26} stroke={CRIT} strokeDasharray="4 3" strokeWidth={1.4} />
          <text x={x(RTX3060.tflopsFp32Acc) + 4} y={12} fontSize={9} fill={CRIT}>fp32 累加上限 25.6</text>
          <line x1={x(RTX3060.tflopsFp16Acc)} x2={x(RTX3060.tflopsFp16Acc)} y1={8} y2={height - 26} stroke={MUTED} strokeDasharray="4 3" strokeWidth={1.4} />
          <text x={x(RTX3060.tflopsFp16Acc) - 4} y={12} fontSize={9} fill={MUTED} textAnchor="end">fp16 累加上限 51.2</text>
          {ACCUMULATE.map((row, i) => {
            const y = 24 + i * rowH;
            const visible = SERIES.filter((s) => show16 || s.key !== "tritonFp16");
            return (
              <g key={row.shape} transform={`translate(0 ${y})`}>
                <text x={LABEL_W} y={13} fontSize={10.5} textAnchor="end" fill={INK} fontWeight={600}>{row.shape}</text>
                <text x={LABEL_W} y={26} fontSize={9} textAnchor="end" fill={MUTED} className="mono">{`K=${row.K} N=${row.N}`}</text>
                {visible.map((s, si) => {
                  const v = row[s.key];
                  return (
                    <g key={s.key}>
                      <rect x={X0} y={si * 13} width={x(v) - X0} height={11} rx={2} fill={s.color} opacity={0.9} />
                      <text x={x(v) + 5} y={si * 13 + 9} fontSize={9} className="mono" fill={INK}>{v.toFixed(1)}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <div className={`viz-narr${show16 ? " is-good" : ""}`}>
        {show16
          ? "q/o_proj 上 fp16 累加跑到 34.1 TFLOPS，越过了红线，是 cuBLAS 的 1.54 倍；gate/up 是 1.30 倍；down 持平，还没为 K = 11008 调过块大小。越过红线这件事本身就是证据：GeForce 卡确实把 fp32 累加的速率砍了一半。"
          : "只看 cuBLAS：三种形状都停在红线附近（87% 到 102%）。之前以为「GEMM 只跑到峰值的 28%」，是把峰值错当成了 51 TFLOPS；按正确的上限算，cuBLAS 已经没有空间了。"}
      </div>
    </VisualizationFrame>
  );
}

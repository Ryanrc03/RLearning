"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { LAYERS, MS, ROUTE, bandwidthShare, gemmMs, layerMs, routesToTriton, type LayerKey, type MRows } from "@/lib/gpu/grpoKernels";

const BNB = "#2a78d6";
const TRI = "#eb6834";
const INK = "#3b4234";
const MUTED = "#76796f";
const TRACK = "#ece8d8";
const LABEL_W = 112;
const BAR_X = LABEL_W + 10;
const BAR_MAX = 330;

const KEYS = Object.keys(LAYERS) as LayerKey[];

// Pick how many sequences are decoding at once; see which kernel each layer is routed to and why.
export default function Nf4RoutingExplorer() {
  const [m, setM] = useState<MRows>(6);
  const max = Math.max(...KEYS.flatMap((k) => MS.flatMap((mm) => [gemmMs(k, mm, "bnb") ?? 0, gemmMs(k, mm, "triton") ?? 0])));
  const bnbLayer = layerMs(m, "bnb");
  const routedLayer = layerMs(m, "routed");

  return (
    <VisualizationFrame
      title="哪一层该用新 kernel：按 M 和 N 路由"
      description="M 是同时在生成的序列数，也就是每次矩阵乘的行数。选一个 M，看每种层上 bitsandbytes（蓝）和 Triton（橙）各用多久，以及路由规则选了谁。"
      footnote={`规则：M ≤ ${ROUTE.maxM} 且 N ≥ ${ROUTE.minN} 时走 Triton，其余交回 bitsandbytes。数字是单次调用的中位数（CUDA event，每次调用前冲刷 L2）。灰色的「未测干净」是最后一轮测量时 GPU 被别的进程占用，数据不可信，没有画。`}
    >
      <div className="viz-controls">
        <span className="viz-k">同时生成的序列数 M</span>
        {MS.map((mm) => (
          <button key={mm} type="button" className={`viz-btn${m === mm ? " is-on" : ""}`} onClick={() => setM(mm)}>{mm}</button>
        ))}
      </div>
      <div className="viz-legend" style={{ marginTop: 0, marginBottom: 10 }}>
        <span><i style={{ background: BNB }} />bitsandbytes</span>
        <span><i style={{ background: TRI }} />Triton NF4</span>
        <span>单位：ms / 次</span>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 600 236" role="img" aria-label={`M = ${m} 时各层的耗时和路由结果`}>
          {KEYS.map((k, i) => {
            const y = 6 + i * 56;
            const b = gemmMs(k, m, "bnb");
            const t = gemmMs(k, m, "triton");
            const toTri = routesToTriton(k, m);
            const bars = [
              { v: b, c: BNB, chosen: !toTri },
              { v: t, c: TRI, chosen: toTri },
            ];
            return (
              <g key={k} transform={`translate(0 ${y})`}>
                <text x={LABEL_W} y={12} fontSize={10.5} textAnchor="end" fill={INK} fontWeight={600}>{LAYERS[k].label}</text>
                <text x={LABEL_W} y={25} fontSize={9} textAnchor="end" fill={MUTED} className="mono">{`N=${LAYERS[k].N} K=${LAYERS[k].K}`}</text>
                {bars.map((bar, bi) => {
                  const by = bi * 17;
                  if (bar.v === null) {
                    return <text key={bi} x={BAR_X} y={by + 11} fontSize={9.5} fill={MUTED}>未测干净</text>;
                  }
                  const w = Math.max((bar.v / max) * BAR_MAX, 2);
                  return (
                    <g key={bi}>
                      <rect x={BAR_X} y={by} width={BAR_MAX} height={13} fill={TRACK} opacity={0.5} rx={2} />
                      <rect x={BAR_X} y={by} width={w} height={13} fill={bar.c} opacity={bar.chosen ? 0.95 : 0.35} rx={2} />
                      <text x={BAR_X + w + 6} y={by + 10.5} fontSize={9.5} className="mono" fill={INK}>
                        {`${bar.v.toFixed(3)}  ${(bandwidthShare(k, bar.v) * 100).toFixed(0)}% 带宽`}
                      </text>
                    </g>
                  );
                })}
                <text x={590} y={22} fontSize={10} textAnchor="end" fill={toTri ? TRI : BNB} fontWeight={600}>{toTri ? "→ Triton" : "→ bnb"}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className={`viz-narr${routedLayer !== null && bnbLayer !== null && routedLayer < bnbLayer * 0.97 ? " is-good" : ""}`}>
        {bnbLayer !== null && routedLayer !== null
          ? `M = ${m}：一层（q、k、v、o、gate_up、down 各一次）的 4-bit 矩阵乘，全用 bnb 是 ${bnbLayer.toFixed(3)} ms，按规则路由是 ${routedLayer.toFixed(3)} ms，省 ${((1 - routedLayer / bnbLayer) * 100).toFixed(0)}%。乘以 36 层，每个 decode step 省 ${((bnbLayer - routedLayer) * 36).toFixed(1)} ms。`
          : `M = ${m}：q_proj 这一行没有测干净，算不出整层合计。可以看到 gate_up 和 down 在 M ≥ 24 时 Triton 反而慢一倍：32 行的 tile 让 dot 的工作量翻倍，寄存器也不够用，所以规则把它们交回 bnb。`}
        {m <= ROUTE.maxM && " kv_proj 只有 256 列，切成 64 列一块只有 4 块，4 份 split-K 也只有 16 个 program，填不满 28 个 SM，所以也交回 bnb。"}
      </div>
    </VisualizationFrame>
  );
}

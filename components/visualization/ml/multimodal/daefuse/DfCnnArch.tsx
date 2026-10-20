"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { cnnForward, SIDE } from "@/lib/ml/daefuseTrain";
import { Cells, diverge, seq } from "./DfTrainKit";
import { gray } from "./DfPixels";

// 2.1 architecture: the whole small CNN the next two figures train, drawn
// layer by layer — 8 × 8 input → two 3 × 3 kernels → two 6 × 6 feature maps
// → global average pooling → 2 neurons → softmax. The kernels here are set by
// hand (one horizontal-line detector, one vertical) so every number can be
// checked; drag the window and watch one output pixel being computed.

const K_H = [-0.5, -0.5, -0.5, 1, 1, 1, -0.5, -0.5, -0.5];
const K_V = [-0.5, 1, -0.5, -0.5, 1, -0.5, -0.5, 1, -0.5];
const PARAMS = { W: [...K_H, ...K_V], b: [-0.2, -0.2], V: [4, -4, -4, 4], c: [0, 0] };
const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const INK = "#3b4234";
const MUTED = "#76796f";

function image(kind: "h" | "v") {
  const x = new Array(SIDE * SIDE).fill(0.08);
  for (let k = 0; k < 4; k++) x[kind === "h" ? 3 * SIDE + 2 + k : (2 + k) * SIDE + 4] = 0.9;
  return x;
}

export default function DfCnnArch() {
  const [kind, setKind] = useState<"h" | "v">("h");
  const [pos, setPos] = useState(2 * 6 + 2);
  const [kSel, setKSel] = useState(0);
  const x = useMemo(() => image(kind), [kind]);
  const f = cnnForward(PARAMS, x);
  const i = Math.floor(pos / 6);
  const j = pos % 6;
  const win = [0, 1, 2].flatMap((u) => [0, 1, 2].map((v) => x[(i + u) * SIDE + j + v]));
  const ker = kSel === 0 ? K_H : K_V;
  const pre = win.reduce((s, xv, t) => s + xv * ker[t], 0) + PARAMS.b[kSel];
  const m = Math.max(f.o[0], f.o[1]);
  const pr = f.o.map((o) => Math.exp(o - m));
  const prob = pr.map((v) => v / (pr[0] + pr[1]));

  const IX = 12;
  const IY = 40;
  const C = 15;
  return (
    <VisualizationFrame
      title="CNN 的结构：卷积核在图上滑，算出特征图，再汇总成一个判断"
      description="这是下面要训练的那个小 CNN：任务是判断 8 × 8 的图里那根短线是横的还是竖的。这里两个卷积核先手动设成「横线探测器」和「竖线探测器」，拖动滑块看一个输出像素是怎么算出来的。"
      footnote="参数量：2 个 3 × 3 卷积核 + 2 个偏置 = 20，全连接 2 × 2 + 2 = 6，一共 26 个参数。卷积核的权重在图里用颜色表示：橙 = 正，蓝 = 负。"
    >
      <div className="viz-row">
        <Tabs options={[{ key: "h", label: "输入：横线" }, { key: "v", label: "输入：竖线" }]} value={kind} onChange={setKind} ariaLabel="输入图" />
        <Tabs options={[{ key: "0", label: "看卷积核 1（横）" }, { key: "1", label: "看卷积核 2（竖）" }]} value={String(kSel) as "0" | "1"} onChange={(k) => setKSel(Number(k))} ariaLabel="卷积核" />
      </div>
      <Slider label="卷积核位置" value={pos} min={0} max={35} onChange={setPos} display={`第 ${i + 1} 行第 ${j + 1} 列`} />
      <div className="viz-scroll">
        <svg viewBox="0 0 700 290" role="img" aria-label={`位置 (${i}, ${j})：卷积核 ${kSel + 1} 的输出 ${Math.max(0, pre).toFixed(2)}；预测横线概率 ${(prob[0] * 100).toFixed(0)}%`} style={{ minWidth: 620 }}>
          <defs>
            <marker id="cnnarch-ink" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={INK} /></marker>
          </defs>
          <Cells vals={x} cols={SIDE} x={IX} y={IY} cell={C} color={(v) => gray(v)} title="输入 x（8 × 8）" />
          <rect x={IX + j * C} y={IY + i * C} width={3 * C} height={3 * C} fill="none" stroke={kSel === 0 ? ORANGE : BLUE} strokeWidth={2.5} style={{ transition: "all .2s" }} />
          <text x={IX} y={IY + 8 * C + 18} fontSize={10} fill={MUTED}>形状 (1, 8, 8)</text>

          <line x1={IX + 8 * C + 6} y1={IY + 60} x2={160} y2={IY + 60} stroke={INK} markerEnd="url(#cnnarch-ink)" />
          <Cells vals={K_H} cols={3} x={166} y={IY + 6} cell={16} color={(v) => diverge(v, 1)} title="核 1（横）" stroke={() => (kSel === 0 ? INK : undefined)} />
          <Cells vals={K_V} cols={3} x={166} y={IY + 82} cell={16} color={(v) => diverge(v, 1)} title="核 2（竖）" stroke={() => (kSel === 1 ? INK : undefined)} />
          <text x={166} y={IY + 8 * C + 18} fontSize={10} fill={MUTED}>2 × 3 × 3 权重</text>

          <line x1={220} y1={IY + 60} x2={244} y2={IY + 60} stroke={INK} markerEnd="url(#cnnarch-ink)" />
          {[0, 1].map((k) => (
            <g key={k}>
              <Cells vals={f.maps[k]} cols={6} x={250} y={IY + k * 100} cell={13} color={(v) => seq(v, 1.5)} title={`特征图 ${k + 1}`} stroke={(t) => (k === kSel && t === pos ? INK : undefined)} />
            </g>
          ))}
          <text x={250} y={IY + 8 * C + 18} fontSize={10} fill={MUTED}>(2, 6, 6)，ReLU 之后</text>

          {[0, 1].map((k) => (
            <g key={k}>
              <line x1={330} y1={IY + 39 + k * 100} x2={372} y2={IY + 39 + k * 100} stroke={INK} markerEnd="url(#cnnarch-ink)" />
              <circle cx={392} cy={IY + 39 + k * 100} r={17} fill="#fbf1cf" stroke="#d9b24a" strokeWidth={1.4} />
              <text x={392} y={IY + 43 + k * 100} fontSize={10.5} textAnchor="middle" fill={INK} className="mono">{f.h[k].toFixed(2)}</text>
            </g>
          ))}
          <text x={348} y={IY + 92} fontSize={9.5} fill={MUTED}>全局平均</text>
          <text x={372} y={IY + 8 * C + 18} fontSize={10} fill={MUTED}>(2)</text>

          {[0, 1].map((k) =>
            [0, 1].map((c) => {
              const w = PARAMS.V[c * 2 + k];
              return <line key={`${k}${c}`} x1={409} y1={IY + 39 + k * 100} x2={503} y2={IY + 39 + c * 100} stroke={w > 0 ? ORANGE : BLUE} strokeWidth={Math.abs(w) / 2} opacity={0.7} />;
            }),
          )}
          {["横", "竖"].map((lab, c) => (
            <g key={lab}>
              <circle cx={520} cy={IY + 39 + c * 100} r={17} fill="#fbe3d8" stroke={ORANGE} strokeWidth={1.4} />
              <text x={520} y={IY + 43 + c * 100} fontSize={11} textAnchor="middle" fill={INK} fontWeight={600}>{lab}</text>
              <rect x={548} y={IY + 31 + c * 100} width={110} height={16} rx={3} fill="#efede4" />
              <rect x={548} y={IY + 31 + c * 100} width={110 * prob[c]} height={16} rx={3} fill={ORANGE} style={{ transition: "width .3s" }} />
              <text x={664} y={IY + 43 + c * 100} fontSize={10.5} fill={INK} className="mono">{(prob[c] * 100).toFixed(0)}%</text>
            </g>
          ))}
          <text x={500} y={IY + 8 * C + 18} fontSize={10} fill={MUTED}>全连接 2 × 2 → softmax</text>

          <text x={IX} y={262} fontSize={11} fill={INK}>
            <tspan fontWeight={700}>这一格：</tspan>3 × 3 窗口里 9 个像素 × 核 {kSel + 1} 的 9 个权重，加起来 + 偏置 = {pre.toFixed(2)}，ReLU 后 = <tspan fontWeight={700}>{Math.max(0, pre).toFixed(2)}</tspan>
          </text>
          <text x={IX} y={280} fontSize={10} fill={MUTED} className="mono">
            {win.map((v, t) => `${v.toFixed(2)}×${ker[t] > 0 ? "" : "("}${ker[t]}${ker[t] > 0 ? "" : ")"}`).join(" + ")}
          </text>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: diverge(1, 1) }} />正权重</span>
        <span><i style={{ background: diverge(-1, 1) }} />负权重</span>
        <span><i style={{ background: seq(1, 1) }} />特征图里的大响应</span>
        <span><i style={{ background: "#fbf1cf", border: "1px solid #d9b24a" }} />池化后的特征</span>
      </div>
      <div className={`viz-narr${Math.max(0, pre) > 0.3 ? " is-good" : ""}`}>
        {Math.max(0, pre) > 0.3
          ? `窗口正好盖在线上，核 ${kSel + 1} 的形状和这段像素对上了，输出 ${pre.toFixed(2)}，特征图上这一格亮起来。整张特征图就是同一个核在 36 个位置各算一遍：所有位置共用这 9 个权重，所以线出现在哪里都能被认出来。`
          : `窗口里的像素和核 ${kSel + 1} 的形状对不上（或者是平的背景），加起来是 ${pre.toFixed(2)}，ReLU 把负数截成 0。拖动滑块，把窗口挪到线上看看。`}
        {" "}两张特征图各取平均，得到 ({f.h[0].toFixed(2)}, {f.h[1].toFixed(2)})，全连接层把它们变成「横」和「竖」的分数，softmax 后横线概率 {(prob[0] * 100).toFixed(0)}%。
      </div>
    </VisualizationFrame>
  );
}

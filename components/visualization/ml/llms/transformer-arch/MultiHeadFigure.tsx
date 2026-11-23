"use client";

import { useState } from "react";
import { BASE, multiHeadShapes, shapeText } from "@/lib/ml/transformerArch";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

const W = 700;
const H = 286;
const ID = "mhf";
const OPTIONS = [1, 2, 4, 8];
const ROWS: Record<number, number[]> = { 1: [142], 2: [100, 184], 3: [70, 142, 214] };
const CAT_Y = 62;
const CAT_H = 160;

export default function MultiHeadFigure() {
  const [heads, setHeads] = useState(BASE.heads);
  const s = multiHeadShapes(BASE.dModel, heads, BASE.m);
  const shown = Math.min(heads, 3);
  const ys = ROWS[shown];
  const labels = heads <= 3 ? Array.from({ length: heads }, (_, i) => i + 1) : [1, 2, heads];
  const seg = CAT_H / heads;

  return (
    <BahFrame
      title="图 1 · 从 Single-Head 到 Multi-Head：各算各的，再拼起来"
      description="同一个输入 X 送进每个 head。每个 head 有自己的三个投影矩阵，输出一个窄一些的结果；沿特征维拼接后再过 W_O。"
      footnote={<>d_model 固定为 {BASE.dModel}，每个 head 的宽度取 {BASE.dModel} / heads。head 数是设计模型时定下的超参数，这里切换只是比较几种设计的形状，不是训练好的模型可以随意改的开关。m = {BASE.m} 个 token。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择 head 数">
        {OPTIONS.map((h) => (
          <button key={h} type="button" aria-pressed={heads === h} className={`viz-btn${heads === h ? " is-on" : ""}`} onClick={() => setHeads(h)}>{h} 个 head</button>
        ))}
        <span className="viz-k">每个 head 宽 {s.dHead}</span>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>Multi-Head Attention 的结构</title>
          <desc id={`${ID}-desc`}>输入 X 形状 {BASE.dModel} 乘 m，同时进入 {heads} 个 head。每个 head 用自己的 W Q、W K、W V 做一次 Attention，输出 {shapeText(s.perHead)}。{heads} 个输出沿特征维拼接成 {shapeText(s.concat)}，再经过 W O 得到 {shapeText(s.out)}。</desc>
          <Markers id={ID} />

          <Box x={12} y={120} w={84} h={44} tone="neu" title="X" sub={`${BASE.dModel} × m`} />
          {ys.map((cy, i) => (
            <g key={cy}>
              <Arrow id={ID} tone="neu" d={`M96 142 H122 V${cy} H147`} />
              <Box x={150} y={cy - 22} w={236} h={44} tone="att" title={`Head ${labels[i]}：Attention`} sub={<>自己的 <Sym b="W" s="Q" />、<Sym b="W" s="K" />、<Sym b="W" s="V" />，不和别的 head 共用</>} />
              <Arrow id={ID} tone="dyn" d={`M386 ${cy} H409`} />
              <Box x={412} y={cy - 12} w={76} h={24} tone="dyn" title={`${s.dHead} × m`} size={10} />
              <Arrow id={ID} tone="dyn" d={`M488 ${cy} H517`} />
            </g>
          ))}
          {heads > 3 && <text x={268} y={183} fontSize={10} textAnchor="middle" fill={P.sub}>⋮ 中间还有 {heads - 3} 个 head</text>}

          {/* concatenation along the feature axis */}
          <text x={534} y={CAT_Y - 22} fontSize={10} fontWeight={600} textAnchor="middle" fill={P.ink}>Concat</text>
          <text x={534} y={CAT_Y - 9} fontSize={8.5} textAnchor="middle" fill={P.sub}>沿特征维</text>
          {Array.from({ length: heads }, (_, i) => (
            <rect key={i} x={520} y={CAT_Y + i * seg} width={28} height={seg} fill={P.dynFill} stroke={P.dyn} strokeWidth={1} />
          ))}
          <text x={534} y={CAT_Y + CAT_H + 15} fontSize={10} fontWeight={600} textAnchor="middle" fill={P.ink} className="mono">{shapeText(s.concat).replace(String(BASE.m), "m")}</text>
          <text x={534} y={CAT_Y + CAT_H + 29} fontSize={8.5} textAnchor="middle" fill={P.sub}>{heads} × {s.dHead} = {s.concat[0]}</text>

          <Arrow id={ID} tone="dyn" d="M548 142 H567" />
          <Box x={570} y={126} w={44} h={32} tone="neu" title={<Sym b="W" s="O" />} />
          <Arrow id={ID} tone="dyn" d="M614 142 H629" />
          <Box x={632} y={120} w={60} h={44} tone="dyn" bold title="输出" sub={`${BASE.dModel} × m`} />
        </svg>
      </div>
      <Legend items={[{ tone: "att", label: "一个 head 的 Attention（参数各自独立）" }, { tone: "dyn", label: "head 的输出与拼接结果" }, { tone: "neu", label: "输入与 W_O" }]} />
      <div className="viz-narr" aria-live="polite">
        {heads === 1
          ? <>只有 1 个 head：它的宽度就是 {s.dHead}，这就是上一章的单头 Attention，没有什么可拼的。</>
          : <>{heads} 个 head 各输出 {s.dHead} × m，拼起来是 {heads} × {s.dHead} = {s.concat[0]} 行，再由 W_O 映射回 {BASE.dModel} × m。</>}
        {" "}列数始终是 m：head 变多，变的是每个 head 的宽度，token 的个数不变。同一个 head 的三个矩阵对所有 token 位置共用，不同 head 之间不共用。
      </div>
    </BahFrame>
  );
}

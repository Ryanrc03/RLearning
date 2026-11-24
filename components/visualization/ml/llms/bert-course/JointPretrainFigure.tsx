"use client";

import { useState } from "react";
import { JOINT_EXAMPLE, JOINT_TOKENS, jointLoss } from "@/lib/ml/bertPretrain";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

type Mode = "none" | "forward" | "backward";

const W = 700;
const H = 356;
const ID = "jpf";
const CELL = 41;
const X0 = 22;
const cx = (i: number) => X0 + i * CELL + CELL / 2;
const [M1, M2] = JOINT_EXAMPLE.masks;
const J = jointLoss();
const f3 = (v: number) => v.toFixed(3);

export default function JointPretrainFigure() {
  const [mode, setMode] = useState<Mode>("none");
  const fwdDim = mode === "backward";
  const fwdBold = mode === "forward";
  const back = mode !== "forward";

  return (
    <BahFrame
      title="图 5 · 联合预训练：一个 Encoder，两种头，loss 合在一起"
      description="同一条序列只过一次 Encoder。[CLS] 的输出给 NSP，两个 [MASK] 的输出给同一个 MLM Head。"
      footnote={<>教学示例：三个预测概率（IsNext {JOINT_EXAMPLE.nsp.pIsNext}、branch {M1.p}、was {M2.p}）是假设的，loss 由它们算出。这里画的是一条样本；实际一个 batch 里有很多条这样的序列。灰色虚线是 loss 和梯度。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${mode === "forward" ? " is-on" : ""}`} onClick={() => setMode("forward")}>前向：算出 loss</button>
        <button type="button" className={`viz-btn${mode === "backward" ? " is-on" : ""}`} onClick={() => setMode("backward")}>反向：梯度回到哪里</button>
        <button type="button" className="viz-btn" onClick={() => setMode("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>MLM 与 NSP 的联合预训练</title>
          <desc id={`${ID}-desc`}>输入序列是 CLS calculus is a MASK of math SEP it MASK developed by newton and leibniz SEP。它只经过一个 BERT Encoder。CLS 位置的输出进入 NSP 头，目标是 IsNext，loss 约 {f3(J.nsp)}。两个 MASK 位置的输出进入同一个 MLM 头，目标分别是 branch 和 was，loss 约 {f3(J.mlmEach[0])} 和 {f3(J.mlmEach[1])}。MLM 的两项取平均得 {f3(J.mlm)}，加上 NSP 的 loss 得到总 loss {f3(J.total)}。反向传播时，所有 loss 的梯度都回到同一个 Encoder。</desc>
          <Markers id={ID} />

          {/* one sequence */}
          {JOINT_TOKENS.map((tok, i) => {
            const special = tok === "[MASK]" ? "att" : tok === "[CLS]" ? "dec" : "neu";
            const used = i === 0 || i === M1.position || i === M2.position;
            return (
              <g key={i}>
                <Box x={X0 + i * CELL + 1} y={312} w={CELL - 2} h={24} tone={special} bold={used} title={tok} size={tok.length > 7 ? 6.6 : 7.6} />
                <Arrow id={ID} tone="neu" d={`M${cx(i)} 312 V283`} dim={fwdDim} head={used} />
              </g>
            );
          })}
          <text x={X0} y={350} fontSize={8.5} fill={P.sub}>A：calculus is a [branch] of math　　B：it [was] developed by newton and leibniz</text>
          <Box x={X0} y={240} w={W - 2 * X0} h={40} tone="enc" bold title="同一个 BERT Encoder" sub="整条序列只前向一次；不是 MLM 一个、NSP 一个" />

          {/* hidden states that are used */}
          <Arrow id={ID} tone="dyn" d={`M${cx(0)} 240 V215`} dim={fwdDim} bold={fwdBold} />
          <Box x={cx(0) - 20} y={190} w={52} h={22} tone="dyn" title={<Sym b="h" s="CLS" />} dim={fwdDim} size={9.5} />
          {[M1, M2].map((mk, k) => (
            <g key={mk.target}>
              <Arrow id={ID} tone="dyn" d={`M${cx(mk.position)} 240 V215`} dim={fwdDim} bold={fwdBold} />
              <Box x={cx(mk.position) - 26} y={190} w={52} h={22} tone="dyn" title={<Sym b="u" s={`M${k + 1}`} />} dim={fwdDim} size={9.5} />
              <Arrow id={ID} tone="att" d={`M${cx(mk.position)} 190 V171`} dim={fwdDim} bold={fwdBold} />
              <Arrow id={ID} tone="att" d={`M${cx(mk.position)} 134 V113`} dim={fwdDim} bold={fwdBold} />
              <Box x={cx(mk.position) - 62} y={74} w={124} h={36} tone="grey" dashed title={<>L<tspan dy={3} fontSize="0.74em">MLM,{k + 1}</tspan><tspan dy={-3}> = {f3(J.mlmEach[k])}</tspan></>} sub={`目标「${mk.target}」，p = ${mk.p}`} size={9.5} />
            </g>
          ))}
          <Arrow id={ID} tone="dec" d={`M${cx(0) + 6} 190 V171`} dim={fwdDim} bold={fwdBold} />

          {/* heads */}
          <Box x={X0} y={134} w={118} h={34} tone="dec" title="NSP Head" sub="二分类" dim={fwdDim} bold={fwdBold} />
          <Box x={164} y={134} w={320} h={34} tone="att" title="MLM Head（同一个，两个位置共用）" sub="每个位置 → 词表上的分布" dim={fwdDim} bold={fwdBold} />
          <Arrow id={ID} tone="dec" d="M81 134 V113" dim={fwdDim} bold={fwdBold} />
          <Box x={X0} y={74} w={118} h={36} tone="grey" dashed title={<>L<tspan dy={3} fontSize="0.74em">NSP</tspan><tspan dy={-3}> = {f3(J.nsp)}</tspan></>} sub={`目标 ${JOINT_EXAMPLE.nsp.label}，p = ${JOINT_EXAMPLE.nsp.pIsNext}`} size={9.5} />

          {/* combining the losses */}
          <Arrow id={ID} tone="grey" dashed d={`M${cx(M1.position)} 74 V44 H277`} dim={fwdDim} />
          <Arrow id={ID} tone="grey" dashed d={`M${cx(M2.position)} 74 V44 H383`} dim={fwdDim} />
          <Box x={280} y={28} w={100} h={30} tone="grey" dashed title={<>平均：L<tspan dy={3} fontSize="0.74em">MLM</tspan><tspan dy={-3}> = {f3(J.mlm)}</tspan></>} size={9} dim={fwdDim} />
          <Arrow id={ID} tone="grey" dashed d="M330 28 V14 H560 V25" dim={fwdDim} />
          <Arrow id={ID} tone="grey" dashed d="M81 74 V8 H610 V25" dim={fwdDim} />
          <Box x={520} y={28} w={164} h={40} tone="grey" dashed bold title={<>L = L<tspan dy={3} fontSize="0.74em">MLM</tspan><tspan dy={-3}> + L</tspan><tspan dy={3} fontSize="0.74em">NSP</tspan><tspan dy={-3}> = {f3(J.total)}</tspan></>} sub="一个数，对它求梯度" size={10} />

          {/* backward */}
          <g opacity={back ? 1 : 0.28} className="bah-fade">
            <path d="M640 68 V237" fill="none" stroke={P.ink} strokeWidth={mode === "backward" ? 2.4 : 1.4} strokeDasharray="6 4" markerEnd={`url(#${ID}-neu)`} />
            <text x={634} y={150} fontSize={9} textAnchor="end" fill={P.ink}>梯度：两类 loss</text>
            <text x={634} y={163} fontSize={9} textAnchor="end" fill={P.ink}>都回到同一个 Encoder</text>
          </g>
        </svg>
      </div>
      <Legend items={[{ tone: "enc", label: "共享的 BERT Encoder" }, { tone: "att", label: "MLM：[MASK] 与 MLM Head" }, { tone: "dec", label: "NSP：[CLS] 与 NSP Head" }, { tone: "dyn", label: "被用到的隐藏向量" }, { tone: "grey", label: "loss 与梯度（只在训练时）" }]} />
      <div className={`viz-narr${mode === "forward" ? " is-warn" : mode === "backward" ? " is-good" : ""}`} aria-live="polite">
        {mode === "backward"
          ? <>反向：总 loss 是一个数。它的梯度先分到 NSP Head 和 MLM Head，再汇到同一个 Encoder，一直传到 embedding。Encoder 的每个参数同时收到两类任务的梯度，optimizer 用它们的和更新一次。</>
          : <>前向：三个 loss 分别是 L<sub>NSP</sub> = {f3(J.nsp)}、L<sub>MLM,1</sub> = {f3(J.mlmEach[0])}、L<sub>MLM,2</sub> = {f3(J.mlmEach[1])}。规范的写法先把 MLM 的两项取平均（{f3(J.mlm)}），再加 NSP：{f3(J.mlm)} + {f3(J.nsp)} = {f3(J.total)}。课件为了直观把三项直接相加，得到 {f3(J.sumOfThree)}；两种写法里都是同样的三项，只差 MLM 部分除不除以位置数。</>}
      </div>
    </BahFrame>
  );
}

"use client";

import { useState } from "react";
import { DEMO_STEPS, SOURCE_TOKENS, type DemoStepKey } from "@/lib/ml/bahdanau";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "./shared";

type Focus = "none" | "train" | "infer";

const W = 700;
const H = 316;
const ID = "tvi";
const STACK_Y = [28, 76, 124, 172, 220, 268];
const KEYS: DemoStepKey[] = ["a", "b"];
const COL_X: Record<DemoStepKey, number> = { a: 452, b: 612 };
const BAR_H = 44;

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: "左边是训练，右边是推理，两边用的是同一套绿色的 θₐ。左边灰色虚线是只在训练时存在的东西：Loss、往回传的梯度和 optimizer。右边没有这些，只有前向计算。",
  },
  train: {
    text: "训练：实线向上是前向计算，θₐ 算出 e，e 过 softmax 成 α，α 加权出 cⱼ，cⱼ 进入 Decoder 得到预测和 Loss。虚线向下是梯度：Loss 沿同一条路倒着传回来，α 和 e 不是参数，但它们可导，梯度穿过它们到达 θₐ，optimizer 再把 θₐ 改一点。所有源位置、所有 step 的梯度都加在这一套参数上。",
    tone: "is-warn",
  },
  infer: {
    text: "推理：θₐ 已经固定，不再有 Loss、梯度和 optimizer。每个 Decoder step 只做前向计算：把当前的查询状态和 H 送进同一个打分函数，现算出一组 α。两步的 α 不同，是因为输入不同，不是因为参数被改了。",
    tone: "is-good",
  },
};

export default function TrainVsInferenceFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const dimL = focus === "infer";
  const dimR = focus === "train";
  const boldL = focus === "train";
  const boldR = focus === "infer";
  const narr = NARR[focus];

  const stack = [
    { tone: "grey" as const, dashed: true, title: <>Loss = −Σ log p(<Sym b="y" s="j" />)</> },
    { tone: "dec" as const, title: <>Decoder 状态 <Sym b="s" s="j" /> 与输出层</> },
    { tone: "dyn" as const, title: <><Sym b="c" s="j" /> = Σ <Sym b="α" s="j,i" /> <Sym b="h" s="i" /></> },
    { tone: "dyn" as const, title: <><Sym b="α" s="j,i" /> = softmax(<Sym b="e" s="j,i" />)</> },
    { tone: "dyn" as const, title: <><Sym b="e" s="j,i" /> = a(<Sym b="s" s="j−1" />, <Sym b="h" s="i" />; <Sym b="θ" s="a" />)</> },
    { tone: "par" as const, title: <>共享参数 <Sym b="θ" s="a" />：<Sym b="W" s="a" />, <Sym b="U" s="a" />, <Sym b="v" s="a" />, <Sym b="b" s="a" /></> },
  ];

  return (
    <BahFrame
      title="图 5 · 训练时更新参数，推理时只算权重"
      description="同一套打分参数在两个阶段里的角色：训练时被梯度更新，推理时固定不动、对每一步现算 α。"
      footnote={<>右边两组权重是图 3 的教学示例值（各自和为 1），不是真实模型的输出。左边省略了 Encoder / Decoder 自身的权重，它们同样被这个 Loss 更新。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "train" ? " is-on" : ""}`} onClick={() => setFocus("train")}>训练一步</button>
        <button type="button" className={`viz-btn${focus === "infer" ? " is-on" : ""}`} onClick={() => setFocus("infer")}>推理两步</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 620 }}>
          <title id={`${ID}-title`}>训练与推理中 Attention 参数和权重的区别</title>
          <desc id={`${ID}-desc`}>左侧训练：前向从共享参数算出分数、权重、context、Decoder 状态和 Loss；梯度从 Loss 依次经过 Decoder、context、softmax 权重、分数回到共享参数，optimizer 更新参数。右侧推理：参数固定，两个 Decoder step 各自用查询状态和 Encoder 状态现算出一组权重，没有梯度。</desc>
          <Markers id={ID} />

          <text x={150} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimL ? 0.28 : 1} className="bah-fade">训练：Loss 的梯度回到共享参数</text>
          <text x={532} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimR ? 0.28 : 1} className="bah-fade">推理：参数固定，每一步现算 α</text>
          <line x1={362} y1={6} x2={362} y2={H - 6} stroke={P.grey} strokeWidth={0.8} strokeDasharray="3 3" />

          {/* left: forward up, gradient down */}
          {stack.map((s, i) => (
            <Box key={STACK_Y[i]} x={40} y={STACK_Y[i]} w={220} h={30} tone={s.tone} dashed={s.dashed} title={s.title} size={10} dim={dimL} bold={boldL && i === stack.length - 1} />
          ))}
          {STACK_Y.slice(1).map((y, i) => (
            <g key={y}>
              <Arrow id={ID} tone="dyn" d={`M110 ${y} V${STACK_Y[i] + 33}`} dim={dimL} />
              <Arrow id={ID} tone="grey" dashed d={`M190 ${STACK_Y[i] + 30} V${y - 3}`} dim={dimL} bold={boldL} />
            </g>
          ))}
          <text x={104} y={211} fontSize={8.5} textAnchor="end" fill={P.sub} opacity={dimL ? 0.28 : 1} className="bah-fade">前向</text>
          <text x={196} y={211} fontSize={8.5} fill={P.sub} opacity={dimL ? 0.28 : 1} className="bah-fade">梯度</text>
          <Box x={276} y={220} w={76} h={30} tone="grey" dashed title="optimizer" dim={dimL} size={10} />
          <Arrow id={ID} tone="grey" dashed d="M314 250 V283 H263" dim={dimL} bold={boldL} />
          <text x={318} y={270} fontSize={8.5} fill={P.sub} opacity={dimL ? 0.28 : 1} className="bah-fade">更新</text>

          {/* right: fixed parameters, two forward passes */}
          <Box x={452} y={28} w={160} h={34} tone="par" bold={boldR} title={<><Sym b="θ" s="a" />：训练好之后固定</>} sub="没有 Loss · 没有梯度" dim={dimR} />
          {KEYS.map((k) => {
            const x = COL_X[k];
            const step = DEMO_STEPS[k];
            const top = step.weights.indexOf(Math.max(...step.weights));
            return (
              <g key={k} opacity={dimR ? 0.28 : 1} className="bah-fade">
                <Box x={x - 70} y={86} w={140} h={32} tone="dec" title={<>查询 <Sym b="s" s={String(step.j - 1)} /> + 全部 <Sym b="h" s="i" /></>} sub={`生成「${step.target}」之前`} size={10} />
                <Arrow id={ID} tone="dec" d={`M${x} 118 V137`} />
                <Box x={x - 70} y={140} w={140} h={32} tone="par" title="打分 + softmax" sub="同一套 θₐ" size={10} />
                <Arrow id={ID} tone="par" d={k === "a" ? "M532 62 V156 H525" : "M532 62 V156 H539"} />
                <Arrow id={ID} tone="dyn" d={`M${x} 172 V191`} />
                <rect x={x - 70} y={194} width={140} height={98} rx={6} fill={P.surface} stroke={P.dyn} strokeWidth={1.3} />
                {step.weights.map((w, i) => {
                  const bx = x - 58 + i * 31;
                  const bh = Math.round((w * BAR_H) / 0.7);
                  return (
                    <g key={SOURCE_TOKENS[i]}>
                      <rect x={bx} y={258 - bh} width={22} height={bh} rx={2} fill={P.dyn} opacity={i === top ? 1 : 0.5} />
                      <text x={bx + 11} y={254 - bh} fontSize={8.5} fontWeight={i === top ? 700 : 400} textAnchor="middle" fill={P.ink} className="mono">{w.toFixed(2)}</text>
                      <text x={bx + 11} y={270} fontSize={7} textAnchor="middle" fill={P.sub}>{SOURCE_TOKENS[i]}</text>
                    </g>
                  );
                })}
                <text x={x} y={285} fontSize={8.5} textAnchor="middle" fill={P.ink}>α（j = {step.j}），最大：{SOURCE_TOKENS[top]}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <Legend items={[{ tone: "par", label: "共享参数 θₐ：训练时更新，推理时固定" }, { tone: "dyn", label: "前向现算的 e、α、c" }, { tone: "grey", label: "只在训练时存在：Loss、梯度、optimizer" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}

"use client";

import { useState } from "react";
import { DEMO_STATES, DEMO_STEPS, SOURCE_TOKENS, demoAttention, type DemoStepKey } from "@/lib/ml/bahdanau";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "./shared";

const W = 700;
const H = 318;
const ID = "shp";
const ROW_Y = [70, 126, 182, 238];
const ROW_H = 44;
const BAR_X = 432;
const BAR_MAX = 96;

const KEYS: DemoStepKey[] = ["a", "b"];
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;

export default function SharedParamsFigure() {
  const [key, setKey] = useState<DemoStepKey>("a");
  const step = DEMO_STEPS[key];
  const { scores, weights, context } = demoAttention(key);
  const top = weights.indexOf(Math.max(...weights));
  const q = String(step.j - 1);
  const ctx = `(${context.map((v) => v.toFixed(2)).join(", ")})`;

  return (
    <BahFrame
      title="图 3 · 同一套参数，不同的权重"
      description="在两个 Decoder step 之间切换：绿色的参数框一个字都不变，变的是查询状态，以及由它算出来的分数、权重和 context。"
      footnote={<>教学示例：两组权重（每组和为 1）是示意值，不是由图 2 的 [0, 0, 2, 0] 算出来的，也不是真实模型的输出。分数取的是 softmax 后恰好等于这组权重、均值为 0 的那一组；hᵢ 用 2 维示意向量 {DEMO_STATES.map((h) => `(${h.join(", ")})`).join("、")}，cⱼ 由它们加权求和算出。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择 Decoder step">
        {KEYS.map((k) => (
          <button key={k} type="button" aria-pressed={key === k} className={`viz-btn${key === k ? " is-on" : ""}`} onClick={() => setKey(k)}>
            Step {k.toUpperCase()}：生成「{DEMO_STEPS[k].target}」
          </button>
        ))}
        <span className="viz-k">j = {step.j}，查询状态是 s<sub>{q}</sub></span>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 620 }}>
          <title id={`${ID}-title`}>参数共享而权重动态变化</title>
          <desc id={`${ID}-desc`}>四个源位置使用同一个打分函数和同一套参数 W a、U a、v a、b a。当前是生成「{step.target}」的一步，查询状态是 s {q}，四个位置的权重依次是 {weights.join("、")}，最大的是 {SOURCE_TOKENS[top]}。切换 step 时参数不变，权重改变。</desc>
          <Markers id={ID} />

          {/* shared parameters: one box, one thread through all four scorers */}
          <Arrow id={ID} tone="par" d={`M255 50 V${ROW_Y[3] + 4}`} head={false} bold />
          <Box x={176} y={6} w={236} h={44} tone="par" bold title={<>共享参数 <Sym b="θ" s="a" /> = {"{ "}<Sym b="W" s="a" />, <Sym b="U" s="a" />, <Sym b="v" s="a" />, <Sym b="b" s="a" />{" }"}</>} sub="只有这一套 · 切换 step 不变 · 四个位置共用" />

          {/* query: changes with the step */}
          <Box x={14} y={10} w={126} h={36} tone="dec" title={<>查询状态 <Sym b="s" s={q} /></>} sub={`生成「${step.target}」之前`} bold />
          <Arrow id={ID} tone="dec" d={`M150 46 V${ROW_Y[3] + 32}`} head={false} />
          <path d="M140 28 H150 V46" fill="none" stroke={P.dec} strokeWidth={1.3} />

          <text x={376} y={62} fontSize={9.5} textAnchor="middle" fill={P.sub}>分数 e</text>
          <text x={480} y={62} fontSize={9.5} textAnchor="middle" fill={P.sub}>权重 α</text>

          {ROW_Y.map((y, i) => {
            const mid = y + ROW_H / 2;
            const isTop = i === top;
            return (
              <g key={y}>
                <Box x={20} y={y} w={80} h={ROW_H} tone="enc" title={<Sym b="h" s={String(i + 1)} />} sub={SOURCE_TOKENS[i]} />
                <Arrow id={ID} tone="enc" d={`M100 ${y + 13} H187`} />
                <Arrow id={ID} tone="dec" d={`M150 ${y + 32} H187`} />
                <Box x={190} y={y} w={130} h={ROW_H} tone="par" title={<>a( <Sym b="s" s={q} /> , <Sym b="h" s={String(i + 1)} /> ; <Sym b="θ" s="a" /> )</>} sub="同一个函数，同一套参数" />
                <Arrow id={ID} tone="dyn" d={`M320 ${mid} H345`} />
                <Box x={348} y={mid - 13} w={56} h={26} tone="dyn" title={signed(scores[i])} size={10} />
                <Arrow id={ID} tone="dyn" d={`M404 ${mid} H429`} />
                <rect x={BAR_X} y={mid - 9} width={BAR_MAX} height={18} rx={3} fill={P.surface} stroke={P.grey} strokeWidth={0.6} />
                <rect className="bah-bar" x={BAR_X} y={mid - 9} width={Math.round(weights[i] * BAR_MAX * 10) / 10} height={18} rx={3} fill={P.dyn} opacity={isTop ? 1 : 0.5} />
                <text x={BAR_X + BAR_MAX + 6} y={mid + 4} fontSize={10} fontWeight={isTop ? 700 : 400} fill={P.ink} className="mono">{weights[i].toFixed(2)}</text>
                {isTop && <text x={BAR_X + BAR_MAX / 2} y={mid - 12} fontSize={8.5} fontWeight={600} textAnchor="middle" fill={P.ink}>最大：{SOURCE_TOKENS[i]}</text>}
              </g>
            );
          })}

          {/* context for this step */}
          <path d={`M574 ${ROW_Y[0] + 4} H590 V${ROW_Y[3] + ROW_H - 4} H574`} fill="none" stroke={P.dyn} strokeWidth={1.3} />
          <Arrow id={ID} tone="dyn" d="M590 176 H607" />
          <Box x={610} y={152} w={84} h={48} tone="dyn" bold title={<><Sym b="c" s={String(step.j)} /> = Σ <Sym b="α" s="i" /><Sym b="h" s="i" /></>} sub={ctx} size={10} />
        </svg>
      </div>
      <Legend items={[{ tone: "par", label: "可训练、共享：θₐ 只有一套" }, { tone: "dyn", label: "动态：e、α、c 每一步现算" }, { tone: "dec", label: "查询状态，随 step 变" }, { tone: "enc", label: "Encoder 状态，两步读的是同一组" }]} />
      <div className={`viz-narr ${key === "a" ? "is-warn" : "is-good"}`} aria-live="polite">
        Step {key.toUpperCase()}（j = {step.j}）：Decoder 准备生成「{step.target}」，查询状态是 s<sub>{q}</sub>。四个位置都调用同一个 a(·,·; θₐ)，算出的权重是 [{weights.map((w) => w.toFixed(2)).join(", ")}]，最大的落在 <b>{SOURCE_TOKENS[top]}</b> 上，context 是 {ctx}。
        {key === "a" ? " 现在切到 Step B：绿色的框和四个打分模块不会动，只有橙色的查询和黄色的数字会变。" : " 和 Step A 比，参数框没有任何变化；权重从 love 移到 machine，只是因为送进去的查询状态从 s₁ 换成了 s₂。"}
      </div>
    </BahFrame>
  );
}

"use client";

import { useState } from "react";
import { READING_STEPS, SENTENCE, readingStep } from "@/lib/ml/rnnSelfAttention";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

const W = 700;
const H = 250;
const ID = "snh";
const TOK_W = 96;
const PITCH = 108;
const X0 = 32;
const BASE = 152;
const SCALE = 96;

const cx = (i: number) => X0 + TOK_W / 2 + i * PITCH;

export default function SentenceHistoryFigure() {
  const [t, setT] = useState<number>(READING_STEPS[0]);
  const step = readingStep(t);
  const cur = t - 1;
  const prev = String(t - 1);
  const curX = cx(cur);
  const sumText = step.weights.map((w, i) => `${w.toFixed(2)}·h${"₁₂₃₄₅"[i]}`).join(" + ");

  return (
    <BahFrame
      title="图 5 · 读一句话：每个词可以回看哪些历史状态"
      description="按顺序读 The FBI is chasing a criminal。切换当前词，看它能回看哪些已读过的词，以及一组模拟的权重。"
      footnote={<>模拟数据：每组权重和为 1，是为了讲解设定的，不是论文或任何模型的实际输出，也不代表这句话语义上唯一正确的对应关系。例句取自 Cheng 等人论文的示例句，图是重新画的。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择当前读到的词">
        {READING_STEPS.map((s) => (
          <button key={s} type="button" aria-pressed={t === s} className={`viz-btn${t === s ? " is-on" : ""}`} onClick={() => setT(s)}>
            t = {s}：{SENTENCE[s - 1]}
          </button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>逐词阅读时对历史状态的注意力</title>
          <desc id={`${ID}-desc`}>当前读到第 {t} 个词 {step.token}。可以回看的历史位置是 {step.history.join("、")}，模拟权重依次为 {step.weights.join("、")}，和为 1。后面的词还没有读到，不能访问。</desc>
          <Markers id={ID} />

          {SENTENCE.map((tok, i) => {
            const x = X0 + i * PITCH;
            const past = i < cur;
            const current = i === cur;
            return (
              <g key={tok}>
                <Box
                  x={x} y={16} w={TOK_W} h={40}
                  tone={current ? "dec" : past ? "enc" : "grey"}
                  bold={current} dashed={!past && !current} dim={!past && !current}
                  title={tok}
                  sub={current ? <>当前输入 <Sym b="x" s={String(i + 1)} /></> : past ? <>已读 · <Sym b="h" s={String(i + 1)} /></> : "未读，不可访问"}
                />
                {past && (
                  <g>
                    <rect x={cx(i) - 15} y={BASE - Math.round(step.weights[i] * SCALE)} width={30} height={Math.round(step.weights[i] * SCALE)} rx={3} fill={P.dyn} opacity={i === step.top ? 1 : 0.5} />
                    <line x1={cx(i) - 22} y1={BASE} x2={cx(i) + 22} y2={BASE} stroke={P.grey} strokeWidth={1} />
                    <text x={cx(i)} y={BASE - Math.round(step.weights[i] * SCALE) - 5} fontSize={10} fontWeight={i === step.top ? 700 : 400} textAnchor="middle" fill={P.ink} className="mono">{step.weights[i].toFixed(2)}</text>
                    {i === step.top && <text x={cx(i)} y={BASE + 13} fontSize={8.5} fontWeight={600} textAnchor="middle" fill={P.ink}>权重最大</text>}
                  </g>
                )}
              </g>
            );
          })}

          {/* history → c_{t−1} */}
          <path d={`M${cx(0)} ${BASE + 20} V${BASE + 28} H${Math.max(cx(cur - 1), 170)} V${BASE + 20}`} fill="none" stroke={P.dyn} strokeWidth={1.3} />
          <Arrow id={ID} tone="dyn" d={`M130 ${BASE + 28} V${BASE + 47}`} />
          <Box x={40} y={BASE + 50} w={180} h={40} tone="dyn" bold title={<><Sym b="c" s={prev} /> = Σ <Sym b="α" s={`${prev},i`} /> <Sym b="h" s="i" /></>} sub={`历史 h₁ … h${"₁₂₃₄₅"[t - 2]} 的加权汇总`} />

          {/* c_{t−1} and x_t → h_t */}
          <Arrow id={ID} tone="dyn" d={`M220 ${BASE + 70} H437`} />
          <Arrow id={ID} tone="dec" d={curX >= 450 ? `M${curX} 56 V${BASE + 47}` : `M${curX} 56 V${BASE + 36} H470 V${BASE + 47}`} />
          <Box x={440} y={BASE + 50} w={244} h={40} tone="par" bold title={<><Sym b="h" s={String(t)} /> = tanh(A[<Sym b="x" s={String(t)} />; <Sym b="c" s={prev} />] + b)</>} sub={`读入「${step.token}」时的状态更新`} />
        </svg>
      </div>
      <Legend items={[{ tone: "dec", label: "当前正在读的词" }, { tone: "enc", label: "已读的词：它的 h 可以回看" }, { tone: "grey", label: "未读的词：不可访问" }, { tone: "dyn", label: "模拟权重与 context" }]} />
      <div className="viz-narr" aria-live="polite">
        读到第 {t} 个词「<b>{step.token}</b>」时，可以回看的是 {step.history.map((h) => `「${h}」`).join("")} 这 {step.history.length} 个已读位置，后面的词还没出现。这组模拟权重里最大的是「<b>{step.history[step.top]}</b>」（{step.weights[step.top].toFixed(2)}），但其余位置也都参与：c<sub>{prev}</sub> = {sumText}。接着 h<sub>{t}</sub> = tanh(A[x<sub>{t}</sub>; c<sub>{prev}</sub>] + b)。
      </div>
    </BahFrame>
  );
}

"use client";

import { useState } from "react";
import { SENTENCE, readingStep } from "@/lib/ml/rnnSelfAttention";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

type Key = "a" | "b";

const W = 700;
const H = 318;
const ID = "sap";
const ROW_Y = [70, 126, 182, 238];
const ROW_H = 44;
const BAR_X = 432;
const BAR_MAX = 96;

/** Step A builds c_3 (read before "chasing"), step B builds c_4 (read before "a"). */
const READ_T: Record<Key, number> = { a: 4, b: 5 };
const KEYS: Key[] = ["a", "b"];
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;

export default function SharedAlignParamsFigure() {
  const [key, setKey] = useState<Key>("a");
  const step = readingStep(READ_T[key]);
  const q = String(step.t - 1);
  const used = step.weights.length;

  return (
    <BahFrame
      title="图 4 · 同一个打分函数，不同的权重"
      description="在两个时间步之间切换：绿色的参数框不变；变的是查询、可看的历史状态个数，以及由它们算出的分数和权重。"
      footnote={<>模拟数据：两组权重各自和为 1，是为了讲解设定的，不是训练好的模型的输出；分数取的是 softmax 后恰好等于这组权重、均值为 0 的那一组。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择时间步">
        {KEYS.map((k) => (
          <button key={k} type="button" aria-pressed={key === k} className={`viz-btn${key === k ? " is-on" : ""}`} onClick={() => setKey(k)}>
            Step {k.toUpperCase()}：算 c<sub>{READ_T[k] - 1}</sub>
          </button>
        ))}
        <span className="viz-k">c<sub>{q}</sub> 随后用来读「{step.token}」</span>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 620 }}>
          <title id={`${ID}-title`}>打分参数共享而权重动态变化</title>
          <desc id={`${ID}-desc`}>所有历史位置使用同一个 align 函数和同一套参数 theta att。当前在算 c {q}，可看的历史状态有 {used} 个，权重依次是 {step.weights.join("、")}，最大的是 {step.history[step.top]}。切换时间步时参数不变，权重改变。</desc>
          <Markers id={ID} />

          <Arrow id={ID} tone="par" d={`M255 50 V${ROW_Y[3] + 4}`} head={false} bold />
          <Box x={176} y={6} w={236} h={44} tone="par" bold title={<>共享参数 <Sym b="θ" s="att" /></>} sub="只有这一套 · 切换时间步不变 · 所有位置共用" />

          <Box x={14} y={10} w={126} h={36} tone="dec" title={<>查询 <Sym b="query" s={q} /></>} sub={`读完「${SENTENCE[step.t - 2]}」之后`} bold />
          <path d="M140 28 H150 V46" fill="none" stroke={P.dec} strokeWidth={1.3} />
          <Arrow id={ID} tone="dec" d={`M150 46 V${ROW_Y[used - 1] + 32}`} head={false} />

          <text x={376} y={62} fontSize={9.5} textAnchor="middle" fill={P.sub}>分数 e</text>
          <text x={480} y={62} fontSize={9.5} textAnchor="middle" fill={P.sub}>权重 α</text>

          {ROW_Y.map((y, i) => {
            const mid = y + ROW_H / 2;
            const active = i < used;
            const isTop = i === step.top;
            return (
              <g key={y}>
                <Box x={20} y={y} w={80} h={ROW_H} tone={active ? "enc" : "grey"} dashed={!active} dim={!active} title={<Sym b="h" s={String(i + 1)} />} sub={active ? SENTENCE[i] : `${SENTENCE[i]} · 还没算出`} />
                <Box x={190} y={y} w={130} h={ROW_H} tone="par" dim={!active} title={<>align( <Sym b="h" s={String(i + 1)} /> , <Sym b="query" s={q} /> ; <Sym b="θ" s="att" /> )</>} sub="同一个函数，同一套参数" size={9.5} />
                {active && (
                  <g>
                    <Arrow id={ID} tone="enc" d={`M100 ${y + 13} H187`} />
                    <Arrow id={ID} tone="dec" d={`M150 ${y + 32} H187`} />
                    <Arrow id={ID} tone="dyn" d={`M320 ${mid} H345`} />
                    <Box x={348} y={mid - 13} w={56} h={26} tone="dyn" title={signed(step.scores[i])} size={10} />
                    <Arrow id={ID} tone="dyn" d={`M404 ${mid} H429`} />
                    <rect x={BAR_X} y={mid - 9} width={BAR_MAX} height={18} rx={3} fill={P.surface} stroke={P.grey} strokeWidth={0.6} />
                    <rect className="bah-bar" x={BAR_X} y={mid - 9} width={Math.round(step.weights[i] * BAR_MAX * 10) / 10} height={18} rx={3} fill={P.dyn} opacity={isTop ? 1 : 0.5} />
                    <text x={BAR_X + BAR_MAX + 6} y={mid + 4} fontSize={10} fontWeight={isTop ? 700 : 400} fill={P.ink} className="mono">{step.weights[i].toFixed(2)}</text>
                    {isTop && <text x={BAR_X + BAR_MAX / 2} y={mid - 12} fontSize={8.5} fontWeight={600} textAnchor="middle" fill={P.ink}>最大：{SENTENCE[i]}</text>}
                  </g>
                )}
                {!active && <text x={BAR_X} y={mid + 4} fontSize={9} fill={P.sub}>这一步看不到，不打分</text>}
              </g>
            );
          })}

          <path d={`M574 ${ROW_Y[0] + 4} H590 V${ROW_Y[used - 1] + ROW_H - 4} H574`} fill="none" stroke={P.dyn} strokeWidth={1.3} />
          <Arrow id={ID} tone="dyn" d="M590 148 H607" />
          <Box x={610} y={124} w={84} h={48} tone="dyn" bold title={<><Sym b="c" s={q} /> = Σ <Sym b="α" s="i" /><Sym b="h" s="i" /></>} sub={`i = 1 … ${used}`} size={10} />
        </svg>
      </div>
      <Legend items={[{ tone: "par", label: "可训练、共享：θ_att 只有一套" }, { tone: "dyn", label: "动态：e、α、c 每一步现算" }, { tone: "dec", label: "查询，随时间步变" }, { tone: "enc", label: "已经算出的 hidden state" }]} />
      <div className={`viz-narr ${key === "a" ? "is-warn" : "is-good"}`} aria-live="polite">
        Step {key.toUpperCase()}：读完「{SENTENCE[step.t - 2]}」之后算 c<sub>{q}</sub>，可看的是 h₁ 到 h<sub>{q}</sub> 共 {used} 个状态。它们都调用同一个 align(·,·; θ_att)，权重是 [{step.weights.map((w) => w.toFixed(2)).join(", ")}]，最大的落在 <b>{step.history[step.top]}</b> 上。
        {key === "a" ? " 切到 Step B：参数框不动，多出一个可看的 h₄，四个权重重新归一化。" : " 和 Step A 比，θ_att 没有任何变化；权重变了，是因为查询换了、历史状态多了一个。"}
      </div>
    </BahFrame>
  );
}

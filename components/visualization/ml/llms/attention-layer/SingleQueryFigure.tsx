"use client";

import { useState } from "react";
import { scoresFromWeights } from "@/lib/ml/bahdanau";
import { A_CROSS, CROSS_KEYS } from "@/lib/ml/attentionLayer";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

type Step = 0 | 1 | 2 | 3;

const W = 700;
const H = 300;
const ID = "sqf";
const ROW_Y = [66, 120, 174, 228];
const ROW_H = 42;
const BAR_X = 300;
const BAR_MAX = 72;
/** The figure follows the third query of the cross-attention example. */
const J = 2;

const WEIGHTS = A_CROSS[J];
const SCORES = scoresFromWeights(WEIGHTS);
const TOP = WEIGHTS.indexOf(Math.max(...WEIGHTS));
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;
const SUBS = "₁₂₃₄";

const STEPS: { key: Step; label: string }[] = [
  { key: 0, label: "全部" },
  { key: 1, label: "① Score：用 Key" },
  { key: 2, label: "② Softmax" },
  { key: 3, label: "③ 加权求和：用 Value" },
];

const NARR: Record<Step, { text: string; tone?: string }> = {
  0: {
    text: "一个 Query 走完三步，得到一个 context 向量。左边一列 Key 只用来打分，右边一列 Value 才是被加权取回的内容；每一行的 Key 和 Value 来自同一个输入 xᵢ。",
  },
  1: {
    text: `Score：q₃ 分别和四个 Key 做点积，eᵢ₃ = kᵢᵀq₃，得到 [${SCORES.map(signed).join(", ")}]。这一步只看 Key，决定「关注谁」。`,
    tone: "is-warn",
  },
  2: {
    text: `Softmax：四个分数在 Key 这个方向上归一化，第 3 个 Query 的权重是 [${WEIGHTS.map((w) => w.toFixed(2)).join(", ")}]，加起来是 1。它是 m = 4 个数，一个 Query 对 4 个 Key 的分布。`,
    tone: "is-warn",
  },
  3: {
    text: `加权求和：c₃ = ${WEIGHTS.map((w, i) => `${w.toFixed(2)}·v${SUBS[i]}`).join(" + ")}。同一组权重乘到 Value 上，不是乘到 Key 上。输出 c₃ 是一个向量，不是这组权重，也不是一个词。`,
    tone: "is-good",
  },
};

export default function SingleQueryFigure() {
  const [step, setStep] = useState<Step>(0);
  const on = (s: Step) => step === 0 || step === s;
  const bold = (s: Step) => step === s;
  const narr = NARR[step];

  return (
    <BahFrame
      title="图 2 · 一个 Query 怎样得到一个 Context：Key 负责匹配，Value 负责内容"
      description="Query 只和 Key 比较；算出的权重拿去加权 Value。"
      footnote={<>教学构造数据：权重取的是下文 Cross-Attention 示例矩阵的第 3 行，不是视频或论文里学出来的结果；分数是 softmax 后恰好等于这组权重、均值为 0 的那一组。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择要看的步骤">
        {STEPS.map((s) => (
          <button key={s.key} type="button" aria-pressed={step === s.key} className={`viz-btn${step === s.key ? " is-on" : ""}`} onClick={() => setStep(s.key)}>{s.label}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>单个 Query 的 Attention 计算</title>
          <desc id={`${ID}-desc`}>Query q3 与四个 Key 做点积得到四个分数，softmax 之后的权重是 {WEIGHTS.join("、")}，再用这四个权重对四个 Value 加权求和，得到一个 context 向量 c3。</desc>
          <Markers id={ID} />

          <text x={66} y={56} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>Key：用来匹配</text>
          <text x={208} y={56} fontSize={9.5} textAnchor="middle" fill={P.sub} opacity={on(1) ? 1 : 0.28} className="bah-fade">分数 e</text>
          <text x={336} y={56} fontSize={9.5} textAnchor="middle" fill={P.sub} opacity={on(2) ? 1 : 0.28} className="bah-fade">权重 α</text>
          <text x={490} y={56} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>Value：被取回的内容</text>

          <Box x={150} y={6} w={130} h={32} tone="dec" title={<>Query <Sym b="q" s="3" /> = <Sym b="W" s="Q" /><Sym b="x′" s="3" /></>} dim={!on(1)} bold={bold(1)} size={10} />
          <Arrow id={ID} tone="dec" d={`M150 22 H140 V${ROW_Y[3] + 29}`} head={false} dim={!on(1)} bold={bold(1)} />

          {ROW_Y.map((y, i) => {
            const mid = y + ROW_H / 2;
            const top = i === TOP;
            return (
              <g key={y}>
                <Box x={16} y={y} w={100} h={ROW_H} tone="par" title={<>Key <Sym b="k" s={String(i + 1)} /></>} sub={CROSS_KEYS[i]} dim={!on(1) && step !== 0} bold={bold(1)} />
                <Arrow id={ID} tone="par" d={`M116 ${mid - 8} H171`} dim={!on(1)} bold={bold(1)} />
                <Arrow id={ID} tone="dec" d={`M140 ${mid + 8} H171`} dim={!on(1)} bold={bold(1)} />
                <Box x={174} y={mid - 14} w={68} h={28} tone="neu" title={signed(SCORES[i])} dim={!on(1)} bold={bold(1)} size={10} />
                <Arrow id={ID} tone="att" d={`M242 ${mid} H257`} dim={!on(2)} bold={bold(2)} />
                <g opacity={on(2) || step === 3 ? 1 : 0.28} className="bah-fade">
                  <rect x={BAR_X} y={mid - 9} width={BAR_MAX} height={18} rx={3} fill={P.surface} stroke={P.grey} strokeWidth={0.6} />
                  <rect x={BAR_X} y={mid - 9} width={Math.round(WEIGHTS[i] * BAR_MAX * 10) / 10} height={18} rx={3} fill={P.att} opacity={top ? 1 : 0.55} />
                  <text x={BAR_X + BAR_MAX + 6} y={mid + 4} fontSize={10} fontWeight={top ? 700 : 400} fill={P.ink} className="mono">{WEIGHTS[i].toFixed(2)}</text>
                </g>
                <text x={420} y={mid + 5} fontSize={13} textAnchor="middle" fill={P.ink} opacity={on(3) ? 1 : 0.28} className="bah-fade">×</text>
                <Box x={440} y={y} w={100} h={ROW_H} tone="enc" title={<>Value <Sym b="v" s={String(i + 1)} /></>} sub={CROSS_KEYS[i]} dim={!on(3)} bold={bold(3)} />
                <Arrow id={ID} tone="dyn" d={`M540 ${mid} L598 ${Math.round(168 + (mid - 168) * 0.12)}`} dim={!on(3)} bold={bold(3)} />
              </g>
            );
          })}

          <g opacity={on(2) ? 1 : 0.28} className="bah-fade">
            <rect x={260} y={ROW_Y[0]} width={26} height={ROW_Y[3] + ROW_H - ROW_Y[0]} rx={6} fill={P.attFill} stroke={P.att} strokeWidth={bold(2) ? 2.2 : 1.3} />
            <text transform={`translate(277 ${ROW_Y[0] + (ROW_Y[3] + ROW_H - ROW_Y[0]) / 2}) rotate(-90)`} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={P.ink}>softmax</text>
          </g>

          <g opacity={on(3) ? 1 : 0.28} className="bah-fade">
            <circle cx={618} cy={168} r={18} fill={P.dynFill} stroke={P.dyn} strokeWidth={bold(3) ? 2.2 : 1.3} />
            <text x={618} y={173} fontSize={14} fontWeight={600} textAnchor="middle" fill={P.ink}>Σ</text>
          </g>
          <Arrow id={ID} tone="dyn" d="M618 150 V105" dim={!on(3)} bold={bold(3)} />
          <Box x={566} y={62} w={104} h={40} tone="dyn" title={<>Context <Sym b="c" s="3" /></>} sub="一个 d_v 维向量" dim={!on(3)} bold={bold(3)} />
        </svg>
      </div>
      <Legend items={[{ tone: "dec", label: "Query" }, { tone: "par", label: "Key（只参与打分）" }, { tone: "att", label: "权重 α" }, { tone: "enc", label: "Value（被加权）" }, { tone: "dyn", label: "输出 context" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}

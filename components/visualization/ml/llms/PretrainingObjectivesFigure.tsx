"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { causalLossTerms, DEMO_NSP, DEMO_PROBS, DEMO_SENTENCE, inputTokens, MASKED_IDX, maskedLossTerms, nspTerm, type Objective, visibleTokens } from "@/lib/ml/pretrain";

// Page 6 of LLMs: the same sentence under the two pre-training objectives.
// GPT: walk the positions, each one reads only what is before it and predicts
// its own token; every position adds −log p_t. BERT: two positions are
// replaced by [MASK], every position reads the whole input, only the masked
// ones add a term; one extra binary term from [CLS] for next-sentence
// prediction. The table on the right accumulates the terms.

const MODES: { key: Objective; label: string }[] = [
  { key: "causal", label: "GPT：自回归" },
  { key: "masked", label: "BERT：Masked LM" },
];

const V1 = "#2a78d6";
const V2 = "#eb6834";
const INK = "#3b4234";
const MUTED = "#76796f";
const T = DEMO_SENTENCE.length;

const num = (v: number, digits = 3) => v.toFixed(digits).replace("-", "−");

export default function PretrainingObjectivesFigure() {
  const [mode, setMode] = useState<Objective>("causal");
  const [step, setStep] = useState(0);
  const causal = useMemo(() => causalLossTerms(DEMO_PROBS.causal), []);
  const masked = useMemo(() => maskedLossTerms(DEMO_PROBS.masked, MASKED_IDX), []);
  const nsp = nspTerm(DEMO_NSP.p, DEMO_NSP.y);
  const input = inputTokens(mode, DEMO_SENTENCE, MASKED_IDX);

  // Steps: 0 = 起点, 1 … T = position t − 1, then (BERT only) NSP, then 合计.
  const hasNsp = mode === "masked";
  const total = T + 2 + (hasNsp ? 1 : 0);
  const posStep = step >= 1 && step <= T ? step - 1 : -1;
  const nspStep = hasNsp && step === T + 1;
  const sumStep = step === total - 1;
  const isMasked = (i: number) => MASKED_IDX.includes(i);
  const termAt = (i: number) => (mode === "causal" ? causal.terms[i] : masked.terms.find((t) => t.pos === i));

  const changeMode = (m: Objective) => {
    setMode(m);
    setStep(0);
  };
  const reset = () => {
    setMode("causal");
    setStep(0);
  };

  // Which input cells are visible / predicted at this step.
  const visible = posStep >= 0 ? visibleTokens(mode, T, posStep) : null;
  const cellState = (i: number): string => {
    // i indexes the input strip: 0 is [BOS] / [CLS], i − 1 is the sentence token.
    if (nspStep) return i === 0 ? " is-active" : "";
    if (posStep < 0) return i === 0 ? " is-special" : sumStep && mode === "masked" && isMasked(i - 1) ? " is-active" : "";
    if (i === 0) return " is-done";
    const tok = i - 1;
    if (tok === posStep) return " is-active";
    return visible![tok] ? " is-done" : " is-wait";
  };

  // Running sum up to the current step.
  const termsSoFar = (mode === "causal" ? causal.terms : masked.terms).filter((t) => posStep >= 0 ? t.pos <= posStep : step > T);
  const partial = termsSoFar.reduce((s, t) => s + t.term, 0) + (hasNsp && step >= T + 1 ? nsp : 0);
  const finalTotal = mode === "causal" ? causal.total : masked.total + nsp;

  const target = posStep >= 0 ? DEMO_SENTENCE[posStep] : "";
  const curTerm = posStep >= 0 ? termAt(posStep) : undefined;
  const contextText = posStep >= 0 ? (mode === "causal" ? (posStep === 0 ? "[BOS]" : `[BOS] ${DEMO_SENTENCE.slice(0, posStep).join(" ")}`) : input.slice(1).join(" ")) : "";

  const caption = step === 0 ? "起点" : nspStep ? "NSP：[CLS] 判断下一句" : sumStep ? "合计" : `位置 ${posStep + 1} / ${T}：预测「${target}」`;

  const narr = (() => {
    if (step === 0)
      return mode === "causal"
        ? "GPT 的输入是 [BOS] 加整句话，训练时一次前向算出每个位置的预测。按「下一步」看位置 t 读到了什么、预测什么、交多少 loss。"
        : `BERT 把 ${MASKED_IDX.length} 个位置换成 [MASK]（真实配方是随机遮 15%，6 个 token 按 15% 只够遮 1 个，演示遮了 2 个好看清楚），输入全部可见。按「下一步」看哪些位置交 loss。`;
    if (nspStep) return `NSP 是另一个头：[CLS] 位置的向量过一个二分类，判断这句话后面接的是不是真的下一句。p(IsNext) = ${DEMO_NSP.p}，标签 y = ${DEMO_NSP.y}，二元 cross-entropy −y log p − (1 − y) log(1 − p) = ${num(nsp)}。`;
    if (sumStep)
      return mode === "causal"
        ? `六个位置各交一项，L = Σ −log p_t = ${num(causal.total)}。每一项都是一次 cross-entropy：答对的概率越低罚得越重，「我」只有 0.2 就交了 ${num(causal.terms[0].term)}，「火锅」0.85 只交 ${num(causal.terms[5].term)}。`
        : `只有 ${MASKED_IDX.length} 个被遮的位置交 loss（${num(masked.total)}），其余位置不算；加上 NSP 的 ${num(nsp)}，L = ${num(finalTotal)}。两边都能看，所以「吃」在「想 ___ 火锅」里几乎确定，p = ${DEMO_PROBS.masked[4]}。`;
    if (mode === "causal") {
      const seen = posStep === 0 ? "只有 [BOS]" : `[BOS] 和前 ${posStep} 个 token`;
      return `位置 ${posStep + 1} 能读的是 ${seen}（causal mask 把后面的全部遮成 −∞），要预测的是「${target}」。模型给它 p = ${curTerm!.p}，这一项 −log ${curTerm!.p} = ${num(curTerm!.term)}。`;
    }
    if (curTerm) return `位置 ${posStep + 1} 被遮了。模型读的是整句（左右都有），要猜回「${target}」：p = ${curTerm.p}，这一项 −log ${curTerm.p} = ${num(curTerm.term)}。`;
    return `位置 ${posStep + 1} 的「${target}」没被遮，输入里原样可见，不需要预测，也就不贡献 loss。`;
  })();

  const tone = sumStep ? " is-good" : mode === "masked" && posStep >= 0 && !curTerm ? " is-warn" : "";

  return (
    <VisualizationFrame
      title="预训练目标：这一步在预测哪个词、交多少 loss"
      description="同一句「我 今天 很 想 吃 火锅」。GPT 从左到右，每个位置只看前面、预测自己；BERT 遮住两个位置，整句可见、只猜被遮的，再加一项 NSP 二分类。深色是这一步能读到的 token，黄框是正在预测的，灰的是看不见的；表里的 p 是玩具概率，−log p 是算出来的。"
    >
      <div className="viz-row">
        <Tabs options={MODES} value={mode} onChange={changeMode} ariaLabel="预训练目标" />
      </div>
      <StepPlayer step={step} total={total} onStep={setStep} onReset={reset} intervalMs={1600} caption={caption} />

      <div className="tok-strip" style={{ marginBottom: 12 }} aria-label="模型看到的输入">
        {input.map((tok, i) => (
          <span key={`${mode}-${i}`} className={`tok${cellState(i)}${tok.startsWith("[") && i > 0 ? " is-special" : ""}`} style={{ minWidth: 52 }}>
            <span style={{ fontWeight: 600 }}>{tok}</span>
            <small>{i === 0 ? "" : `t = ${i}`}</small>
          </span>
        ))}
        <span className="viz-k" style={{ marginLeft: 8 }}>{mode === "causal" ? "→ 每个位置预测右边那个词" : "→ 只预测 [MASK] 原来的词"}</span>
      </div>

      <div className="viz-grid2">
        <div className="viz-panel">
          <h5 className="nocase">{step === 0 ? "起点" : nspStep ? "NSP 的一项" : sumStep ? "把所有项加起来" : `位置 ${posStep + 1}：预测「${target}」`}</h5>
          {step === 0 && (
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7 }}>
              {mode === "causal" ? (
                <>
                  L = −Σ<sub>t</sub> log P(x<sub>t</sub> | x<sub>&lt;t</sub>)。T = {T} 个位置，每个位置一项，p 由模型给出。
                </>
              ) : (
                <>
                  L = −Σ<sub>i ∈ masked</sub> log P(x<sub>i</sub> | x<sub>masked</sub>) − y log p − (1 − y) log(1 − p)。被遮的位置 {MASKED_IDX.map((i) => i + 1).join("、")}，加一项 NSP。
                </>
              )}
            </p>
          )}
          {posStep >= 0 && (
            <div className="viz-stat">
              <div><small>读到的上下文</small><b style={{ fontSize: 12.5 }}>{contextText}</b></div>
              <div><small>要预测的</small><b>{curTerm ? target : "—"}</b></div>
              <div><small>p（玩具值）</small><b>{curTerm ? curTerm.p : "不预测"}</b></div>
              <div><small>−log p</small><b style={{ color: curTerm ? V2 : MUTED }}>{curTerm ? num(curTerm.term) : "0"}</b></div>
            </div>
          )}
          {nspStep && (
            <div className="viz-stat">
              <div><small>[CLS] 的判断</small><b>p(IsNext) = {DEMO_NSP.p}</b></div>
              <div><small>标签 y</small><b>{DEMO_NSP.y}</b></div>
              <div><small>−y log p − (1 − y) log(1 − p)</small><b style={{ color: V2 }}>{num(nsp)}</b></div>
            </div>
          )}
          {sumStep && (
            <div className="viz-stat">
              <div><small>交 loss 的位置</small><b>{mode === "causal" ? T : MASKED_IDX.length} / {T}</b></div>
              {hasNsp && <div><small>NSP 一项</small><b>{num(nsp)}</b></div>}
              <div><small>L 合计</small><b style={{ color: V2 }}>{num(finalTotal)}</b></div>
              <div><small>平均每项</small><b>{num(finalTotal / (mode === "causal" ? T : MASKED_IDX.length + 1))}</b></div>
            </div>
          )}
        </div>

        <table className="viz-table" style={{ margin: 0 }} aria-label="每个位置的 loss 项">
          <thead>
            <tr>
              <th>位置</th>
              <th>目标</th>
              <th className="num">p</th>
              <th className="num">−log p</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_SENTENCE.map((tok, i) => {
              const reached = posStep >= i || step > T;
              const term = termAt(i);
              const skipped = mode === "masked" && !term;
              const hot = posStep === i;
              return (
                <tr key={i} style={{ color: !reached ? "#b3b09c" : skipped ? MUTED : INK, fontWeight: hot ? 600 : 400, background: hot ? "#fdf9e9" : undefined, transition: "color .25s" }}>
                  <td>t = {i + 1}</td>
                  <td>{mode === "masked" && !term ? `${tok}（没遮）` : tok}</td>
                  <td className="num">{reached ? (term ? term.p : "—") : "·"}</td>
                  <td className="num" style={{ color: reached && term ? V2 : undefined }}>{reached ? (term ? num(term.term) : "0") : "·"}</td>
                </tr>
              );
            })}
            {hasNsp && (
              <tr style={{ color: step >= T + 1 ? INK : "#b3b09c", fontWeight: nspStep ? 600 : 400, background: nspStep ? "#fdf9e9" : undefined }}>
                <td>[CLS]</td>
                <td>IsNext，y = {DEMO_NSP.y}</td>
                <td className="num">{step >= T + 1 ? DEMO_NSP.p : "·"}</td>
                <td className="num" style={{ color: step >= T + 1 ? V2 : undefined }}>{step >= T + 1 ? num(nsp) : "·"}</td>
              </tr>
            )}
            <tr style={{ fontWeight: 600, color: INK }}>
              <td colSpan={3}>{sumStep ? "L 合计" : "到这一步为止"}</td>
              <td className="num" style={{ color: V1 }}>{num(partial)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Phase = "train" | "prefill" | "decode";

const SENTENCE = ["I", "love", "machine", "learning", "<eos>"];
const PROMPT = ["I", "love", "machine"];
// Pre-set continuation for the demo; nothing is actually sampled. Prefill already yields
// the first new token; each decode step feeds the newest token and outputs the next one.
const FIRST = "learning";
const FED = ["learning", "is", "fun"];
const CONTINUATION = ["is", "fun", "<eos>"];

export default function TrainPrefillDecodeSwitch() {
  const [phase, setPhase] = useState<Phase>("train");
  const [generated, setGenerated] = useState(0);

  const choose = (p: Phase) => {
    setPhase(p);
    setGenerated(0);
  };

  return (
    <VisualizationFrame
      title="Training / Prefill / Decode：哪些能一次算完"
      description="同一个 decoder-only 模型、同一个 causal mask，在三个阶段里“一次前向能算多少个位置”完全不同。"
      footnote="教学步骤示意：Decode 里出现的词是预先写好的，不执行真实文本生成。"
    >
      <div className="viz-controls">
        <div className="viz-tabs" role="tablist" aria-label="阶段">
          {([
            ["train", "Training"],
            ["prefill", "Prefill"],
            ["decode", "Decode"],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={phase === key} className={`viz-tab${phase === key ? " is-on" : ""}`} onClick={() => choose(key)}>{label}</button>
          ))}
        </div>
        {phase === "decode" && (
          <>
            <button type="button" className="viz-btn primary" disabled={generated >= CONTINUATION.length} onClick={() => setGenerated((g) => g + 1)}>Next token</button>
            <button type="button" className="viz-btn" disabled={generated === 0} onClick={() => setGenerated(0)}>重置</button>
          </>
        )}
      </div>

      {phase === "train" && (
        <div className="viz-panel">
          <h5 className="nocase">整句已知 · 1 次前向 · {SENTENCE.length - 1} 个位置同时算 loss</h5>
          <div className="lane"><span>输入 x</span><div className="tok-strip">{SENTENCE.slice(0, -1).map((w, i) => <span key={i} className="tok is-text">{w}<small>pos {i + 1}</small></span>)}</div></div>
          <div className="lane"><span>预测 logits</span><div className="tok-strip">{SENTENCE.slice(0, -1).map((_, i) => <span key={i} className="tok is-done">p(·|≤{i + 1})<small>同时</small></span>)}</div></div>
          <div className="lane"><span>目标 y</span><div className="tok-strip">{SENTENCE.slice(1).map((w, i) => <span key={i} className="tok">{w}<small>CE</small></span>)}</div></div>
          <div className="viz-narr">
            Teacher forcing：目标就是输入往左移一位。真实的下一个词已经在数据里，不用等模型自己生成，所以 4 个位置的 logits 和交叉熵在一次前向里同时算出。causal mask 保证位置 i 的预测只读到 ≤ i 的输入，即使答案就在同一个矩阵里也看不到。
          </div>
        </div>
      )}

      {phase === "prefill" && (
        <div className="viz-panel">
          <h5 className="nocase">Prompt 已知 · 1 次前向 · 填满 KV Cache</h5>
          <div className="lane"><span>Prompt</span><div className="tok-strip">{PROMPT.map((w, i) => <span key={i} className="tok is-text">{w}<small>pos {i + 1}</small></span>)}</div></div>
          <div className="lane"><span>KV Cache</span><div className="tok-strip">{PROMPT.map((w, i) => <span key={i} className="tok is-done">K,V<small>{w}</small></span>)}</div></div>
          <div className="lane"><span>输出</span><div className="tok-strip"><span className="tok is-active">p(· | I love machine) → {FIRST}<small>只用最后一个位置</small></span></div></div>
          <div className="viz-narr">
            Prompt 的 {PROMPT.length} 个 token 都是已知的，可以像训练一样一次前向并行处理。这一步把每层每个位置的 K、V 存进 KV Cache，并用最后一个位置的输出得到第一个新 token。prompt 越长，prefill 越像一次大矩阵乘法，通常受算力限制。
          </div>
        </div>
      )}

      {phase === "decode" && (
        <div className="viz-panel" aria-live="polite">
          <h5 className="nocase">未来未知 · 每个新 token 1 次前向 · 已 decode {generated} 次</h5>
          <div className="lane">
            <span>序列</span>
            <div className="tok-strip">
              {PROMPT.map((w, i) => <span key={`p${i}`} className="tok is-text">{w}<small>prompt</small></span>)}
              <span className="tok is-done">{FIRST}<small>prefill 输出</small></span>
              {CONTINUATION.map((w, i) => (
                <span key={`g${i}`} className={`tok ${i < generated ? `is-done${i === generated - 1 ? " is-active" : ""}` : "is-wait"}`}>{i < generated ? w : "?"}<small>{i < generated ? `decode ${i + 1}` : "未知"}</small></span>
              ))}
            </div>
          </div>
          <div className="lane">
            <span>KV Cache</span>
            <div className="tok-strip">
              {Array.from({ length: PROMPT.length + generated }, (_, i) => <span key={i} className={`tok ${i < PROMPT.length ? "is-done" : "is-vis"}`}>K,V<small>{i < PROMPT.length ? PROMPT[i] : FED[i - PROMPT.length]}</small></span>)}
            </div>
          </div>
          <div className="viz-narr">
            {generated === 0
              ? `prefill 已经算出第一个新词“${FIRST}”，但它的 K/V 还不在 cache 里。按 Next token：下一个词要等这一步的分布采样出来才知道，所以无法像训练那样把后面的位置一起算。`
              : generated < CONTINUATION.length
                ? `第 ${generated} 步只为 1 个新位置“${FED[generated - 1]}”做前向：它的 Query 读 KV Cache 里 ${PROMPT.length + generated - 1} 个旧位置加上自己，算出“${CONTINUATION[generated - 1]}”，并把自己的 K/V 存进 cache。KV Cache 省掉了重算旧位置，但下一步仍要等这一步的结果。`
                : `生成到 <eos> 停止：prefill 1 次 + decode ${CONTINUATION.length} 次。每个新 token 一次前向，一个都省不掉。这就是“训练能并行”不等于“生成能并行”。`}
          </div>
        </div>
      )}
    </VisualizationFrame>
  );
}

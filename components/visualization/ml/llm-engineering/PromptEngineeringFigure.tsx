"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { ALL_LAYERS, assemblePrompt, estimateTokens, NO_LAYERS, type BlockKey, type PromptLayers } from "@/lib/ml/context";

// Page 1 of LLM Engineering: a prompt builder. Four layers wrap one fixed task
// (classify a user review as 正面 / 负面 / 中性). Toggle a layer and the prompt on
// the right is re-assembled in reading order, with a token estimate.

type LayerKey = keyof PromptLayers;

const LAYERS: { key: LayerKey; title: string; en: string; changes: string; missing: string; color: string }[] = [
  { key: "role", title: "角色分配", en: "role assignment", changes: "定语气和默认标准：它会用质检员的经验去读「还行」这种词。", missing: "没有角色，模型按通用助手的口吻和它自己的标准来判断。", color: "#2a78d6" },
  { key: "fewShot", title: "少量例子", en: "few-shot examples", changes: "三条例子把「中性」的边界和回答的样子一起定下来。", missing: "没有例子，「中性」算不算正面全看它的心情。", color: "#eb6834" },
  { key: "cot", title: "先想再答", en: "chain-of-thought", changes: "先把价格和味道分开看再综合，答案更稳，也能看到它怎么想的。", missing: "没有先想再答，它看到「贵」可能直接给负面。", color: "#1baf7a" },
  { key: "constraints", title: "限制条件", en: "constraint setting", changes: "锁死标签集合、长度和格式，下游程序才能直接解析。", missing: "没有限制，输出格式每次可能不一样。", color: "#eda100" },
];

const BLOCK_META: Record<BlockKey, { label: string; color: string }> = {
  role: { label: "角色", color: "#2a78d6" },
  fewShot: { label: "例子", color: "#eb6834" },
  task: { label: "任务", color: "#3b4234" },
  cot: { label: "先想再答", color: "#1baf7a" },
  constraints: { label: "限制", color: "#eda100" },
};

const BARE_TOKENS = estimateTokens(assemblePrompt(NO_LAYERS).text);

export default function PromptEngineeringFigure() {
  const [layers, setLayers] = useState<PromptLayers>(NO_LAYERS);
  const { blocks, text } = assemblePrompt(layers);
  const tokens = estimateTokens(text);
  const onCount = LAYERS.filter((l) => layers[l.key]).length;
  const toggle = (k: LayerKey) => setLayers((s) => ({ ...s, [k]: !s[k] }));

  const changes = LAYERS.filter((l) => layers[l.key]).map((l) => l.changes);
  const missing = LAYERS.filter((l) => !layers[l.key]).map((l) => l.missing);
  const narr =
    onCount === 0
      ? `现在模型只看到任务本身，${tokens} 个 token。它会给一个标签，但「贵了点」和「味道没变」哪个更重、理由写多长、格式长什么样，全由它自己定。点左边的任一层，看 prompt 怎么变。`
      : onCount === LAYERS.length
        ? `四层都开了，prompt 从 ${BARE_TOKENS} 个 token 长到 ${tokens} 个，模型参数一个都没动。${changes.join("")}多花的 token 换来的是每次都差不多的答案。`
        : `开了 ${onCount} 层，prompt ${tokens} 个 token。${changes.join("")}${missing.join("")}`;

  return (
    <VisualizationFrame
      title="Prompt 拼装器：四层包着同一个任务"
      description="任务固定：把一条用户评论分成 正面 / 负面 / 中性，并给出理由。左边每一层是一个开关，右边是模型真正读到的 prompt，按阅读顺序拼好。"
    >
      <div className="viz-row">
        <button type="button" className="viz-chip" onClick={() => setLayers(ALL_LAYERS)} disabled={onCount === LAYERS.length}>四层全开</button>
        <button type="button" className="viz-btn" onClick={() => setLayers(NO_LAYERS)} disabled={onCount === 0}>重置</button>
        <span className="viz-k">已开 {onCount} / {LAYERS.length} 层</span>
      </div>

      <div className="viz-grid2">
        <div className="viz-layers" role="group" aria-label="prompt 的四层">
          {LAYERS.map((l) => {
            const on = layers[l.key];
            return (
              <button key={l.key} type="button" className={`viz-layer${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => toggle(l.key)} style={on ? { borderColor: l.color, boxShadow: `0 0 0 1px ${l.color}` } : undefined}>
                <b style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i aria-hidden style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: on ? l.color : "#e4dfcb" }} />
                  {l.title} <span className="viz-k">{l.en}</span>
                </b>
                <small>{on ? l.changes : l.missing}</small>
              </button>
            );
          })}
          <div className="viz-layer" style={{ cursor: "default", background: "#fbfaf4", borderStyle: "dashed" }}>
            <b style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i aria-hidden style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#3b4234" }} />
              任务 <span className="viz-k">不可关</span>
            </b>
            <small>要分类的那条评论和问题本身，始终在 prompt 里。</small>
          </div>
        </div>

        <div className="viz-panel">
          <h5>模型读到的 prompt（{blocks.length} 块，约 {tokens} token）</h5>
          <div style={{ display: "grid", gap: 8 }}>
            {blocks.map((b) => {
              const meta = BLOCK_META[b.key];
              return (
                <div key={b.key} style={{ borderLeft: `3px solid ${meta.color}`, padding: "4px 10px", background: "#fbfaf4", borderRadius: "0 4px 4px 0", transition: "background-color .3s" }}>
                  <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: meta.color }}>{meta.label}</span>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: 12.5, lineHeight: 1.55 }}>{b.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>token 估计（CJK 一字一个，英文一词一个）</small><b>{tokens}</b></div>
        <div><small>比裸任务多出</small><b>+{tokens - BARE_TOKENS}<span className="delta">{BARE_TOKENS === 0 ? "" : `×${(tokens / BARE_TOKENS).toFixed(1)}`}</span></b></div>
        <div><small>改了模型的参数</small><b>0 个</b></div>
      </div>

      <div className={`viz-narr${onCount === 0 ? " is-warn" : onCount === LAYERS.length ? " is-good" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}

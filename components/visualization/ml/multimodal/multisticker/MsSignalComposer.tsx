"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { MS_FIGURE1 } from "@/lib/ml/multisticker";

// The README's Figure 1 example as a chat UI. Left: the chat, with the slot the
// sticker should fill. Right: the three strings the CLIP text encoder reads.
// Turning memory off reproduces the ablation exactly: the code replaces the
// memory string with the literal text "memory disabled".

type Sig = "context" | "memory" | "intent";
const COLOR: Record<Sig, string> = { context: "var(--v3)", memory: "var(--v1)", intent: "var(--v4)" };

export default function MsSignalComposer() {
  const [memory, setMemory] = useState(true);
  const [focus, setFocus] = useState<Sig>("context");
  const contextText = MS_FIGURE1.chat.slice(1).map((t) => `${t.who}: ${t.text}`).join(" || ");
  const memoryText = memory ? MS_FIGURE1.history.map((h) => h.summary).join(" || ") : "memory disabled";

  const narr: Record<Sig, string> = {
    context: "context_text：目标贴纸之前最近的几轮（最多 12 轮）用 || 连起来。只看这一段，「well...」后面接什么很难说：可能是无奈、可能是调侃。",
    memory: memory
      ? "memory_text：从这个对话之前的 session（最多 8 个）里，用 multilingual-E5 把每个 session 的摘要和当前上下文算余弦相似度，取最像的 3 条。摘要是离线用 Qwen 32B（GPTQ 量化）写好的。它告诉模型这群人平时聊什么、什么语气。"
      : "记忆关掉之后，memory_text 被替换成字面上的 \"memory disabled\"：模型结构不变，只是这一路不再带信息。消融实验就是这么做的，Exact R@30 从 12.6% 掉到 4.1%。",
    intent: "intent_text：同样离线用 LLM 给每个样本写一句「这次回复想表达什么」，带一个意图标签（这里是 humor_teasing）。每张贴纸在训练集里最常被打的那个标签是它的「意图组」，训练时模型还要顺带预测答案贴纸的意图组，这是权重 0.2 的辅助任务。",
  };

  return (
    <VisualizationFrame
      title="三路信号：模型在「well...」之后读到了什么"
      description="一段真实的 U-Sticker 对话（README 的 Figure 1）。点右边的卡片看每一路是怎么来的；关掉记忆就是消融实验。"
    >
      <div className="viz-row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <label className="viz-check">
          <input type="checkbox" checked={memory} onChange={(e) => setMemory(e.target.checked)} />
          使用检索到的对话记忆（retrieved_topk）
        </label>
        <button type="button" className="viz-btn" onClick={() => { setMemory(true); setFocus("context"); }}>重置</button>
      </div>
      <div className="ms-chat">
        <div className="ms-phone" aria-label="对话">
          <div className="ms-phone-head">当前 session · 目标回合</div>
          {MS_FIGURE1.chat.map((t, i) => (
            <div key={i} className={`ms-bubble ${t.who === "Alice" ? "is-a" : "is-b"}${i > 0 && focus === "context" ? " is-ctx" : ""}`}>
              <small>{t.who}</small>
              {t.text}
            </div>
          ))}
          <div className="ms-slot"><i>?</i>Alice 接下来发哪张贴纸？</div>
          <div className="ms-phone-head" style={{ borderTop: "1px solid var(--vline)", borderBottom: 0, paddingTop: 6 }}>更早的 session</div>
          {MS_FIGURE1.history.map((h) => (
            <div key={h.session} className="viz-k" style={{ fontSize: 11.5, opacity: memory ? 1 : 0.45, outline: focus === "memory" && memory ? "1.5px solid var(--v1)" : undefined, borderRadius: 4, padding: "2px 4px" }}>
              {h.session}：{h.summary}
            </div>
          ))}
        </div>

        <div className="ms-signals">
          {(["context", "memory", "intent"] as Sig[]).map((s) => {
            const off = s === "memory" && !memory;
            const text = s === "context" ? contextText : s === "memory" ? memoryText : MS_FIGURE1.intent;
            const title = s === "context" ? "Local context" : s === "memory" ? "Retrieved memory（top-3）" : "Reply intent";
            return (
              <button
                key={s}
                type="button"
                className={`ms-signal${off ? " is-off" : ""}`}
                style={{ borderLeftColor: COLOR[s], textAlign: "left", font: "inherit", cursor: "pointer", boxShadow: focus === s ? `0 0 0 1.5px ${COLOR[s]}` : undefined }}
                onClick={() => setFocus(s)}
                aria-pressed={focus === s}
              >
                <header><b>{title}</b><span className="viz-k ms-mono">{s}_text → CLIP text → 512 维</span></header>
                <code>{text}</code>
              </button>
            );
          })}
          <div className="viz-panel">
            <h5>拼成一个 query 向量</h5>
            <div className="ms-vec" aria-label="1536 维拼接向量">
              <span style={{ background: COLOR.context }}>context 512</span>
              <span style={{ background: COLOR.memory, opacity: memory ? 1 : 0.35 }}>{memory ? "memory 512" : "\"memory disabled\""}</span>
              <span style={{ background: COLOR.intent }}>intent 512</span>
            </div>
            <p className="viz-k" style={{ marginTop: 6 }}>三段拼成 1,536 维，送进 IntentGuidedRetriever，投影回 512 维的贴纸图像空间。</p>
          </div>
        </div>
      </div>
      <div className={`viz-narr${!memory && focus === "memory" ? " is-warn" : ""}`}>{narr[focus]}</div>
    </VisualizationFrame>
  );
}

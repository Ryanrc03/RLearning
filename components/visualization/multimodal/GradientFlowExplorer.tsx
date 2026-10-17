"use client";

import { useEffect, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { usePrefersReducedMotion } from "@/components/visualization/usePrefersReducedMotion";

type ModId = "vit" | "merger" | "llm";
type Mode = "adapter" | "e2e" | "custom";
type Flow = "update" | "pass" | "none";

const MODULES: { id: ModId; name: string; role: string }[] = [
  { id: "vit", name: "Vision Encoder", role: "ViT：图像 → patch 特征" },
  { id: "merger", name: "Projector / Merger", role: "MLP：特征 → LLM 维度" },
  { id: "llm", name: "LLM", role: "Decoder：读图文序列，预测下一个词" },
];
const PRESET: Record<Exclude<Mode, "custom">, Record<ModId, boolean>> = {
  adapter: { vit: false, merger: true, llm: false },
  e2e: { vit: true, merger: true, llm: true },
};

// Forward order is vit → merger → llm. Backprop starts at the loss (after llm).
// A module's weights get gradients iff it is trainable. Gradient must flow *through*
// a module iff something earlier in the forward order is trainable.
function analyse(train: Record<ModId, boolean>) {
  const order: ModId[] = ["vit", "merger", "llm"];
  const flow = {} as Record<ModId, Flow>;
  const repChanges = {} as Record<ModId, boolean>;
  order.forEach((id, i) => {
    const upstream = order.slice(0, i).some((u) => train[u]);
    flow[id] = train[id] ? "update" : upstream ? "pass" : "none";
    repChanges[id] = train[id] || upstream;
  });
  const lowest = order.findIndex((id) => train[id]);
  return { flow, repChanges, lowest };
}


export default function GradientFlowExplorer() {
  const [mode, setMode] = useState<Mode>("adapter");
  const [custom, setCustom] = useState<Record<ModId, boolean>>(PRESET.adapter);
  const [steps, setSteps] = useState(0);
  const [wave, setWave] = useState(-1); // 0 = loss, 1 = llm, 2 = merger, 3 = vit
  const reduced = usePrefersReducedMotion();
  const train = mode === "custom" ? custom : PRESET[mode];
  const { flow, repChanges, lowest } = analyse(train);
  const anyTrain = lowest >= 0;
  const reachedBy = (id: ModId) => ({ llm: 1, merger: 2, vit: 3 })[id];

  useEffect(() => {
    if (wave < 0) return;
    const id = window.setTimeout(() => setWave(wave + 1 >= 4 ? -1 : wave + 1), reduced ? 0 : 520);
    return () => window.clearTimeout(id);
  }, [wave, reduced]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setSteps(0);
    setWave(-1);
    if (m !== "custom") setCustom(PRESET[m]);
  };

  const backprop = () => {
    if (!anyTrain) return;
    setSteps((s) => s + 1);
    setWave(0);
  };

  const versions = (id: ModId) => (train[id] ? steps : 0);

  const narr = !anyTrain
    ? "所有模块都冻结了：没有任何参数需要梯度，反向传播什么都不会更新。"
    : mode === "adapter"
      ? "Adapter-only：loss 的梯度先穿过冻结的 LLM（要算对 LLM 输入的梯度，但不算 LLM 权重的梯度），到达 Merger 并更新它。ViT 前面再没有要训练的参数，梯度不必继续往下。同一张图过 ViT 的输出永远不变，Merger 的输出随训练改变。"
      : mode === "e2e"
        ? "End-to-end：三个模块都会收到对自己参数的梯度并更新。同一张图，ViT 的输出也会随训练改变。"
        : "自定义：梯度从 loss 一路往回传，直到最下面那个可训练模块为止。冻结模块如果夹在中间，梯度照样要穿过它。";

  return (
    <VisualizationFrame
      title="冻结与解冻：梯度流向哪里"
      description="选一种训练方案，按 Backpropagate，看梯度从 loss 往回走过哪些模块、哪些模块的参数真的被更新。"
      footnote="概念演示：点击按钮不做真实的 SGD，版本号只表示“这一步之后参数变了没有”。"
    >
      <div className="viz-controls">
        <div className="viz-tabs" role="tablist" aria-label="训练方案">
          {([
            ["adapter", "Adapter-only"],
            ["e2e", "End-to-end"],
            ["custom", "Advanced：手动"],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={mode === key} className={`viz-tab${mode === key ? " is-on" : ""}`} onClick={() => switchMode(key)}>{label}</button>
          ))}
        </div>
        <button type="button" className="viz-btn primary" onClick={backprop} disabled={!anyTrain || wave >= 0}>Backpropagate</button>
        <span className="viz-mono">训练步 {steps}</span>
      </div>

      {mode === "custom" && (
        <div className="viz-controls">
          {MODULES.map((m) => (
            <label key={m.id} className="viz-check">
              <input type="checkbox" checked={custom[m.id]} onChange={(e) => { setCustom({ ...custom, [m.id]: e.target.checked }); setSteps(0); }} />
              训练 {m.name}
            </label>
          ))}
        </div>
      )}

      <div className="viz-arrow" style={{ textAlign: "left" }}>前向 → 图像 · ViT · Merger · LLM · loss</div>
      <div className="mod-row" style={{ marginTop: 6 }}>
        {MODULES.map((m) => {
          const f = flow[m.id];
          const flashing = wave >= 0 && wave === reachedBy(m.id) && f !== "none";
          return (
            <div key={m.id} className={`mod-card${train[m.id] ? " is-train" : " is-frozen"}${flashing ? " is-flash" : ""}`}>
              <b>{m.name}</b>
              <small>{m.role}</small>
              <span className={`mod-badge ${train[m.id] ? "train" : "frozen"}`}>{train[m.id] ? "🔓 trainable" : "🔒 weights frozen"}</span>
              <small>
                {f === "update" ? "收到参数梯度 → 更新" : f === "pass" ? "梯度可穿过，权重不变" : "梯度不需要到这里"}
              </small>
              <small className="viz-mono">θ v{versions(m.id)}</small>
            </div>
          );
        })}
        <div className={`mod-card is-loss${wave === 0 ? " is-flash" : ""}`}>
          <b>Loss</b>
          <small>−Σ log p(y_t | 图, prompt, y_&lt;t)</small>
          <small>反向传播从这里出发 ←</small>
        </div>
      </div>

      <div className="viz-panel" style={{ marginTop: 14 }}>
        <h5 className="nocase">同一张图、同一条 prompt，训练一步之后</h5>
        <div className="viz-scroll">
          <table className="viz-table" style={{ minWidth: 460 }}>
            <thead>
              <tr><th>Module</th><th>trainable?</th><th>parameter update?</th><th>representation may change?</th></tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{train[m.id] ? "✓ 是" : "✕ 否（冻结）"}</td>
                  <td>{train[m.id] ? "✓ 更新" : "✕ 不更新"}</td>
                  <td>
                    {repChanges[m.id]
                      ? train[m.id]
                        ? "✓ 会变：自己的参数变了"
                        : "✓ 会变：权重没变，但输入它的上游变了"
                      : "✕ 不变：输出只由固定权重和固定输入决定"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="viz-narr" aria-live="polite">{narr}</div>
    </VisualizationFrame>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Example = { tokens: string[]; label: 0 | 1; before: number; after: number }; // before / after: p(正面), 示意值

const EXAMPLES: Example[] = [
  { tokens: ["the", "movie", "was", "a", "complete", "waste", "of", "time"], label: 0, before: 0.54, after: 0.02 },
  { tokens: ["a", "warm", ",", "funny", "and", "deeply", "moving", "film"], label: 1, before: 0.46, after: 0.97 },
  { tokens: ["the", "plot", "is", "thin", "but", "the", "acting", "saves", "it"], label: 1, before: 0.51, after: 0.81 },
];
const LABELS = ["负面", "正面"];
const MAXLEN = 16; // 示意用的 max_length；真实微调常用 128
const H = 768;
const LAYERS = 12;
const BODY_PARAMS = 109_482_240; // bert-base-uncased 的 BertModel，含 pooler
const HEAD_PARAMS = H * 2 + 2;

// Stage colors follow the architecture figures: yellow = tensors in / embeddings, blue = encoder, green = pooler, orange = task head.
const STAGES = [
  { name: "分词、加特殊符、补齐", out: `input_ids [1, ${MAXLEN}]`, color: "#d9b24a" },
  { name: "三个嵌入相加", out: `[1, ${MAXLEN}, ${H}]`, color: "#d9b24a" },
  { name: `${LAYERS} 层双向编码器`, out: `[1, ${MAXLEN}, ${H}]`, color: "#2a78d6" },
  { name: "取 [CLS]，过 pooler", out: `[1, ${H}]`, color: "#1baf7a" },
  { name: "分类头、softmax、损失", out: "logits [1, 2] → 标量", color: "#eb6834" },
];

function Sw({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: color, marginRight: 6, verticalAlign: -1 }} />;
}

export default function ClsFineTuneViz() {
  const [exIdx, setExIdx] = useState(0);
  const [stage, setStage] = useState(0);
  const [tuned, setTuned] = useState(false);

  const ex = EXAMPLES[exIdx];
  const full = ["[CLS]", ...ex.tokens, "[SEP]"];
  const padded = [...full, ...Array<string>(MAXLEN - full.length).fill("[PAD]")];
  const attn = padded.map((t) => (t === "[PAD]" ? 0 : 1));
  const pPos = tuned ? ex.after : ex.before;
  const pNeg = 1 - pPos;
  const zPos = Math.log(pPos) + 1.5;
  const zNeg = Math.log(pNeg) + 1.5;
  const pLabel = ex.label === 1 ? pPos : pNeg;
  const loss = -Math.log(pLabel);
  const predicted = pPos >= 0.5 ? 1 : 0;
  const headShare = (HEAD_PARAMS / (BODY_PARAMS + HEAD_PARAMS)) * 100;

  const chip = (t: string, i: number) => (
    <span key={i} className="viz-chip mono" style={{ cursor: "default", background: t === "[PAD]" ? "#f4f2ea" : t === "[CLS]" || t === "[SEP]" ? "#efede4" : "#fff", color: t === "[PAD]" ? "#b3b19d" : t === "[CLS]" || t === "[SEP]" ? "var(--muted)" : "var(--ink)", boxShadow: stage === 3 && t === "[CLS]" ? "0 0 0 2px var(--v1)" : undefined }}>{t}</span>
  );

  let detail: ReactNode;
  let narr = "";
  let tone = "";
  if (stage === 0) {
    detail = (
      <>
        <div className="viz-chips">{padded.map(chip)}</div>
        <table className="viz-table" style={{ marginTop: 10 }}>
          <tbody>
            <tr><td>input_ids</td><td className="viz-mono">{full.length} 个真实 token + {MAXLEN - full.length} 个 [PAD]，各自查词表得到整数 id</td></tr>
            <tr><td>attention_mask</td><td className="viz-mono">{attn.join(" ")}</td></tr>
            <tr><td>token_type_ids</td><td className="viz-mono">全 0（单句任务，没有句子 B）</td></tr>
          </tbody>
        </table>
      </>
    );
    narr = `WordPiece 把这句话切成 ${ex.tokens.length} 个 token，前面加 [CLS]、后面加 [SEP]，再补 [PAD] 到固定长度 ${MAXLEN}。attention_mask 告诉编码器哪些位置是补的：它们不参与注意力，也不进损失。`;
  } else if (stage === 1) {
    detail = (
      <table className="viz-table">
        <thead><tr><th>嵌入</th><th>形状</th><th>这句话里</th></tr></thead>
        <tbody>
          <tr><td><Sw color="#fbe7a1" />token</td><td className="viz-mono">[1, {MAXLEN}, {H}]</td><td>每个 id 查一行；两个 “the” 此刻是同一个向量</td></tr>
          <tr><td><Sw color="#cfe0f7" />segment</td><td className="viz-mono">[1, {MAXLEN}, {H}]</td><td>全是 A 段的那一行</td></tr>
          <tr><td><Sw color="#c6ead9" />position</td><td className="viz-mono">[1, {MAXLEN}, {H}]</td><td>位置 0…{MAXLEN - 1} 各一行，学出来的</td></tr>
          <tr><td><Sw color="#3b4234" />相加 → LayerNorm → dropout</td><td className="viz-mono">[1, {MAXLEN}, {H}]</td><td>编码器的输入</td></tr>
        </tbody>
      </table>
    );
    narr = "三个查表结果逐位相加。这一步还没有任何上下文：同一个词在哪一句话里都是同一个向量，只有位置和段落把它们区分开。";
  } else if (stage === 2) {
    detail = (
      <>
        <div className="viz-mono" style={{ lineHeight: 1.9 }}>
          x → 多头自注意力（{LAYERS} 头 × 64 维，双向，只遮 [PAD]）→ Add &amp; LayerNorm<br />
          　→ FFN（{H} → {H * 4} → {H}，GELU）→ Add &amp; LayerNorm → x′　　× {LAYERS} 层
        </div>
        <div className="viz-chips" style={{ marginTop: 10 }}>{full.map(chip)}</div>
      </>
    );
    narr = ex.label === 0
      ? "每一层里每个位置都看整句。“waste” 的向量在第 12 层出口时已经混进了 “complete” 和 “of time” 的信息；[CLS] 的向量混进了所有词。形状没变，内容变了。"
      : "每一层里每个位置都看整句。“thin” 和 “saves” 互相看得见，[CLS] 的向量混进了所有词，包括那个转折的 “but”。形状没变，内容变了。";
  } else if (stage === 3) {
    detail = (
      <>
        <div className="viz-chips">{full.map(chip)}</div>
        <div className="viz-mono" style={{ marginTop: 10, lineHeight: 1.9 }}>
          h_CLS = 第 {LAYERS} 层输出的第 0 行　　[1, {H}]<br />
          pooled = tanh(W_p · h_CLS + b_p)　　W_p: [{H}, {H}]，预训练时在 NSP 任务上学过
        </div>
      </>
    );
    narr = `只取位置 0 那一行。其它 ${full.length - 1} 个位置的输出在分类任务里不再使用，但它们已经通过注意力把信息送进了 [CLS]。pooler 是预训练就有的一层，不是新加的。`;
  } else {
    detail = (
      <>
        <div className="viz-mono" style={{ lineHeight: 1.9 }}>
          logits = W · pooled + b　　W: [2, {H}]，b: [2]　← 随机初始化的 {HEAD_PARAMS.toLocaleString()} 个新参数<br />
          z = [{zNeg.toFixed(2)}, {zPos.toFixed(2)}]（示意）→ softmax → p = [{pNeg.toFixed(2)}, {pPos.toFixed(2)}]
        </div>
        <div className="viz-bars" style={{ marginTop: 10 }} role="img" aria-label={`负面 ${pNeg.toFixed(2)}，正面 ${pPos.toFixed(2)}，标签 ${LABELS[ex.label]}。`}>
          {[0, 1].map((k) => {
            const p = k === 1 ? pPos : pNeg;
            return (
              <div className="viz-bar-row" key={k} style={{ gridTemplateColumns: "110px minmax(0, 1fr) auto" }}>
                <span className="viz-bar-label">{LABELS[k]}{ex.label === k ? "（标签）" : ""}</span>
                <div className="viz-bar-track"><span style={{ width: `${Math.max(1, p * 100)}%`, background: ex.label === k ? "var(--v1)" : "var(--vfixed)" }} /></div>
                <span className="viz-bar-val">{p.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
        <div className="viz-mono" style={{ marginTop: 10 }}>loss = −log p({LABELS[ex.label]}) = −log {pLabel.toFixed(2)} = <b>{loss.toFixed(2)}</b>　　预测：{LABELS[predicted]}{predicted === ex.label ? "，与标签一致" : "，与标签不一致"}</div>
      </>
    );
    if (!tuned) {
      narr = `微调前：分类头是随机的，输出接近一半一半，损失 ${loss.toFixed(2)}。这个损失的梯度不只更新 ${HEAD_PARAMS.toLocaleString()} 个头参数，还会流回编码器全部 ${BODY_PARAMS.toLocaleString()} 个参数，只是学习率很小（2e-5）。`;
      tone = "is-warn";
    } else {
      narr = `在 SST-2 上微调 3 个 epoch 后：p(${LABELS[ex.label]}) = ${pLabel.toFixed(2)}，损失 ${loss.toFixed(2)}。${exIdx === 2 ? "这句有转折，模型没有前两句那么笃定，但方向对了。" : "头学会了读 pooled 向量里的情感方向，编码器也被轻微调整得更偏向这个任务。"}`;
      tone = "is-good";
    }
  }

  return (
    <VisualizationFrame
      title="用 [CLS] 做情感分类：一条影评走完五步"
      description="选一条影评，按步骤看张量形状怎样从 [1, T] 变成一个标量损失；在最后一步切换“微调前 / 微调后”，看同一个头的输出怎样变化。"
      footnote={<>概率与 logits 是示意值。参数量是 bert-base-uncased 的真实数字：编码器（含 pooler）{BODY_PARAMS.toLocaleString()}，分类头 {HEAD_PARAMS.toLocaleString()}（{H}×2+2），头只占 {headShare.toFixed(4)}%，但微调时两者一起更新。</>}
    >
      <div className="viz-controls">
        <span className="viz-k">影评：</span>
        {EXAMPLES.map((e, i) => (
          <button key={i} type="button" className={`viz-chip${exIdx === i ? " is-on" : ""}`} onClick={() => setExIdx(i)}>{e.tokens.join(" ").replace(" ,", ",")}</button>
        ))}
      </div>
      <div className="viz-controls">
        <button type="button" className="viz-btn" onClick={() => setStage((s) => Math.max(0, s - 1))} disabled={stage === 0}>上一步</button>
        <button type="button" className="viz-btn primary" onClick={() => setStage((s) => Math.min(STAGES.length - 1, s + 1))} disabled={stage === STAGES.length - 1}>下一步</button>
        <span className="viz-k">｜</span>
        <button type="button" className={`viz-btn${!tuned ? " is-on" : ""}`} onClick={() => setTuned(false)}>微调前</button>
        <button type="button" className={`viz-btn${tuned ? " is-on" : ""}`} onClick={() => setTuned(true)}>微调后</button>
      </div>

      <div className="viz-grid2">
        <div className="viz-stages">
          {STAGES.map((s, i) => (
            <button key={s.name} type="button" className={`viz-stage${i === stage ? " is-current" : ""}${i < stage ? " is-pass" : ""}`} onClick={() => setStage(i)} style={{ font: "inherit", width: "100%", textAlign: "left", cursor: "pointer", color: "var(--ink)", borderLeft: `4px solid ${s.color}` }}>
              <span className="dot" />
              <span><b>{i + 1}. {s.name}</b><small className="viz-mono">{s.out}</small></span>
            </button>
          ))}
        </div>
        <div className="viz-panel">
          <h5>第 {stage + 1} 步 · {STAGES[stage].name}</h5>
          {detail}
        </div>
      </div>

      <div className="viz-panel" style={{ marginTop: 14 }}>
        <h5>微调时谁在更新</h5>
        <table className="viz-table">
          <thead><tr><th>参数</th><th className="num">个数</th><th>来源</th><th>微调时</th></tr></thead>
          <tbody>
            <tr><td>编码器 + 嵌入 + pooler</td><td className="num">{BODY_PARAMS.toLocaleString()}</td><td>预训练权重</td><td>更新，lr 2e-5</td></tr>
            <tr><td>分类头 W、b</td><td className="num">{HEAD_PARAMS.toLocaleString()}</td><td>随机初始化</td><td>更新，lr 2e-5</td></tr>
            <tr><td>MLM 头、NSP 头</td><td className="num">—</td><td>预训练时用过</td><td>丢弃</td></tr>
          </tbody>
        </table>
      </div>

      <div className={`viz-narr${tone ? ` ${tone}` : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}

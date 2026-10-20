"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { encode, encodeBatch, LABELS, type Label } from "@/lib/ml/finetune";

// BERT fine-tuning, figure 2: three labelled sentences become one batch.
// Steps: raw rows → characters → [CLS] / [SEP] → truncate to max_len →
// pad to the longest row with an attention mask → ids and the label tensor.

const ROWS: { text: string; label: Label }[] = [
  { text: "国补到账了，价格很划算", label: 2 },
  { text: "国补什么时候发", label: 1 },
  { text: "等了一个月国补还没到账，客服也不回消息，太失望了", label: 0 },
];
const MAX_LEN = 20; // 示意；真实微调常用 128
const LABEL_COLOR = ["#eb6834", "#76796f", "#1baf7a"];

const STEPS = ["原始数据", "按字切开", "加 [CLS] 和 [SEP]", `截断到 max_len = ${MAX_LEN}`, "补齐成一个 batch", "查表成 id，打包张量"];

type Cell = { tok: string; kind: "char" | "special" | "pad" | "cut" };

function cellStyle(kind: Cell["kind"]) {
  if (kind === "special") return { background: "#3b4234", color: "#fff", borderColor: "#3b4234" };
  if (kind === "pad") return { background: "#f3f1e7", color: "#9a9c8d", borderStyle: "dashed" as const };
  if (kind === "cut") return { background: "#fff", color: "#c9c4ad", textDecoration: "line-through", borderStyle: "dashed" as const };
  return { background: "#fbf1cf", borderColor: "#d9b24a" };
}

export default function TokenizeBatchFigure() {
  const [step, setStep] = useState(0);
  const batch = useMemo(() => encodeBatch(ROWS.map((r) => r.text), MAX_LEN), []);
  const L = batch[0].tokens.length;

  const rowCells = (text: string, r: number): Cell[] => {
    const chars = Array.from(text);
    if (step === 1) return chars.map((c) => ({ tok: c, kind: "char" }));
    const full: Cell[] = [{ tok: "[CLS]", kind: "special" }, ...chars.map((c) => ({ tok: c, kind: "char" as const })), { tok: "[SEP]", kind: "special" }];
    if (step === 2) return full;
    const enc = step === 3 ? encode(text, MAX_LEN) : batch[r];
    const cells: Cell[] = enc.tokens.map((t) => ({ tok: t, kind: t === "[PAD]" ? "pad" : t.startsWith("[") ? "special" : "char" }));
    if (step === 3 && enc.truncated > 0) return [...cells, ...chars.slice(chars.length - enc.truncated).map((c) => ({ tok: c, kind: "cut" as const }))];
    return cells;
  };

  const narr = (() => {
    switch (step) {
      case 0:
        return { tone: "", text: "三条带标签的评论：正面、中性、负面各一条。标签先映射成整数：负面 0、中性 1、正面 2，这张映射表训练和推理都要用同一份。按「下一步」看它们怎样变成模型能吃的张量。" };
      case 1:
        return { tone: "", text: "MacBERT 沿用 bert-base-chinese 的词表，中文一个字就是一个 token，不需要分词器；标点「，」也是一个 token。三条分别是 11、7、24 个字。（英文和数字会按 WordPiece 切成子词。）" };
      case 2:
        return { tone: "", text: "每条前面加 [CLS]，后面加 [SEP]。[CLS] 这个位置最后会被拿去做分类；[SEP] 标出句子结束。单句分类没有 B 段，所以 token_type_ids 全是 0。" };
      case 3:
        return { tone: " is-warn", text: `长度上限 max_len = ${MAX_LEN}（示意，真实常用 128，最大 512）。第三条加上两个特殊符号有 26 个 token，超出部分从尾部截掉 ${encode(ROWS[2].text, MAX_LEN).truncated} 个字，[SEP] 仍然保留在最后。被截掉的尾巴里恰好有最能说明负面的「太失望了」，这就是长文本截断的风险。` };
      case 4:
        return { tone: "", text: `同一个 batch 必须是矩形：短的行用 [PAD] 补到这一批里最长的那行，这里是 ${L}。attention_mask 在真实 token 上是 1、在 [PAD] 上是 0，注意力会把 0 的位置屏蔽掉，补多少都不影响结果。按 batch 内最长补齐（动态 padding）比一律补到 128 省很多计算。` };
      default:
        return { tone: " is-good", text: `每个 token 查词表换成 id：[CLS] = 101、[SEP] = 102、[PAD] = 0 是 bert-base-chinese 词表里的真实 id，汉字的 id 这里是示意值。最终交给模型的是 input_ids、attention_mask、token_type_ids 三个 [3, ${L}] 的整数矩阵，外加 labels = [2, 1, 0]。` };
    }
  })();

  return (
    <VisualizationFrame
      title="三条评论怎样变成一个 batch"
      description="黄色是普通汉字 token，深色是特殊符号，灰色虚线是补齐用的 [PAD]，划掉的是被截断的字。按「下一步」或「播放」走一遍。"
    >
      <StepPlayer step={step} total={STEPS.length} onStep={setStep} intervalMs={2200} caption={`第 ${step + 1} 步 / ${STEPS.length}：${STEPS[step]}`} />

      <div className="viz-scroll" style={{ marginTop: 6 }}>
        <div style={{ minWidth: 560, display: "grid", gap: 10 }}>
          {ROWS.map((r, i) => (
            <div key={i}>
              <div className="viz-k" style={{ marginBottom: 4 }}>
                第 {i + 1} 条 · 标签 <b style={{ color: LABEL_COLOR[r.label] }}>{LABELS[r.label]}</b>
                {step >= 5 ? ` = ${r.label}` : ""}
              </div>
              {step === 0 ? (
                <div style={{ fontSize: 14, padding: "4px 0" }}>{r.text}</div>
              ) : (
                <>
                  <div className="tok-strip">
                    {rowCells(r.text, i).map((c, k) => (
                      <span key={`${step}-${k}`} className="tok" style={{ minWidth: c.tok.length > 1 ? 44 : 24, padding: "3px 4px", ...cellStyle(c.kind) }}>
                        <span>{c.tok}</span>
                        {step >= 5 && <small style={{ color: c.kind === "special" ? "#d9dccf" : undefined }}>{batch[i].inputIds[k]}</small>}
                      </span>
                    ))}
                  </div>
                  {step >= 4 && (
                    <div className="tok-strip" style={{ marginTop: 3 }} aria-label="attention_mask">
                      {batch[i].attentionMask.map((m, k) => (
                        <span key={k} className="tok" style={{ minWidth: batch[i].tokens[k].length > 1 ? 44 : 24, padding: "0 4px", fontSize: 10, color: m ? "#2a78d6" : "#c9c4ad", background: m ? "#dbe8f8" : "#fff" }}>
                          {m}
                        </span>
                      ))}
                      <span className="viz-k" style={{ marginLeft: 6 }}>attention_mask</span>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {step >= 5 && (
        <div className="viz-stat" style={{ marginTop: 12 }}>
          <div><small>input_ids</small><b>[3, {L}]</b></div>
          <div><small>attention_mask</small><b>[3, {L}]</b></div>
          <div><small>token_type_ids</small><b>[3, {L}] 全 0</b></div>
          <div><small>labels</small><b>[2, 1, 0]</b></div>
        </div>
      )}

      <div className={`viz-narr${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

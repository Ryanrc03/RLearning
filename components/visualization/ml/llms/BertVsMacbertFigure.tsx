"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { corrupt, DEMO_WORDS, MASK, stats, type MaskStrategy } from "@/lib/ml/macbert";

// BERT vs MacBERT: one sentence, four ways to corrupt it for masked-LM
// pre-training. Top row is what the model reads, bottom row is what the loss
// asks it to recover. The stats count [MASK] tokens (which fine-tuning inputs
// never contain) and words that were cut in half.

const MODES: { key: MaskStrategy; label: string }[] = [
  { key: "bert", label: "BERT：单字 [MASK]" },
  { key: "wwm", label: "全词遮罩" },
  { key: "ngram", label: "N-gram 遮罩" },
  { key: "macbert", label: "MacBERT：近义词替换" },
];

const V2 = "#eb6834";
const V3 = "#1d9e75";
const MUTED = "#76796f";

export default function BertVsMacbertFigure() {
  const [mode, setMode] = useState<MaskStrategy>("bert");
  const tokens = useMemo(() => corrupt(mode), [mode]);
  const s = stats(tokens);

  // Word boundaries, so the strip can leave a small gap between words.
  const wordEnd = new Set<number>();
  DEMO_WORDS.reduce((at, w) => (wordEnd.add(at + w.length - 1), at + w.length), 0);

  const cell = (kind: string) => (kind === "mask" ? { borderColor: V2, background: "#fdeee6", color: V2 } : kind === "swap" ? { borderColor: V3, background: "#e8f6f0", color: V3 } : {});

  const narr = (() => {
    switch (mode) {
      case "bert":
        return { tone: " is-warn", text: `随机挑单个字换成 [MASK]：「模型」只遮了「模」、「预测」只遮了「预」，剩下半个字几乎直接给出答案。输入里有 ${s.maskTokens} 个 [MASK]，而微调时的句子里一个都不会有。` };
      case "wwm":
        return { tone: "", text: `先分词，一个词被选中就把它的字全遮掉：「模型」「预测」整词消失，${s.partialWords} 个词被切半。模型只能靠上下文猜整个词，但输入里仍有 ${s.maskTokens} 个 [MASK]。` };
      case "ngram":
        return { tone: "", text: `一次遮 1 到 4 个相邻的词（论文按 40% / 30% / 20% / 10% 抽长度）：「语言模型」作为 2-gram 一起遮掉。要猜的更长、更难，[MASK] 增加到 ${s.maskTokens} 个。` };
      case "macbert":
        return { tone: " is-good", text: `选词方式同全词 + N-gram，但不放 [MASK]，换成长度相同的近义词：「语言模型→语法建模」「预测→预见」「概率→几率」。输入里 [MASK] 为 ${s.maskTokens}，读起来像一句有错别字的真话，任务是把 ${s.predicted} 个字纠回原文。` };
    }
  })();

  return (
    <VisualizationFrame
      title="同一句话，四种遮法"
      description="上排是模型在预训练时读到的输入，下排是 loss 要求它还原的原字。橙色是 [MASK]，绿色是被换成的近义词；词与词之间留了一点空隙，方便看出遮法有没有把一个词切开。"
    >
      <div className="viz-row">
        <Tabs options={MODES} value={mode} onChange={setMode} ariaLabel="遮罩方式" />
      </div>

      <div className="tok-strip" style={{ marginBottom: 6 }} aria-label="模型读到的输入">
        <span className="viz-k" style={{ width: 52 }}>输入</span>
        {tokens.map((t, i) => (
          <span key={`${mode}-${i}`} className="tok" style={{ minWidth: t.input === MASK ? 50 : 30, marginRight: wordEnd.has(i) ? 6 : 0, ...cell(t.kind) }}>
            <span style={{ fontWeight: 600 }}>{t.input}</span>
          </span>
        ))}
      </div>
      <div className="tok-strip" style={{ marginBottom: 12 }} aria-label="要还原的原字">
        <span className="viz-k" style={{ width: 52 }}>要猜回</span>
        {tokens.map((t, i) => (
          <span key={`${mode}-t-${i}`} className="tok" style={{ minWidth: t.input === MASK ? 50 : 30, marginRight: wordEnd.has(i) ? 6 : 0, color: t.kind === "keep" ? "#c9c8bd" : undefined, borderStyle: t.kind === "keep" ? "dashed" : undefined }}>
            <span>{t.kind === "keep" ? "·" : t.target}</span>
          </span>
        ))}
      </div>

      <div className="viz-stat">
        <div><small>交 loss 的字</small><b>{s.predicted} / {tokens.length}</b></div>
        <div><small>输入里的 [MASK]</small><b style={{ color: s.maskTokens ? V2 : V3 }}>{s.maskTokens}</b></div>
        <div><small>被切成半个的词</small><b style={{ color: s.partialWords ? V2 : MUTED }}>{s.partialWords}</b></div>
        <div><small>微调时输入长这样吗</small><b style={{ color: s.maskTokens ? V2 : V3 }}>{s.maskTokens ? "不会" : "像"}</b></div>
      </div>

      <div className={`viz-narr${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

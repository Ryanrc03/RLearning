"use client";

import { useState } from "react";
import { FINETUNE_TASKS } from "@/lib/ml/bertPretrain";
import { Arrow, BahFrame, Box, Legend, Markers, P } from "../bahdanau/shared";

type Focus = "none" | "pretrain" | "sentiment" | "ner" | "qa";

const W = 700;
const H = 330;
const ID = "p2f";
const ROW_Y = [22, 124, 226];

export default function PretrainToFinetuneFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const task = FINETUNE_TASKS.find((t) => t.key === focus);
  const dimPre = focus !== "none" && focus !== "pretrain";
  const dimTask = (key: string) => focus !== "none" && focus !== key;

  return (
    <BahFrame
      title="图 7 · Pre-training → Fine-tuning：一份 checkpoint，三个各自微调的模型"
      description="左边预训练出一个 Encoder。右边每个任务从这份权重复制一份出发，换上自己的头，用自己的标注数据继续训练。"
      footnote={<>结构示意。右边是三个互相独立的模型：它们的起点相同，微调之后权重各不相同，不是三个任务同时在线训练同一个 Encoder。预训练用的 MLM / NSP 头在微调时通常不再使用。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择阶段或任务">
        <button type="button" aria-pressed={focus === "pretrain"} className={`viz-btn${focus === "pretrain" ? " is-on" : ""}`} onClick={() => setFocus("pretrain")}>Pre-training</button>
        {FINETUNE_TASKS.map((t) => (
          <button key={t.key} type="button" aria-pressed={focus === t.key} className={`viz-btn${focus === t.key ? " is-on" : ""}`} onClick={() => setFocus(t.key)}>{t.name}</button>
        ))}
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 660 }}>
          <title id={`${ID}-title`}>从预训练到微调</title>
          <desc id={`${ID}-desc`}>左侧预训练：无标注文本进入一个共享的 BERT Encoder，上面接 MLM 头和 NSP 头，两类 loss 更新 Encoder 和这两个头。训练结束后保存 Encoder 权重作为 checkpoint。右侧三个下游任务：情感分类、命名实体识别、抽取式问答。每个任务从同一份 checkpoint 复制一个 Encoder，接上自己的任务头，用自己的标注数据继续训练，得到三个独立的模型。</desc>
          <Markers id={ID} />

          {/* pre-training */}
          <text x={104} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimPre ? 0.28 : 1} className="bah-fade">Pre-training</text>
          <Box x={16} y={36} w={84} h={34} tone="att" title="MLM Head" sub="→ L_MLM" dim={dimPre} size={9.5} />
          <Box x={108} y={36} w={84} h={34} tone="dec" title="NSP Head" sub="→ L_NSP" dim={dimPre} size={9.5} />
          <Arrow id={ID} tone="att" d="M70 126 V73" dim={dimPre} />
          <Arrow id={ID} tone="dec" d="M138 126 V73" dim={dimPre} />
          <Box x={16} y={126} w={176} h={56} tone="enc" bold title="Shared BERT Encoder" sub="两类 loss 一起更新它" dim={dimPre} />
          <Arrow id={ID} tone="neu" d="M104 236 V185" dim={dimPre} />
          <Box x={16} y={236} w={176} h={34} tone="neu" title="无任务标注的文本" sub="Wikipedia + BooksCorpus" dim={dimPre} size={10} />
          <text x={104} y={292} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={dimPre ? 0.28 : 1} className="bah-fade">更新：Encoder + 两个预训练头</text>

          {/* checkpoint */}
          <Arrow id={ID} tone="enc" d="M192 154 H229" bold />
          <text x={211} y={147} fontSize={8.5} textAnchor="middle" fill={P.sub}>保存</text>
          <Box x={232} y={130} w={116} h={48} tone="enc" bold title="Pretrained Encoder" sub="checkpoint（一份权重）" size={10} />
          <text x={290} y={196} fontSize={8.5} textAnchor="middle" fill={P.sub}>MLM / NSP 头留在这边，</text>
          <text x={290} y={208} fontSize={8.5} textAnchor="middle" fill={P.sub}>不带去下游</text>

          {/* three independent fine-tuned models */}
          <text x={548} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink}>Fine-tuning（三个独立的模型）</text>
          {FINETUNE_TASKS.map((t, i) => {
            const y = ROW_Y[i];
            const dim = dimTask(t.key);
            const bold = focus === t.key;
            return (
              <g key={t.key}>
                <Arrow id={ID} tone="enc" d={`M348 154 H376 V${y + 46} H407`} dim={dim} bold={bold} />
                <g opacity={dim ? 0.28 : 1} className="bah-fade">
                  <rect x={400} y={y + 8} width={292} height={84} rx={8} fill="none" stroke={P.grey} strokeWidth={0.9} strokeDasharray="2 3" />
                  <text x={408} y={y + 20} fontSize={9} fontWeight={600} fill={P.ink}>{t.name}</text>
                  <text x={684} y={y + 20} fontSize={8.5} textAnchor="end" fill={P.sub}>数据：{t.input} + 标签</text>
                </g>
                <Box x={410} y={y + 28} w={126} h={36} tone="enc" title={`Encoder 副本 ${i + 1}`} sub="从 checkpoint 初始化" dim={dim} bold={bold} size={10} />
                <Arrow id={ID} tone="par" d={`M536 ${y + 46} H553`} dim={dim} bold={bold} />
                <Box x={556} y={y + 28} w={128} h={36} tone="par" title="新的任务头" sub={t.output} dim={dim} bold={bold} size={10} />
                <text x={546} y={y + 82} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={dim ? 0.28 : 1} className="bah-fade">task loss 同时更新这个副本和它的头</text>
              </g>
            );
          })}
          <text x={376} y={318} fontSize={8.5} textAnchor="middle" fill={P.sub}>复制初始化</text>
        </svg>
      </div>
      {task && (
        <div className="viz-controls" aria-label="示例输入" style={{ marginTop: 10, marginBottom: 0 }}>
          <span className="viz-k">示例输入：</span>
          {task.example.map((tok, i) => {
            const used = task.used.includes(i);
            return <span key={i} className="viz-mono" style={{ padding: "2px 7px", borderRadius: 5, border: `${used ? 2 : 1}px solid ${used ? P.dyn : P.grey}`, background: used ? P.dynFill : "transparent", fontWeight: used ? 700 : 400 }}>{tok}</span>;
          })}
          <span className="viz-k">→ {task.exampleOutput}</span>
        </div>
      )}
      <Legend items={[{ tone: "enc", label: "BERT Encoder 及其权重" }, { tone: "att", label: "MLM Head" }, { tone: "dec", label: "NSP Head" }, { tone: "par", label: "下游任务的新头" }, { tone: "neu", label: "预训练数据" }]} />
      <div className={`viz-narr${task ? " is-good" : focus === "pretrain" ? " is-warn" : ""}`} aria-live="polite">
        {focus === "none" && <>从左往右：先在无标注文本上用 MLM 和 NSP 预训练一个 Encoder，存下它的权重；再让每个下游任务从这份权重各复制一份，接上自己的头继续训练。预训练学的是可迁移的表示，微调学的是具体任务。</>}
        {focus === "pretrain" && <>Pre-training：数据是大量没有任务标签的文本，监督信号由文本自己构造。MLM 和 NSP 两个头只是为了产生训练信号；训练结束后真正留下来用的是 Encoder 的权重。</>}
        {task && <>{task.name}：输入是{task.input}，读的是{task.reads}，接的是「{task.head}」，输出{task.output}。加粗框住的 token 是这个头读取的位置。Encoder 副本和新头一起被这个任务的 loss 更新（端到端微调）；这需要该任务自己的标注数据。</>}
      </div>
    </BahFrame>
  );
}

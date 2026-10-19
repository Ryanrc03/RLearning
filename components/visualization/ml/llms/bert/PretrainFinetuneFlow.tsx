"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Stage = "none" | "pretrain" | "finetune";

const C1 = "#2a78d6"; // pre-training side
const C2 = "#eb6834"; // fine-tuning side
const C3 = "#1baf7a"; // the one encoder shared by both sides
const T1 = "#dbe8f8";
const T2 = "#fbe3d8";
const T3 = "#d9f1e6";
const INK = "#30332c";
const LINE = "#76796f";
const W = 640;
const H = 250;

function marker(color: string) {
  return color === C1 ? "url(#pf-blue)" : color === C2 ? "url(#pf-orange)" : "url(#pf-green)";
}

function Node({ x, y, w, h, title, sub, color, fill, bold, dim }: { x: number; y: number; w: number; h: number; title: string; sub?: string; color: string; fill: string; bold?: boolean; dim?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={dim ? 0.3 : 1}>
      <rect width={w} height={h} rx={6} fill={fill} stroke={color} strokeWidth={bold ? 2.2 : 1.4} />
      <text x={w / 2} y={sub ? 15 : h / 2 + 4} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={INK}>{title}</text>
      {sub && <text x={w / 2} y={29} fontSize={8.5} textAnchor="middle" fill={LINE}>{sub}</text>}
    </g>
  );
}

function Down({ x, y1, y2, color, label, bold, dim }: { x: number; y1: number; y2: number; color: string; label?: string; bold?: boolean; dim?: boolean }) {
  return (
    <g opacity={dim ? 0.3 : 1}>
      <line x1={x} y1={y1} x2={x} y2={y2 - 5} stroke={color} strokeWidth={bold ? 2 : 1.4} markerEnd={marker(color)} />
      {label && <text x={x + 6} y={(y1 + y2) / 2 + 3} fontSize={8.5} fill={LINE}>{label}</text>}
    </g>
  );
}

const NARR: Record<Stage, { text: string; tone?: string }> = {
  none: {
    text: "蓝色是预训练，橙色是微调，绿色的编码器是同一个模型。先看结构：左边的输入没有标签，损失来自两个预训练头；右边的输入有标签，损失来自一个新加的任务头。然后点上面的按钮。",
  },
  pretrain: {
    text: "左边：一条没有标签的句子被遮掉 15% 的词，编码器算出每个位置的向量，MLM 头猜被遮的词，NSP 头猜 B 是不是下一句，两项损失相加，梯度更新全部参数。这样跑 100 万步，16 块 TPU 芯片 4 天。右边此时还不存在。",
    tone: "is-warn",
  },
  finetune: {
    text: "右边：编码器的权重整个从左边复制过来，两个预训练头丢掉，换成一个随机初始化的任务头。一条带标签的影评进来，交叉熵的梯度同样流回全部参数，只是学习率只有预训练的百分之一。几千到几万条标注数据、2 到 4 个 epoch、几小时就够。",
    tone: "is-good",
  },
};

export default function PretrainFinetuneFlow() {
  const [stage, setStage] = useState<Stage>("none");
  const dimL = stage === "finetune";
  const dimR = stage === "pretrain";
  const boldL = stage === "pretrain";
  const boldR = stage === "finetune";
  const narr = NARR[stage];

  return (
    <VisualizationFrame
      title="两段训练：先在无标注文本上预训练，再在标注数据上微调"
      description="左边是预训练，右边是微调，两边中间的编码器是同一个模型。点按钮看每一段里数据从哪来、损失在哪算、哪些参数在更新。"
      footnote={<>数字来自论文：BooksCorpus 8 亿词 + 英文维基 25 亿词；预训练 100 万步，BERT_BASE 用 16 块 TPU 芯片跑 4 天；微调学习率 2e-5 到 5e-5，2 到 4 个 epoch。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${stage === "pretrain" ? " is-on" : ""}`} onClick={() => setStage("pretrain")}>预训练一步</button>
        <button type="button" className={`viz-btn${stage === "finetune" ? " is-on" : ""}`} onClick={() => setStage("finetune")}>微调一步</button>
        <button type="button" className="viz-btn" onClick={() => setStage("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr.text}>
          <defs>
            <marker id="pf-blue" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C1} /></marker>
            <marker id="pf-orange" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C2} /></marker>
            <marker id="pf-green" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C3} /></marker>
          </defs>

          {/* left: pre-training */}
          <text x={155} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill={C1} opacity={dimL ? 0.3 : 1}>预训练 · 无标注文本</text>
          <Node x={25} y={22} w={260} h={38} title="无标注文本：BooksCorpus + 英文维基，33 亿词" sub="没有标签；随机遮掉 15% 的词，再随机配一句 B" color={C1} fill={T1} bold={boldL} dim={dimL} />
          <Down x={155} y1={60} y2={84} color={C1} label="the cat [MASK] on the mat [SEP] it is …" bold={boldL} dim={dimL} />
          <Node x={65} y={84} w={180} h={44} title="BERT 编码器" sub="12 层 · 1.1 亿参数 · 从随机初始化开始" color={C3} fill={T3} bold={boldL} dim={dimL} />
          <g opacity={dimL ? 0.3 : 1}>
            <line x1={120} y1={128} x2={90} y2={155} stroke={C1} strokeWidth={boldL ? 2 : 1.4} markerEnd="url(#pf-blue)" />
            <line x1={190} y1={128} x2={220} y2={155} stroke={C1} strokeWidth={boldL ? 2 : 1.4} markerEnd="url(#pf-blue)" />
          </g>
          <Node x={25} y={158} w={125} h={40} title="MLM 头" sub="猜被遮的词 → L_MLM" color={C1} fill={T1} bold={boldL} dim={dimL} />
          <Node x={160} y={158} w={125} h={40} title="NSP 头" sub="B 是不是下一句 → L_NSP" color={C1} fill={T1} bold={boldL} dim={dimL} />
          <text x={155} y={222} fontSize={9.5} textAnchor="middle" fill={C1} fontWeight={600} opacity={dimL ? 0.3 : 1}>L = L_MLM + L_NSP，梯度更新全部参数</text>
          <text x={155} y={238} fontSize={8.5} textAnchor="middle" fill={LINE} opacity={dimL ? 0.3 : 1}>100 万步 · 16 块 TPU 芯片 × 4 天</text>

          <line x1={320} y1={8} x2={320} y2={H - 6} stroke="#e4dfcb" strokeDasharray="3 3" />

          {/* weights copied across */}
          <g opacity={dimL || dimR ? (stage === "finetune" ? 1 : 0.3) : 1}>
            <path d="M245 106 C 300 106, 310 106, 390 106" fill="none" stroke={C3} strokeWidth={boldR ? 2.2 : 1.6} strokeDasharray={boldR ? undefined : "5 3"} markerEnd="url(#pf-green)" />
            <text x={320} y={100} fontSize={8.5} fontWeight={600} textAnchor="middle" fill={C3}>复制全部权重</text>
          </g>

          {/* right: fine-tuning */}
          <text x={485} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill={C2} opacity={dimR ? 0.3 : 1}>微调 · 标注数据</text>
          <Node x={355} y={22} w={260} h={38} title="标注数据：影评 + 标签，几千到几万条" sub="每条样本有正确答案" color={C2} fill={T2} bold={boldR} dim={dimR} />
          <Down x={485} y1={60} y2={84} color={C2} label="the movie was a waste of time · 负面" bold={boldR} dim={dimR} />
          <Node x={395} y={84} w={180} h={44} title="同一个 BERT 编码器" sub="权重从左边复制，继续更新" color={C3} fill={T3} bold={boldR} dim={dimR} />
          <Down x={485} y1={128} y2={158} color={C2} label="只取 [CLS] 或每个位置" bold={boldR} dim={dimR} />
          <Node x={385} y={158} w={200} h={40} title="任务头（新的，随机初始化）" sub="分类 / 问答起止 / 序列标注" color={C2} fill={T2} bold={boldR} dim={dimR} />
          <text x={485} y={222} fontSize={9.5} textAnchor="middle" fill={C2} fontWeight={600} opacity={dimR ? 0.3 : 1}>L = 任务的交叉熵，梯度同样流回全部参数</text>
          <text x={485} y={238} fontSize={8.5} textAnchor="middle" fill={LINE} opacity={dimR ? 0.3 : 1}>2 到 4 个 epoch · 学习率 2e-5 · 几小时 · 每个任务一个副本</text>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: T1, border: `1px solid ${C1}` }} />预训练这一侧</span>
        <span><i style={{ background: T2, border: `1px solid ${C2}` }} />微调这一侧</span>
        <span><i style={{ background: T3, border: `1px solid ${C3}` }} />同一个编码器，权重从左传到右</span>
      </div>
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}

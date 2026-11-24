"use client";

import { useState } from "react";
import { NSP_EXAMPLES, NSP_SENTENCE_A, nspLoss } from "@/lib/ml/bertPretrain";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

const W = 700;
const H = 300;
const ID = "nsp";
const BAR_X = 322;
const BAR_W = 150;

export default function NspFigure() {
  const [idx, setIdx] = useState(0);
  const ex = NSP_EXAMPLES[idx];
  const loss = nspLoss(ex);
  const pTrue = ex.y === 1 ? ex.pIsNext : 1 - ex.pIsNext;

  return (
    <BahFrame
      title="图 4 · NSP：B 是不是 A 在原文里的下一句"
      description="两个片段拼成一条序列送进 Encoder，只取 [CLS] 位置的输出做二分类。在正例和负例之间切换。"
      footnote={<>教学示例：p(IsNext) 是假设的预测值，loss 由它算出。正例的 B 是语料里紧跟 A 的那一句；负例的 B 是从语料里随机取的一句。标签是构造数据时自动得到的。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择句子对">
        {NSP_EXAMPLES.map((e, k) => (
          <button key={e.key} type="button" aria-pressed={idx === k} className={`viz-btn${idx === k ? " is-on" : ""}`} onClick={() => setIdx(k)}>{e.y === 1 ? "正例" : "负例"}：{e.label}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 660 }}>
          <title id={`${ID}-title`}>Next Sentence Prediction 的输入与预测</title>
          <desc id={`${ID}-desc`}>输入是 CLS、句子 A、SEP、句子 B、SEP 拼成的一条序列。句子 A 是 {NSP_SENTENCE_A}，句子 B 是 {ex.sentenceB}。整条序列经过 BERT Encoder，取 CLS 位置的隐藏向量送入二分类头，预测 B 是 A 的下一句的概率为 {ex.pIsNext}。真实标签是 {ex.label}，二分类交叉熵约为 {loss.toFixed(3)}。</desc>
          <Markers id={ID} />

          {/* [CLS] A [SEP] B [SEP] */}
          <Box x={16} y={246} w={52} h={34} tone="dec" bold title="[CLS]" size={10} />
          <Box x={72} y={246} w={216} h={34} tone="neu" title={NSP_SENTENCE_A} sub="Sentence A" size={9.5} />
          <Box x={292} y={246} w={48} h={34} tone="neu" title="[SEP]" size={10} />
          <Box x={344} y={246} w={288} h={34} tone={ex.y === 1 ? "neu" : "grey"} dashed={ex.y === 0} title={ex.sentenceB} sub={ex.y === 1 ? "Sentence B：语料里紧跟在 A 后面" : "Sentence B：随机取来的一句"} size={9.5} />
          <Box x={636} y={246} w={48} h={34} tone="neu" title="[SEP]" size={10} />
          {[42, 180, 316, 488, 660].map((x) => <Arrow key={x} id={ID} tone="neu" d={`M${x} 246 V217`} />)}
          <Box x={16} y={174} w={668} h={40} tone="enc" title="BERT Encoder" sub="A 和 B 在同一条序列里，互相都能看到" />

          <Arrow id={ID} tone="dyn" d="M42 174 V149" bold />
          <Box x={16} y={118} w={72} h={28} tone="dyn" bold title={<Sym b="h" s="CLS" />} />
          <rect x={100} y={118} width={584} height={28} rx={6} fill="none" stroke={P.grey} strokeWidth={0.8} strokeDasharray="3 3" />
          <text x={392} y={136} fontSize={9} textAnchor="middle" fill={P.sub}>其余位置也有输出向量，NSP 不用它们</text>

          <Arrow id={ID} tone="dec" d="M52 118 V52 H109" bold />
          <Box x={112} y={34} w={150} h={36} tone="dec" bold title="Binary Head" sub="σ(wᵀh + b)" />
          <Arrow id={ID} tone="dec" d="M262 52 H319" />
          <text x={BAR_X + BAR_W / 2} y={30} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>p(IsNext) = {ex.pIsNext.toFixed(2)}</text>
          <rect x={BAR_X} y={42} width={BAR_W} height={20} rx={4} fill={P.surface} stroke={P.grey} strokeWidth={0.6} />
          <rect className="bah-bar" x={BAR_X} y={42} width={Math.round(ex.pIsNext * BAR_W)} height={20} rx={4} fill={P.dec} />
          <text x={BAR_X} y={78} fontSize={8.5} fill={P.sub}>NotNext</text>
          <text x={BAR_X + BAR_W} y={78} fontSize={8.5} textAnchor="end" fill={P.sub}>IsNext</text>

          <Arrow id={ID} tone="grey" dashed d="M472 52 H505" />
          <Box x={508} y={30} w={176} h={44} tone="grey" dashed title={<>BCE，标签 y = {ex.y}（{ex.label}）</>} sub={`−ln ${pTrue.toFixed(2)} ≈ ${loss.toFixed(3)}`} size={9.5} />
        </svg>
      </div>
      <Legend items={[{ tone: "dec", label: "NSP：[CLS] 与二分类头" }, { tone: "enc", label: "BERT Encoder" }, { tone: "dyn", label: "[CLS] 位置的隐藏向量" }, { tone: "grey", label: "只在训练时存在：loss" }]} />
      <div className={`viz-narr ${ex.y === 1 ? "is-good" : "is-warn"}`} aria-live="polite">
        {ex.y === 1
          ? <>正例：B 在语料里确实紧跟着 A，标签 y = 1。模型预测 p(IsNext) = {ex.pIsNext.toFixed(2)}，loss = −ln {ex.pIsNext.toFixed(2)} ≈ {loss.toFixed(3)}。</>
          : <>负例：B 是随机取来的一句，和 A 不相邻，标签 y = 0。模型预测 p(IsNext) = {ex.pIsNext.toFixed(2)}，对的那一类是 NotNext，概率 1 − {ex.pIsNext.toFixed(2)} = {pTrue.toFixed(2)}，loss = −ln {pTrue.toFixed(2)} ≈ {loss.toFixed(3)}。</>}
        {" "}这个任务问的是「是否相邻」，不是「两句话意思像不像」。
      </div>
    </BahFrame>
  );
}

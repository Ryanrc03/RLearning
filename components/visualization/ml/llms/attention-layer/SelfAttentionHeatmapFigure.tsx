"use client";

import { useState } from "react";
import { A_SELF, LAYER_DIMS, SELF_TOKENS } from "@/lib/ml/attentionLayer";
import { BahFrame, Box, Legend, P, Sym } from "../bahdanau/shared";
import Heatmap from "./Heatmap";

const W = 700;
const H = 236;
const ID = "sah";
const BAR_X = 430;
const BAR_MAX = 110;
const ROW_Y = 60;
const ROW_H = 34;

export default function SelfAttentionHeatmapFigure() {
  const [j, setJ] = useState(2);
  const row = A_SELF[j];
  const max = Math.max(...row);
  const top = row.indexOf(max);
  const tops = SELF_TOKENS.filter((_, i) => row[i] === max);
  const tok = SELF_TOKENS[j];

  return (
    <BahFrame
      title="图 6 · Self-Attention 的权重：同一句话既是行也是列"
      description="The cat eats fish 的 4 个 token 同时当 Query（行）和 Key（列）。选一个 Query，看它对整句的权重和输出。"
      footnote={<>教学构造数据：权重是人为设定的，每行和为 1，不是由某组 W_Q、W_K、W_V 算出来的，也不代表这句话「正确」的语义对应。这里是不加 mask 的 Self-Attention，每个 Query 都能读全部位置，包括自己。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择 Query">
        {SELF_TOKENS.map((t, k) => (
          <button key={t} type="button" aria-pressed={j === k} className={`viz-btn${j === k ? " is-on" : ""}`} onClick={() => setJ(k)}>Query：{t}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>Self-Attention 权重矩阵</title>
          <desc id={`${ID}-desc`}>4 乘 4 的权重矩阵，行和列都是 The、cat、eats、fish。当前选中的 Query 是 {tok}，它对四个 token 的权重是 {row.join("、")}，输出是四个 Value 按这组权重的加权和。</desc>

          <text x={186} y={30} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>A：4 × 4，列是 Key</text>
          <Heatmap x={84} y={ROW_Y} cellW={52} cellH={ROW_H} weights={A_SELF} rowLabels={[...SELF_TOKENS]} colLabels={[...SELF_TOKENS]} selected={j} onSelect={setJ} />
          <text x={186} y={ROW_Y + 4 * ROW_H + 18} fontSize={8.5} textAnchor="middle" fill={P.sub}>行是 Query，每行和为 1</text>

          <text x={BAR_X + 60} y={30} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>Query「{tok}」这一行 × 四个 Value</text>
          {row.map((w, i) => {
            const mid = ROW_Y + i * ROW_H + ROW_H / 2;
            return (
              <g key={SELF_TOKENS[i]}>
                <text x={BAR_X - 8} y={mid + 4} fontSize={9.5} textAnchor="end" fill={P.ink}>{SELF_TOKENS[i]}</text>
                <rect x={BAR_X} y={mid - 9} width={BAR_MAX} height={18} rx={3} fill={P.surface} stroke={P.grey} strokeWidth={0.6} />
                <rect className="bah-bar" x={BAR_X} y={mid - 9} width={Math.round(w * BAR_MAX * 10) / 10} height={18} rx={3} fill={P.att} opacity={w === max ? 1 : 0.55} />
                <text x={BAR_X + BAR_MAX + 8} y={mid + 4} fontSize={10} fontWeight={w === max ? 700 : 400} fill={P.ink} className="mono">{w.toFixed(2)} ·</text>
                <Box x={BAR_X + BAR_MAX + 48} y={mid - 11} w={66} h={22} tone="enc" title={<Sym b="v" s={SELF_TOKENS[i]} />} size={10} />
              </g>
            );
          })}
          <Box x={BAR_X} y={ROW_Y + 4 * ROW_H + 6} w={224} h={32} tone="dyn" bold title={<><Sym b="c" s={tok} /> = Σ <Sym b="α" s="i" /> <Sym b="v" s="i" /></>} sub={`一个 ${LAYER_DIMS.self.dV} 维向量，不是词，也不是词表概率`} />
        </svg>
      </div>
      <Legend items={[{ tone: "att", label: "权重（格子越深越大，数字写在格子里）" }, { tone: "enc", label: "Value" }, { tone: "dyn", label: "输出 context" }]} />
      <div className="viz-narr" aria-live="polite">
        Query「<b>{tok}</b>」对整句的权重是 [{row.map((w) => w.toFixed(2)).join(", ")}]，{tops.length > 1 ? "并列最大的是" : "最大的是"}<b>{tops.map((t) => `「${t}」`).join("和")}</b>{tops.length === 1 && top === j ? "，也就是它自己" : ""}。输出 c<sub>{tok}</sub> = {row.map((w, i) => `${w.toFixed(2)}·v_${SELF_TOKENS[i]}`).join(" + ")}：整句四个 Value 的加权融合。
      </div>
    </BahFrame>
  );
}

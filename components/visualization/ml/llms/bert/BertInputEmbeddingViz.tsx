"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Pick = "none" | "dog" | "ing";

const TOKENS = ["[CLS]", "my", "dog", "is", "cute", "[SEP]", "he", "likes", "play", "##ing", "[SEP]"];
const SEG_B_FROM = 6; // the first [SEP] still belongs to sentence A
const C1 = "#2a78d6";
const C2 = "#eb6834";
const INK = "#30332c";
const LINE = "#76796f";
// Row colors: what the word is (yellow), which sentence (blue A / orange B), which position (green), the sum (ink).
const TOK_FILL = "#fbe7a1";
const TOK_TEXT = "#8a5f00";
const SEG_A_FILL = "#cfe0f7";
const SEG_B_FILL = "#f9d6c2";
const POS_FILL = "#c6ead9";
const POS_TEXT = "#15754f";
const SUM_FILL = "#3b4234";
const LABEL_W = 124;
const COL_W = 48;
const CELL_W = 42;
const W = LABEL_W + TOKENS.length * COL_W + 6;
const H = 240;
const ROW = { tok: 14, etok: 56, eseg: 96, epos: 136, sum: 180 };
const CELL_H = 24;

const PICK_COL: Record<Pick, number> = { none: -1, dog: 2, ing: 9 };

const NARR: Record<Pick, string> = {
  none: "一个位置的输入向量是三个查表结果逐位相加：这个词是谁（黄，token 嵌入）、它在 A 句还是 B 句（蓝 / 橙，段落嵌入）、它排第几（绿，位置嵌入）。点按钮看一个 A 句里的词和一个 B 句里的子词分别怎样拼出来。",
  dog: "位置 2 的 dog：x_2 = E_tok[dog] + E_seg[A] + E_pos[2]，三个向量都是 768 维，逐位相加后过 LayerNorm 和 dropout。这一步还没有任何上下文：换一句话，只要 dog 还在 A 句的位置 2，x_2 就完全一样。上下文要到编码器层里才加进来。",
  ing: "位置 9 的 ##ing：playing 不在 3 万词的词表里，WordPiece 把它切成 play 和 ##ing，前面的 ## 表示它紧接上一个片段。它在第一个 [SEP] 之后，所以段落嵌入取 B 那一行；x_9 = E_tok[##ing] + E_seg[B] + E_pos[9]。位置最多到 511，这就是 512 的长度上限。",
};

function colX(c: number) {
  return LABEL_W + c * COL_W;
}

function Cell({ c, y, fill, text, color, dim }: { c: number; y: number; fill: string; text: string; color: string; dim: boolean }) {
  return (
    <g transform={`translate(${colX(c)} ${y})`} opacity={dim ? 0.25 : 1}>
      <rect width={CELL_W} height={CELL_H} rx={4} fill={fill} />
      <text x={CELL_W / 2} y={CELL_H / 2 + 3.5} fontSize={text.length > 5 ? 7.5 : 9} fontWeight={600} textAnchor="middle" fill={color} className="mono">{text}</text>
    </g>
  );
}

function RowLabel({ y, title, sub, swatch, color }: { y: number; title: string; sub: string; swatch: string; color: string }) {
  return (
    <g>
      <rect x={8} y={y + 3} width={9} height={9} rx={2} fill={swatch} />
      <text x={22} y={y + 11} fontSize={9.5} fontWeight={600} fill={color}>{title}</text>
      <text x={8} y={y + 22} fontSize={8} fill={LINE}>{sub}</text>
    </g>
  );
}

export default function BertInputEmbeddingViz() {
  const [pick, setPick] = useState<Pick>("none");
  const col = PICK_COL[pick];
  const dim = (c: number) => col >= 0 && c !== col;
  const hiColor = col >= SEG_B_FROM ? C2 : C1;

  return (
    <VisualizationFrame
      title="输入：三个嵌入逐位相加"
      description="一对句子 my dog is cute / he likes playing 进 BERT 之前的样子。每一列是一个位置，自上而下是 token、三张查表、相加后的输入向量。"
      footnote={<>三张表都是学出来的参数：token 嵌入 30,522 × 768，段落嵌入 2 × 768，位置嵌入 512 × 768（BERT_BASE）。[CLS] 永远在位置 0；第一个 [SEP] 算在 A 句里。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${pick === "dog" ? " is-on" : ""}`} onClick={() => setPick("dog")}>看 A 句里的 dog</button>
        <button type="button" className={`viz-btn${pick === "ing" ? " is-on" : ""}`} onClick={() => setPick("ing")}>看 B 句里的 ##ing</button>
        <button type="button" className="viz-btn" onClick={() => setPick("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={NARR[pick]}>
          <RowLabel y={ROW.tok} title="token" sub="WordPiece 切分后" swatch="#fff" color="#3b4234" />
          <RowLabel y={ROW.etok} title="token 嵌入 E_tok" sub="30,522 × 768：这个词是谁" swatch={TOK_FILL} color={TOK_TEXT} />
          <RowLabel y={ROW.eseg} title="段落嵌入 E_seg" sub="2 × 768：A 句还是 B 句" swatch={SEG_A_FILL} color={C1} />
          <RowLabel y={ROW.epos} title="位置嵌入 E_pos" sub="512 × 768：排第几" swatch={POS_FILL} color={POS_TEXT} />
          <RowLabel y={ROW.sum} title="输入向量 x_i" sub="相加 → LayerNorm → dropout" swatch={SUM_FILL} color="#3b4234" />
          <text x={LABEL_W - 10} y={ROW.eseg - 9} fontSize={13} fontWeight={700} textAnchor="middle" fill={INK}>+</text>
          <text x={LABEL_W - 10} y={ROW.epos - 9} fontSize={13} fontWeight={700} textAnchor="middle" fill={INK}>+</text>
          <text x={LABEL_W - 10} y={ROW.sum - 11} fontSize={13} fontWeight={700} textAnchor="middle" fill={INK}>=</text>

          {TOKENS.map((t, c) => {
            const special = t === "[CLS]" || t === "[SEP]";
            const segB = c >= SEG_B_FROM;
            return (
              <g key={c}>
                <g transform={`translate(${colX(c)} ${ROW.tok})`} opacity={dim(c) ? 0.25 : 1}>
                  <rect width={CELL_W} height={CELL_H} rx={4} fill={special ? "#efede4" : "#fff"} stroke={special ? "#c9c4ad" : INK} strokeWidth={1.2} />
                  <text x={CELL_W / 2} y={CELL_H / 2 + 3.5} fontSize={t.length > 5 ? 7.5 : 9} fontWeight={600} textAnchor="middle" fill={special ? LINE : INK} className="mono">{t}</text>
                </g>
                <Cell c={c} y={ROW.etok} fill={TOK_FILL} text={t} color={TOK_TEXT} dim={dim(c)} />
                <Cell c={c} y={ROW.eseg} fill={segB ? SEG_B_FILL : SEG_A_FILL} text={segB ? "B" : "A"} color={segB ? "#9a3d12" : "#1a4f8f"} dim={dim(c)} />
                <Cell c={c} y={ROW.epos} fill={POS_FILL} text={`P${c}`} color={POS_TEXT} dim={dim(c)} />
                <Cell c={c} y={ROW.sum} fill={SUM_FILL} text={`x${c}`} color="#fff" dim={dim(c)} />
              </g>
            );
          })}

          {col >= 0 && <rect x={colX(col) - 4} y={ROW.tok - 5} width={CELL_W + 8} height={ROW.sum + CELL_H - ROW.tok + 10} rx={6} fill="none" stroke={hiColor} strokeWidth={2} />}

          {/* sentence spans */}
          <line x1={colX(0)} y1={ROW.sum + CELL_H + 12} x2={colX(SEG_B_FROM - 1) + CELL_W} y2={ROW.sum + CELL_H + 12} stroke={C1} strokeWidth={2.5} />
          <text x={(colX(0) + colX(SEG_B_FROM - 1) + CELL_W) / 2} y={ROW.sum + CELL_H + 26} fontSize={8.5} fontWeight={600} textAnchor="middle" fill={C1}>句子 A（含第一个 [SEP]）</text>
          <line x1={colX(SEG_B_FROM)} y1={ROW.sum + CELL_H + 12} x2={colX(TOKENS.length - 1) + CELL_W} y2={ROW.sum + CELL_H + 12} stroke={C2} strokeWidth={2.5} />
          <text x={(colX(SEG_B_FROM) + colX(TOKENS.length - 1) + CELL_W) / 2} y={ROW.sum + CELL_H + 26} fontSize={8.5} fontWeight={600} textAnchor="middle" fill={C2}>句子 B</text>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: TOK_FILL }} />这个词是谁</span>
        <span><i style={{ background: SEG_A_FILL }} />A 句</span>
        <span><i style={{ background: SEG_B_FILL }} />B 句</span>
        <span><i style={{ background: POS_FILL }} />排第几</span>
        <span><i style={{ background: SUM_FILL }} />相加后的 768 维向量</span>
      </div>
      <div className="viz-narr">{NARR[pick]}</div>
    </VisualizationFrame>
  );
}

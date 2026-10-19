"use client";

import Link from "next/link";
import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import {
  blockParams,
  CLIP_CONFIGS,
  CLIP_EXAMPLE_TOKENS,
  clipParams,
  eosIndex,
  gridSize,
  imageTokens,
  textParams,
  visionParams,
  type ClipVariant,
} from "@/lib/ml/clipArchitecture";

// CLIP's two towers, stage by stage, for ViT-B/32. Every shape and parameter
// count is computed from the config in lib/ml/clipArchitecture.ts.

type View = "image" | "text" | "block";
const C = CLIP_CONFIGS["ViT-B/32"];
const fmtM = (n: number) => `${(n / 1e6).toFixed(n < 1e7 ? 2 : 1)}M`;
const fmt = (n: number) => n.toLocaleString("en-US");

type Stage = { name: string; shape: string; text: string };

const g = gridSize(C);
const IMAGE_STAGES: Stage[] = [
  { name: "输入图片", shape: `${C.imageSize}×${C.imageSize}×3`, text: `先缩放、中心裁剪到 ${C.imageSize}×${C.imageSize}，按 CLIP 训练时的均值方差归一化 RGB。` },
  { name: "切 patch", shape: `${g * g} × ${3 * C.patch * C.patch}`, text: `按 ${C.patch}×${C.patch} 切成 ${g}×${g} = ${g * g} 块，每块 ${C.patch}×${C.patch}×3 = ${fmt(3 * C.patch * C.patch)} 个数。ViT-B/32 的「32」就是 patch 边长。` },
  { name: "Patch embedding", shape: `${g * g} × ${C.visionWidth}`, text: `一个 kernel ${C.patch}、stride ${C.patch} 的卷积（conv1，无 bias），等价于对每块用同一个 ${fmt(3 * C.patch * C.patch)}→${C.visionWidth} 的线性层，参数 ${fmt(3 * C.patch * C.patch * C.visionWidth)}。` },
  { name: "+[CLS] +位置", shape: `${imageTokens(C)} × ${C.visionWidth}`, text: `在最前面拼一个可学习的 [CLS] 向量，再加 ${imageTokens(C)} 个可学习的位置编码；CLIP 比原版 ViT 多一个 ln_pre（先做一次 LayerNorm）。` },
  { name: `${C.visionLayers} 个 block`, shape: `${imageTokens(C)} × ${C.visionWidth}`, text: `${C.visionLayers} 层 Transformer，每层 ${C.visionHeads} 个头、双向注意力（每个 patch 能看所有 patch）。形状不变，只是每个 token 都融合了全图的信息。` },
  { name: "取 [CLS] → proj", shape: `${C.embed}`, text: `只拿 [CLS] 那一个位置的输出，过 ln_post，再乘一个 ${C.visionWidth}×${C.embed} 的投影矩阵（无 bias），落进图文共享的 ${C.embed} 维空间。` },
  { name: "L2 归一化", shape: `${C.embed}，‖u‖ = 1`, text: "除以自己的长度。之后图和文的点积就是余弦相似度，这张图只剩这一个向量。" },
];
const eos = eosIndex(CLIP_EXAMPLE_TOKENS);
const TEXT_STAGES: Stage[] = [
  { name: "一句话", shape: "\"a photo of a cat\"", text: "zero-shot 分类常用的 prompt 模板就是 \"a photo of a {类别}\"。" },
  { name: "BPE 分词", shape: `${C.context} 个位置`, text: `小写化后做 byte-level BPE（词表 ${fmt(C.vocab)}），前后加 [SOS]、[EOS]，再补零到固定长度 ${C.context}。这句话只占 ${CLIP_EXAMPLE_TOKENS.length} 个位置，其余 ${C.context - CLIP_EXAMPLE_TOKENS.length} 个是 padding。` },
  { name: "Token + 位置", shape: `${C.context} × ${C.textWidth}`, text: `查 ${fmt(C.vocab)}×${C.textWidth} 的词嵌入表（${fmtM(C.vocab * C.textWidth)} 参数，占文本塔的四成），加 ${C.context} 个可学习位置编码。` },
  { name: `${C.textLayers} 个 block`, shape: `${C.context} × ${C.textWidth}`, text: `${C.textLayers} 层、宽 ${C.textWidth}、${C.textHeads} 个头，带 causal mask：每个 token 只能看它左边的。论文说这样做是为了保留以后接语言模型目标的可能。` },
  { name: "取 [EOS] → proj", shape: `${C.embed}`, text: `causal mask 下只有最后一个 token 看过整句，所以取 [EOS]（这里第 ${eos} 位）的输出当整句的表示，过 ln_final，乘 ${C.textWidth}×${C.embed} 的 text_projection。` },
  { name: "L2 归一化", shape: `${C.embed}，‖t‖ = 1`, text: "和图像向量同一个空间、同一个长度。之后乘上可学习的 logit_scale = 1/τ（初始 1/0.07 ≈ 14.3，上限 100）得到 logits。" },
];

const BLOCK_PARTS = [
  { key: "ln_1", label: "ln_1", note: "LayerNorm（pre-LN：先归一化再进子层）" },
  { key: "in_proj", label: "attn.in_proj", note: "一次算出 Q、K、V：d → 3d" },
  { key: "out_proj", label: "attn.out_proj", note: "多头拼回去后再投影：d → d", lora: true },
  { key: "ln_2", label: "ln_2", note: "LayerNorm" },
  { key: "c_fc", label: "mlp.c_fc", note: "升维 d → 4d，接 QuickGELU", lora: true },
  { key: "c_proj", label: "mlp.c_proj", note: "降维 4d → d", lora: true },
] as const;

function Pipeline({ stages, at, onPick, kind }: { stages: Stage[]; at: number; onPick: (i: number) => void; kind: "image" | "text" }) {
  const n = stages.length;
  const W = 720;
  const gap = 8;
  const bw = (W - 16 - gap * (n - 1)) / n;
  return (
    <Figure width={W} height={150} label={`${kind === "image" ? "图像塔" : "文本塔"}第 ${at + 1} 步：${stages[at].name}`} minWidth={620}>
      {stages.map((s, i) => {
        const x = 8 + i * (bw + gap);
        const on = i === at;
        const past = i < at;
        return (
          <g key={s.name} onClick={() => onPick(i)} style={{ cursor: "pointer" }}>
            <rect x={x} y={34} width={bw} height={78} rx={8} fill={on ? (kind === "image" ? "#e3eefb" : "#e5f6ee") : past ? "#f6f4ec" : "#fff"} stroke={on ? (kind === "image" ? "var(--v1)" : "var(--v3)") : "#d9d3bb"} strokeWidth={on ? 2 : 1} style={{ transition: "fill .25s" }} />
            <text x={x + bw / 2} y={52} fontSize={11.5} fontWeight={600} textAnchor="middle" fill="#30332c">{s.name}</text>
            {kind === "image" && i === 1 ? (
              <g>
                {Array.from({ length: g * g }, (_, k) => (
                  <rect key={k} x={x + bw / 2 - 21 + (k % g) * 6} y={62 + Math.floor(k / g) * 6} width={5} height={5} fill={on ? "var(--v1)" : "#cfcab4"} opacity={0.75} />
                ))}
              </g>
            ) : (
              <text x={x + bw / 2} y={80} fontSize={10.5} textAnchor="middle" fill="#76796f" className="mono">{s.shape.length > 16 ? s.shape.slice(0, 15) + "…" : s.shape}</text>
            )}
            <text x={x + bw / 2} y={104} fontSize={10} textAnchor="middle" fill="#9a9781">{i + 1}</text>
            {i < n - 1 && <path d={`M${x + bw + 1},73 L${x + bw + gap - 1},73`} stroke="#9a9781" strokeWidth={1.4} />}
          </g>
        );
      })}
      <text x={8} y={18} fontSize={12} fontWeight={600} fill="#30332c">{kind === "image" ? `图像塔 · ViT-B/32 · 参数 ${fmtM(visionParams(C).total)}` : `文本塔 · Transformer · 参数 ${fmtM(textParams(C).total)}`}</text>
      <text x={712} y={18} fontSize={11} textAnchor="end" fill="#76796f">点一格跳到那一步</text>
      <text x={8} y={140} fontSize={11} fill="#76796f">形状：{stages[at].shape}</text>
    </Figure>
  );
}

export default function ClipArchitecture() {
  const [view, setView] = useState<View>("image");
  const [imgAt, setImgAt] = useState(0);
  const [txtAt, setTxtAt] = useState(0);
  const [width, setWidth] = useState<"vision" | "text">("vision");
  const stages = view === "image" ? IMAGE_STAGES : TEXT_STAGES;
  const at = view === "image" ? imgAt : txtAt;
  const setAt = view === "image" ? setImgAt : setTxtAt;
  const d = width === "vision" ? C.visionWidth : C.textWidth;
  const bp = blockParams(d);
  const loraSum = bp.out_proj + bp.c_fc + bp.c_proj;

  return (
    <VisualizationFrame
      title="CLIP 的结构：两座互不相通的塔，只在最后点积时见面"
      description="以 ViT-B/32 为例。图像塔把一张图压成一个 512 维向量，文本塔把一句话压成一个 512 维向量，两边在编码过程中从不交换信息。切换三个视角，逐步看形状怎么变。"
      footnote="形状和参数量都由配置算出来（lib/ml/clipArchitecture.ts，有单元测试）：ViT-B/32 图像塔 87.8M、文本塔 63.4M，加 logit_scale 一共 151,277,313 个参数。"
    >
      <Tabs options={[{ key: "image", label: "图像塔" }, { key: "text", label: "文本塔" }, { key: "block", label: "一个 block 里" }]} value={view} onChange={setView} ariaLabel="视角" />
      {view !== "block" ? (
        <>
          <Pipeline stages={stages} at={at} onPick={setAt} kind={view} />
          <div className="viz-row" style={{ gap: 8, marginTop: 4 }}>
            <button type="button" className="viz-btn" disabled={at === 0} onClick={() => setAt(at - 1)}>上一步</button>
            <button type="button" className="viz-btn primary" disabled={at === stages.length - 1} onClick={() => setAt(at + 1)}>下一步</button>
            <span className="viz-k">第 {at + 1} / {stages.length} 步</span>
          </div>
          {view === "text" && at >= 1 && (
            <div className="viz-chips" style={{ marginTop: 10 }} aria-label="token 序列">
              {CLIP_EXAMPLE_TOKENS.map((t, i) => (
                <span key={i} className={`viz-chip mono${at >= 4 && i === eos ? " is-on" : ""}`}>{i}: {t}</span>
              ))}
              <span className="viz-chip mono" style={{ opacity: 0.55 }}>7 … 76: [PAD]</span>
            </div>
          )}
          <div className="viz-narr">{stages[at].text}</div>
        </>
      ) : (
        <>
          <div className="viz-chips" role="group" aria-label="宽度" style={{ marginTop: 10 }}>
            <button type="button" className={`viz-chip${width === "vision" ? " is-on" : ""}`} onClick={() => setWidth("vision")}>图像塔的 block（d = {C.visionWidth}）</button>
            <button type="button" className={`viz-chip${width === "text" ? " is-on" : ""}`} onClick={() => setWidth("text")}>文本塔的 block（d = {C.textWidth}）</button>
          </div>
          <Figure width={720} height={168} label="一个 residual block 的结构" minWidth={620}>
            <text x={8} y={18} fontSize={12} fontWeight={600} fill="#30332c">x ← x + attn(ln_1(x))；x ← x + mlp(ln_2(x))</text>
            {BLOCK_PARTS.map((p, i) => {
              const x = 8 + i * 118;
              const lora = "lora" in p && p.lora;
              return (
                <g key={p.key}>
                  <rect x={x} y={40} width={108} height={70} rx={8} fill={lora ? "#fde3d6" : "#f1efe6"} stroke={lora ? "var(--v2)" : "#cfcab4"} strokeWidth={lora ? 1.6 : 1} />
                  <text x={x + 54} y={62} fontSize={11.5} fontWeight={600} textAnchor="middle" fill="#30332c" className="mono">{p.label}</text>
                  <text x={x + 54} y={82} fontSize={11} textAnchor="middle" fill="#30332c" className="mono">{fmt(bp[p.key])}</text>
                  <text x={x + 54} y={99} fontSize={10} textAnchor="middle" fill="#76796f">参数</text>
                  {i < BLOCK_PARTS.length - 1 && <path d={`M${x + 108},75 L${x + 118},75`} stroke="#9a9781" strokeWidth={1.4} />}
                </g>
              );
            })}
            <path d="M62,124 C62,146 290,146 362,124" fill="none" stroke="#9a9781" strokeDasharray="4 3" />
            <text x={212} y={160} fontSize={10.5} textAnchor="middle" fill="#76796f">residual：跳过 attention 加回来</text>
            <path d="M362,124 C362,146 600,146 656,124" fill="none" stroke="#9a9781" strokeDasharray="4 3" />
            <text x={510} y={160} fontSize={10.5} textAnchor="middle" fill="#76796f">residual：跳过 MLP 加回来</text>
          </Figure>
          <table className="viz-table">
            <tbody>
              {BLOCK_PARTS.map((p) => (
                <tr key={p.key}>
                  <td className="mono">{p.label}</td>
                  <td>{p.note}</td>
                  <td className="num">{fmt(bp[p.key])}</td>
                </tr>
              ))}
              <tr><td><b>一个 block</b></td><td>× {width === "vision" ? C.visionLayers : C.textLayers} 层</td><td className="num"><b>{fmt(bp.total)}</b></td></tr>
            </tbody>
          </table>
          <div className="viz-narr">
            橙色三块（out_proj、c_fc、c_proj）是 <Link href="/notes/ml/multimodal/multisticker-project/">MultiSticker</Link> 加 LoRA 的位置，占这个 block 参数的 {((loraSum / bp.total) * 100).toFixed(0)}%。MLP 的两层就占了 {(((bp.c_fc + bp.c_proj) / bp.total) * 100).toFixed(0)}%：Transformer 的参数大头在 MLP，不在 attention。
          </div>
        </>
      )}
      <table className="viz-table" style={{ marginTop: 12 }}>
        <thead>
          <tr><th>型号</th><th className="num">图像 token</th><th className="num">图像塔 宽 × 层</th><th className="num">文本塔 宽 × 层</th><th className="num">共享空间</th><th className="num">总参数</th></tr>
        </thead>
        <tbody>
          {(Object.keys(CLIP_CONFIGS) as ClipVariant[]).map((v) => {
            const c = CLIP_CONFIGS[v];
            return (
              <tr key={v}>
                <td>{v}</td>
                <td className="num">{imageTokens(c)}</td>
                <td className="num">{c.visionWidth} × {c.visionLayers}</td>
                <td className="num">{c.textWidth} × {c.textLayers}</td>
                <td className="num">{c.embed}</td>
                <td className="num">{fmtM(clipParams(c))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </VisualizationFrame>
  );
}

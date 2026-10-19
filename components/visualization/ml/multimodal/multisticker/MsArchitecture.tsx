"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { MS_EPOCH_SECONDS, MS_METHOD_INFO, MS_METHODS, MS_RESULTS, trainableParams, type MsMethod } from "@/lib/ml/multisticker";

// IntentGuidedRetriever and the two CLIP towers. Each tab lights up what that
// experiment trains; the panel underneath gives the trainable parameter count
// (computed), the logged seconds per epoch and the final Exact R@30.

const W = 720;
const H = 336;
const INK = "#30332c";
const MUTED = "#76796f";
const FROZEN = "#f1efe6";
const TRAIN = "#fde3d6";
const TRAIN_LINE = "var(--v2)";

type BoxProps = { x: number; y: number; w: number; h: number; title: string; sub?: string; on?: boolean; dim?: boolean; tag?: string };
function Box({ x, y, w, h, title, sub, on, dim, tag }: BoxProps) {
  return (
    <g opacity={dim ? 0.3 : 1} style={{ transition: "opacity .3s" }}>
      <rect x={x} y={y} width={w} height={h} rx={7} fill={on ? TRAIN : FROZEN} stroke={on ? TRAIN_LINE : "#cfcab4"} strokeWidth={on ? 1.8 : 1} style={{ transition: "fill .3s, stroke .3s" }} />
      <text x={x + w / 2} y={y + h / 2 - (sub ? 5 : -4)} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK}>{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 11} fontSize={10.5} textAnchor="middle" fill={MUTED}>{sub}</text>}
      {tag && (
        <g>
          <rect x={x + w - 46} y={y - 9} width={44} height={17} rx={8} fill="var(--v2)" />
          <text x={x + w - 24} y={y + 3} fontSize={10.5} fontWeight={700} textAnchor="middle" fill="#fff">{tag}</text>
        </g>
      )}
    </g>
  );
}

function Arrow({ d, dim }: { d: string; dim?: boolean }) {
  return <path d={d} fill="none" stroke="#9a9781" strokeWidth={1.4} markerEnd="url(#ms-arrow)" opacity={dim ? 0.25 : 1} />;
}

const NARR: Record<MsMethod, string> = {
  direct_clip: "基线：不训练任何东西，只拿上下文文本过 CLIP text encoder，直接和每张贴纸的 CLIP 图像向量算余弦相似度排序。记忆和意图都用不上。它能找到语义相关的贴纸（Group R@30 = 95.9%），但精确那一张几乎找不到（Exact R@30 = 0.28%）。",
  head_only: "两个 CLIP 编码器都冻结，文本和图像向量预先算好缓存，只训练 retriever 头（三路拼接 → MLP → 投影回图像空间）和意图分类头。每个 epoch 只要 2.6 秒，却已经拿到 Exact R@30 = 12.6%。",
  image_lora: "在图像编码器每层的 out_proj、c_fc、c_proj 上加 r = 8 的 LoRA，让贴纸的向量也能动。代价是每一步都要把这一批答案贴纸（动图最多抽 4 帧）重新过一遍图像编码器，每个 epoch 约 3 小时。它的 Exact R@5 和 MRR 最高。",
  text_lora: "LoRA 加在文本编码器上，三路文本每步都要重新编码，但贴纸库可以缓存，所以一个 epoch 只要 105 秒。",
  dual_lora: "文本、图像两侧都加 LoRA，可训练参数最多，Exact R@30 最高（13.15%），Group R@5 也最高，是最适合做「贴纸面板」的折中方案；代价和 image_lora 一样贵。",
};

export default function MsArchitecture() {
  const [mode, setMode] = useState<MsMethod>("head_only");
  const [grad, setGrad] = useState(false);
  const head = mode !== "direct_clip";
  const textLora = mode === "text_lora" || mode === "dual_lora";
  const imageLora = mode === "image_lora" || mode === "dual_lora";
  const params = trainableParams(mode);
  const secs = mode === "direct_clip" ? null : MS_EPOCH_SECONDS[mode];
  const secText = secs === null ? "—（不训练）" : secs < 60 ? `${secs.toFixed(1)} 秒` : secs < 3600 ? `${(secs / 60).toFixed(1)} 分钟` : `${(secs / 3600).toFixed(1)} 小时`;

  return (
    <VisualizationFrame
      title="模型：IntentGuidedRetriever 和两座 CLIP 塔"
      description="上半是 query 侧，下半是贴纸侧，最后在同一个 512 维空间里做点积排序。切换五种实验，看哪些部分在训练（橙色）。"
      footnote="OpenCLIP ViT-B-32（laion2b_s34b_b79k）；LoRA r = 8、α = 16、dropout 0.05，lr 1e-4；头的 lr 1e-3；τ = 0.07。参数量里没算意图分类头的最后一层（512 × 意图组数）。"
    >
      <div className="viz-row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Tabs options={MS_METHODS.map((m) => ({ key: m, label: MS_METHOD_INFO[m].short }))} value={mode} onChange={setMode} ariaLabel="实验" />
        <label className="viz-check">
          <input type="checkbox" checked={grad} onChange={(e) => setGrad(e.target.checked)} />
          显示反向传播（梯度流到哪）
        </label>
      </div>
      <Figure width={W} height={H} label={`${mode} 的可训练部分`} minWidth={620}>
        <defs>
          <marker id="ms-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#9a9781" />
          </marker>
          <marker id="ms-grad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#d03b3b" />
          </marker>
        </defs>
        <text x={14} y={20} fontSize={11} fill={MUTED} fontWeight={600}>QUERY 侧</text>
        <text x={14} y={210} fontSize={11} fill={MUTED} fontWeight={600}>贴纸侧</text>

        <Box x={14} y={30} w={118} h={34} title="context_text" />
        <Box x={14} y={74} w={118} h={34} title="memory_text" dim={!head} />
        <Box x={14} y={118} w={118} h={34} title="intent_text" dim={!head} />
        <Box x={168} y={30} w={128} h={122} title="CLIP text" sub="12 层 · 宽 512" on={textLora} tag={textLora ? "LoRA" : undefined} />
        <Arrow d="M132,47 L166,60" />
        <Arrow d="M132,91 L166,91" dim={!head} />
        <Arrow d="M132,135 L166,122" dim={!head} />

        <Box x={330} y={58} w={78} h={66} title="拼接" sub="1536 维" dim={!head} />
        <Arrow d="M296,91 L328,91" dim={!head} />
        <Box x={440} y={44} w={128} h={94} title="Retriever 头" sub="MLP · 1536 → 512" on={head} dim={!head} />
        <Arrow d="M408,91 L438,91" dim={!head} />
        <Box x={600} y={30} w={108} h={44} title="意图分类" sub="CE × 0.2" on={head} dim={!head} />
        <Arrow d="M568,72 L598,56" dim={!head} />

        <Box x={14} y={222} w={118} h={30} title="png 静态图" />
        <Box x={14} y={258} w={118} h={30} title="gif 动图" sub="" />
        <Box x={14} y={294} w={118} h={30} title="webm 视频贴纸" />
        <Box x={168} y={222} w={128} h={102} title="CLIP image" sub="ViT · 12 层 · 宽 768" on={imageLora} tag={imageLora ? "LoRA" : undefined} />
        <Arrow d="M132,237 L166,250" />
        <Arrow d="M132,273 L166,273" />
        <Arrow d="M132,309 L166,296" />
        <Box x={330} y={246} w={110} h={54} title="逐帧编码" sub="帧向量取平均" />
        <Arrow d="M296,273 L328,273" />
        <Box x={470} y={240} w={110} h={66} title="贴纸库 S" sub="6,758 × 512" />
        <Arrow d="M440,273 L468,273" />

        <Box x={600} y={150} w={108} h={62} title="q · Sᵀ / τ" sub="→ softmax CE" />
        <Arrow d={head ? "M568,112 C590,120 600,140 640,148" : "M296,60 C470,10 640,40 650,148"} />
        <Arrow d="M580,273 C620,270 650,250 654,214" />
        {grad && head && (
          <g aria-label="梯度路径">
            <path d="M600,170 C580,150 575,135 568,120" fill="none" stroke="var(--vcrit)" strokeWidth={2.4} strokeDasharray="6 4" markerEnd="url(#ms-grad)" />
            <text x={588} y={142} fontSize={10.5} fill="var(--vcrit)" fontWeight={700} textAnchor="end">∂L/∂头</text>
            {textLora && (
              <>
                <path d="M440,104 C400,120 330,140 296,128" fill="none" stroke="var(--vcrit)" strokeWidth={2.4} strokeDasharray="6 4" markerEnd="url(#ms-grad)" />
                <text x={368} y={172} fontSize={10.5} fill="var(--vcrit)" fontWeight={700} textAnchor="middle">三路文本的梯度在同一套 LoRA 上相加</text>
              </>
            )}
            {imageLora && (
              <>
                <path d="M640,212 C640,240 600,250 580,262" fill="none" stroke="var(--vcrit)" strokeWidth={2.4} strokeDasharray="6 4" markerEnd="url(#ms-grad)" />
                <path d="M470,262 C420,240 330,232 296,240" fill="none" stroke="var(--vcrit)" strokeWidth={2.4} strokeDasharray="6 4" markerEnd="url(#ms-grad)" />
                <text x={384} y={228} fontSize={10.5} fill="var(--vcrit)" fontWeight={700} textAnchor="middle">只经过这一批的答案贴纸</text>
              </>
            )}
          </g>
        )}
      </Figure>
      <div className="ms-arch-legend">
        <span><i style={{ background: TRAIN, border: "1px solid var(--v2)" }} />这次训练的部分</span>
        <span><i style={{ background: FROZEN, border: "1px solid #cfcab4" }} />冻结 / 不参与</span>
        {grad && <span><i style={{ background: "var(--vcrit)" }} />反向传播的梯度</span>}
      </div>
      <div className="viz-stat" style={{ marginTop: 10 }}>
        <div><small>可训练参数</small>{params === 0 ? "0" : `${(params / 1e6).toFixed(2)} M`}</div>
        <div><small>每个 epoch</small>{secText}</div>
        <div><small>Exact R@30</small>{(MS_RESULTS[mode].r30 * 100).toFixed(2)}%</div>
        <div><small>Group R@30</small>{(MS_RESULTS[mode].g30 * 100).toFixed(1)}%</div>
      </div>
      <div className="viz-narr">{NARR[mode]}</div>
    </VisualizationFrame>
  );
}

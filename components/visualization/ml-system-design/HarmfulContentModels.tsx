"use client";

import { useState } from "react";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { bce, viewWeight } from "@/lib/ml/calibration";
import { Arrow, Axes, Box, Legend, linePath, Markers, MsdFrame, P, plotFrame } from "./kit";

// Modeling figures of the Harmful Content Detection case study: three model
// generations, the multi-task heads, and the view-weighted loss.

const ROWS = [16, 80, 144];

// ---------- 4.1 independent classifiers ----------

const SCENARIOS: { key: string; label: string; scores: number[]; truth: boolean; text: string }[] = [
  { key: "image", label: "图片本身违规", scores: [0.2, 0.91, 0.35], truth: true, text: "图片分类器给了 0.91，取最大值之后整条帖子的分数就是 0.91，判为 Harmful。任何一个模态足够确定时，这个结构都能抓住。" },
  { key: "cross", label: "图文合起来才违规", scores: [0.3, 0.25, 0.2], truth: true, text: "一张单看正常的照片，配一句单看无害的话，合在一起是针对某个人的攻击。三个分类器各看各的，谁都不确定，最大值只有 0.30，漏掉了。信息在模态之间的关系里，而没有任何一个模型同时看到两边。" },
  { key: "behavior", label: "只有行为异常", scores: [0.15, 0.1, 0.88], truth: true, text: "内容分类器没看出问题，但举报率异常高，行为分类器给了 0.88。行为信号能补上内容模型的盲区，代价是它要等曝光发生之后才有。" },
];

const INPUTS = ["Text", "Images", "Behavior"];
const NAMES = ["text", "image", "behavior"];

export function IndependentClassifiersFigure() {
  const [idx, setIdx] = useState(0);
  const sc = SCENARIOS[idx];
  const max = Math.max(...sc.scores);
  const arg = sc.scores.indexOf(max);
  const harmful = max >= 0.5;
  const ID = "ind";

  return (
    <MsdFrame
      title="图 4 · 第一代：三个独立分类器，取最大分"
      description="每个模态一个分类器，互不相干。选一个场景，看最大值是从哪一路来的。"
      footnote={<>分数是示意值，判定阈值取 0.5。三个场景里的帖子实际上都有害。</>}
    >
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="选择场景">
          {SCENARIOS.map((s, i) => (
            <button key={s.key} type="button" className={`viz-chip${idx === i ? " is-on" : ""}`} aria-pressed={idx === i} onClick={() => setIdx(i)}>{s.label}</button>
          ))}
        </div>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 700 200" role="img" aria-label={`三个独立分类器的分数 ${sc.scores.join("、")}，取最大值 ${max}，判为 ${harmful ? "Harmful" : "Benign"}`} style={{ minWidth: 620 }}>
          <Markers id={ID} />
          {ROWS.map((y, i) => (
            <g key={i}>
              <Box x={14} y={y} w={104} h={40} tone="neu" title={INPUTS[i]} />
              <Arrow id={ID} tone="neu" d={`M120 ${y + 20} H147`} />
              <Box x={150} y={y} w={150} h={40} tone="enc" title={`${INPUTS[i].replace(/s$/, "")} Classifier`} bold={i === arg} />
              <Arrow id={ID} tone="enc" d={`M302 ${y + 20} H333`} />
              <Box x={336} y={y} w={96} h={40} tone="dyn" title={<>s<tspan fontSize="0.72em" dy={3}>{NAMES[i]}</tspan><tspan dy={-3}> = {sc.scores[i].toFixed(2)}</tspan></>} bold={i === arg} dim={i !== arg} />
              <Arrow id={ID} tone="dyn" d={i === 1 ? "M434 100 H467" : `M434 ${y + 20} C452 ${y + 20} 452 100 467 100`} bold={i === arg} dim={i !== arg} />
            </g>
          ))}
          <Box x={470} y={80} w={84} h={40} tone="dec" title="Max Score" />
          <Arrow id={ID} tone="dec" d="M556 100 H587" />
          <Box x={590} y={76} w={98} h={48} tone={harmful ? "dec" : "par"} title={harmful ? "Harmful" : "Benign"} sub={`s = ${max.toFixed(2)}`} bold />
        </svg>
      </div>
      <Legend items={[{ tone: "neu", label: "输入" }, { tone: "enc", label: "分类器" }, { tone: "dyn", label: "各自的分数" }, { tone: "dec", label: "取最大值与判定" }]} />
      <div className={`viz-narr${harmful === sc.truth ? " is-good" : " is-bad"}`} aria-live="polite">{sc.text}</div>
    </MsdFrame>
  );
}

// ---------- 4.2 late fusion ----------

type FusionFocus = "encode" | "fuse" | null;

export function LateFusionFigure() {
  const [focus, setFocus] = useState<FusionFocus>(null);
  const dimEnc = focus === "fuse";
  const dimFuse = focus === "encode";
  const ID = "lf";
  return (
    <MsdFrame
      title="图 5 · 第二代：Late Fusion，先各自编码，再拼接"
      description="每个模态先压成一个向量，拼起来交给 MLP。两个按钮分别强调编码阶段和融合阶段。"
    >
      <div className="viz-controls" role="group" aria-label="强调一个阶段">
        <button type="button" className={`viz-btn${focus === "encode" ? " is-on" : ""}`} aria-pressed={focus === "encode"} onClick={() => setFocus("encode")}>各自编码</button>
        <button type="button" className={`viz-btn${focus === "fuse" ? " is-on" : ""}`} aria-pressed={focus === "fuse"} onClick={() => setFocus("fuse")}>拼接之后</button>
        <button type="button" className="viz-btn" onClick={() => setFocus(null)}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 700 232" role="img" aria-label="Late Fusion：图片经 Image Encoder 和 Average Pooling，文本经 Text Encoder，行为与作者特征直接进入，三路向量拼接后经过 MLP 和 Classification Head" style={{ minWidth: 640 }}>
          <Markers id={ID} />
          <Box x={14} y={20} w={110} h={40} tone="neu" title="Images" sub="一条帖子可有多张" dim={dimEnc} />
          <Arrow id={ID} tone="neu" d="M126 40 H147" dim={dimEnc} />
          <Box x={150} y={20} w={116} h={40} tone="enc" title="Image Encoder" dim={dimEnc} bold={focus === "encode"} />
          <Arrow id={ID} tone="enc" d="M268 40 H289" dim={dimEnc} />
          <Box x={292} y={20} w={116} h={40} tone="enc" title="Average Pooling" sub="多张图 → 一个向量" dim={dimEnc} />
          <Arrow id={ID} tone="dyn" d="M410 40 H437" dim={dimEnc} />
          <text x={424} y={33} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={dimEnc ? 0.3 : 1}>e_image</text>

          <Box x={14} y={96} w={110} h={40} tone="neu" title="Text" dim={dimEnc} />
          <Arrow id={ID} tone="neu" d="M126 116 H147" dim={dimEnc} />
          <Box x={150} y={96} w={116} h={40} tone="enc" title="Text Encoder" dim={dimEnc} bold={focus === "encode"} />
          <Arrow id={ID} tone="dyn" d="M268 116 H437" dim={dimEnc} />
          <text x={352} y={109} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={dimEnc ? 0.3 : 1}>e_text</text>

          <Box x={14} y={172} w={252} h={40} tone="neu" title="Behavior & Creator Features" dim={dimEnc} />
          <Arrow id={ID} tone="dyn" d="M268 192 H437" dim={dimEnc} />
          <text x={352} y={185} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={dimEnc ? 0.3 : 1}>x_behavior，x_creator</text>

          <Box x={440} y={20} w={58} h={192} tone="dyn" title="Concat" sub="h" dim={dimFuse} bold={focus === "fuse"} />
          <Arrow id={ID} tone="dyn" d="M500 116 H521" dim={dimFuse} />
          <Box x={524} y={96} w={70} h={40} tone="enc" title="MLP" dim={dimFuse} bold={focus === "fuse"} />
          <Arrow id={ID} tone="enc" d="M596 116 H617" dim={dimFuse} />
          <Box x={620} y={96} w={68} h={40} tone="dec" title="Head" sub="σ → p" dim={dimFuse} />
        </svg>
      </div>
      <Legend items={[{ tone: "neu", label: "原始输入" }, { tone: "enc", label: "encoder 与 MLP" }, { tone: "dyn", label: "向量" }, { tone: "dec", label: "Classification Head" }]} />
      <div className={`viz-narr${focus === "encode" ? " is-warn" : focus === "fuse" ? " is-good" : ""}`} aria-live="polite">
        {focus === "encode"
          ? "编码阶段两个 encoder 互相看不见。Image Encoder 把整张图压成一个向量时，并不知道配的文字是什么，所以不知道图里哪个区域才是关键；多张图再做一次平均，细节进一步被抹掉。等到拼接时，「图里这个物体」和「文字里这个词」之间的细粒度关系已经不在向量里了。"
          : focus === "fuse"
            ? "拼接之后，MLP 的每个神经元都能同时读到图像、文本、行为和作者四部分的维度，于是可以学到「图像向量偏向某个方向，同时举报率高」这种跨特征的组合。相比取最大值，它把「合起来才违规」的一部分情况救了回来。"
            : "和第一代相比，变化只有一处：不再让每个模态各出一个分数，而是各出一个向量，拼成 h 之后由同一个 MLP 做判断。跨模态的交互发生在拼接之后，所以叫 late fusion。"}
      </div>
    </MsdFrame>
  );
}

// ---------- 4.3 multimodal transformer ----------

type MmtFocus = "attn" | "cache" | null;
const TOK_Y = [72, 100, 128];

export function MultimodalTransformerFigure() {
  const [focus, setFocus] = useState<MmtFocus>(null);
  const dimA = focus === "cache";
  const dimC = focus === "attn";
  const ID = "mmt";
  return (
    <MsdFrame
      title="图 6 · 第三代：Multi-modal Transformer"
      description="图片和文本都切成 token，放进同一个 Transformer。两个按钮分别强调 token 级交互，以及缓存与实时特征的分工。"
    >
      <div className="viz-controls" role="group" aria-label="强调一个部分">
        <button type="button" className={`viz-btn${focus === "attn" ? " is-on" : ""}`} aria-pressed={focus === "attn"} onClick={() => setFocus("attn")}>Token 级交互</button>
        <button type="button" className={`viz-btn${focus === "cache" ? " is-on" : ""}`} aria-pressed={focus === "cache"} onClick={() => setFocus("cache")}>缓存与实时特征</button>
        <button type="button" className="viz-btn" onClick={() => setFocus(null)}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 700 244" role="img" aria-label="Multi-modal Transformer：Image Tokens 和 Text Tokens 进入同一个 Transformer，得到可缓存的 Content Embedding，再和实时的 Behavioral Features 一起进入 MLP 和 Classification Heads" style={{ minWidth: 640 }}>
          <Markers id={ID} />
          <Box x={14} y={36} w={112} h={40} tone="dyn" title="Image Tokens" sub="patch embeddings" dim={dimA} />
          <Box x={14} y={116} w={112} h={40} tone="dyn" title="Text Tokens" sub="token embeddings" dim={dimA} />
          <Arrow id={ID} tone="dyn" d="M128 56 H157" dim={dimA} />
          <Arrow id={ID} tone="dyn" d="M128 136 H157" dim={dimA} />

          <g opacity={dimA ? 0.28 : 1} className="bah-fade">
            <rect x={160} y={20} width={190} height={152} rx={8} fill={P.encFill} stroke={P.enc} strokeWidth={focus === "attn" ? 2.4 : 1.4} />
            <text x={255} y={40} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={P.ink}>Multimodal Transformer</text>
            {TOK_Y.map((a) => TOK_Y.map((b) => <line key={`${a}-${b}`} x1={206} y1={a} x2={304} y2={b} stroke={P.att} strokeWidth={focus === "attn" ? 1.6 : 1} opacity={0.85} />))}
            {TOK_Y.map((y) => (
              <g key={y}>
                <rect x={192} y={y - 7} width={14} height={14} rx={3} fill={P.dynFill} stroke={P.dyn} strokeWidth={1.2} />
                <rect x={304} y={y - 7} width={14} height={14} rx={3} fill={P.dynFill} stroke={P.dyn} strokeWidth={1.2} />
              </g>
            ))}
            <text x={199} y={150} fontSize={8.5} textAnchor="middle" fill={P.sub}>image</text>
            <text x={311} y={150} fontSize={8.5} textAnchor="middle" fill={P.sub}>text</text>
            <text x={255} y={165} fontSize={8.5} textAnchor="middle" fill={P.sub}>Self-Attention：所有 token 互相可见</text>
          </g>

          <Arrow id={ID} tone="dyn" d="M352 96 H377" dim={dimC} />
          <g opacity={dimC ? 0.28 : 1} className="bah-fade">
            <rect x={373} y={64} width={118} height={64} rx={8} fill="none" stroke={P.par} strokeWidth={1.3} strokeDasharray="4 3" />
            <text x={432} y={58} fontSize={8.5} textAnchor="middle" fill={P.par} fontWeight={600}>按 post id 缓存</text>
          </g>
          <Box x={380} y={76} w={104} h={40} tone="dyn" title="Content Embedding" sub="内容不变就不用重算" size={9.5} dim={dimC} bold={focus === "cache"} />
          <Arrow id={ID} tone="dyn" d="M493 96 H511" dim={dimC} />
          <Box x={514} y={76} w={64} h={40} tone="enc" title="MLP" dim={dimC} bold={focus === "cache"} />
          <Arrow id={ID} tone="enc" d="M580 96 H603" dim={dimC} />
          <Box x={606} y={76} w={82} h={40} tone="dec" title="Heads" sub="Classification" dim={dimC} />
          <Box x={456} y={186} w={180} h={42} tone="neu" title="Behavioral Features" sub="实时计数，每次新事件后更新" dim={dimC} bold={focus === "cache"} />
          <Arrow id={ID} tone="neu" d="M546 184 V119" dim={dimC} bold={focus === "cache"} />
        </svg>
      </div>
      <Legend items={[{ tone: "dyn", label: "token 与向量" }, { tone: "enc", label: "Transformer 与 MLP" }, { tone: "att", label: "attention：图文 token 两两相连" }, { tone: "par", label: "缓存边界" }, { tone: "dec", label: "Classification Heads" }]} />
      <div className={`viz-narr${focus === "attn" ? " is-warn" : focus === "cache" ? " is-good" : ""}`} aria-live="polite">
        {focus === "attn"
          ? "和 late fusion 的区别在于交互发生的位置。这里图片的每个 patch 和文本的每个词在第一层 attention 就能互相看到，文字里的一个词可以直接指向图里的一个区域。「合起来才违规」的信息在被压成一个向量之前就已经被用上了。代价是序列变长，attention 的计算量随 token 数平方增长。"
          : focus === "cache"
            ? "Transformer 是整个模型里最贵的部分，但它的输入只有帖子内容，内容发布后不变，所以它的输出可以按 post id 缓存。行为特征一直在变，放在后面便宜的 MLP 里融合。帖子每多一批曝光和举报，只需要重跑 MLP 和 heads，不需要重跑 Transformer。"
            : "图片切成 patch、文本切成 token，拼成一个序列进同一个 Transformer。内容的表示算好之后，再在 MLP 里和实时行为特征融合，最后接分类头。"}
      </div>
    </MsdFrame>
  );
}

// ---------- 4.4 multi-task heads ----------

const HEADS = [
  { title: "Harmful / Benign", sub: "一个 sigmoid · 主任务", loss: "α · L_harmful", lossSub: "BCE", label: "人工标注的二分类标签，约 5 万条", online: "输出经过校准后交给 Decision Policy，决定 Allow、Demote 还是 Delete。", why: "这是业务真正要的输出，评估和校准都针对它。" },
  { title: "Violation Types", sub: "每类一个 sigmoid：nudity、hate…", loss: "β · L_violation", lossSub: "multi-label BCE", label: "人工标注的违规类型，一条帖子可以同时属于多类", online: "决定送进哪个审核队列，以及向用户说明删除的原因。", why: "不同类型的视觉和文字特征不同，逼着 backbone 学出更细的表示；每类用独立的 sigmoid 而不是 softmax，因为类别不互斥。" },
  { title: "User Report Rate", sub: "预测 举报数 / 曝光数", loss: "γ · L_report", lossSub: "binomial / Poisson NLL", label: "用户举报日志，弱监督信号，量比人工标注大几个数量级", online: "主要是辅助任务，用大量弱标签帮 backbone 学表示；它的预测也可以用来给人工审核排优先级。", why: "标签是 n 次曝光里出现 k 次举报，是比例或计数而不是 0/1，所以用 binomial 或带 exposure 的 Poisson 似然，而不是把举报率硬切成二分类。" },
];

export function MultiTaskHeadsFigure() {
  const [sel, setSel] = useState<number | null>(null);
  const ys = [12, 83, 154];
  const ID = "mth";
  return (
    <MsdFrame
      title="图 7 · Multi-task Learning：共享 backbone，多个分类头"
      description="三个任务共用一份表示，各自有自己的 head 和 loss。选一个 head 看它的标签从哪来。"
      footnote={<>虚线框只在训练时存在。标注数量是面试案例的假设。</>}
    >
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="选择一个 head">
          {HEADS.map((h, i) => (
            <button key={h.title} type="button" className={`viz-chip${sel === i ? " is-on" : ""}`} aria-pressed={sel === i} onClick={() => setSel(sel === i ? null : i)}>{h.title}</button>
          ))}
        </div>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 700 212" role="img" aria-label="Shared Backbone 连到三个 head：Harmful / Benign、Violation Types、User Report Rate，每个 head 有自己的 loss" style={{ minWidth: 640 }}>
          <Markers id={ID} />
          <Box x={16} y={74} w={196} h={64} tone="enc" title="Shared Backbone" sub="Multimodal Transformer + MLP" size={11} />
          {HEADS.map((h, i) => {
            const dim = sel !== null && sel !== i;
            return (
              <g key={h.title}>
                <Arrow id={ID} tone="enc" d={i === 1 ? "M214 106 H285" : `M214 106 C252 106 250 ${ys[i] + 23} 285 ${ys[i] + 23}`} dim={dim} bold={sel === i} />
                <Box x={288} y={ys[i]} w={200} h={46} tone="dec" title={h.title} sub={h.sub} dim={dim} bold={sel === i} />
                <Arrow id={ID} tone="grey" d={`M490 ${ys[i] + 23} H549`} dim={dim} dashed />
                <Box x={552} y={ys[i]} w={134} h={46} tone="grey" title={h.loss} sub={h.lossSub} dim={dim} dashed />
              </g>
            );
          })}
        </svg>
      </div>
      <Legend items={[{ tone: "enc", label: "共享的表示" }, { tone: "dec", label: "各任务的 head" }, { tone: "grey", label: "loss，只在训练时" }]} />
      <div className="viz-narr" aria-live="polite">
        {sel === null
          ? "三个 head 读的是同一个 backbone 输出。训练时三项 loss 加权求和，梯度一起回传到 backbone；推理时按需要取用各个 head 的输出。"
          : <><b>{HEADS[sel].title}</b>。标签：{HEADS[sel].label}。{HEADS[sel].why}线上：{HEADS[sel].online}</>}
      </div>
    </MsdFrame>
  );
}

// ---------- 4.5 view-weighted loss ----------

const CAPS = [5, 10, 14];
const X_LABELS = ["1", "10", "100", "1k", "10k", "100k", "1M", "10M"];
const EXAMPLE_P = 0.3;

export function ViewWeightFigure() {
  const [exp, setExp] = useState(3);
  const [cap, setCap] = useState(10);
  const views = Math.round(10 ** exp);
  const w = viewWeight(views, cap);
  const loss = bce(EXAMPLE_P, 1);
  const capped = Math.log(1 + views) >= cap;
  const f = plotFrame({ x: 0, y: 0, w: 700, h: 300 }, [0, 7], [0, 18]);
  const grid = Array.from({ length: 71 }, (_, i) => i / 10);
  const curve = grid.map((e) => [e, viewWeight(10 ** e, cap)] as const);
  const free = grid.map((e) => [e, 1 + Math.log(1 + 10 ** e)] as const);
  const knee = Math.exp(cap) - 1;

  return (
    <MsdFrame
      title="图 8 · View-weighted Loss：曝光越高，样本权重越大，但有上限"
      description="拖滑杆改变一条帖子的预测曝光量，看它在 loss 里的权重。下面的按钮换权重上限 c。"
      footnote={<>w = 1 + min(log(1 + V̂), c)，log 是自然对数。这是本笔记补充的示例设计。例子里的帖子有害（y = 1），模型预测 p = {EXAMPLE_P}。</>}
    >
      <Slider id="vw-views" label="预测曝光量 V̂" value={exp} min={0} max={7} step={0.25} onChange={setExp} display={views.toLocaleString("en-US")} />
      <div className="viz-controls">
        <span className="viz-k">权重上限 c</span>
        <div className="viz-chips" role="group" aria-label="权重上限 c">
          {CAPS.map((c) => <button key={c} type="button" className={`viz-chip mono${cap === c ? " is-on" : ""}`} aria-pressed={cap === c} onClick={() => setCap(c)}>c = {c}</button>)}
        </div>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 700 300" role="img" aria-label={`权重曲线：曝光 ${views} 时权重 ${w.toFixed(2)}，上限 ${1 + cap}`} style={{ minWidth: 520 }}>
          <Axes f={f} xTicks={[0, 1, 2, 3, 4, 5, 6, 7]} yTicks={[0, 3, 6, 9, 12, 15, 18]} xLabel="预测曝光量 V̂（对数刻度）" yLabel="样本权重 w" xFormat={(v) => X_LABELS[v]} />
          <path d={linePath(f, free)} fill="none" stroke={P.grey} strokeWidth={1.4} strokeDasharray="5 4" />
          <line x1={f.x0} y1={f.y(1 + cap)} x2={f.x1} y2={f.y(1 + cap)} stroke={P.dec} strokeWidth={1} strokeDasharray="3 3" />
          <text x={f.x0 + 6} y={f.y(1 + cap) - 5} fontSize={10.5} fill={P.dec}>上限 1 + c = {1 + cap}</text>
          <line x1={f.x0} y1={f.y(1)} x2={f.x1} y2={f.y(1)} stroke={P.sub} strokeWidth={1} strokeDasharray="2 4" />
          <text x={f.x1 - 4} y={f.y(1) + 13} fontSize={10} textAnchor="end" fill={P.sub}>w = 1：普通 BCE</text>
          <path d={linePath(f, curve)} fill="none" stroke={P.enc} strokeWidth={2.4} />
          <line x1={f.x(exp)} y1={f.y0} x2={f.x(exp)} y2={f.y(w)} stroke={P.enc} strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={f.x(exp)} cy={f.y(w)} r={5.5} fill={P.enc} stroke={P.surface} strokeWidth={1.5} style={{ transition: "cx .2s, cy .2s" }} />
        </svg>
      </div>
      <div className="viz-stat" style={{ marginTop: 10 }}>
        <div><small>log(1 + V̂)</small><b>{Math.log(1 + views).toFixed(2)}</b></div>
        <div><small>权重 w</small><b>{w.toFixed(2)}</b></div>
        <div><small>普通 BCE</small><b>{loss.toFixed(3)}</b></div>
        <div><small>加权后 w · BCE</small><b>{(w * loss).toFixed(3)}</b></div>
      </div>
      <div className={`viz-narr${capped ? " is-warn" : ""}`} aria-live="polite">
        {capped
          ? `这条帖子预测有 ${views.toLocaleString("en-US")} 次曝光，log(1 + V̂) = ${Math.log(1 + views).toFixed(2)} 已经超过 c = ${cap}，权重停在上限 ${1 + cap}。c = ${cap} 的意思是：曝光超过 e^${cap} − 1 ≈ ${Math.round(knee).toLocaleString("en-US")} 次之后一视同仁，不再让单条爆款帖子继续放大梯度。`
          : `这条帖子预测有 ${views.toLocaleString("en-US")} 次曝光，权重 w = 1 + log(1 + ${views.toLocaleString("en-US")}) = ${w.toFixed(2)}。同样是把有害帖预测成 ${EXAMPLE_P}，普通 BCE 的损失是 ${loss.toFixed(3)}，加权后是 ${(w * loss).toFixed(3)}。曝光翻 10 倍，权重只加约 2.3，这就是取 log 的作用。`}
      </div>
    </MsdFrame>
  );
}

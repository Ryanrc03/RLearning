"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { createRng } from "@/lib/ml/random";
import {
  bundleExclusive,
  GAIN_TABLE,
  gossSelect,
  growLeafWise,
  growLevelWise,
  histogramBins,
  makeGradients,
  makeHistogramValues,
  nodeDepth,
  type Growth,
} from "@/lib/ml/trees";

// Page 4 of Tree Models: the same gain table grown two ways. Level-wise
// (XGBoost's default) splits a whole level per step and stops at max_depth 3;
// leaf-wise (LightGBM) splits only the best leaf per step until it has the
// same 8 leaves. Below: histogram bins, EFB and GOSS, each computed.

const STEPS = 7;
const LEVEL_MAX_DEPTH = 3;
const W = 720;
const H = 330;
const PANEL_W = 340;
const C_LEVEL = "#2a78d6";
const C_LEAF = "#eb6834";
const C_NEXT = "#eda100";
const INK = "#3b4234";
const MUTED = "#76796f";
const FAINT = "#c9c4ad";

type Laid = { id: number; x: number; y: number; depth: number; leaf: boolean };

/** Leaves left to right by their path, internal nodes centred over their children. */
function layout(g: Growth, x0: number, width: number, top: number, rowH: number): Laid[] {
  const pos = (id: number) => {
    const d = nodeDepth(id);
    return (id - 2 ** d + 0.5) / 2 ** d;
  };
  const leaves = [...g.leaves].sort((a, b) => pos(a) - pos(b));
  const xs = new Map<number, number>();
  leaves.forEach((id, i) => xs.set(id, x0 + ((i + 0.5) * width) / leaves.length));
  const splitSet = new Set(g.splits);
  const xOf = (id: number): number => {
    const known = xs.get(id);
    if (known !== undefined) return known;
    const x = (xOf(2 * id) + xOf(2 * id + 1)) / 2;
    xs.set(id, x);
    return x;
  };
  const ids = [...g.splits, ...g.leaves];
  return ids.map((id) => ({ id, x: xOf(id), y: top + nodeDepth(id) * rowH, depth: nodeDepth(id), leaf: !splitSet.has(id) }));
}

function Tree({ g, x0, color, title, highlight, nextIds }: { g: Growth; x0: number; color: string; title: string; highlight: string; nextIds: number[] }) {
  const rowH = Math.min(44, 230 / Math.max(1, g.depth + 1) + 8);
  const nodes = layout(g, x0, PANEL_W, 52, rowH);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const next = new Set(nextIds);
  return (
    <g>
      <text x={x0 + PANEL_W / 2} y={18} fontSize={13} fontWeight={600} fill={color} textAnchor="middle">{title}</text>
      <text x={x0 + PANEL_W / 2} y={34} fontSize={11} fill={MUTED} textAnchor="middle">{highlight}</text>
      {nodes
        .filter((n) => n.id > 1)
        .map((n) => {
          const p = byId.get(Math.floor(n.id / 2))!;
          return <line key={`e${n.id}`} x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke={FAINT} strokeWidth={1.5} />;
        })}
      {nodes.map((n) => {
        const gain = GAIN_TABLE[n.id] ?? 0;
        const isNext = next.has(n.id);
        return (
          <g key={n.id} style={{ transition: "transform .3s" }}>
            <circle cx={n.x} cy={n.y} r={15} fill={n.leaf ? "#fff" : color} stroke={isNext ? C_NEXT : n.leaf ? FAINT : color} strokeWidth={isNext ? 3 : 1.5} />
            <text x={n.x} y={n.y + 4} fontSize={11} fontWeight={600} fill={n.leaf ? (gain > 0 ? INK : FAINT) : "#fff"} textAnchor="middle" className="mono">{gain > 0 ? gain : "·"}</text>
          </g>
        );
      })}
      <text x={x0 + PANEL_W / 2} y={H - 10} fontSize={12.5} fontWeight={600} fill={INK} textAnchor="middle" className="mono">
        叶子 {g.leaves.length} · 总 gain {g.totalGain} · 深度 {g.depth}
      </text>
    </g>
  );
}

const HIST_VALUES = makeHistogramValues(11);
const N_BINS = 8;
const EFB_MAN = [1, 0, 1, 0, 0, 1];
const EFB_WOMAN = [0, 1, 0, 1, 1, 0];
const GOSS_TOP = 0.2;
const GOSS_OTHER = 0.2;

export default function XgboostLightgbmFigure() {
  const [step, setStep] = useState(0);
  const level = useMemo(() => growLevelWise(GAIN_TABLE, Math.min(step, LEVEL_MAX_DEPTH)), [step]);
  const leaf = useMemo(() => growLeafWise(GAIN_TABLE, step), [step]);
  const cards = useMemo(() => {
    const hist = histogramBins(HIST_VALUES, N_BINS);
    const efb = bundleExclusive(EFB_MAN, EFB_WOMAN);
    const grads = makeGradients(5);
    const goss = gossSelect(grads, GOSS_TOP, GOSS_OTHER, createRng(9));
    return { hist, efb, grads, goss };
  }, []);

  const levelDone = step >= LEVEL_MAX_DEPTH;
  const levelNext = levelDone ? [] : level.leaves.filter((id) => nodeDepth(id) === level.depth && (GAIN_TABLE[id] ?? 0) > 0);
  const leafNext = leaf.next !== null ? [leaf.next] : [];
  const lastLeafSplit = leaf.splits[leaf.splits.length - 1];

  const narr = (() => {
    if (step === 0) return "两边都只有根节点。每个圆里的数字是「把这个叶子切开能赚多少 gain」，两边用的是同一张表，橙色描边的是下一步要切的叶子。";
    if (step === 1) return `第一刀都切根节点，gain ${GAIN_TABLE[1]}。从下一步起分道扬镳：左边整层一起切，右边只切 gain 最大的那一个。`;
    if (step < LEVEL_MAX_DEPTH) {
      return `level-wise 把第 ${step} 层的叶子全切了，${level.leaves.length} 个叶子、总 gain ${level.totalGain}；leaf-wise 只切了 gain 最大的那个叶子（${GAIN_TABLE[lastLeafSplit]}），${leaf.leaves.length} 个叶子、总 gain ${leaf.totalGain}。`;
    }
    if (step === LEVEL_MAX_DEPTH) {
      return `level-wise 切完第 3 层，${level.leaves.length} 个叶子、总 gain ${level.totalGain}，深度到 max_depth = 3 就停了，最便宜的一刀只值 ${Math.min(...level.splits.map((id) => GAIN_TABLE[id]))}；leaf-wise 第 3 刀切 ${GAIN_TABLE[lastLeafSplit]}，${leaf.leaves.length} 个叶子、总 gain ${leaf.totalGain}。`;
    }
    if (step < STEPS) {
      return `level-wise 已经停在 ${level.leaves.length} 个叶子；leaf-wise 继续挑 gain 最大的叶子切：这一刀 ${GAIN_TABLE[lastLeafSplit]}，${leaf.leaves.length} 个叶子、总 gain ${leaf.totalGain}、深度 ${leaf.depth}。`;
    }
    return `同样 ${leaf.leaves.length} 个叶子：level-wise 总 gain ${level.totalGain}、深度 ${level.depth}；leaf-wise 总 gain ${leaf.totalGain}、深度 ${leaf.depth}。同样的叶子数换到更多 gain，代价是树又深又偏，要靠 num_leaves 和 min_data_in_leaf 兜住。`;
  })();

  const { hist, efb, grads, goss } = cards;
  const histMax = Math.max(...hist.counts);

  return (
    <VisualizationFrame
      title="Level-wise 与 leaf-wise：同一张 gain 表，两种长法"
      description="左边每步长满一整层（XGBoost 默认，max_depth = 3），右边每步只切 gain 最大的那一个叶子（LightGBM，num_leaves = 8）。走到最后两边叶子一样多，比总 gain 和深度。"
    >
      <StepPlayer step={step} total={STEPS + 1} onStep={setStep} intervalMs={1200} caption={`第 ${step} 步 / 共 ${STEPS} 步`} />
      <Figure width={W} height={H} label={`第 ${step} 步：level-wise ${level.leaves.length} 叶 gain ${level.totalGain}，leaf-wise ${leaf.leaves.length} 叶 gain ${leaf.totalGain}`} minWidth={600}>
        <Tree g={level} x0={10} color={C_LEVEL} title="Level-wise（按层）" highlight={levelDone ? "深度到 3，停" : "下一步：这一层全切"} nextIds={levelNext} />
        <line x1={W / 2} y1={10} x2={W / 2} y2={H - 4} stroke="#e4dfcb" strokeDasharray="4 4" />
        <Tree g={leaf} x0={W - PANEL_W - 10} color={C_LEAF} title="Leaf-wise（按叶子）" highlight={leaf.next !== null && step < STEPS ? `下一步：切 gain ${GAIN_TABLE[leaf.next]} 的叶子` : "到 8 个叶子，停"} nextIds={step < STEPS ? leafNext : []} />
      </Figure>
      <div className={`viz-narr${step === STEPS ? " is-good" : ""}`}>{narr}</div>

      <div className="viz-cards" style={{ marginTop: 14 }}>
        <div className="viz-card">
          <h6>① Histogram：32 个取值 → {N_BINS} 个桶</h6>
          <svg viewBox="0 0 220 74" role="img" aria-label={`32 个取值分进 ${N_BINS} 个桶，各桶 ${hist.counts.join("、")} 个`} style={{ width: "100%", maxWidth: 260 }}>
            {hist.counts.map((c, b) => {
              const bw = 200 / N_BINS;
              const h = (c / histMax) * 34;
              return (
                <g key={b}>
                  <rect x={10 + b * bw + 1} y={44 - h} width={bw - 2} height={h} fill={C_LEAF} opacity={0.35} />
                  <text x={10 + b * bw + bw / 2} y={41 - h} fontSize={11} fill={INK} textAnchor="middle" className="mono">{c}</text>
                </g>
              );
            })}
            {HIST_VALUES.map((v, i) => (
              <line key={i} x1={10 + (v / 100) * 200} y1={48} x2={10 + (v / 100) * 200} y2={58} stroke={INK} strokeWidth={1} />
            ))}
            {hist.edges.map((e, i) => (
              <line key={`e${i}`} x1={10 + (e / 100) * 200} y1={46} x2={10 + (e / 100) * 200} y2={62} stroke={C_LEAF} strokeWidth={1.2} />
            ))}
            <text x={10} y={72} fontSize={11} fill={MUTED} className="mono">0</text>
            <text x={210} y={72} fontSize={11} fill={MUTED} textAnchor="end" className="mono">100</text>
          </svg>
          <p className="why">找切点只在 {N_BINS} 个桶边界上试，不在 32 个值之间试；每个值只存桶号（1 字节），内存和扫描都按桶数算。</p>
        </div>

        <div className="viz-card">
          <h6>② EFB：两列 one-hot 捆成一列</h6>
          <table className="viz-table">
            <thead><tr><th className="num">男</th><th className="num">女</th><th className="num">→ 捆绑后</th></tr></thead>
            <tbody>
              {EFB_MAN.map((a, i) => (
                <tr key={i}>
                  <td className="num">{a}</td>
                  <td className="num">{EFB_WOMAN[i]}</td>
                  <td className="num" style={{ fontWeight: 600, color: efb.merged[i] > efb.offset ? C_LEAF : C_LEVEL }}>{efb.merged[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="why">两列从不同时非零，女那列的值整体加 {efb.offset} 后合进来，一列就能还原两列；特征数减半，直方图也少建一个。两列真的撞上会报错。</p>
        </div>

        <div className="viz-card">
          <h6>③ GOSS：留大梯度，抽小梯度</h6>
          <div className="tok-strip">
            {grads.map((g, i) => {
              const cls = goss.top.includes(i) ? " is-done" : goss.sampled.includes(i) ? " is-active" : " is-wait";
              return (
                <span className={`tok${cls}`} key={i} title={`样本 ${i}`}>
                  {Math.abs(g).toFixed(2)}
                  <small>{goss.top.includes(i) ? "留" : goss.sampled.includes(i) ? `×${goss.weight}` : "丢"}</small>
                </span>
              );
            })}
          </div>
          <p className="why">{grads.length} 个样本按 |g| 排序：梯度最大的 {Math.round(GOSS_TOP * 100)}%（{goss.top.length} 个）全留，其余 {grads.length - goss.top.length} 个随机抽 {Math.round(GOSS_OTHER * 100)}%（{goss.sampled.length} 个）并把权重乘 {goss.weight}；这一轮只用 {goss.top.length + goss.sampled.length} 个样本建直方图。</p>
        </div>
      </div>
    </VisualizationFrame>
  );
}

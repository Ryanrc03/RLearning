"use client";

import { useState } from "react";
import { useLang } from "@/components/i18n/LangProvider";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import type { Lang } from "@/lib/i18n";
import { G_MAX, GRPO_PROMPTS, groupAdvantages, sampleRewards, zeroSignalProbability, type Difficulty } from "@/lib/ml/grpo";

// Page 4 of Post-training: one prompt, G sampled answers, each scored 0/1 by a
// verifier. The advantages are the rewards standardised inside the group; drag
// G and switch the prompt's difficulty to see when a group carries no signal.

const W = 720;
const H = 316;
const X0 = 92;
const X1 = W - 16;
const SLOT = (X1 - X0) / G_MAX;
const R_TOP = 26;
const R_BASE = 104;
const A_ZERO = 206;
const A_SCALE = 70 / 4; // px per unit of advantage, ±4 fits the panel
const DIFFS: Difficulty[] = ["easy", "medium", "hard"];
const DEFAULT_G = 6;
const DEFAULT_DIFF: Difficulty = "medium";
const sign = (v: number) => (Math.abs(v) < 0.005 ? "0.00" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`);

type Mixed = { g: number; right: number; mean: number; std: number; aRight: number; aWrong: number };

const zh = {
  title: "GRPO：同一道题采样 G 个回答，组内标准化就是 advantage",
  description: "一道 GSM8K 式的数学题，verifier 只看最终答案：对得 1、错得 0。上排是每个回答的 reward，虚线是组内均值；下排是 (r − mean) / std。灰色格子是还没采样的回答。",
  difficulty: "题目难度",
  reset: "重置",
  gSlider: "每题采样 G",
  figureLabel: (g: number, right: number, mean: number, std: number) => `G = ${g}，${right} 个对，均值 ${mean.toFixed(2)}，标准差 ${std.toFixed(2)}`,
  groupTitle: "这一组",
  rightOfSampled: "答对 / 采样",
  groupMean: "组内均值（基线）",
  groupStd: "组内标准差",
  zeroTitle: (g: number) => `一组全对或全错的概率（G = ${g}）`,
  zeroNote: "pᴳ + (1 − p)ᴳ：这类题里有这么大比例，在这一步白白采样、不贡献梯度。",
  allRight: (g: number) => `${g} 个回答全对：组内均值 1、标准差 0，每个 advantage 都是 0。这道题这一步不产生任何梯度，不是因为答得不好，而是组里没有可比的对象。题太简单了，可以加大 G、或者把它从训练集里筛掉。`,
  allWrong: (g: number) => `${g} 个回答全错：均值 0、标准差 0，advantage 全是 0。模型还没做对过这道题，GRPO 拿不到任何「往哪边走」的信息。要么把 G 拉大碰运气，要么先做 SFT 冷启动，或者换更简单的题做课程。`,
  mixed: ({ g, right, mean, std, aRight, aWrong }: Mixed) => `${g} 个回答里 ${right} 个对：均值 ${mean.toFixed(2)}、标准差 ${std.toFixed(2)}。答对的每个 A = ${sign(aRight)}，答错的每个 A = ${sign(aWrong)}。对的越少，做对的那一个被推得越狠；这条基线就是组内平均，不需要 critic 去估。`,
};

const COPY: Record<Lang, typeof zh> = {
  zh,
  en: {
    title: "GRPO: sample G responses to the same problem; standardizing within the group gives the advantage",
    description: "A GSM8K-style math problem whose verifier looks only at the final answer: 1 if right, 0 if wrong. The top row is each response's reward, and the dashed line is the group mean; the bottom row is (r − mean) / std. Grey slots are responses not sampled yet.",
    difficulty: "Problem difficulty",
    reset: "Reset",
    gSlider: "Samples per problem G",
    figureLabel: (g, right, mean, std) => `G = ${g}, ${right} correct, mean ${mean.toFixed(2)}, std ${std.toFixed(2)}`,
    groupTitle: "This group",
    rightOfSampled: "Correct / sampled",
    groupMean: "Group mean (baseline)",
    groupStd: "Group std",
    zeroTitle: (g) => `Chance a group is all correct or all wrong (G = ${g})`,
    zeroNote: "pᴳ + (1 − p)ᴳ: the share of groups on such a problem that are sampled for nothing at this step and contribute no gradient.",
    allRight: (g) => `All ${g} responses are correct: group mean 1, std 0, so every advantage is 0. This problem produces no gradient at this step, not because the answers were bad but because the group has nothing to compare against. The problem is too easy: raise G, or filter it out of the training set.`,
    allWrong: (g) => `All ${g} responses are wrong: mean 0, std 0, and every advantage is 0. The model has never solved this problem, so GRPO gets no information about which way to move. Either raise G and hope for a lucky hit, do an SFT cold start first, or build a curriculum from easier problems.`,
    mixed: ({ g, right, mean, std, aRight, aWrong }) => `${right} of ${g} responses correct: mean ${mean.toFixed(2)}, std ${std.toFixed(2)}. Each correct response gets A = ${sign(aRight)}, each wrong one A = ${sign(aWrong)}. The fewer correct responses, the harder each one that got it right is pushed; the baseline is just the group mean, with no critic needed to estimate it.`,
  },
};

export default function GrpoFigure() {
  const lang = useLang();
  const copy = COPY[lang];
  const [g, setG] = useState(DEFAULT_G);
  const [diff, setDiff] = useState<Difficulty>(DEFAULT_DIFF);
  const prompt = GRPO_PROMPTS[diff];
  const all = sampleRewards(prompt.p, prompt.seed);
  const rewards = all.slice(0, g);
  const { mean, std, advantages } = groupAdvantages(rewards);
  const right = rewards.filter((r) => r === 1).length;
  const dead = std === 0;
  const cx = (i: number) => X0 + (i + 0.5) * SLOT;
  const yMean = R_BASE - mean * (R_BASE - R_TOP);
  const aRight = advantages[rewards.indexOf(1)] ?? 0;
  const aWrong = advantages[rewards.indexOf(0)] ?? 0;

  const narr = dead
    ? right === g
      ? copy.allRight(g)
      : copy.allWrong(g)
    : copy.mixed({ g, right, mean, std, aRight, aWrong });

  return (
    <VisualizationFrame title={copy.title} description={copy.description}>
      <div className="viz-row grpo-controls">
        <div className="viz-chips" role="group" aria-label={copy.difficulty}>
          {DIFFS.map((d) => (
            <button key={d} type="button" className={`viz-chip${diff === d ? " is-on" : ""}`} aria-pressed={diff === d} onClick={() => setDiff(d)}>
              {GRPO_PROMPTS[d].label[lang]}
            </button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={() => { setG(DEFAULT_G); setDiff(DEFAULT_DIFF); }}>{copy.reset}</button>
      </div>
      <Slider label={copy.gSlider} value={g} min={2} max={G_MAX} step={1} onChange={setG} display={String(g)} id="grpo-g" />

      <Figure width={W} height={H} label={copy.figureLabel(g, right, mean, std)}>
        <text x={X0 - 12} y={(R_TOP + R_BASE) / 2 - 4} fontSize={12} textAnchor="end" fill="#30332c" fontWeight={600}>reward r</text>
        <text x={X0 - 12} y={(R_TOP + R_BASE) / 2 + 12} fontSize={11} textAnchor="end" fill="#76796f">verifier 0 / 1</text>
        <text x={X0 - 12} y={A_ZERO - 4} fontSize={12} textAnchor="end" fill="#30332c" fontWeight={600}>advantage A</text>
        <text x={X0 - 12} y={A_ZERO + 12} fontSize={11} textAnchor="end" fill="#76796f">(r − mean)/std</text>
        <line x1={X0} y1={R_BASE} x2={X1} y2={R_BASE} stroke="#76796f" strokeWidth={1.2} />
        <line x1={X0} y1={A_ZERO} x2={X1} y2={A_ZERO} stroke="#76796f" strokeWidth={1.2} />
        {[-2, 2].map((v) => (
          <g key={v}>
            <line x1={X0} y1={A_ZERO - v * A_SCALE} x2={X1} y2={A_ZERO - v * A_SCALE} stroke="#e4dfcb" strokeDasharray="3 3" />
            <text x={X0 - 4} y={A_ZERO - v * A_SCALE + 4} fontSize={11} textAnchor="end" fill="#76796f">{v > 0 ? `+${v}` : `−${-v}`}</text>
          </g>
        ))}
        {all.map((r, i) => {
          const on = i < g;
          const a = on ? advantages[i] : 0;
          const x = cx(i) - SLOT * 0.32;
          const w = SLOT * 0.64;
          const rh = on ? r * (R_BASE - R_TOP) : 0;
          const ah = Math.abs(a) * A_SCALE;
          const color = r === 1 ? "var(--v3)" : "var(--vcrit)";
          return (
            <g key={i} opacity={on ? 1 : 0.35}>
              {on ? (
                <>
                  <rect x={x} y={R_BASE - rh} width={w} height={Math.max(rh, 2)} rx={3} fill={color} opacity={r === 1 ? 0.85 : 0.5} style={{ transition: "y .3s, height .3s" }} />
                  <text x={cx(i)} y={R_BASE + 14} fontSize={11.5} fontWeight={700} textAnchor="middle" fill={r === 1 ? "#087a08" : "#d03b3b"}>{r === 1 ? "✓" : "✗"}</text>
                  <rect x={x} y={a >= 0 ? A_ZERO - ah : A_ZERO} width={w} height={Math.max(ah, dead ? 0 : 1)} rx={3} fill={a >= 0 ? "var(--v1)" : "var(--v2)"} style={{ transition: "y .3s, height .3s" }} />
                  <text x={cx(i)} y={a >= 0 ? A_ZERO - ah - 5 : A_ZERO + ah + 13} fontSize={11} textAnchor="middle" fill="#30332c" className="mono" style={{ transition: "y .3s" }}>
                    {dead ? "0" : sign(a)}
                  </text>
                </>
              ) : (
                <rect x={x} y={R_BASE - 10} width={w} height={10} rx={3} fill="#efede4" stroke="#cfcab4" strokeDasharray="2 2" />
              )}
              <text x={cx(i)} y={H - 6} fontSize={11} textAnchor="middle" fill="#76796f">{i + 1}</text>
            </g>
          );
        })}
        <line x1={X0} y1={yMean} x2={X0 + g * SLOT} y2={yMean} stroke="#3b4234" strokeWidth={1.6} strokeDasharray="5 3" style={{ transition: "y1 .3s, y2 .3s, x2 .3s" }} />
        <text x={X0 + g * SLOT - 2} y={yMean - 5} fontSize={11} textAnchor="end" fill="#3b4234" fontWeight={600} className="mono" stroke="#fff" strokeWidth={3} paintOrder="stroke" style={{ transition: "y .3s, x .3s" }}>
          mean {mean.toFixed(2)}
        </text>
      </Figure>

      <div className="viz-grid2" style={{ marginTop: 12 }}>
        <div className="viz-panel">
          <h5>{copy.groupTitle}</h5>
          <table className="viz-table">
            <tbody>
              <tr><td>{copy.rightOfSampled}</td><td className="num">{right} / {g}</td></tr>
              <tr><td>{copy.groupMean}</td><td className="num">{mean.toFixed(3)}</td></tr>
              <tr><td>{copy.groupStd}</td><td className="num">{std.toFixed(3)}</td></tr>
              <tr><td>Σ A_i</td><td className="num">{sign(advantages.reduce((s, v) => s + v, 0))}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="viz-panel">
          <h5>{copy.zeroTitle(g)}</h5>
          <Bars
            rows={DIFFS.map((d) => {
              const z = zeroSignalProbability(GRPO_PROMPTS[d].p, g);
              return { label: GRPO_PROMPTS[d].label[lang], value: z, color: d === diff ? "var(--v4)" : "var(--vfixed)", text: `${(z * 100).toFixed(1)}%` };
            })}
          />
          <p className="viz-k" style={{ marginTop: 6 }}>{copy.zeroNote}</p>
        </div>
      </div>

      <div className={`viz-narr${dead ? " is-warn" : " is-good"}`}>{narr}</div>
    </VisualizationFrame>
  );
}

"use client";

import { useState } from "react";
import { useLang } from "@/components/i18n/LangProvider";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import type { Lang } from "@/lib/i18n";
import { clipStatus, PG_ANSWERS, PG_CORRECT, PG_PRESETS, PG_START_LOGITS, policyGradientStep, type PgMode, type PgPreset } from "@/lib/ml/policyGradient";

// Page 4 of Post-training, worked example: a three-token "LLM" answers
// "2 + 3 = ?", samples four answers, and takes one gradient step on its three
// logits. Switch the weight rule (raw reward → minus mean → GRPO) and the
// reward scale (0/1 vs 0–100 scores) to see how θ moves.

const MODE_KEYS: PgMode[] = ["reinforce", "baseline", "grpo"];
const PRESETS: PgPreset[] = ["binary", "score"];
const LR = 1;
const EPS = 0.2;

const fmt = (v: number, d = 2) => (Math.abs(v) < 0.005 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}`);
const tone = (v: number) => (Math.abs(v) < 0.005 ? undefined : { color: v > 0 ? "#087a08" : "#d03b3b" });
const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

const zh = {
  title: "一次 policy gradient 更新：θ 到底怎么动",
  description: (lr: number) => `玩具「LLM」只会回答 2 + 3 = ? 的三个 token，参数是三个 logit，起点全是 0（三个答案各 33.3%）。采样 4 个回答、打分，按 θ ← θ + lr · (1/G) Σ wᵢ (onehot(aᵢ) − π) 走一步，lr = ${lr}。`,
  modes: { reinforce: "① 只乘 reward", baseline: "② 减均值 baseline", grpo: "③ GRPO：再除 std" } as Record<PgMode, string>,
  modesAria: "权重怎么算",
  presetsAria: "奖励尺度",
  reset: "重置",
  pushTitle: "采样、打分、每个样本的推力",
  pushNote: "推力 = wᵢ · (onehot(aᵢ) − π)：采到的答案的 logit 被推 +w·(1 − π)，其余被推 −w·π。",
  answer: "回答",
  weight: "权重 w",
  pushHead: (a: string) => `Δθ「${a}」`,
  gradRow: "平均 = 梯度 g，θ ← θ + lr · g",
  probsTitle: "更新后的概率（更新前都是 33.3%）",
  answerLabel: (a: string, correct: boolean) => `「${a}」${correct ? " ✓" : ""}`,
  stepNorm: (n: number) => `步长 ‖Δθ‖ = ${n.toFixed(2)}`,
  clipTitle: "PPO / GRPO 的 clip",
  clipNote: (eps: number) => `ρ = π_new / π_old，ε = ${eps}；同一批样本再训一轮时用。`,
  sample: "样本",
  nextPass: "下一轮",
  sampleCell: (i: number, a: string) => `${i}「${a}」`,
  clipped: "已越过 1 ± ε，截断",
  active: "还在信任区内",
  reinforceScore: (stepNorm: number, p5: number) => `四个分数都在 90 上下，权重全是正的：答错的 6 和 4 也被往上推，只是推得比 5 少。一步下来 ‖Δθ‖ = ${stepNorm.toFixed(1)}，π(5) 直接冲到 ${pct(p5)}。换一批采样（比如没采到 5）它就会同样狠地把错答案推上去：方差大，步长跟着 reward 的绝对大小走，学习率很难调。`,
  reinforceBinary: (p5: number) => `0 / 1 奖励下 REINFORCE 只推答对的那两个样本，答错的权重是 0、什么也不做。π(5) 从 33.3% 到 ${pct(p5)}。它能学，但错的样本没被利用，而且一旦 reward 都是正数（下一个预设），就会连错的一起推。`,
  baseline: (score: boolean, p5: number, stepNorm: number) => `每个 reward 先减去组内均值 ${score ? "92" : "0.5"}：高于平均的被推上去，低于平均的被压下来${score ? "，95 分那个的权重就是 +3" : ""}。π(5) 到 ${pct(p5)}，‖Δθ‖ = ${stepNorm.toFixed(2)}。基线不改梯度的期望方向，只把方差砍下来，这就是笔记里的 stable。`,
  grpo: (weights: number[], stepNorm: number, rho5: number) => `GRPO 再除以组内标准差，权重变成 ${weights.map((w) => fmt(w)).join("、")}：无论 reward 是 0 / 1 还是百分制，步长都在同一量级（‖Δθ‖ = ${stepNorm.toFixed(2)}）。更新后 ρ(5) = ${rho5.toFixed(2)} 已经超过 1 + ε = 1.2，下一轮重复用这批样本时 clip 会把它的梯度截成 0。`,
};

const COPY: Record<Lang, typeof zh> = {
  zh,
  en: {
    title: "One policy-gradient update: how θ actually moves",
    description: (lr) => `A toy “LLM” that can only answer 2 + 3 = ? with one of three tokens; its parameters are three logits, all starting at 0 (33.3% for each answer). Sample 4 answers, score them, and take one step of θ ← θ + lr · (1/G) Σ wᵢ (onehot(aᵢ) − π), with lr = ${lr}.`,
    modes: { reinforce: "① Raw reward", baseline: "② Subtract the mean", grpo: "③ GRPO: also divide by std" },
    modesAria: "How the weight is computed",
    presetsAria: "Reward scale",
    reset: "Reset",
    pushTitle: "Samples, scores and each sample's push",
    pushNote: "push = wᵢ · (onehot(aᵢ) − π): the sampled answer's logit is pushed by +w·(1 − π), every other logit by −w·π.",
    answer: "Answer",
    weight: "Weight w",
    pushHead: (a) => `Δθ “${a}”`,
    gradRow: "Mean = gradient g, θ ← θ + lr · g",
    probsTitle: "Probabilities after the update (all 33.3% before)",
    answerLabel: (a, correct) => `“${a}”${correct ? " ✓" : ""}`,
    stepNorm: (n) => `Step size ‖Δθ‖ = ${n.toFixed(2)}`,
    clipTitle: "The PPO / GRPO clip",
    clipNote: (eps) => `ρ = π_new / π_old, ε = ${eps}; it applies when the same batch is trained on for another pass.`,
    sample: "Sample",
    nextPass: "Next pass",
    sampleCell: (i, a) => `${i} “${a}”`,
    clipped: "Past 1 ± ε, clipped",
    active: "Still inside the trust region",
    reinforceScore: (stepNorm, p5) => `All four scores are around 90, so every weight is positive: the wrong answers 6 and 4 get pushed up too, just less than 5. One step gives ‖Δθ‖ = ${stepNorm.toFixed(1)}, and π(5) shoots straight to ${pct(p5)}. With a different batch of samples (say, one with no 5 in it) it would push the wrong answers up just as hard: high variance, and the step size follows the absolute size of the reward, so the learning rate is hard to tune.`,
    reinforceBinary: (p5) => `With 0 / 1 rewards, REINFORCE pushes only the two correct samples; the wrong ones have weight 0 and do nothing. π(5) goes from 33.3% to ${pct(p5)}. It learns, but the wrong samples go unused, and as soon as every reward is positive (the next preset) it pushes the wrong ones up along with the right ones.`,
    baseline: (score, p5, stepNorm) => `Each reward first has the group mean ${score ? "92" : "0.5"} subtracted: above-average answers are pushed up and below-average ones pushed down${score ? ", so the 95-point answer gets weight +3" : ""}. π(5) reaches ${pct(p5)}, ‖Δθ‖ = ${stepNorm.toFixed(2)}. The baseline does not change the expected direction of the gradient; it only cuts the variance, which is what makes training stable.`,
    grpo: (weights, stepNorm, rho5) => `GRPO also divides by the group std, so the weights become ${weights.map((w) => fmt(w)).join(", ")}: whether the reward is 0 / 1 or out of 100, the step size stays on the same order (‖Δθ‖ = ${stepNorm.toFixed(2)}). After the update ρ(5) = ${rho5.toFixed(2)} is already past 1 + ε = 1.2, so when this batch is reused for another pass, the clip cuts its gradient to 0.`,
  },
};

export default function PolicyGradientStepFigure() {
  const lang = useLang();
  const copy = COPY[lang];
  const modes = MODE_KEYS.map((key) => ({ key, label: copy.modes[key] }));
  const [mode, setMode] = useState<PgMode>("grpo");
  const [preset, setPreset] = useState<PgPreset>("binary");
  const { samples } = PG_PRESETS[preset];
  const s = policyGradientStep(PG_START_LOGITS, samples, mode, LR);
  const ratios = s.probsAfter.map((p, j) => p / s.probsBefore[j]);

  let narr: string;
  let narrTone = "is-good";
  if (mode === "reinforce" && preset === "score") {
    narr = copy.reinforceScore(s.stepNorm, s.probsAfter[0]);
    narrTone = "is-bad";
  } else if (mode === "reinforce") {
    narr = copy.reinforceBinary(s.probsAfter[0]);
    narrTone = "is-warn";
  } else if (mode === "baseline") {
    narr = copy.baseline(preset === "score", s.probsAfter[0], s.stepNorm);
  } else {
    narr = copy.grpo(s.weights, s.stepNorm, ratios[0]);
  }

  return (
    <VisualizationFrame title={copy.title} description={copy.description(LR)}>
      <div className="viz-row grpo-controls">
        <Tabs options={modes} value={mode} onChange={setMode} ariaLabel={copy.modesAria} />
        <div className="viz-chips" role="group" aria-label={copy.presetsAria}>
          {PRESETS.map((p) => (
            <button key={p} type="button" className={`viz-chip${preset === p ? " is-on" : ""}`} aria-pressed={preset === p} onClick={() => setPreset(p)}>
              {PG_PRESETS[p].label[lang]}
            </button>
          ))}
          <button type="button" className="viz-btn" onClick={() => { setMode("grpo"); setPreset("binary"); }}>{copy.reset}</button>
        </div>
      </div>

      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5>{copy.pushTitle}</h5>
        <p className="viz-k">{copy.pushNote}</p>
        <table className="viz-table">
          <thead>
            <tr>
              <th>#</th><th>{copy.answer}</th><th className="num">reward r</th><th className="num">{copy.weight}</th>
              {PG_ANSWERS.map((a) => <th key={a} className="num">{copy.pushHead(a)}</th>)}
            </tr>
          </thead>
          <tbody>
            {samples.map((x, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{PG_ANSWERS[x.answer]} {x.answer === PG_CORRECT ? "✓" : "✗"}</td>
                <td className="num">{x.reward}</td>
                <td className="num" style={tone(s.weights[i])}>{fmt(s.weights[i])}</td>
                {s.pushes[i].map((v, j) => <td key={j} className="num" style={tone(v)}>{fmt(v)}</td>)}
              </tr>
            ))}
            <tr>
              <td colSpan={4}><b>{copy.gradRow}</b></td>
              {s.grad.map((v, j) => <td key={j} className="num" style={tone(v)}><b>{fmt(v)}</b></td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="viz-grid2" style={{ marginTop: 12 }}>
        <div className="viz-panel">
          <h5>{copy.probsTitle}</h5>
          <Bars
            rows={PG_ANSWERS.map((a, j) => ({
              label: copy.answerLabel(a, j === PG_CORRECT),
              value: s.probsAfter[j],
              color: j === PG_CORRECT ? "var(--v3)" : "var(--vcrit)",
              text: pct(s.probsAfter[j]),
              hint: `θ = ${s.logitsAfter[j].toFixed(2)}`,
            }))}
          />
          <p className="viz-k" style={{ marginTop: 6 }}>{copy.stepNorm(s.stepNorm)}</p>
        </div>
        <div className="viz-panel">
          <h5>{copy.clipTitle}</h5>
          <p className="viz-k">{copy.clipNote(EPS)}</p>
          <table className="viz-table">
            <thead>
              <tr><th>{copy.sample}</th><th className="num">ρ</th><th className="num">A</th><th>{copy.nextPass}</th></tr>
            </thead>
            <tbody>
              {samples.map((x, i) => {
                const r = ratios[x.answer];
                const st = clipStatus(r, s.weights[i], EPS);
                return (
                  <tr key={i}>
                    <td>{copy.sampleCell(i + 1, PG_ANSWERS[x.answer])}</td>
                    <td className="num">{r.toFixed(2)}</td>
                    <td className="num" style={tone(s.weights[i])}>{fmt(s.weights[i])}</td>
                    <td style={st === "clipped" ? { color: "#b26b00" } : undefined}>{st === "clipped" ? copy.clipped : copy.active}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`viz-narr ${narrTone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

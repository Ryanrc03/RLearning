"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { clipStatus, PG_ANSWERS, PG_CORRECT, PG_PRESETS, PG_START_LOGITS, policyGradientStep, type PgMode, type PgPreset } from "@/lib/ml/policyGradient";

// Page 4 of Post-training, worked example: a three-token "LLM" answers
// "2 + 3 = ?", samples four answers, and takes one gradient step on its three
// logits. Switch the weight rule (raw reward → minus mean → GRPO) and the
// reward scale (0/1 vs 0–100 scores) to see how θ moves.

const MODES: { key: PgMode; label: string }[] = [
  { key: "reinforce", label: "① 只乘 reward" },
  { key: "baseline", label: "② 减均值 baseline" },
  { key: "grpo", label: "③ GRPO：再除 std" },
];
const PRESETS: PgPreset[] = ["binary", "score"];
const LR = 1;
const EPS = 0.2;

const fmt = (v: number, d = 2) => (Math.abs(v) < 0.005 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}`);
const tone = (v: number) => (Math.abs(v) < 0.005 ? undefined : { color: v > 0 ? "#087a08" : "#d03b3b" });
const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

export default function PolicyGradientStepFigure() {
  const [mode, setMode] = useState<PgMode>("grpo");
  const [preset, setPreset] = useState<PgPreset>("binary");
  const { samples } = PG_PRESETS[preset];
  const s = policyGradientStep(PG_START_LOGITS, samples, mode, LR);
  const ratios = s.probsAfter.map((p, j) => p / s.probsBefore[j]);

  let narr: string;
  let narrTone = "is-good";
  if (mode === "reinforce" && preset === "score") {
    narr = `四个分数都在 90 上下，权重全是正的：答错的 6 和 4 也被往上推，只是推得比 5 少。一步下来 ‖Δθ‖ = ${s.stepNorm.toFixed(1)}，π(5) 直接冲到 ${pct(s.probsAfter[0])}。换一批采样（比如没采到 5）它就会同样狠地把错答案推上去：方差大，步长跟着 reward 的绝对大小走，学习率很难调。`;
    narrTone = "is-bad";
  } else if (mode === "reinforce") {
    narr = `0 / 1 奖励下 REINFORCE 只推答对的那两个样本，答错的权重是 0、什么也不做。π(5) 从 33.3% 到 ${pct(s.probsAfter[0])}。它能学，但错的样本没被利用，而且一旦 reward 都是正数（下一个预设），就会连错的一起推。`;
    narrTone = "is-warn";
  } else if (mode === "baseline") {
    narr = `每个 reward 先减去组内均值 ${preset === "score" ? "92" : "0.5"}：高于平均的被推上去，低于平均的被压下来${preset === "score" ? "，95 分那个的权重就是 +3" : ""}。π(5) 到 ${pct(s.probsAfter[0])}，‖Δθ‖ = ${s.stepNorm.toFixed(2)}。基线不改梯度的期望方向，只把方差砍下来，这就是笔记里的 stable。`;
  } else {
    narr = `GRPO 再除以组内标准差，权重变成 ${s.weights.map((w) => fmt(w)).join("、")}：无论 reward 是 0 / 1 还是百分制，步长都在同一量级（‖Δθ‖ = ${s.stepNorm.toFixed(2)}）。更新后 ρ(5) = ${ratios[0].toFixed(2)} 已经超过 1 + ε = 1.2，下一轮重复用这批样本时 clip 会把它的梯度截成 0。`;
  }

  return (
    <VisualizationFrame
      title="一次 policy gradient 更新：θ 到底怎么动"
      description={`玩具「LLM」只会回答 2 + 3 = ? 的三个 token，参数是三个 logit，起点全是 0（三个答案各 33.3%）。采样 4 个回答、打分，按 θ ← θ + lr · (1/G) Σ wᵢ (onehot(aᵢ) − π) 走一步，lr = ${LR}。`}
    >
      <div className="viz-row grpo-controls">
        <Tabs options={MODES} value={mode} onChange={setMode} ariaLabel="权重怎么算" />
        <div className="viz-chips" role="group" aria-label="奖励尺度">
          {PRESETS.map((p) => (
            <button key={p} type="button" className={`viz-chip${preset === p ? " is-on" : ""}`} aria-pressed={preset === p} onClick={() => setPreset(p)}>
              {PG_PRESETS[p].label}
            </button>
          ))}
          <button type="button" className="viz-btn" onClick={() => { setMode("grpo"); setPreset("binary"); }}>重置</button>
        </div>
      </div>

      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5>采样、打分、每个样本的推力</h5>
        <p className="viz-k">推力 = wᵢ · (onehot(aᵢ) − π)：采到的答案的 logit 被推 +w·(1 − π)，其余被推 −w·π。</p>
        <table className="viz-table">
          <thead>
            <tr>
              <th>#</th><th>回答</th><th className="num">reward r</th><th className="num">权重 w</th>
              {PG_ANSWERS.map((a) => <th key={a} className="num">Δθ「{a}」</th>)}
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
              <td colSpan={4}><b>平均 = 梯度 g，θ ← θ + lr · g</b></td>
              {s.grad.map((v, j) => <td key={j} className="num" style={tone(v)}><b>{fmt(v)}</b></td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="viz-grid2" style={{ marginTop: 12 }}>
        <div className="viz-panel">
          <h5>更新后的概率（更新前都是 33.3%）</h5>
          <Bars
            rows={PG_ANSWERS.map((a, j) => ({
              label: `「${a}」${j === PG_CORRECT ? " ✓" : ""}`,
              value: s.probsAfter[j],
              color: j === PG_CORRECT ? "var(--v3)" : "var(--vcrit)",
              text: pct(s.probsAfter[j]),
              hint: `θ = ${s.logitsAfter[j].toFixed(2)}`,
            }))}
          />
          <p className="viz-k" style={{ marginTop: 6 }}>步长 ‖Δθ‖ = {s.stepNorm.toFixed(2)}</p>
        </div>
        <div className="viz-panel">
          <h5>PPO / GRPO 的 clip</h5>
          <p className="viz-k">ρ = π_new / π_old，ε = {EPS}；同一批样本再训一轮时用。</p>
          <table className="viz-table">
            <thead>
              <tr><th>样本</th><th className="num">ρ</th><th className="num">A</th><th>下一轮</th></tr>
            </thead>
            <tbody>
              {samples.map((x, i) => {
                const r = ratios[x.answer];
                const st = clipStatus(r, s.weights[i], EPS);
                return (
                  <tr key={i}>
                    <td>{i + 1}「{PG_ANSWERS[x.answer]}」</td>
                    <td className="num">{r.toFixed(2)}</td>
                    <td className="num" style={tone(s.weights[i])}>{fmt(s.weights[i])}</td>
                    <td style={st === "clipped" ? { color: "#b26b00" } : undefined}>{st === "clipped" ? "已越过 1 ± ε，截断" : "还在信任区内"}</td>
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

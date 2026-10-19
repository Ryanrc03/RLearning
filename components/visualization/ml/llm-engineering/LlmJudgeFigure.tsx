"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import {
  agreementWithHuman,
  countVerdicts,
  gsbScores,
  JUDGE_SCENARIOS,
  type JudgeMode,
  netInterval,
  signTestP,
  simulateJudge,
  type Verdict,
  verdictsFor,
  wilsonInterval,
} from "@/lib/ml/judge";

// Page 4 of LLM Engineering: 120 seeded prompts, each answered by the old and the
// new model and judged side by side. Switch who sits in slot A and watch an LLM
// judge's position bias turn into a "significant" win rate; judge both orders
// and average to cancel it. Every number comes from lib/ml/judge.ts.

type Scenario = keyof typeof JUDGE_SCENARIOS;

const MODES: { key: JudgeMode; label: string }[] = [
  { key: "newFirst", label: "新模型放 A 位，判一次" },
  { key: "newSecond", label: "新模型放 B 位，判一次" },
  { key: "swapped", label: "交换顺序判两次取平均" },
  { key: "human", label: "人工标注" },
];
const MODE_SHORT: Record<JudgeMode, string> = { newFirst: "新在 A 位", newSecond: "新在 B 位", swapped: "交换判两次", human: "人工" };
const SCENARIOS: { key: Scenario; label: string }[] = [
  { key: "better", label: "新模型确实更好" },
  { key: "equal", label: "两个模型一样好" },
];
const VERDICT_TEXT: Record<Verdict, string> = { G: "Good：新的更好", S: "Same：差不多", B: "Bad：新的更差" };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;
const pFmt = (p: number) => (p < 0.001 ? "< 0.001" : p.toFixed(3));

export default function LlmJudgeFigure() {
  const [mode, setMode] = useState<JudgeMode>("newFirst");
  const [scenario, setScenario] = useState<Scenario>("better");
  const pairs = useMemo(() => simulateJudge(JUDGE_SCENARIOS[scenario]), [scenario]);

  const rows = useMemo(
    () =>
      MODES.map(({ key }) => {
        const c = countVerdicts(verdictsFor(pairs, key));
        return { key, c, s: gsbScores(c), p: signTestP(c.G, c.B), agree: agreementWithHuman(pairs, key) };
      }),
    [pairs],
  );
  const cur = rows.find((r) => r.key === mode)!;
  const human = rows.find((r) => r.key === "human")!;
  const { c, s } = cur;
  const winCi = wilsonInterval(c.G, c.G + c.B);
  const netCi = netInterval(c);
  const flips = pairs.filter((p) => !p.consistent).length;

  const reset = () => {
    setMode("newFirst");
    setScenario("better");
  };

  const gap = s.winRate - human.s.winRate;
  const significant = cur.p < 0.05;
  let tone: "good" | "bad" | "warn" | "mid" = "mid";
  let narr: string;
  if (mode === "human") {
    narr =
      scenario === "better"
        ? `人工标注是这组数据的「真值」：G / (G + B) = ${pct(s.winRate)}，(G − B) / N = ${signed(s.net)}，sign test p ${pFmt(cur.p)}，新模型确实更好。评委模型的任务就是在不请人的情况下复现这一行。`
        : `两个模型其实一样好，人工标注 G 和 B 几乎对半（${c.G} 比 ${c.B}），胜率 ${pct(s.winRate)}，p = ${pFmt(cur.p)}，不显著。这才是正确答案。`;
  } else if (mode === "swapped") {
    tone = "good";
    narr = `每对判两次（新的在 A 位一次、在 B 位一次），把两次的偏好分取平均，「先读到的加分」正好抵消：胜率 ${pct(s.winRate)}，人工是 ${pct(human.s.winRate)}，和人工一致率 ${pct(cur.agree)}。代价是评委调用翻倍；${flips} 对（${pct(flips / pairs.length)}）两种顺序给出的结论不一样，这个比例本身就是位置偏差的体检报告。`;
  } else {
    const side = mode === "newFirst" ? "A 位（先读到）" : "B 位（后读到）";
    tone = Math.abs(gap) > 0.08 ? "bad" : "warn";
    narr =
      scenario === "equal" && significant
        ? `两个模型一样好，但新模型坐在 ${side}，评委就给出 ${pct(s.winRate)} 的胜率，sign test p ${pFmt(cur.p)}，「显著」地${s.winRate > 0.5 ? "更好" : "更差"}。这个显著是评委的位置偏差，不是模型的差别：同样 120 对，换个座位结论就反过来。`
        : `新模型坐在 ${side}判一次：胜率 ${pct(s.winRate)}，人工是 ${pct(human.s.winRate)}，差了 ${gap >= 0 ? "+" : "−"}${Math.abs(gap * 100).toFixed(1)} 个百分点；和人工的一致率只有 ${pct(cur.agree)}。评委先读到谁就偏向谁，单次判断把这份偏差原样记进了胜率。`;
  }

  return (
    <VisualizationFrame
      title="同一批 120 对回答，换一下座位胜率就变了"
      description="每个格子是一个 prompt：旧模型和新模型各答一次，评委判新模型 Good / Same / Bad。评委有位置偏差：先读到的回答会被多加一点分。上面切换判法，下面切换两个模型是不是真的有差别。"
    >
      <div className="viz-row">
        <Tabs options={MODES} value={mode} onChange={setMode} ariaLabel="判法" />
      </div>
      <div className="viz-row">
        <div className="viz-chips" role="group" aria-label="场景">
          {SCENARIOS.map((o) => (
            <button key={o.key} type="button" className={`viz-chip${scenario === o.key ? " is-on" : ""}`} onClick={() => setScenario(o.key)} aria-pressed={scenario === o.key}>
              {o.label}
            </button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <div className="viz-grid2 wide-left">
        <div className="viz-panel">
          <h5>120 对的判决 · {MODE_SHORT[mode]}</h5>
          <div className="judge-grid" role="img" aria-label={`${MODE_SHORT[mode]}：G ${c.G}，S ${c.S}，B ${c.B}`}>
            {pairs.map((p, i) => {
              const v = p[mode];
              const off = mode !== "human" && v !== p.human;
              return <span key={i} className={`judge-cell is-${v}${off ? " is-off" : ""}`} title={`#${i + 1} ${VERDICT_TEXT[v]}；人工：${VERDICT_TEXT[p.human]}`} />;
            })}
          </div>
          <div className="judge-stack" aria-hidden="true">
            {(["G", "S", "B"] as const).map((k) => (
              <span key={k} className={`is-${k}`} style={{ width: `${(c[k] / s.n) * 100}%` }}>{c[k] > 6 ? `${k} ${c[k]}` : ""}</span>
            ))}
          </div>
          <div className="viz-legend">
            <span><i className="judge-sw is-G" />Good {c.G}</span>
            <span><i className="judge-sw is-S" />Same {c.S}</span>
            <span><i className="judge-sw is-B" />Bad {c.B}</span>
            {mode !== "human" && <span><i className="judge-sw is-off" />和人工标注不一样</span>}
          </div>
        </div>

        <div className="viz-panel">
          <h5>两种胜率，以及它是不是运气</h5>
          <div className="viz-stat">
            <div><small>(G − B) / N</small><b>{signed(s.net)}</b><span className="delta">95% CI {signed(netCi[0])} ~ {signed(netCi[1])}</span></div>
            <div><small>G / (G + B)</small><b>{pct(s.winRate)}</b><span className="delta">95% CI {pct(winCi[0])} ~ {pct(winCi[1])}</span></div>
            <div><small>sign test（只看 G 对 B）</small><b style={{ color: significant ? "#087a08" : undefined }}>p {pFmt(cur.p)}</b><span className="delta">{significant ? "显著" : "不显著"}</span></div>
            <div><small>和人工标注一致</small><b>{pct(cur.agree)}</b><span className="delta">{mode === "human" ? "自己" : `${pairs.length} 对里 ${Math.round(cur.agree * pairs.length)} 对`}</span></div>
          </div>
          <p className="viz-k" style={{ marginTop: 8 }}>S 多的时候两种分数分得最开：G / (G + B) 把平局扔掉，(G − B) / N 把平局算进分母。</p>
        </div>
      </div>

      <div className="viz-scroll" style={{ marginTop: 12 }}>
        <table className="viz-table judge-table">
          <thead>
            <tr>
              <th>判法</th>
              <th className="num">G / S / B</th>
              <th className="num">(G − B) / N</th>
              <th className="num">G / (G + B)</th>
              <th className="num">sign test p</th>
              <th className="num">和人工一致</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.key === mode ? "is-cur" : undefined}>
                <td>{MODE_SHORT[r.key]}</td>
                <td className="num">{r.c.G} / {r.c.S} / {r.c.B}</td>
                <td className="num">{signed(r.s.net)}</td>
                <td className="num">{pct(r.s.winRate)}</td>
                <td className="num">{pFmt(r.p)}</td>
                <td className="num">{pct(r.agree)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`viz-narr${tone === "good" ? " is-good" : tone === "bad" ? " is-bad" : tone === "warn" ? " is-warn" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}

"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { gauc, GAUC_USERS, gaucToyScores, perUserAuc } from "@/lib/ml/gauc";
import { auc } from "@/lib/ml/metrics";

// Recommender Systems: six users whose own click rates span 0.17–0.79. The score
// is β·(who the user is) + (rank inside the user). Dragging β moves the global
// AUC; GAUC, an average of per-user AUCs, cannot see a per-user shift.

type Mode = "within" | "user-only";
const MODES = [
  { key: "within" as Mode, label: "用户内也会排序" },
  { key: "user-only" as Mode, label: "只认得是谁" },
];

const W = 440;
const H = 300;
const X0 = 40;
const X1 = W - 10;
const Y0 = H - 34;
const Y1 = 30;
const colW = (X1 - X0) / GAUC_USERS.length;
const sy = (v: number) => Y0 - v * (Y0 - Y1);

export default function GaucFigure() {
  const [mode, setMode] = useState<Mode>("within");
  const [beta, setBeta] = useState(0.6);
  const items = useMemo(() => gaucToyScores(beta, mode === "within"), [beta, mode]);
  const per = perUserAuc(items);
  const g = gauc(items);
  const a = auc(items);
  const a0 = useMemo(() => auc(gaucToyScores(0, mode === "within")), [mode]);

  const reset = () => {
    setMode("within");
    setBeta(0.6);
  };

  let tone = "is-warn";
  let narr = `β = ${beta.toFixed(2)}：分数里混进了「这是谁」。全局 AUC ${a.toFixed(3)}，GAUC ${g.toFixed(3)}。往右拖，高点击率用户的点整体上移，全局 AUC 跟着变，GAUC 纹丝不动：它只在每一列里比高低。`;
  if (mode === "user-only") {
    tone = "is-bad";
    narr =
      beta === 0
        ? "β = 0：所有曝光同一个分数，AUC 和 GAUC 都是 0.500。往右拖，模型开始认得「这是哪个用户」。"
        : `模型只知道每个用户平均爱点多少，同一列里分数全一样：GAUC ${g.toFixed(3)}，对任何一个用户的排序毫无用处；全局 AUC 却有 ${a.toFixed(3)}，因为它在拿高点击率用户的曝光和低点击率用户的比。`;
  } else if (beta === 0) {
    tone = "is-good";
    narr = `β = 0：分数只反映用户内的偏好。全局 AUC ${a.toFixed(3)}、GAUC ${g.toFixed(3)}。往右拖，看哪一个会变。`;
  }

  return (
    <VisualizationFrame
      title="AUC 混算了用户之间的差别，GAUC 只看用户之内"
      description="6 个用户，各自的点击率从 0.17 到 0.79（kuairank 用户的 p5–p95），每人 30 次曝光。每一列是一个用户，点的高度是模型分数，实心 = 点了。"
      footnote="玩具数据：label ~ Bernoulli(σ(logit(用户点击率) + z))，分数 = σ(β·logit(用户点击率) + γ·(z + 噪声))，γ 在「只认得是谁」下为 0。"
    >
      <div className="viz-controls">
        <Tabs ariaLabel="模型类型" value={mode} onChange={setMode} options={MODES} />
        <Slider label="β：分数里「这是谁」的分量" value={beta} min={0} max={1.5} step={0.05} onChange={setBeta} display={beta.toFixed(2)} id="gauc-beta" />
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>
      <div className="viz-grid2 wide-left">
        <Figure width={W} height={H} label={`全局 AUC ${a.toFixed(3)}，GAUC ${g.toFixed(3)}`} minWidth={360}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={X0} y1={sy(t)} x2={X1} y2={sy(t)} stroke="#e4dfcb" />
              <text x={X0 - 6} y={sy(t) + 4} fontSize={11} textAnchor="end" fill="#76796f">{t}</text>
            </g>
          ))}
          <text x={X0} y={16} fontSize={11} fill="#76796f">模型分数</text>
          {GAUC_USERS.map((base, u) => {
            const cx = X0 + colW * (u + 0.5);
            const ua = per.find((p) => p.user === u);
            return (
              <g key={u}>
                <text x={cx} y={Y0 + 16} fontSize={11} textAnchor="middle" fill="#3b4234">用户 {u + 1}</text>
                <text x={cx} y={Y0 + 29} fontSize={10.5} textAnchor="middle" fill="#76796f">点击率 {base}</text>
                <text x={cx} y={Y1 - 6} fontSize={10.5} textAnchor="middle" fill="var(--v1)" fontWeight={600} className="mono">
                  {ua ? ua.auc.toFixed(2) : "—"}
                </text>
              </g>
            );
          })}
          {items.map((it, i) => {
            const u = it.user;
            const k = i % 30;
            const cx = X0 + colW * (u + 0.5) + ((k % 6) - 2.5) * 6;
            return (
              <circle key={i} cx={cx} cy={sy(it.score)} r={3.4} fill={it.label ? "var(--v1)" : "#fff"} stroke={it.label ? "var(--v1)" : "#9a9c8d"} strokeWidth={1.3} style={{ transition: "cy .35s" }} />
            );
          })}
        </Figure>
        <div className="viz-panel">
          <h5>同一批 180 次曝光</h5>
          <table className="viz-table">
            <tbody>
              <tr><td>全局 AUC</td><td className="num"><b>{a.toFixed(3)}</b></td></tr>
              <tr><td>β = 0 时的全局 AUC</td><td className="num">{a0.toFixed(3)}</td></tr>
              <tr><td>GAUC（按曝光数加权）</td><td className="num"><b>{g.toFixed(3)}</b></td></tr>
            </tbody>
          </table>
          <p className="viz-k" style={{ marginTop: 10 }}>
            列顶的蓝色数字是该用户自己的 AUC。GAUC 是它们按每个用户的曝光数加权的平均；只有正例或只有负例的用户算不出 AUC，直接跳过。
          </p>
        </div>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: "var(--v1)" }} />点了</span>
        <span><i style={{ background: "#fff", border: "1.3px solid #9a9c8d" }} />没点</span>
      </div>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

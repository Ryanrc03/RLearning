"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import { routeToken, type MoEToken } from "@/lib/ml/deepseek-moe";

const expertOutputs = [2, 4, 2, 4];
const examples: { label: string; token: MoEToken }[] = [
  { label: "token A：猫", token: { scores: [Math.log(4), Math.log(2), 0, 0], expertOutputs, sharedOutput: 1, topK: 2, target: 1 } },
  { label: "token B：狗", token: { scores: [0, 0, Math.log(4), Math.log(2)], expertOutputs, sharedOutput: 1, topK: 2, target: 1 } },
];

const round = (value: number) => value.toFixed(3).replace("-", "−");

export default function DeepSeekMoEFigure() {
  const [index, setIndex] = useState(0);
  const { label, token } = examples[index];
  const result = routeToken(token);
  return (
    <VisualizationFrame
      title="一个 token 怎样经过共享专家与路由专家"
      description="把整体图中的一个 MoE FFN 放大。教学算例缩成 1 个共享专家 + 4 个路由专家（选 2 个）；下一张图沿用 A、B 两个 token，走完一次训练。论文的 16B 配置是 2 + 64（选 6）。"
    >
      <div className="viz-row">
        <div className="viz-chips" aria-label="选择 token">
          {examples.map((example, i) => (
            <button key={example.label} type="button" className={`viz-chip${index === i ? " is-on" : ""}`} aria-pressed={index === i} onClick={() => setIndex(i)}>{example.label}</button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={() => setIndex(0)}>重置</button>
      </div>
      <Figure width={720} height={360} minWidth={580} label={`${label} 选中路由专家 ${result.selected.map((i) => i + 1).join("、")}，输出 ${round(result.output)}`}>
        <text x="22" y="32" fontSize="13" fontWeight="600" fill="#3b4234">{label}</text>
        <rect x="20" y="138" width="100" height="62" rx="7" fill="#fff" stroke="var(--v1)" strokeWidth="2" />
        <text x="70" y="165" textAnchor="middle" fontSize="13" fill="#3b4234">输入 h</text>
        <text x="70" y="184" textAnchor="middle" fontSize="11" fill="#76796f">一个 token</text>
        <line x1="120" y1="169" x2="180" y2="169" stroke="var(--v1)" strokeWidth="2" />
        <rect x="180" y="132" width="106" height="74" rx="7" fill="#fff" stroke="var(--v1)" strokeWidth="2" />
        <text x="233" y="160" textAnchor="middle" fontSize="13" fill="#3b4234">Router</text>
        <text x="233" y="181" textAnchor="middle" fontSize="11" fill="#76796f">softmax → top 2</text>
        {token.scores.map((_, i) => {
          const y = 30 + i * 65;
          const selected = result.selected.includes(i);
          return (
            <g key={i}>
              <line x1="286" y1="168" x2="342" y2={y + 27} stroke={selected ? "var(--v2)" : "var(--vline)"} strokeWidth={selected ? 2.5 : 1.5} />
              <rect x="342" y={y} width="183" height="54" rx="6" fill={selected ? "#fdf1eb" : "#f5f3eb"} stroke={selected ? "var(--v2)" : "var(--vline)"} />
              <text x="353" y={y + 20} fontSize="12" fontWeight="600" fill="#3b4234">路由专家 {i + 1}</text>
              <text x="353" y={y + 40} fontSize="11" fill="#76796f">s={round(result.affinities[i])} · g={round(result.gates[i])} · E={round(token.expertOutputs[i])}</text>
              {selected && <line x1="525" y1={y + 27} x2="592" y2="168" stroke="var(--v2)" strokeWidth="2.5" />}
            </g>
          );
        })}
        <path d="M 94 200 V 326 H 342" fill="none" stroke="var(--v3)" strokeWidth="2" />
        <rect x="342" y="296" width="183" height="54" rx="6" fill="#eaf8f2" stroke="var(--v3)" />
        <text x="353" y="317" fontSize="12" fontWeight="600" fill="#3b4234">共享专家（必经）</text>
        <text x="353" y="337" fontSize="11" fill="#76796f">输出 {round(token.sharedOutput)} · 不参与 top-k</text>
        <path d="M 525 323 H 565 V 185 H 592" fill="none" stroke="var(--v3)" strokeWidth="2" />
        <rect x="592" y="128" width="105" height="81" rx="7" fill="#fff" stroke="var(--v4)" strokeWidth="2" />
        <text x="644" y="155" textAnchor="middle" fontSize="12" fill="#3b4234">加权求和</text>
        <text x="644" y="178" textAnchor="middle" fontSize="15" fontWeight="600" fill="#3b4234">{round(result.output)}</text>
        <text x="644" y="195" textAnchor="middle" fontSize="10.5" fill="#76796f">logit</text>
      </Figure>
      <div className="viz-stat">
        <div><small>路由专家的加权和</small><b>{round(result.output - token.sharedOutput)}</b></div>
        <div><small>共享专家的输出</small><b>{round(token.sharedOutput)}</b></div>
        <div><small>该 token 执行的专家</small><b>1 + {result.selected.length}</b></div>
      </div>
      <div className="viz-narr">
        {label} 的 router 对四个分数先做 softmax，再只保留专家 {result.selected.map((i) => i + 1).join("、")} 的门值；共享专家始终执行。此处输出 = {round(token.sharedOutput)} + {result.selected.map((i) => `${round(result.gates[i])} × ${round(token.expertOutputs[i])}`).join(" + ")} = {round(result.output)}。灰色专家这次没有 FFN 前向计算。
      </div>
    </VisualizationFrame>
  );
}

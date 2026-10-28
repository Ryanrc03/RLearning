"use client";

import { useId, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { binaryCrossEntropy, weightedLoss } from "@/lib/ml/ranking";

const tasks = ["CTR · 点击", "Like · 点赞", "Favorite · 收藏", "Share · 转发"];
const colors = ["var(--v1)", "var(--v2)", "var(--v3)", "var(--v4)"];
const probabilities = [0.6, 0.2, 0.1, 0.05];
const labels = [1, 0, 0, 0];
const weights = [0.4, 0.3, 0.2, 0.1];

export default function RankingArchitectureFigure() {
  const [mode, setMode] = useState<"inference" | "training">("inference");
  const arrow = `ranking-${useId().replace(/:/g, "")}`;
  const training = mode === "training";
  const line = (x1: number, y1: number, x2: number, y2: number, color = "var(--muted)") => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.4" markerEnd={`url(#${arrow})`} />
  );
  const box = (x: number, y: number, width: number, text: string, color = "var(--vline)") => (
    <g><rect x={x} y={y} width={width} height="34" rx="5" fill="var(--paper)" stroke={color} /><text x={x + width / 2} y={y + 21} textAnchor="middle" fill="var(--ink)" fontSize="12">{text}</text></g>
  );
  return (
    <div className="ranking-viz">
      <VisualizationFrame title="Shared-Bottom：共享表示，独立任务头" description="实线表示前向数据流。切换训练视图，观察同一组预测如何组成总损失。手机上可横向滚动查看。">
        <div className="viz-row">
          <Tabs options={[{ key: "inference", label: "线上打分" }, { key: "training", label: "联合训练" }]} value={mode} onChange={setMode} ariaLabel="架构视图" />
          <button type="button" className="viz-btn" onClick={() => setMode("inference")}>重置</button>
        </div>
        <Figure width={720} height={520} minWidth={600} label={training ? "四个任务头的独立 BCE 损失加权汇总，梯度共同更新共享 DNN" : "四类输入拼接后经过共享 DNN，分为四个独立 Sigmoid 任务头，再校准并融合得到排序"}>
          <defs><marker id={arrow} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="context-stroke" /></marker></defs>
          {["User Features", "Item Features", "Statistical Features", "Context Features"].map((name, i) => <g key={name}>{box(12 + i * 177, 8, 165, name)}{line(94 + i * 177, 42, 94 + i * 177, 61)}</g>)}
          <path d="M94 61 H625 M360 61 V76" fill="none" stroke="var(--muted)" markerEnd={`url(#${arrow})`} />
          {box(185, 78, 350, "Concatenation · x = [e_user; e_item; e_stat; e_context]")}
          {line(360, 112, 360, 131)}
          <rect x="155" y="131" width="410" height="83" rx="7" fill="var(--paper)" stroke="var(--v1)" strokeDasharray="5 3" />
          <text x="360" y="158" textAnchor="middle" fill="var(--ink)" fontSize="14">Shared DNN · fθ(x)</text>
          <text x="360" y="186" textAnchor="middle" fill="var(--muted)" fontSize="12">共享参数 θ → Shared Representation h</text>
          <path d="M360 214 V232 M94 232 H625" fill="none" stroke="var(--muted)" />
          {tasks.map((task, i) => {
            const x = 12 + i * 177;
            return <g key={task}>
              {line(x + 82, 232, x + 82, 250, colors[i])}
              {box(x, 250, 165, task, colors[i])}
              <text x={x + 82} y="303" textAnchor="middle" fill="var(--muted)" fontSize="12">Wₖ h + bₖ → Sigmoid</text>
              {line(x + 82, 310, x + 82, 327, colors[i])}
              {box(x, 329, 165, training ? `p = ${probabilities[i].toFixed(2)} · y = ${labels[i]}` : `p_${["CTR", "Like", "Favorite", "Share"][i]}`, colors[i])}
              {training && <>{line(x + 82, 363, x + 82, 382, colors[i])}{box(x, 384, 165, `BCE = ${binaryCrossEntropy(labels[i], probabilities[i]).toFixed(4)}`, colors[i])}<text x={x + 82} y="438" textAnchor="middle" fill="var(--muted)" fontSize="12">λ = {weights[i].toFixed(1)}</text>{line(x + 82, 445, x + 82, 456, colors[i])}</>}
            </g>;
          })}
          {training ? <>
            <path d="M94 456 H625 M360 456 V474" fill="none" stroke="var(--muted)" markerEnd={`url(#${arrow})`} />
            {box(155, 476, 410, `Total Loss = Σ λₖ BCEₖ = ${weightedLoss(labels, probabilities, weights).toFixed(4)}`)}
          </> : <>
            <path d="M94 363 V379 H625 V363 M271 363 V379 M448 363 V379 M360 379 V395" fill="none" stroke="var(--muted)" markerEnd={`url(#${arrow})`} />
            {box(155, 397, 410, "Probability Calibration · 按各任务的采样率校准")}
            {line(360, 431, 360, 449)}
            {box(155, 451, 410, "Multi-Objective Fusion → Ranking Score → 排序")}
            <text x="360" y="510" textAnchor="middle" fill="var(--muted)" fontSize="12">多个行为可同时发生：独立 Sigmoid，不用统一 Softmax</text>
          </>}
        </Figure>
        <div className="viz-narr">{training ? "演示标签与预测并非课程实测值。每个任务用自己的标签计算 BCE；各任务梯度按 λ 加权，共同更新 θ，任务头只更新自身参数。" : "虚线框内是共享层；蓝、橙、绿、黄是任务专属分支。每个概率必须注明样本空间，融合前先处理各自的采样偏差。"}</div>
      </VisualizationFrame>
    </div>
  );
}

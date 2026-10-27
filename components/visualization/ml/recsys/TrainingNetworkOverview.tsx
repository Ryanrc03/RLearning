import { useId } from "react";
import Figure from "@/components/visualization/ml/primitives/Figure";
import { BOTTOM, EMB_DIM, N_DENSE, N_FIELDS, TASKS, TOWER, x0Dim } from "@/lib/ml/trainingSetup";

export default function TrainingNetworkOverview({ step }: { step: number }) {
  const id = useId().replace(/:/g, "");
  const active = (stage: number) => step === stage ? "var(--v1)" : "var(--vline)";
  const arrow = `url(#${id}-forward)`;
  const back = `url(#${id}-back)`;
  return (
    <div className="viz-panel" style={{ marginBottom: 16 }}>
      <h5>真实网络全景 · 当前步骤用蓝框定位</h5>
      <Figure width={720} height={510} minWidth={660} label="类别特征经词表和 embedding 查表，与数值特征拼接，经过共享网络和四个任务塔得到概率；损失沿虚线反传到 embedding">
        <defs>
          <marker id={`${id}-forward`} viewBox="0 0 8 8" refX={7} refY={4} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L8 4 L0 8" fill="var(--v3)" /></marker>
          <marker id={`${id}-back`} viewBox="0 0 8 8" refX={7} refY={4} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L8 4 L0 8" fill="var(--v2)" /></marker>
        </defs>
        <g fill="none" stroke="var(--v3)" strokeWidth={1.5} markerEnd={arrow}>
          <path d="M132 92 H157" /><path d="M270 92 H293" /><path d="M492 124 H525" />
          <path d="M450 218 H508 V157 H525" /><path d="M610 174 V245" />
          <path d="M610 305 V326 H100 V343" /><path d="M610 326 H270 V343" />
          <path d="M610 326 H440 V343" /><path d="M610 326 V343" />
          {[100, 270, 440, 610].map(x => <path key={x} d={`M${x} 416 V453`} />)}
        </g>
        <g fontSize={12} fill="var(--ink)">
          <rect x={12} y={40} width={120} height={110} rx={7} fill="white" stroke={active(0)} strokeWidth={2} />
          <text x={24} y={61} fontWeight={600}>一行曝光</text>
          <text x={24} y={85}>tag_first = 12</text><text x={24} y={107}>tab = 1</text><text x={24} y={130}>…{N_FIELDS} 个类别域</text>
          <rect x={158} y={40} width={112} height={110} rx={7} fill="white" stroke={active(1)} strokeWidth={2} />
          <text x={170} y={61} fontWeight={600}>固定词表</text><text x={170} y={85}>12 → 编号 13</text>
          <text x={170} y={107}>编号没有大小含义</text><text x={170} y={130}>0 = 缺失 / OOV</text>
          <rect x={294} y={20} width={198} height={166} rx={7} fill="white" stroke={active(2)} strokeWidth={2} />
          <text x={306} y={41} fontWeight={600}>tag 表 E：58 × {EMB_DIM}</text>
          <text x={306} y={61} fill="var(--muted)">行 = 类别，列 = 可学坐标</text>
          {[11, 12, 13, 14].map((row, r) => (
            <g key={row}>
              <text x={307} y={86 + r * 21} fill={row === 13 ? "var(--v1)" : "var(--muted)"}>{row}</text>
              {Array.from({ length: 8 }, (_, c) => <rect key={c} x={334 + c * 17} y={74 + r * 21} width={14} height={16} rx={2} fill={row === 13 ? "var(--v1)" : "var(--vline)"} opacity={row === 13 ? 0.35 + c * 0.08 : 0.65} />)}
            </g>
          ))}
          <text x={306} y={174} fill="var(--muted)">取第 13 行 · 仅画出 8 / {EMB_DIM} 列</text>
          <rect x={526} y={67} width={170} height={107} rx={7} fill="white" stroke={active(3)} strokeWidth={2} />
          <text x={539} y={89} fontWeight={600}>拼接 x₀：{x0Dim()} 维</text>
          <text x={539} y={112}>{N_FIELDS} 张表各取 1 行</text><text x={539} y={135}>{N_FIELDS} × {EMB_DIM} + {N_DENSE}</text>
          <text x={539} y={157}>向量拼接，不取平均</text>
          <rect x={12} y={195} width={438} height={47} rx={7} fill="white" stroke={active(step === 0 ? 0 : 1)} strokeWidth={2} />
          <text x={24} y={215} fontWeight={600}>数值分支 · {N_DENSE} 列</text>
          <text x={24} y={232}>时长、历史 CTR… → 固定变换与标准化 → 直接拼入 x₀</text>
          <rect x={526} y={245} width={170} height={60} rx={7} fill="white" stroke={active(4)} strokeWidth={2} />
          <text x={539} y={267} fontWeight={600}>共享 bottom MLP</text><text x={539} y={289}>{x0Dim()} → {BOTTOM.join(" → ")}</text>
          <text x={12} y={280} fill="var(--v3)">实线：输入与预测向前走</text>
          <text x={12} y={300} fill="var(--v2)">虚线：损失的梯度向后走</text>
          {TASKS.map((task, k) => (
            <g key={task.key}>
              <rect x={24 + k * 170} y={343} width={152} height={73} rx={7} fill="white" stroke={active(4)} strokeWidth={2} />
              <text x={36 + k * 170} y={363} fontWeight={600}>{task.name}塔</text>
              <text x={36 + k * 170} y={385}>{BOTTOM.at(-1)} → {TOWER[0]} → 1</text>
              <text x={36 + k * 170} y={404}>sigmoid → p{k + 1}</text>
            </g>
          ))}
          <rect x={24} y={453} width={662} height={40} rx={7} fill="white" stroke={active(5)} strokeWidth={2} />
          <text x={40} y={478}>4 个概率 + 4 个真实标签 → 各算 BCE → 相加为 loss → backward → Adam</text>
        </g>
        <g fill="none" stroke="var(--v2)" strokeWidth={step === 6 ? 2.5 : 1.5} strokeDasharray="5 4" markerEnd={back}>
          <path d="M678 453 H709 V275 H696" />
          <path d="M526 275 H504 V124 H470" />
        </g>
      </Figure>
      <p className="viz-k">embedding 是网络的一层参数；编号和数值预处理固定。四个塔的梯度在共享层相加，再传到查到的 embedding 行。</p>
    </div>
  );
}

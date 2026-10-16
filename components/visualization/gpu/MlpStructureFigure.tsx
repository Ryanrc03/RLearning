import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const LINE = "#76796f";
const INK = "#3b4234";
const EDGE = "#d9d5c3";

// Four drawn neurons, a gap for "⋮", then the last neuron.
const YS = [44, 66, 88, 110, 152];
const COLS = [
  { x: 90, color: C1, title: "输入层", sub: "512 个数" },
  { x: 300, color: C2, title: "隐藏层", sub: "512 个神经元" },
  { x: 510, color: C3, title: "输出层", sub: "512 个神经元" },
];
const HIGHLIGHT = 1; // hidden neuron whose incoming weights are drawn in orange

function Edges({ from, to, highlight }: { from: number; to: number; highlight?: number }) {
  return (
    <g>
      {YS.map((y1, i) =>
        YS.map((y2, j) => {
          const hot = highlight === j;
          return <line key={`${i}-${j}`} x1={from + 9} y1={y1} x2={to - 9} y2={y2} stroke={hot ? C2 : EDGE} strokeWidth={hot ? 1.3 : 0.8} opacity={hot ? 0.9 : 1} />;
        }),
      )}
    </g>
  );
}

// Static picture of the exp2 network in the usual deep-learning style: neurons and full connections.
export default function MlpStructureFigure() {
  return (
    <VisualizationFrame
      title="exp2 的模型：两层全连接网络（MLP）"
      description="每个圆是一个神经元，相邻两层之间两两相连，所以叫全连接。图里每层只画了 5 个，实际每层 512 个。"
      footnote="橙色线是隐藏层某一个神经元收到的输入：512 个输入各乘一个权重再加起来，加上 bias，最后过 ReLU（负数变 0）。一层 512 个神经元都这样算，合起来就是一次矩阵乘。"
    >
      <div className="viz-scroll">
        <svg viewBox="0 0 600 214" role="img" aria-label="输入层 512 个数，全连接到隐藏层 512 个神经元，再全连接到输出层 512 个神经元。每层先乘权重、加 bias，再过 ReLU。">
          <Edges from={COLS[0].x} to={COLS[1].x} highlight={HIGHLIGHT} />
          <Edges from={COLS[1].x} to={COLS[2].x} />

          <text x={195} y={18} fontSize={10} fontWeight={600} textAnchor="middle" fill={INK}>第 1 层</text>
          <text x={195} y={31} fontSize={9} textAnchor="middle" fill={LINE}>权重 W₁（512×512）＋ bias → ReLU</text>
          <text x={405} y={18} fontSize={10} fontWeight={600} textAnchor="middle" fill={INK}>第 2 层</text>
          <text x={405} y={31} fontSize={9} textAnchor="middle" fill={LINE}>权重 W₂（512×512）＋ bias → ReLU</text>

          {COLS.map((col, c) => (
            <g key={c}>
              {YS.map((y, i) => (
                <circle key={i} cx={col.x} cy={y} r={9} fill="#fff" stroke={c === 1 && i === HIGHLIGHT ? C2 : col.color} strokeWidth={c === 1 && i === HIGHLIGHT ? 2.4 : 1.5} />
              ))}
              <text x={col.x} y={136} fontSize={13} textAnchor="middle" fill={LINE}>⋮</text>
              <text x={col.x} y={182} fontSize={10} fontWeight={600} textAnchor="middle" fill={col.color}>{col.title}</text>
              <text x={col.x} y={196} fontSize={9} textAnchor="middle" fill={LINE}>{col.sub}</text>
            </g>
          ))}
          <text x={300} y={211} fontSize={9} textAnchor="middle" fill={LINE}>一次喂进去 B 个样本（batch），每个样本都走一遍这张网络；实验里还测了更宽的版本（每层 1024 到 4096）</text>
        </svg>
      </div>
    </VisualizationFrame>
  );
}

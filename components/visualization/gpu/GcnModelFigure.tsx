import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const LINE = "#76796f";
const INK = "#3b4234";
const EDGE = "#cfcab4";

const NODES: { id: string; x: number; y: number; nb?: boolean; center?: boolean }[] = [
  { id: "v", x: 120, y: 112, center: true },
  { id: "a", x: 48, y: 62, nb: true },
  { id: "b", x: 192, y: 56, nb: true },
  { id: "c", x: 56, y: 170, nb: true },
  { id: "d", x: 190, y: 168, nb: true },
  { id: "e", x: 222, y: 108 },
];
const EDGES: [string, string][] = [["v", "a"], ["v", "b"], ["v", "c"], ["v", "d"], ["b", "e"], ["d", "e"]];
const pos = (id: string) => NODES.find((n) => n.id === id)!;

function Feat({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 6} y={0} width={5} height={8} fill={color} opacity={0.35 + i * 0.15} />)}
    </g>
  );
}

function Step({ y, n, title, sub }: { y: number; n: string; title: string; sub: string }) {
  return (
    <g transform={`translate(272 ${y})`}>
      <circle cx={9} cy={9} r={9} fill={C2} opacity={0.85} />
      <text x={9} y={13} fontSize={10} textAnchor="middle" fill="#fff" fontWeight={600}>{n}</text>
      <text x={26} y={8} fontSize={10} fontWeight={600} fill={INK}>{title}</text>
      <text x={26} y={22} fontSize={9} fill={LINE}>{sub}</text>
    </g>
  );
}

function Stack({ y, label, color, strong }: { y: number; label: string; color: string; strong?: boolean }) {
  return (
    <g transform={`translate(468 ${y})`}>
      <rect width={118} height={24} rx={4} fill={color} opacity={strong ? 0.25 : 0.12} stroke={color} strokeWidth={strong ? 1.2 : 0.8} />
      <text x={59} y={16} fontSize={9.5} textAnchor="middle" fill={INK}>{label}</text>
    </g>
  );
}

// Static picture of the exp7 model: one GCN layer on a citation graph, and the two-layer stack.
export default function GcnModelFigure() {
  return (
    <VisualizationFrame
      title="exp7 的模型：两层图卷积网络（GCN）"
      description="节点是论文，边是引用关系，每个节点带一个特征向量（这篇论文里出现了哪些词）。任务是预测每篇论文属于哪个主题。"
    >
      <div className="viz-scroll">
        <svg viewBox="0 0 600 230" role="img" aria-label="一层 GCN：每个节点把自己和邻居的特征加权平均，再乘权重矩阵 W 压到 hidden 维，再过 ReLU。两层叠起来，输出每篇论文属于各个主题的分数。">
          <defs>
            <marker id="gm-arr" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={5} markerHeight={5} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C2} /></marker>
            <marker id="gm-arr2" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={5} markerHeight={5} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={LINE} /></marker>
          </defs>
          {EDGES.map(([s, t]) => {
            const a = pos(s);
            const b = pos(t);
            const hot = s === "v";
            if (!hot) return <line key={s + t} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={EDGE} strokeWidth={1.2} />;
            // draw neighbour → v, stopping at v's rim
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const len = Math.hypot(dx, dy);
            return <line key={s + t} x1={b.x + (dx / len) * 13} y1={b.y + (dy / len) * 13} x2={a.x - (dx / len) * 16} y2={a.y - (dy / len) * 16} stroke={C2} strokeWidth={1.6} markerEnd="url(#gm-arr)" />;
          })}
          {NODES.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={12} fill="#fff" stroke={n.center ? C2 : n.nb ? C1 : EDGE} strokeWidth={n.center ? 2.4 : 1.5} />
              <text x={n.x} y={n.y + 4} fontSize={10} textAnchor="middle" fill={INK}>{n.id}</text>
              <Feat x={n.x + 14} y={n.y - 16} color={n.center ? C2 : C1} />
            </g>
          ))}
          <text x={130} y={210} fontSize={9.5} textAnchor="middle" fill={LINE}>节点 v 从邻居 a、b、c、d 收集特征（橙色箭头）</text>

          <Step y={34} n="1" title="聚合：Â · H" sub="把自己和邻居的特征加权平均" />
          <Step y={84} n="2" title="变换：× W" sub="乘权重矩阵，压到 hidden 维" />
          <Step y={134} n="3" title="ReLU" sub="负数变 0" />
          <text x={272} y={184} fontSize={9} fill={LINE}>一层：H′ = ReLU(Â · H · W)</text>
          <text x={272} y={198} fontSize={9} fill={LINE}>Â 是归一化后的邻接矩阵，很稀疏</text>

          <Stack y={18} label="输入：1433 或 3703 维" color={C1} />
          <line x1={527} y1={44} x2={527} y2={54} stroke={LINE} markerEnd="url(#gm-arr2)" />
          <Stack y={56} label="第 1 层 GCN" color={C2} strong />
          <line x1={527} y1={82} x2={527} y2={92} stroke={LINE} markerEnd="url(#gm-arr2)" />
          <Stack y={94} label="hidden：64/128/256 维" color={C1} />
          <line x1={527} y1={120} x2={527} y2={130} stroke={LINE} markerEnd="url(#gm-arr2)" />
          <Stack y={132} label="第 2 层 GCN" color={C2} strong />
          <line x1={527} y1={158} x2={527} y2={168} stroke={LINE} markerEnd="url(#gm-arr2)" />
          <Stack y={170} label="输出：每个主题的分数" color={C3} />
          <text x={527} y={210} fontSize={9} textAnchor="middle" fill={LINE}>两层叠起来</text>
        </svg>
      </div>
    </VisualizationFrame>
  );
}

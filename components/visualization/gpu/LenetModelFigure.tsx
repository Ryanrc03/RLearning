import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const LINE = "#76796f";
const INK = "#3b4234";

const MID = 92; // vertical centre line of the drawing

function Maps({ x, size, count, color, label, sub, conv }: { x: number; size: number; count: number; color: string; label: string; sub: string; conv?: boolean }) {
  const off = 4;
  return (
    <g>
      {Array.from({ length: count }, (_, i) => count - 1 - i).map((i) => (
        <rect key={i} x={x + i * off} y={MID - size / 2 - i * off} width={size} height={size} fill="#fff" stroke={color} strokeWidth={conv && i === 0 ? 1.6 : 1} />
      ))}
      <text x={x + size / 2 + ((count - 1) * off) / 2} y={160} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={conv ? C2 : INK}>{label}</text>
      <text x={x + size / 2 + ((count - 1) * off) / 2} y={174} fontSize={9} textAnchor="middle" className="mono" fill={LINE}>{sub}</text>
    </g>
  );
}

function Neurons({ x, n, color, label, sub }: { x: number; n: number; color: string; label: string; sub: string }) {
  const step = 15;
  const top = MID - ((n - 1) * step) / 2;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={x} cy={top + i * step} r={5} fill="#fff" stroke={color} strokeWidth={1.3} />
      ))}
      <text x={x} y={160} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={INK}>{label}</text>
      <text x={x} y={174} fontSize={9} textAnchor="middle" className="mono" fill={LINE}>{sub}</text>
    </g>
  );
}

function Arrow({ x1, x2 }: { x1: number; x2: number }) {
  return <line x1={x1} y1={MID} x2={x2} y2={MID} stroke={LINE} strokeWidth={1.1} markerEnd="url(#ln-arr)" />;
}

// Static picture of LeNet-5 as used in exp6: two conv + pool stages, then three fully connected layers.
export default function LenetModelFigure() {
  return (
    <VisualizationFrame
      title="exp6 的模型：LeNet-5"
      description="经典的手写数字识别网络。一张 32×32 的灰度图，经过两次“卷积 + 池化”，再经过三层全连接，输出 10 个数字各自的分数。"
      footnote="橙色的两层是卷积，由 cuDNN 计算，这一页比较的就是它们用哪种算法。池化和全连接层（cuBLAS）在两种算法下完全一样。激活函数是 tanh。"
    >
      <div className="viz-scroll">
        <svg viewBox="0 0 600 190" role="img" aria-label="输入 1@32×32，卷积得 6@28×28，池化得 6@14×14，卷积得 16@10×10，池化得 16@5×5，再经过 120、84、10 个神经元的三层全连接。">
          <defs>
            <marker id="ln-arr" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={5} markerHeight={5} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={LINE} /></marker>
          </defs>
          <Maps x={8} size={58} count={1} color={C1} label="输入" sub="1@32×32" />
          <Arrow x1={70} x2={88} />
          <Maps x={92} size={50} count={6} color={C2} label="卷积 1（5×5）" sub="6@28×28" conv />
          <Arrow x1={166} x2={184} />
          <Maps x={188} size={26} count={6} color={C1} label="池化" sub="6@14×14" />
          <Arrow x1={238} x2={256} />
          <Maps x={260} size={20} count={8} color={C2} label="卷积 2（5×5）" sub="16@10×10" conv />
          <Arrow x1={314} x2={332} />
          <Maps x={336} size={11} count={8} color={C1} label="池化" sub="16@5×5" />
          <Arrow x1={381} x2={405} />
          {[[420, 7, 480, 6], [480, 6, 540, 5]].map(([xa, na, xb, nb]) =>
            Array.from({ length: na * nb }, (_, k) => {
              const i = Math.floor(k / nb);
              const j = k % nb;
              const ya = MID - ((na - 1) * 15) / 2 + i * 15;
              const yb = MID - ((nb - 1) * 15) / 2 + j * 15;
              return <line key={`${xa}-${k}`} x1={xa + 5} y1={ya} x2={xb - 5} y2={yb} stroke="#ddd8c6" strokeWidth={0.6} />;
            }),
          )}
          <Neurons x={420} n={7} color={C3} label="全连接" sub="120" />
          <Neurons x={480} n={6} color={C3} label="全连接" sub="84" />
          <Neurons x={540} n={5} color={C3} label="输出" sub="10" />
        </svg>
      </div>
    </VisualizationFrame>
  );
}

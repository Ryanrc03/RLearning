import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const INK = "#3b4234";

function Cell({ x, y, label, color, strong }: { x: number; y: number; label: string; color: string; strong?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={22} height={22} rx={3} fill={color} opacity={strong ? 0.85 : 0.3} />
      <text x={11} y={15} fontSize={9.5} textAnchor="middle" fill={strong ? "#fff" : INK} className="mono">{label}</text>
    </g>
  );
}

// Static comparison of how much work each byte buys in the two tasks of the page-2 experiment.
export default function ArithmeticIntensityFigure() {
  return (
    <VisualizationFrame title="两个任务：每搬 1 个字节，能算几次" description="一个 float 占 4 字节。左边每个数只用一次；右边每个数会被用很多次。">
      <div className="viz-scroll">
        <svg viewBox="0 0 600 212" role="img" aria-label="数组相加每个元素读 8 字节写 4 字节只算 1 次加法；N×N 矩阵乘里每个数被重复用 N 次，每字节能算 N/6 次。">
          <text x={150} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>数组相加：C[i] = A[i] + B[i]</text>
          <Cell x={70} y={66} label="A[i]" color={C1} />
          <text x={104} y={82} fontSize={13} textAnchor="middle" fill={INK}>+</text>
          <Cell x={116} y={66} label="B[i]" color={C1} />
          <text x={150} y={82} fontSize={13} textAnchor="middle" fill={INK}>=</text>
          <Cell x={162} y={66} label="C[i]" color={C1} strong />
          <text x={150} y={146} fontSize={10} textAnchor="middle" fill={INK}>读 2 个数、写 1 个数 = 12 字节</text>
          <text x={150} y={163} fontSize={10} textAnchor="middle" fill={INK}>只做 1 次加法</text>
          <text x={150} y={185} fontSize={11} textAnchor="middle" fill={INK} fontWeight={600}>每字节 1/12 ≈ 0.08 次运算</text>
          <text x={150} y={201} fontSize={9.5} textAnchor="middle" fill={LINE}>不管数组多长，这个比值都不变</text>

          <line x1={300} y1={10} x2={300} y2={200} stroke="#e4dfcb" strokeDasharray="3 3" />

          <text x={450} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>矩阵乘：两个 N×N 矩阵相乘</text>
          {[0, 1, 2, 3].map((k) => <Cell key={`a${k}`} x={330 + k * 24} y={54} label={k === 1 ? "a" : ""} color={C2} />)}
          <text x={428} y={70} fontSize={13} fill={INK}>×</text>
          {[0, 1, 2, 3].map((k) => <Cell key={`b${k}`} x={448} y={30 + k * 24} label={k === 1 ? "b" : ""} color={C2} />)}
          <text x={480} y={70} fontSize={13} fill={INK}>=</text>
          <Cell x={500} y={54} label="c" color={C2} strong />
          <text x={330} y={46} fontSize={9} fill={LINE}>A 的一行</text>
          <text x={474} y={40} fontSize={9} fill={LINE}>B 的一列</text>
          <text x={450} y={146} fontSize={10} textAnchor="middle" fill={INK}>每个输出要做 N 次乘加；A 的一行会被 N 个输出反复用</text>
          <text x={450} y={163} fontSize={10} textAnchor="middle" fill={INK}>一共算 2N³ 次，最少只需搬 3N² 个数（12N² 字节）</text>
          <text x={450} y={185} fontSize={11} textAnchor="middle" fill={INK} fontWeight={600}>每字节 N/6 次运算</text>
          <text x={450} y={201} fontSize={9.5} textAnchor="middle" fill={LINE}>N 越大，每个数被复用得越多，比值越高</text>
        </svg>
      </div>
    </VisualizationFrame>
  );
}

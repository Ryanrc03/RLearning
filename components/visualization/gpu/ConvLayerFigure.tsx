import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const LINE = "#76796f";
const INK = "#3b4234";

const G = 9; // drawn grid cells per side
const CELL = 11;

// A feature-map plane drawn as a slanted grid, with optional highlighted cells.
function Plane({ x, y, color, hot, opacity = 1 }: { x: number; y: number; color: string; hot?: (r: number, c: number) => boolean; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) skewY(-12)`} opacity={opacity}>
      {Array.from({ length: G * G }, (_, k) => {
        const r = Math.floor(k / G);
        const c = k % G;
        const on = hot?.(r, c);
        return <rect key={k} x={c * CELL} y={r * CELL} width={CELL - 1} height={CELL - 1} fill={on ? color : "#fff"} stroke={color} strokeWidth={0.6} opacity={on ? 0.85 : 1} />;
      })}
    </g>
  );
}

// Static picture of one conv layer in exp5: 32 input channels, a 3×3×32 filter, Cout output channels.
export default function ConvLayerFigure() {
  const win = (r: number, c: number) => r >= 3 && r <= 5 && c >= 3 && c <= 5;
  return (
    <VisualizationFrame
      title="exp5 的计算：一层 2D 卷积"
      description="输入是 32 张叠在一起的特征图（通道）。一个 3×3×32 的卷积核在图上滑动，每停一处算出输出图上的一个点。有几个卷积核，就有几张输出图。"
    >
      <div className="viz-scroll">
        <svg viewBox="0 0 600 220" role="img" aria-label="输入 H×W×32，3×3×32 的卷积核滑过每个位置，做 288 次乘加得到一个输出点；Cout 个卷积核得到 Cout 张输出图。">
          {[4, 3, 2, 1, 0].map((i) => (
            <Plane key={i} x={30 + i * 10} y={70 - i * 8} color={C1} hot={i === 0 ? win : undefined} opacity={i === 0 ? 1 : 0.55} />
          ))}
          <text x={95} y={200} fontSize={10} fontWeight={600} textAnchor="middle" fill={INK}>输入：H × W × 32 通道</text>
          <text x={95} y={214} fontSize={9} textAnchor="middle" fill={LINE}>图里只画了 5 层</text>

          <g transform="translate(232 70)">
            {[2, 1, 0].map((i) => (
              <g key={i} transform={`translate(${i * 8} ${-i * 7}) skewY(-12)`}>
                {Array.from({ length: 9 }, (_, k) => (
                  <rect key={k} x={(k % 3) * 14} y={Math.floor(k / 3) * 14} width={13} height={13} fill={C2} opacity={i === 0 ? 0.8 : 0.4} />
                ))}
              </g>
            ))}
          </g>
          <text x={262} y={150} fontSize={10} fontWeight={600} textAnchor="middle" fill={INK}>卷积核 3 × 3 × 32</text>
          <text x={262} y={164} fontSize={9} textAnchor="middle" fill={LINE}>和输入里同样大小的一块</text>
          <text x={262} y={177} fontSize={9} textAnchor="middle" fill={LINE}>逐个相乘再全部加起来</text>
          <text x={262} y={190} fontSize={9} textAnchor="middle" fill={LINE}>= 288 次乘加</text>

          <line x1={186} y1={98} x2={222} y2={98} stroke={LINE} markerEnd="url(#cl-arr)" />
          <line x1={306} y1={98} x2={372} y2={98} stroke={LINE} markerEnd="url(#cl-arr)" />
          <defs>
            <marker id="cl-arr" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={LINE} /></marker>
          </defs>

          {[3, 2, 1, 0].map((i) => (
            <Plane key={i} x={392 + i * 10} y={70 - i * 8} color={C3} hot={i === 0 ? (r, c) => r === 4 && c === 4 : undefined} opacity={i === 0 ? 1 : 0.55} />
          ))}
          <text x={455} y={200} fontSize={10} fontWeight={600} textAnchor="middle" fill={INK}>输出：H × W × Cout</text>
          <text x={455} y={214} fontSize={9} textAnchor="middle" fill={LINE}>Cout 个卷积核（32 / 64 / 128）</text>
        </svg>
      </div>
    </VisualizationFrame>
  );
}

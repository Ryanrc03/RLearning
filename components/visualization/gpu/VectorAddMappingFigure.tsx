import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const INK = "#3b4234";

const N = 16;
const CELL = 15;

function Arrays({ x, y, tint }: { x: number; y: number; tint: (i: number) => string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {["A", "B", "C"].map((name, r) => (
        <g key={name} transform={`translate(0 ${r * 22})`}>
          <text x={-8} y={11} fontSize={10} textAnchor="end" className="mono" fill={INK}>{name}</text>
          {Array.from({ length: N }, (_, i) => (
            <rect key={i} x={i * (CELL + 1)} y={0} width={CELL} height={CELL} rx={2} fill={tint(i)} opacity={r === 2 ? 0.85 : 0.35} />
          ))}
        </g>
      ))}
    </g>
  );
}

// Static picture of how the same vector add is split on the two sides.
export default function VectorAddMappingFigure() {
  const cpuTint = (i: number) => [C1, "#6aa3e6", "#1d5aa6", "#9cc0ee"][Math.floor(i / 4)];
  return (
    <VisualizationFrame title="同一个数组相加，两边怎么分工" description="图里数组只画了 16 个元素。颜色表示这个元素由谁来算。">
      <div className="viz-scroll">
        <svg viewBox="0 0 600 200" role="img" aria-label="CPU 把数组切成 4 段，每个核用循环算完一段；GPU 给每个元素开一个线程，所有线程同时算。">
          <text x={150} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>CPU：4 个核，每个核循环算一段</text>
          <Arrays x={28} y={34} tint={cpuTint} />
          {[0, 1, 2, 3].map((k) => (
            <g key={k} transform={`translate(${28 + k * 4 * (CELL + 1)} 106)`}>
              <rect width={4 * (CELL + 1) - 2} height={26} rx={4} fill={cpuTint(k * 4)} opacity={0.25} />
              <text x={31} y={17} fontSize={9.5} textAnchor="middle" fill={INK}>{`core ${k + 1}`}</text>
            </g>
          ))}
          <text x={28} y={152} fontSize={9.5} fill={LINE}>每个核：for i in 自己那一段：C[i] = A[i] + B[i]</text>
          <text x={28} y={168} fontSize={9.5} fill={LINE}>N 翻倍，每个核要循环的次数也翻倍</text>

          <line x1={300} y1={10} x2={300} y2={190} stroke="#e4dfcb" strokeDasharray="3 3" />

          <text x={450} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>GPU：每个元素一个 thread</text>
          <Arrays x={320} y={34} tint={() => C2} />
          {Array.from({ length: N }, (_, i) => (
            <g key={i} transform={`translate(${320 + i * (CELL + 1)} 106)`}>
              <rect width={CELL} height={26} rx={3} fill={C2} opacity={0.25} />
              <text x={CELL / 2} y={17} fontSize={7.5} textAnchor="middle" fill={INK}>{`t${i}`}</text>
            </g>
          ))}
          <text x={320} y={152} fontSize={9.5} fill={LINE}>thread i 只算一个：C[i] = A[i] + B[i]</text>
          <text x={320} y={168} fontSize={9.5} fill={LINE}>N 翻倍就多开一倍 thread，硬件还没满就不变慢</text>
        </svg>
      </div>
    </VisualizationFrame>
  );
}

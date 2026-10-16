import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const GREY = "#efede4";
const LINE = "#76796f";
const INK = "#3b4234";

const CELL = 9;

function Grid({ x, y, n, fill }: { x: number; y: number; n: number; fill: (r: number, c: number) => string | null }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: n * n }, (_, k) => {
        const r = Math.floor(k / n);
        const c = k % n;
        const f = fill(r, c);
        return <rect key={k} x={c * CELL} y={r * CELL} width={CELL - 1} height={CELL - 1} rx={1} fill={f ?? GREY} />;
      })}
    </g>
  );
}

function Column({ x, title, lines }: { x: number; title: string; lines: string[] }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={90} y={16} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={INK}>{title}</text>
      {lines.map((l, i) => (
        <text key={i} x={6} y={142 + i * 15} fontSize={9.5} fill={i === lines.length - 1 ? INK : LINE} fontWeight={i === lines.length - 1 ? 600 : 400}>{l}</text>
      ))}
    </g>
  );
}

// Static comparison of the three exp5 kernels: what one thread / one block reads and computes.
export default function ConvKernelsFigure() {
  return (
    <VisualizationFrame
      title="exp5 的三个版本：数据从哪里读、一份数据用几次"
      description="每张小图是输入特征图的一块（一个通道）。蓝色是一个输出点要读的 3×3 输入（浅蓝是旁边那个点要读的，和它重叠），橙色是被搬进 shared memory 的输入块，绿色是一个 thread 算 2×2 个输出点要用到的 4×4 输入。"
    >
      <div className="viz-scroll">
        <svg viewBox="0 0 600 210" role="img" aria-label="baseline 每个线程从显存读自己的 3×3 输入；第一版 tiled 把整块输入搬进 shared memory 再读；最终版每个线程算 2×2 个输出，一个块同时算 4 个输出通道。">
          <Column x={0} title="baseline：直接读显存" lines={["一个 thread 算 1 个输出点", "自己从显存读 3×3×32 个输入", "相邻 thread 读的块大量重叠", "重叠部分被反复读"]} />
          <Grid x={45} y={30} n={10} fill={(r, c) => (r >= 3 && r <= 5 && c >= 3 && c <= 5 ? C1 : r >= 3 && r <= 5 && c >= 4 && c <= 6 ? "#9cc0ee" : null)} />

          <line x1={200} y1={10} x2={200} y2={200} stroke="#e4dfcb" strokeDasharray="3 3" />

          <Column x={200} title="第一版：加 shared memory" lines={["一个 block 管 16×16 个输出点", "先把 18×18 的输入块搬进 shared", "每个 thread 还是只算 1 个点", "每份数据只多用了几次"]} />
          <Grid x={245} y={30} n={10} fill={(r, c) => (r >= 3 && r <= 5 && c >= 3 && c <= 5 ? C1 : C2)} />

          <line x1={400} y1={10} x2={400} y2={200} stroke="#e4dfcb" strokeDasharray="3 3" />

          <Column x={400} title="最终版：shared + 多算几个" lines={["同样先搬进 shared memory", "每个 thread 算 2×2 个输出点", "一个 block 同时算 4 个输出通道", "每份数据被用了很多次"]} />
          <Grid x={445} y={30} n={10} fill={(r, c) => (r >= 3 && r <= 6 && c >= 3 && c <= 6 ? C3 : C2)} />
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={545 + k * 5} y={30 + k * 5} width={30} height={30} rx={2} fill="none" stroke={C3} strokeWidth={1} opacity={0.8} />
          ))}
          <text x={566} y={84} fontSize={8.5} textAnchor="middle" fill={LINE}>× 4 个</text>
          <text x={566} y={95} fontSize={8.5} textAnchor="middle" fill={LINE}>卷积核</text>
        </svg>
      </div>
    </VisualizationFrame>
  );
}

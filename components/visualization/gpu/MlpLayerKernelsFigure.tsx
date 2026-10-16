import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const GREY = "#efede4";
const LINE = "#76796f";
const INK = "#3b4234";
const BAD = "#d03b3b";

type K = { label: string; sub: string; color: string; reads: boolean };

function Pipeline({ x, kernels, width }: { x: number; kernels: K[]; width: number }) {
  const gap = 14;
  const w = (width - gap * (kernels.length - 1)) / kernels.length;
  return (
    <g transform={`translate(${x} 0)`}>
      {kernels.map((k, i) => {
        const kx = i * (w + gap);
        return (
          <g key={i}>
            <rect x={kx} y={34} width={w} height={40} rx={5} fill={k.color} opacity={0.22} />
            <text x={kx + w / 2} y={51} fontSize={10} fontWeight={600} textAnchor="middle" fill={INK}>{k.label}</text>
            <text x={kx + w / 2} y={66} fontSize={8.5} textAnchor="middle" fill={LINE}>{k.sub}</text>
            {/* write arrow down to memory */}
            <line x1={kx + w / 2 + 8} y1={76} x2={kx + w / 2 + 8} y2={118} stroke={BAD} strokeWidth={1.4} markerEnd="url(#mk-down)" />
            <text x={kx + w / 2 + 12} y={102} fontSize={8.5} fill={BAD}>写 Y</text>
            {k.reads && (
              <>
                <line x1={kx + w / 2 - 8} y1={118} x2={kx + w / 2 - 8} y2={78} stroke={C1} strokeWidth={1.4} markerEnd="url(#mk-up)" />
                <text x={kx + w / 2 - 12} y={102} fontSize={8.5} textAnchor="end" fill={C1}>读 Y</text>
              </>
            )}
          </g>
        );
      })}
      <rect x={0} y={120} width={width} height={24} rx={4} fill={GREY} />
      <text x={8} y={136} fontSize={9.5} fill={INK}>显存里的中间结果 Y（B × n 个数）</text>
    </g>
  );
}

// Static comparison of the per-layer kernels in exp2's baseline and fused paths.
export default function MlpLayerKernelsFigure() {
  return (
    <VisualizationFrame
      title="exp2 的两种写法：一层要启动几个 kernel、Y 在显存里进出几次"
      description="一层的三步（乘权重、加 bias、ReLU）。左边每一步是一个独立的 kernel；右边把后两步合进一个 kernel。"
    >
      <div className="viz-scroll">
        <svg viewBox="0 0 600 200" role="img" aria-label="baseline 一层启动 3 个 kernel，中间结果 Y 在显存里写 3 次读 2 次；fused 启动 2 个 kernel，写 2 次读 1 次。">
          <defs>
            <marker id="mk-down" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={BAD} /></marker>
            <marker id="mk-up" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C1} /></marker>
          </defs>
          <text x={145} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>baseline：三个 kernel</text>
          <Pipeline
            x={10}
            width={270}
            kernels={[
              { label: "GEMM", sub: "cuBLAS 乘权重", color: C1, reads: false },
              { label: "bias", sub: "自己写的 kernel", color: C2, reads: true },
              { label: "ReLU", sub: "自己写的 kernel", color: C3, reads: true },
            ]}
          />
          <text x={10} y={166} fontSize={10} fill={INK}>kernel 启动：3 次</text>
          <text x={10} y={182} fontSize={10} fill={BAD}>Y 在显存里：写 3 次、读 2 次</text>

          <line x1={300} y1={10} x2={300} y2={190} stroke="#e4dfcb" strokeDasharray="3 3" />

          <text x={455} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>fused：两个 kernel</text>
          <Pipeline
            x={320}
            width={270}
            kernels={[
              { label: "GEMM", sub: "cuBLAS 乘权重", color: C1, reads: false },
              { label: "bias + ReLU", sub: "合成一个 kernel", color: C2, reads: true },
            ]}
          />
          <text x={320} y={166} fontSize={10} fill={INK}>kernel 启动：2 次</text>
          <text x={320} y={182} fontSize={10} fill={INK}>Y 在显存里：写 2 次、读 1 次</text>
        </svg>
      </div>
    </VisualizationFrame>
  );
}

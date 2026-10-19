import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const GREY = "#cfcab4";
const LINE = "#76796f";
const INK = "#3b4234";

// Illustrative widths, not measured: a healthy step is mostly GPU compute.
const SEGS = [
  { label: "数据加载", sub: "CPU 读取、预处理、拷到显存", w: 60, color: GREY, here: false },
  { label: "kernel 启动", sub: "CPU 发射每个 kernel 的固定开销", w: 42, color: C2, here: true },
  { label: "GPU 计算", sub: "kernel 在跑：搬数据和算，两者可重叠", w: 332, color: C1, here: true },
  { label: "多卡通信", sub: "梯度 all-reduce、等最慢的卡", w: 126, color: GREY, here: false },
];

// Static picture of where one training step's wall-clock time goes, and which part this chapter covers.
export default function TrainingStepFigure() {
  const X0 = 20;
  const starts = SEGS.map((_, i) => X0 + SEGS.slice(0, i).reduce((a, s) => a + s.w, 0));
  const compute = SEGS[2];
  const cx = starts[2];
  return (
    <VisualizationFrame
      title="一步训练的时间都花在哪"
      description="一个 step 从读进一批数据到梯度更新完，时间分成四段。本章只讲橙色和蓝色这两段：kernel 怎样启动、kernel 里面怎样跑。段的长短是示意，不是实测。"
      footnote={SEGS.map((s) => `${s.label}：${s.sub}`).join("。") + "。"}
    >
      <div className="viz-scroll">
        <svg viewBox="0 0 600 200" role="img" aria-label="一步训练依次经过数据加载、kernel 启动、GPU 计算、多卡通信四段；本章讲 kernel 启动和 GPU 计算，GPU 计算又分成搬数据和计算两条可以重叠的线。">
          <text x={X0} y={16} fontSize={10} fill={LINE}>一个 step 的时间 →</text>
          {SEGS.map((s, i) => (
            <g key={s.label} transform={`translate(${starts[i]} 26)`}>
              <rect width={s.w - 2} height={30} rx={4} fill={s.color} opacity={s.here ? 0.8 : 0.45} />
              <text x={(s.w - 2) / 2} y={19} fontSize={9.5} textAnchor="middle" fill={s.here ? "#fff" : INK} fontWeight={600}>{s.label}</text>
            </g>
          ))}

          {/* zoom into GPU compute */}
          <path d={`M${cx} 58 L${cx + 10} 96 L${cx + compute.w - 12} 96 L${cx + compute.w - 2} 58`} fill="#f6f3e6" stroke="#e4dfcb" />
          <g transform={`translate(${cx + 10} 96)`}>
            <rect width={compute.w - 22} height={62} rx={5} fill="#fff" stroke={C1} strokeWidth={1.2} />
            <text x={8} y={18} fontSize={9.5} fill={INK}>搬数据（显存 ↔ 片上）</text>
            <rect x={140} y={9} width={160} height={12} rx={3} fill={C3} opacity={0.6} />
            <text x={8} y={44} fontSize={9.5} fill={INK}>计算（SM 做乘加）</text>
            <rect x={140} y={35} width={100} height={12} rx={3} fill={C2} opacity={0.6} />
            <text x={8} y={57} fontSize={8.5} fill={LINE}>两条线同时进行，总耗时取较长的那条</text>
          </g>

          <text x={X0} y={186} fontSize={9.5} fill={LINE}>灰色两段本章不讲：它们要靠异步加载、通信与计算重叠这类办法，属于另一类问题。</text>
        </svg>
      </div>
    </VisualizationFrame>
  );
}

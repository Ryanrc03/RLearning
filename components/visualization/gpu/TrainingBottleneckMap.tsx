"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const GREY = "#cfcab4";
const LINE = "#76796f";
const INK = "#3b4234";
const BAD = "#d03b3b";

const SEGS = [
  { id: "load", label: "数据加载", w: 60 },
  { id: "launch", label: "kernel 启动", w: 42 },
  { id: "compute", label: "GPU 计算", w: 332 },
  { id: "comm", label: "多卡通信", w: 126 },
];

type Page = { n: number; title: string; href: string };
const P: Record<number, Page> = {
  1: { n: 1, title: "CPU vs GPU", href: "/notes/ai-infra/gpu/cpu-vs-gpu/" },
  2: { n: 2, title: "Compute-bound vs Memory-bound", href: "/notes/ai-infra/gpu/compute-vs-memory-bound/" },
  3: { n: 3, title: "Global vs Shared Memory", href: "/notes/ai-infra/gpu/global-vs-shared-memory/" },
  4: { n: 4, title: "Separate vs Fused Kernels", href: "/notes/ai-infra/gpu/separate-vs-fused-kernels/" },
  5: { n: 5, title: "Thread- vs Warp-per-row", href: "/notes/ai-infra/gpu/thread-vs-warp-per-row/" },
  6: { n: 6, title: "Aggregate- vs Project-first", href: "/notes/ai-infra/gpu/aggregate-vs-project-first/" },
  7: { n: 7, title: "Implicit GEMM vs FFT", href: "/notes/ai-infra/gpu/implicit-gemm-vs-fft/" },
};

type Symptom = {
  id: string;
  label: string;
  segs: string[];
  narr: string;
  metrics: string[];
  methods: { text: string; page: number }[];
};

const SYMPTOMS: Symptom[] = [
  {
    id: "idle",
    label: "GPU 大部分时间闲着",
    segs: ["launch", "load"],
    narr: "nvidia-smi 的利用率低、还上下跳，说明 GPU 经常在等：要么在等 CPU 发下一个 kernel，要么活太少、一下就做完了。先看时间线上的空档出现在哪。空档如果是在等数据加载，本章不讲；如果是在等启动、或每个 kernel 只跑几微秒，往下看。",
    metrics: ["nvidia-smi 的 GPU 利用率：低且波动", "Nsight Systems 时间线：kernel 之间有没有空档", "batch 大小：GPU 一轮能同时开工的线程够不够"],
    methods: [
      { text: "一次给 GPU 更多活：加大 batch，让启动开销被摊薄", page: 1 },
      { text: "减少 kernel 数量：把连续的小操作合并成一个", page: 4 },
    ],
  },
  {
    id: "membound",
    label: "利用率 100%，吞吐却远低于峰值",
    segs: ["compute"],
    narr: "GPU 一直有 kernel 在跑，可算出来的 GFLOP/s 离峰值差几倍甚至几十倍：计算单元在等数据。这是最常见的情况，本章大部分页面都在讲它。先算算术强度，确认是 memory-bound，再按下面的顺序试。",
    metrics: ["算术强度：这个 kernel 每搬 1 字节能算几次，落在 roofline 的斜线上还是平顶上", "Nsight Compute：显存带宽利用率接近 100%，算力利用率很低", "访存合并率（global load efficiency）：低说明相邻线程读的地址不相邻"],
    methods: [
      { text: "先诊断：数 FLOP 和字节，看点落在 roofline 哪一段", page: 2 },
      { text: "让相邻线程反复用的数据只从显存读一次：搬进 shared memory 再复用", page: 3 },
      { text: "让一个 warp 的 32 个线程读相邻地址：换线程映射，合并访存", page: 5 },
      { text: "换计算顺序，让最慢的那步处理更窄的矩阵", page: 6 },
      { text: "把中间结果留在寄存器里：合并 kernel，少一次显存往返", page: 4 },
    ],
  },
  {
    id: "fragmented",
    label: "kernel 很多很碎",
    segs: ["launch"],
    narr: "时间线上每步有成百上千个 kernel，每个只跑几微秒。这时启动开销和中间结果的显存往返占了大头，kernel 本身再快也没用。",
    metrics: ["每步的 kernel 数量和平均时长（Nsight Systems）", "启动开销占比：kernel 数 × 几微秒，和总时间比一比", "逐元素操作（bias、激活、归一化）在时间里占多少"],
    methods: [
      { text: "把逐元素的小操作合进它前面的大 kernel", page: 4 },
      { text: "理解启动开销为什么是固定的：活再少也要付这一笔", page: 1 },
    ],
  },
  {
    id: "compbound",
    label: "已经接近峰值算力，还想更快",
    segs: ["compute"],
    narr: "GFLOP/s 顶到了这块卡的峰值，roofline 上的点落在平顶：带宽已经不是瓶颈，减少访存不会再有收益。能动的只剩两样：用更强的算力（Tensor Core、更低的精度），或者换一个计算量更少的算法。",
    metrics: ["算力利用率接近 100%，带宽利用率不满", "现在用的精度：FP32 的峰值远低于 TF32 / BF16 的 Tensor Core 峰值", "算法的计算量：同一个结果有没有更省的算法"],
    methods: [
      { text: "认清平顶：这时只有加算力有用，比如开 TF32 用上 Tensor Core", page: 2 },
      { text: "换算法：同一个卷积，不同算法的计算量和显存开销不同", page: 7 },
    ],
  },
  {
    id: "memory",
    label: "显存不够，batch 开不大",
    segs: ["compute"],
    narr: "batch 稍大就 OOM，只好用小 batch，于是又回到「GPU 闲着」的问题。本章能帮上的是两处：算法选择会额外占 workspace，计算顺序决定中间结果有多大。",
    metrics: ["峰值显存（torch.cuda.max_memory_allocated）", "库函数申请的 workspace：比如 cuDNN 的 FFT 算法要几 MB", "中间结果的形状：最宽的那个矩阵有多大"],
    methods: [
      { text: "选不占 workspace 的算法：implicit GEMM 为 0，FFT 随 batch 增长", page: 7 },
      { text: "换计算顺序，让中间结果变窄：Â(HW) 的中间矩阵只有 hidden 那么宽", page: 6 },
    ],
  },
];

export default function TrainingBottleneckMap() {
  const [id, setId] = useState(SYMPTOMS[0].id);
  const s = SYMPTOMS.find((x) => x.id === id)!;
  const X0 = 20;
  const starts = SEGS.map((_, i) => X0 + SEGS.slice(0, i).reduce((a, g) => a + g.w, 0));

  return (
    <VisualizationFrame
      title="对症下药：你看到的现象 → 该查的指标 → 本章哪一页"
      description="点一个现象。上面高亮它出在 step 的哪一段，下面是先查哪些指标、本章给出的办法。方法只列本章写过的；数据加载和多卡通信这两段的办法不在本章。"
    >
      <div className="viz-controls">
        {SYMPTOMS.map((x) => (
          <button key={x.id} type="button" className={`viz-btn${id === x.id ? " is-on" : ""}`} onClick={() => setId(x.id)}>{x.label}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 600 82" role="img" aria-label={`${s.label}：问题出在 ${s.segs.map((g) => SEGS.find((q) => q.id === g)!.label).join("、")} 这一段。`}>
          {SEGS.map((g, i) => {
            const hot = s.segs.includes(g.id);
            const covered = g.id === "launch" || g.id === "compute";
            return (
              <g key={g.id} transform={`translate(${starts[i]} 14)`}>
                <rect width={g.w - 2} height={30} rx={4} fill={hot ? (covered ? C2 : BAD) : covered ? C1 : GREY} opacity={hot ? 0.9 : 0.25} />
                <text x={(g.w - 2) / 2} y={19} fontSize={9.5} textAnchor="middle" fill={hot ? "#fff" : INK} fontWeight={hot ? 600 : 400}>{g.label}</text>
                {hot && !covered && <text x={(g.w - 2) / 2} y={58} fontSize={9} textAnchor="middle" fill={BAD}>这一段本章不讲</text>}
              </g>
            );
          })}
          <text x={X0} y={10} fontSize={9} fill={LINE}>一个 step 的时间 →</text>
        </svg>
      </div>
      <div className="viz-narr">{s.narr}</div>
      <div className="viz-grid2" style={{ marginTop: 12 }}>
        <div className="viz-panel">
          <h5>先看这些指标</h5>
          <ul>
            {s.metrics.map((m) => (
              <li key={m} style={{ fontSize: 12.5, marginBottom: 6 }}>{m}</li>
            ))}
          </ul>
        </div>
        <div className="viz-panel">
          <h5>本章的办法</h5>
          <ul>
            {s.methods.map((m) => (
              <li key={m.text} style={{ fontSize: 12.5, marginBottom: 6 }}>
                {m.text}　<a href={P[m.page].href}>第 {m.page} 页 →</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </VisualizationFrame>
  );
}

import type { ReactNode } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const GREY = "#e4dfcb";
const LINE = "#76796f";
const INK = "#3b4234";
const BAD = "#d03b3b";

// Every mini figure is a before (left) → after (right) pair in a 220×96 box.
const W = 220;
const H = 100;
const LX = 0;
const RX = 124;
const PW = 96;

function Pair({ before, after, children, label }: { before: string; after: string; children: ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: "100%", height: "auto", display: "block" }}>
      <text x={LX + PW / 2} y={10} fontSize={8.5} textAnchor="middle" fill={LINE}>{before}</text>
      <text x={RX + PW / 2} y={10} fontSize={8.5} textAnchor="middle" fill={LINE}>{after}</text>
      <text x={110} y={56} fontSize={14} textAnchor="middle" fill="#b7b29a">→</text>
      {children}
    </svg>
  );
}

function SmGrid({ x, lit }: { x: number; lit: number }) {
  return (
    <g transform={`translate(${x + 16} 22)`}>
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={(i % 4) * 16} y={Math.floor(i / 4) * 14} width={13} height={11} rx={2} fill={i < lit ? C2 : GREY} opacity={i < lit ? 0.85 : 1} />
      ))}
    </g>
  );
}

function Kernels({ x, names, writes }: { x: number; names: string[]; writes: number }) {
  const bw = (PW - 6 * (names.length - 1)) / names.length;
  return (
    <g transform={`translate(${x} 22)`}>
      {names.map((n, i) => (
        <g key={n} transform={`translate(${i * (bw + 6)} 0)`}>
          <rect width={bw} height={20} rx={3} fill={i === 0 ? C1 : C2} opacity={0.3} />
          <text x={bw / 2} y={13} fontSize={7.5} textAnchor="middle" fill={INK}>{n}</text>
          <line x1={bw / 2} y1={22} x2={bw / 2} y2={44} stroke={BAD} strokeWidth={1.2} />
        </g>
      ))}
      <rect y={46} width={PW} height={14} rx={3} fill={GREY} />
      <text x={PW / 2} y={56} fontSize={7.5} textAnchor="middle" fill={INK}>显存，写回 {writes} 次</text>
    </g>
  );
}

function Roofline() {
  const x0 = 30;
  const y0 = 84;
  return (
    <g>
      <line x1={x0} y1={y0} x2={W - 10} y2={y0} stroke={LINE} />
      <line x1={x0} y1={y0} x2={x0} y2={18} stroke={LINE} />
      <path d={`M${x0 + 4} ${y0 - 6} L${x0 + 90} ${28} L${W - 14} ${28}`} fill="none" stroke={INK} strokeWidth={1.6} />
      <circle cx={x0 + 40} cy={y0 - 6 + ((40 - 4) / (90 - 4)) * (28 - (y0 - 6))} r={4.5} fill={C1} stroke="#fff" strokeWidth={1.5} />
      <circle cx={x0 + 150} cy={28} r={4.5} fill={C2} stroke="#fff" strokeWidth={1.5} />
      <text x={x0 + 30} y={y0 - 30} fontSize={8} fill={C1}>斜线上：卡在带宽</text>
      <text x={x0 + 100} y={22} fontSize={8} fill={C2}>平顶上：卡在算力</text>
      <text x={W - 10} y={y0 + 10} fontSize={7.5} textAnchor="end" fill={LINE}>每字节能算几次 →</text>
      <text x={x0 - 4} y={24} fontSize={7.5} textAnchor="end" fill={LINE}>吞吐</text>
    </g>
  );
}

function Threads({ x, viaShared }: { x: number; viaShared: boolean }) {
  return (
    <g transform={`translate(${x} 20)`}>
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${i * 24} 0)`}>
          <rect width={20} height={12} rx={2} fill={C1} opacity={0.3} />
          <text x={10} y={9} fontSize={7} textAnchor="middle" fill={INK}>t{i}</text>
          <line x1={10} y1={14} x2={10} y2={viaShared ? 24 : 54} stroke={viaShared ? C3 : BAD} strokeWidth={1.1} />
        </g>
      ))}
      {viaShared && (
        <>
          <rect y={26} width={PW - 4} height={13} rx={3} fill={C3} opacity={0.25} />
          <text x={(PW - 4) / 2} y={35} fontSize={7.5} textAnchor="middle" fill={INK}>shared memory，读 1 次</text>
          <line x1={(PW - 4) / 2} y1={40} x2={(PW - 4) / 2} y2={54} stroke={C2} strokeWidth={1.6} />
        </>
      )}
      <rect y={56} width={PW - 4} height={13} rx={3} fill={GREY} />
      <text x={(PW - 4) / 2} y={65} fontSize={7.5} textAnchor="middle" fill={INK}>显存，读 {viaShared ? 1 : 4} 次</text>
    </g>
  );
}

function Access({ x, scattered }: { x: number; scattered: boolean }) {
  const cols = 8;
  const rows = 5;
  const cell = 11;
  const hot = scattered ? [3, 0, 4, 1, 2, 4, 0, 3] : [];
  return (
    <g transform={`translate(${x + 4} 20)`}>
      {Array.from({ length: rows * cols }, (_, k) => {
        const r = Math.floor(k / cols);
        const c = k % cols;
        const on = scattered ? hot[c] === r : r === 2;
        return <rect key={k} x={c * cell} y={r * cell} width={cell - 1} height={cell - 1} rx={1.5} fill={on ? (scattered ? BAD : C3) : GREY} opacity={on ? 0.85 : 1} />;
      })}
      <text x={(cols * cell) / 2} y={rows * cell + 12} fontSize={7.5} textAnchor="middle" fill={INK}>{scattered ? "8 个地址分散 → 8 次访存" : "8 个地址相邻 → 1 次访存"}</text>
    </g>
  );
}

function Order({ x, wide }: { x: number; wide: boolean }) {
  const w = wide ? 72 : 14;
  return (
    <g transform={`translate(${x} 18)`}>
      <rect x={(PW - w) / 2} y={0} width={w} height={40} rx={3} fill={C2} opacity={0.55} />
      <text x={PW / 2} y={54} fontSize={7.5} textAnchor="middle" fill={INK}>SpMM 要处理的宽度</text>
      <text x={PW / 2} y={66} fontSize={8} textAnchor="middle" className="mono" fill={INK}>{wide ? "1433 列" : "64 列"}</text>
    </g>
  );
}

function Bars({ x, rows }: { x: number; rows: { label: string; w: number; color: string; text: string }[] }) {
  return (
    <g transform={`translate(${x} 20)`}>
      {rows.map((r, i) => (
        <g key={r.label} transform={`translate(0 ${i * 30})`}>
          <text x={0} y={8} fontSize={7.5} fill={INK}>{r.label}</text>
          <rect y={12} width={PW} height={9} rx={2} fill={GREY} />
          {r.w > 0 && <rect y={12} width={r.w} height={9} rx={2} fill={r.color} opacity={0.8} />}
          <text x={PW} y={30} fontSize={7} textAnchor="end" fill={LINE}>{r.text}</text>
        </g>
      ))}
    </g>
  );
}

type Card = { group: string; title: string; page: number; href: string; text: string; figure: ReactNode };

const CARDS: Card[] = [
  {
    group: "GPU 闲着",
    title: "一次给 GPU 更多活",
    page: 1,
    href: "/notes/ai-infra/gpu/cpu-vs-gpu/",
    text: "GPU 有上万个核，活少时大部分闲着，固定的启动开销还占大头。加大 batch，时间几乎不变，吞吐成倍涨。",
    figure: (
      <Pair before="batch 小：SM 大多闲着" after="batch 大：都在干活" label="batch 小时只有少数 SM 亮，batch 大时全部亮。">
        <SmGrid x={LX} lit={3} />
        <SmGrid x={RX} lit={16} />
      </Pair>
    ),
  },
  {
    group: "GPU 闲着 · memory-bound",
    title: "合并 kernel",
    page: 4,
    href: "/notes/ai-infra/gpu/separate-vs-fused-kernels/",
    text: "每个 kernel 算完都把结果写回显存，下一个再读出来。把逐元素的小操作合进前面的 kernel，少启动一次、少一次往返。实测快 1.08–1.19 倍。",
    figure: (
      <Pair before="三个 kernel" after="两个 kernel" label="三个 kernel 写回显存 3 次，合并后只写 2 次。">
        <Kernels x={LX} names={["GEMM", "bias", "ReLU"]} writes={3} />
        <Kernels x={RX} names={["GEMM", "bias+ReLU"]} writes={2} />
      </Pair>
    ),
  },
  {
    group: "先诊断",
    title: "算一算每字节能算几次",
    page: 2,
    href: "/notes/ai-infra/gpu/compute-vs-memory-bound/",
    text: "数这个 kernel 做了几次运算、搬了几个字节。比值低，点落在斜线上，卡在带宽，该减少访存；比值高，点落在平顶，卡在算力，该加算力。",
    figure: (
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="roofline：斜线段被带宽卡住，平顶段被算力卡住。" style={{ width: "100%", height: "auto", display: "block" }}>
        <Roofline />
      </svg>
    ),
  },
  {
    group: "memory-bound",
    title: "先搬进 shared memory 再复用",
    page: 3,
    href: "/notes/ai-infra/gpu/global-vs-shared-memory/",
    text: "相邻线程要的数据大量重叠时，让 block 先把这一块搬进片上的 shared memory，大家从片上反复读。复用够多才快：卷积实测 2.6–4.3 倍。",
    figure: (
      <Pair before="各自去显存读" after="搬一次，片上复用" label="4 个线程各读显存一次，改为显存读一次进 shared memory，再从片上读。">
        <Threads x={LX} viaShared={false} />
        <Threads x={RX} viaShared />
      </Pair>
    ),
  },
  {
    group: "memory-bound",
    title: "让相邻线程读相邻地址",
    page: 5,
    href: "/notes/ai-infra/gpu/thread-vs-warp-per-row/",
    text: "一个 warp 的 32 个线程同时读内存。地址分散时要拆成几十次访存；换一种分工让它们读相邻地址，硬件合并成一次。SpMM 实测快 40–115 倍。",
    figure: (
      <Pair before="thread-per-row" after="warp-per-row" label="分散的 8 个地址要 8 次访存，相邻的 8 个地址 1 次。">
        <Access x={LX} scattered />
        <Access x={RX} scattered={false} />
      </Pair>
    ),
  },
  {
    group: "memory-bound",
    title: "换计算顺序",
    page: 6,
    href: "/notes/ai-infra/gpu/aggregate-vs-project-first/",
    text: "结合律不改结果，但决定最慢的那一步处理多宽的矩阵。GCN 先降维再聚合，稀疏乘法只处理 hidden 那么宽。实测快 1.5–3.4 倍。",
    figure: (
      <Pair before="(ÂH)W：先聚合" after="Â(HW)：先降维" label="先聚合时稀疏乘法处理 1433 列宽，先降维只处理 64 列。">
        <Order x={LX} wide />
        <Order x={RX} wide={false} />
      </Pair>
    ),
  },
  {
    group: "compute-bound",
    title: "用 Tensor Core",
    page: 2,
    href: "/notes/ai-infra/gpu/compute-vs-memory-bound/",
    text: "算力已经用满时，减少访存没有收益，只剩换更强的算力：开 TF32 或 BF16，让矩阵乘走 Tensor Core，同一块卡的峰值高出好几倍。exp2 开了 TF32 才接近峰值。",
    figure: (
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="FP32 核的峰值短，Tensor Core 的峰值长好几倍。" style={{ width: "100%", height: "auto", display: "block" }}>
        <Bars
          x={30}
          rows={[
            { label: "普通 FP32 核", w: 50, color: C1, text: "峰值 1×" },
            { label: "Tensor Core（TF32 / BF16）", w: 160, color: C2, text: "峰值高好几倍" },
          ]}
        />
      </svg>
    ),
  },
  {
    group: "compute-bound · 显存不够",
    title: "换一种算法",
    page: 7,
    href: "/notes/ai-infra/gpu/implicit-gemm-vs-fft/",
    text: "同一个卷积，cuDNN 有好几种算法，占的显存和速度都不同。小卷积核选 implicit GEMM：不占 workspace，还最快；FFT 要几 MB workspace，只在大卷积核下划算。",
    figure: (
      <Pair before="implicit GEMM" after="FFT" label="implicit GEMM 不占 workspace 且更快；FFT 占几 MB workspace 且更慢。">
        <Bars x={LX} rows={[{ label: "workspace", w: 0, color: C2, text: "0" }, { label: "吞吐", w: 88, color: C1, text: "873 GFLOP/s" }]} />
        <Bars x={RX} rows={[{ label: "workspace", w: 70, color: C2, text: "6.7 MB" }, { label: "吞吐", w: 62, color: C1, text: "617 GFLOP/s" }]} />
      </Pair>
    ),
  },
];

// The chapter's methods as self-contained cards: one mini figure, two or three sentences, and the page that goes deeper.
export default function MethodCards() {
  return (
    <VisualizationFrame title="本章的八种办法" description="每张卡片自己就能看懂：左边是问题，右边是办法。想看实验和细节，再点卡片底下的页码。">
      <div className="viz-cards">
        {CARDS.map((c) => (
          <div className="viz-card" key={c.title}>
            <h6>{c.group}</h6>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>{c.title}</p>
            {c.figure}
            <p className="why" style={{ marginTop: 6 }}>{c.text}</p>
            <p style={{ marginTop: 6, fontSize: 12 }}>
              <a href={c.href}>第 {c.page} 页 →</a>
            </p>
          </div>
        ))}
      </div>
    </VisualizationFrame>
  );
}

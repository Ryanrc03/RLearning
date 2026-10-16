import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const GREY = "#efede4";
const LINE = "#76796f";
const INK = "#3b4234";

const CELL = 17;
// Nonzeros of the 6×6 sparse matrix A, row by row: [row, col, label].
const NZ: [number, number, string][] = [
  [0, 1, "a"], [0, 4, "b"],
  [1, 0, "c"],
  [2, 2, "d"], [2, 3, "e"], [2, 5, "f"],
  [3, 1, "g"],
  [4, 4, "h"],
  [5, 0, "i"], [5, 5, "j"],
];
const ROW = 2; // the row whose computation is highlighted
const ROW_PTR = [0, 2, 3, 6, 7, 8, 10];
const HOT_COLS = NZ.filter(([r]) => r === ROW).map(([, c]) => c);

function Matrix({ x, y, rows, cols, fill, label, sub }: { x: number; y: number; rows: number; cols: number; fill: (r: number, c: number) => { color: string; text?: string; strong?: boolean } | null; label: string; sub: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <text x={(cols * CELL) / 2} y={-8} fontSize={10} fontWeight={600} textAnchor="middle" fill={INK}>{label}</text>
      {Array.from({ length: rows * cols }, (_, k) => {
        const r = Math.floor(k / cols);
        const c = k % cols;
        const f = fill(r, c);
        return (
          <g key={k}>
            <rect x={c * CELL} y={r * CELL} width={CELL - 1} height={CELL - 1} rx={2} fill={f ? f.color : GREY} opacity={f ? (f.strong ? 0.9 : 0.4) : 1} />
            {f?.text && <text x={c * CELL + CELL / 2} y={r * CELL + 12} fontSize={9} textAnchor="middle" className="mono" fill={f.strong ? "#fff" : INK}>{f.text}</text>}
          </g>
        );
      })}
      <text x={(cols * CELL) / 2} y={rows * CELL + 13} fontSize={9} textAnchor="middle" fill={LINE}>{sub}</text>
    </g>
  );
}

function ArrayRow({ y, name, values, hot }: { y: number; name: string; values: (string | number)[]; hot: (i: number) => boolean }) {
  return (
    <g transform={`translate(20 ${y})`}>
      <text x={64} y={13} fontSize={9.5} textAnchor="end" className="mono" fill={INK}>{name}</text>
      {values.map((v, i) => (
        <g key={i} transform={`translate(${72 + i * 22} 0)`}>
          <rect width={20} height={18} rx={2} fill={hot(i) ? C2 : GREY} opacity={hot(i) ? 0.85 : 1} />
          <text x={10} y={13} fontSize={9.5} textAnchor="middle" className="mono" fill={hot(i) ? "#fff" : INK}>{v}</text>
        </g>
      ))}
    </g>
  );
}

// Static picture of SpMM (sparse A × dense B) and the CSR format exp3 uses to store A.
export default function SpmmCsrFigure() {
  const nzAt = (r: number, c: number) => NZ.find(([rr, cc]) => rr === r && cc === c);
  const [s, e] = [ROW_PTR[ROW], ROW_PTR[ROW + 1]];
  return (
    <VisualizationFrame
      title="exp3 的计算：稀疏矩阵 A × 稠密矩阵 B"
      description="A 里绝大部分是 0（图里灰色），只存非零的数。以第 2 行为例（行号从 0 开始）：C 的第 2 行，只和 A 第 2 行里那几个非零数有关。"
    >
      <div className="viz-scroll">
        <svg viewBox="0 0 600 250" role="img" aria-label="C 的第 2 行等于 d 乘 B 的第 2 行，加 e 乘 B 的第 3 行，加 f 乘 B 的第 5 行。A 用 CSR 格式存：row_ptr、col_idx、vals 三个数组。">
          <Matrix x={20} y={30} rows={6} cols={6} label="A（M×K，稀疏）" sub="实验里密度 1%" fill={(r, c) => { const nz = nzAt(r, c); return nz ? { color: C1, text: nz[2], strong: r === ROW } : null; }} />
          <text x={135} y={86} fontSize={13} textAnchor="middle" fill={INK}>×</text>
          <Matrix x={150} y={30} rows={6} cols={4} label="B（K×N，稠密）" sub="N 列" fill={(r) => (HOT_COLS.includes(r) ? { color: C3, strong: true } : { color: C3 })} />
          <text x={232} y={86} fontSize={13} textAnchor="middle" fill={INK}>=</text>
          <Matrix x={246} y={30} rows={6} cols={4} label="C（M×N）" sub="结果" fill={(r) => (r === ROW ? { color: C2, strong: true } : { color: C2 })} />

          <text x={350} y={44} fontSize={10} fontWeight={600} fill={INK}>C 的第 2 行怎么算</text>
          <text x={350} y={64} fontSize={9.5} fill={INK}>A 第 2 行的非零数：d、e、f</text>
          <text x={350} y={80} fontSize={9.5} fill={INK}>它们分别在第 2、3、5 列</text>
          <text x={350} y={100} fontSize={9.5} className="mono" fill={INK}>C[2,:] = d·B[2,:] + e·B[3,:] + f·B[5,:]</text>
          <text x={350} y={120} fontSize={9.5} fill={LINE}>只取 B 的这三行（绿色深的），乘上</text>
          <text x={350} y={134} fontSize={9.5} fill={LINE}>对应的数再相加；其余的 0 直接跳过</text>

          <text x={20} y={170} fontSize={10} fontWeight={600} fill={INK}>A 在显存里的存法（CSR）</text>
          <ArrayRow y={180} name="row_ptr" values={ROW_PTR} hot={(i) => i === ROW || i === ROW + 1} />
          <ArrayRow y={202} name="col_idx" values={NZ.map(([, c]) => c)} hot={(i) => i >= s && i < e} />
          <ArrayRow y={224} name="vals" values={NZ.map(([, , l]) => l)} hot={(i) => i >= s && i < e} />
          <text x={330} y={194} fontSize={9} fill={LINE}>row_ptr[2]=3、row_ptr[3]=6：第 2 行的</text>
          <text x={330} y={208} fontSize={9} fill={LINE}>非零数在 col_idx / vals 的第 3 到 5 格</text>
          <text x={330} y={222} fontSize={9} fill={LINE}>col_idx 说它在哪一列，vals 是它的值</text>
        </svg>
      </div>
    </VisualizationFrame>
  );
}

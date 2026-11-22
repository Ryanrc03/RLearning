import { SENTENCE, scoreCount } from "@/lib/ml/rnnSelfAttention";
import { BahFrame, Legend, P, Sym } from "../bahdanau/shared";

const N = SENTENCE.length;
const CELL = 30;
const X0 = 150;
const Y0 = 44;
const W = 520;
const H = Y0 + N * CELL + 16;

// Static: which history states each step scores. Row t reads h_1 … h_{t−1}.
export default function HistoryTriangleFigure() {
  const total = scoreCount(N);
  return (
    <BahFrame
      title="图 7 · 每一步多看一个历史位置"
      description={`n = ${N} 个词：读第 t 个词之前要给 t − 1 个历史状态打分，一共 0 + 1 + … + ${N - 1} = ${total} 个分数。`}
      footnote={<>只数分数的个数，不代表实际耗时；每个分数的成本还取决于隐藏维度和打分函数。</>}
    >
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="htr-title htr-desc" style={{ minWidth: 420, maxWidth: 560 }}>
          <title id="htr-title">每个时间步需要打分的历史位置</title>
          <desc id="htr-desc">一个 {N} 行 {N} 列的表。第 t 行是读第 t 个词的那一步，它给前面 t 减 1 个历史状态打分，所以填色的格子组成一个下三角，共 {total} 格。</desc>
          <text x={X0 + (N * CELL) / 2} y={14} fontSize={9.5} textAnchor="middle" fill={P.sub}>被打分的历史状态</text>
          {SENTENCE.map((tok, i) => (
            <text key={tok} x={X0 + i * CELL + CELL / 2} y={36} fontSize={10} fontWeight={600} textAnchor="middle" fill={P.ink}><Sym b="h" s={String(i + 1)} /></text>
          ))}
          {SENTENCE.map((tok, r) => (
            <g key={tok}>
              <text x={X0 - 10} y={Y0 + r * CELL + 19} fontSize={10} textAnchor="end" fill={P.ink}>t = {r + 1} · {tok}</text>
              {SENTENCE.map((other, c) => {
                const used = c < r;
                return <rect key={other} x={X0 + c * CELL + 2} y={Y0 + r * CELL + 2} width={CELL - 4} height={CELL - 4} rx={4} fill={used ? P.dynFill : P.surface} stroke={used ? P.dyn : P.grey} strokeWidth={used ? 1.3 : 0.6} strokeDasharray={used ? undefined : "2 3"} />;
              })}
              <text x={X0 + N * CELL + 12} y={Y0 + r * CELL + 19} fontSize={10} fill={P.sub} className="mono">{r} 个分数</text>
            </g>
          ))}
        </svg>
      </div>
      <Legend items={[{ tone: "dyn", label: "这一步要打分的历史状态" }, { tone: "grey", label: "自己和还没读到的位置：不打分" }]} />
      <div className="viz-narr">共 {total} 个分数，等于 n(n − 1)/2 = {N} × {N - 1} / 2。句子长一倍，分数的个数大约变成四倍。</div>
    </BahFrame>
  );
}

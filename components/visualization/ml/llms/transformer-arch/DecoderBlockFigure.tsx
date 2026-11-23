"use client";

import { useState } from "react";
import { BASE, causalAllowed, maskedWeights } from "@/lib/ml/transformerArch";
import { Arrow, BahFrame, Box, Legend, Markers, P } from "../bahdanau/shared";

const W = 700;
const H = 372;
const ID = "dbf";
const D = BASE.dModel;
const N = 4;
const MX = 476;
const MY = 128;
const CW = 46;
const CH = 34;
const ALLOWED = causalAllowed(N);

export default function DecoderBlockFigure() {
  const [q, setQ] = useState(1);
  const row = ALLOWED[q];
  const visible = row.filter(Boolean).length;
  const weights = maskedWeights(new Array<number>(N).fill(0), row);

  return (
    <BahFrame
      title="图 5 · Decoder Block：三个子层，以及 Masked Self-Attention 的 mask"
      description="左边从下往上读一个 Decoder Block。右边是第一个子层用的因果 mask：选一个 Query，看它能读哪些 Key。"
      footnote={<>原论文的 Post-LN 布局，省略 dropout。mask 只作用在 Masked Self-Attention 上；Cross-Attention 可以读完整的 source（实际还要用 padding mask 挡掉补齐的位置，那是另一回事）。右下角的权重是「四个分数全相等」时的示意：被挡住的位置分数设为 −∞，softmax 后正好是 0。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择 Query 位置">
        {Array.from({ length: N }, (_, i) => (
          <button key={i} type="button" aria-pressed={q === i} className={`viz-btn${q === i ? " is-on" : ""}`} onClick={() => setQ(i)}>Query {i + 1}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 660 }}>
          <title id={`${ID}-title`}>Decoder Block 的结构与因果 mask</title>
          <desc id={`${ID}-desc`}>Decoder Block 从下到上：Decoder 输入 D，Masked Multi-Head Self-Attention，残差相加与 LayerNorm，Multi-Head Cross-Attention，残差相加与 LayerNorm，FFN，残差相加与 LayerNorm，输出。Cross-Attention 的 Query 来自 Decoder，Key 和 Value 来自 Encoder 输出 U。右侧 4 乘 4 的因果 mask 中，Query {q + 1} 可以读 Key 1 到 {visible}，读不到后面的位置。</desc>
          <Markers id={ID} />

          <rect x={136} y={24} width={236} height={308} rx={10} fill="none" stroke={P.grey} strokeWidth={1} strokeDasharray="2 3" />
          <text x={368} y={18} fontSize={9.5} fontWeight={600} textAnchor="end" fill={P.ink}>一个 Decoder Block</text>

          <Box x={164} y={342} w={180} h={24} tone="neu" title={`Decoder 输入 D：${D} × t`} size={10} />
          <Arrow id={ID} tone="neu" d="M254 342 V311" />
          <Box x={164} y={272} w={180} h={36} tone="att" bold title="Masked Multi-Head Self-Attention" sub="Q、K、V 都来自 D，带因果 mask" size={9.5} />
          <Arrow id={ID} tone="neu" d="M254 272 V257" />
          <Box x={164} y={230} w={180} h={24} tone="par" title="Add & Norm" size={10} />
          <Arrow id={ID} tone="par" d="M254 326 H360 V242 H347" />

          <Arrow id={ID} tone="dec" d="M254 230 V211" />
          <text x={260} y={223} fontSize={8.5} fill={P.sub}>Query</text>
          <Box x={164} y={172} w={180} h={36} tone="dyn" title="Multi-Head Cross-Attention" sub="Q 来自 Decoder，K / V 来自 U" size={9.5} />
          <Arrow id={ID} tone="neu" d="M254 172 V157" />
          <Box x={164} y={130} w={180} h={24} tone="par" title="Add & Norm" size={10} />
          <Arrow id={ID} tone="par" d="M254 220 H360 V142 H347" />

          <Arrow id={ID} tone="neu" d="M254 130 V115" />
          <Box x={164} y={76} w={180} h={36} tone="dec" title="Position-wise FFN" sub={`${D} → ${BASE.dFf} → ${D}`} size={10} />
          <Arrow id={ID} tone="neu" d="M254 76 V61" />
          <Box x={164} y={34} w={180} h={24} tone="par" title="Add & Norm" size={10} />
          <Arrow id={ID} tone="par" d="M254 122 H360 V46 H347" />

          {/* encoder memory enters the cross-attention only */}
          <Box x={8} y={172} w={104} h={36} tone="enc" bold title="Encoder 输出 U" sub={`${D} × m`} size={10} />
          <Arrow id={ID} tone="enc" d="M112 190 H161" bold />
          <text x={137} y={183} fontSize={8.5} textAnchor="middle" fill={P.sub}>K + V</text>
          <text x={60} y={226} fontSize={8.5} textAnchor="middle" fill={P.sub}>只接到 Cross-Attention</text>

          <text x={140} y={18} fontSize={9} fill={P.sub}>↑ 输出 {D} × t</text>

          {/* causal mask */}
          <text x={MX + (N * CW) / 2} y={MY - 44} fontSize={10} fontWeight={600} textAnchor="middle" fill={P.ink}>Causal Mask（{N} 个目标位置）</text>
          <text x={MX + (N * CW) / 2} y={MY - 26} fontSize={9} textAnchor="middle" fill={P.sub}>列：Key</text>
          {Array.from({ length: N }, (_, k) => (
            <text key={k} x={MX + k * CW + CW / 2} y={MY - 8} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>{k + 1}</text>
          ))}
          {ALLOWED.map((r, j) => (
            <g key={j} onClick={() => setQ(j)} style={{ cursor: "pointer" }}>
              <text x={MX - 8} y={MY + j * CH + CH / 2 + 4} fontSize={9.5} fontWeight={j === q ? 700 : 400} textAnchor="end" fill={P.ink}>Query {j + 1}</text>
              {r.map((ok, k) => (
                <g key={k} opacity={j === q ? 1 : 0.55} className="bah-fade">
                  <rect x={MX + k * CW + 1} y={MY + j * CH + 1} width={CW - 2} height={CH - 2} rx={4} fill={ok ? P.attFill : P.surface} stroke={ok ? P.att : P.grey} strokeWidth={ok ? 1.3 : 0.8} strokeDasharray={ok ? undefined : "3 3"} />
                  <text x={MX + k * CW + CW / 2} y={MY + j * CH + CH / 2 + 4.5} fontSize={12} fontWeight={600} textAnchor="middle" fill={ok ? P.ink : P.sub}>{ok ? "✓" : "×"}</text>
                </g>
              ))}
              {j === q && <rect x={MX - 1} y={MY + j * CH - 1} width={N * CW + 2} height={CH + 2} rx={5} fill="none" stroke={P.ink} strokeWidth={1.8} />}
            </g>
          ))}
          <text x={MX + (N * CW) / 2} y={MY + N * CH + 18} fontSize={9} textAnchor="middle" fill={P.sub}>行：Query。✓ 可以读，× 被挡住</text>
          <text x={MX + (N * CW) / 2} y={MY + N * CH + 44} fontSize={9.5} textAnchor="middle" fill={P.ink} className="mono">权重：[{weights.map((w) => w.toFixed(2)).join(", ")}]</text>
          <text x={MX + (N * CW) / 2} y={MY + N * CH + 58} fontSize={8.5} textAnchor="middle" fill={P.sub}>（分数全相等时的示意）</text>
        </svg>
      </div>
      <Legend items={[{ tone: "att", label: "Masked Self-Attention 与它的 mask" }, { tone: "dyn", label: "Cross-Attention" }, { tone: "dec", label: "FFN 与 Decoder 的 Query" }, { tone: "par", label: "residual 相加与 LayerNorm" }, { tone: "enc", label: "Encoder 输出 U" }]} />
      <div className="viz-narr" aria-live="polite">
        Query {q + 1} 可以读 Key {visible === 1 ? "1（只有它自己）" : `1 到 ${visible}`}{visible < N ? `，读不到 Key ${visible + 1}${visible + 1 < N ? ` 到 ${N}` : ""}：那些是它后面的目标位置，生成时还不存在` : "：最后一个位置前面的全部都能读"}。被挡住的位置权重恰好是 0。这个限制只在 Decoder 自己的序列内部；到了上面的 Cross-Attention，每个 Query 都能读 source 的全部 m 个位置。
      </div>
    </BahFrame>
  );
}

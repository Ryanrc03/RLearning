"use client";

import { useState, type ReactNode } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { exactHit, groupHit, MS_DATA, MS_SAMPLES, type MsSampleRun } from "@/lib/ml/multisticker";

// Experiment 5: eight fixed validation samples the training script logs every
// epoch. The panel is what a user would see: the top-5 stickers, coloured by
// whether they share the gold sticker's intent group (the logs keep that flag,
// not the images), and where the sticker the user actually sent landed.

const RUNS: { key: MsSampleRun; label: string }[] = [
  { key: "head_no_memory", label: "head（无记忆）" },
  { key: "head_only", label: "head_only" },
  { key: "text_lora", label: "text_lora" },
  { key: "image_lora", label: "image_lora" },
  { key: "dual_lora", label: "dual_lora" },
];
const EMOJI: Record<string, string> = {
  humor_teasing: "😜",
  celebration_approval: "🎉",
  encouragement_support: "💪",
  confusion_curiosity: "🤔",
  neutral_acknowledgment: "👌",
};
const RUN_COLOR: Record<MsSampleRun, string> = { head_no_memory: "#b9b39b", head_only: "var(--v1)", text_lora: "var(--v3)", image_lora: "var(--v4)", dual_lora: "var(--v2)" };

function Badge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <span className={`ms-badge ${ok ? "is-hit" : "is-miss"}`}>{ok ? "✓" : "✗"} {children}</span>;
}

export default function MsSamplePanel() {
  const [idx, setIdx] = useState(0);
  const [run, setRun] = useState<MsSampleRun>("dual_lora");
  const s = MS_SAMPLES[idx];
  const r = s.runs[run];
  const emoji = EMOJI[s.intent] ?? "🙂";
  // Rank strip: log10 rank from 1 to the bank size.
  const X0 = 24;
  const X1 = 696;
  const lx = (rank: number) => X0 + (Math.log10(rank) / Math.log10(MS_DATA.bank)) * (X1 - X0);
  const order = [...RUNS].sort((a, b) => s.runs[a.key].rank - s.runs[b.key].rank);
  const best = RUNS.reduce((b, x) => (s.runs[x.key].rank < s.runs[b.key].rank ? x : b), RUNS[0]);

  return (
    <VisualizationFrame
      title="实验 5：逐个样本看贴纸面板"
      description="训练脚本每个 epoch 都会打印同样 8 条验证样本的排序结果。选一条样本、选一个模型：下面是它给出的前 5 张，以及用户真正发的那张排在 6,758 张里的第几位。"
      footnote="日志只记录了前 5 张是否与答案同一意图组（same_group），没有存图片，所以贴纸用意图组的表情代替：亮色 = 同组，灰色 = 别的组。"
    >
      <div className="viz-chips" role="group" aria-label="样本">
        {MS_SAMPLES.map((x, i) => (
          <button key={x.id} type="button" className={`viz-chip${i === idx ? " is-on" : ""}`} aria-pressed={i === idx} onClick={() => setIdx(i)}>
            {EMOJI[x.intent]} {x.domain} · {x.media}
          </button>
        ))}
      </div>
      <div className="ms-ctx">
        <div className="viz-k" style={{ marginBottom: 4 }}>
          <span className="ms-mono">{s.id}</span> · 意图 <b>{s.intent}</b> · 答案是一张 {s.media}
        </div>
        <code className="ms-mono">{s.context}</code>
      </div>
      <div style={{ marginTop: 12 }}>
        <Tabs options={RUNS} value={run} onChange={setRun} ariaLabel="模型" />
      </div>
      <div className="ms-panel" aria-label="前 5 张">
        {r.top5.map((same, i) => (
          <div key={i} className={`ms-sticker ${same ? "is-same" : "is-diff"}`}>
            <i aria-hidden>{same ? emoji : "🙂"}</i>
            #{i + 1} {same ? "同组" : "别的组"}
          </div>
        ))}
      </div>
      <div className="ms-gold">
        <span>用户真发的那张：<b>第 {r.rank.toLocaleString("en-US")} 位</b></span>
        <Badge ok={exactHit(r.rank, 1)}>Exact@1</Badge>
        <Badge ok={exactHit(r.rank, 5)}>Exact@5</Badge>
        <Badge ok={exactHit(r.rank, 30)}>Exact@30</Badge>
        <Badge ok={groupHit(r.top5, 1)}>Group@1</Badge>
        <Badge ok={groupHit(r.top5, 5)}>Group@5</Badge>
      </div>
      <Figure width={720} height={136} label="五个模型把答案排在第几位" minWidth={560}>
        <text x={X0} y={16} fontSize={12} fontWeight={600} fill="#30332c">五个模型把答案排在第几位（对数刻度）</text>
        <rect x={lx(1)} y={26} width={lx(30) - lx(1)} height={82} fill="#eaf7ec" />
        <text x={lx(1) + 4} y={120} fontSize={10.5} fill="#087a08">← 前 30 名 = 一个贴纸面板</text>
        <line x1={X0} y1={96} x2={X1} y2={96} stroke="#76796f" />
        {[1, 10, 100, 1000, MS_DATA.bank].map((t) => (
          <g key={t}>
            <line x1={lx(t)} y1={93} x2={lx(t)} y2={99} stroke="#76796f" />
            <text x={lx(t)} y={132} fontSize={10.5} textAnchor="middle" fill="#76796f">{t.toLocaleString("en-US")}</text>
          </g>
        ))}
        {order.map((x, row) => {
          const rk = s.runs[x.key].rank;
          const on = x.key === run;
          const ly = 82 - (row % 3) * 22;
          return (
            <g key={x.key} style={{ cursor: "pointer" }} onClick={() => setRun(x.key)}>
              <line x1={lx(rk)} y1={ly + 3} x2={lx(rk)} y2={90} stroke={RUN_COLOR[x.key]} strokeWidth={1} opacity={0.6} />
              <circle cx={lx(rk)} cy={96} r={on ? 7 : 5} fill={RUN_COLOR[x.key]} stroke="#fff" strokeWidth={1.5} style={{ transition: "cx .35s" }} />
              <text x={lx(rk)} y={ly} fontSize={10.5} textAnchor={lx(rk) > 640 ? "end" : lx(rk) < 70 ? "start" : "middle"} fill="#30332c" fontWeight={on ? 700 : 400} stroke="#fff" strokeWidth={3} paintOrder="stroke">{x.label.replace("（无记忆）", "·无记忆")} {rk.toLocaleString("en-US")}</text>
            </g>
          );
        })}
      </Figure>
      <div className={`viz-narr${exactHit(r.rank, 30) ? " is-good" : ""}`}>
        {exactHit(r.rank, 30)
          ? `${RUNS.find((x) => x.key === run)?.label} 把答案排进了前 30（第 ${r.rank} 位），这条样本在 Exact R@30 上算命中。`
          : r.top5.some(Boolean)
            ? `答案排在第 ${r.rank.toLocaleString("en-US")} 位，Exact R@30 没中；但前 5 张里有 ${r.top5.filter(Boolean).length} 张和答案同组${groupHit(r.top5, 1) ? "，Group R@1 也算命中" : ""}。这一屏对用户也许已经够用，Exact 却记 0 分：这就是两套指标的差别。`
            : `答案排在第 ${r.rank.toLocaleString("en-US")} 位，前 5 张也没有一张和答案同组：这条样本上这个模型连语气都猜错了。`}
        {" "}这条样本上排得最靠前的是 {best.label}（第 {s.runs[best.key].rank.toLocaleString("en-US")} 位）。
      </div>
    </VisualizationFrame>
  );
}

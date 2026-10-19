import { lift, MS_DATA, MS_NO_MEMORY_HEAD, MS_RESULTS } from "@/lib/ml/multisticker";

// The four numbers to remember from the project, computed from the run artifacts.
const pct = (v: number) => `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`;

export default function MsHeadline() {
  const r = MS_RESULTS;
  return (
    <div className="ms-stats" role="list" aria-label="MultiSticker 结果摘要">
      <div role="listitem" className="is-up">
        <b>{pct(r.direct_clip.r30)} → {pct(r.dual_lora.r30)}</b>
        <small>Exact Recall@30：冻结 CLIP → dual LoRA，约 {lift(r.dual_lora.r30, r.direct_clip.r30).toFixed(0)} 倍</small>
      </div>
      <div role="listitem" className="is-up">
        <b>×{lift(r.head_only.r30, MS_NO_MEMORY_HEAD.r30).toFixed(2)}</b>
        <small>加上检索到的对话记忆，同一个 head 的 Exact R@30 从 {pct(MS_NO_MEMORY_HEAD.r30)} 到 {pct(r.head_only.r30)}</small>
      </div>
      <div role="listitem">
        <b>{MS_DATA.bank.toLocaleString("en-US")}</b>
        <small>候选贴纸库（png / gif / webm），每个样本对全库排序，只有 1 个是用户真发的</small>
      </div>
      <div role="listitem">
        <b>{pct(r.direct_clip.g30)}</b>
        <small>冻结 CLIP 的 Group R@30：语义上「同类」的贴纸几乎总能找到，难的是精确那一张</small>
      </div>
    </div>
  );
}

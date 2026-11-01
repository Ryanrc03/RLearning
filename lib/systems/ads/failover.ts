// Region A fails mid-commit, Region B takes over and replays, then A comes back as a zombie (chapter 07).
// The sink is the only place that can stop both duplicates and stale writers, so all the switches live there.
// No React here; see tests/ads-backend.test.ts.

import { ids } from "./case";

export type FailoverParams = {
  /** The sink rejects writes whose epoch is older than the current writer's. */
  fencing: boolean;
  /** Writes are upserts keyed by sample_id instead of plain appends. */
  uniqueKey: boolean;
  /** Where Region B starts reading after it takes over. */
  resume: "replicated_checkpoint" | "latest";
};

export const DEFAULT_FAILOVER: FailoverParams = { fencing: false, uniqueKey: false, resume: "replicated_checkpoint" };

export type Write = { sampleId: string; region: "A" | "B"; epoch: number; modelVersion: string };

export type SinkRow = Write & { accepted: boolean; reason: string };

export type Step = { title: string; detail: string; writer: "A" | "B"; epoch: number; down?: "A"; writes: SinkRow[] };

const S101 = ids.sample("click_101");
const S102 = ids.sample("click_102");
export const EXPECTED_SAMPLES = [S101, S102];

export type FailoverResult = {
  steps: Step[];
  /** Final table: one entry per stored row. */
  table: Write[];
  duplicates: number;
  missing: string[];
  /** Writes from the old epoch that the sink accepted after the new writer took over. */
  staleAccepted: number;
};

export function simulateFailover(p: FailoverParams): FailoverResult {
  let table: Write[] = [];
  let currentEpoch = 1;
  let staleAccepted = 0;

  const commit = (w: Write): SinkRow => {
    if (p.fencing && w.epoch < currentEpoch) return { ...w, accepted: false, reason: `epoch ${w.epoch} < 当前 ${currentEpoch}，拒绝` };
    if (w.epoch < currentEpoch) staleAccepted += 1;
    if (p.uniqueKey && table.some((r) => r.sampleId === w.sampleId)) {
      table = table.map((r) => (r.sampleId === w.sampleId ? w : r));
      return { ...w, accepted: true, reason: "sample_id 已存在，覆盖（upsert）" };
    }
    table = [...table, w];
    return { ...w, accepted: true, reason: p.uniqueKey ? "新 sample_id，插入" : "追加一行" };
  };

  const steps: Step[] = [];
  steps.push({
    title: "正常运行",
    detail: "Region A 是唯一 writer（epoch 1）。处理 event_501，提交 s:cvr:click_101。这次提交之后的 checkpoint 还没来得及复制到 Region B。",
    writer: "A",
    epoch: 1,
    writes: [commit({ sampleId: S101, region: "A", epoch: 1, modelVersion: "idm_2026_10" })],
  });
  steps.push({
    title: "A 处理完、提交前宕机",
    detail: "A 读到 event_502，算出 s:cvr:click_102，事务还没提交，机房断电。这条样本只在 A 的内存和未提交事务里。",
    writer: "A",
    epoch: 1,
    down: "A",
    writes: [],
  });
  currentEpoch = 2;
  const replay = p.resume === "replicated_checkpoint";
  steps.push({
    title: "B 接管",
    detail: replay
      ? "协调服务把 writer 交给 Region B，epoch 加到 2。B 从复制过来的最后一个 checkpoint 恢复，它早于 A 的最后一次提交，所以 event_501 和 event_502 都会被重新处理。"
      : "协调服务把 writer 交给 Region B，epoch 加到 2。为了快速恢复，B 直接从最新 offset 开始读：A 没提交的 event_502 被跳过了。",
    writer: "B",
    epoch: 2,
    down: "A",
    writes: replay
      ? [commit({ sampleId: S101, region: "B", epoch: 2, modelVersion: "idm_2026_10" }), commit({ sampleId: S102, region: "B", epoch: 2, modelVersion: "idm_2026_10" })]
      : [],
  });
  steps.push({
    title: "A 带着旧 epoch 回来",
    detail: "A 恢复后不知道自己已经不是 writer，继续提交手里那条 s:cvr:click_102（epoch 1，用的还是旧的 identity 模型）。这就是“僵尸 writer”。",
    writer: "B",
    epoch: 2,
    writes: [commit({ sampleId: S102, region: "A", epoch: 1, modelVersion: "idm_2026_09" })],
  });

  const counts = new Map<string, number>();
  for (const r of table) counts.set(r.sampleId, (counts.get(r.sampleId) ?? 0) + 1);
  return {
    steps,
    table,
    duplicates: [...counts.values()].reduce((s, n) => s + n - 1, 0),
    missing: EXPECTED_SAMPLES.filter((id) => !counts.has(id)),
    staleAccepted,
  };
}

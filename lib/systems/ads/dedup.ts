// Layered deduplication of the running example's four deliveries, and the label-revision sink (chapter 06).
// No React here; see tests/ads-backend.test.ts.

import { DELIVERIES, ids, type Delivery } from "./case";

export type DedupParams = {
  dedupOn: boolean;
  /** Each region keeps its own dedup state, or both consult one global authority. */
  scope: "regional" | "global";
  /** How long a key is remembered after first being seen, in minutes. */
  ttl: number;
  /** How attribution results and samples are written. */
  sink: "append" | "unique_key";
};

export const DEFAULT_DEDUP: DedupParams = { dedupOn: true, scope: "regional", ttl: 60, sink: "append" };

/** The click each conversion is attributed to under last-click in the running example. */
const ATTRIBUTED_CLICK: Record<string, string> = { event_501: "click_101", event_502: "click_102" };

export type MessageVerdict = {
  delivery: Delivery;
  key: string;
  passed: boolean;
  why: string;
};

export type DedupResult = {
  messages: MessageVerdict[];
  received: number;
  duplicatesCaught: number;
  passed: number;
  /** Distinct business events actually present in the input. */
  trueUnique: number;
  attributionRows: { attributionId: string; count: number }[];
  sampleRows: { sampleId: string; count: number }[];
  /** Extra rows in the final sample table beyond one per logical sample. */
  duplicateSamples: number;
};

export function simulateDedup(p: DedupParams, deliveries: Delivery[] = DELIVERIES): DedupResult {
  const state = new Map<string, number>();
  const messages: MessageVerdict[] = deliveries.map((d) => {
    const key = ids.dedupKey(d.eventId);
    if (!p.dedupOn) return { delivery: d, key, passed: true, why: "没有去重层，照单全收。" };
    const stateKey = p.scope === "global" ? key : `${d.region}|${key}`;
    const seen = state.get(stateKey);
    if (seen !== undefined && d.receiveTime - seen <= p.ttl) {
      return { delivery: d, key, passed: false, why: `${p.scope === "global" ? "全局" : `Region ${d.region} 的`}去重状态里已有这个 key（${d.receiveTime - seen} 分钟前），丢弃。` };
    }
    state.set(stateKey, d.receiveTime);
    if (seen !== undefined) return { delivery: d, key, passed: true, why: `key 见过，但已经过了 ${p.ttl} 分钟 TTL，状态被清掉，当成新事件。` };
    const elsewhere = p.scope === "regional" && [...state.keys()].some((k) => k !== stateKey && k.endsWith(`|${key}`));
    return { delivery: d, key, passed: true, why: elsewhere ? `Region ${d.region} 自己的状态里没有它（另一个 Region 见过，但看不到），当成新事件。` : "第一次见到这个 key，放行。" };
  });
  const passed = messages.filter((m) => m.passed);
  const tally = (keys: string[]) => {
    const counts = new Map<string, number>();
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
    return [...counts].map(([k, n]) => ({ k, n: p.sink === "unique_key" ? 1 : n }));
  };
  const attributionRows = tally(passed.map((m) => ids.attribution(m.delivery.eventId, "last_click_7d"))).map(({ k, n }) => ({ attributionId: k, count: n }));
  const sampleRows = tally(passed.map((m) => ids.sample(ATTRIBUTED_CLICK[m.delivery.eventId]))).map(({ k, n }) => ({ sampleId: k, count: n }));
  return {
    messages,
    received: deliveries.length,
    duplicatesCaught: messages.length - passed.length,
    passed: passed.length,
    trueUnique: new Set(deliveries.map((d) => d.eventId)).size,
    attributionRows,
    sampleRows,
    duplicateSamples: sampleRows.reduce((s, r) => s + r.count - 1, 0),
  };
}

// ---------------------------------------------------------------- label revisions

export type SampleWrite = { sampleId: string; label: 0 | 1; revision: number; note: string };

/** A late conversion flips a provisional 0 to 1, then a replay re-sends the old version. */
export const REVISION_WRITES: SampleWrite[] = [
  { sampleId: ids.sample("click_200"), label: 0, revision: 1, note: "点击后 1 小时，写出 provisional 0" },
  { sampleId: ids.sample("click_200"), label: 1, revision: 2, note: "52 小时后转化到达，修正为 1" },
  { sampleId: ids.sample("click_200"), label: 0, revision: 1, note: "故障恢复，重放了 revision 1 那条旧消息" },
];

export type SinkMode = "insert_ignore" | "last_write_wins" | "version_aware";

export const SINK_MODES: { id: SinkMode; name: string; sql: string }[] = [
  { id: "insert_ignore", name: "主键冲突就丢（DROP）", sql: "INSERT … ON CONFLICT (sample_id) DO NOTHING" },
  { id: "last_write_wins", name: "后到的覆盖（LWW upsert）", sql: "INSERT … ON CONFLICT (sample_id) DO UPDATE SET label = EXCLUDED.label, …" },
  { id: "version_aware", name: "版本更高才覆盖", sql: "… DO UPDATE SET … WHERE samples.label_revision < EXCLUDED.label_revision" },
];

export type SinkStep = { write: SampleWrite; applied: boolean; row: { label: 0 | 1; revision: number } };

export function applyWrites(mode: SinkMode, writes: SampleWrite[] = REVISION_WRITES): SinkStep[] {
  let row: { label: 0 | 1; revision: number } | null = null;
  return writes.map((w) => {
    let applied: boolean;
    if (!row) applied = true;
    else if (mode === "insert_ignore") applied = false;
    else if (mode === "last_write_wins") applied = true;
    else applied = w.revision > row.revision;
    if (applied) row = { label: w.label, revision: w.revision };
    return { write: w, applied, row: { ...row! } };
  });
}

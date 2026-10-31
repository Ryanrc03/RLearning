// Kafka partitioning, consumer lag (chapter 04) and a small Flink join simulator (chapter 05).
// Rates, sizes and events are toy numbers chosen to make the behaviour visible.
// No React here; see tests/ads-backend.test.ts.

import { hm, type Minute } from "./case";

// ---------------------------------------------------------------- partitions and lag

export type StreamEvent = { id: string; kind: "click" | "conversion"; user: string; advertiser: string };

export const STREAM_EVENTS: StreamEvent[] = [
  { id: "click_100", kind: "click", user: "user_1", advertiser: "adv_42" },
  { id: "click_102", kind: "click", user: "user_2", advertiser: "adv_42" },
  { id: "click_101", kind: "click", user: "user_1", advertiser: "adv_42" },
  { id: "click_104", kind: "click", user: "user_5", advertiser: "adv_7" },
  { id: "click_103", kind: "click", user: "user_3", advertiser: "adv_42" },
  { id: "event_502", kind: "conversion", user: "user_2", advertiser: "adv_42" },
  { id: "event_501", kind: "conversion", user: "user_1", advertiser: "adv_42" },
  { id: "event_504", kind: "conversion", user: "user_4", advertiser: "adv_7" },
  { id: "event_503", kind: "conversion", user: "user_3", advertiser: "adv_42" },
];

export type PartitionKey = "user_id" | "event_id" | "advertiser_id";

/** 32-bit FNV-1a, the kind of cheap stable hash a producer uses to pick a partition. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function keyOf(e: StreamEvent, key: PartitionKey): string {
  return key === "user_id" ? e.user : key === "event_id" ? e.id : e.advertiser;
}

export function partitionOf(e: StreamEvent, key: PartitionKey, partitions = 3): number {
  return fnv1a(keyOf(e, key)) % partitions;
}

/**
 * Share of total traffic each partition receives under a key choice, for the lag model.
 * user_id and event_id spread evenly; advertiser_id piles one large advertiser onto one partition.
 */
export const TRAFFIC_SHARE: Record<PartitionKey, number[]> = {
  user_id: [0.34, 0.33, 0.33],
  event_id: [0.333, 0.333, 0.334],
  // adv_42 hashes to partition 1 (see tests), so that is where the pile-up goes.
  advertiser_id: [0.12, 0.7, 0.18],
};

export type LagResult = {
  /** Messages waiting in each partition after `minutes`. */
  lag: number[];
  /** Minutes a message arriving now waits before it is consumed, per partition. */
  freshness: number[];
  /** The join waits for the slowest partition: event-time progress is the minimum across inputs. */
  pipelineDelay: number;
};

/**
 * Lag after `minutes` with one consumer per partition, each consuming `consumerPerSec` messages per second.
 * Partition p receives share[p] × producePerSec.
 */
export function lagAfter(key: PartitionKey, producePerSec: number, consumerPerSec: number, minutes: number): LagResult {
  const lag = TRAFFIC_SHARE[key].map((share) => Math.max(0, share * producePerSec - consumerPerSec) * minutes * 60);
  const freshness = lag.map((l) => (consumerPerSec > 0 ? l / consumerPerSec / 60 : Infinity));
  return { lag, freshness, pipelineDelay: Math.max(...freshness) };
}

// ---------------------------------------------------------------- Flink join simulator

export type SimClick = { id: string; user: string; eventTime: Minute; arrival: Minute };
export type SimConversion = { id: string; user: string; eventTime: Minute; delay: number };

export const SIM_CLICKS: SimClick[] = [
  { id: "click_100", user: "user_1", eventTime: hm(9, 50), arrival: hm(9, 51) },
  { id: "click_101", user: "user_1", eventTime: hm(10, 0), arrival: hm(10, 1) },
  { id: "click_102", user: "user_2", eventTime: hm(10, 5), arrival: hm(10, 6) },
  { id: "click_104", user: "user_5", eventTime: hm(10, 15), arrival: hm(10, 16) },
  { id: "click_103", user: "user_3", eventTime: hm(10, 20), arrival: hm(10, 21) },
];

/** `delay` is the default arrival delay; event_502's is the slider in the figure. */
export const SIM_CONVERSIONS: SimConversion[] = [
  { id: "event_502", user: "user_2", eventTime: hm(10, 28), delay: 4 },
  { id: "event_501", user: "user_1", eventTime: hm(10, 30), delay: 1 },
  { id: "event_504", user: "user_4", eventTime: hm(10, 50), delay: 2 },
  { id: "event_503", user: "user_3", eventTime: hm(12, 20), delay: 1 },
];

/** Business rule, fixed: how long after a click a conversion still counts for its label. */
export const LABEL_WINDOW_MIN = 24 * 60;

export type JoinParams = {
  /** Arrival delay of event_502, the one conversion the reader can hold back. */
  delay502: number;
  /** Bounded out-of-orderness: watermark = max event time seen − watermarkDelay. */
  watermarkDelay: number;
  /** How long click state is kept after the click arrives (processing time, like Flink's state TTL). */
  stateTtl: number;
  late: "drop" | "side_output";
};

export const DEFAULT_JOIN: JoinParams = { delay502: 4, watermarkDelay: 5, stateTtl: 60, late: "side_output" };

export type ConversionOutcome = "joined" | "late" | "expired" | "no_click";

export type ConversionResult = {
  id: string;
  user: string;
  eventTime: Minute;
  arrival: Minute;
  /** Watermark at the moment the conversion arrived. */
  watermarkAtArrival: Minute;
  outcome: ConversionOutcome;
  /** The click that gets label 1 (last click of the user, before the conversion). */
  clickId?: string;
  explain: string;
};

export type SampleResult = {
  clickId: string;
  /** What the streaming job writes. */
  streamLabel: 0 | 1;
  /** What the label should be once all data is in. */
  trueLabel: 0 | 1;
  /** How the gap is closed, if there is one. */
  fix: "none" | "side_output" | "backfill" | "lost";
};

export type JoinResult = { conversions: ConversionResult[]; samples: SampleResult[]; clicksInState: number };

/**
 * Background traffic keeps the newest event time roughly equal to processing time, so the watermark at
 * processing time t is t − watermarkDelay, and a record is late exactly when its own arrival delay exceeds
 * the watermark delay. Click state lives from the click's arrival until arrival + stateTtl.
 */
export function simulateJoin(p: JoinParams): JoinResult {
  const conversions: ConversionResult[] = SIM_CONVERSIONS.map((c) => {
    const delay = c.id === "event_502" ? p.delay502 : c.delay;
    const arrival = c.eventTime + delay;
    const wm = arrival - p.watermarkDelay;
    const userClicks = SIM_CLICKS.filter((k) => k.user === c.user && k.eventTime <= c.eventTime && c.eventTime - k.eventTime <= LABEL_WINDOW_MIN);
    const target = userClicks.sort((a, b) => b.eventTime - a.eventTime)[0];
    const base = { id: c.id, user: c.user, eventTime: c.eventTime, arrival, watermarkAtArrival: wm };
    if (!target) return { ...base, outcome: "no_click", explain: "这个用户在窗口内没有点击：转化本身是真的，只是不归因给任何广告。" };
    if (c.eventTime < wm) {
      return { ...base, outcome: "late", clickId: target.id, explain: `到达时 watermark 已经推进到 ${fmtShort(wm)}，晚于它的事件时间 ${fmtShort(c.eventTime)}：迟到 ${delay - p.watermarkDelay} 分钟。` };
    }
    if (arrival > target.arrival + p.stateTtl) {
      return { ...base, outcome: "expired", clickId: target.id, explain: `${target.id} 的状态在 ${fmtShort(target.arrival + p.stateTtl)} 已被 TTL 清掉，转化到达时找不到它。` };
    }
    return { ...base, outcome: "joined", clickId: target.id, explain: `准时到达，${target.id} 还在状态里：Join 成功，label = 1。` };
  });
  const samples: SampleResult[] = SIM_CLICKS.map((k) => {
    const hit = conversions.find((c) => c.clickId === k.id);
    if (!hit) return { clickId: k.id, streamLabel: 0, trueLabel: 0, fix: "none" };
    if (hit.outcome === "joined") return { clickId: k.id, streamLabel: 1, trueLabel: 1, fix: "none" };
    if (hit.outcome === "late") return { clickId: k.id, streamLabel: 0, trueLabel: 1, fix: p.late === "side_output" ? "side_output" : "lost" };
    return { clickId: k.id, streamLabel: 0, trueLabel: 1, fix: "backfill" };
  });
  return { conversions, samples, clicksInState: Math.round(CLICKS_PER_MIN * p.stateTtl) };
}

/** Toy traffic for the state-size readout. */
export const CLICKS_PER_MIN = 200_000;

function fmtShort(t: Minute) {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

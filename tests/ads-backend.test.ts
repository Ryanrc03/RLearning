import { test } from "node:test";
import assert from "node:assert/strict";
import { CLICKS, DELIVERIES, LATE, PURCHASE, fmt, ids } from "@/lib/systems/ads/case";
import { attribute, clickLabel, labelAt } from "@/lib/systems/ads/attribution";
import { CANDIDATES, matchStats } from "@/lib/systems/ads/matching";
import { DEFAULT_JOIN, STREAM_EVENTS, lagAfter, partitionOf, simulateJoin } from "@/lib/systems/ads/streaming";
import { DEFAULT_DEDUP, applyWrites, simulateDedup } from "@/lib/systems/ads/dedup";
import { simulateFailover } from "@/lib/systems/ads/failover";
import { SCENARIOS, labelMismatchRatio, reconcile, symmetricDiffRatio } from "@/lib/systems/ads/reconcile";
import { CHAPTERS, NODES, SERVING_ORDER, TRAINING_ORDER } from "@/lib/systems/ads/pipeline";
import { getNote, getSeriesNeighbors } from "@/content/notes";

// ---------------------------------------------------------------- the running example

test("times format as clock and day offsets", () => {
  assert.equal(fmt(PURCHASE.time), "10:30");
  assert.equal(fmt(LATE.conversionTime), "D+2 14:00");
});

test("the three ids of the running example never collide", () => {
  const dedup = ids.dedupKey("event_501");
  const attr = ids.attribution("event_501", "last_click_7d");
  const sample = ids.sample("click_101");
  assert.equal(new Set([dedup, attr, sample]).size, 3);
  // Samples are click-level: two different conversions on the same click share one sample id.
  assert.equal(ids.sample("click_101"), ids.sample("click_101"));
});

// ---------------------------------------------------------------- attribution and labels

test("last-click credits Ad B, first-click Ad A, and multi-touch splits to 1", () => {
  const last = attribute(CLICKS, PURCHASE.time, 7 * 1440, "last_click");
  assert.deepEqual(last.map((c) => c.credit), [0, 1]);
  const first = attribute(CLICKS, PURCHASE.time, 7 * 1440, "first_click");
  assert.deepEqual(first.map((c) => c.credit), [1, 0]);
  for (const policy of ["linear", "time_decay"] as const) {
    const split = attribute(CLICKS, PURCHASE.time, 7 * 1440, policy);
    assert.ok(Math.abs(split.reduce((s, c) => s + c.credit, 0) - 1) < 1e-9);
  }
  const decay = attribute(CLICKS, PURCHASE.time, 7 * 1440, "time_decay");
  assert.ok(decay[1].credit > decay[0].credit, "the later click weighs more under time decay");
});

test("a short window makes the earlier click ineligible", () => {
  const credits = attribute(CLICKS, PURCHASE.time, 35, "first_click");
  assert.equal(credits[0].eligible, false);
  assert.equal(credits[1].credit, 1);
  const none = attribute(CLICKS, PURCHASE.time, 10, "linear");
  assert.ok(none.every((c) => c.credit === 0));
});

test("the training label policy can differ from the reporting attribution", () => {
  const credits = attribute(CLICKS, PURCHASE.time, 7 * 1440, "last_click");
  const follow = CLICKS.map((c) => clickLabel(c, credits, PURCHASE.time, 1440, "follow_attribution"));
  const any = CLICKS.map((c) => clickLabel(c, credits, PURCHASE.time, 1440, "any_conversion_in_window"));
  assert.deepEqual(follow, [0, 1]);
  assert.deepEqual(any, [1, 1]);
});

test("a late conversion revises a provisional 0 instead of being a duplicate", () => {
  const { clickTime, conversionTime, labelWindow } = LATE;
  const early = labelAt(clickTime, conversionTime, labelWindow, clickTime + 60, "emit_and_correct");
  assert.equal(early.status, "pending");
  assert.equal(early.label, 0);
  const after = labelAt(clickTime, conversionTime, labelWindow, conversionTime + 1, "emit_and_correct");
  assert.equal(after.label, 1);
  assert.equal(after.revision, 2);
  assert.equal(after.mature, false);
  const final = labelAt(clickTime, conversionTime, labelWindow, clickTime + labelWindow, "emit_and_correct");
  assert.equal(final.mature, true);
  assert.equal(final.label, 1);
  // Closing the label at one hour gets it permanently wrong.
  const hasty = labelAt(clickTime, conversionTime, labelWindow, clickTime + labelWindow, "treat_missing_as_negative");
  assert.equal(hasty.label, 0);
  assert.equal(hasty.status, "final_negative");
  // No conversion at all: negative only once the window has closed.
  assert.equal(labelAt(clickTime, null, labelWindow, clickTime + 100, "emit_and_correct").mature, false);
  assert.equal(labelAt(clickTime, null, labelWindow, clickTime + labelWindow, "emit_and_correct").status, "final_negative");
});

// ---------------------------------------------------------------- identity matching

test("raising the threshold trades recall and coverage for precision", () => {
  const thresholds = [0.3, 0.5, 0.7, 0.9, 1];
  const stats = thresholds.map((t) => matchStats(t));
  for (let i = 1; i < stats.length; i += 1) {
    assert.ok(stats[i].precision >= stats[i - 1].precision, `precision drops at ${thresholds[i]}`);
    assert.ok(stats[i].recall <= stats[i - 1].recall);
    assert.ok(stats[i].coverage <= stats[i - 1].coverage);
  }
  assert.equal(stats[0].recall, 1);
  assert.equal(stats[stats.length - 1].precision, 1);
  // Deterministic matches survive any threshold.
  assert.equal(matchStats(1).truePositives, CANDIDATES.filter((c) => c.method === "deterministic").length);
});

// ---------------------------------------------------------------- Kafka and Flink

test("keying by user keeps a user's clicks and conversions in one partition", () => {
  const user1 = STREAM_EVENTS.filter((e) => e.user === "user_1");
  assert.equal(new Set(user1.map((e) => partitionOf(e, "user_id"))).size, 1);
  assert.ok(new Set(user1.map((e) => partitionOf(e, "event_id"))).size > 1, "event_id scatters a user");
  const adv42 = STREAM_EVENTS.filter((e) => e.advertiser === "adv_42");
  assert.equal(new Set(adv42.map((e) => partitionOf(e, "advertiser_id"))).size, 1);
  assert.equal(partitionOf(adv42[0], "advertiser_id"), 1, "TRAFFIC_SHARE assumes adv_42 lands on partition 1");
});

test("a hot partition lags even when total capacity covers total traffic", () => {
  const even = lagAfter("user_id", 30_000, 11_000, 10);
  assert.ok(even.lag.every((l) => l === 0));
  const hot = lagAfter("advertiser_id", 30_000, 11_000, 10);
  assert.ok(hot.lag[1] > 0);
  assert.ok(hot.pipelineDelay > 0);
});

test("default join: one on-time join per user, one expired click state", () => {
  const r = simulateJoin(DEFAULT_JOIN);
  const by = Object.fromEntries(r.conversions.map((c) => [c.id, c.outcome]));
  assert.deepEqual(by, { event_502: "joined", event_501: "joined", event_504: "no_click", event_503: "expired" });
  assert.equal(r.conversions.find((c) => c.id === "event_501")!.clickId, "click_101");
  assert.equal(r.samples.find((s) => s.clickId === "click_103")!.fix, "backfill");
});

test("arrival delay beyond the watermark delay makes an event late; TTL long enough fixes the expiry", () => {
  const late = simulateJoin({ ...DEFAULT_JOIN, delay502: 12 });
  assert.equal(late.conversions.find((c) => c.id === "event_502")!.outcome, "late");
  assert.equal(late.samples.find((s) => s.clickId === "click_102")!.fix, "side_output");
  const dropped = simulateJoin({ ...DEFAULT_JOIN, delay502: 12, late: "drop" });
  assert.equal(dropped.samples.find((s) => s.clickId === "click_102")!.fix, "lost");
  const longTtl = simulateJoin({ ...DEFAULT_JOIN, stateTtl: 130 });
  assert.equal(longTtl.conversions.find((c) => c.id === "event_503")!.outcome, "joined");
  assert.ok(longTtl.clicksInState > simulateJoin(DEFAULT_JOIN).clicksInState);
  const zero = simulateJoin({ ...DEFAULT_JOIN, watermarkDelay: 0 });
  assert.equal(zero.conversions.find((c) => c.id === "event_501")!.outcome, "late");
});

// ---------------------------------------------------------------- dedup and revisions

test("regional dedup catches the retry but not the cross-region replay", () => {
  const r = simulateDedup(DEFAULT_DEDUP);
  assert.equal(r.received, DELIVERIES.length);
  assert.deepEqual(r.messages.map((m) => m.passed), [true, true, false, true]);
  assert.equal(r.trueUnique, 2);
  assert.equal(r.duplicateSamples, 1);
});

test("global dedup or an idempotent sink each remove the duplicate sample", () => {
  assert.equal(simulateDedup({ ...DEFAULT_DEDUP, scope: "global" }).duplicateSamples, 0);
  assert.equal(simulateDedup({ ...DEFAULT_DEDUP, sink: "unique_key" }).duplicateSamples, 0);
  // A TTL shorter than the replay gap lets the replay through even with global state.
  assert.equal(simulateDedup({ ...DEFAULT_DEDUP, scope: "global", ttl: 20 }).duplicateSamples, 1);
  assert.equal(simulateDedup({ ...DEFAULT_DEDUP, dedupOn: false }).duplicateSamples, 2);
});

test("only a version-aware upsert keeps the corrected label", () => {
  const final = (mode: Parameters<typeof applyWrites>[0]) => applyWrites(mode).at(-1)!.row;
  assert.deepEqual(final("insert_ignore"), { label: 0, revision: 1 });
  assert.deepEqual(final("last_write_wins"), { label: 0, revision: 1 });
  assert.deepEqual(final("version_aware"), { label: 1, revision: 2 });
});

// ---------------------------------------------------------------- failover

test("only fencing plus an idempotent sink gives exactly the expected rows", () => {
  const combos = [
    { fencing: false, uniqueKey: false },
    { fencing: true, uniqueKey: false },
    { fencing: false, uniqueKey: true },
    { fencing: true, uniqueKey: true },
  ];
  const results = combos.map((c) => simulateFailover({ ...c, resume: "replicated_checkpoint" }));
  assert.ok(results[0].duplicates > 0 && results[0].staleAccepted > 0);
  assert.ok(results[1].duplicates > 0 && results[1].staleAccepted === 0);
  assert.ok(results[2].duplicates === 0 && results[2].staleAccepted > 0);
  assert.deepEqual([results[3].duplicates, results[3].staleAccepted, results[3].missing.length], [0, 0, 0]);
});

test("resuming from the latest offset loses the uncommitted sample once the zombie is fenced", () => {
  const r = simulateFailover({ fencing: true, uniqueKey: true, resume: "latest" });
  assert.deepEqual(r.missing, [ids.sample("click_102")]);
});

// ---------------------------------------------------------------- reconciliation

test("set and label diff ratios", () => {
  assert.equal(symmetricDiffRatio(["a", "b"], ["a", "b"]), 0);
  assert.equal(symmetricDiffRatio(["a", "b"], ["b", "c"]), 2 / 3);
  assert.equal(labelMismatchRatio(new Map([["a", 1], ["b", 0]]), new Map([["a", 0], ["b", 0], ["c", 1]])), 0.5);
});

test("shadow reconciliation blames the stage each scenario breaks", () => {
  for (const s of SCENARIOS) {
    const r = reconcile(s.id, "shadow");
    assert.equal(r.firstDiverged, s.culprit, s.id);
  }
});

test("A/A AUC stays inside the natural band; equal counts can hide different sets", () => {
  const aa = reconcile("healthy", "shadow");
  assert.ok(Math.abs(aa.aucB - aa.aucA) > 0, "two runs never match exactly");
  assert.ok(Math.abs(aa.aucB - aa.aucA) <= 0.002);
  const idm = reconcile("identity_model", "shadow").rows.find((r) => r.stage === "identity")!;
  assert.ok(Math.abs(idm.countDelta!) < 0.02);
  assert.ok(idm.dSample! > 0.2);
  const ttl = reconcile("join_ttl", "shadow").rows.find((r) => r.stage === "samples")!;
  assert.equal(ttl.countA, ttl.countB);
  assert.ok(ttl.dLabel! > 0);
});

test("A/B mode never compares sample sets and only SRM can flag a bug", () => {
  for (const s of SCENARIOS) {
    const r = reconcile(s.id, "ab");
    assert.ok(r.rows.every((row) => row.dSample === null));
    assert.equal(r.firstDiverged, s.id === "assignment" ? "assignment" : null, s.id);
  }
});

// ---------------------------------------------------------------- series wiring

test("every pipeline node links to a chapter that exists as a note", () => {
  for (const ch of CHAPTERS) assert.ok(getNote(ch.slug), `missing note ${ch.slug}`);
  for (const node of NODES) assert.ok(CHAPTERS.some((c) => c.no === node.chapter), node.id);
  for (const id of [...TRAINING_ORDER, ...SERVING_ORDER]) assert.ok(NODES.some((n) => n.id === id), id);
});

test("the nine chapters read in order with previous / next links", () => {
  CHAPTERS.forEach((ch, i) => {
    const { prev, next } = getSeriesNeighbors(ch.slug);
    assert.equal(prev?.slug, CHAPTERS[i - 1]?.slug);
    assert.equal(next?.slug, CHAPTERS[i + 1]?.slug);
  });
});

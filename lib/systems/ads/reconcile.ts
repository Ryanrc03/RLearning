// Stage-by-stage reconciliation of two pipelines for chapter 08's dashboard.
// A toy population of users, clicks and conversions flows through both pipelines; one config knob of the
// candidate can be broken on purpose, and the dashboard looks for the first stage where the two differ.
// Every number is generated here for teaching. AUC values are illustrative, not from a trained model.
// No React here; see tests/ads-backend.test.ts.

import { fnv1a } from "./streaming";
import { srmPValue } from "@/lib/systems/abPlatform";

// FNV-1a alone mixes the high bits poorly for near-identical strings, so finish with murmur3's fmix32.
function u01(s: string): number {
  let h = fnv1a(s);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}

export type PipelineConfig = {
  /** Assignment salt; changing it reshuffles which users a pipeline sees. */
  salt: string;
  /** Share of users mirrored into the pipeline (Shadow) or into the arm (A/B). */
  share: number;
  dedupKey: "event_id" | "message_id";
  identityModel: "idm_v1" | "idm_v2";
  matchThreshold: number;
  /** Minutes the join keeps click state. */
  joinTtl: number;
  featureVersion: string;
};

export const BASELINE: PipelineConfig = { salt: "exp_2026_10", share: 1, dedupKey: "event_id", identityModel: "idm_v1", matchThreshold: 0.5, joinTtl: 240, featureVersion: "fv_88" };

export type ScenarioId = "healthy" | "assignment" | "dedup" | "identity_threshold" | "identity_model" | "join_ttl" | "feature";

export type StageId = "assignment" | "collection" | "dedup" | "identity" | "attribution" | "join" | "samples" | "training" | "auc";

export const STAGES: { id: StageId; name: string; unit: string }[] = [
  { id: "assignment", name: "Experiment Assignment", unit: "用户" },
  { id: "collection", name: "Event Collection", unit: "转化消息" },
  { id: "dedup", name: "Deduplication", unit: "逻辑转化" },
  { id: "identity", name: "Identity Matching", unit: "匹配上的转化" },
  { id: "attribution", name: "Attribution", unit: "归因结果" },
  { id: "join", name: "Flink Join", unit: "写出的正样本" },
  { id: "samples", name: "Training Sample Table", unit: "样本行" },
  { id: "training", name: "Model Training", unit: "特征分布" },
  { id: "auc", name: "AUC Evaluation", unit: "AUC" },
];

/** Stages a reader can blame in the debugging challenge. */
export const BLAMEABLE: { id: StageId; name: string }[] = [
  { id: "assignment", name: "Assignment" },
  { id: "dedup", name: "Dedup" },
  { id: "identity", name: "Identity / Attribution" },
  { id: "join", name: "Join" },
  { id: "training", name: "Training" },
];

export const SCENARIOS: { id: ScenarioId; name: string; candidate: Partial<PipelineConfig>; culprit: StageId | null; story: string }[] = [
  { id: "healthy", name: "A/A：两边配置完全相同", candidate: {}, culprit: null, story: "两条等价 pipeline。所有数据层的集合完全一致，AUC 只差一点点，落在自然波动范围里。" },
  { id: "assignment", name: "候选用了另一个 hash salt", candidate: { salt: "exp_2026_10_v2", share: 0.97 }, culprit: "assignment", story: "候选 pipeline 的分流配置换了 salt，又只镜像 97% 流量。第一层的用户集合就不一样了，后面每一层都跟着不一样。" },
  { id: "dedup", name: "候选按 message_id 去重", candidate: { dedupKey: "message_id" }, culprit: "dedup", story: "Pixel 和 Events API 的两条消息 message_id 不同、event_id 相同。按 message_id 去重等于没去重，重复转化一路流到正样本。" },
  { id: "identity_threshold", name: "候选的匹配阈值调高到 0.8", candidate: { matchThreshold: 0.8 }, culprit: "identity", story: "阈值调高，precision 上去了，coverage 掉了：一部分真实转化没匹配上，对应的 click 从 1 变成 0。" },
  { id: "identity_model", name: "候选换了 identity 模型", candidate: { identityModel: "idm_v2" }, culprit: "identity", story: "新模型匹配上的数量几乎一样，但匹配上的是另一批转化。只看 count 会以为没问题，看集合差才发现。" },
  { id: "join_ttl", name: "候选的 join 状态 TTL 只有 30 分钟", candidate: { joinTtl: 30 }, culprit: "join", story: "转化来得晚的 click，状态已经被清掉了，join 不上。样本行数一样，但有一批 label 从 1 变成了 0。" },
  { id: "feature", name: "候选读了旧版特征 fv_87", candidate: { featureVersion: "fv_87" }, culprit: "training", story: "样本集合和 label 完全一致，但训练时拼的是旧版本特征。差异第一次出现在训练阶段的特征分布上。" },
];

// ---------------------------------------------------------------- toy population

const USERS = 600;
const CLICKS_PER_USER = 2;

type Click = { id: string; user: string };
type Conversion = { id: string; user: string; click: string; delay: number; scoreV1: number; scoreV2: number; sources: string[] };

const users = Array.from({ length: USERS }, (_, i) => `u${String(i).padStart(4, "0")}`);
const clicks: Click[] = users.flatMap((u) => Array.from({ length: CLICKS_PER_USER }, (_, k) => ({ id: `${u}_c${k}`, user: u })));
const conversions: Conversion[] = clicks
  .filter((c) => u01(`conv:${c.id}`) < 0.12)
  .map((c) => ({
    id: `ev_${c.id}`,
    user: c.user,
    click: c.id,
    // Most conversions come within the hour; a tail comes hours later.
    delay: u01(`delay:${c.id}`) < 0.75 ? Math.round(5 + 50 * u01(`d1:${c.id}`)) : Math.round(60 + 180 * u01(`d2:${c.id}`)),
    scoreV1: 0.3 + 0.7 * u01(`s1:${c.id}`),
    scoreV2: 0.3 + 0.7 * u01(`s2:${c.id}`),
    sources: u01(`api:${c.id}`) < 0.45 ? ["pixel", "events_api"] : ["pixel"],
  }));

/** Multiset of keys as a set: the second copy of "x" becomes "x#2", so duplicates show up in set diffs. */
function withCopies(keys: string[]): string[] {
  const seen = new Map<string, number>();
  return keys.map((k) => {
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n === 1 ? k : `${k}#${n}`;
  });
}

export type StageData = { keys: string[]; labels?: Map<string, 0 | 1> };

export type PipelineRun = { stages: Record<StageId, StageData>; featureMean: number; auc: number; positives: number };

/**
 * Runs one pipeline over the users it is assigned. `userFilter` restricts users for A/B mode;
 * `run` names the training run, so two identical configs still get slightly different AUCs, as real reruns do.
 */
export function runPipeline(cfg: PipelineConfig, userFilter: (u: string) => boolean = () => true, run = "a"): PipelineRun {
  const inUsers = new Set(users.filter((u) => userFilter(u) && u01(`${cfg.salt}:${u}`) < cfg.share));
  const convs = conversions.filter((c) => inUsers.has(c.user));
  const messages = convs.flatMap((c) => c.sources.map((s) => ({ conv: c, messageId: `${c.id}@${s}` })));
  // Deduping on event_id leaves one record per conversion. message_id differs between Pixel and Events API,
  // so deduping on it keeps both copies; the second shows up as ev_x#2 from here on.
  const logical = cfg.dedupKey === "event_id" ? convs.map((c) => ({ key: c.id, conv: c })) : messages.map((m) => ({ key: m.conv.id, conv: m.conv }));
  const logicalKeys = withCopies(logical.map((l) => l.key));
  const matched = logical.map((l, i) => ({ ...l, key: logicalKeys[i] })).filter((l) => (cfg.identityModel === "idm_v1" ? l.conv.scoreV1 : l.conv.scoreV2) >= cfg.matchThreshold);
  const attributed = matched.map((m) => ({ ...m, attrKey: m.key.replace(/^ev_/, "attr_") }));
  const joined = attributed.filter((a) => a.conv.delay <= cfg.joinTtl);
  // Sample table: one row per click, plus an extra row for every duplicate positive (append-only sink).
  const positiveClicks = withCopies(joined.map((j) => j.conv.click));
  const sampleLabels = new Map<string, 0 | 1>();
  for (const c of clicks) if (inUsers.has(c.user)) sampleLabels.set(c.id, 0);
  for (const k of positiveClicks) sampleLabels.set(k, 1);
  const positives = positiveClicks.length;
  const featureMean = cfg.featureVersion === "fv_88" ? 0.412 : 0.371;
  // Illustrative AUC: a base value, small deterministic noise per config, minus penalties for label damage.
  const total = sampleLabels.size || 1;
  const trueConvClicks = new Set(convs.map((c) => c.click));
  const wrongLabels = [...sampleLabels].filter(([k, y]) => !k.includes("#") && y !== (trueConvClicks.has(k) ? 1 : 0)).length;
  const dupRows = positiveClicks.filter((k) => k.includes("#")).length;
  const noise = (u01(`auc:${run}`) - 0.5) * 0.0024;
  const auc = 0.742 + noise - (wrongLabels / total) * 0.35 - (dupRows / total) * 0.12 - (cfg.featureVersion === "fv_88" ? 0 : 0.011);
  return {
    stages: {
      assignment: { keys: [...inUsers] },
      collection: { keys: messages.map((m) => m.messageId) },
      dedup: { keys: logicalKeys },
      identity: { keys: matched.map((m) => m.key) },
      attribution: { keys: attributed.map((a) => a.attrKey) },
      join: { keys: joined.map((j) => j.attrKey), labels: new Map(withCopies(joined.map((j) => j.conv.click)).map((k) => [k, 1 as const])) },
      samples: { keys: [...sampleLabels.keys()], labels: sampleLabels },
      training: { keys: [...sampleLabels.keys()] },
      auc: { keys: [] },
    },
    featureMean,
    auc,
    positives,
  };
}

/** Natural spread of AUC between two identical pipelines (toy: what repeated A/A runs would show). */
export const AA_AUC_BAND = 0.002;

export type StageRow = {
  stage: StageId;
  countA: number;
  countB: number;
  /** (B − A) / A, or null when A is 0. */
  countDelta: number | null;
  /** Share of records lost relative to the previous stage, per side; null when the stages count different things. */
  dropA: number | null;
  dropB: number | null;
  /** |A △ B| / |A ∪ B|; null when not comparable (A/B mode or non-record stages). */
  dSample: number | null;
  /** Labels that differ among shared samples / |A ∩ B|. */
  dLabel: number | null;
  /** Records per assigned user, per side (A/B mode only, where raw sets cannot be compared). */
  rateA?: number;
  rateB?: number;
  /** Free-form metric for stages that are not record sets. */
  metric?: string;
  diverged: boolean;
};

export function symmetricDiffRatio(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const k of A) if (B.has(k)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : (A.size + B.size - 2 * inter) / union;
}

export function labelMismatchRatio(a: Map<string, 0 | 1>, b: Map<string, 0 | 1>): number {
  let shared = 0;
  let diff = 0;
  for (const [k, y] of a) {
    if (!b.has(k)) continue;
    shared += 1;
    if (b.get(k) !== y) diff += 1;
  }
  return shared === 0 ? 0 : diff / shared;
}

export type Reconciliation = { mode: "shadow" | "ab"; rows: StageRow[]; firstDiverged: StageId | null; aucA: number; aucB: number; srmP: number | null };

const DROP_CHAIN: Partial<Record<StageId, StageId>> = { dedup: "collection", identity: "dedup", attribution: "identity", join: "attribution" };

export function reconcile(scenario: ScenarioId, mode: "shadow" | "ab"): Reconciliation {
  const sc = SCENARIOS.find((s) => s.id === scenario)!;
  const candidate = { ...BASELINE, ...sc.candidate };
  // A/B: the arms are halves of the population split by one hash. The broken-salt scenario models a
  // treatment arm that hashes with its own salt and a skewed cut, so the arms overlap and come out uneven.
  const armA = (u: string) => u01(`split:${BASELINE.salt}:${u}`) < 0.5;
  const armB = (u: string) => u01(`split:${candidate.salt}:${u}`) >= (candidate.salt === BASELINE.salt ? 0.5 : 0.62);
  const a = mode === "shadow" ? runPipeline(BASELINE, undefined, "a") : runPipeline(BASELINE, armA, "a");
  const b = mode === "shadow" ? runPipeline(candidate, undefined, "b") : runPipeline({ ...candidate, share: 1 }, armB, "b");

  const rows: StageRow[] = STAGES.map(({ id }) => {
    const A = a.stages[id];
    const B = b.stages[id];
    const prev = DROP_CHAIN[id];
    const drop = (run: PipelineRun) => (prev && run.stages[prev].keys.length ? 1 - run.stages[id].keys.length / run.stages[prev].keys.length : null);
    if (id === "training") {
      if (mode === "ab") return { stage: id, countA: A.keys.length, countB: B.keys.length, countDelta: null, dropA: null, dropB: null, dSample: null, dLabel: null, metric: `特征均值 ${a.featureMean.toFixed(3)} vs ${b.featureMean.toFixed(3)}`, diverged: false };
      const shift = Math.abs(b.featureMean - a.featureMean);
      return { stage: id, countA: A.keys.length, countB: B.keys.length, countDelta: null, dropA: null, dropB: null, dSample: null, dLabel: null, metric: `特征均值 ${a.featureMean.toFixed(3)} vs ${b.featureMean.toFixed(3)}`, diverged: shift > 0.005 };
    }
    if (id === "auc") {
      const diff = b.auc - a.auc;
      const band = mode === "shadow" ? `A/A 波动 ±${AA_AUC_BAND}` : "A/B 的差可能就是真实效果";
      return { stage: id, countA: 0, countB: 0, countDelta: null, dropA: null, dropB: null, dSample: null, dLabel: null, metric: `${a.auc.toFixed(4)} vs ${b.auc.toFixed(4)}（Δ ${diff >= 0 ? "+" : ""}${diff.toFixed(4)}，${band}）`, diverged: mode === "shadow" && Math.abs(diff) > AA_AUC_BAND };
    }
    const countDelta = A.keys.length ? (B.keys.length - A.keys.length) / A.keys.length : null;
    const dSample = mode === "shadow" ? symmetricDiffRatio(A.keys, B.keys) : null;
    const dLabel = mode === "shadow" && A.labels && B.labels ? labelMismatchRatio(A.labels, B.labels) : null;
    // A/B arms hold different users, so sets are never equal and rate gaps may be the real effect.
    // Only the assignment check (SRM) can flag a bug there; everything else needs a Shadow run.
    const perUser = (run: PipelineRun) => run.stages[id].keys.length / (run.stages.assignment.keys.length || 1);
    const rates = mode === "ab" ? { rateA: perUser(a), rateB: perUser(b) } : {};
    const diverged = mode === "shadow" && ((dSample ?? 0) > 0 || (dLabel ?? 0) > 0);
    return { stage: id, countA: A.keys.length, countB: B.keys.length, countDelta, dropA: drop(a), dropB: drop(b), dSample, dLabel, ...rates, diverged };
  });

  let srmP: number | null = null;
  if (mode === "ab") {
    srmP = srmPValue(a.stages.assignment.keys.length, b.stages.assignment.keys.length);
    rows[0].diverged = srmP < 0.001;
    rows[0].metric = `SRM p = ${srmP < 0.0001 ? srmP.toExponential(1) : srmP.toFixed(3)}`;
  }
  const first = rows.find((r) => r.diverged);
  return { mode, rows, firstDiverged: first ? first.stage : null, aucA: a.auc, aucB: b.auc, srmP };
}

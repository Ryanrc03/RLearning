// Recommender Systems: id embeddings memorise, and with high-cardinality ids
// the second epoch overfits. The curves below are the real per-quarter-epoch
// validation AUC and running train loss of four kuairank Day 2 runs (DCN-v2,
// is_click, d = 16), copied from runs/<run_id>/metrics.json → model.history.
// No React here; see tests/one-epoch.test.ts.

export type EvalPoint = { epoch: number; trainLoss: number; validAuc: number };
export type IdRun = { key: string; runNo: number; runId: string; label: string; ids: string; params: number; history: EvalPoint[] };

const h = (rows: [number, number, number][]): EvalPoint[] => rows.map(([epoch, trainLoss, validAuc]) => ({ epoch, trainLoss, validAuc }));

export const ID_RUNS: IdRun[] = [
  {
    key: "f1",
    runNo: 9,
    runId: "20261022_144035_d2_dcnv2_f1_is_click",
    label: "F1，不加 id",
    ids: "—",
    params: 1163443,
    history: h([
      [0.25, 0.5241, 0.8004], [0.5, 0.5144, 0.8028], [0.75, 0.5124, 0.8033], [1.0, 0.5114, 0.8039],
      [1.25, 0.5087, 0.8037], [1.5, 0.5089, 0.8043], [1.75, 0.508, 0.804], [2.0, 0.5084, 0.804],
      [2.25, 0.5057, 0.8028], [2.5, 0.5056, 0.8036], [2.75, 0.5054, 0.8036], [3.0, 0.5048, 0.804],
    ]),
  },
  {
    key: "uid",
    runNo: 11,
    runId: "20261022_144701_d2_dcnv2_f1uid_is_click",
    label: "+ user_id",
    ids: "user_id（984 行）",
    params: 1235523,
    history: h([
      [0.25, 0.5232, 0.8012], [0.5, 0.5136, 0.8033], [0.75, 0.5115, 0.8037], [1.0, 0.5105, 0.8043],
      [1.25, 0.5073, 0.804], [1.5, 0.5078, 0.8043], [1.75, 0.507, 0.8041], [2.0, 0.5073, 0.8041],
      [2.25, 0.5044, 0.8029], [2.5, 0.5044, 0.8035], [2.75, 0.5045, 0.8035], [3.0, 0.5037, 0.8042],
    ]),
  },
  {
    key: "aid",
    runNo: 12,
    runId: "20261022_144915_d2_dcnv2_f1uidaid_is_click",
    label: "+ user_id + author_id",
    ids: "author_id（402,555 + OOV）",
    params: 7734291,
    history: h([
      [0.25, 0.5226, 0.801], [0.5, 0.5128, 0.8032], [0.75, 0.5104, 0.8034], [1.0, 0.5093, 0.8041],
      [1.25, 0.4507, 0.7813], [1.5, 0.4587, 0.7807], [1.75, 0.465, 0.7839], [2.0, 0.4801, 0.7924],
      [2.25, 0.3854, 0.7665], [2.5, 0.3861, 0.7505], [2.75, 0.383, 0.7579], [3.0, 0.3973, 0.7587],
    ]),
  },
  {
    key: "vid",
    runNo: 13,
    runId: "20261022_145140_d2_dcnv2_f1uidaidvid_is_click",
    label: "+ user_id + author_id + video_id",
    ids: "video_id（686,346 + OOV）",
    params: 18775251,
    history: h([
      [0.25, 0.5225, 0.8007], [0.5, 0.5126, 0.8029], [0.75, 0.5098, 0.8032], [1.0, 0.5086, 0.8037],
      [1.25, 0.3801, 0.7644], [1.5, 0.3912, 0.7533], [1.75, 0.4032, 0.7607], [2.0, 0.4517, 0.7801],
      [2.25, 0.2616, 0.7199], [2.5, 0.2737, 0.7113], [2.75, 0.2573, 0.7137], [3.0, 0.2758, 0.7144],
    ]),
  },
];

// The checkpoint kurec/models/deep.fit keeps: the evaluation with the highest valid AUC (first one on ties).
export function bestCheckpoint(history: readonly EvalPoint[]): EvalPoint {
  return history.reduce((best, p) => (p.validAuc > best.validAuc ? p : best), history[0]);
}

export function pointAt(history: readonly EvalPoint[], epoch: number): EvalPoint {
  return history.reduce((near, p) => (Math.abs(p.epoch - epoch) < Math.abs(near.epoch - epoch) ? p : near), history[0]);
}

// How much valid AUC the run has lost by `epoch` relative to its best checkpoint up to then.
export function dropFromBest(history: readonly EvalPoint[], epoch: number): number {
  const seen = history.filter((p) => p.epoch <= epoch + 1e-9);
  if (seen.length === 0) return 0;
  return bestCheckpoint(seen).validAuc - pointAt(seen, epoch).validAuc;
}

// Vocabulary built from train only; ids seen ≥ 2 times get a row, the rest share the OOV row
// (kuairank docs/DEEP_CTR.zh-CN.md §1).
export const ID_COVERAGE = [
  { field: "video_id（≥1 次）", vocab: 2119510, valid: 0.258, test: 0.151, random: 0.699 },
  { field: "video_id（≥2 次，采用）", vocab: 686346, valid: 0.201, test: 0.115, random: 0.509 },
  { field: "author_id（≥2 次，采用）", vocab: 402555, valid: 0.758, test: 0.685, random: 0.973 },
];

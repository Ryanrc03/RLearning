// Recommender Systems: one training step of a deep multi-task ranker, followed
// end to end on a real KuaiRand-1K row. The row, its encoded indices, the
// embedding rows and the four predictions come from kuairank's learn/ track
// (shared-bottom model L1_shared_4t, seed 0); every size, loss and count the
// figure shows is computed here. No React here; see tests/training-setup.test.ts.

export const EMB_DIM = 16;
export const N_FIELDS = 27; // categorical fields without the user / author / video ids
export const N_DENSE = 61;
export const BOTTOM = [512, 256] as const;
export const TOWER = [128] as const;
export const TASKS = [
  { key: "click", name: "点开" },
  { key: "longView", name: "长播放" },
  { key: "like", name: "点赞" },
  { key: "follow", name: "关注" },
] as const;

export const TRAIN_ROWS = 5_021_422;
export const BATCH = 4_096;
export const EPOCHS = 3;
export const EVALS_PER_EPOCH = 4;
export const LR = 1e-3;
// Rows per categorical table (vocabulary + one row for "missing / unseen").
export const TABLE_ROWS = [15, 8, 8, 3, 3, 8, 24, 388, 15, 6, 4, 38, 283, 8, 6, 4, 4, 4, 4, 4, 4, 4, 31, 4, 58, 8, 25];

// One train row (row_id 600053, user 114, tab 1, Saturday 17:xx): clicked, long view, liked, not followed.
export const EXAMPLE = {
  categorical: [
    { field: "tab", raw: "1", index: 2, rows: 15 },
    { field: "hour", raw: "17", index: 18, rows: 25 },
    { field: "weekday", raw: "6", index: 6, rows: 8 },
    { field: "tag_first", raw: "12", index: 13, rows: 58 },
    { field: "onehot_feat3", raw: "1153", index: 321, rows: 388 },
    { field: "music_type", raw: "9", index: 6, rows: 8 },
  ],
  dense: [
    { field: "duration_ms", raw: 41_433, log1p: true, z: 0.057 },
    { field: "video_ctr_7d", raw: 0.5044, log1p: false, z: 2.216 },
    { field: "user_ctr_7d", raw: 0.741, log1p: false, z: 1.885 },
    { field: "ua_ctr_all", raw: 0.3806, log1p: false, z: -0.025 },
    { field: "user_gap_s", raw: 6_961, log1p: true, z: 2.428 },
  ],
  labels: [1, 1, 1, 0] as const,
  predictions: [0.8811, 0.7618, 0.4287, 0.019] as const,
  // tag_first = 12 → row 13 of the 58 × 16 table, at initialisation (N(0, 0.01²)) and after 2.5 epochs
  tagRowInit: [0.006, -0.003, -0.013, 0.007, -0.001, 0.002, -0.001, 0.0, 0.007, 0.01, 0.0, -0.001, -0.0, -0.007, -0.012, -0.015],
  tagRowTrained: [0.031, -0.078, -0.1, 0.202, -0.037, 0.01, -0.069, -0.06, 0.055, 0.251, 0.039, 0.053, 0.119, 0.009, -0.063, -0.061],
};

// Row lengths over all 971 rows of the 27 tables: median at initialisation, then median / p10 / p90 after training.
export const TABLE_NORMS = { initMedian: 0.039, trainedMedian: 0.299, trainedP10: 0.164, trainedP90: 0.52 };

// Valid click GAUC at every quarter epoch (all tabs); the best point keeps its weights.
export const VALID_CURVE: readonly (readonly [number, number])[] = [
  [0.25, 0.7035], [0.5, 0.7059], [0.75, 0.7072], [1, 0.709], [1.25, 0.7088], [1.5, 0.709],
  [1.75, 0.7102], [2, 0.7112], [2.25, 0.7109], [2.5, 0.7118], [2.75, 0.7118], [3, 0.7116],
];

export const x0Dim = (fields = N_FIELDS, dim = EMB_DIM, dense = N_DENSE) => fields * dim + dense;

// Weights + biases of a Linear stack in → h1 → … → out.
export function mlpParams(widths: readonly number[]): number {
  let total = 0;
  for (let i = 0; i + 1 < widths.length; i++) total += widths[i] * widths[i + 1] + widths[i + 1];
  return total;
}

export function paramCounts(nTasks: number = TASKS.length) {
  const embedding = TABLE_ROWS.reduce((s, r) => s + r, 0) * EMB_DIM;
  const bottom = mlpParams([x0Dim(), ...BOTTOM]);
  const towers = nTasks * mlpParams([BOTTOM[BOTTOM.length - 1], ...TOWER, 1]);
  return { embedding, bottom, towers, total: embedding + bottom + towers };
}

// Binary cross-entropy of one prediction.
export function bce(p: number, y: number): number {
  const q = Math.min(Math.max(p, 1e-7), 1 - 1e-7);
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
}

export function exampleLosses() {
  const per = EXAMPLE.predictions.map((p, k) => bce(p, EXAMPLE.labels[k]));
  return { per, total: per.reduce((s, v) => s + v, 0) };
}

// d BCE / d logit = p − y: the error signal each tower sends back into the shared bottom.
export const logitGrad = (p: number, y: number) => p - y;

export const norm = (v: readonly number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

// How many embedding numbers one row touches, out of all of them: only the looked-up rows get a gradient.
export function touchedEmbedding() {
  const touched = N_FIELDS * EMB_DIM;
  return { touched, total: paramCounts().embedding, share: touched / paramCounts().embedding };
}

export const stepsPerEpoch = (rows = TRAIN_ROWS, batch = BATCH) => Math.ceil(rows / batch);

export function bestCheckpoint(curve = VALID_CURVE) {
  let best = curve[0];
  for (const p of curve) if (p[1] > best[1]) best = p;
  return { epoch: best[0], gauc: best[1], evals: curve.length };
}

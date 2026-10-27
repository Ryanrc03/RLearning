// Recommender Systems: what is in KuaiRand-1K. Raw counts below were read off
// kuairank's data/processed/log.parquet (a dedup of the official CSVs) on
// 2026-10-27; rates, ratios and daily curves are computed from them here.
// No React here; see tests/kuairand-overview.test.ts.

export const DATASET = {
  rows: 11_661_848, // exposures after removing exact duplicates
  users: 1_000,
  videos: 4_371_868, // distinct video ids that were shown at least once
  randomRows: 43_027,
  randomVideos: 7_388,
  tabs: 15,
  firstDay: "2022-04-08",
  lastDay: "2022-05-08",
  // exposures per tab, largest first (tab id, rows)
  tabRows: [
    [1, 7_760_232],
    [0, 2_404_886],
    [4, 895_385],
    [2, 402_366],
    [6, 99_087],
    [3, 37_382],
  ] as const,
};

export type LabelKey = "click" | "longView" | "like" | "follow" | "comment" | "forward" | "hate" | "profile";

export const LABELS: { key: LabelKey; column: string; name: string; used: boolean; note: string }[] = [
  { key: "click", column: "is_click", name: "点开", used: true, note: "tab 1 是自动播放的流，点开 = 进详情或全屏" },
  { key: "longView", column: "long_view", name: "长播放", used: true, note: "由播放时长派生" },
  { key: "like", column: "is_like", name: "点赞", used: true, note: "约 1/3 发生在没点开的曝光上" },
  { key: "follow", column: "is_follow", name: "关注作者", used: true, note: "最稀疏的主目标" },
  { key: "comment", column: "is_comment", name: "评论", used: false, note: "" },
  { key: "forward", column: "is_forward", name: "转发", used: false, note: "" },
  { key: "hate", column: "is_hate", name: "不感兴趣", used: false, note: "唯一的负反馈" },
  { key: "profile", column: "is_profile_enter", name: "进作者主页", used: false, note: "" },
];

export type SetKey = "train" | "valid" | "testTab1" | "random";

type SetCounts = {
  label: string;
  dates: string;
  n: number;
  users: number;
  videos: number;
  playNonZero: number;
  playMedianMs: number;
  pos: Record<LabelKey, number>;
  usersWithPos: Record<LabelKey, number>;
  medianPosPerUser: Record<LabelKey, number>;
};

export const SETS: Record<SetKey, SetCounts> = {
  train: {
    label: "train（全部 tab）",
    dates: "4/08–4/21",
    n: 5_021_422, users: 983, videos: 2_119_510, playNonZero: 3_983_441, playMedianMs: 5_496,
    pos: { click: 1_910_938, longView: 1_328_607, like: 75_819, follow: 5_673, comment: 12_374, forward: 3_952, hate: 8_716, profile: 90_014 },
    usersWithPos: { click: 983, longView: 983, like: 908, follow: 652, comment: 613, forward: 565, hate: 174, profile: 937 },
    medianPosPerUser: { click: 1_550, longView: 1_094, like: 14, follow: 3, comment: 6, forward: 3, hate: 2, profile: 38 },
  },
  valid: {
    label: "valid（全部 tab）",
    dates: "4/22–4/28",
    n: 2_503_287, users: 978, videos: 1_159_803, playNonZero: 2_003_781, playMedianMs: 5_462,
    pos: { click: 954_849, longView: 665_939, like: 35_981, follow: 2_209, comment: 6_643, forward: 1_950, hate: 690, profile: 46_570 },
    usersWithPos: { click: 975, longView: 973, like: 844, follow: 483, comment: 530, forward: 410, hate: 113, profile: 899 },
    medianPosPerUser: { click: 740, longView: 522, like: 9, follow: 2, comment: 4, forward: 2, hate: 3, profile: 21 },
  },
  testTab1: {
    label: "test（tab 1）",
    dates: "4/29–5/08",
    n: 2_756_916, users: 988, videos: 1_118_455, playNonZero: 2_727_370, playMedianMs: 4_982,
    pos: { click: 1_218_079, longView: 861_570, like: 58_541, follow: 2_813, comment: 9_808, forward: 2_726, hate: 1_016, profile: 54_137 },
    usersWithPos: { click: 988, longView: 988, like: 864, follow: 572, comment: 542, forward: 466, hate: 138, profile: 913 },
    medianPosPerUser: { click: 1_006, longView: 702, like: 11, follow: 2, comment: 5, forward: 2, hate: 2, profile: 26 },
  },
  random: {
    label: "random（随机曝光）",
    dates: "4/22–5/08",
    n: 43_027, users: 1_000, videos: 7_388, playNonZero: 42_657, playMedianMs: 2_102,
    pos: { click: 7_492, longView: 3_621, like: 239, follow: 8, comment: 13, forward: 28, hate: 35, profile: 198 },
    usersWithPos: { click: 849, longView: 699, like: 86, follow: 8, comment: 9, forward: 15, hate: 13, profile: 143 },
    medianPosPerUser: { click: 4, longView: 3, like: 1, follow: 1, comment: 1, forward: 1, hate: 1, profile: 1 },
  },
};

export const SET_ORDER: SetKey[] = ["train", "valid", "testTab1", "random"];

export const rate = (pos: number, n: number) => (n === 0 ? 0 : pos / n);
// Negatives per positive; Infinity when there is no positive at all.
export const negPerPos = (pos: number, n: number) => (pos === 0 ? Infinity : (n - pos) / pos);

export type LabelCell = { rate: number; negPerPos: number; pos: number; usersWithPos: number; usersShare: number; medianPosPerUser: number };

export function labelCell(set: SetKey, label: LabelKey): LabelCell {
  const s = SETS[set];
  const pos = s.pos[label];
  return {
    rate: rate(pos, s.n),
    negPerPos: negPerPos(pos, s.n),
    pos,
    usersWithPos: s.usersWithPos[label],
    usersShare: s.usersWithPos[label] / s.users,
    medianPosPerUser: s.medianPosPerUser[label],
  };
}

// Daily standard (non-random) exposures: [date, all tabs, tab 1, likes in tab 1, clicks in tab 1].
export const DAILY: readonly (readonly [string, number, number, number, number])[] = [
  ["04-08", 355_732, 231_923, 4_049, 103_149], ["04-09", 397_734, 258_669, 5_057, 116_588], ["04-10", 402_656, 268_154, 5_277, 117_269],
  ["04-11", 368_100, 243_361, 4_061, 104_346], ["04-12", 343_069, 225_275, 3_682, 95_398], ["04-13", 344_189, 221_706, 4_182, 96_037],
  ["04-14", 323_935, 212_584, 3_786, 94_911], ["04-15", 359_155, 229_542, 4_475, 104_005], ["04-16", 386_228, 254_081, 5_666, 123_227],
  ["04-17", 394_489, 254_549, 5_668, 119_000], ["04-18", 331_629, 213_977, 3_469, 96_335], ["04-19", 335_532, 223_215, 3_883, 99_703],
  ["04-20", 336_447, 227_005, 3_790, 102_554], ["04-21", 342_527, 222_256, 3_188, 99_079], ["04-22", 364_941, 240_434, 4_422, 108_721],
  ["04-23", 417_490, 280_343, 5_809, 127_624], ["04-24", 346_382, 228_855, 3_905, 101_430], ["04-25", 338_976, 230_321, 4_005, 102_866],
  ["04-26", 347_685, 228_400, 3_746, 102_867], ["04-27", 346_131, 235_832, 3_925, 103_310], ["04-28", 341_682, 230_198, 4_163, 100_875],
  ["04-29", 389_318, 263_122, 4_775, 114_961], ["04-30", 433_685, 291_046, 7_111, 133_312], ["05-01", 437_713, 292_149, 6_374, 133_315],
  ["05-02", 422_668, 284_258, 5_834, 126_523], ["05-03", 432_448, 293_477, 6_846, 127_921], ["05-04", 405_886, 278_163, 6_525, 122_446],
  ["05-05", 381_625, 251_510, 4_909, 108_958], ["05-06", 393_851, 262_661, 5_106, 112_785], ["05-07", 386_015, 261_133, 5_277, 114_817],
  ["05-08", 410_903, 279_397, 5_784, 123_041],
];

export type SplitName = "train" | "valid" | "test";
export const splitOfDay = (mmdd: string): SplitName => (mmdd <= "04-21" ? "train" : mmdd <= "04-28" ? "valid" : "test");

export type DailyPoint = { day: string; split: SplitName; exposures: number; likeRateTab1: number; clickRateTab1: number };

export function dailySeries(): DailyPoint[] {
  return DAILY.map(([day, all, tab1, like, click]) => ({
    day,
    split: splitOfDay(day),
    exposures: all,
    likeRateTab1: rate(like, tab1),
    clickRateTab1: rate(click, tab1),
  }));
}

// Pooled tab-1 like / click rate of one split, from the daily counts.
export function splitRateTab1(split: SplitName, which: "like" | "click"): number {
  let pos = 0;
  let n = 0;
  for (const [day, , tab1, like, click] of DAILY) {
    if (splitOfDay(day) !== split) continue;
    pos += which === "like" ? like : click;
    n += tab1;
  }
  return rate(pos, n);
}

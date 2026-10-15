export type NoteEntry = {
  slug: string;
  title: string;
  description: string;
  categoryId: "cs" | "systems" | "ml" | "ai-infra";
  category: string;
  section: string;
  created: string;
  updated: string;
  status: "seed" | "growing" | "stable";
  readingMinutes: number;
  tags: string[];
};

// Published notes share this metadata across navigation, search, and article pages.
export const noteEntries: NoteEntry[] = [
  {
    slug: "ml/reinforcement-learning/ucb",
    title: "Upper Confidence Bound (UCB)",
    description:
      "用不确定性指导探索：从 UCB 的直觉与公式，到适应奖励变化的 Discounted UCB。",
    categoryId: "ml",
    category: "ML & LLM",
    section: "Reinforcement Learning",
    created: "2026-09-29",
    updated: "2026-09-29",
    status: "growing",
    readingMinutes: 8,
    tags: ["bandits", "exploration", "reinforcement learning"],
  },
  {
    slug: "cs/os/virtual-memory",
    title: "Virtual Memory",
    description:
      "理解操作系统如何为进程提供独立的地址空间，以及地址转换背后的机制与代价。",
    categoryId: "cs",
    category: "CS Foundations",
    section: "Operating Systems",
    created: "2026-09-29",
    updated: "2026-09-29",
    status: "seed",
    readingMinutes: 2,
    tags: ["operating systems", "memory", "paging"],
  },
  {
    slug: "ml/recsys/kuairand-input",
    title: "一条曝光的 84 维输入",
    description:
      "KuaiRand-1K 的曝光日志怎样变成排序模型的输入：数据流、一条真实样本的 84 个特征、只看过去的时间窗统计。",
    categoryId: "ml",
    category: "ML & LLM",
    section: "Recommender Systems",
    created: "2026-10-14",
    updated: "2026-10-14",
    status: "growing",
    readingMinutes: 6,
    tags: ["recommender systems", "feature engineering", "KuaiRand", "LightGBM"],
  },
  {
    slug: "ml/recsys/lightgbm-explained",
    title: "梯度提升树如何给曝光打分",
    description:
      "以真实训练的 LightGBM click 模型为例：目标函数与梯度、一轮迭代、直方图与 leaf-wise、第一棵树的结构、一条样本的 407 步轨迹与特征贡献。",
    categoryId: "ml",
    category: "ML & LLM",
    section: "Recommender Systems",
    created: "2026-10-14",
    updated: "2026-10-14",
    status: "growing",
    readingMinutes: 14,
    tags: ["gradient boosting", "LightGBM", "CTR", "interpretability"],
  },
  {
    slug: "ml/recsys/boosting-lab",
    title: "提升树训练实验台",
    description:
      "16 个点、一个特征，按一轮长一棵树：看残差被压小、LogLoss 下降、森林长出、分数累加；GBDT / XGBoost / LightGBM 的差别做成开关。",
    categoryId: "ml",
    category: "ML & LLM",
    section: "Recommender Systems",
    created: "2026-10-14",
    updated: "2026-10-14",
    status: "growing",
    readingMinutes: 12,
    tags: ["gradient boosting", "XGBoost", "LightGBM", "interactive"],
  },
];

export function getNote(slug: string): NoteEntry | undefined {
  return noteEntries.find((note) => note.slug === slug);
}

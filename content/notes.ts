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
    slug: "cs/fundamentals/process-vs-thread",
    title: "Process vs Thread",
    description:
      "一句话讲清定义，一张图看“改一个变量”和“一个崩溃”在两种结构下的差别，再用 Chrome 的标签页当真实例子。",
    categoryId: "cs",
    category: "CS Foundations",
    section: "CS Fundamentals",
    created: "2026-10-15",
    updated: "2026-10-15",
    status: "growing",
    readingMinutes: 4,
    tags: ["process", "thread", "fundamentals", "interactive"],
  },
  {
    slug: "cs/fundamentals/thread-vs-coroutine",
    title: "Thread vs Coroutine",
    description:
      "一句话讲清 coroutine 是运行时在一个 thread 上轮流跑的函数，一张时间线对比 3 个网络请求和 3 个纯计算在 3 个 thread 与 1 个 thread 上的差别，再用 Go 写的网关当真实例子。",
    categoryId: "cs",
    category: "CS Foundations",
    section: "CS Fundamentals",
    created: "2026-10-15",
    updated: "2026-10-15",
    status: "growing",
    readingMinutes: 4,
    tags: ["thread", "coroutine", "goroutine", "async", "fundamentals", "interactive"],
  },
  {
    slug: "cs/fundamentals/memory-hierarchy",
    title: "Memory Hierarchy",
    description:
      "一句话讲清存储金字塔，一张图把 register、cache、RAM、SSD、HDD 和 VRAM 放在一起看一次读取、再读一次和断电，再用做饭当真实例子。",
    categoryId: "cs",
    category: "CS Foundations",
    section: "CS Fundamentals",
    created: "2026-10-15",
    updated: "2026-10-15",
    status: "growing",
    readingMinutes: 4,
    tags: ["memory", "cache", "storage", "GPU", "fundamentals", "interactive"],
  },
  {
    slug: "cs/os/processes-threads-coroutines",
    title: "进程、线程、协程，以及 CUDA 里的“线程”",
    description:
      "三个问题分清三种执行模型：谁调度、切换多贵、崩了连累谁。单独一节讲线程和进程到底差在哪；对比器看时间线与内存布局；再看 CUDA 的线程为什么是 warp 里的一条 lane。",
    categoryId: "cs",
    category: "CS Foundations",
    section: "Operating Systems",
    created: "2026-10-15",
    updated: "2026-10-15",
    status: "growing",
    readingMinutes: 9,
    tags: ["operating systems", "concurrency", "scheduling", "CUDA", "interactive"],
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
  {
    slug: "ai-infra/agent-harness/agent-loop",
    title: "Agent 的最小循环",
    description:
      "agent = 模型 + 工具 + while 循环，循环之外的一切是 harness。逐步模拟一次修复测试的循环，看消息列表怎样增长、什么让它停下。",
    categoryId: "ai-infra",
    category: "AI Infrastructure",
    section: "Agent Harness",
    created: "2026-10-15",
    updated: "2026-10-15",
    status: "growing",
    readingMinutes: 10,
    tags: ["agent", "harness", "context", "interactive"],
  },
  {
    slug: "ai-infra/agent-harness/tools-permissions-hooks",
    title: "工具调用、权限与 Hook",
    description:
      "模型只产生 JSON，执行在 harness 里。权限模式与 deny → ask → allow 规则、hook 的事件与退出码；用模拟器看一次调用在哪一层被放行或拦下。",
    categoryId: "ai-infra",
    category: "AI Infrastructure",
    section: "Agent Harness",
    created: "2026-10-15",
    updated: "2026-10-15",
    status: "growing",
    readingMinutes: 12,
    tags: ["agent", "harness", "permissions", "hooks", "interactive"],
  },
  {
    slug: "ai-infra/agent-harness/subagents-skills-mcp",
    title: "Subagent、Skill 与 MCP：三种扩展方式",
    description:
      "subagent 是另一个循环，skill 是按需加载的说明书，MCP 是统一协议。三个可视化：委派省了什么、渐进披露加载了什么、一个 MCP 工具的完整时序。",
    categoryId: "ai-infra",
    category: "AI Infrastructure",
    section: "Agent Harness",
    created: "2026-10-15",
    updated: "2026-10-15",
    status: "growing",
    readingMinutes: 12,
    tags: ["agent", "harness", "subagents", "skills", "MCP", "interactive"],
  },
  {
    slug: "ai-infra/agent-harness/goals-and-harness-design",
    title: "Goal、停止条件与设计自己的 Harness",
    description:
      "循环的三种停法，Stop hook 与 /goal 怎样当验证闸门；三个问题决定模式和规则；五个任务原型的 harness 设计器。",
    categoryId: "ai-infra",
    category: "AI Infrastructure",
    section: "Agent Harness",
    created: "2026-10-15",
    updated: "2026-10-15",
    status: "growing",
    readingMinutes: 11,
    tags: ["agent", "harness", "verification", "design", "interactive"],
  },
];

export function getNote(slug: string): NoteEntry | undefined {
  return noteEntries.find((note) => note.slug === slug);
}

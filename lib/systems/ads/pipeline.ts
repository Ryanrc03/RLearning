// Nodes of the end-to-end pipeline explorer (chapter 00) and the chapter list of the series.
// This is a logical dependency graph for teaching: real systems run some of these in parallel,
// split them into more services, or order them differently.
// No React here; see tests/ads-backend.test.ts.

export const CHAPTERS = [
  { no: "00", slug: "systems/ads/overview", title: "Ads Backend Overview", question: "一次广告点击如何最终变成 Training Sample？" },
  { no: "01", slug: "systems/ads/signal-collection", title: "Signal Collection & Ingestion", question: "广告事件和转化信号从哪里来？" },
  { no: "02", slug: "systems/ads/identity-resolution", title: "Identity Resolution", question: "如何判断两个事件是否属于同一用户？" },
  { no: "03", slug: "systems/ads/attribution-labels", title: "Attribution & Label Generation", question: "Conversion 如何变成 CVR Label？" },
  { no: "04", slug: "systems/ads/streaming-architecture", title: "Streaming Data Architecture", question: "Kafka / ByteMQ / Joiner 如何协作？" },
  { no: "05", slug: "systems/ads/flink-streaming-training", title: "Flink & Streaming Training", question: "如何正确 Join、处理迟到事件并构建训练样本？" },
  { no: "06", slug: "systems/ads/dedup-exactly-once", title: "Deduplication & Exactly-once", question: "如何避免重复事件、重复归因和重复训练样本？" },
  { no: "07", slug: "systems/ads/multi-region-dr", title: "Multi-region Disaster Recovery", question: "双机房复制和 Failover 如何保证数据一致？" },
  { no: "08", slug: "systems/ads/experiment-platform", title: "Identity Experiment Platform", question: "如何设计可靠的 Shadow、A/A、A/B 实验？" },
] as const;

export type ChapterNo = (typeof CHAPTERS)[number]["no"];

export type View = "event" | "match" | "label";

export type PipelineNode = {
  id: string;
  name: string;
  /** Which path the node sits on. Impressions and clicks sit on both: they are served online and logged for training. */
  paths: ("training" | "serving")[];
  chapter: ChapterNo;
  duty: string;
  input: string;
  output: string;
  /** What the running example looks like here, in each of the three views. */
  views: Record<View, string>;
};

export const NODES: PipelineNode[] = [
  {
    id: "touch",
    name: "Ad Impression / Click",
    paths: ["training", "serving"],
    chapter: "01",
    duty: "广告被展示、被点击。在线链路的终点，也是训练链路的起点。",
    input: "竞价胜出的广告",
    output: "impression / click 日志",
    views: {
      event: "click_100 (Ad A, 09:50)\nclick_101 (Ad B, 10:00)",
      match: "还没有匹配：只知道某个用户点了广告",
      label: "还没有 label：点击刚发生，转化可能在几分钟或几天后",
    },
  },
  {
    id: "conversion",
    name: "Website / App Conversion",
    paths: ["training"],
    chapter: "01",
    duty: "用户在广告主网站或 App 里完成购买、注册等行为。",
    input: "用户行为",
    output: "Pixel / Events API / SDK / MMP 上报",
    views: {
      event: "purchase_501 (10:30, 59 USD)\n被上报了 3 次：Pixel、Events API、Region B 重放",
      match: "转化方只知道自己的订单，不知道是哪次点击带来的",
      label: "还没有 label",
    },
  },
  {
    id: "collect",
    name: "Signal Collection",
    paths: ["training"],
    chapter: "01",
    duty: "接收各来源的事件：鉴权、限流、记录 receive_time，尽快可靠地写入消息队列。",
    input: "HTTP 上报、SDK 批量上报、服务器回传",
    output: "RawEvent（可能重复、可能乱序）",
    views: {
      event: "3 条 RawEvent，event_id 都是 event_501\nsource = pixel / events_api / replay",
      match: "—",
      label: "—",
    },
  },
  {
    id: "validate",
    name: "Validation · Consent · Dedup",
    paths: ["training"],
    chapter: "01",
    duty: "校验 schema、规范化字段、检查 consent 与数据使用限制，按业务唯一键去重（去重的细节在第 06 章）。",
    input: "RawEvent",
    output: "Deduplicated Event",
    views: {
      event: "1 个逻辑转化：px_7:Purchase:event_501\n另外 2 条判为重复",
      match: "—",
      label: "—",
    },
  },
  {
    id: "mq",
    name: "Kafka / ByteMQ",
    paths: ["training"],
    chapter: "04",
    duty: "持久化、按 key 分区、让多个下游各自按 offset 消费和重放。",
    input: "去重后的事件，以及 click / impression 日志",
    output: "按 partition 有序的消息流",
    views: {
      event: "conversions topic，key = user_1\nclicks topic，key = user_1 → 同一个 partition 号",
      match: "—",
      label: "—",
    },
  },
  {
    id: "identity",
    name: "Identity Resolution",
    paths: ["training"],
    chapter: "02",
    duty: "判断转化和哪些触点属于同一个人：确定性匹配优先，概率匹配要有阈值和置信度。",
    input: "转化 + 候选触点",
    output: "IdentityMatch（带 method 和 confidence）",
    views: {
      event: "event_501",
      match: "event_501 ↔ click_101：deterministic，1.00\nevent_501 ↔ click_100：probabilistic，0.86",
      label: "—",
    },
  },
  {
    id: "attribution",
    name: "Attribution",
    paths: ["training"],
    chapter: "03",
    duty: "按归因规则和窗口，把转化的 credit 分给触点。这是报表口径，不直接等于训练 label。",
    input: "IdentityMatch",
    output: "AttributionResult（policy、credit、revision）",
    views: {
      event: "event_501",
      match: "last_click_7d：click_101 credit = 1.0\nclick_100 credit = 0",
      label: "还不是 label：label 规则在下游另行定义",
    },
  },
  {
    id: "joiner",
    name: "Streaming Joiner",
    paths: ["training"],
    chapter: "04",
    duty: "按业务 key 和时间约束，把 click、conversion、特征快照拼在一起。",
    input: "clicks + attribution results + feature snapshots",
    output: "带特征和转化信息的 click 记录",
    views: {
      event: "click_101 + event_501 + 点击时刻的特征",
      match: "沿用 attribution 的结果",
      label: "click_101 → 有转化；click_100 → 暂无",
    },
  },
  {
    id: "flink",
    name: "Flink Processing",
    paths: ["training"],
    chapter: "05",
    duty: "有状态的流处理：watermark、state TTL、迟到数据、checkpoint，产出带状态的 label。",
    input: "join 后的记录",
    output: "provisional / final label 及其 revision",
    views: {
      event: "—",
      match: "—",
      label: "click_101：label 1，positive\nclick_100：label 0，provisional（窗口未到期）",
    },
  },
  {
    id: "builder",
    name: "Training Sample Builder",
    paths: ["training"],
    chapter: "05",
    duty: "把 label 和特征拼成 model-ready example，带 sample_id、label_status、版本号。",
    input: "label 流 + 特征",
    output: "TrainingSample",
    views: {
      event: "—",
      match: "—",
      label: "s:cvr:click_101:lp_v3 → label 1, revision 1\ns:cvr:click_100:lp_v3 → label 0, revision 1",
    },
  },
  {
    id: "store",
    name: "Feature / Label Store",
    paths: ["training", "serving"],
    chapter: "06",
    duty: "离线侧：按 sample_id 幂等写入的样本表；在线侧：低延迟的特征查询。",
    input: "TrainingSample / 实时特征",
    output: "训练读取的样本表；在线读取的特征",
    views: {
      event: "—",
      match: "—",
      label: "每个 sample_id 只有一行；修正按 revision 覆盖",
    },
  },
  {
    id: "training",
    name: "ML Training",
    paths: ["training"],
    chapter: "08",
    duty: "流式或批式训练 CTR / CVR 等模型，评估后发布新版本。",
    input: "样本表的一个时间切片",
    output: "新模型版本 + 离线指标（AUC 等）",
    views: {
      event: "—",
      match: "—",
      label: "label 是监督信号：1 个正样本、1 个负样本进入这一批",
    },
  },
  {
    id: "serving",
    name: "Model Serving",
    paths: ["serving"],
    chapter: "08",
    duty: "在线推理：每个广告请求在几十毫秒内给出 pCTR、pCVR。",
    input: "请求上下文 + 在线特征",
    output: "pCTR / pCVR",
    views: {
      event: "下一次广告请求",
      match: "—",
      label: "输出的是预测概率（例如 pCVR = 0.031），不是 label",
    },
  },
  {
    id: "bidding",
    name: "Ads Prediction & Bidding",
    paths: ["serving"],
    chapter: "00",
    duty: "用预测值和出价算排序分，决定展示哪个广告，结果又回到 impression / click。",
    input: "pCTR、pCVR、出价",
    output: "胜出的广告 → 新的 impression",
    views: {
      event: "新的 impression → 回到链路起点",
      match: "—",
      label: "—",
    },
  },
];

/** The order the explorer walks through on "next". */
export const TRAINING_ORDER = ["touch", "conversion", "collect", "validate", "mq", "identity", "attribution", "joiner", "flink", "builder", "store", "training"];
export const SERVING_ORDER = ["store", "serving", "bidding", "touch"];

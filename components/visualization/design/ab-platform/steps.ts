// The delivery-framework steps as this case study uses them. `heading` must match the MDX "## " text
// so the map and the step strips can link to the section.

export type DeliveryStep = {
  n: number;
  key: string;
  label: string;
  time: string;
  optional?: boolean;
  heading: string;
  what: string;
  here: string[];
};

export const DELIVERY_STEPS: DeliveryStep[] = [
  {
    n: 1, key: "req", label: "Requirements", time: "~5 min", heading: "Step 1 · Requirements",
    what: "弄清楚要做什么：功能需求是“用户应该能…”，非功能需求是带数字的“系统应该…”。",
    here: ["3 条功能需求：数据自动进库、按实验和日期看结果、看到统计结论", "4 条非功能需求：数据新鲜度、查询延迟、结果一致可复现、权限与安全", "明确不做：随机分流、实时流处理"],
  },
  {
    n: 2, key: "ent", label: "Core\nEntities", time: "~2 min", heading: "Step 2 · Core Entities",
    what: "列出系统里的名词，先不写全字段，只说清楚它们是什么、怎么关联。",
    here: ["Experiment、Variant、Metric Snapshot、Daily Stats 四个实体", "Daily Stats 的主键就是业务唯一性：(实验, 组, 日期)"],
  },
  {
    n: 3, key: "api", label: "API or\nInterface", time: "~5 min", heading: "Step 3 · API",
    what: "定义系统和用户之间的契约。默认 REST，资源用复数名词。",
    here: ["GET /experiments 列出实验", "GET /experiments/{id}/summary 返回汇总和检验结果", "GET /experiments/{id}/daily 返回每日曲线"],
  },
  {
    n: 4, key: "flow", label: "Data Flow", time: "~5 min", optional: true, heading: "Step 4 · Data Flow",
    what: "数据处理类系统值得把“输入怎么一步步变成输出”列出来。",
    here: ["写入路径：拉取 → 落原始数据 → 清洗校验 → 按天汇总 upsert", "读取路径：一次看板请求的五步，可以逐步模拟"],
  },
  {
    n: 5, key: "hld", label: "High-level\nDesign", time: "~10-15 min", heading: "Step 5 · High-level Design",
    what: "画方框和箭头，按功能需求一条条把组件加上去，直到每条需求都被满足。",
    here: ["FR1 → Ingestion Worker + PostgreSQL", "FR2 → FastAPI + React Dashboard", "FR3 → FastAPI 里的统计模块", "在数据库旁边写出关键表和列"],
  },
  {
    n: 6, key: "deep", label: "Deep Dives", time: "~10 min", heading: "Step 6 · Deep Dives",
    what: "回到非功能需求，挑最关键的几处往深里讲：怎么做、为什么、代价是什么。",
    here: ["不漏不重地增量拉取", "查询性能：索引、GROUP BY、EXPLAIN", "统计正确性：先求和再相除、偷看、SRM", "部署分工与技术选型取舍"],
  },
];

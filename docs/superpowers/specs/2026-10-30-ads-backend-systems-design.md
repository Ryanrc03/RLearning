# Ads Backend Systems 系列（Systems › Ads Backend Systems）

> 2026-10-30，按用户提供的开发计划直接实施（自治模式，无单独的设计对话）。

## 范围

九页，一个 series（`sys-ads`），按数据流顺序阅读，每页有上一篇 / 下一篇：

| # | slug | 交互 |
| --- | --- | --- |
| 00 | `systems/ads/overview` | `PipelineExplorer`：点节点看 input / output / 职责，切换 Event / Match / Label，切换训练 / 在线路径，节点链接到章节 |
| 01 | `systems/ads/signal-collection` | `SignalMergeViz`：Pixel + Events API 合并成一个逻辑转化；缺 event_id、拦截、无 consent |
| 02 | `systems/ads/identity-resolution` | `MatchingPlayground`：阈值 → precision / recall / coverage（toy） |
| 03 | `systems/ads/attribution-labels` | `AttributionTimeline`（归因规则、窗口、label 规则）、`LabelMaturityViz`（provisional → revision → final） |
| 04 | `systems/ads/streaming-architecture` | `PartitionViz`：partition key 与 consumer lag |
| 05 | `systems/ads/flink-streaming-training` | `WatermarkSimulator`：到达延迟、watermark delay、state TTL、迟到处理 |
| 06 | `systems/ads/dedup-exactly-once` | `DedupSimulator`（四条消息逐层去重）、`RevisionSinkViz`（DROP / LWW / version-aware） |
| 07 | `systems/ads/multi-region-dr` | `FailoverSimulator`：fencing × 唯一键 × 接管起点 |
| 08 | `systems/ads/experiment-platform` | `ReconciliationDashboard`：Shadow / A/B、七个场景、排查挑战 |

## 结构

- 统一案例与所有计算在 `lib/systems/ads/`（`case`、`attribution`、`matching`、`streaming`、`dedup`、`failover`、`reconcile`、`pipeline`），无 React，`tests/ads-backend.test.ts` 覆盖。
- 组件在 `components/visualization/systems/ads/`，复用 `VisualizationFrame`、`.viz-*` 样式；新增样式集中在 `styles/visualization.css` 末尾的 `.ads-*` 段。
- 每页结构：一句话 → 为什么需要 → 怎么工作（图 + 例子）→ System Design Trade-offs（Problem → Naive → Failure → Better → Trade-off + 对比表）→ 面试 Follow-up → 再往下看。
- 路线图加节点 `sys-ads`（row 4, col 1），前置为 Data Infra 与 System Design。

## 约束

- 所有 ID、时间、数字都是模拟数据，页面上标明；不描述任何公司的内部实现；ByteMQ 只作为 Kafka 同类系统出现；DMA / PM 等未确认缩写不解释。
- 技术口径：Flink state TTL 按处理时间；checkpoint 只保证内部状态与 offset 一致，外部 sink 需事务或幂等；D_sample / D_label 只用于同输入的成对对账。

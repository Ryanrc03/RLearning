import { SparkFrame } from './SparkViews';
export function DistributedWhy() {
  return <SparkFrame title="同一个问题，拆给多个 Worker" description="100 亿条点击只是规模假设；不把这个图当作真实耗时或线性加速承诺。">
    <div className="spark-grid"><div className="spark-panel"><h5>单机 · Vertical Scaling</h5><ol className="spark-flow-list"><li>100 亿条 Click Events</li><li>一台机器：更多 CPU / RAM / 更快磁盘</li><li>HashMap[(adId, minute)] += 1</li><li>全局计数</li></ol></div><div className="spark-panel"><h5>多机 · Horizontal Scaling</h5><ol className="spark-flow-list"><li>数据拆成逻辑 Partitions</li><li>Worker 1 / 2 / 3 并行处理</li><li>各自的 Partial Counts</li><li>相同 Key 汇合 → Global Counts</li></ol></div></div>
    <p className="viz-narr">广告 A 的事件分散在多个 Worker 时，任何一个局部计数都不是全局答案。必须把同 Key 的贡献汇合，再合并。</p>
  </SparkFrame>;
}
export function BatchApplication() {
  return <SparkFrame title="Ad Click Aggregator · 批量与持续处理" description="箭头区分数据流与触发控制；Cron 不承载点击数据。">
    <div className="spark-panel"><h5>Spark Batch</h5><div className="spark-cron">Cron Scheduler - - 定期提交应用 / 触发执行请求 - - → Spark Batch</div><ol className="spark-flow-list"><li>Click Tracking Service</li><li>Click DB / 事件明细存储</li><li>Spark Batch → GROUP BY (adId, minute)</li><li>OLAP → Query Service → Advertiser Dashboard</li></ol><p>定期读取已收集的事件 → 等待调度 → 聚合 → 更新报表。</p></div>
    <div className="spark-panel spark-sink"><h5>Flink Streaming · 持续路径</h5><ol className="spark-flow-list"><li>Kafka</li><li>Continuous Processing → Stateful Aggregation</li><li>OLAP → Query Service → Advertiser Dashboard</li></ol></div>
    <p className="viz-narr">Batch 便于历史回填和重算，但要等调度和批次完成；持续处理改善数据新鲜度，同时引入状态与运行维护成本。Spark 也支持 Structured Streaming。</p>
  </SparkFrame>;
}

'use client';
import { useState } from 'react';
import { buildPipeline } from '@/lib/systems/sql/mapReduce';
import { SparkFrame, SelectNodes, Info } from './SparkViews';
const p=buildPipeline();
const OPS=['Scan','Partial HashAggregate','Exchange','Final HashAggregate','Result'];
const inputRows=p.split.map((rows,i)=>`P${i}: ${rows.map(r=>r.eventId).join(', ')}`).join('\n');
const local=p.combined.map((rows,i)=>`Map ${i}:\n${rows.map(r=>`  (${r.key}) → ${r.count}`).join('\n')}`).join('\n');
const routed=p.routed.map(r=>`Map ${r.source} → Reduce ${r.target}: (${r.key}) → ${r.count}`).join('\n');
const final=p.reduced.map(r=>`(${r.key}) → ${r.count}`).join('\n');
const DETAILS=[
  {input:'ClickEvents · 8 rows',output:inputRows,explanation:'按输入分区扫描，只读取需要的数据。实际扫描方式由数据源和计划决定。'},
  {input:inputRows,output:local,explanation:'Map-side aggregation：每个输入分区各自压缩重复 Key。8 行变成 6 条局部计数。'},
  {input:local,output:routed,explanation:'Exchange 按联合 Key 重新分区，即这里的 Shuffle。相同 Key 的局部结果被路由到同一目标。'},
  {input:routed,output:final,explanation:'把各源分区发来的 partial counts 相加。A · 10:01 的 1 + 1 在这里得到 2。'},
  {input:final,output:final,explanation:'5 行聚合结果。输出到小结果预览或外部存储；顺序没有保证，展示按 Key 排列。'},
];
export function SparkPhysicalPlan() {
  const [selected,setSelected]=useState(0);
  const detail=DETAILS[selected];
  return <SparkFrame title="Physical Plan · SQL 背后的聚合" description="点击算子查看同一份 Toy Data 的输入和输出。常见形态示意，非真实运行日志。" footnote="实际计划可能受已有分区、聚合策略、配置与 Adaptive Query Execution 影响；请以 result.explain('formatted') 为准。">
    <SelectNodes label="物理计划算子" nodes={OPS} selected={selected} onSelect={setSelected}/>
    <div className="spark-boundary">Scan → Partial → Exchange / Shuffle → Final → Result</div>
    <div className="spark-grid"><div className="spark-panel"><h5>输入</h5><pre className="spark-data">{detail.input}</pre></div><div className="spark-panel"><h5>输出</h5><pre className="spark-data">{detail.output}</pre></div></div>
    <div aria-live="polite"><Info><strong>{OPS[selected]}：</strong>{detail.explanation}</Info></div>
  </SparkFrame>;
}

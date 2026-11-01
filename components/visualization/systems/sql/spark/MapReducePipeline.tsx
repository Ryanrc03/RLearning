'use client';
import { useState } from 'react';
import { buildPipeline } from '@/lib/systems/sql/mapReduce';
import { SparkFrame, SelectNodes, Info, PartitionEdges } from './SparkViews';
const pipeline=buildPipeline();
const keys=pipeline.reduced.map(r=>r.key);
const STEPS=['Split','Map','Combine','Shuffle','Reduce'];
const EXPLANATIONS=[
  '先把输入分成 P0 与 P1。Partition 是逻辑数据片，不是两台物理机器。',
  'Map 把每条事件变成 ((adId, minute), 1)；这里的 Map 是变换函数，不是 Python dict。',
  '各 Map Task 在自己的输入分区里相加。A · 10:01 在两个分区里各为 1，全局统计还没完成。',
  '同一个联合 Key 必须去同一个目标分区。两条 A · 10:01 的局部结果跨过边界，在同一 Reduce Partition 汇合。',
  'Reduce 对每个 Key 的局部计数求和：A · 10:01 是 1 + 1 = 2。8 条点击最终得到 5 行汇总。',
];
export function MapReducePipelineSimulator() {
  const [step,setStep]=useState(0);
  return <SparkFrame title="MapReduce · 五步走完 8 条点击" description="点击步骤或 Previous / Next，观察每一步的数据结构和分区归属。" footnote="2 个输入分区、2 个 Reduce 分区；路由使用可重复的教学分区函数，非 Spark 实际 hash。颜色标识联合 Key，不表示物理机器。">
    <SelectNodes label="MapReduce 步骤" nodes={STEPS} selected={step} onSelect={setStep} />
    <div className="viz-controls"><button type="button" className="viz-btn" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Previous</button><button type="button" className="viz-btn" disabled={step===4} onClick={()=>setStep(s=>s+1)}>Next</button><button type="button" className="viz-btn" onClick={()=>setStep(0)}>Reset</button><span role="status">Step {step+1} / 5 · {STEPS[step]}</span></div>
    {step===0?<div className="spark-grid">{pipeline.split.map((rows,i)=><div className="spark-panel" key={i}><h5>Input Partition {i}</h5>{rows.map(row=><div key={row.eventId} className="spark-record">{row.eventId} → ({row.adId}, {row.minute})</div>)}</div>)}</div>:null}
    {step===1||step===2?<div className="spark-grid">{(step===1?pipeline.mapped:pipeline.combined).map((rows,i)=><div className="spark-panel" key={i}><h5>Map Task {i} · P{i}</h5>{rows.map((row,j)=><div key={j} className={`spark-record sql-color-${keys.indexOf(row.key)} `}><span>{'eventId' in row?`${row.eventId} → `:''}({row.key.replace(' · ', ', ')})</span><b>{row.count}</b></div>)}<small>{rows.length} 条中间记录</small></div>)}</div>:null}
    {step===3?<><PartitionEdges wide sources={2}/><div className="spark-grid">{[0,1].map(target=><div className="spark-panel" key={target}><h5>Reduce Partition {target} · 接收</h5>{pipeline.routed.filter(row=>row.target===target).map((row,i)=><div key={i} className={`spark-record sql-color-${keys.indexOf(row.key)}`}><span>P{row.source} → R{target}<br/>({row.key.replace(' · ', ', ')})</span><b>+{row.count}</b></div>)}</div>)}</div></>:null}
    {step===4?<div className="spark-panel"><table className="viz-table"><caption>Final counts · 5 result rows</caption><thead><tr><th scope="col">(adId, minute)</th><th scope="col">合并过程</th><th scope="col">COUNT</th></tr></thead><tbody>{pipeline.reduced.map(row=><tr key={row.key}><td>{row.key}</td><td>{pipeline.routed.filter(r=>r.key===row.key).map(r=>r.count).join(' + ')}</td><td>{row.count}</td></tr>)}</tbody></table></div>:null}
    <div aria-live="polite"><Info>{EXPLANATIONS[step]}</Info></div>
  </SparkFrame>;
}

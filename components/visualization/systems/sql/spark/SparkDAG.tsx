'use client';
import { useState } from 'react';
import { Choices } from '../SqlViews';
import { SparkFrame, Info, PartitionEdges } from './SparkViews';
const NODES=['Read ClickEvents','Filter Valid Events','Map (Key, 1)','Local Aggregate','Shuffle Read','Final Aggregate'];
const COPY=[
  '按输入 Partition 读取。本例 P0 读取 e1–e4，P1 读取 e5–e8。',
  '在当前 Partition 内过滤。本例 8 行全部有效，保留 8 行；不需要为了过滤重新分区。',
  '在当前 Partition 内生成联合 Key 与 1，8 个事件得到 8 个键值对。',
  '每个 Map Task 局部求和，P0 与 P1 各输出 3 条 partial counts；同一个全局 Key 仍可能在两边出现。',
  '下游从多个上游 Map 输出读取属于自己的 Key。必须等所需 Shuffle 输出可用后，才能合并相应数据。',
  '两个 Reduce Task 各处理一个 Reduce Partition；把收到的局部计数相加，合计输出 5 行。',
];
export function SparkDAGVisualizer() {
  const [dependency,setDependency]=useState('narrow');
  const [node,setNode]=useState(0);
  const [stage,setStage]=useState(0);
  return <SparkFrame title="Spark DAG · 边界决定任务怎么分" description="先比较依赖，再点 Stage 和节点。下面是教学 Job，不是所有 Spark Job 的固定模板。">
    <Choices label="Dependency" value={dependency} onChange={setDependency} options={[{value:'narrow',label:'Narrow · 不重新分区'},{value:'wide',label:'Wide · Shuffle'}]}/>
    <PartitionEdges wide={dependency==='wide'}/>
    <p className="spark-legend">蓝色 → Narrow（对应分区内流水线）　橙色 → Wide（多个源分区流向多个目标）</p>
    <div className="spark-grid spark-stage-grid">{[0,1].map(s=><div className={`spark-panel ${stage===s?'spark-selected-panel':''}`} key={s}><button type="button" className="spark-node" aria-pressed={stage===s} onClick={()=>setStage(s)}>Stage {s} · 查看 Tasks</button><div className="spark-stage-ops">{NODES.map((label,i)=>(s===0?i<4:i>=4)?<button key={label} type="button" className={`spark-node ${node===i?'is-selected':''}`} aria-pressed={node===i} onClick={()=>{setNode(i);setStage(s);}}>{label}</button>:null)}</div></div>)}</div>
    <div className="spark-boundary">Stage 0 → Shuffle Boundary（6 条 partials）→ Stage 1 → Output</div>
    <div role="status"><Info><strong>Stage {stage} Tasks：</strong>{stage===0?'T0.0 → Input P0；T0.1 → Input P1。Read → Filter → Map → Local Aggregate 在各 Task 内流水线执行。':'T1.0 → Reduce P0；T1.1 → Reduce P1。各 Task 读取所需的多个 Map 输出；它们依赖 Stage 0 写出的 Shuffle 数据。'}</Info></div>
    <div aria-live="polite"><Info><strong>{NODES[node]}：</strong>{COPY[node]}</Info></div>
  </SparkFrame>;
}

'use client';
import { useState } from 'react';
import { taskWaves } from '@/lib/systems/sql/mapReduce';
import { Choices } from '../SqlViews';
import { SparkFrame, Info } from './SparkViews';
const COPY={
  Driver:'Driver 构建计划、向 Executor 调度 Tasks、跟踪任务状态，并协调失败恢复。调度计算任务的是 Driver，不是 Cluster Manager。',
  'Cluster Manager':'管理集群资源，为 Application 分配 Executor 所需的 CPU / Memory，例如 Kubernetes、YARN 或 Spark Standalone。',
  Worker:'Worker Node 是物理机或虚拟节点。每个节点可承载 Executor 进程；它不是一个 Partition。',
  Executor:'Executor 是 Application 在 Worker 上启动的进程，运行多个 Task，并保存缓存或交换中间结果；可使用内存与磁盘。',
  Partition:'Partition 是逻辑数据分片。一个 Executor 可先后处理许多 Partition，Partition 数不等于机器数。',
  Task:'一个 Task 在特定 Stage 处理一个 Partition。同一逻辑 Task 可能有多次尝试；本模型每个运行中的 Task 占 1 个 CPU slot。',
};
export function SparkArchitectureDiagram() {
  const [selected,setSelected]=useState<keyof typeof COPY>('Driver');
  const [slots,setSlots]=useState('10');
  const node=(name:keyof typeof COPY)=> <button type="button" className={`spark-node ${selected===name?'is-selected':''}`} aria-pressed={selected===name} onClick={()=>setSelected(name)}>{name}</button>;
  return <SparkFrame title="Spark Application · 谁负责什么" description="点选角色查看职责，再改变并发 slots，看 100 个 Partition 怎样分批执行。">
    <div className="spark-panel spark-architecture"><h5>Spark Application</h5>{node('Driver')}<div className="spark-grid"><div className="spark-role"><span className="spark-edge-label">↓ 请求资源</span>{node('Cluster Manager')}<span className="spark-edge-label">↓ 分配资源到 Worker Nodes</span></div><div className="spark-role"><span className="spark-edge-label">↓ 调度 Tasks 到 Executors</span><div className="spark-panel">{node('Worker')}<span className="spark-edge-label">包含进程 ↓</span>{node('Executor')}<span className="spark-edge-label">执行 ↓</span>{node('Task')}<span className="spark-edge-label">处理 ↓</span>{node('Partition')}</div></div></div></div>
    <div aria-live="polite"><Info>{COPY[selected]}</Info></div>
    <Choices label="Concurrent Task Slots" value={slots} onChange={setSlots} options={['2','4','10','20'].map(value=>({value,label:`${value} slots`}))}/>
    <div className="spark-wave-grid" role="img" aria-label={`100 partitions，${slots} 个并发槽位，${taskWaves(100,+slots)} 波任务`}>{Array.from({length:100},(_,i)=><span key={i} className={i<+slots?'is-running':''} title={`Partition ${i} · wave ${Math.floor(i/+slots)+1}`}>{i}</span>)}</div>
    <div role="status"><Info>100 partitions ÷ {slots} slots → {taskWaves(100,+slots)} waves（向上取整）。紫色是第一波；每格是一个分区任务，不是一台机器。假设任务等长、每 Task 占 1 slot 且无重试；真实调度并不严格同步分波。</Info></div>
  </SparkFrame>;
}

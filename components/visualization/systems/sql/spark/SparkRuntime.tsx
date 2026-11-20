'use client';
import { useState } from 'react';
import { executionStep, INITIAL_EXECUTION, writeResult, type ExecutionState } from '@/lib/systems/sql/mapReduce';
import { SparkFrame, Info } from './SparkViews';
const PHASES:Record<ExecutionState['phase'],string>={
  planned:'只建立依赖图，未运行数据任务。点击 Run Action 请求执行。',
  map:'Stage 0 执行：T0.0 读 P0，T0.1 读 P1，Filter → Map → Local Aggregate 写出 Shuffle 数据。',
  reduce:'Stage 1 执行：T1.0 和 T1.1 正在读取 Shuffle 数据并合并。可以继续完成，或注入失败。',
  failed:'T1.0 失败；现有 Shuffle 输出还在。重调度这个失败 Task，不必重跑整个输入。',
  lost:'Map T0.1 所在 Executor 丢失，其 Shuffle 输出不可用；依赖它的下游任务必须等待恢复。',
  recompute:'根据 Lineage 重读稳定输入 P1，重算 T0.1 所需 Shuffle 输出。恢复要付出读取和计算成本。',
  done:'5 行结果已返回 Driver（collect 的小结果示意）。失败恢复不代表任意外部写入天然 Exactly-once。',
};
export function SparkFailureSimulator() {
  const [state,setState]=useState(INITIAL_EXECUTION);
  const [attempts,setAttempts]=useState(1);
  const [idempotent,setIdempotent]=useState(false);
  const phase=state.phase;
  const current=phase==='planned'?0:phase==='map'||phase==='recompute'?1:phase==='done'?3:2;
  return <SparkFrame title="Lazy Evaluation & Failure Lab" description="先定义 Transformations，再触发 Action。失败与恢复由你逐步推进。" footnote="简化的单次失败模型，假设输入稳定且可重读。真实恢复受重试限制、输入可用性、Executor 与 Shuffle 存储方式影响。">
    <ol className="spark-run-flow">{['Plan Transformations','Stage 0 · Read → Filter → Map','Stage 1 · Shuffle → Reduce','collect → Driver'].map((label,i)=><li key={label} className={i===current?'is-current':''}>{label}{i<current?' · 已经过':''}</li>)}</ol>
    <div className="viz-controls"><button type="button" className="viz-btn" disabled={phase!=='planned'} onClick={()=>setState(s=>executionStep(s,'run'))}>Run Action</button><button type="button" className="viz-btn" disabled={!['map','reduce','recompute'].includes(phase)} onClick={()=>setState(s=>executionStep(s,'next'))}>推进执行</button><button type="button" className="viz-btn" disabled={phase!=='reduce'} onClick={()=>setState(s=>executionStep(s,'fail'))}>让 T1.0 失败</button><button type="button" className="viz-btn" disabled={phase!=='reduce'} onClick={()=>setState(s=>executionStep(s,'lose'))}>丢失 T0.1 Shuffle 输出</button><button type="button" className="viz-btn" disabled={!['failed','lost'].includes(phase)} onClick={()=>setState(s=>executionStep(s,'retry'))}>重新调度</button><button type="button" className="viz-btn" onClick={()=>setState(INITIAL_EXECUTION)}>Reset 执行</button></div>
    <div role="status"><Info><strong>{phase} · 尝试 {state.attempt}</strong><p>{PHASES[phase]}</p></Info></div>
    <details className="spark-details"><summary>内部恢复和外部写入为什么是两件事？</summary><p>Lineage 记录计算依赖，可用来重算丢失分区。外部 OLAP 已经收到的写入却不会因此自动撤销；Driver 整体失败、输入损坏等也不等于普通 Task 重试。</p></details>
    <div className="spark-panel spark-sink"><h5>Sink 重试 · 写入成功，确认丢失</h5><p>稳定结果键：(batch-42, A, 10:00)，计算值 1000。第一次写入已经成功。</p><label className="spark-check"><input type="checkbox" checked={idempotent} onChange={e=>setIdempotent(e.target.checked)}/> 改用稳定键 Upsert（覆盖为 1000）</label><div className="viz-controls"><button type="button" className="viz-btn" onClick={()=>setAttempts(n=>n+1)}>重放一次成功写入</button><button type="button" className="viz-btn" onClick={()=>{setAttempts(1);setIdempotent(false);}}>Reset Sink</button></div><div role="status">执行 {attempts} 次写入 → OLAP = <strong>{writeResult(idempotent,attempts)}</strong>；{idempotent?'同一键重复覆盖，值保持 1000。':'每次 +1000，重试会重复累加。'}</div></div>
  </SparkFrame>;
}

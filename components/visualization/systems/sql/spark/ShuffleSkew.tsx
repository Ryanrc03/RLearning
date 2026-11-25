'use client';
import { useState } from 'react';
import { skewModel } from '@/lib/systems/sql/mapReduce';
import { Choices } from '../SqlViews';
import { SparkFrame, Bars, Info } from './SparkViews';
export function ShuffleSkewSimulator() {
  const [mode,setMode]=useState('hot');
  const [salts,setSalts]=useState('1');
  const [twoStage,setTwoStage]=useState(true);
  const model=skewModel(mode==='hot',+salts,twoStage);
  const baseline=skewModel(mode==='hot',1,true);
  return <SparkFrame title="Hot Key & Salting · 最慢的分区" description="固定 4 个 Reduce Partition；Normal 为 A–D 各 100 万，Hot 为 A 一亿、B–D 各一千。" footnote="这是未充分局部聚合时的原始记录等价工作量模型，不是实际 COUNT 的 Shuffle 流量、运行时间或加速比预测。salt 均匀分配；教学路由为 (广告序号 + salt) mod 4，非 Spark hash。">
    <Choices label="数据分布" value={mode} onChange={setMode} options={[{value:'normal',label:'Normal Distribution'},{value:'hot',label:'Hot Key · A'}]}/>
    <Choices label="Salt Count" value={salts} onChange={setSalts} options={['1','2','4','8'].map(value=>({value,label:value}))}/>
    <label className="spark-check"><input type="checkbox" checked={twoStage} onChange={e=>setTwoStage(e.target.checked)}/> Enable Two-stage Aggregation（去盐后再合并）</label>
    <div className="spark-grid"><div className="spark-panel"><h5>未加盐基线 · 原始等价负载</h5><Bars label="未加盐分区负载" labels={['R0','R1','R2','R3']} values={baseline.loads}/><p>最重：{baseline.maxLoad.toLocaleString('en-US')} · max / mean = {baseline.skew.toFixed(2)}</p></div><div className="spark-panel"><h5>当前分区负载 · {salts} salts</h5><Bars label="当前分区负载" labels={['R0','R1','R2','R3']} values={model.loads}/><p>最重：{model.maxLoad.toLocaleString('en-US')} · max / mean = {model.skew.toFixed(2)}</p></div></div>
    <div role="status"><Info>总工作量仍为 {model.total.toLocaleString('en-US')}。{+salts===1?'未加盐，每个广告的 Key 只去一个分区。':`${salts} 个 salt 仍共享 4 个分区，不会增加机器或 slots。`}{model.complete?'最终去盐计数与输入一致。':'当前保留 salted keys，尚未恢复每广告的最终结果。'}{twoStage?` 二阶段接收 ${model.mergeRecords} 条局部记录。`:''}</Info></div>
    <details className="spark-details"><summary>展开 salted keys、路由与结果</summary><div className="sql-table-wrap"><table className="viz-table"><caption>第一阶段 · 理想均匀拆分</caption><thead><tr><th scope="col">Key</th><th scope="col">Reduce</th><th scope="col">count</th></tr></thead><tbody>{model.salted.map(r=><tr key={r.key}><td>{r.key}</td><td>R{r.target}</td><td>{r.count.toLocaleString('en-US')}</td></tr>)}</tbody></table></div></details>
    <div className="spark-panel"><h5>{model.complete?'最终每广告结果':'中间 salted 结果 · 尚未去盐'}</h5><div className="spark-result-chips">{model.results.map(r=><span key={r.key}>{r.key} → {r.count.toLocaleString('en-US')}</span>)}</div></div>
    <Info>COUNT 如果已经有效 map-side combine，热点可能先压缩成每个 Map 的少量 partial counts；这时加盐未必有收益。图中负载更均匀也不等于线性加速：salt 碰撞、调度、二次 Shuffle 与合并成本仍需衡量。</Info>
  </SparkFrame>;
}

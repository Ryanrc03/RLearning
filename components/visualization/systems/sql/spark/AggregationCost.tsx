'use client';
import { useState } from 'react';
import { combineCost } from '@/lib/systems/sql/mapReduce';
import { Choices } from '../SqlViews';
import { SparkFrame, Bars, Info } from './SparkViews';
export function AggregationCostComparison() {
  const [rows,setRows]=useState('1000000');
  const [keys,setKeys]=useState('1000');
  const [enabled,setEnabled]=useState(true);
  const cost=combineCost(+rows,+keys,enabled);
  return <SparkFrame title="Shuffle 成本实验 · 先在本地合并" description="单个输入 Partition 的理想模型：所有 Key 都出现过，局部聚合完全生效。" footnote="逻辑中间记录数 ≠ 网络字节数。实际收益取决于分区数、重复度、序列化、溢写和执行实现。">
    <Choices label="Input Rows" value={rows} onChange={setRows} options={[{value:'1000',label:'1K'},{value:'100000',label:'100K'},{value:'1000000',label:'1M'}]}/>
    <Choices label="Unique Keys" value={keys} onChange={setKeys} options={['10','100','1000'].map(value=>({value,label:value}))}/>
    <label className="spark-check"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enable Local Combine</label>
    <Bars label="有无局部聚合的逻辑记录数" labels={['无 Combine','有 Combine']} values={[+rows,combineCost(+rows,+keys,true).records]}/>
    <div role="status"><Info>当前选择：{enabled?'有':'无'} Combine → {cost.records.toLocaleString('en-US')} 条 Shuffle 记录，较原始输入减少 {(cost.reduction*100).toFixed(2)}%。</Info></div>
    <details className="spark-details"><summary>为什么不能直接合并平均数？</summary><p>Worker 1：[10, 20] → (sum=30, count=2)；Worker 2：[100] → (sum=100, count=1)。</p><p>错误：(15 + 100) / 2 = 57.5。正确：(30 + 100) / (2 + 1) = 43.33。先合并 sum 和 count，再相除。</p></details>
  </SparkFrame>;
}

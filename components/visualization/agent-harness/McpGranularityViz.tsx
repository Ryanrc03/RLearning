'use client';
import { useState } from 'react';
import McpFrame, { McpPanel } from './McpFrame';
export default function McpGranularityViz() {
  const [coarse,setCoarse]=useState(false);
  return <McpFrame title="Tool Granularity · 谁编排排查步骤" description="同样查两份证据，改变的是任务边界，而不是自动获得更可靠的根因判断。">
    <div className="mcp-controls" role="group" aria-label="工具粒度"><button type="button" aria-pressed={!coarse} onClick={()=>setCoarse(false)}>Fine-grained Tools</button><button type="button" aria-pressed={coarse} onClick={()=>setCoarse(true)}>Coarse-grained Tool</button></div>
    <div className="mcp-grid"><McpPanel title="模型看到的工具"><div className="mcp-flow">{(coarse?['diagnose_experiment(experiment_id)']:['get_experiment_metrics','get_sample_diff','get_pipeline_status','get_pipeline_errors']).map(name=><span key={name}>{name}</span>)}</div></McpPanel><McpPanel title={coarse?'Server 编排固定流程':'Agent 决定下一步'}><ol className="mcp-flow-list">{(coarse?['Agent → diagnose_experiment（1 次外部调用）','Server → metrics API → sample-diff API','Server 返回证据包与规则命中']:['Agent → get_experiment_metrics','读取结果，再决定 → get_sample_diff','Agent 综合两次工具响应']).map(s=><li key={s}>{s}</li>)}</ol></McpPanel></div>
    <div className="mcp-note" aria-live="polite">{coarse?'固定 SOP、稳定输入与明确权限边界：粗粒度可减少模型往返，延迟可能更低，但 Server 要承担规则版本、异常分支和审计；后端 API 调用并没有因此消失。':'开放式排查、证据组合经常变化：细粒度工具灵活、可复用、职责清晰；代价是更多模型往返、上下文和决策风险。这里的示例流程只调用前两个工具。'}</div>
    <small>这是接口设计对比。下方可运行 Python 示例只实现两个只读查询；pipeline_status、pipeline_errors 与 diagnose_experiment 是扩展设计，不是已实现功能。</small>
  </McpFrame>;
}

'use client';
import { useState } from 'react';
import { LAB_STEPS, SAMPLE_DIFF, modernRequest } from '@/lib/agent-harness/mcp';
import McpFrame, { McpCode, McpPanel } from './McpFrame';
export default function InternalMcpLab() {
  const [index,setIndex]=useState(0);
  const step=LAB_STEPS[index];
  const isCall=index===2||index===4;
  return <McpFrame title="Internal Ads MCP Lab · 从问题到证据" description="七步 Mock 调用。前置条件：实验有一致快照与指标口径，用户有只读权限。不会连接生产平台。" footnote="2026-07-28 请求体示例；HTTP 头由 SDK 处理。Response 面板只展示业务载荷，非完整 JSON-RPC 响应。所有实验、阈值与样本数均为 Mock Data。">
    <div className="mcp-controls"><button type="button" disabled={index===0} onClick={()=>setIndex(i=>i-1)}>上一步</button><button type="button" disabled={index===6} onClick={()=>setIndex(i=>i+1)}>下一步</button><button type="button" onClick={()=>setIndex(0)}>重置</button><span role="status">步骤 {index+1} / 7 · {step.title}</span></div>
    <div className="mcp-steps" role="group" aria-label="Ads 调用步骤">{LAB_STEPS.map((s,i)=><button type="button" key={s.title} aria-pressed={index===i} onClick={()=>setIndex(i)}>{i+1}. {s.title}</button>)}</div>
    <div className="mcp-route">{step.actor}</div>
    <div className="mcp-grid"><McpPanel title={isCall?'Request · tools/call':'Request / 上下文'}><McpCode label="Ads Lab 请求">{isCall?JSON.stringify(modernRequest('tools/call',index===2?'get_experiment_metrics':'get_sample_diff'),null,2):index===1?JSON.stringify(modernRequest('tools/list'),null,2):step.request||'本步读取上一条响应，无新请求。'}</McpCode></McpPanel><McpPanel title={isCall?'Server 内部映射（不是 MCP 响应）':'Response / 业务载荷'}><McpCode label="Ads Lab 响应或映射">{step.response||'尚无工具响应。'}</McpCode></McpPanel></div>
    <div className="mcp-note" aria-live="polite"><strong>Agent 决策依据：</strong>{step.decision}</div>
    {index>=5&&<div className="mcp-table-wrap"><table><caption>同一快照 · 样本数量（Mock）</caption><thead><tr><th scope="col">Stage</th><th scope="col">Control</th><th scope="col">Treatment</th><th scope="col">组间差</th></tr></thead><tbody>{SAMPLE_DIFF.map(r=><tr key={r.stage}><td>{r.stage}</td><td>{r.control.toLocaleString('en-US')}</td><td>{r.treatment.toLocaleString('en-US')}</td><td>{Math.abs(r.control-r.treatment).toLocaleString('en-US')}</td></tr>)}</tbody></table></div>}
    <div className="mcp-flow mcp-delay"><span>本案例分流：负样本 → 直接下发</span><span>正样本 → Flink 内部 Delayed Model / Timer → 等待后下发</span><small>Delayed Model 不在 Joiner。等待中的正样本可能造成暂时数量差，需检查成熟时间与输出语义。</small></div>
  </McpFrame>;
}

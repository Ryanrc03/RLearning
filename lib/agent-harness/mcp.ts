export type ProtocolVersion = '2026-07-28' | '2025-11-25';
export type Lane = 'model' | 'host' | 'client' | 'server' | 'api';
export type ProtocolStep = { from: Lane; to: Lane; label: string; narr: string };
export function protocolSteps(version: ProtocolVersion): ProtocolStep[] {
  const discovery: ProtocolStep[] = version==='2026-07-28' ? [
    {from:'client',to:'server',label:'server/discover（客户端可选）',narr:'2026-07-28 没有 initialize 握手。Client 可先发现服务端支持的版本与能力，也可直接发起自描述请求。'},
    {from:'server',to:'client',label:'supportedVersions · capabilities',narr:'Server 必须实现 discover，但 Client 不必须先调用它。每个现代请求都声明协议版本和客户端能力，不能依赖旧会话状态。'},
  ] : [
    {from:'client',to:'server',label:'initialize',narr:'这是 2025-11-25 旧协议：Client 先发送协议版本、客户端能力与身份。不要将此消息放进新版时序。'},
    {from:'server',to:'client',label:'initialize result',narr:'旧协议在此返回协商的版本、Server 信息与 capabilities。'},
    {from:'client',to:'server',label:'notifications/initialized',narr:'旧 Client 发出初始化完成通知，然后再进行常规操作；旧版通知没有 JSON-RPC id。'},
  ];
  return [
    {from:'host',to:'client',label:'加载连接配置',narr:'Host 管理工具注册、权限和 Agent Loop；Client 是其中负责 MCP 通信的连接器。配置格式由具体 Host 定义。'},
    ...discovery,
    {from:'client',to:'server',label:'tools/list',narr:'发现工具目录：名称、说明和输入 JSON Schema。这不会执行业务查询，也不等于调用某个工具。'},
    {from:'server',to:'client',label:'工具目录与 Schema',narr:'Server 提供参数结构；Host 可筛选、缓存或按需加载模型需要的工具。这里的目录只有教学示例，不是实时外部工具。'},
    {from:'client',to:'host',label:'注册允许使用的工具',narr:'工具注册与暴露策略属于 Host。mcp__server__tool 是某些 Host 的别名格式，不是 MCP 强制名称。'},
    {from:'host',to:'model',label:'提供获准的工具定义',narr:'Host 将 MCP 工具转换成模型供应商支持的工具定义。模型不需要直接实现 MCP 传输。'},
    {from:'model',to:'host',label:'Function Calling：工具名与参数',narr:'模型表达调用意图；是否执行、如何映射工具名以及参数和权限校验，由 Host/Server 分层负责。'},
    {from:'host',to:'client',label:'权限检查后执行',narr:'Host 根据用户授权与工具范围决定执行。这里不假定所有 Host 都有相同的 allow/ask 规则或 Hook 顺序。'},
    {from:'client',to:'server',label:'tools/call get_experiment_metrics',narr:'Client 按所选协议发送工具名和 arguments。SDK 负责封包；MCP 标准化发现和调用，不取代业务 API。'},
    {from:'server',to:'api',label:'GET /api/experiments/exp_123/metrics',narr:'Server 校验输入和业务权限，再用自己配置的凭证调用 API。Token 不回传模型是部署与代码设计的结果，不是协议自动保证。'},
    {from:'api',to:'server',label:'业务 JSON → 工具结果',narr:'业务 API 返回 mock 指标。Server 转换为工具输出；服务端异常要转成有界、可理解且不泄密的错误。'},
    {from:'server',to:'client',label:'tools/call result',narr:'工具结果返回 Client，Host 再把允许的内容交给模型。结果大小限制、截断与落盘属于具体 Host 策略。'},
    {from:'host',to:'model',label:'工具结果 → 下一轮判断',narr:'模型理解结果并决定是否继续调用。Server 本身不运行这个 Agent 推理循环。'},
  ];
}
export function modernRequest(method:'tools/list'|'tools/call'|'server/discover',name?:string) {
  return {jsonrpc:'2.0',id:1,method,params:{
    ...(method==='tools/call'?{name:name??'get_experiment_metrics',arguments:{experiment_id:'exp_123'}}:{}),
    _meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientInfo':{name:'RLearningDemo',version:'1.0.0'},'io.modelcontextprotocol/clientCapabilities':{}},
  }};
}
export function contextCost(servers:number,toolsPer:number,deferred:boolean) {
  const total=servers*toolsPer;
  const loaded=deferred?Math.min(2,total):total;
  return {total,loaded,full:total*250,used:deferred?total*20+loaded*(250-20):total*250};
}
export const MOCK_METRICS={experiment_id:'exp_123',auc_control:0.7512,auc_treatment:0.7500,auc_diff:0.0012,illustrative_threshold:0.0005,mock:true};
export const SAMPLE_DIFF=[{stage:'Joiner',control:1000000,treatment:1000000},{stage:'Flink',control:980000,treatment:960000}] as const;
export const LAB_STEPS=[
  {title:'User 提问',actor:'User → Host',request:'帮我排查 exp_123 为什么没有 A/A 打平，看看 Joiner 或 Flink。',response:'',decision:'先确认可用工具与权限；不直接把自然语言变成任意 URL。'},
  {title:'发现工具 Schema',actor:'MCP Client ↔ Ads MCP Server',request:'tools/list',response:'get_experiment_metrics(experiment_id: string)\nget_sample_diff(experiment_id: string)',decision:'Host 将这两个只读工具加入获准工具集，模型看到名称、说明与参数结构。'},
  {title:'读取实验指标',actor:'LLM → Host → Client → Server → REST API',request:'get_experiment_metrics({"experiment_id":"exp_123"})',response:'GET /api/experiments/exp_123/metrics',decision:'模型先请求总览；Host 放行只读查询，Server 做参数与业务权限检查。'},
  {title:'指标响应',actor:'Ads MCP Server → Host → LLM',request:'',response:JSON.stringify(MOCK_METRICS,null,2),decision:'|AUC Diff| 0.0012 超过教学阈值 0.0005：值得排查，但阈值不是显著性检验，也不能单凭它证明故障。'},
  {title:'比较分阶段样本',actor:'LLM → Host → Client → Server → REST API',request:'get_sample_diff({"experiment_id":"exp_123"})',response:'GET /api/experiments/exp_123/sample-diff',decision:'模型选择下一条证据：对齐统计口径和快照，寻找样本差异首次出现的位置。'},
  {title:'分阶段响应',actor:'Ads MCP Server → Host → LLM',request:'',response:JSON.stringify({mock:true,stages:SAMPLE_DIFF},null,2),decision:'Joiner 两组都为 1,000,000；Flink 输出是 980,000 对 960,000，相差 20,000。'},
  {title:'形成诊断线索',actor:'LLM → User',request:'',response:'可见阶段中，组间数量差异首次出现在 Flink。建议核查过滤、Delayed Model、Timer 与去重，并对齐成熟快照与样本集合。',decision:'这是 Mock Data 驱动的排查方向，不是已证实的生产根因。数量相等也不代表 Joiner 两组 ID 或 label 相同。'},
] as const;
export function diagnoseMock() {
  return {firstDiverged:SAMPLE_DIFF.find(row=>row.control!==row.treatment)?.stage,provenCause:false,leads:['过滤','Flink Delayed Model','Timer','去重']};
}

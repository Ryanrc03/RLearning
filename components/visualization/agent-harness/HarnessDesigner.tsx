"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Mode = "dontAsk" | "default" | "acceptEdits" | "auto" | "bypassPermissions";
const MODE_RANK: Record<Mode, number> = { dontAsk: 0, default: 1, acceptEdits: 2, auto: 3, bypassPermissions: 4 };
const MODE_LABEL: Record<Mode, string> = { dontAsk: "dontAsk", default: "default（逐个确认）", acceptEdits: "acceptEdits", auto: "auto（分类器代审）", bypassPermissions: "bypassPermissions" };

type Dial = { key: string; title: string; value: string; why: string };
type Archetype = {
  id: string;
  title: string;
  summary: string;
  mode: Mode;
  maxSafeMode: Mode;
  headless: boolean;
  network: boolean;
  dials: Dial[];
  bypassWarn: string;
  networkOn: string;
  networkOff: string;
  noVerify: string;
};

const ARCHETYPES: Archetype[] = [
  {
    id: "review",
    title: "CI 里的代码审查机器人",
    summary: "PR 一开就跑，没有人在终端前；只能读，不能改；输出要能被机器解析。",
    mode: "dontAsk",
    maxSafeMode: "dontAsk",
    headless: true,
    network: false,
    dials: [
      { key: "goal", title: "Goal / done", value: "对 diff 给出可复现的问题，输出一份 JSON findings", why: "没有人读自由文本；done 的标准是“输出合法且每条有文件和行号”。" },
      { key: "context", title: "上下文", value: "仓库 CLAUDE.md + 审查清单 + git diff", why: "清单让它只报清单上有的类别，减少凭感觉的评论。" },
      { key: "tools", title: "工具集", value: "Read / Grep / Glob / Bash(git diff *, git log *)", why: "只读。审查不需要 Edit，更不需要网络。" },
      { key: "mode", title: "权限模式", value: "dontAsk + 精确 allow 列表", why: "CI 里没人回答确认；凡是没预先放行的调用直接拒绝，流程不会挂起。" },
      { key: "rules", title: "规则", value: "deny Edit、Write、Bash(git push *)", why: "deny 在任何模式下都生效，是最后一道硬墙。" },
      { key: "hooks", title: "Hooks", value: "Stop hook 校验输出是合法 JSON，不合法就 block", why: "把“格式对不对”从模型的自觉变成 harness 的检查。" },
      { key: "subagents", title: "Subagents", value: "按文件并行 review，父代理汇总去重", why: "大 PR 一个上下文装不下；每个子代理只看一个文件，报告回来再合并。" },
      { key: "skills", title: "Skills", value: "code-review 清单作为 skill", why: "清单会改，放在 SKILL.md 里比写死在 prompt 里好维护。" },
      { key: "mcp", title: "MCP", value: "GitHub server，只开读 PR 和发评论两个工具", why: "能力按需开，一个 server 的 40 个工具没必要全上。" },
      { key: "budget", title: "预算", value: "max_turns 30、每次运行费用上限", why: "审查是有界任务，超出就是出了问题。" },
      { key: "verify", title: "验证", value: "一组带已知 bug 的样本 PR 做回归评估", why: "改 prompt 或换模型后，能知道召回率有没有掉。" },
    ],
    bypassWarn: "CI 里 bypassPermissions 等于把仓库交给模型读到的任何一段文本：一个恶意 PR 描述就能让它改文件、推分支。",
    networkOn: "审查不需要网络；一旦打开，PR 里的一段 URL 就能把模型引去读外部指令，再把仓库内容发出去。",
    networkOff: "",
    noVerify: "没有输出校验时，模型偶尔会输出一段带解释的 Markdown 而不是 JSON，下游解析失败，整条流水线静默跳过审查。",
  },
  {
    id: "data",
    title: "一次性数据清洗任务",
    summary: "把 raw/ 下的几十个 CSV 清洗成规范 parquet，跑在容器里，跑完就扔。",
    mode: "bypassPermissions",
    maxSafeMode: "bypassPermissions",
    headless: true,
    network: false,
    dials: [
      { key: "goal", title: "Goal / done", value: "validate.py 通过：行数、空值率、schema 全对", why: "数据任务的“完成”必须是可计算的，否则模型会在“看起来处理完了”时停下。" },
      { key: "context", title: "上下文", value: "数据字典 + 目标 schema + 一行示例", why: "字段含义不在数据里，不给就是猜。" },
      { key: "tools", title: "工具集", value: "Read / Write / Edit / Bash(python *)", why: "需要写脚本、跑脚本、改脚本，循环很多次。" },
      { key: "mode", title: "权限模式", value: "bypassPermissions，但只在一次性容器里", why: "容器里没有值得保护的东西，确认只会拖慢；容器是真正的边界。" },
      { key: "rules", title: "规则", value: "deny Bash(rm -rf *)、deny 任何网络工具", why: "即使在容器里，也不让它删 raw/ 或把数据传出去。" },
      { key: "hooks", title: "Hooks", value: "PreToolUse 禁止写入 raw/ 目录；Stop hook 跑 validate.py", why: "原始数据只读是硬约束；验证脚本不过就不许停。" },
      { key: "subagents", title: "Subagents", value: "不需要", why: "任务是串行的脚本迭代，没有可并行的子问题。" },
      { key: "skills", title: "Skills", value: "不需要", why: "一次性任务，流程知识用不上第二次。" },
      { key: "mcp", title: "MCP", value: "无", why: "所有输入都在本地文件系统。" },
      { key: "budget", title: "预算", value: "max_turns 60、总费用上限", why: "脚本改来改去容易陷入循环，预算是唯一的刹车。" },
      { key: "verify", title: "验证", value: "validate.py 本身，加上抽样人工看 20 行", why: "脚本只能查规则内的问题，人看抽样补盲区。" },
    ],
    bypassWarn: "",
    networkOn: "清洗任务不需要网络；打开后，数据里的一段文本就可能让模型把整张表 POST 出去。",
    networkOff: "",
    noVerify: "没有验证脚本时，模型会在输出“看起来像 parquet”时宣布完成，空值率和 schema 错误要到下游才发现。",
  },
  {
    id: "research",
    title: "长期的研究 / 写作助理",
    summary: "跟踪一个主题几个月，读论文、记偏好、持续写综述；人每天都在。",
    mode: "default",
    maxSafeMode: "auto",
    headless: false,
    network: true,
    dials: [
      { key: "goal", title: "Goal / done", value: "没有单次 done；每条结论必须带可追溯的来源", why: "开放任务没有终点，能验证的是“每句话有没有出处”。" },
      { key: "context", title: "上下文", value: "记忆文件（偏好、已读文献、术语表）+ 自动记忆", why: "跨会话的连续性全靠记忆层；没有它每天都在重新认识你。" },
      { key: "tools", title: "工具集", value: "WebSearch / WebFetch / Read / Write", why: "读外部资料和写本地笔记是主要动作。" },
      { key: "mode", title: "权限模式", value: "default 或 auto", why: "人在场；写文件要确认，读网页可放开。" },
      { key: "rules", title: "规则", value: "allow WebSearch；ask WebFetch 非白名单域名", why: "白名单外的网页可能带注入内容，让人过一眼。" },
      { key: "hooks", title: "Hooks", value: "SessionStart 载入记忆；PreCompact 先把要点写进记忆文件", why: "压缩会丢细节，压缩前落盘是最便宜的保险。" },
      { key: "subagents", title: "Subagents", value: "并行检索多个来源，各返回带引用的摘要", why: "读 10 篇论文不该全进主上下文；摘要回来再综合。" },
      { key: "skills", title: "Skills", value: "deep-research 流程、引用格式", why: "“怎么做一次综述”是会反复用的流程知识。" },
      { key: "mcp", title: "MCP", value: "文献库 / 笔记软件（只读 + 写入自己的页面）", why: "外部系统多，但每个只开必要的工具。" },
      { key: "budget", title: "预算", value: "按日费用上限", why: "没有轮数意义上的终点，只能限花费。" },
      { key: "verify", title: "验证", value: "抽查引用是否真实存在且说了那句话", why: "编造引用是这类任务最常见的失败。" },
    ],
    bypassWarn: "助理会读大量不受信任的网页；bypassPermissions 下一段网页文字就能让它改你的笔记或把记忆文件发出去。",
    networkOn: "",
    networkOff: "没有网络，研究助理只能复述训练数据，而且无法核对任何引用。",
    noVerify: "没有引用抽查，综述会慢慢混入看起来可信、实际不存在的文献。",
  },
  {
    id: "ops",
    title: "生产环境运维值守",
    summary: "半夜收到告警，agent 先诊断并给出修复建议，任何变更要人点头。",
    mode: "default",
    maxSafeMode: "default",
    headless: false,
    network: false,
    dials: [
      { key: "goal", title: "Goal / done", value: "告警指标恢复，且每个变更都有记录", why: "“修好了”由监控指标说了算，不由模型说了算。" },
      { key: "context", title: "上下文", value: "runbook + 系统拓扑 + 最近的变更记录", why: "诊断靠背景知识，这些都不在日志里。" },
      { key: "tools", title: "工具集", value: "只读查询（kubectl get / logs、查询监控）+ 少数受限变更命令", why: "读多写少；写的那几条单独列出来。" },
      { key: "mode", title: "权限模式", value: "default：所有变更逐个确认", why: "误操作不可逆，确认的成本远低于事故。" },
      { key: "rules", title: "规则", value: "allow 只读命令；ask kubectl apply / rollout；deny kubectl delete、rm -rf、生产库写入", why: "三层规则把“能做的”“要问的”“绝不做的”分开写清楚。" },
      { key: "hooks", title: "Hooks", value: "PreToolUse 审计日志；PostToolUse 把变更写进事件记录", why: "事后复盘要有完整动作记录，不能靠模型自己总结。" },
      { key: "subagents", title: "Subagents", value: "只读的诊断子代理，可并行查多个服务", why: "诊断可并行且无副作用，适合委派；变更不委派。" },
      { key: "skills", title: "Skills", value: "每类告警一个 runbook skill", why: "runbook 本来就是流程文档，天然是 skill。" },
      { key: "mcp", title: "MCP", value: "监控与告警平台，只读", why: "数据来源在外部系统，只开读。" },
      { key: "budget", title: "预算", value: "10 分钟没有进展就升级给人", why: "运维的预算单位是时间，不是 token。" },
      { key: "verify", title: "验证", value: "变更后观察指标窗口，没恢复就回滚", why: "修复的证据是指标，不是命令返回码。" },
    ],
    bypassWarn: "生产环境里 bypassPermissions 意味着模型误判一次就直接生效，而生产变更大多不可逆。这是最不该用的组合。",
    networkOn: "值守 agent 不该能访问任意外网；开放后，一段日志里的内容就可能把内部拓扑发出去。",
    networkOff: "",
    noVerify: "没有指标验证，模型会在命令返回 0 的那一刻宣布修复，而故障可能只是换了个样子。",
  },
  {
    id: "rlearning",
    title: "RLearning 的知识可视化工程师",
    summary: "就是写这组笔记的那个 agent：按设计文档写 MDX 和 React 可视化，构建通过后部署。",
    mode: "acceptEdits",
    maxSafeMode: "auto",
    headless: false,
    network: true,
    dials: [
      { key: "goal", title: "Goal / done", value: "typecheck / lint / build 全过，页面在手机宽度不溢出", why: "“写完了”对内容站来说就是“能构建、能看”。" },
      { key: "context", title: "上下文", value: "AGENTS.md + docs/design.md + 现有笔记作范例", why: "风格约束不在代码里，在设计文档里；给范例比给规则有效。" },
      { key: "tools", title: "工具集", value: "Read / Edit / Write / Bash(npm *, git *) / 浏览器截图", why: "写、构建、看效果、提交，四件事都要。" },
      { key: "mode", title: "权限模式", value: "acceptEdits", why: "改文件是主要动作，逐个确认会很烦；跑命令和推送仍要问。" },
      { key: "rules", title: "规则", value: "allow Bash(npm run *)；ask Bash(git push *)；deny Read(./.env)", why: "构建随便跑，推送要看一眼，密钥别进上下文。" },
      { key: "hooks", title: "Hooks", value: "PostToolUse(Edit) 跑 typecheck；Stop hook 跑 npm run build", why: "类型错误越早发现越便宜；没构建过不许说完成。" },
      { key: "subagents", title: "Subagents", value: "一个只读的事实核对子代理，对照官方文档", why: "写技术笔记最大的风险是写错，而核对不需要主上下文。" },
      { key: "skills", title: "Skills", value: "dataviz（配色与图形规范）、write-note（笔记格式）", why: "两套会反复用的规范。" },
      { key: "mcp", title: "MCP", value: "浏览器（打开本地预览、截图）", why: "可视化必须亲眼看，不能只靠构建通过。" },
      { key: "budget", title: "预算", value: "max_turns 100", why: "一篇带可视化的笔记要几十次调用，太紧会半途而废。" },
      { key: "verify", title: "验证", value: "build + 截图 + 部署后 curl 每个 URL", why: "三个层次：能编译、能看、线上能访问。" },
    ],
    bypassWarn: "这个任务里 bypassPermissions 的直接后果是未经确认的 git push：错的内容会直接部署到公开站点。",
    networkOn: "",
    networkOff: "没有网络就不能核对官方文档，也不能验证部署；笔记的事实准确性只能靠模型记忆。",
    noVerify: "没有构建闸门，模型会在“文件都写好了”时宣布完成，而一个类型错误就足以让整个站点部署失败。",
  },
];

export default function HarnessDesigner() {
  const [id, setId] = useState(ARCHETYPES[4].id);
  const [modeOverride, setModeOverride] = useState<Mode | null>(null);
  const [networkOverride, setNetworkOverride] = useState<boolean | null>(null);
  const [verifyOn, setVerifyOn] = useState(true);
  const spec = ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES[0];
  const mode = modeOverride ?? spec.mode;
  const network = networkOverride ?? spec.network;

  const pick = (next: string) => { setId(next); setModeOverride(null); setNetworkOverride(null); setVerifyOn(true); };

  const warnings: { kind: "bad" | "warn"; text: string }[] = [];
  if (mode !== spec.mode) {
    if (MODE_RANK[mode] > MODE_RANK[spec.maxSafeMode]) warnings.push({ kind: "bad", text: mode === "bypassPermissions" && spec.bypassWarn ? spec.bypassWarn : `${MODE_LABEL[mode]} 比这个任务能承受的最高自动化程度（${MODE_LABEL[spec.maxSafeMode]}）更松：模型读到的不受信任内容会直接变成动作。` });
    else if (mode === "default" && spec.headless) warnings.push({ kind: "warn", text: "这个任务没有人在终端前。default 模式下第一次需要确认的调用就会让流程挂起，直到超时。要么 dontAsk 加精确 allow 列表，要么在隔离容器里 bypass。" });
    else if (mode === "dontAsk" && !spec.headless) warnings.push({ kind: "warn", text: "人在场却用 dontAsk：每一次本来可以问一句就放行的调用都会被拒绝，模型会不停碰壁，任务很难推进。" });
    else warnings.push({ kind: "warn", text: `换成 ${MODE_LABEL[mode]} 也可以工作，但要相应调整 allow / ask 规则：模式只定基线，规则才是细节。` });
  }
  if (network !== spec.network) warnings.push({ kind: network ? "warn" : "bad", text: network ? spec.networkOn : spec.networkOff });
  if (!verifyOn) warnings.push({ kind: "bad", text: spec.noVerify });

  return (
    <VisualizationFrame
      title="给一个任务设计 harness：五个原型"
      description="选一个任务原型，看它的每个旋钮该拧到哪里、为什么。然后改动三个最常被改错的旋钮，看会出什么问题。"
      footnote={<>五个原型的差别几乎全来自三个问题：有没有人在场、动作可不可逆、输入可不可信。先回答这三个问题，再去选模式和写规则。</>}
    >
      <div className="viz-chips" style={{ marginBottom: 12 }}>
        {ARCHETYPES.map((a) => <button key={a.id} className={`viz-chip${a.id === id ? " is-on" : ""}`} onClick={() => pick(a.id)}>{a.title}</button>)}
      </div>
      <p className="viz-k" style={{ marginBottom: 12 }}>{spec.summary}</p>
      <div className="viz-controls">
        <label>
          <span className="viz-k">权限模式</span>
          <select value={mode} onChange={(e) => setModeOverride(e.target.value as Mode)} aria-label="权限模式">
            {(Object.keys(MODE_LABEL) as Mode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}{m === spec.mode ? "（推荐）" : ""}</option>)}
          </select>
        </label>
        <label className="viz-check"><input type="checkbox" checked={network} onChange={(e) => setNetworkOverride(e.target.checked)} />允许访问网络</label>
        <label className="viz-check"><input type="checkbox" checked={verifyOn} onChange={(e) => setVerifyOn(e.target.checked)} />保留验证闸门</label>
        {(modeOverride !== null || networkOverride !== null || !verifyOn) && <button className="viz-btn" onClick={() => pick(id)}>恢复推荐</button>}
      </div>
      <div className="viz-cards">
        {spec.dials.map((d) => {
          const changed = (d.key === "mode" && mode !== spec.mode) || (d.key === "tools" && network !== spec.network) || ((d.key === "verify" || d.key === "hooks") && !verifyOn);
          let value = d.value;
          if (d.key === "mode" && mode !== spec.mode) value = MODE_LABEL[mode];
          if (d.key === "tools" && network !== spec.network) value = network ? `${d.value} + WebFetch / WebSearch` : d.value.replace(/WebSearch \/ WebFetch \/ ?/, "").replace(/ \/ 浏览器截图/, "");
          if (d.key === "verify" && !verifyOn) value = "（已去掉）";
          if (d.key === "hooks" && !verifyOn) value = d.value.replace(/[；;]?\s*Stop hook[^；;]*/g, "").replace(/^；/, "") || "（无）";
          return (
            <div key={d.key} className={`viz-card${changed ? " is-changed" : ""}`}>
              <h6>{d.title}</h6>
              <p>{value}</p>
              <p className="why">{d.why}</p>
            </div>
          );
        })}
      </div>
      {warnings.length > 0 && warnings.map((w, i) => <div key={i} className={`viz-narr is-${w.kind}`}>{w.text}</div>)}
      {warnings.length === 0 && <div className="viz-narr is-good">这是推荐配置。试着把权限模式拧到 bypassPermissions、打开网络、或去掉验证闸门，看每个原型分别会在哪里出事。</div>}
    </VisualizationFrame>
  );
}

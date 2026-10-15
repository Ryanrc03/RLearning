"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Ref = { name: string; tok: number };
type Skill = { name: string; desc: string; body: number; refs: Ref[]; userOnly?: boolean };

const META_PER_SKILL = 25;
const SKILLS: Skill[] = [
  { name: "write-note", desc: "为 RLearning 写一篇新笔记并注册到导航", body: 1400, refs: [{ name: "note-template.md", tok: 900 }, { name: "viz-contract.md", tok: 1300 }] },
  { name: "deploy", desc: "构建并部署到 Vercel（只能由用户用 /deploy 触发）", body: 700, refs: [], userOnly: true },
  { name: "dataviz", desc: "做任何图表前读：选形式、配色、跑校验脚本", body: 2600, refs: [{ name: "palette.md", tok: 2200 }, { name: "anti-patterns.md", tok: 3100 }, { name: "validate_palette.js", tok: 1800 }] },
  { name: "pdf", desc: "读取、合并、拆分、填写 PDF", body: 1900, refs: [{ name: "forms.md", tok: 2400 }] },
  { name: "code-review", desc: "按清单审查 diff，只报可验证的问题", body: 1200, refs: [{ name: "checklist.md", tok: 800 }] },
  { name: "release-notes", desc: "从 git log 生成发布说明", body: 600, refs: [] },
];
const PROMPTS: { text: string; skill: string | null; how: string }[] = [
  { text: "把这个表做成图", skill: "dataviz", how: "描述里写了“做任何图表前读”，模型判断相关，自动触发。" },
  { text: "/deploy", skill: "deploy", how: "用户用斜杠显式调用。标了 disable-model-invocation 的 skill 只能这样触发，模型自己不会去 deploy。" },
  { text: "审一下这个 PR", skill: "code-review", how: "描述匹配“审查 diff”。" },
  { text: "把两个 PDF 合并", skill: "pdf", how: "描述匹配。" },
  { text: "今天几号", skill: null, how: "没有 skill 相关，什么都不加载。上下文只付了那 150 token 的目录费。" },
];
const ALL_LOADED = SKILLS.reduce((sum, s) => sum + s.body + s.refs.reduce((r, x) => r + x.tok, 0), 0);
const META_TOTAL = SKILLS.length * META_PER_SKILL;

export default function SkillDisclosureViz() {
  const [promptIndex, setPromptIndex] = useState(0);
  const [loadedRefs, setLoadedRefs] = useState<string[]>([]);
  const prompt = PROMPTS[promptIndex];
  const skill = SKILLS.find((s) => s.name === prompt.skill) ?? null;
  const bodyTok = skill?.body ?? 0;
  const refTok = skill ? skill.refs.filter((r) => loadedRefs.includes(r.name)).reduce((sum, r) => sum + r.tok, 0) : 0;
  const total = META_TOTAL + bodyTok + refTok;
  const pick = (i: number) => { setPromptIndex(i); setLoadedRefs([]); };

  return (
    <VisualizationFrame
      title="Skill 的渐进披露：上下文里到底有什么"
      description="六个 skill 装在 harness 里。开场时模型只看得到每个 skill 的名字和一句描述；用户说了什么，决定哪份 SKILL.md 正文被读进来；正文再决定要不要读更多文件。"
      footnote={<>对比右边的虚线：如果把六个 skill 的全文和附件都预先塞进系统提示，每一次调用都要付 {ALL_LOADED.toLocaleString()} token，而且模型要在一堆无关指令里找相关的那段。</>}
    >
      <div className="viz-panel" style={{ marginBottom: 12 }}>
        <h5>用户说</h5>
        <div className="viz-chips">
          {PROMPTS.map((p, i) => <button key={p.text} className={`viz-chip${i === promptIndex ? " is-on" : ""}`} onClick={() => pick(i)}>{p.text}</button>)}
        </div>
        <p className="viz-k" style={{ marginTop: 8 }}>{prompt.how}</p>
      </div>
      <div className="viz-grid2">
        <div className="viz-panel">
          <h5>上下文里的 skill 相关内容</h5>
          <p className="viz-k">第 0 层 · 永远在：名字 + 描述（{META_TOTAL} token）</p>
          <ul style={{ margin: "4px 0 10px", display: "grid", gap: 2 }}>
            {SKILLS.map((s) => (
              <li key={s.name} className="viz-mono" style={{ color: s.name === skill?.name ? "var(--v1)" : "var(--muted)" }}>{s.name} — {s.desc}</li>
            ))}
          </ul>
          {skill ? (
            <>
              <p className="viz-k">第 1 层 · 触发后：SKILL.md 正文（{skill.body.toLocaleString()} token）</p>
              <div style={{ margin: "4px 0 10px", padding: "8px 10px", border: "1px solid var(--v1)", borderRadius: 6, background: "#eef5fd", fontSize: 12 }}>
                <span className="viz-mono">{skill.name}/SKILL.md</span> 的完整步骤已经进入对话。它可以说“做 X 之前先读 references/…”。
              </div>
              <p className="viz-k">第 2 层 · 按需：附件与脚本（点击加载）</p>
              {skill.refs.length ? (
                <div className="viz-chips" style={{ marginTop: 4 }}>
                  {skill.refs.map((r) => (
                    <button key={r.name} className={`viz-chip mono${loadedRefs.includes(r.name) ? " is-on" : ""}`} onClick={() => setLoadedRefs(loadedRefs.includes(r.name) ? loadedRefs.filter((x) => x !== r.name) : [...loadedRefs, r.name])}>
                      {r.name} · {r.tok.toLocaleString()}
                    </button>
                  ))}
                </div>
              ) : <p className="viz-k" style={{ marginTop: 4 }}>这个 skill 没有附件。</p>}
            </>
          ) : <p className="viz-k">没有 skill 被触发，第 1、2 层是空的。</p>}
        </div>
        <div className="viz-panel">
          <h5>skill 占用的上下文 · {total.toLocaleString()} token</h5>
          <svg viewBox="0 0 320 110" role="img" aria-label={`当前 skill 占用 ${total} token：目录 ${META_TOTAL}，正文 ${bodyTok}，附件 ${refTok}。全部预加载需要 ${ALL_LOADED}。`}>
            <g>
              <text x="0" y="14" fontSize="12" fill="#30332c">按需加载</text>
              {[
                { v: META_TOTAL, c: "var(--v3)" },
                { v: bodyTok, c: "var(--v1)" },
                { v: refTok, c: "var(--v2)" },
              ].reduce<{ x: number; nodes: React.ReactNode[] }>((acc, seg, i) => {
                const w = (seg.v / ALL_LOADED) * 300;
                if (seg.v > 0) acc.nodes.push(<rect key={i} x={acc.x} y="22" width={Math.max(w - 2, 2)} height="22" rx="3" fill={seg.c} />);
                acc.x += w;
                return acc;
              }, { x: 0, nodes: [] }).nodes}
              <text x={Math.min((total / ALL_LOADED) * 300 + 6, 250)} y="37" fontSize="12" fill="#30332c" className="mono">{total.toLocaleString()}</text>
            </g>
            <g>
              <text x="0" y="74" fontSize="12" fill="#30332c">全部预加载</text>
              <rect x="0" y="82" width="300" height="22" rx="3" fill="none" stroke="#8e8d78" strokeDasharray="4 3" />
              <text x="306" y="97" fontSize="12" fill="#30332c" className="mono" textAnchor="end">{ALL_LOADED.toLocaleString()}</text>
            </g>
          </svg>
          <div className="viz-legend">
            <span><i style={{ background: "var(--v3)" }} />名字 + 描述</span>
            <span><i style={{ background: "var(--v1)" }} />SKILL.md 正文</span>
            <span><i style={{ background: "var(--v2)" }} />附件</span>
          </div>
        </div>
      </div>
    </VisualizationFrame>
  );
}

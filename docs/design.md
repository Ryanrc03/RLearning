# RLearning

> 2026-09-29 界面更新：用户选定白色正文、浅黄色背景点缀、常驻左侧目录，以及顶部活动统计和头像。当前实现以此配色为准；活动方格统计笔记记录，头像通过 `content/profile.ts` 配置。头像素材取自当前 Git 用户名 `Ryanrc03` 的公开 GitHub 头像。下文的原始配色建议与暗色模式属于早期设计参考。

> 2026-10-20 更新：配色从浅黄改为 Obsidian 风格的紫色点缀（`--accent: #7852ee`、`--accent-soft: #efeafd`），灰色改为中性灰；图里的数据配色不变。左侧目录改为「搜索 + 折叠」，首页主体改为知识路线图，详见第 6、9 节。

> 2026-10-30 更新：首页封面改为作者主机的 3D 模型（硬件 = system，跑一步 GRPO = ML），自我介绍放在左侧；新增 /en/ 英文版，按篇选择翻译。

> A personal, evolving knowledge base for Computer Science, Machine Learning, LLMs, and AI Infrastructure.

## 1. Overview

RLearning 是一个个人技术学习笔记 / Knowledge Base 网站。

它不是传统博客，也不是 Portfolio，而更接近一个公开的个人 Notion：

- 用结构化目录组织长期积累的知识
- 用文章记录学习过程，而不是只发布“完成品”
- 对复杂 CS / ML 概念加入交互式可视化
- 所有内容和代码统一存储在 GitHub
- Push 后自动部署到 Vercel
- 不依赖数据库、CMS 或后端服务

核心体验：

```text
Explore → Read → Visualize → Connect
```

目标是随着学习不断增长，最终形成一套属于自己的 Computer Science / AI Knowledge System。

---

# 2. Product Goals

## Primary Goals

### 2.1 Knowledge-first

网站首先是一个阅读工具。

视觉设计、动画、交互都应该服务于：

- 理解知识
- 建立知识之间的连接
- 快速查找之前学过的内容

而不是为了展示前端技巧。

### 2.2 Easy to Maintain

新增内容应该足够简单：

```text
1. Create xxx.mdx
2. Write Markdown
3. Optionally embed visualization
4. git push
5. Vercel deploy
```

不能要求每写一篇文章都修改大量 React code。

### 2.3 Visualization-native

对于适合可视化的技术知识，允许直接在文章中嵌入 React Components。

例如：

```mdx
# TCP Three-way Handshake

TCP connection establishment works like this:

<TCPHandshake />
```

页面中直接出现：

```text
Client                         Server

   | -------- SYN ------------> |
   |                            |
   | <------ SYN + ACK -------- |
   |                            |
   | -------- ACK ------------> |
   |                            |
        Connection Established
```

后续可以进一步加入：

- Step
- Play
- Reset
- Hover explanation
- Animation

### 2.4 Fully Static

V1 不需要：

- Database
- Authentication
- User accounts
- CMS
- Backend APIs

所有内容在 build time 生成。

---

# 3. Target Experience

整体视觉参考：

```text
Notion
Linear Docs
Vercel Docs
Stripe Docs
GitBook
```

但最终风格应该比典型 documentation site 更个人化一点。

关键词：

```text
Minimal
Quiet
Readable
Technical
Interactive
Personal
```

---

# 4. Information Architecture

第一版不要建立太多一级目录。

建议：

```text
RLearning
│
├── Home
│
├── CS Foundations
│   ├── Operating Systems
│   ├── Computer Networks
│   ├── Databases
│   └── Algorithms & Data Structures
│
├── Systems
│   ├── Distributed Systems
│   ├── Backend Systems
│   ├── Data Infrastructure
│   └── System Design
│
├── ML & LLM
│   ├── Machine Learning
│   ├── Deep Learning
│   ├── Transformers
│   ├── LLM
│   ├── Post-training
│   └── Reinforcement Learning
│
└── AI Infrastructure
    ├── GPU / CUDA
    ├── Training Systems
    ├── Distributed Training
    ├── Inference
    ├── vLLM
    └── Model Serving
```

一级目录保持少。

随着内容增加再拆。

例如：

```text
ML & LLM
    ↓

LLM
├── Architecture
├── Pre-training
├── Post-training
│   ├── SFT
│   ├── RLHF
│   ├── PPO
│   ├── DPO
│   └── GRPO
│
├── Inference
└── Evaluation
```

---

# 5. Page Layout

Desktop 使用三栏布局：

```text
┌───────────────────────────────────────────────────────────────┐
│ RLearning                     Search              GitHub  ◐   │
├───────────────┬────────────────────────────────┬──────────────┤
│               │                                │              │
│ Navigation    │          Main Content          │   On this    │
│               │                                │    page      │
│ Home          │  # Virtual Memory              │              │
│               │                                │ Introduction │
│ CS Basics     │  Virtual memory allows...      │ Paging       │
│  └ OS         │                                │ Page Fault   │
│    └ Process  │  ┌──────────────────────────┐  │ TLB          │
│    └ Memory   │  │                          │  │              │
│               │  │ Interactive Diagram      │  │              │
│ Systems       │  │                          │  │              │
│               │  └──────────────────────────┘  │              │
│ ML & LLM      │                                │              │
│               │  ## Paging                     │              │
│ AI Infra      │                                │              │
│               │  ...                           │              │
│               │                                │              │
├───────────────┴────────────────────────────────┴──────────────┤
```

Recommended width:

```text
Sidebar       250px
Content       700–800px
Right TOC     200px

Total         ~1200–1300px
```

正文不要太宽。

技术文章阅读时控制在约：

```text
70–80 characters / line
```

---

# 6. Left Sidebar

Sidebar 是整个网站最重要的 Navigation。

Example:

```text
⌂ Home

▾ CS Foundations
    ▾ Operating Systems
        Processes
        Threads
        Scheduling
        Virtual Memory
        File Systems

    ▸ Networking
    ▸ Databases

▾ Systems
    Distributed Systems
    System Design

▾ ML & LLM
    Transformer
    Post Training
    Reinforcement Learning

▾ AI Infra
    GPU
    vLLM
    Model Serving
```

要求：

- collapsible sections
- 当前 page 高亮
- 当前 section 自动展开
- sidebar scroll 独立于正文
- collapse state 保存在 localStorage
- mobile 下变成 drawer

> 当前实现（2026-10-20，`components/layout/SidebarNav.tsx`）：顶部是搜索框（⌘K 或 / 聚焦），按标题、section、分类和 tag 过滤，结果按「分类 / section」分组，Enter 打开第一条。目录默认只展开当前笔记所在的分类和 section，其余各占一行；切换笔记时重新折叠到新位置，并把当前笔记滚到侧栏中间。折叠状态没有存 localStorage：每次跟着当前页面走，比记住旧状态更好找。

顶部：

```text
RLearning
Search...
```

底部可以放：

```text
About
GitHub
Dark Mode
```

---

# 7. Main Content

Article 页面结构：

```text
Breadcrumb

CS Foundations / Operating Systems

# Virtual Memory

A mechanism that provides each process with the illusion
of a large and continuous address space.

Tags:
Operating Systems · Memory · CS Foundations

Last updated Sep 2026
────────────────────────────────────────────

Article content

...

────────────────────────────────────────────

Previous                         Next
Processes                    File Systems
```

文章排版重点：

- 大量 whitespace
- 清晰 heading hierarchy
- code block
- table
- blockquote
- callout
- inline code
- math
- diagram
- interactive visualization

---

# 8. Right Table of Contents

Desktop 显示。

例如：

```text
ON THIS PAGE

Introduction
Virtual Address
Paging
  Page Table
  TLB
Page Fault
Demand Paging
Summary
```

行为：

- 根据 H2/H3 自动生成
- scroll spy
- 当前 section 高亮
- 点击 smooth scroll
- sticky positioning

Tablet / Mobile 隐藏。

---

# 9. Home Page

Home 不需要像 Portfolio。

建议做成 Knowledge Dashboard。

```text
RLearning

Notes on computer systems, machine learning,
LLMs and AI infrastructure.

────────────────────────────────

Explore

Computer Science
OS · Networking · Database

Systems
Distributed Systems · System Design

ML & LLM
Transformer · Post-training · RL

AI Infrastructure
GPU · vLLM · Serving

────────────────────────────────

Recently Updated

Virtual Memory
TCP Congestion Control
GRPO
KV Cache
vLLM PagedAttention

────────────────────────────────

Currently Learning

Distributed Systems
LLM Inference
AI Infrastructure
```

可以有一句很轻的个人介绍：

```text
Built while learning, breaking things,
and trying to understand how systems actually work.
```

但不要把主页变成 Resume。

> 当前实现（2026-10-20，设计稿 `docs/superpowers/specs/2026-10-19-home-roadmap-design.md`）：首页依次是 intro、**知识路线图**、最近记录（6 条，其余折叠在「查看全部」里）。原来的「探索主题」卡片已删除。
>
> - 路线图数据在 `content/roadmap.ts`：一个 section 一个节点，手工摆 `row/col`。ML 章节之间的边由 `content/ml/tree.ts` 的跨章节边推出，其余手写；被更长路径蕴含的边会自动去掉。`tests/roadmap.test.ts` 保证每个 section 都在图上、边都朝下、没有环。新增 section 时要在这里加一个节点。
> - 节点颜色按分类区分，进度条显示 stable / growing / seed 的比例（目前全站还没有 stable 笔记，所以只看得到 growing）。
> - 点节点打开右侧抽屉：按阅读顺序列出笔记，下面是「先修」「接下来」。Esc 或点遮罩关闭。
> - 路线图区域窄于 880px 时（不论是窄屏还是分屏），改为按层分组的列表，避免缩得太小看不清。

> 当前实现（2026-10-30，设计稿 `docs/superpowers/specs/2026-10-30-machine-cover-design.md`、`2026-10-30-english-version-design.md`）：首页从上到下是 hero、学习活动方格、知识路线图、最近记录。
>
> - Hero 两栏：左边是标题和一段自我介绍（小头像、两三句话、GitHub 和主页链接，文字在 `content/profile.ts`）；右边是作者主机 Lenovo Legion T5 的 3D 模型（`components/home/machine/`，数据在 `content/machine.ts`）。面板有两个视图：「整机」显示部件规格和模拟读数，部件标签链接到对应章节；「跑一步 GRPO」循环播放一次真实训练 step 的数据流，每个阶段附相关笔记。3D 加载前和没有 WebGL 时显示部件标签列表，减少动态时只画一帧。窄屏上下堆叠。
> - 学习活动方格在首页放在 hero 下面；其它页面仍在正文最上方。
> - 英文版在 `/en/` 下，有自己的 root layout（`<html lang="en">`），界面文字来自 `lib/i18n.ts`。笔记按篇选择翻译：有 `.en.mdx` 和 `en` 元数据的笔记才有 `/en/notes/<slug>/`；没翻译的照常出现在英文目录里，标「中文」，链接到中文原文。顶栏的语言入口在两种语言的同一页之间切换；没翻译的中文笔记则指向英文首页。

---

# 10. Content Model

内容统一存放：

```text
/content
```

建议：

```text
content/
│
├── cs/
│   ├── os/
│   │   ├── processes.mdx
│   │   ├── threads.mdx
│   │   ├── scheduling.mdx
│   │   └── virtual-memory.mdx
│   │
│   └── networking/
│       ├── tcp.mdx
│       ├── http.mdx
│       └── dns.mdx
│
├── systems/
│   └── distributed/
│
├── ml/
│   ├── transformer.mdx
│   ├── attention.mdx
│   └── post-training/
│
└── ai-infra/
    ├── gpu/
    ├── inference/
    └── vllm/
```

URL 自动对应：

```text
/notes/cs/os/processes
/notes/cs/os/virtual-memory

/notes/ml/transformer
/notes/ml/post-training/grpo

/notes/ai-infra/vllm/paged-attention
```

---

# 11. MDX Frontmatter

每篇文章使用统一 metadata：

```yaml
---
title: "Virtual Memory"
description: "How operating systems provide virtual address spaces."
category: "CS Foundations"
section: "Operating Systems"

tags:
  - os
  - memory
  - paging

status: "growing"

created: "2026-09-29"
updated: "2026-09-29"

order: 4
---
```

其中：

```text
status:
seed
growing
stable
```

可以表达笔记成熟度。

UI：

```text
● Growing
```

这个功能比较符合“个人学习笔记”，因为很多内容本身就是持续更新的。

---

# 12. MDX Components

这是 RLearning 与普通博客最大的区别。

建立：

```text
/components/mdx
```

基础组件：

```text
Callout
CodeBlock
Tabs
Steps
Definition
KeyIdea
Warning
Equation
Figure
Reference
```

例如：

```mdx
<KeyIdea>
A process does not directly access physical memory.
It operates on virtual addresses.
</KeyIdea>
```

---

# 13. Visualization System

建立专门目录：

```text
/components/visualizations
```

可视化尽量遵循：

```text
Concept
  ↓
Static Diagram
  ↓
Interactive Diagram
  ↓
Animation
```

不是每个知识点都必须做动画。

只有当交互能明显帮助理解时才做。

---

# 14. Example Visualizations

## Operating Systems

```text
ProcessStateDiagram

New
 ↓
Ready ⇄ Running
 ↓       ↓
Wait ←───┘
 ↓
Ready
```

可以点：

```text
Next event
```

观察状态变化。

---

## CPU Scheduling

```text
CPU Scheduling Simulator

Processes

P1 █████ 5ms
P2 ███   3ms
P3 ███████ 7ms

Algorithm:

[ FCFS ▼ ]

Timeline

| P1 | P1 | P1 | P1 | P1 | P2 | P2 | P2 | P3 ...

Average waiting time: 4.3ms
```

后面可以切：

```text
FCFS
SJF
Round Robin
```

---

## Networking

### TCP Handshake

```text
Client              Server

  SYN  ────────────→

       ←──────── SYN ACK

  ACK  ────────────→
```

点击 Step 展示：

```text
SEQ
ACK
TCP state
```

---

## Distributed Systems

### Consistent Hashing

画一个 hash ring：

```text
             Node A
              ●
        ╭────────────╮
     ●                  ●
 Node D                Node B

        ╰────────────╯
              ●
            Node C
```

允许用户：

```text
Add Node
Remove Node
Add Key
```

观察 key relocation。

---

## Transformer

```text
Tokens
  ↓
Embedding
  ↓
┌──────────────┐
│ Multi Head   │
│ Attention    │
└──────────────┘
  ↓
Add & Norm
  ↓
Feed Forward
  ↓
Add & Norm
```

Hover 一个 token 可以显示 attention。

---

## RL / Post-training

```text
Prompt
  ↓
Policy Model
  ↓
Responses
  ↓
Reward
  ↓
Advantage
  ↓
Policy Update
```

适合解释：

```text
RLHF
PPO
GRPO
```

---

## AI Infra

这里应该成为网站后期很有特色的一块。

例如：

### KV Cache

动态展示：

```text
Prompt:

"The cat sat on the"

Step 1

K cache
████████████

V cache
████████████

Generated:
mat
```

继续 generation 时展示 cache 如何增长。

### vLLM PagedAttention

展示：

```text
Logical KV blocks

Sequence A
[0][1][2][3]

          ↓ block table

Physical KV memory

[ A0 ][ B1 ][ A2 ][ C0 ][ A1 ]
```

点击添加 sequence 后观察 memory allocation。

这个比纯文字解释 PagedAttention 有价值很多。

---

# 15. Technical Architecture

Recommended stack:

```text
Next.js
TypeScript
React
MDX
Tailwind CSS
Lucide Icons
KaTeX
Shiki
Vercel
GitHub
```

Optional：

```text
Framer Motion
```

只用于需要 animation 的可视化。

不要为了页面 transition 大量使用 animation。

---

# 16. Rendering Architecture

整体：

```text
GitHub Repository
       │
       │ git push
       ▼
     Vercel
       │
       ▼
   next build
       │
       ├── Parse MDX
       ├── Generate navigation tree
       ├── Generate article metadata
       ├── Generate search index
       └── Static pages
               │
               ▼
            Browser
```

V1 不存在：

```text
Browser → API → Database
```

所有核心内容都 build-time 生成。

---

# 17. Application Structure

建议：

```text
rlearning/
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   │
│   └── notes/
│       └── [...slug]/
│           └── page.tsx
│
├── content/
│   ├── cs/
│   ├── systems/
│   ├── ml/
│   └── ai-infra/
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── TableOfContents.tsx
│   │   └── MobileNav.tsx
│   │
│   ├── mdx/
│   │   ├── Callout.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── Definition.tsx
│   │   └── Steps.tsx
│   │
│   ├── visualization/
│   │   ├── VisualizationFrame.tsx
│   │   └── ...
│   │
│   └── ui/
│
├── lib/
│   ├── content.ts
│   ├── navigation.ts
│   ├── toc.ts
│   └── search.ts
│
├── public/
│
├── styles/
│
├── mdx-components.tsx
│
└── next.config.ts
```

---

# 18. Navigation Configuration

目录结构不要全部 hardcode 在 JSX。

可以有：

```text
content/navigation.ts
```

例如：

```ts
export const navigation = [
  {
    title: "CS Foundations",
    children: [
      {
        title: "Operating Systems",
        children: [
          "processes",
          "threads",
          "scheduling",
          "virtual-memory",
        ],
      },
    ],
  },
]
```

也可以后期根据 directory + metadata 自动生成。

V1 推荐：

```text
semi-automatic
```

文件负责内容。

Navigation config 负责人为控制排序。

这样最容易维护。

---

# 19. Search

第一版就可以支持：

```text
⌘ K
```

打开 Command Palette：

```text
Search RLearning

> virtual memory

Virtual Memory
CS Foundations / Operating Systems

Paging
CS Foundations / Operating Systems

KV Cache
AI Infra / Inference
```

搜索范围：

```text
title
description
headings
tags
```

索引 build time 生成。

浏览器本地搜索。

不需要 Elasticsearch / database。

---

# 20. Design System

整体采用 neutral palette。

Light Mode：

```text
Background        #FFFFFF
Sidebar           #FAFAFA
Primary text      near black
Secondary text    gray
Border            very light gray
Accent            subtle blue / violet
```

Dark Mode：

```text
Background        near black
Sidebar           slightly lighter
Primary text      off-white
Secondary text    gray
```

原则：

```text
Color is information.
```

不要大面积彩色 gradient。

颜色主要用于：

- links
- visualization
- status
- callouts
- active navigation

---

# 21. Typography

字体优先：

```text
Inter / Geist
```

Code：

```text
Geist Mono
```

正文：

```text
16–17px
line-height ~1.7
```

Heading：

```text
H1 36px
H2 26px
H3 20px
```

整体应该像 documentation / Notion，而不是 marketing landing page。

---

# 22. Code Blocks

技术知识库中 code block 很重要。

需要：

```text
syntax highlighting
language label
copy button
line highlight
filename
```

Example:

```text
scheduler.py                         Copy

def schedule(processes):
    ...
```

后续支持：

```mdx
<CodeBlock
  filename="scheduler.py"
  highlight="3-5"
/>
```

---

# 23. Math

ML 内容需要 LaTeX。

例如：

```latex
Attention(Q,K,V)
=
softmax(
\frac{QK^T}{\sqrt{d_k}}
)V
```

使用 KaTeX。

支持：

```text
inline math
block math
```

---

# 24. Responsive Design

Desktop：

```text
Sidebar | Content | TOC
```

Tablet：

```text
Sidebar | Content
```

Mobile：

```text
Header
  ☰ RLearning       Search

Content
```

Sidebar 点击 hamburger 打开 drawer。

Mobile 不显示 Right TOC。

正文需要特别优化：

- table horizontal scroll
- code horizontal scroll
- visualization responsive
- diagrams scale down

---

# 25. Interaction Principles

动画保持克制。

普通 UI：

```text
150–200ms
```

Knowledge visualization 可以稍慢：

```text
300–500ms
```

避免：

```text
excessive page transitions
parallax
floating decorative objects
marketing-style animations
```

网站的 attention 应该始终落在知识内容上。

---

# 26. Writing Workflow

未来写文章可以直接让 Coding Agent 工作。

例如：

```text
Create a new RLearning note:

Topic:
TCP Congestion Control

Location:
content/cs/networking/tcp-congestion-control.mdx

Explain:

- congestion window
- slow start
- congestion avoidance
- AIMD
- packet loss

Create an interactive visualization showing how cwnd
changes over time.

Follow the RLearning design system.
```

Agent：

```text
Create MDX
      ↓
Create visualization component
      ↓
Import component
      ↓
Build
      ↓
Test
```

这样 Coding Agent 实际上会成为网站的“知识可视化工程师”。

---

# 27. Visualization Component Contract

为了避免以后 agent 写出来的组件风格完全不同，所有 visualization 必须放在统一 container 中。

例如：

```tsx
<VisualizationFrame
  title="TCP Congestion Window"
  description="Observe how cwnd evolves during Slow Start."
>
  <TCPVisualization />
</VisualizationFrame>
```

统一提供：

```text
Title
Description
Border
Background
Reset
Fullscreen
Explanation
```

这样以后生成几十个 visualization 页面也不会乱。

---

# 28. Content Philosophy

每篇文章尽量回答：

```text
What is it?

Why does it exist?

How does it work?

What problem does it solve?

What are the trade-offs?

How does it connect to other concepts?
```

例如学习 Virtual Memory：

不要只记录：

```text
Virtual memory uses pages...
```

而是解释：

```text
Problem
  ↓
Physical memory is limited and fragmented

Idea
  ↓
Give every process its own virtual address space

Mechanism
  ↓
Page Table

Optimization
  ↓
TLB

Failure path
  ↓
Page Fault

Tradeoff
  ↓
Memory overhead + translation latency
```

这种结构也非常适合可视化。

---

# 29. Knowledge Connections

V2 可以支持：

```text
Related Notes
```

例如：

```text
Virtual Memory

Related:

→ Page Table
→ TLB
→ Memory Allocation
→ vLLM PagedAttention
```

这里会出现一个很有意思的跨领域 connection：

```text
Operating Systems Paging
          ↓
      Page Table
          ↓
AI Infra / PagedAttention
```

这种 connection 很符合 RLearning 的定位。

---

# 30. Future Ideas

不进入 V1：

```text
Knowledge Graph
Learning Progress
Article Version History
Comments
AI Search
Semantic Search
Chat with Notes
Automatic backlinks
Flashcards
Quiz Mode
Public contribution
```

尤其不要第一版就做：

```text
AI chatbot
vector database
RAG
```

因为这些东西很容易把一个简单知识网站变成 infrastructure project。

先积累真正的内容。

---

# 31. MVP

V1 只实现：

```text
Home

Sidebar navigation

MDX article rendering

Right-side TOC

Dark / Light mode

Code highlighting

Math support

Callout components

Responsive mobile layout

Static search

VisualizationFrame

2–3 demo visualizations

Vercel deployment
```

Demo visualization 建议：

```text
OS
Process State

Networking
TCP Handshake

LLM
Transformer / Attention
```

这样可以验证三种不同类型的 visualization。

---

# 32. V1 Initial Content

不需要一开始写几十篇。

建议先创建：

```text
CS Foundations
└ Operating Systems
   ├ Processes
   ├ Threads
   └ Virtual Memory

Networking
├ TCP
└ HTTP

Systems
└ Distributed Systems
   └ Introduction

ML & LLM
├ Transformer
├ Attention
└ Post-training
   └ GRPO

AI Infra
├ LLM Inference
├ KV Cache
└ vLLM
   └ PagedAttention
```

大约 12 篇就已经能形成完整网站结构。

---

# 33. MVP Development Phases

## Phase 1 — Foundation

```text
Next.js project
Tailwind
MDX
Static rendering
Vercel
```

目标：

```text
Hello World article works.
```

## Phase 2 — Knowledge Layout

实现：

```text
Sidebar
Article
TOC
Breadcrumb
Previous / Next
Responsive layout
```

## Phase 3 — Content System

实现：

```text
Frontmatter
Metadata
Navigation generation
Article index
Search index
```

## Phase 4 — Reading Experience

实现：

```text
Typography
Code block
Math
Callouts
Dark mode
```

## Phase 5 — Visualization

实现：

```text
VisualizationFrame

ProcessStateDiagram
TCPHandshake
TransformerDiagram
```

## Phase 6 — Polish

```text
Mobile
SEO
OpenGraph
404
Performance
Accessibility
```

---

# 34. Non-Goals

V1 explicitly does NOT include:

```text
Backend

Database

Authentication

Admin dashboard

CMS

Comments

AI Chat

RAG

User generated content

Complex analytics
```

---

# 35. Success Criteria

V1 完成时：

```text
✓ git push 可以更新文章

✓ 新文章只需要创建 MDX

✓ Desktop / mobile 阅读体验良好

✓ Sidebar 可以快速浏览知识结构

✓ TOC 可以快速定位文章内部内容

✓ 支持代码、公式和 diagram

✓ MDX 中可以嵌 React visualization

✓ 网站不依赖 backend

✓ Lighthouse performance 良好

✓ Vercel 自动部署

✓ Coding Agent 可以按照统一规范继续新增内容
```

---

# 36. Core Product Principle

RLearning 最终不应该只是：

```text
A website with my notes.
```

更应该是：

```text
A visual map of what I understand.
```

普通知识：

```text
Markdown
```

复杂知识：

```text
Markdown
   +
Diagram
```

动态过程：

```text
Markdown
   +
Interactive React Visualization
```

随着知识积累，网站本身也持续进化。

这应该成为整个项目最核心的设计思想。

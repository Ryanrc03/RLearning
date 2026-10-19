# 首页知识路线图（Roadmap）设计草案

> 状态：已确认（2026-10-19），第 6 节均采用推荐项：进度条 = 写作成熟度；删除「探索主题」卡片；算法作为独立小支线放进同一张图；节点粒度 = section。参考：https://neetcode.io/roadmap

## 1. 要解决什么

现在首页只有两块内容：「最近记录」把 103 篇笔记全部按更新时间平铺出来，「探索主题」是 5 张分类卡片。两块都看不出**知识之间的先后关系**，也就看不出从哪里读起、读完一块下一步该读什么。

NeetCode roadmap 的做法是：把主题画成一张**自上而下的依赖图（DAG）**，每个节点是一个主题，节点上有进度条；点开节点，右侧滑出这个主题下的题目列表。

我们照这个思路，把首页的主体换成一张**全站知识路线图**：

- **节点**：一个 section（如 Operating Systems、LLMs、GPU Kernels），全站约 25 个。节点不是单篇笔记，否则 103 个太密。
- **边**：「读 B 之前最好先读 A」。
- **点开节点**：右侧抽屉列出这个 section 的笔记，按阅读顺序（series order）排，点笔记进入正文。

成功标准：打开首页，一眼能看到整个知识库的骨架和学习路径；两次点击之内进入任一篇笔记。

## 2. 页面结构（改后）

```text
┌ intro（保留，压短）
├ 知识路线图 Roadmap            ← 新，首页主体
│    SVG DAG：~25 个节点 + 依赖边，按类别着色
│    点节点 → 右侧抽屉：该 section 的笔记清单
├ 最近记录（保留，只显示最近 6 条 + "查看全部"）
└ （删除）探索主题卡片 —— 被路线图取代
```

## 3. 路线图草图（初版依赖关系，待你改）

```text
                 CS Fundamentals
                /        |        \
       Operating Sys  Networks   Binary Search ── Stack
          |      \       |
          |     Distributed Systems
          |       /      |      \
          |  Data Infra  System Design  Backend
          |
   ┌──────┴────────────── ML ──────────────────────┐
   Evaluation        Classifiers
       |                 |
       |              Training
       |            /    |     \
       |       Trees  Representations  DL Blocks
       |         \        |              |
       └──── Recommender Systems        LLMs ─── Multimodal
                                      /     \
                              Post-training  LLM Engineering
                                   |               |
                         Reinforcement Learning  Agent Harness
   Operating Sys + DL Blocks ──→ GPU Kernels
```

各 section 之间的边从哪来：

- **ML 内部**：根据 `content/ml/tree.ts` 现有的 28 条跨章节边，算出 chapter 级别的边（A 章有节点指向 B 章 → A→B），不用另写。
- **其余**：在新数据文件里手写，大约 12 条。

## 4. 数据：`content/roadmap.ts`（新）

```ts
export type RoadmapNode = {
  id: string;            // 稳定 id，如 "cs-os"、"ml-llms"
  section: string;       // 与 notes.ts 的 section 完全一致 → 用来取笔记清单
  categoryId: NoteEntry["categoryId"];
  label?: string;        // 节点上显示的短名（默认 = section）
  row: number;           // 手工布局：第几层
  col: number;           // 该层内的横向位置（可为小数，方便居中）
};
export type RoadmapEdge = { from: string; to: string };

export const roadmapNodes: RoadmapNode[];
export const roadmapEdges: RoadmapEdge[]; // 手写边 + 由 ml/tree.ts 推出的边
```

为什么手工指定 `row/col`，不用自动布局：

- NeetCode 的图也是手工摆的，25 个节点手摆一次就够；
- 自动布局（dagre / elk）要加依赖，结果还常需要微调；
- 手摆的坐标是确定的，静态导出也没有任何运行时开销。

**测试**：新增 `tests/roadmap.test.ts`，检查：

- 每个 `section` 都在 notes.ts 里存在；
- notes.ts 里的每个 section 都出现在图上，新加 section 时忘了画会直接报错；
- 边的两端都存在；
- 图里没有环。

## 5. 组件

| 文件 | 作用 |
|---|---|
| `components/home/RoadmapGraph.tsx`（client） | SVG 画布：节点用 `foreignObject` 包一个 HTML 卡片（沿用 `KnowledgeTree` 的做法），边用三次贝塞尔曲线（复用 `edgePath` 的思路）。hover 一个节点时高亮它的上游和下游，其余变淡。 |
| `components/home/RoadmapDrawer.tsx`（client） | 右侧抽屉，内容依次是：section 标题、所属类别、笔记列表（标题 + 一句描述 + seed/growing/stable 状态）、「先修」「接下来」两组节点链接。Esc 或点遮罩关闭。 |
| `app/page.tsx` | 换成 intro + `<RoadmapGraph>` + 精简后的「最近记录」 |

**节点卡片**：显示短名、笔记数，底部一条进度条（含义见下面的「待你决定」第 1 条）。颜色按 `categoryId` 区分，沿用现有的 `topic-icon-*` 色系；风格保持现在的浅黄 / 白、安静的文档感，不照搬 NeetCode 的暗色紫。

**交互**：

- 点节点 → 打开抽屉；
- 抽屉里点笔记 → 正常跳转；
- 键盘：节点可以 Tab 聚焦，按 Enter 打开抽屉。

**响应式**：

- ≥ 1080px：整图铺满，不需要缩放或平移；
- 850–1080px：图等比缩小；
- < 850px：不画图，退化成按层分组的纵向列表（层 1 → 层 2 → …），每项点开同一个抽屉。

## 6. 待你决定

1. **进度条显示什么？** 现在没有任何「已读」数据。
   - A（推荐）**写作成熟度**：stable 篇数 ÷ 总篇数。符合「个人知识花园」的定位，不需要存储，所有人看到的一样。
   - B **读者已读**：在 localStorage 里记录访问过的笔记。只对当前浏览器有效，换设备就没了。
   - C 不要进度条。
2. **「探索主题」卡片要删掉吗？** 我倾向删掉，因为路线图已经覆盖了分类入口。
3. **算法这块要放进同一张图吗？** 它和其他部分几乎没有依赖关系，可以作为图右侧的一条独立小支线，也可以先不放。
4. **节点粒度**：按 section（约 25 个，推荐），还是 ML 部分展开到章节内的节点（会多出 50 多个）？

## 7. 实施步骤（确认后执行）

1. 新建 `content/roadmap.ts`，写好节点 + 手写边 + 从 ml/tree.ts 推导边的函数，并配上 `tests/roadmap.test.ts`（先写测试）。
2. 做 `RoadmapGraph`：布局常量、边、节点卡片、hover 高亮。
3. 做 `RoadmapDrawer`：笔记列表、先修 / 接下来、Esc 关闭。
4. 改 `app/page.tsx` 和首页 CSS：精简「最近记录」、删除「探索主题」卡片、加窄屏的纵向列表。
5. 验证：`npm test`、`npm run typecheck`、`npm run build`，然后在浏览器里分别看 1440 / 1000 / 375 三个宽度的截图。
6. 更新 `docs/design.md`，记录首页结构的变化。

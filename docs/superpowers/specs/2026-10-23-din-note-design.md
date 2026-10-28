# DIN 笔记 — 设计文档

日期：2026-10-23　状态：已实施（含 Day 3 结果）

## 目标

一篇讲 DIN（Deep Interest Network, Zhou et al., KDD 2018）的长笔记，用个人项目 kuairank（KuaiRand-1K 排序实验）的 Day 3 作为例子：target attention 的结构、为什么不做 softmax、和均值池化的区别，以及 kuairank 怎样存和取用户序列而不物化 (样本 × N) 的矩阵。

## 范围

- 一篇 MDX，`content/ml/recsys/din.mdx`，slug `ml/recsys/din`。它是 Recommender Systems 章节（`existing: true`）的节点，接在 `id-embedding-one-epoch` 之后、`sample-feature-join` 之前。
- 六个 React 可视化，放在 `components/visualization/ml/recsys/din/`，计算在 `lib/ml/din.ts`（测试 `tests/din.test.ts`）。
- 事实：论文数字（数据规模、Alibaba 配置、Table 3 / Table 5、线上 A/B 与服务）来自 ar5iv 上的 arXiv 1706.06978；官方实现的拼接方式与 softmax 来自 `zhougr1993/DeepInterestNetwork` 的 `din/model.py`；kuairank 数字来自 `docs/DIN_SEQ.zh-CN.md` 与 `kurec/models/din.py`、`kurec/seq.py`。
- Day 3 结果（运行 #16–#26，`docs/DIN_SEQ.zh-CN.md` §7）放在「KuaiRand 上的结果」一节：结果表、与预期的对照，以及「用户状态 vs 兴趣匹配」的按请求分组分析。

## 可视化

| 组件 | 放在哪一节 | 它让读者看到什么 |
| --- | --- | --- |
| `DinPipelineFigure` | What is it? | 上一行存储（事件数组 + 指针 + GPU gather，黄 / 蓝），下一行打分（共用 item 表绿、activation unit 蓝、Σ 墨色、DCN-v2 蓝、pCTR 橙、BCE 灰虚线）；两个按钮分别聚焦存储与打分 |
| `DinGatherFigure` | 架构 › 输入 | 三个用户的 20 个事件；选样本看 (lo, hi)、同一请求被排除；拖 N 看右对齐窗口、padding 与 mask（`historyIndex` 与 kurec 同一公式） |
| `DinAttentionUnitFigure` | 架构 › 核心 | activation unit：q、k_i、q − k_i、q ⊙ k_i、e_fb 拼成 208 维 → 64 → 32 → 1 → w_i → Σ；两个按钮聚焦输入构造与「不做 softmax」 |
| `DinLossFigure` | Loss functions | 10 条历史、3 个候选：每条历史的均值权重与 DIN 权重、池化分数、p 与 BCE（2-D 示意 activation，footnote 写明示意值） |
| `DinShapeStepper` | A KuaiRand example | 一个 batch（4096、N = 50、d = 16）九步的张量形状与所在位置，宽度由 `dinShapes()` 计算；footnote 对比 12 GB 物化与 80 MB 指针 |
| `DinVsMeanFigure` | DIN vs 均值池化 | 同一段 200 条历史（最后 12 条刷萌宠），拖 N 看两种池化把萌宠与游戏候选拉开多少：均值被稀释，DIN 不被稀释但尺度随 N 变（示意值，非实验结果） |

## 结果对正文的影响

- 方案阶段的预期（N 越长 DIN 越占优）被推翻：DIN 与均值打平、N = 10 最好、点击流最差。`DinVsMeanFigure` 保留为「DIN 在什么条件下该赢」的示意，footnote 与正文都写明实际结果相反。
- Trade-offs 与 Key ideas 改为以「增益来自用户状态、按请求分组的 GAUC 增益为 0」为结论；GAUC 笔记的代价与取舍补了按请求分组这一条。

# ML 知识树笔记 — 设计文档

日期：2026-10-16　状态：批次 1（骨架 + Evaluation 章）已实施，其余批次待做

## 目标

把作者手写的《ML Fundamentals》笔记（13 页、23 个主题）整理成 RLearning 上 ML & LLM 分类下的一棵**知识树**：7 章、24 个节点页，加 1 页全局树和 7 页章节总览。读者是准备 ML 面试、或回头复习的作者本人。

和 CS Fundamentals 的区别：**按知识组织，不按对比组织。** 一章是一棵子树，一页是一个节点；节点之间按“前一页留下的问题，后一页来回答”连成链，对比只在天然有两条路的地方出现（L1 / L2、CBOW / Skip-gram、level-wise / leaf-wise）。

每页都回答 AGENTS.md 要求的四件事：是什么、为什么需要、怎么工作、代价与取舍。

## 知识树

```text
ML & LLM
│
├── Evaluation 评价指标              模型好不好
│   ├── Confusion Matrix 与 Accuracy
│   ├── Precision / Recall / F1
│   ├── ROC 与 AUC
│   ├── PR 曲线与 Precision@k
│   └── A/B Test 与 p-value
│
├── Classifiers 分类器               分数怎么变成概率
│   ├── Naive Bayes
│   ├── Logistic Regression
│   └── Softmax 与 Cross-Entropy
│
├── Training 训练                    loss 怎么降下去
│   ├── Gradient Descent 与 Optimizers
│   ├── Bias 与 Variance
│   └── Regularization：L1 与 L2
│
├── Tree Models 树模型               不用梯度也能学
│   ├── Decision Tree
│   ├── Ensemble：Bagging / Boosting / Stacking
│   ├── GBDT
│   └── XGBoost 与 LightGBM
│
├── Representations 向量表示         东西怎么变成向量
│   ├── Word2Vec：CBOW 与 Skip-gram
│   ├── Sentence Embedding：CLS 与 Mean Pooling
│   └── Cosine Similarity
│
├── Deep Learning Blocks 网络部件    深了以后出的问题
│   ├── Backprop 与 Chain Rule
│   ├── Residual Connection
│   └── Normalization：Batch / Layer / Weight
│
├── LLM Engineering LLM 工程         不改模型怎么改答案
│   ├── Prompt Engineering
│   ├── Context Engineering
│   └── Hallucination
│
├── LLMs（已有：Transformer vs RNN）
├── Multimodal（已有 3 页，CLIP loss 已覆盖）
├── Recommender Systems（已有 3 页）
└── Reinforcement Learning（已有 UCB）
```

### 跨章的依赖边

树的边分两种：章内的**问题链**（实线，上表的顺序）和跨章的**先修边**（虚线）。先修边只画下面这些，不多画：

| 从 | 到 | 为什么 |
| --- | --- | --- |
| Softmax 与 Cross-Entropy | Word2Vec、Hallucination、Multimodal › CLIP | 三处都在用 softmax 和 −log p |
| Gradient Descent 与 Optimizers | Logistic Regression、GBDT | LR 用 GD 学 w；GBDT 的“残差”就是平方损失的负梯度 |
| Bias 与 Variance | Regularization、Ensemble | 两条治过拟合的路 |
| Decision Tree → Ensemble → GBDT → XGBoost 与 LightGBM | RecSys › 梯度提升树如何给曝光打分、提升树训练实验台 | 树模型章的出口是已有的推荐系统页 |
| Backprop 与 Chain Rule | Residual Connection、Normalization | 两个部件都是为了让梯度传得过去 |
| Cosine Similarity | Sentence Embedding、Multimodal › 视觉与文本是怎么对齐的 | 向量比相似度的地方 |
| ROC 与 AUC | RecSys › 梯度提升树如何给曝光打分、提升树训练实验台 | 两页都用验证集 AUC 做早停 |

SVD 在笔记里只有一行，不单开节点，写进 Word2Vec 页的“为什么需要它”（count-based 的前史）。

## 站点结构

### 目录与导航

| 章 | `section` | MDX 目录 | 图组件目录 |
| --- | --- | --- | --- |
| 评价指标 | `Evaluation` | `content/ml/evaluation/` | `components/visualization/ml/evaluation/` |
| 分类器 | `Classifiers` | `content/ml/classifiers/` | `components/visualization/ml/classifiers/` |
| 训练 | `Training` | `content/ml/training/` | `components/visualization/ml/training/` |
| 树模型 | `Tree Models` | `content/ml/trees/` | `components/visualization/ml/trees/` |
| 向量表示 | `Representations` | `content/ml/representations/` | `components/visualization/ml/representations/` |
| 网络部件 | `Deep Learning Blocks` | `content/ml/dl-blocks/` | `components/visualization/ml/dl-blocks/` |
| LLM 工程 | `LLM Engineering` | `content/ml/llm-engineering/` | `components/visualization/ml/llm-engineering/` |

- 共用零件放 `components/visualization/ml/primitives/`，纯计算放 `lib/ml/`。
- 导航顺序由 `content/notes.ts` 里条目的先后决定。ML 分类下的条目重排为：Knowledge Tree → Evaluation → Classifiers → Training → Tree Models → Representations → Deep Learning Blocks → LLMs → LLM Engineering → Multimodal → Recommender Systems → Reinforcement Learning。已有条目只移动位置，不改内容。
- `content/navigation.ts` 里 ml 的 `topics` 文案改为 `Evaluation · Classifiers · Trees · LLMs · Multimodal · RecSys · RL`。

### 三种页面

**1. 全局树页** `content/ml/overview.mdx`，slug `ml/overview`，section `Knowledge Tree`，标题「ML & LLM 知识树」。只有两段话加一张 `<KnowledgeTree />`：整棵树，章是分支，节点可点跳转，章内实线、跨章虚线；hover 一个节点时高亮它的先修节点和后继节点；点一个节点在图下方显示它的一句话和「去读这页」。已有的四个 section（LLMs、Multimodal、RecSys、RL）作为叶子出现在树上，这样已有内容也挂进树里。

**2. 章总览页** `content/ml/<章>/overview.mdx`，slug `ml/<章>/overview`。三段：`## 一句话`（这章回答什么问题）→ `## 这章的问题链`（`<KnowledgeTree chapter="evaluation" />`，只画这章的子树，每个节点下面写它回答的问题，另加这章用到的先修节点）→ `## 怎么读`。

**3. 节点页**，见下一节。

树的数据只有一份：`content/ml/tree.ts` 导出 `chapters`（id、标题、问题、节点列表）、`nodes`（slug、标题、回答的问题、一句话）和 `edges`（先修边）。`KnowledgeTree` 组件和章总览页都从这里读，节点页「再往下看」里的链接手写，但 `tests/ml-tree.test.ts` 会检查每个节点的 slug 都在 `notes.ts` 里注册、每条边两端都存在、每章的问题链没有断。

## 节点页约定

MDX 正文固定五节，顺序不变：

| 节 | 标题 | 内容 | 预算 |
| --- | --- | --- | --- |
| 1 | `## 一句话` | 一句加粗的定义，然后至多两句说它用在哪 | 加粗 ≤ 80 字 |
| 2 | `## 为什么需要它` | 接上一页留下的问题：没有它会出什么事。用笔记里的那个例子（990 狗 10 猫、cat 0.9 对 0.2、180 → 20 → 10 → 0） | 2–4 句 |
| 3 | `## 怎么工作` | 一张图，必要的公式（≤ 3 个，KaTeX），2–4 段话解释图里看到的东西 | 这节最长 |
| 4 | `## 代价与取舍` | 3–5 条：什么时候不该用、常见的坑、和相邻节点的取舍 | 列表或 ≤ 3 行的表 |
| 5 | `## 再往下看` | 树上的下一个节点一句话引出来；有跨章先修或出口就再加一句 | ≤ 3 句 |

- 全文 500–800 字。不放代码块。只有一张主图；只有在主图之外还需要一个静态结构图时才加第二张（Backprop 页的网络结构图）。
- 标题是概念本身，不是 X vs Y：`# Precision / Recall / F1`、`# GBDT`。概念术语保留英文，CJK 和英文之间留空格。
- `content/notes.ts`：`categoryId: "ml"`、`category: "ML & LLM"`、`section` 见上表、`status: "seed"`、`readingMinutes` 4–7、tags 含 `"ml-fundamentals"` 和章名。同一章的节点用同一个 `series`（id `ml-<章>`，title 用章的问题，order 按链的顺序），这样页面底部自动出现上一页 / 下一页。
- 这套约定写成新 skill `.claude/skills/writing-ml-node/SKILL.md`，和 `writing-fundamentals-note` 并列；AGENTS.md 加一行指向它。CS Fundamentals 的 skill 不改。

## 图的标准

这是和之前几章最大的差别，四条都是硬要求：

1. **数是算出来的，不是写死的。** 图里出现的每个数字都来自 `lib/ml/` 里的纯函数（无 React、无 DOM），并在 `tests/` 里有单元测试。混淆矩阵的四个格子、ROC 上的点、AUC、optimizer 的轨迹、p-value、后验概率，全部实时计算。需要随机数的地方用带种子的 LCG（`lib/ml/random.ts`），保证刷新后图一样。
2. **一个主控件加重置。** 每张图只有一个主要交互：滑杆、步进播放器（上一步 / 下一步 / 播放 / 重置）、切换组、可拖的点，四选一；需要时允许一个辅助的预设按钮（如「换成 990 狗 10 猫」）。不再限制“两个按钮”。
3. **共用一套零件和尺寸。** `components/visualization/ml/primitives/`：`Plot`（坐标轴、刻度、网格）、`Curve`、`Marker`、`Bars`、`Matrix`（HTML 网格）、`StepPlayer`、`Slider`、`Toggle`。SVG 的 viewBox 以 720 × 360 为基准，字号 12–13px，不再出现 9px 的标签；颜色只用 `styles/visualization.css` 里的 token（`--v1` 到 `--v4`、`--vgood`、`--vwarn`、`--vcrit`）；新增的 class（`.viz-slider`、`.viz-player`、`.viz-matrix`）也加进这个文件。状态变化用 CSS transition，`usePrefersReducedMotion` 为 true 时关掉过渡和自动播放。
4. **SVG 和 HTML 各用其所。** 曲线、向量、树、网络用 SVG；矩阵、概率条、prompt 分层这类本来就是表格或文本的东西用 HTML 网格和卡片，不塞进 SVG。

每张图仍然用 `VisualizationFrame` 包裹，图下方一行 `viz-narr`，随状态变化说明“现在看到的是什么”。

## 二十四个节点

“来源”指手写笔记的页码。“下一页”是「再往下看」里的主链接。

### Evaluation：模型好不好

| # | slug | 标题 | 回答的问题 | 图：形式 → 主控件 | 来源 | 下一页 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `evaluation/confusion-matrix` | Confusion Matrix 与 Accuracy | 猜对了多少？ | HTML：10 个样本一排（6 狗 4 猫，预测 4 TP、2 FN、3 FP、1 TN，accuracy 50%）加 2×2 矩阵 → 点任一预测翻转它，矩阵和 accuracy 实时变；预设按钮「990 狗 10 猫」演示全猜狗也有 99% | p1 | 2 |
| 2 | `evaluation/precision-recall-f1` | Precision / Recall / F1 | 说是的里对了多少，真的里找出多少？ | HTML + SVG：同一批样本带分数，三根指标条 → 阈值滑杆，拖动看 precision、recall 此消彼长，F1 取调和平均 | p1 | 3 |
| 3 | `evaluation/roc-auc` | ROC 与 AUC | 阈值不固定时怎么比两个模型？ | SVG：两个模型的 ROC 曲线，对角线 → 阈值滑杆移动曲线上的点，TPR / FPR 同步显示；AUC 按笔记公式（正例分数高于负例的对数，平局记 0.5）算出 | p2 | 4 |
| 4 | `evaluation/pr-curve-precision-at-k` | PR 曲线与 Precision@k | 正例很少时 ROC 为什么还好看？ | SVG 左右并排 ROC 和 PR → 正负比例滑杆（1:1 到 1:99），看 ROC 几乎不变而 PR 塌下去；下方 Precision@k 小表（k = 5, 10, 20） | p2 | 5 |
| 5 | `evaluation/ab-test-p-value` | A/B Test 与 p-value | 离线指标好了，上线真的更好吗？ | SVG：control / treatment 两组转化率的抽样分布 → 样本量滑杆，显示观测差、p-value、power；四步流程卡片（分组、power analysis、执行、假设检验）跟着高亮 | p7 | 章出口：Classifiers |

### Classifiers：分数怎么变成概率

| # | slug | 标题 | 回答的问题 | 图：形式 → 主控件 | 来源 | 下一页 |
| --- | --- | --- | --- | --- | --- | --- |
| 6 | `classifiers/naive-bayes` | Naive Bayes | 不学参数，光数数能分类吗？ | HTML：笔记的垃圾邮件例子（12 封，8 正常 4 垃圾；Dear / Friend / Lunch / Money 在正常类的词频 8/17、5/17、3/17、1/17，在垃圾类 2/7、1/7、0/7、4/7；“Dear Friend” 算出 0.115 对 0.014，判正常（笔记里写的 0.33 是笔误，结论不变））→ 勾选邮件里出现的词，两个后验的连乘式逐项展开；勾到 Lunch 时垃圾类乘出 0，引出 Laplace 平滑 | p12 | 7 |
| 7 | `classifiers/logistic-regression` | Logistic Regression | 边界怎么学出来，分数怎么变概率？ | SVG 左右：二维点和决策边界，sigmoid 曲线上当前样本的位置 → 步进播放器，每步做一次 gradient descent，边界转动、BCE loss 下降 | p3 | 8 |
| 8 | `classifiers/softmax-cross-entropy` | Softmax 与 Cross-Entropy | 三类以上怎么办，错得离谱怎么罚得更重？ | HTML：cat / dog / bird 三个 logit 和 softmax 后的概率条，右侧 −log p 曲线 → 拖真实类的 logit，复现 0.9 → 0.105 和 0.2 → 1.61；K = 2 时公式退化成 sigmoid 的提示 | p3–4 | 章出口：Training |

### Training：loss 怎么降下去

| # | slug | 标题 | 回答的问题 | 图：形式 → 主控件 | 来源 | 下一页 |
| --- | --- | --- | --- | --- | --- | --- |
| 9 | `training/gradient-descent-optimizers` | Gradient Descent 与 Optimizers | loss 怎么降下去？ | SVG：一个狭长的二维 loss 等高线 → 切换 GD / SGD / Momentum / RMSProp / Adam 后步进播放，五条轨迹叠加比较；SGD 用带种子的噪声，Momentum 显示 v_t = βv_{t−1} + g_t | p8 | 10 |
| 10 | `training/bias-variance` | Bias 与 Variance | 训练 loss 降了，测试为什么没降？ | SVG 左右：多项式拟合带噪声的点，右侧训练 / 测试误差随复杂度的曲线 → 多项式阶数滑杆（1 到 12），欠拟合和过拟合两端自动标注 | p8 | 11 |
| 11 | `training/regularization-l1-l2` | Regularization：L1 与 L2 | 怎么治过拟合？ | SVG 左右对比：loss 等高线叠 L1 菱形 / L2 圆形约束，解的位置 → λ 滑杆，看 L1 的解被推到坐标轴上（权重归零）、L2 的解只是缩小 | p4 | 章出口：Tree Models |

### Tree Models：不用梯度也能学

| # | slug | 标题 | 回答的问题 | 图：形式 → 主控件 | 来源 | 下一页 |
| --- | --- | --- | --- | --- | --- | --- |
| 12 | `trees/decision-tree` | Decision Tree | 不用梯度，怎么从数据里学规则？ | SVG + HTML：12 个两特征样本的散点，候选切分线 → 步进播放器：列出候选切分的熵和信息增益，选最大的一刀切下去，树长一层 | p9 | 13 |
| 13 | `trees/ensembles` | Ensemble：Bagging / Boosting / Stacking | 一棵树不够怎么办？ | SVG：三条流水线（随机子集各训一棵再投票；顺序训练残差；多个模型的输出再训一个模型）→ 切换策略后步进播放；Random Forest 作为 bagging 加特征抽样（n ≤ N、m ≤ M）在 bagging 面板里标出 | p9 | 14 |
| 14 | `trees/gbdt` | GBDT | boosting 怎么用残差？ | SVG：一维回归点，F_m(x) 的阶梯曲线和每个点的残差 → 「加一棵树」步进，复现 180 → 20 → 10 → 0；辅助的 learning rate 预设（0.1 / 0.5 / 1.0） | p9 | 15 |
| 15 | `trees/xgboost-lightgbm` | XGBoost 与 LightGBM | 工业版 GBDT 快在哪？ | SVG 左右对比：level-wise 和 leaf-wise 两棵树逐步生长 → 步进播放器，每步右侧按 IG 最大的叶子长，左侧整层长；下方三张卡片：histogram 分桶、EFB、GOSS | p9–10 | 出口：RecSys › 梯度提升树如何给曝光打分 |

### Representations：东西怎么变成向量

| # | slug | 标题 | 回答的问题 | 图：形式 → 主控件 | 来源 | 下一页 |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | `representations/word2vec` | Word2Vec：CBOW 与 Skip-gram | 词怎么变向量？ | SVG 左右对比：笔记的句子 “We are about to study the idea”，窗口里上下文 → 中心词（CBOW）和中心词 → 上下文（Skip-gram）→ 拖窗口位置，两边列出当前生成的训练对；one-hot → embedding → softmax 的结构图在下方 | p10、p13 | 17 |
| 17 | `representations/sentence-embedding` | Sentence Embedding：CLS 与 Mean Pooling | 一句话怎么变一个向量？ | HTML：`[CLS] I really like Adobe [SEP]` 每个 token 的隐向量画成小条 → 切换 CLS / mean pooling，输出向量的来源高亮；点任一 token 看它对 mean 的贡献 | p5 | 18 |
| 18 | `representations/cosine-similarity` | Cosine Similarity | 两个向量多像？ | SVG：平面上两个向量 → 拖任一向量的端点，实时显示点积、两个模长、cos；辅助滑杆把一个向量拉长，证明 cos 不变而点积变 | p6 | 出口：Deep Learning Blocks；跨章：Multimodal › 视觉与文本是怎么对齐的 |

### Deep Learning Blocks：深了以后出的问题

| # | slug | 标题 | 回答的问题 | 图：形式 → 主控件 | 来源 | 下一页 |
| --- | --- | --- | --- | --- | --- | --- |
| 19 | `dl-blocks/backprop-chain-rule` | Backprop 与 Chain Rule | 多层网络的梯度怎么算？ | SVG：笔记的两层网络 x → W⁽¹⁾ → a → z = σ(a) → W⁽⁰⁾ → s → p → L → 步进播放器，前半程正向填数，后半程反向每步显示局部导数和连乘结果，最后得到 −(1 − p)·z | p11 | 20 |
| 20 | `dl-blocks/residual-connection` | Residual Connection | 层数深了梯度为什么消失，怎么救？ | SVG 左右对比：plain 和 residual 两列网络，每层旁边是梯度模长 → 深度滑杆（1 到 30 层），左侧连乘衰减到 0，右侧因为 (1 + ∂f/∂x) 保持可见 | p11 | 21 |
| 21 | `dl-blocks/normalization` | Normalization：Batch / Layer / Weight | 沿哪个轴归一化？ | HTML：batch × feature 的数值网格 → 切换 BatchNorm / LayerNorm / WeightNorm，高亮被求均值方差的那一列或那一行，旁边显示 μ、σ 和归一化后的值；BN 的训练 / 推理差别写在 narr 里 | p11 | 章出口：LLM Engineering |

### LLM Engineering：不改模型怎么改答案

| # | slug | 标题 | 回答的问题 | 图：形式 → 主控件 | 来源 | 下一页 |
| --- | --- | --- | --- | --- | --- | --- |
| 22 | `llm-engineering/prompt-engineering` | Prompt Engineering | 不改模型怎么改答案？ | HTML：prompt 拼装器 → 开关 role assignment / few-shot / CoT / constraint 四层，右侧实时拼出完整 prompt，每层下面一句它改变了什么 | p4 | 23 |
| 23 | `llm-engineering/context-engineering` | Context Engineering | prompt 之外还有什么进了模型？ | HTML：上下文窗口画成一根 token 预算条，上面叠 system、短期记忆（摘要）、长期记忆（vector DB 取回）、RAG 片段、工具结果、状态、用户这轮 → 逐项开关，预算条填满时提示要压缩 | p5 | 24 |
| 24 | `llm-engineering/hallucination` | Hallucination | 模型为什么会编，怎么少编？ | SVG：下一个 token 在小词表上的分布 → temperature 滑杆，看低概率 token 在高温下被采到；旁边 what / why / how 三张卡片（句子自相矛盾与事实错误；数据质量、生成方式、输入 prompt；清晰 prompt、降温、few-shot） | p6 | 出口：AI Infra › Agent Harness |

## 计算层

`lib/ml/` 新增文件，每个都是纯函数，`tests/` 里对应一个测试文件：

| 文件 | 内容 | 用在 |
| --- | --- | --- |
| `random.ts` | 带种子的 LCG、正态抽样 | 5、9、10 |
| `metrics.ts` | confusion、accuracy、precision、recall、f1、rocPoints、auc（含平局 0.5）、prPoints、precisionAtK | 1–4 |
| `abtest.ts` | 两比例 z 检验的 p-value、power、所需样本量 | 5 |
| `bayes.ts` | 词频表 → 先验、似然、后验，带可选 Laplace 平滑 | 6 |
| `linear.ts` | sigmoid、softmax（已有于 clip.ts，复用）、BCE、交叉熵、LR 的一步梯度 | 7、8 |
| `optim.ts` | 二维 loss 函数及其梯度、GD / SGD / Momentum / RMSProp / Adam 的单步更新 | 9 |
| `polyfit.ts` | 最小二乘多项式拟合、训练 / 测试误差 | 10、11 |
| `trees.ts` | 熵、信息增益、单层切分、一维回归树桩、GBDT 迭代、level-wise / leaf-wise 生长顺序 | 12–15 |
| `embeddings.ts` | 窗口训练对生成、mean pooling、cosine（复用 clip.ts） | 16–18 |
| `backprop.ts` | 两层网络的正向值和反向局部导数、residual 的梯度连乘 | 19、20 |
| `norm.ts` | 沿 batch / feature 轴的均值方差、weight norm | 21 |
| `sampling.ts` | 带 temperature 的 softmax 采样（用 random.ts） | 24 |

测试用现有的 `npm test`（`tsx --test tests/*.test.ts`）。每个函数至少一条用笔记里的数字做断言：p1 的 4/7、4/6、50%；p4 的 0.105、1.61；p12 的 0.115 和 0.014。

## 注册

- `content/notes.ts`：新增 24 个节点、7 个章总览、1 个全局树页，共 32 条，并按上文顺序重排 ml 的条目。
- `app/notes/[...slug]/page.tsx`：32 个 import 和 `noteComponents` 条目（延续现有手工注册方式；NEXT_STEPS.md 里的内容加载器不在本次范围）。
- `content/navigation.ts`：只改 ml 的 `topics` 文案。
- `.claude/skills/writing-ml-node/SKILL.md` 新建；AGENTS.md 加一行。

## 测试与验收

`npm test && npm run typecheck && npm run lint && npm run build` 全部通过。用 `dev` 启动配置打开每一页：主控件从头拖到尾、步进播放器点到最后一步再重置，确认每个状态的 narr 正确、没有 NaN；手机宽度下 SVG 可横向滚动，页面本身不出现横向滚动；开启 reduced motion 后没有自动播放。全局树页上每个节点都能点到对应页面。

## 实施顺序

每一章一个批次，一个批次一个 PR：

1. **骨架 + Evaluation 章（第 1–5 页）**：`tree.ts`、`KnowledgeTree`、全局树页、primitives、`random.ts`、`metrics.ts`、`abtest.ts`、新 skill。这一批定下图的视觉标准，作者看过实物再继续。
2. Classifiers + Training（第 6–11 页）。
3. Tree Models（第 12–15 页）。
4. Representations + Deep Learning Blocks（第 16–21 页）。
5. LLM Engineering（第 22–24 页），然后重排已有 ml 条目、改 topics 文案。

## 不做

- 不改 CS Fundamentals、GPU Kernels 和已有 ML 页面的写法和图。
- 不做 SVD、Weight Norm 的独立页面；不写 post-training（`content/ml/post-training/` 仍是空目录）。
- 不引入图表库，全部用现有的 React + SVG + CSS。
- 不做内容加载器、搜索索引等 NEXT_STEPS.md 里的基础设施。

## 追加（2026-10-16）：《Transformer》与《646》两份笔记

来源：手写笔记《Transformer》3 页（attention 的 Q / K / V、参数量、架构六件套、masking、训练 loss、decoding 与 temperature）和《646》5 页（BatchNorm 1D vs 2D、ResNet 与 Inception 的 forward、RNN 公式与张量形状、attention 矩阵形状与 multi-head 参数量、MeMe 检索的 P@30 / Recall@30 实测）。

### LLMs 从「已有」变成一整章

section 仍叫 `LLMs`，目录 `content/ml/llms/`，新增章总览 `ml/llms/overview`；已有的 Transformer vs RNN 成为第 2 个节点，它的 series 从 `multimodal-path` 改到 `ml-llms`（多模态三页保留自己的 series，树上的虚线仍连着它们）。

| # | slug | 标题 | 回答的问题 | 图：形式 → 主控件 | 来源 |
| --- | --- | --- | --- | --- | --- |
| 25 | `llms/rnn` | RNN：hidden state 一步一步传 | 序列怎么被一步步读？ | SVG 展开的时间轴 → 步进播放器，用一个 hidden 3 维、输入 2 维的真实递推算出每个 h_t；旁边的形状面板演示 (32, 10, 50) → (32, 10, 100) | 646 p2 |
| 26 | `llms/transformer-vs-rnn`（已有） | | 怎么并行地读？ | 不改 | |
| 27 | `llms/attention-qkv` | Attention：Q、K、V | 一个 token 怎么看别的 token？ | 「Hi I am Ryan」四个 token、d = 4 的玩具 embedding → 步进：E → Q K V → S = QKᵀ/√d（4×4 矩阵）→ 按行 softmax → out = AV → E₄' = E₄ + ΔE₄；点任一行聚焦；形状 (B, T, d) 逐步列出 | Transformer p1、646 p2–3 |
| 28 | `llms/multi-head-attention` | Multi-head 与参数量 | 为什么要多个头，参数有多少？ | HTML → heads 滑杆 h ∈ {1, 2, 4, 8, 16}，d_model = 128：d_k = d_model / h，每个 head (B, T, d_k)，W_Q,K,V 共 3 d_model²、W^O 一个 d_model²，总 4 d_model² 与 h 无关；预设切到 GPT-3 的 12,288 × 128 | 646 p3、Transformer p1 |
| 29 | `llms/transformer-block` | Transformer Block：一层里有什么 | 一层里还有什么？ | SVG 方块图 → 步进把一个 token 送过 embedding + position（sinusoidal / learned 切换）、multi-head attention、residual + LayerNorm、MLP、residual + LayerNorm、mask，每步标形状；LayerNorm 而不是 BatchNorm 的原因（token 长度不一样） | Transformer p2 |
| 30 | `llms/pretraining-objectives` | 预训练目标：自回归与 Masked LM | 训练时在预测什么？ | HTML 序列 → 切换 GPT（因果 mask，L = −Σ log P(y_t \| y_<t)）/ BERT（遮 15%，L = −Σ log P(x_i \| x_masked) 加 NSP 二分类）；步进逐个位置显示哪些位置贡献 loss，用玩具概率算出 cross-entropy | Transformer p3 |
| 31 | `llms/decoding-strategies` | Decoding：greedy、sampling、top-k、top-p、beam | 生成时怎么选下一个词？ | SVG 下一词分布（10 个 token）+ 策略切换 greedy / sample / top-k / top-p / beam → temperature 滑杆（0.5 更尖、1 标准、2 更平）；显示可选集合和重归一化后的概率，beam 画两步的候选树和对数概率之和 | Transformer p3 |

### Deep Learning Blocks 追加一页，Normalization 页补一段

| # | slug | 标题 | 回答的问题 | 图：形式 → 主控件 | 来源 |
| --- | --- | --- | --- | --- | --- |
| 32 | `dl-blocks/inception-block` | Inception：并行分支按 channel 拼接 | 一层里能不能同时用几种卷积核？ | SVG：输入 (C, H, W) → 四条分支（1×1、3×3、5×5、pool）各出 (c_i, H, W) → `torch.cat` 沿 channel 拼成 (Σc_i, H, W) → 任一分支的 channel 数滑杆；对照 ResNet 的相加（形状不变）和这里的拼接（channel 变多） | 646 p1 |

Normalization 页追加 BatchNorm 1D vs 2D：(batch, feature) 按 feature 统计，(batch, channel, H, W) 按 channel 统计，都不改变张量形状，作用是稳定梯度、加速收敛；图里加一个 1D / 2D 的辅助切换。

### Recommender Systems 追加一页

| # | slug | 标题 | 回答的问题 | 图：形式 → 主控件 | 来源 |
| --- | --- | --- | --- | --- | --- |
| 33 | `recsys/retrieval-precision-at-k` | 检索的 P@30、Recall@30 与 group P@1 | 检索出来的前 30 个里有几个是对的？ | HTML：一条 query 的前 30 个结果，点击切换相关 / 不相关，实时算 P@30 和 Recall@30（给定总相关数）；旁边是 MeMe 项目的实测：exact P@30 = 0.23，semantic P@30 = 0.9344，group P@1 = 0.8287，标明是实测不是算出来的 | 646 p4 |

### 新增的先修边

evaluation/pr-curve-precision-at-k → recsys/retrieval-precision-at-k；classifiers/softmax-cross-entropy → llms/pretraining-objectives；llms/decoding-strategies → llm-engineering/hallucination；dl-blocks/normalization 和 dl-blocks/residual-connection → llms/transformer-block（原来 normalization → transformer-vs-rnn 的边改指到 transformer-block）；llms/attention-qkv → multimodal/vision-language-alignment。

### 计算层

`lib/ml/rnn.ts`（递推与形状）、`lib/ml/attention.ts` 已有（复用 softmax 与 mask，补 QKV 投影、缩放点积、多头拆分与参数量）、`lib/ml/decoding.ts`（greedy / sample / top-k / top-p / beam、temperature）、`lib/ml/pretrain.ts`（因果与 masked 的 loss 项）、`lib/ml/cnn.ts`（Inception 的形状拼接、BatchNorm2d 的 per-channel 统计）、`lib/ml/retrieval.ts`（P@k、Recall@k）。

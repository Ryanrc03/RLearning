// The single source of truth for the ML & LLM knowledge tree: chapters, the
// question chain inside each chapter, and the few cross-chapter prerequisite
// edges. KnowledgeTree draws it; tests/ml-tree.test.ts keeps it consistent with
// the note registry.

export type TreeNode = {
  slug: string;
  title: string;
  /** Shorter label for the tree card when the title does not fit two lines. */
  short?: string;
  /** The question this page answers, in the reader's words. */
  question: string;
  oneLiner: string;
  /** "planned" pages are drawn dashed and are not links yet. */
  status: "ready" | "planned";
};

export type TreeChapter = {
  id: string;
  title: string;
  /** Shorter label for the tree's left column. */
  short?: string;
  question: string;
  /** Matches `section` in content/notes.ts. */
  section: string;
  /** Chapter overview slug when the chapter has one. */
  overview?: string;
  /** Sections that existed before the tree; drawn in the same rows, labelled 已有. */
  existing?: boolean;
  nodes: TreeNode[];
};

export type TreeEdge = { from: string; to: string; why: string };

const n = (slug: string, title: string, question: string, oneLiner: string, status: TreeNode["status"] = "ready", short?: string): TreeNode => ({ slug, title, short, question, oneLiner, status });

export const chapters: TreeChapter[] = [
  {
    id: "evaluation",
    title: "Evaluation",
    question: "模型好不好",
    section: "Evaluation",
    overview: "ml/evaluation/overview",
    nodes: [
      n("ml/evaluation/confusion-matrix", "Confusion Matrix 与 Accuracy", "猜对了多少？", "把每个预测按「真的是什么」和「猜成什么」放进四个格子；accuracy 是对角线占全部的比例，类别一不平衡它就会骗人。", "ready"),
      n("ml/evaluation/precision-recall-f1", "Precision / Recall / F1", "说是的里对了多少，真的里找出多少？", "precision 看猜是的里面有多少真是，recall 看真是的里面找出了多少，F1 是两者的调和平均；三个数都随阈值变。", "ready"),
      n("ml/evaluation/roc-auc", "ROC 与 AUC", "阈值不固定时怎么比两个模型？", "把阈值从高扫到低，每个阈值一个 (FPR, TPR) 点连成 ROC；AUC 是随机一个正例分数高于随机一个负例的概率。", "ready"),
      n("ml/evaluation/pr-curve-precision-at-k", "PR 曲线与 Precision@k", "正例很少时 ROC 为什么还好看？", "正例稀少时 FPR 几乎不动，ROC 仍然好看；PR 曲线和 Precision@k 只看正例那一侧，才会暴露问题。", "ready", "PR 与 Precision@k"),
      n("ml/evaluation/ab-test-p-value", "A/B Test 与 p-value", "离线指标好了，上线真的更好吗？", "把用户随机分成 control 和 treatment，先用 power analysis 算要多少样本，再用 p-value 判断差异是不是运气。", "ready"),
      n("ml/evaluation/t-test", "t 检验", "比的是平均值不是比例，用什么检验？", "方差未知的均值用 t 检验：t = (x̄₁ − x̄₂) / √(s₁²/n₁ + s₂²/n₂)，自由度小时 t 分布尾巴比正态厚，样本大了两者重合。", "ready"),
    ],
  },
  {
    id: "ab-testing",
    title: "A/B Testing",
    short: "A/B Test",
    question: "差异是真的还是运气",
    section: "A/B Testing",
    overview: "ml/ab-testing/overview",
    nodes: [
      n("ml/ab-testing/central-limit-theorem", "中心极限定理", "为什么样本平均值总是正态的？", "不管总体长什么样，n 个独立抽样的平均值都近似服从 N(μ, σ²/n)：形状变成钟形，宽度按 1/√n 收窄。这是 z 检验和 p-value 成立的理由。", "ready"),
      n("ml/ab-testing/hypothesis-testing", "假设检验与 p-value", "看到的差异是真的还是运气？", "先假设没区别（H0），用中心极限定理算出观测值在 H0 下的分布，p-value 是至少这么极端的概率；它说的是数据有多意外，不是 H0 为真的概率。", "ready"),
      n("ml/ab-testing/rejection-region", "拒绝域、α 与 power", "为什么要先画一条线再看数据？", "看数据之前先定 α：H0 下概率只有 α 的那片尾巴就是拒绝域。α 是冤枉好人的概率，β 是放过坏人的概率，power = 1 − β；线画得越严 α 越小 β 越大，只有加样本能两头都好。", "ready", "拒绝域与 power"),
      n("ml/ab-testing/gacha-example", "例子：抽卡概率是不是暗改了", "一个人抽 500 次能告诉官方它骗人吗？", "公示 1%，你抽了 500 次只出 2 张：二项分布算出 p ≈ 0.09，告不倒；全服一起记到几千抽，同样的比例就显著了。样本量决定 power。", "ready", "例子：抽卡概率"),
    ],
  },
  {
    id: "causal-inference",
    title: "Causal Inference",
    short: "Causal",
    question: "没法做实验时怎么知道因果",
    section: "Causal Inference",
    overview: "ml/causal-inference/overview",
    nodes: [
      n("ml/causal-inference/correlation", "相关性：Pearson r", "两个变量一起动，是什么关系？", "r = cov(x, y) / (s_x s_y)，在 −1 到 1 之间，量的是点有多贴近一条直线；U 形关系 r ≈ 0，冰淇淋和溺水 r 很高但控制气温后就没了。", "ready", "相关性 r"),
      n("ml/causal-inference/linear-regression", "线性回归：最小二乘", "x 多 1 单位，y 平均多多少？", "找一条让残差平方和最小的直线：β̂₁ = cov / var = r·s_y / s_x，直线过 (x̄, ȳ)；系数仍然只是相关，混杂变量要作为第二个回归项放进去才算「控制」。", "ready", "线性回归"),
      n("ml/causal-inference/difference-in-differences", "DiD：双重差分", "没法随机分组时，怎么把混杂减掉？", "处理组前后的变化减去对照组前后的变化：第一次差减掉两组固有的高低，第二次差减掉所有人都经历的时间趋势。等价于回归里 treated × post 交互项的系数，前提是平行趋势。", "ready", "DiD"),
      n("ml/causal-inference/minimum-wage-example", "例子：最低工资涨了，汉堡店裁人了吗", "一次真实的 DiD 得出了什么？", "1992 年新泽西把最低工资从 4.25 涨到 5.05 美元，隔壁宾州没涨：新泽西店均 FTE +0.59，宾州 −2.16，双重差分 +2.75（SE 1.36，p ≈ 0.04）。没裁人，课本预测反了。", "ready", "例子：最低工资"),
    ],
  },
  {
    id: "classifiers",
    title: "Classifiers",
    question: "分数怎么变成概率",
    section: "Classifiers",
    overview: "ml/classifiers/overview",
    nodes: [
      n("ml/classifiers/naive-bayes", "Naive Bayes", "不学参数，光数数能分类吗？", "用词频数出每类的先验和似然，假设词与词独立，连乘后比大小。"),
      n("ml/classifiers/logistic-regression", "Logistic Regression", "边界怎么学出来，分数怎么变概率？", "一条线性边界 wᵀx + b，过 sigmoid 变成概率，用 BCE 损失和梯度下降学 w。"),
      n("ml/classifiers/softmax-cross-entropy", "Softmax 与 Cross-Entropy", "三类以上怎么办，错得离谱怎么罚得更重？", "softmax 把 K 个分数变成一组和为 1 的概率；cross-entropy 用 −log p 惩罚把真实类排得越低的预测。", "ready", "Softmax 与 CE"),
    ],
  },
  {
    id: "training",
    title: "Training",
    question: "loss 怎么降下去",
    section: "Training",
    overview: "ml/training/overview",
    nodes: [
      n("ml/training/gradient-descent-optimizers", "Gradient Descent 与 Optimizers", "loss 怎么降下去？", "沿负梯度走一步；SGD 用小批量换速度，Momentum 攒惯性，RMSProp 按维度调步长，Adam 两者都要。", "ready", "GD 与 Optimizers"),
      n("ml/training/bias-variance", "Bias 与 Variance", "训练 loss 降了，测试为什么没降？", "bias 是模型学不会，variance 是换一批数据答案就变；训练误差和测试误差的差距暴露的是后者。"),
      n("ml/training/regularization-l1-l2", "Regularization：L1 与 L2", "怎么治过拟合？", "在 loss 后面加惩罚项：L2 把权重整体压小，L1 把不重要的权重直接推到 0。", "ready", "L1 / L2 正则"),
    ],
  },
  {
    id: "trees",
    title: "Tree Models",
    question: "不用梯度也能学",
    section: "Tree Models",
    overview: "ml/trees/overview",
    nodes: [
      n("ml/trees/decision-tree", "Decision Tree", "不用梯度，怎么从数据里学规则？", "每次挑一个特征和一个切点，让切完后的熵降得最多，一刀刀切出一棵树。"),
      n("ml/trees/ensembles", "Ensemble：Bagging / Boosting / Stacking", "一棵树不够怎么办？", "bagging 让很多棵树各看一部分数据再投票，boosting 让后一棵树专修前一棵的残差，stacking 再训一个模型来综合。", "ready", "Ensembles"),
      n("ml/trees/gbdt", "GBDT", "boosting 怎么用残差？", "每一轮用当前预测和真值的残差训一棵小树，乘 learning rate 加到总模型上。"),
      n("ml/trees/xgboost-lightgbm", "XGBoost 与 LightGBM", "工业版 GBDT 快在哪？", "XGBoost 加了正则和缺失值处理；LightGBM 用直方图分桶、特征捆绑、按梯度采样和 leaf-wise 生长换来速度。"),
    ],
  },
  {
    id: "representations",
    title: "Representations",
    question: "东西怎么变成向量",
    section: "Representations",
    overview: "ml/representations/overview",
    nodes: [
      n("ml/representations/word2vec", "Word2Vec：CBOW 与 Skip-gram", "词怎么变向量？", "用上下文预测中心词（CBOW）或用中心词预测上下文（Skip-gram），训练出的隐层权重就是词向量。", "ready", "Word2Vec"),
      n("ml/representations/sentence-embedding", "Sentence Embedding：CLS 与 Mean Pooling", "一句话怎么变一个向量？", "BERT 把一句话变成每个 token 一个向量；取 [CLS] 位置或把所有 token 平均，就得到整句的向量。", "ready", "Sentence Embedding"),
      n("ml/representations/cosine-similarity", "Cosine Similarity", "两个向量多像？", "两个向量夹角的余弦：只看方向不看长度，所以适合比较 embedding。"),
      n("ml/representations/tf-idf", "TF-IDF", "不训练模型，句子能变向量吗？", "每一维是一个词或字符 n-gram，权重 = (1 + ln tf) × idf，再 L2 归一化；两句的 cosine 就是共同 n-gram 上的权重乘积之和。", "ready", "TF-IDF"),
    ],
  },
  {
    id: "dl-blocks",
    title: "Deep Learning Blocks",
    short: "DL Blocks",
    question: "深了以后出的问题",
    section: "Deep Learning Blocks",
    overview: "ml/dl-blocks/overview",
    nodes: [
      n("ml/dl-blocks/backprop-chain-rule", "Backprop 与 Chain Rule", "多层网络的梯度怎么算？", "loss 对每层权重的梯度是一串局部导数的连乘，从输出往输入倒着算一遍。"),
      n("ml/dl-blocks/residual-connection", "Residual Connection", "层数深了梯度为什么消失，怎么救？", "y = x + f(x) 让梯度多出一条 1 的通路，层数再深也不会连乘成 0。"),
      n("ml/dl-blocks/normalization", "Normalization：Batch / Layer / Weight", "沿哪个轴归一化？", "BatchNorm 沿 batch 轴对每个 feature 归一化，LayerNorm 沿 feature 轴对每个样本归一化，WeightNorm 把权重拆成方向和长度。", "ready", "Normalization"),
      n("ml/dl-blocks/inception-block", "Inception：并行分支按 channel 拼接", "一层里能不能同时用几种卷积核？", "四条分支各用自己的卷积核，输出的空间尺寸相同，沿 channel 拼接：torch.cat 之后 channel 变多，H、W 不变。", "ready", "Inception"),
    ],
  },
  {
    id: "llms",
    title: "LLMs",
    question: "模型怎么读一串 token",
    section: "LLMs",
    overview: "ml/llms/overview",
    nodes: [
      n("ml/llms/rnn", "RNN：hidden state 一步一步传", "序列怎么被一步步读？", "h_t = tanh(W_hh h_{t−1} + W_xh x_t)：每读一个 token 就把它揉进同一个 hidden state，输出 y_t = softmax(W_hy h_t)。", "ready", "RNN"),
      n("ml/llms/transformer-vs-rnn", "Transformer vs RNN", "怎么并行地读一串 token？", "RNN 每一步都在等上一步；Transformer 同一层的所有位置只依赖上一层，一次矩阵乘法算完一整层。", "ready"),
      n("ml/llms/attention-qkv", "Attention：Q、K、V", "一个 token 怎么看别的 token？", "每个 token 投影出 query、key、value；用 QKᵀ/√d 算相关性，softmax 成权重，再把 value 加权求和加回自己。", "ready", "Attention Q/K/V"),
      n("ml/llms/multi-head-attention", "Multi-head 与参数量", "为什么要多个头，参数有多少？", "把 d_model 拆成 h 份，每个头在自己的 d_k 维里做一次 attention 再拼回来；W_Q、W_K、W_V、W_O 共 4 d_model² 个参数，与头数无关。", "ready", "Multi-head"),
      n("ml/llms/transformer-block", "Transformer Block：一层里有什么", "一层里还有什么？", "embedding 加位置编码进来，经过 multi-head attention 和 MLP 两个子层，每个子层外面套 residual 和 LayerNorm，decoder 再加一个因果 mask。", "ready", "Transformer Block"),
      n("ml/llms/pretraining-objectives", "预训练目标：自回归与 Masked LM", "训练时在预测什么？", "GPT 用因果 mask 预测下一个 token，loss 是 −Σ log P(y_t | y_<t)；BERT 遮住 15% 的 token 再猜回来，外加一个句子对的二分类。", "ready", "预训练目标"),
      n("ml/llms/deepseek-moe", "DeepSeekMoE：让 FFN 按 token 选择专家", "普通 FFN 太贵，能只训和算一部分专家吗？", "共享专家每次都算，router 为每个 token 只选少数细粒度专家；下一词 loss 更新已选专家，辅助均衡损失防止路由塌缩。", "ready", "DeepSeekMoE"),
      n("ml/llms/decoding-strategies", "Decoding：greedy、sampling、top-k、top-p、beam", "生成时怎么选下一个词？", "greedy 取最高，sampling 按概率抽，top-k / top-p 先截断再抽，beam search 多留几条路选总分最大的；temperature 把分布变尖或变平。", "ready", "Decoding"),
      n("ml/llms/bert", "BERT：双向编码器怎样读懂一句话", "这些零件拼成一个只读不写的模型，怎么训、怎么用？", "只有 encoder 的 Transformer：遮住 15% 的词再猜回来做预训练，再接一个小头全参数微调去做分类；读得懂整句，但不会生成。", "ready", "BERT"),
      n("ml/llms/bert-vs-macbert", "BERT vs MacBERT", "中文 BERT 还能怎么训得更好？", "结构完全一样，都是 12 层 base，差别只在预训练任务：MacBERT 按整词和 n-gram 选，用近义词代替 [MASK] 再让模型纠错回原词，并用 SOP 和更多数据。", "ready", "MacBERT"),
      n("ml/llms/bert-finetuning", "BERT 微调：用 MacBERT 做三分类", "预训练好的模型怎么用到自己的任务上？", "载入编码器，在 [CLS] 后接一个 768 → 3 的新线性层，用标注数据、2e-5 的学习率、warmup 加线性衰减把全部参数再训 2 到 4 个 epoch，用 macro-F1 挑 checkpoint。", "ready", "BERT 微调"),
    ],
  },
  {
    id: "post-training",
    title: "Post-training",
    short: "Post-train",
    question: "预训练之后怎么教模型听话",
    section: "Post-training",
    overview: "ml/post-training/overview",
    nodes: [
      n("ml/post-training/sft", "SFT", "预训练完了，怎么让模型照指令回答？", "用（指令, 好回答）对继续训练；loss 还是逐 token 的 cross-entropy，但 prompt 的 token 被 mask 掉，只在回答上算。", "ready"),
      n("ml/post-training/lora", "LoRA", "全量微调太贵，能只训一小部分吗？", "冻结 W，只学 W' = W + BA，B 是 d×r、A 是 r×k、r ≪ d；B 初始化为 0，推理时把 BA 合并回 W 没有额外延迟。", "ready"),
      n("ml/post-training/rlhf", "RLHF：RM、PPO 与 DPO", "好回答很难写出来，但能比出来，怎么用？", "用成对偏好训一个奖励模型（Bradley–Terry），再用 PPO 在和参考模型的 KL 约束下优化；DPO 把这两步合成一个分类式的 loss。", "ready", "RLHF 与 DPO"),
      n("ml/post-training/grpo", "GRPO", "PPO 的 critic 太贵，能去掉吗？", "每个 prompt 采样 G 个回答各自打分，advantage = (r − 组内均值) / 组内标准差；用组内平均当基线，省掉 critic，其余沿用 PPO 的 clip 和 KL。", "ready"),
      n("ml/post-training/reward-hacking", "奖励设计与 Reward Hacking", "奖励一加上去，模型为什么学歪了？", "策略只优化你写下的奖励，不优化你心里的目标；长度奖励会被堆字刷分，要用正确性门控、上限和 KL 拉住它。", "ready", "Reward Hacking"),
    ],
  },
  {
    id: "llm-engineering",
    title: "LLM Engineering",
    short: "LLM Eng.",
    question: "不改模型怎么改答案",
    section: "LLM Engineering",
    overview: "ml/llm-engineering/overview",
    nodes: [
      n("ml/llm-engineering/prompt-engineering", "Prompt Engineering", "不改模型怎么改答案？", "给模型分配角色、放几个例子、让它先想再答、写清限制，不改参数也能改答案。"),
      n("ml/llm-engineering/context-engineering", "Context Engineering", "prompt 之外还有什么进了模型？", "prompt 只是上下文窗口的一部分，还有记忆、检索来的片段、工具结果和状态，一起决定模型看到什么。"),
      n("ml/llm-engineering/hallucination", "Hallucination", "模型为什么会编，怎么少编？", "模型会生成自相矛盾或与事实不符的内容，原因在数据、采样和输入；清晰的 prompt、降温和 few-shot 能减少它。"),
      n("ml/llm-engineering/llm-as-judge", "LLM-as-judge 与 GSB", "生成的东西没有标准答案，怎么比两个模型？", "把新旧输出并排给人或模型判 Good / Same / Bad 算胜率；模型当评委有位置偏差和长度偏差，交换顺序判两次再和人工对齐。", "ready", "LLM-as-judge 与 GSB"),
      n("ml/llm-engineering/eval-harness", "Eval Harness 与数据飞轮", "评估怎么变成自动、可重复的一道关？", "便宜可靠的规则检查放最前面，规则判不了的交给模型门控，不合格自动重生成；过关和不过关的样本回流成下一轮的训练数据。", "ready", "Eval Harness"),
    ],
  },
  {
    id: "multimodal",
    title: "Multimodal",
    question: "图片怎么进语言模型",
    section: "Multimodal Learning",
    existing: true,
    nodes: [
      n("ml/multimodal/visual-tokens", "Visual Tokens", "一张图片怎么变成 token？", "图片先切 patch，再经过 ViT 和 merger 生成可以送入语言模型的视觉向量。", "ready"),
      n("ml/multimodal/vision-language-alignment", "Vision–Language Alignment", "视觉和文本怎么对齐？", "对齐不只是把两种 embedding 变成相同维度：projector、生成式 loss、冻结与端到端训练一起建立多模态理解。", "ready", "图文对齐"),
      n("ml/multimodal/clip-contrastive-learning", "CLIP 对比学习", "对比学习怎么训？", "三张图、三句话、一个 3×3 相似度矩阵；调 temperature 看图文匹配概率和双向 contrastive loss 怎么变。", "ready"),
      n("ml/multimodal/multisticker-project", "Project：MultiSticker", "这些拼起来能做什么？", "一个完整项目：对话上下文、检索到的历史记忆和 LLM 意图三路文本过 CLIP 编码，投影进图像空间，从 6,758 张贴纸里排出用户会发的那张；Exact R@30 从 0.28% 到 13.15%。", "ready"),
      n("ml/multimodal/dae-fuse-project", "Project：DAE-Fuse", "两种相机的图怎么融成一张？", "红外看得见人、可见光看得见车：ResNet18 抽高频、ViT 抽低频，cross-attention 让两种特征互相查询，两个判别器要求融合图两边都像；M3FD 上 YOLOv8n 的 mAP@50 从 0.779 到 0.887。", "ready", "Project：DAE-Fuse"),
    ],
  },
  {
    id: "recsys",
    title: "Recommender Systems",
    short: "RecSys",
    question: "一条曝光怎么被打分",
    section: "Recommender Systems",
    existing: true,
    nodes: [
      n("ml/recsys/kuairand-data-overview", "KuaiRand-1K 数据总览", "数据里到底有什么？", "1,000 个用户、31 天、1,166 万次曝光，8 个 0/1 反馈：点开和长播三四成，点赞约 50 : 1，关注约 1,000 : 1；随机曝光点开率 17% 对推荐流 44%；五一假期把 test 的点赞率抬到 2.12%。", "ready", "数据总览"),
      n("ml/recsys/kuairand-input","一条曝光的 84 维输入", "排序模型看到什么？", "KuaiRand-1K 的曝光日志怎样变成排序模型的输入：数据流、一条真实样本的 84 个特征、只看过去的时间窗统计。", "ready"),
      n("ml/recsys/point-in-time-split", "时间切分与只用过去的特征", "这些统计只能用过去，评估集又怎么切？", "train / valid / test 按日期切，随机曝光单独当无偏测试集；每个特征只数时间戳严格早于样本的行，同一请求整块排除，含评估期的月均统计不用。", "ready", "时间切分与 point-in-time"),
      n("ml/recsys/lightgbm-explained", "梯度提升树如何给曝光打分", "树怎么给曝光打分？", "以真实训练的 LightGBM click 模型为例：目标函数与梯度、一轮迭代、直方图与 leaf-wise、一条样本的 407 步轨迹。", "ready"),
      n("ml/recsys/boosting-lab", "提升树训练实验台", "一轮一棵树怎么长？", "16 个点、一个特征，按一轮长一棵树：看残差被压小、LogLoss 下降、森林长出；GBDT / XGBoost / LightGBM 的差别做成开关。", "ready"),
      n("ml/recsys/auc-gauc-computation", "AUC 与 GAUC 怎么算", "AUC 和 GAUC 在代码里一步步怎么算？", "排一次序，正例排名和减去 n⁺(n⁺+1)/2 再除以 n⁺n⁻ 就是 AUC，平局取平均排名；GAUC 按用户切段、跳过单类用户、按曝光数加权。同样的分数按请求切，GAUC 会变。", "ready", "AUC / GAUC 怎么算"),
      n("ml/recsys/gauc-paired-bootstrap", "GAUC 与配对用户 bootstrap", "分数怎么评，两个模型差多少才算数？", "每个用户内部算 AUC 再按曝光数加权，用户和场景之间的差别不再虚高；随机集上两个区间总是重叠，要在同一批重采样用户上看差值的区间。", "ready", "GAUC 与配对 bootstrap"),
      n("ml/recsys/exposure-bias-random-eval", "曝光偏差与随机曝光评估", "推荐系统自己挑的曝光上评出来的分数，可信吗？", "日志里的曝光是线上策略挑过的；KuaiRand 把少量推荐位换成随机视频，点击率 0.174 对 0.377，LightGBM 的 GAUC 从 0.652 掉到 0.618，随机集才量到真实偏好。", "ready", "曝光偏差与随机评估"),
      n("ml/recsys/bias-decomposition-ips", "偏差来自哪里：视频池、选择与 IPS", "随机集上的落差从哪来，IPS 修得回来吗？", "只取 test 里随机池的视频，GAUC 就掉到随机集水平、校准仍是 1.05：排序落差来自视频池，校准落差来自选择；按视频流行度的 IPS 两个都修不了。26 个模型的排名 Spearman 0.731。", "ready", "偏差来源与 IPS"),
      n("ml/recsys/retrieval-precision-at-k", "检索的 P@30、Recall@30 与 group P@1", "检索出来的前 30 个里有几个是对的？", "P@30 是前 30 个结果里相关的比例，Recall@30 是前 30 个找回了全部相关的多少；MeMe 项目里 exact 匹配 0.23，semantic 检索 0.9344。", "ready", "P@30 / Recall@30"),
      n("ml/recsys/ctr-cvr-esmm", "CTR、CVR 与 ESMM", "点了之后会不会买，怎么预测？", "CTR = 点击 / 曝光，CVR = 转化 / 点击；CVR 只在点击样本上训练却要对全部曝光打分，ESMM 用 pCTR × pCVR 在曝光空间上一起学。", "ready"),
      n("ml/recsys/training-step", "一次训练：从一行曝光到一次参数更新", "深度排序模型是怎么一步步训练出来的？", "类别值编号、查 embedding 表、拼成 493 维 x0，前向出 4 个概率，交叉熵相加，反向时塔各管各、共享 bottom 收四份梯度、embedding 只更新被查到的行；每 1/4 epoch 在 valid 上挑一次权重。", "ready", "一次训练"),
      n("ml/recsys/feature-crossing", "特征交叉：FM 与 DCN", "两个特征的组合才有信号，模型怎么学到？", "线性模型只能把特征分开加；FM 给每个特征一个向量、用内积学二阶交叉，DCN 用 x₀·(x_lᵀw) + x_l 每层多一阶。", "ready", "特征交叉"),
      n("ml/recsys/id-embedding-one-epoch", "id embedding 的记忆与 one-epoch 现象", "把几十万个 id 也做成 embedding，有用吗？", "id 向量只对见过的 id 有用：test 里 video_id 只覆盖 11.5%；加 author_id / video_id 后第 2 个 epoch 的 valid AUC 从 0.804 掉到 0.781 / 0.764，所以只训 1 个 epoch 或按 valid 取最好权重。", "ready", "id embedding 与 one-epoch"),
      n("ml/recsys/din", "DIN：用候选视频去读用户行为序列", "用户看过的一万条历史，怎么按候选视频去读？", "小 MLP 从 [q, k, q − k, q ⊙ k, 反馈] 给每条历史打权重，不做 softmax 地加权求和成用户兴趣；序列存成事件数组加两个指针。KuaiRand 上 DIN 与均值打平、N = 10 最好，增益来自用户状态而非兴趣匹配。", "ready", "DIN"),
      n("ml/recsys/multi-task-ple", "多目标排序：shared-bottom、MMoE、PLE 与跷跷板", "点击、长播、点赞、关注，一个模型怎么一起预测？", "共享底座、每个任务一个头；KuaiRand 上点击和长播共享无损，点赞在三种结构上都显著变差（PLE −0.010 最少）；乘法融合 Σ w log p 用点击 −0.012 换点赞 +0.042。", "ready", "多目标与跷跷板"),
      n("ml/recsys/sample-feature-join", "样本与特征拼接", "label 晚到几小时，训练样本怎么拼？", "转化往往晚于曝光；要把曝光那一刻的特征快照和后到的转化事件在一个时间窗里 join，用转化时刻的特征就是数据穿越。", "ready"),
    ],
  },
  {
    id: "rl",
    title: "Reinforcement Learning",
    short: "RL",
    question: "不确定时先试哪个",
    section: "Reinforcement Learning",
    existing: true,
    nodes: [
      n("ml/reinforcement-learning/ucb", "Upper Confidence Bound", "不确定时先试哪个？", "用不确定性指导探索：从 UCB 的直觉与公式，到适应奖励变化的 Discounted UCB。", "ready"),
    ],
  },
];

// Cross-chapter prerequisites only; the chain inside a chapter is the node order above.
export const edges: TreeEdge[] = [
  { from: "ml/classifiers/softmax-cross-entropy", to: "ml/representations/word2vec", why: "Word2Vec 的输出层就是一个 softmax" },
  { from: "ml/classifiers/softmax-cross-entropy", to: "ml/llm-engineering/hallucination", why: "temperature 改的是 softmax 前的分数" },
  { from: "ml/classifiers/softmax-cross-entropy", to: "ml/multimodal/clip-contrastive-learning", why: "contrastive loss 是双向的 cross-entropy" },
  { from: "ml/training/gradient-descent-optimizers", to: "ml/classifiers/logistic-regression", why: "LR 的 w 是用 gradient descent 学出来的" },
  { from: "ml/training/gradient-descent-optimizers", to: "ml/trees/gbdt", why: "残差就是平方损失的负梯度" },
  { from: "ml/training/bias-variance", to: "ml/trees/ensembles", why: "bagging 降 variance，boosting 降 bias" },
  { from: "ml/trees/xgboost-lightgbm", to: "ml/recsys/lightgbm-explained", why: "推荐系统那一章用的就是 LightGBM" },
  { from: "ml/evaluation/roc-auc", to: "ml/recsys/lightgbm-explained", why: "那个模型用验证集 AUC 做早停" },
  { from: "ml/evaluation/roc-auc", to: "ml/recsys/boosting-lab", why: "实验台里看的也是 AUC" },
  { from: "ml/evaluation/roc-auc", to: "ml/recsys/gauc-paired-bootstrap", why: "GAUC 是按用户分组、再按曝光数加权的 AUC" },
  { from: "ml/evaluation/roc-auc", to: "ml/recsys/auc-gauc-computation", why: "排名公式算出来的就是那个配对概率" },
  { from: "ml/training/gradient-descent-optimizers", to: "ml/recsys/training-step", why: "每个 batch 那一步更新就是 Adam" },
  { from: "ml/classifiers/logistic-regression", to: "ml/recsys/training-step", why: "每个塔的损失就是逻辑回归的交叉熵" },
  { from: "ml/evaluation/ab-test-p-value", to: "ml/recsys/gauc-paired-bootstrap", why: "配对 bootstrap 问的也是「这个差是不是运气」" },
  { from: "ml/training/bias-variance", to: "ml/recsys/id-embedding-one-epoch", why: "第二个 epoch train loss 猛降、valid 变差，就是 variance" },
  { from: "ml/llms/attention-qkv", to: "ml/recsys/din", why: "target attention 是只有一个 query、不做 softmax 的 attention" },
  { from: "ml/representations/cosine-similarity", to: "ml/multimodal/vision-language-alignment", why: "图文对齐比的就是向量相似度" },
  { from: "ml/dl-blocks/normalization", to: "ml/llms/transformer-block", why: "Transformer 每一层都有 LayerNorm" },
  { from: "ml/dl-blocks/residual-connection", to: "ml/llms/transformer-block", why: "每个子层外面都套着 residual" },
  { from: "ml/llms/transformer-vs-rnn", to: "ml/multimodal/visual-tokens", why: "已有的「从 Transformer 到多模态」系列" },
  { from: "ml/llms/bert", to: "ml/representations/sentence-embedding", why: "句向量取的就是 BERT 的 [CLS] 或所有位置的平均" },
  { from: "ml/evaluation/pr-curve-precision-at-k", to: "ml/recsys/retrieval-precision-at-k", why: "P@k 用在真实的检索项目上" },
  { from: "ml/classifiers/softmax-cross-entropy", to: "ml/llms/pretraining-objectives", why: "预训练 loss 就是逐个位置的 cross-entropy" },
  { from: "ml/llms/decoding-strategies", to: "ml/llm-engineering/hallucination", why: "采样策略和 temperature 决定了多容易编" },
  { from: "ml/llms/attention-qkv", to: "ml/multimodal/vision-language-alignment", why: "图文对齐也是在 attention 里看别的 token" },
  { from: "ml/classifiers/softmax-cross-entropy", to: "ml/post-training/sft", why: "SFT 的 loss 就是只在回答 token 上的 cross-entropy" },
  { from: "ml/llms/pretraining-objectives", to: "ml/post-training/sft", why: "SFT 沿用预训练的下一词预测，只换数据和 mask" },
  { from: "ml/evaluation/ab-test-p-value", to: "ml/llm-engineering/llm-as-judge", why: "GSB 胜率也要问一句是不是运气" },
  { from: "ml/classifiers/logistic-regression", to: "ml/recsys/feature-crossing", why: "线性模型学不到组合，才需要特征交叉" },
  { from: "ml/ab-testing/hypothesis-testing", to: "ml/evaluation/ab-test-p-value", why: "两个比例的 z 检验就是这套假设检验的流程" },
  { from: "ml/ab-testing/central-limit-theorem", to: "ml/evaluation/t-test", why: "样本小、方差要估时，正态近似不够才换 t 分布" },
  { from: "ml/ab-testing/rejection-region", to: "ml/evaluation/ab-test-p-value", why: "power analysis 算样本量，用的就是 α 和 β" },
  { from: "ml/causal-inference/linear-regression", to: "ml/classifiers/logistic-regression", why: "logistic 回归是线性回归外面套一个 sigmoid" },
  { from: "ml/ab-testing/hypothesis-testing", to: "ml/causal-inference/difference-in-differences", why: "DiD 的系数也要配一个标准误和 p-value" },
  { from: "ml/llm-engineering/eval-harness", to: "ml/post-training/sft", why: "飞轮把过关的样本喂回 SFT" },
  { from: "ml/recsys/retrieval-precision-at-k", to: "ml/multimodal/multisticker-project", why: "Exact / Group Recall@K 就是那一页的指标" },
  { from: "ml/post-training/lora", to: "ml/multimodal/multisticker-project", why: "image / text / dual LoRA 用的就是这个低秩增量" },
  { from: "ml/llms/attention-qkv", to: "ml/multimodal/dae-fuse-project", why: "cross-attention 就是 Q 和 K / V 来自两种模态的 attention" },
  { from: "ml/dl-blocks/residual-connection", to: "ml/multimodal/dae-fuse-project", why: "高频分支 DHE 用的是 ResNet18" },
  { from: "ml/evaluation/pr-curve-precision-at-k", to: "ml/multimodal/dae-fuse-project", why: "检测实验报的是 PR 曲线下的 AP@50" },
];

export const nodeBySlug: Record<string, TreeNode & { chapter: TreeChapter }> = Object.fromEntries(
  chapters.flatMap((c) => c.nodes.map((node) => [node.slug, { ...node, chapter: c }])),
);

export function chapterById(id: string): TreeChapter | undefined {
  return chapters.find((c) => c.id === id);
}

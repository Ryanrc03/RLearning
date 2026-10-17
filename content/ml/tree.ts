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
      n("ml/llms/decoding-strategies", "Decoding：greedy、sampling、top-k、top-p、beam", "生成时怎么选下一个词？", "greedy 取最高，sampling 按概率抽，top-k / top-p 先截断再抽，beam search 多留几条路选总分最大的；temperature 把分布变尖或变平。", "ready", "Decoding"),
      n("ml/llms/bert", "BERT：双向编码器怎样读懂一句话", "这些零件拼成一个只读不写的模型，怎么训、怎么用？", "只有 encoder 的 Transformer：遮住 15% 的词再猜回来做预训练，再接一个小头全参数微调去做分类；读得懂整句，但不会生成。", "ready", "BERT"),
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
      n("ml/recsys/kuairand-input", "一条曝光的 84 维输入", "排序模型看到什么？", "KuaiRand-1K 的曝光日志怎样变成排序模型的输入：数据流、一条真实样本的 84 个特征、只看过去的时间窗统计。", "ready"),
      n("ml/recsys/lightgbm-explained", "梯度提升树如何给曝光打分", "树怎么给曝光打分？", "以真实训练的 LightGBM click 模型为例：目标函数与梯度、一轮迭代、直方图与 leaf-wise、一条样本的 407 步轨迹。", "ready"),
      n("ml/recsys/boosting-lab", "提升树训练实验台", "一轮一棵树怎么长？", "16 个点、一个特征，按一轮长一棵树：看残差被压小、LogLoss 下降、森林长出；GBDT / XGBoost / LightGBM 的差别做成开关。", "ready"),
      n("ml/recsys/retrieval-precision-at-k", "检索的 P@30、Recall@30 与 group P@1", "检索出来的前 30 个里有几个是对的？", "P@30 是前 30 个结果里相关的比例，Recall@30 是前 30 个找回了全部相关的多少；MeMe 项目里 exact 匹配 0.23，semantic 检索 0.9344。", "ready", "P@30 / Recall@30"),
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
  { from: "ml/representations/cosine-similarity", to: "ml/multimodal/vision-language-alignment", why: "图文对齐比的就是向量相似度" },
  { from: "ml/dl-blocks/normalization", to: "ml/llms/transformer-block", why: "Transformer 每一层都有 LayerNorm" },
  { from: "ml/dl-blocks/residual-connection", to: "ml/llms/transformer-block", why: "每个子层外面都套着 residual" },
  { from: "ml/llms/transformer-vs-rnn", to: "ml/multimodal/visual-tokens", why: "已有的「从 Transformer 到多模态」系列" },
  { from: "ml/llms/bert", to: "ml/representations/sentence-embedding", why: "句向量取的就是 BERT 的 [CLS] 或所有位置的平均" },
  { from: "ml/evaluation/pr-curve-precision-at-k", to: "ml/recsys/retrieval-precision-at-k", why: "P@k 用在真实的检索项目上" },
  { from: "ml/classifiers/softmax-cross-entropy", to: "ml/llms/pretraining-objectives", why: "预训练 loss 就是逐个位置的 cross-entropy" },
  { from: "ml/llms/decoding-strategies", to: "ml/llm-engineering/hallucination", why: "采样策略和 temperature 决定了多容易编" },
  { from: "ml/llms/attention-qkv", to: "ml/multimodal/vision-language-alignment", why: "图文对齐也是在 attention 里看别的 token" },
];

export const nodeBySlug: Record<string, TreeNode & { chapter: TreeChapter }> = Object.fromEntries(
  chapters.flatMap((c) => c.nodes.map((node) => [node.slug, { ...node, chapter: c }])),
);

export function chapterById(id: string): TreeChapter | undefined {
  return chapters.find((c) => c.id === id);
}

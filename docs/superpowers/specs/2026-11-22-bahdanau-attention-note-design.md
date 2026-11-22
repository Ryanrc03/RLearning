# Attention (I)：从 Seq2Seq 到 Bahdanau Attention — note design

已按交接文档确定并实施。范围只到 Bahdanau / Additive Attention；不含 Self-Attention、Transformer、Multi-Head、Causal Mask、Scaled Dot-Product、Q/K/V。不加 Quiz。

- 路由：`/notes/ml/llms/seq2seq-bahdanau-attention/`，LLMs 章节第 2 个节点（RNN 之后、Transformer vs RNN 之前）。
- 正文：`content/ml/llms/seq2seq-bahdanau-attention.mdx`，八节中文标题，每节先一句话直觉，再公式，再图。
- 符号：`j` 是目标位置、`i` 是源位置（与论文相反，正文有说明）；正文和图一律用论文时序 `s_{j-1} → c_j → s_j`，课堂的 `s_j` 时序只出现在一条提示里。
- 数字：`lib/ml/bahdanau.ts`（测试 `tests/bahdanau.test.ts`）。`[0, 0, 2, 0]` 的 softmax 是算出来的；图 3 的两组权重是交接文档给的示意值，分数取 softmax 后等于它们的那一组。

| 图 | 组件（`components/visualization/ml/llms/bahdanau/`） | 所在小节 | 画什么 | 交互 |
| --- | --- | --- | --- | --- |
| G1 | `Seq2SeqBottleneckFigure` | 传统 Seq2Seq | Encoder 链产生 h₁…h₄，只有 h₄ 进 Decoder | Encoder 读入 / 瓶颈在哪 / 重置 |
| G2 | `AttentionThreeStepsFigure` | 三步 | sⱼ₋₁ 与全部 hᵢ → 打分 → softmax → Σ → cⱼ → Decoder，带 [0,0,2,0] 的数值柱 | 全部 / ① / ② / ③ |
| G3 | `SharedParamsFigure` | 共享参数 | 同一个 θₐ 穿过四个打分模块；查询、分数、权重、context 随 step 变 | Step A / Step B |
| G4 | `TwoStepDecodeFigure` | 两个 time step | s₀ → c₁ → s₁ → c₂ → s₂，两次 Attention 读同一组 H | 第 1 步 / 第 2 步 / 重置 |
| G5 | `TrainVsInferenceFigure` | 训练与反传 | 左：前向与梯度路径回到 θₐ；右：θₐ 固定，两步各自现算 α | 训练一步 / 推理两步 / 重置 |

颜色按含义：蓝 Encoder，橙 Decoder，绿共享的可训练参数，黄每步现算的 e / α / c，灰色虚线只在训练时存在。颜色是 `.bah-note` 下的 CSS 变量（`styles/visualization.css`），随系统深色偏好切换。

## 第二章：Attention (II)：RNN 中的 Self-Attention

已按第二份交接文档确定并实施。范围只到 SimpleRNN + Self-Attention（课堂简化版）；不含 Transformer、Multi-Head、Scaled Dot-Product、Causal Mask、Positional Encoding、Q/K/V 体系。不加 Quiz。

- 路由：`/notes/ml/llms/rnn-self-attention/`，LLMs 章节第 3 个节点，接在第一章之后。
- 正文：`content/ml/llms/rnn-self-attention.mdx`，九节。主线公式 `h_t = tanh(A[x_t; c_{t-1}] + b)`、`c_t = Σ_{i≤t} α_{t,i} h_i`；投影点积打分只放在折叠的可选补充里。
- 论文边界：Cheng, Dong & Lapata 2016 的 LSTMN 基于 LSTM，称 intra-attention；正文开头和第三节末尾各说明一次课堂简化与论文的差别。
- 数字：`lib/ml/rnnSelfAttention.ts`（测试 `tests/rnn-self-attention.test.ts`）。`[1.2, 0.4]` 的 softmax 是算出来的；逐词权重是交接文档给的模拟值，测试校验每组长度为 t − 1、和为 1。

| 图 | 组件（`components/visualization/ml/llms/rnn-self-attention/`） | 画什么 | 交互 |
| --- | --- | --- | --- |
| G1 | `RnnVsAttentionRnnFigure` | 普通 RNN 的 h₃ 接 h₂；加 Attention 后 h₃ 接 c₂ | 两个聚焦按钮 / 重置 |
| G2 | `UnrolledSelfAttentionFigure` | c₀ → h₁ → c₁ → h₂ → c₂ → h₃，无 h₃ → c₂ 回边 | 全部 / Step 1–3 |
| G3 | `ScoreSoftmaxContextFigure` | h₁、h₂ → align → 1.2 / 0.4 → softmax → c₂ → h₃ | 全部 / ① / ② / ③ |
| G4 | `SharedAlignParamsFigure` | 同一个 θ_att，算 c₃ 与算 c₄ 两步的分数和权重 | Step A / Step B |
| G5 | `SentenceHistoryFigure` | The FBI is chasing a criminal，当前词、已读、未读与历史权重 | t = 3 … 6 |
| G6 | `BahdanauVsSelfFigure` | 跨序列与同一序列的接线 | 两个聚焦按钮 / 重置 |
| G7 | `HistoryTriangleFigure` | 下三角：每步打分的历史位置，共 n(n−1)/2 个 | 静态 |

颜色和主题沿用第一章的 `.bah-note` 令牌与 `bahdanau/shared.tsx`。

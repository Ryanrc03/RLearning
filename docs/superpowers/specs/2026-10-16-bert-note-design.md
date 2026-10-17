# BERT 笔记 — 设计文档

日期：2026-10-16　状态：已按自治模式确定并实施

## 目标

一篇讲 BERT 的笔记：模型架构、损失函数、训练方法、一个做分类的完整例子，最后和 GPT 对比。读者是作者本人与想弄清"编码器预训练 + 微调"这条路的工程师；按站点的内容哲学回答"是什么 / 为什么存在 / 怎样运作 / 代价是什么 / 和什么相连"。

## 范围

- 一篇 MDX，`content/ml/llms/bert.mdx`，slug `ml/llms/bert`。它是 ML 知识树（`content/ml/tree.ts`）LLMs 章节的第 8 个节点，series `ml-llms` 第 8 位，接在 Decoding 之后，作为把前面零件拼成完整模型的收尾长文。最初写在独立的 Transformers 小节，合并 main 的知识树后挪入。
- 六个 React 可视化，放在 `components/visualization/ml/llms/bert/`，复用 `VisualizationFrame` 与 `styles/visualization.css`，不加新样式文件。三个是静态 SVG 结构图（两个动作按钮加重置，按钮只聚焦和变暗，默认按含义着色，配图例和 `viz-narr`），三个是交互模拟。
- 事实以 Devlin et al. (2018) 原文为准（已用 ar5iv 全文核对：模型尺寸、15% 与 80/10/10、NSP 50/50、预训练与微调超参、GLUE Table 1 的 SST-2 与平均分）。
- 公式用 KaTeX（`$$` 与行内 `$`）；示意性的流程、输入排布画成 SVG 图或表格，不用文字草图。
- 不做：暗色模式、iframe lab 页。

## 可视化

| 组件 | 放在哪一节 | 它让读者看到什么 |
| --- | --- | --- |
| `PretrainFinetuneFlow` | What is it? | 左预训练（蓝）、右微调（橙），中间同一个编码器（绿）；两个按钮各走一步，看数据从哪来、损失在哪算、哪些参数更新 |
| `BertInputEmbeddingViz` | 架构 › 输入 | 11 列 token，token（黄）/ 段落（蓝 A、橙 B）/ 位置（绿）三张查表逐位相加成输入向量；两个按钮各高亮一列（A 句的 dog、B 句的 ##ing） |
| `BertEncoderStackViz` | 架构 › 编码器层 | 左边 L 层叠起来与顶层的三种头，右边一层打开（注意力蓝 → Add&LN 绿 → FFN 橙 → Add&LN 绿，残差绿，张量黄）；两个按钮分别聚焦一层内部与输出头 |
| `MaskedLmViz` | 损失函数 › MLM | 28 个词的 A+B 序列，每次采样选 15% 的位置并按 80/10/10 腐蚀；损失只在这些位置算；选一个位置拖动 p(目标) 看 −log p；累计多次采样看比例收敛；句子 B 切换真 / 随机，给出 NSP 标签与 L = L_MLM + L_NSP |
| `ClsFineTuneViz` | 分类例子 | 三条影评任选，五步走完 `[1,T]` → `[1,T,768]` → `[1,768]` → `[1,2]` → 标量损失，步骤卡的颜色条与架构图一致；"微调前 / 微调后"切换看头从随机到有判别力；参数面板显示新参数只有 1,538 个，但全部 1.09 亿个都在更新 |
| `BertVsGptAttentionViz` | BERT vs GPT | 同一句 10 个词，点一个位置：左边 BERT 遮住它、用两侧全部词预测它，右边 GPT 只看左边、预测下一个词；下方两个 10×10 注意力掩码矩阵（全满 vs 下三角）；每个序列有损失的位置数对比 |

数字约定：可视化里的概率是示意值，在 footnote 里写明；正文里的尺寸、超参、GLUE 分数都来自论文；参数量是 `bert-base-uncased` 的实数。

## 架构

- 内容：MDX 直接 import 六个客户端组件。
- 注册：`content/notes.ts` 一条（section `LLMs`、series `ml-llms` order 8，放在 Decoding 条目之后）；`content/ml/tree.ts` 在 LLMs 章节末尾加节点，并把指向 Sentence Embedding 的那条边改为从 BERT 出发；`app/notes/[...slug]/page.tsx` 加 import 与映射。
- 章节衔接：LLMs 概览页改为八页并补一句第 8 页；Decoding 页的"再往下看"指向 BERT；预训练目标页补一句链到 BERT。BERT 正文链回 Attention、Transformer Block、预训练目标、Decoding、Sentence Embedding。
- 组件约定：`"use client"`；无外部依赖；状态在组件内；随机采样用带种子的 mulberry32，首屏确定，避免 hydration 不一致；SVG 用 viewBox，marker id 按组件加前缀；颜色按含义（见 `writing-model-note` skill 的颜色表）。
- 可访问性：按钮有可见文字；SVG 有 `role="img"` 与 `aria-label`。

## 测试

`npm test`（含知识树与注册表一致性）、`npm run typecheck`、`npm run lint`、`npm run build` 全过；本地预览在桌面与手机宽度下无横向溢出，六个可视化的控件可点，LLMs 概览页的树里出现 BERT 节点。

## 实施顺序

1. 六个可视化组件。
2. MDX 与注册。
3. 合并 main 的知识树后挪入 LLMs 章节。
4. 构建、预览、修正。

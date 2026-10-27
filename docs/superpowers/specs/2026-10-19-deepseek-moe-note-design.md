# DeepSeekMoE model note — figure plan

Page: `content/ml/llms/deepseek-moe.mdx`, the LLMs tree node after pretraining objectives. Primary source: [Dai et al., ACL 2024](https://aclanthology.org/2024.acl-long.70/). Model facts use the 16B configuration in sections 5 and A.2; all small scores and expert outputs are explicitly labeled teaching values.

Reader path: locate the MoE layer in the complete model → zoom into one token's shared and routed FFNs → walk a two-token training batch from routing to cross-entropy, load balance, gradients, and one parameter update. The same two toy tokens appear in the last two figures.

| Component | Section | What it shows |
| --- | --- | --- |
| `DeepSeekMoEEndToEnd` | Architecture | End-to-end 16B Transformer: tokens → embedding → first dense block → 27 attention-plus-MoE blocks → LM head → next-token loss, with an expert-balance branch from routers and a dashed backpropagation path to all trainable stages. A zoomed MoE FFN shows 2 shared and top-6 of 64 routed experts. Two focus buttons emphasize forward computation or backward updates. |
| `DeepSeekMoEArchitecture` | Architecture | A paper-style, three-panel drawn SVG follows Figure 1's structural comparison: conventional top-2 of 4 large experts → top-4 of 8 half-size experts → one shared plus top-3 of 7 routed half-size experts. A strip above places MoE at the Transformer FFN position; the caption maps the toy topology to the real 16B arrangement (first layer dense, remaining 27 MoE, 2 shared + 64 routed, top-6). Focus buttons emphasize fine-grained and shared expert changes. |
| `DeepSeekMoEFigure` | Architecture | One toy token passes a router, a shared expert, and top-2 of 4 routed experts. Scores, gates, expert outputs and the sum are calculated. Two token choices use the same fixtures as the training walk-through. |
| `DeepSeekMoETraining` | Loss functions / worked example | Step through two tokens: route → weighted outputs → three-class next-token cross-entropy → expert-level auxiliary loss → backwards gradients → one SGD demonstration update. The paper uses AdamW; SGD is explicitly a teaching simplification. |

Paper facts and toy numbers never share an unlabeled table. The training calculation uses a three-class toy vocabulary with the MoE output added to one class logit chosen by the toy head independently of the target label; in the shown batch its prediction happens to match the target. This keeps the softmax and gradient hand-computable without implying that a real LM head sees the label. The auxiliary loss updates the router, while the displayed expert-output gradient comes from language-model loss.

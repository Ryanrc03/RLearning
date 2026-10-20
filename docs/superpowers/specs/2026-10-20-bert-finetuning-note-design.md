# BERT fine-tuning note (MacBERT, three classes)

Long node 10 of the LLMs chapter, after BERT vs MacBERT. It walks one task end to end:
pretrained `hfl/chinese-macbert-base` fine-tuned to classify 「国补」 reviews as 负面 / 中性 / 正面.
Numbers and pure functions live in `lib/ml/finetune.ts` (tests in `tests/finetune.test.ts`).

| Component | Section | What it shows |
| --- | --- | --- |
| `FinetunePipelineFigure` | What is it? | Static pipeline: batch → tokenizer → encoder → [CLS] pooler → new Linear(768, 3) → softmax; training-only row (labels, CE, backward). Buttons focus 「哪些是新的」 and 「哪些只在训练时」. |
| `TokenizeBatchFigure` | Step 2 | Step player: three reviews → characters → [CLS]/[SEP] → truncation at max_len 20 → dynamic padding + attention_mask → ids and labels. Special-token ids are real; character ids are 示意. |
| `HeadLossFigure` | Step 4 | One review at three training moments: 示意 logits, computed softmax, −log p_y, gradient p − y, batch loss vs ln 3. |
| `TrainingRunFigure` | Step 5 | Animated toy run (seeded): 2-D stand-in for [CLS] with the head's decision regions, warmup + linear-decay lr, train/val loss, val accuracy. Preset: 2e-5 vs 1e-4 (features wash out). The head is trained by real softmax-CE gradients; the encoder's effect is a stylised drift. |
| `ConfusionMatrixFigure` | Step 6 | 示意 3 × 3 confusion matrix on 600 dev sentences; pick a class to read precision (column) and recall (row); accuracy vs weighted-F1 vs macro-F1. |

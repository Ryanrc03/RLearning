# GRPO on a 3060: KL node and project note (design)

Date: 2026-10-26. Two pages appended to the Post-training chain after Reward Hacking:

- `ml/post-training/kl-divergence` (node 6, five-section concept page)
- `ml/post-training/grpo-3060-project` (node 7, long project / handoff page)

Source: the Chasing-the-Aha-Moment runs (branch `claude/project-refactor-model-selection-5f49e3`):
Qwen2.5-3B-Instruct, 4-bit + LoRA r32, GRPO on GSM8K, RTX 3060 under WSL2. Every number in the
figures comes from `lib/ml/grpo3060Data.ts`, exported from the run directories; derived values are
computed in `lib/ml/grpo3060.ts` and `lib/ml/klDivergence.ts` and pinned in `tests/grpo3060.test.ts`
and `tests/kl-divergence.test.ts`.

## Figures

| Component | Page / section | What it shows | Controls |
| --- | --- | --- | --- |
| `KlDivergenceFigure` | KL node, 怎么工作 | Completion-length distribution (8 buckets, 1,319 GSM8K answers) of a trained model over the untouched model's, and the per-bucket terms p·ln(p/q) that sum to the KL | model tabs (primary); KL direction chips; reset |
| `G3ResultsFigure` | project, 摘要 | Five models × three eval sets as bars | dataset tabs (primary); metric chips; reset |
| `G3TrainingCurves` | project, 3 | Real training logs per 10 steps: correctness vs summed format reward vs total, answer length, per-token KL; other run faint | step slider (primary); run tabs; reset |
| `G3CheckpointSweep` | project, 4 | Every checkpoint re-evaluated on 300 test problems, accuracy and length vs step, Instruct / SFT reference lines | focus buttons 看第一轮 / 看修正版 / 重置 |
| `G3SampleCompare` | project, 4 | Four test problems, five models' verbatim outputs with verdict and token count | problem tabs; reset |

Colors: grey untouched, green SFT, orange the run that got hacked (light orange at its step-200
peak), blue the fixed run; inside the training-curve panels blue = correctness, orange = format,
green = length, dark yellow = KL (`grpo3060/colors.ts`).

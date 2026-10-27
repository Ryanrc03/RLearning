# Embedding training walkthrough implementation plan

> Execute inline with superpowers:executing-plans. The user approved the design; continue through verification.

**Goal:** Show embedding in the full ranking network and compute one transparent training update.
**Architecture:** Keep TrainingSetupFigure as the state owner; add a persistent SVG overview and a stage-driven numerical example backed by pure functions.
**Tech stack:** React, TypeScript, SVG, existing seeded RNG and visualization primitives.
**Spec:** docs/superpowers/specs/2026-10-27-embedding-training-walkthrough-design.md

## Constraints and review focus

- Preserve static export, existing eight-step UI and five-section article.
- Distinguish the toy model from actual checkpoint observations.
- Verify embedding and head gradients with finite differences.
- Verify untouched rows for first-step Adam with zero state and no weight decay.
- Ensure deterministic initialization, reset, finite values and readable mobile SVG scrolling.

## Task 1: Computed example

- [x] Add tests in tests/embedding-training.test.ts for deterministic 4×2 initialization, lookup, forward, all analytic gradients, first-step Adam correction, unchanged unselected rows and lower updated loss.
- [x] Run focused tests and observe missing-module failure.
- [x] Implement lib/ml/embeddingTraining.ts with createEmbeddingExample(), embeddingForward(model), embeddingGradients(model) and embeddingUpdate(model).
- [x] Run focused tests until green.

## Task 2: Visualization and article

- [x] Add TrainingNetworkOverview.tsx with meaningful colors, embedding lookup detail, real model dimensions, four output heads and backward path; highlight current stage.
- [x] Add EmbeddingUpdateExample.tsx using the existing step value: initialization, lookup, concatenation, prediction, loss, gradient, first-step Adam, repeated forward.
- [x] Integrate both in TrainingSetupFigure.tsx; retain existing real-data panels and primary control.
- [x] Update training-step.mdx and registry description to explain the toy computation and Adam caveat.

## Task 3: Verification

- [x] Run full tests, typecheck, source lint and static build sequentially.
- [x] Inspect desktop and mobile page and all stages, including reduced-motion/reset behavior.
- [x] Review final diff for numerical and explanatory consistency and report results with preview link.

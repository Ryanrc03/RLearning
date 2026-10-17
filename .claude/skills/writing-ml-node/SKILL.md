---
name: writing-ml-node
description: Use when adding or editing a page under ML & LLM (content/ml/), when the owner mentions 知识树 / 节点 / 这一章, or asks for a concept page that explains what a thing is, why it exists, how it works and its trade-offs with one computed, interactive figure.
---

# Writing an ML knowledge-tree node

## Overview

ML & LLM notes are a **knowledge tree** (`content/ml/tree.ts`): a chapter is a row, a page is a node, and nodes inside a chapter form a question chain (each page answers the question the previous page left behind). Pages explain a concept; they are not X vs Y pages. Comparison appears only when the concept genuinely has two routes (L1 / L2, CBOW / Skip-gram).

Reference page: `content/ml/evaluation/precision-recall-f1.mdx` with `components/visualization/ml/evaluation/PrecisionRecallFigure.tsx`. Design spec: `docs/superpowers/specs/2026-10-16-ml-knowledge-tree-design.md`.

## The page contract

The MDX file is exactly these five sections, in this order:

| Part | Heading | What it is | Budget |
| --- | --- | --- | --- |
| 1 | `## 一句话` | One bold sentence defining the concept, then at most two plain sentences on where it is used | bold ≤ 80 字 |
| 2 | `## 为什么需要它` | Pick up the question the previous node left; what goes wrong without this concept. Use the example from the owner's notes when there is one | 2–4 sentences |
| 3 | `## 怎么工作` | The figure first, then the formulas (≤ 3, KaTeX `$$`), then 2–4 short paragraphs explaining what the figure shows | longest section |
| 4 | `## 代价与取舍` | 3–5 bullets: when not to use it, common traps, trade-offs against neighbouring nodes | list or ≤ 3-row table |
| 5 | `## 再往下看` | Lead into the next node of the chain in one sentence; add cross-chapter prerequisites or exits when the tree has an edge | ≤ 3 sentences |

- Title is the concept itself (`# ROC 与 AUC`, `# GBDT`), never `X vs Y`. Technical terms stay English with a space between CJK and Latin text.
- 500–800 字 of prose. No code blocks. One main figure; a second, static structure figure only when the main figure cannot carry it.
- Whole page is readable in 5–7 minutes.

## The figure contract

One client component in `components/visualization/ml/<chapter>/<Concept>Figure.tsx`, wrapped in `VisualizationFrame`, styled only with classes from `styles/visualization.css`. Four hard rules:

1. **Every number is computed.** Metrics, curves, trajectories, p-values come from pure functions in `lib/ml/` with unit tests in `tests/`. Randomness goes through `lib/ml/random.ts` with a fixed seed so a reload draws the same picture.
2. **One primary control plus reset.** A slider, a step player, a toggle group, or a draggable point. One auxiliary preset (tabs or chips) is allowed when it sets up a second scenario, e.g. "990 dogs, 10 cats".
3. **Shared primitives and sizes.** Use `components/visualization/ml/primitives/` (`Figure`, `Plot`, `Curve`, `Marker`, `Bars`, `Slider`, `ConfusionGrid`; add new ones there, not inside a figure). SVG viewBox around 720 × 360 (or 420 wide beside a panel), text 11–13 px, colours only from the `--v1…--v4`, `--vgood`, `--vwarn`, `--vcrit` tokens. State changes use CSS transitions; `usePrefersReducedMotion` turns off autoplay.
4. **SVG for geometry, HTML for tables and text.** Curves, vectors, trees, networks are SVG; matrices, probability bars, prompt layers are HTML grids and cards.

Under the figure, one `viz-narr` sentence or two that changes with the state and says what the reader is looking at right now. Use `is-warn` / `is-bad` / `is-good` tones.

## Registration checklist

1. `content/ml/<chapter>/<slug>.mdx` and the figure component.
2. `content/ml/tree.ts`: the node already exists as `planned`; flip it to `ready`. New chapters add a chapter object and, when needed, an edge with a one-line `why`.
3. `content/notes.ts`: entry with `categoryId: "ml"`, the chapter's `section`, `status: "seed"`, `readingMinutes` 4–7, tags including `"ml-fundamentals"` and the chapter name, and `series: { id: "ml-<chapter>", title: "<Chapter>：<question>", order: n }` matching the chain order. Keep ML entries grouped in tree order.
4. `app/notes/[...slug]/page.tsx`: import + `noteComponents` entry. Navigation derives from the registry.
5. `npm test && npm run typecheck && npm run lint && npm run build`, then open the page with the `dev` launch config, drag the control end to end, check the narr at every state, and confirm no NaN appears.

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Page becomes `X vs Y` with left/right halves | Explain the concept; compare only inside 代价与取舍 |
| Numbers typed into the figure | Move the computation into `lib/ml/` and test it with the numbers from the owner's notes |
| Two or three controls competing | Keep one primary control; demote the rest to presets or delete them |
| 9 px labels, 600 px cramped SVG | Use the primitives and the 720 × 360 baseline |
| "再往下看" links a page that is still `planned` | Say it is not written yet and link the tree page `/notes/ml/overview/` instead |

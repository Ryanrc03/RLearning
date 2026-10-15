---
name: writing-fundamentals-note
description: Use when adding a beginner-level note on a new CS concept to RLearning's CS Fundamentals section, or when the owner says 小白、快速理解、一句话讲明白, or asks to compare two terms (X vs Y).
---

# Writing a CS Fundamentals note

## Overview

A fundamentals note is the shortest page that makes a beginner get one concept. It is a **three-part page**, not a condensed article. Depth belongs in a separate long note that this page links to at the end.

Reference page: `content/cs/fundamentals/process-vs-thread.mdx` with `components/visualization/os/ProcessVsThreadDiagram.tsx`. Match its shape.

## The page contract

The MDX file is exactly these parts, in this order, and nothing else:

| Part | Heading | What it is | Budget |
| --- | --- | --- | --- |
| 1 | `## 一句话` | One bold sentence defining the concept (for X vs Y: both halves in the same sentence). Then at most two plain sentences on when you want one or the other. | ≤ 80 字 bold, ≤ 2 sentences after |
| 2 | `## 一张图` | The visualization component, then a 2-row table stating the only rules the figure demonstrates, then one sentence naming the trade (e.g. 安全 vs 方便). | table ≤ 3 rows |
| 3 | `## 一个真实的例子：<名字>` | One product the reader has used (Chrome, 微信, 外卖 app). Map each concept to a concrete thing in it, then one sentence mapping back to the definition. | ≤ 5 sentences |
| 4 | `## 再往下看` | One link for depth. If a long note on this concept exists under `content/`, link it; if none exists, link the closest related note and keep this page self-contained. | 1 sentence |

- Title: English technical terms, e.g. `# Process vs Thread`, `# Mutex vs Semaphore`.
- The concept terms stay in English throughout the body (`process`, `thread`), with a space between a CJK character and the term. Everything else is Chinese.
- Whole file under 450 字 of prose. No code blocks, no 代价/坑/trade-off section, no second example, no history.

## The figure contract

One client component in `components/visualization/os/` (or the matching area), wrapped in `VisualizationFrame`, styled only with classes from `styles/visualization.css`.

- Static side-by-side SVG: left = concept A, right = concept B, same actors on both sides (工人 1 号 / 2 号).
- Two action buttons plus 重置. Each button is one event (改一个变量, 一个崩溃) that plays out differently on the two sides.
- One `viz-narr` sentence per state explaining what changed on each side. Use `is-warn` / `is-bad` tones.
- Wrap the SVG in `div.viz-scroll`. No sliders, no per-actor controls, no modes, no timers.

## Registration checklist

1. `content/cs/fundamentals/<slug>.mdx`
2. `content/notes.ts`: entry with `categoryId: "cs"`, `section: "CS Fundamentals"`, `readingMinutes` 3–5, tags include `"fundamentals"`.
3. `app/notes/[...slug]/page.tsx`: import + `noteComponents` entry. Navigation derives from the registry; do not edit `navigation.ts`.
4. `npm run typecheck && npm run lint && npm run build`, then open the page with the `dev` launch config and click every button.

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Page grows to 6+ sections | Cut to the four headings above; move depth to the long note |
| Two or three examples | Keep the one the reader has touched most |
| Figure has modes, selects, sliders | Two buttons; the comparison is the two sides, not the controls |
| Terms translated to Chinese | Keep `process`/`thread`-style English terms |

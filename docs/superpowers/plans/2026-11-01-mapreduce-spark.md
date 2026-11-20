# MapReduce & Spark Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** One interactive MapReduce/Spark note following GROUP BY.
**Architecture:** Reuse shared click data and local MDX/React figures, pure calculation/state engines and scoped CSS. Work in current feature checkout; preserve all GROUP BY changes.
**Tech Stack:** Next static export, React, TypeScript, MDX, CSS/SVG, node:test.
**Spec:** docs/superpowers/specs/2026-11-01-mapreduce-spark-design.md (approved direction on continuation).

## Constraints
Only this new article; no dependencies, real cluster, server runtime, unrelated edits, automatic commits/push/deploy. Existing site shell stays light; figures support system dark preference. All display calculations are educational models with assumptions.

## Review Focus
Conservation across split/combine/shuffle/reduce; weighted AVG; salting collisions and unsalting; failure attempts versus external effects; responsive arrows, keyboard controls and theme contrast.

### Task 1: Engine and states
Files: lib/systems/sql/mapReduce.ts, tests/mapreduce-spark.test.ts.
Interfaces: buildPipeline() returns split/map/combined/routed/reduced; combineCost(rows,keys,enabled); taskWaves(partitions,slots); skewModel(hot,salts,twoStage); executionStep(state,event); writeResult(idempotent,attempts).
- [x] Write failing tests for exact partitions, partials, converging A01 route, final five counts, conservation, combine bounds, waves, eight salts over four reducers, unsalting and state reset/recovery.
- [x] Run targeted tests, verify missing-module failure, implement and rerun to green.

### Task 2: Local interactive figures
Files: components/visualization/systems/sql/spark/{SparkViews,MapReducePipeline,AggregationCost,SparkArchitecture,SparkDAG,SparkPlan,SparkRuntime,ShuffleSkew}.tsx; styles/spark.css.
Interfaces: import Task 1 engine; export named figures embedded directly by MDX. Native controls, scoped frame tokens, buttons expose selection; SVG flow edges have text equivalents.
- [x] Implement five-step pipeline with actual rows and routing arrows, cost experiment and weighted average.
- [x] Implement selectable architecture plus waves, narrow/wide SVG and clickable stages/operators with toy I/O.
- [x] Implement lazy-action and failure recovery states, sink retry comparison, skew bars.
- [x] Add scoped SQL/Python highlighter for this article. Reuse frame primitives without modifying GROUP BY.

### Task 3: Article and integration
Files: content/systems/sql-db-basics/mapreduce-spark.mdx; content/{notes,noteComponents}.ts; components/layout/RootDocument.tsx; tests/sql-navigation.test.ts.
- [x] Update navigation test to expect exactly two intended SQL notes and observe failure before registration.
- [x] Write nine sections + interview questions , supporting official links, complete APIs, batch control/data-flow distinction and streaming comparison.
- [x] Register note and style import; rerun tests to green.

### Task 4: Acceptance
- [x] Run npm test, lint, typecheck, build and diff check; all exit 0.
- [x] Browser-test pipeline steps/reset, stage/node/plan selection, slots, combine, action/recovery/sink, salts/second stage and search.
- [x] Check mobile overflow and keyboard, dark-media styles, browser logs, preserve screenshot.
- [x] Request independent read-only code review, fix important findings, record verification. Keep local work uncommitted.

## Verification record

- Engine tests first failed because the module did not yet exist, then passed. Navigation test first failed with only GROUP BY registered, then passed with the two intended notes.
- Full suite: `npm test` → 545 passed, zero failed. `npm run typecheck` → exit 0. Final `npm run lint` → exit 0, zero warnings. Final `npm run build` → exit 0; both GROUP BY and MapReduce/Spark statically exported. `git diff --check` → exit 0.
- Browser used the exported `out/` site on port 3100. Checked all five pipeline steps, Previous/Reset; logical combine records 1M→1K and 1K→10; four slot configurations give 50/25/10/5 waves; six architecture roles; DAG nodes and both stages; nine wide edges; all physical-plan operators.
- Runtime browser check: planned→map→reduce→failed→retry→reduce→lost→recompute→reduce→done. Sink replay gives 2000 for additive writes and 1000 for stable-key replacement. Both reset controls checked.
- Salts 1/2/4/8 conserve 100,003,000 raw-equivalent work across exactly four reducers. Eight salts do not produce more partitions. Two-stage disabled exposes salted intermediate keys; enabled restores per-ad totals. Normal mode conserved 4,000,000.
- Mobile 390×844: page scrollWidth 390, all 13 figures have width/scrollWidth 350. Radio ArrowRight changes the combine calculation correctly. Desktop and mobile screenshots saved outside the repo.
- Separate temporary QA server forces the CSS dark-media branches without altering product files or OS settings. Dark counter text rgb(238,234,245) on rgb(27,26,32); figures visually checked. Site chrome stays light as approved.
- Independent read-only review: no important findings. Removed one unused import flagged by lint before the final build.
- All changes kept locally with the prior GROUP BY work on codex/sql-group-by; no commit, push or deployment.

## File manifest for this note

- New article: `content/systems/sql-db-basics/mapreduce-spark.mdx`.
- New engine: `lib/systems/sql/mapReduce.ts`.
- New figures and local primitives: `components/visualization/systems/sql/spark/` (pipeline, combine cost, architecture, DAG, physical plan, runtime/sink, skew, flow diagrams, highlighted examples and shared views).
- New style: `styles/spark.css`; new test: `tests/mapreduce-spark.test.ts`.
- Modified integration: `content/notes.ts`, `content/noteComponents.ts`, `components/layout/RootDocument.tsx`, `tests/sql-navigation.test.ts`.
- Design and plan: `docs/superpowers/specs/2026-11-01-mapreduce-spark-design.md` and this file.

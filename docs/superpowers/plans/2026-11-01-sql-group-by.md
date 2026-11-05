# SQL GROUP BY Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add one interactive Chinese GROUP BY note under Systems / System Design / SQL & DB Basics.
**Architecture:** MDX content plus local React figures, pure TypeScript engine, optional subsection metadata. Reuse the current checkout on a feature branch.
**Tech Stack:** Next.js static export, React, TypeScript, MDX, CSS, node:test.
**Spec:** docs/superpowers/specs/2026-11-01-sql-group-by-design.md

## Global Constraints
No new dependencies, runtime server, unrelated articles, global redesign, automatic commits or deployment. Preserve existing notes and navigation. Dataset matches the handoff; assessment requirements are removed by the user update.

## Review Focus
- Joint keys must preserve all five unique tuples and correct membership.
- WHERE filters e1/e4/e6 before grouping; HAVING removes only group C after counting.
- Money must display 1.40/1.20/0.70 and 0.35/0.40/0.70 accurately.
- Existing section children and English fallback links still work.
- Narrow controls, keyboard focus, dark figures and reduced motion remain usable.

### Task 1: Calculation engine
Files: lib/systems/sql/groupBy.ts, tests/sql-group-by.test.ts.
Interfaces: ClickEvent, KeyMode, Aggregate, FilterMode; CLICK_EVENTS; groupEvents(rows, mode) yields keys, rows, count, sumCents, avgCents; filterEvents(mode) yields rows, groups, result; groupSql(mode), aggregationSql(op), filterSql(mode) yield displayed SQL.
- [x] Write tests for all three key modes, exact event membership, aggregates, filters, empty input and repeated rows.
- [x] Run targeted test and observe missing-module failure.
- [x] Implement pure calculations using cents. Run tests; expect all pass.

### Task 2: Navigation and article
Files: content/notes.ts, content/noteComponents.ts, content/navigation.ts, components/layout/SidebarNav.tsx, components/layout/NotePageView.tsx, content/systems/sql-db-basics/group-by.mdx; tests/sql-navigation.test.ts.
Interfaces: optional NoteEntry.subsection; navigation sections gain subsections while children still retain all notes for counts.
- [x] Test nested SQL registration, existing direct-note preservation and unique slugs; run to observe failure.
- [x] Add subsection grouping and sidebar rendering/open state/search; add breadcrumb and note registration.
- [x] Write the teaching sections and closing recap including scope/correctness caveats and official SQL reference links.

### Task 3: Figures and acceptance
Files: components/visualization/systems/sql/GroupByFigures.tsx, SqlViews.tsx, styles/sql.css, components/layout/RootDocument.tsx.
Consumes: Task 1 engine; produces exported WhyGroupBy, GroupByPlayground, AggregationPlayground, FilterPlayground, AdsAggregationFlow.
- [x] Implement semantic controls and synchronized derived views. Scope CSS to sql-prefixed classes; mobile single column and dark media override.
- [x] Run npm test, npm run lint, npm run typecheck, npm run build. Expect exit 0.
- [x] Inspect static page and exercise all controls at desktop/mobile sizes, keyboard, dark preference. Review final diff and record results.

## Verification record

- `npm test`: 539 tests passed, 0 failures (includes six new engine/navigation tests).
- `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`: all exit 0 on the final product tree.
- Static export contains `out/notes/systems/sql-db-basics/group-by/index.html`.
- Browser checks against the static export: adId/minute/joint key SQL, membership and results; SUM 1.40/1.20/0.70; AVG 0.35/0.40/0.70; WHERE 2/2/1; HAVING 4/3; keyboard ArrowRight; subsection search.
- At 390×844, document scrollWidth equals 390; all teaching figures fit their 350px containers. Desktop shows the two-column grouping view. Browser warning/error log is empty.
- Forced dark-media CSS preview uses a separate temporary QA server, without changing the product or OS settings. Group key text is rgb(238,234,245) on rgb(34,33,39). Review caught and fixed inherited strong text contrast and subsection chevron state.
- Refreshed existing dependencies with `npm ci` and moved stale `.next` output to `/tmp/rlearning-next-before-sql-20261101`; no lockfile change. Existing site remains light-only outside these figures.
- Work retained uncommitted on `codex/sql-group-by`; no push or deployment.

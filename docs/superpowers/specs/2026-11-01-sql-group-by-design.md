# SQL & DB Basics / GROUP BY

Approved direction: follow the supplied handoff and the continuation on 2026-11-01.

## Intent
Teach students who know SELECT the distinction between grouping keys and aggregation, using the supplied eight click events throughout. Deliver one Chinese MDX note at `/notes/systems/sql-db-basics/group-by/` with five teaching sections and a closing recap, and no additional SQL articles.

## Approach
Reuse the existing MDX registry, VisualizationFrame, tables, buttons, TOC and search. Add optional `subsection` metadata under System Design rather than flattening the requested hierarchy or rewriting navigation as an arbitrary tree. Existing notes remain direct section children. Use local React controls and a pure TypeScript calculation module rather than a SQL engine or backend. No dependencies.

## Parts
- Shared immutable toy data with integer cents, key modes adId/minute/both, count/sum/average and row/group filtering.
- Why figure showing input, membership and output; grouping playground; aggregation bars and workings; filter-stage pipeline; batch architecture.
- MDX owns explanations and static SQL. Client components own controls and derived views. Every result is calculated from the rows shown.
- Sorted toy display is explicitly a presentation choice, not a GROUP BY ordering guarantee.
- SQL examples explain non-grouped SELECT columns, NULL count semantics, duplicate rows, and DATE_TRUNC dialect assumptions.

## Presentation and verification
Reuse quiet typography and existing visualization controls. Local styles accommodate narrow screens, reduced motion, focus and system dark preference; the existing site has no global dark mode. Validate engine outputs and navigation, full test suite, lint, typecheck, static export, desktop/mobile controls and dark figure contrast. No automatic commit, push or deployment.

# Remove learning assessments — completion record

User update on 2026-11-01 overrides the original handoffs: learning notes default to conceptual simulators without quizzes, hidden-scenario questions, answer state or scoring.

## Changes
- GROUP BY: removed assessment section and GroupByQuiz export; retained closing recap, grouping, aggregation, WHERE/HAVING and architecture figures.
- MapReduce/Spark: removed assessment section, SparkQuiz component and dedicated question dataset; retained all core simulators and conceptual interview explanations.
- Ads experiment reconciliation: removed hidden-scenario challenge, answer state and answer choices; retained Shadow/A/B modes, scenario selector, computation, first-divergence highlighting, narrative and Reset.
- Removed dedicated styles and unused challenge option list; updated description, article instructions and old design/planning requirements.
- Added the default teaching policy to AGENTS.md. The two upcoming pages' design excludes all assessment requirements from the source handoff.

## Verification
- Full test suite: 545 passed, 0 failed.
- lint, typecheck, static build and diff check: exit 0.
- Independent read-only review found no important regression or dangling removed exports.
- Static browser preview: neither GROUP BY nor Spark has assessment headings/buttons. Joint-key GROUP BY still gives counts 2,2,1,2,1, and MapReduce Reduce shows the same result.
- Ads dashboard: dedup scenario highlights Deduplication; A/B remains selectable; Reset returns to healthy Shadow; the only regular button in the dashboard is Reset. No hidden challenge controls remain.
- No new product dependencies. No commit, push or deployment.

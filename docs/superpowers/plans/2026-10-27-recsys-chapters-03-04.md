# Recommendation course Chapters 03–04 implementation plan

**Goal:** Implement the supplied two-chapter handoff in the existing RecSys course, preserving Chapters 01–02 and unrelated work.

**Design:** Chapter 03 has a local four-candidate ranking playground (sum, CTR-weighted sum, per-objective rank fusion, multiplicative) and rank-decay alpha/beta explorer. Chapter 04 has a 0–300 second soft-label/logit transformation explorer and a two-video completion normalization explorer. Pure functions and tests own every displayed metric. Reuse VisualizationFrame/Figure/Slider/Tabs/Bars and local ranking-viz theme. Separate chapter bodies override the short ML-node template per explicit user request.

**Important boundaries:** ranks start at 1, ties have explicit rules; compare scores within modes only; mixture of units requires business weights; conditional probabilities are not arbitrary marginal products. At t=0 ideal logit is -infinity, not a finite log(0). For random duration BCE estimates E[T/(1+T)|x], not E[T|x]. Completion threshold is >=80%, denominator positive. Normalization is relative performance, may exceed 1, and needs historical baselines/smoothing, not a guarantee of debiasing. All example data labeled illustrative.

**Completion UI:** edit selected video A/B, duration, p_finish and baseline f(L); duration changes an explicitly synthetic monotone baseline curve. Manual baseline edits are labeled a point override, discarded for that video when duration changes. Defaults A=(15s,.5,.5), B=(180s,.3,.1); a course preset changes A p to .4 to reproduce .8 vs3. Mode toggle raw/normalized; zero denominator protected with displayed floor. Show baseline curve and points on the same component.

- [x] Chapter 03: pure arithmetic/tests, article and two figures (delegated, no shared file edits).
- [x] Chapter 04: pure arithmetic/tests, article and two figures.
- [x] Add course metadata order 3/4, tree nodes and route entries; scoped CSS only.
- [x] Review all formulas/examples; full tests/typecheck/lint/build.
- [x] Browser: all controls/reset, ranking reversal/rank ties, t=0/1/9/99/300, normalization defaults and zero baseline, desktop/mobile, dark rules, KaTeX, previous/next links.

## Final changed-file inventory

- content/ml/recsys/score-fusion.mdx
- content/ml/recsys/watch-time-completion.mdx
- components/visualization/ml/recsys/ScoreFusionPlayground.tsx
- components/visualization/ml/recsys/RankDecayFigure.tsx
- components/visualization/ml/recsys/WatchTimeFigure.tsx
- components/visualization/ml/recsys/CompletionRateFigure.tsx
- lib/ml/scoreFusion.ts; lib/ml/watchTime.ts
- tests/score-fusion.test.ts; tests/watch-time.test.ts; tests/recsys-figure-ssr.test.ts
- content/notes.ts; content/ml/tree.ts; app/notes/[...slug]/page.tsx; styles/visualization.css
- This implementation/verification handoff.

## Verification results

383 tests passed. Lint, standalone typecheck after build, npm run build and git diff --check passed. Static export generated 112 pages.

Browser verified all four fusion modes, rank alpha/beta edits, decay endpoint, score movement and reset; decimal weights producing A=B=.68 display ties. Regression tests also ensure relative tie tolerance doesn't merge distinct tiny product scores. Completion preset reproduces .8 vs3; changing duration updates synthetic baseline, manual baseline and zero denominator protection work, and probability endpoints update ranking. Watch time 0 and300 and expanded derivation work; 0,1,9,99 anchor values are unit tested.

Both pages fit a 390px viewport with body width390 and350px component containers; wide graphs/tables scroll inside containers. Applied shipped dark media rules to temporary preview fixtures to inspect labels, controls and bars. Host remains light-only; new figures follow the existing locally scoped dark preference.

Found/fixed SVG title child arrays that caused hydration mismatches: tooltips now use single strings. A real React server-render regression test covers both figures. Fresh final browser pages show no console errors/warnings. Final navigation between03/04 works, course registry order is1–4. KaTeX:8 block equations in03 and12 in04, zero rendering errors.

No new dependencies/runtime services/deployment, no changes to Chapter01/02 bodies, no later course chapters. Course statements are based on supplied handoff rather than direct video verification.

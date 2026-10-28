# Ranking Overview implementation plan

**Goal:** Add only Chapter 01 to the existing Recommender Systems section, preserving the supplied six sections and formulas.

**Architecture:** MDX article plus a static architecture/loss diagram, a sampling/calibration slider, and a two-candidate fusion comparison. Reuse VisualizationFrame, Figure, Slider, Bars, and existing CSS tokens. Pure arithmetic lives in lib/ml/ranking.ts. No dependencies or runtime server.

**Design decisions:** The user delegates visual design and requests six sections, overriding the ML-node skill's shorter five-section format. Prefer one shared architecture diagram over a redundant second network diagram. Combine down-sampling counts with the calibration interaction. Keep dark styling scoped to these figures because the host currently uses only light mode. Add to the existing recsys chapter, with no placeholder pages or new roadmap sections.

## Tasks

- [x] Test arithmetic: 100/900 at alpha=.1 gives 100/90, sampled 10/19, corrected .1; alpha=1 identity; endpoints and monotonicity; logit shift; BCE weighted loss; fusion arithmetic and ranking reversal; reject invalid numeric inputs.
- [x] Implement pure functions and run focused tests.
- [x] Build the three figures with reset, accessible controls, computed values, and responsive scoped styles.
- [x] Write six-section Chinese MDX with derivation, assumptions, conditional probability/expected utility distinctions, trade-offs, source provenance, summary and existing follow-up links.
- [x] Register in notes.ts, tree.ts, and the note route; add Chapter 01 as the first RecSys node without changing other nodes.
- [x] Run full tests, typecheck, lint, static build. Inspect the page in browser on desktop/mobile, slider endpoints, fusion switch, reset, and dark figure styling.

## Review focus

Sampling alpha must be >0 and <=1. Calibration must preserve ordering for fixed alpha. Do not round probabilities before correcting. Sampled counts are expectations, not a random experiment. Fusion scores are utilities rather than event probabilities. Conditional CVR requires a click-conditioned definition. Global theme and unrelated pages remain unchanged.

## Verification results

359 tests passed; typecheck, lint, and static build passed. Browser: 20 block formulas, zero KaTeX errors; architecture training view and reset, alpha=.01/1/.1, fusion mode/rank reversal and weight=1 verified. At 390px body width equals viewport and all figures stay within their containers. Browser console had no errors/warnings. Independent review found two missing inference bus connections, now fixed. Dark preference CSS implemented locally, but visual dark-mode testing is unavailable in this browser. Course video could not be fetched; attribution explicitly limits the source to the supplied handoff.

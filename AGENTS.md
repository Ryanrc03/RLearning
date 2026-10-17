# RLearning agent notes

- Read `docs/design.md` before adding product features.
- Keep the site statically exportable with `npm run build`; avoid runtime server dependencies.
- Put articles in `content/` and reusable React visualizations in `components/visualization/`.
- Keep articles focused on what a concept is, why it exists, how it works, and its trade-offs.
- Preserve the quiet, readable documentation style described in the design.
- Treat `NEXT_STEPS.md` as a handoff, not as a claim that its features already exist.
- Beginner notes in CS Foundations › CS Fundamentals follow the project skill `.claude/skills/writing-fundamentals-note/SKILL.md` (one sentence, one comparison figure, one real example).
- ML & LLM notes are organised as the knowledge tree in `content/ml/tree.ts`; node pages follow the project skill `.claude/skills/writing-ml-node/SKILL.md` (五段式正文 + 一张算出来的图).
- Model notes in ML & LLM (architecture, loss, training, worked example, comparison) follow the project skill `.claude/skills/writing-model-note/SKILL.md` (drawn SVG figures colored by meaning, numbers from the paper).
- Algorithms notes live in `content/algorithms/<pattern>/` and follow the pattern-note template (Big Idea → When to Use → Core Templates → Interactive Dry Run → Common Mistakes → Related Problems → Key Takeaways); step engines go in `lib/algorithms/` with tests, visualizers in `components/visualization/algorithms/`. Reference: `content/algorithms/binary-search/templates.mdx`.

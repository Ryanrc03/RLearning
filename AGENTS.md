# RLearning agent notes

- Read `docs/design.md` before adding product features.
- Keep the site statically exportable with `npm run build`; avoid runtime server dependencies.
- Put articles in `content/` and reusable React visualizations in `components/visualization/`.
- Keep articles focused on what a concept is, why it exists, how it works, and its trade-offs.
- Preserve the quiet, readable documentation style described in the design.
- Treat `NEXT_STEPS.md` as a handoff, not as a claim that its features already exist.
- Beginner notes in CS Foundations › CS Fundamentals follow the project skill `.claude/skills/writing-fundamentals-note/SKILL.md` (one sentence, one comparison figure, one real example).
- ML & LLM notes are organised as the knowledge tree in `content/ml/tree.ts`; node pages follow the project skill `.claude/skills/writing-ml-node/SKILL.md` (五段式正文 + 一张算出来的图).
- Long model notes in ML & LLM (one model end to end: architecture, loss, training, a worked example, a comparison) are nodes of the same tree and follow the project skill `.claude/skills/writing-model-note/SKILL.md` (drawn SVG figures colored by meaning, numbers from the paper). Reference: `content/ml/llms/bert.mdx`.
- Algorithms notes live in `content/algorithms/<pattern>/` and follow the pattern-note template (Big Idea → When to Use → Core Templates → Interactive Dry Run → Common Mistakes → Related Problems → Key Takeaways); step engines go in `lib/algorithms/` with tests, visualizers in `components/visualization/algorithms/`. Reference: `content/algorithms/binary-search/templates.mdx`.
- English translations: `content/<slug>.en.mdx`, registered in `noteComponentsEn` (content/noteComponents.ts) and an `en` block in content/notes.ts; Chinese pages stay the source of truth. Figures a translated note uses get `const COPY: Record<Lang, typeof zh>` and read the language with `useLang()` (their labels in `lib/ml/` become `Localized`), and their Chinese rendering must stay byte-identical. Links in a `.en.mdx` use `/en/notes/<slug>/` for translated targets and `/notes/<slug>/` otherwise; when a note gets translated, update the other `.en.mdx` files that link to it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

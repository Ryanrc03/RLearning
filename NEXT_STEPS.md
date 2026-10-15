# Handoff: next development steps

The source design is in [docs/design.md](docs/design.md). The working name is **RLearning**; the local folder remains `RLearing`.

1. Extend the existing responsive reading shell with previous/next note links. The desktop sidebar, article column, table of contents, mobile drawer, and breadcrumbs are implemented.
2. Replace manual MDX imports and the `content/notes.ts` registry with a content loader. Add a browser search index. Static routes and navigation currently derive from shared note metadata.
3. Add reading features: code highlighting, KaTeX math, and callouts. The current user-selected theme is white with pale yellow accents.
4. `VisualizationFrame` and a set of React visualizations now exist (`components/visualization/agent-harness/`, used by the Agent Harness notes), alongside the iframe-based `LabFrame` labs. Next: a TCP handshake visualization for the networking notes, reusing the same frame and `styles/visualization.css` tokens.
5. Add initial notes gradually, then verify static build and deploy to Vercel from GitHub.

Keep the site frontend only. The design leaves CMS, database, authentication, comments, and AI search outside V1.

Avatar and identity configuration lives in `content/profile.ts`. It currently uses the public avatar for `Ryanrc03` saved in `public/avatar.jpg`; if that is not the intended identity, replace these values. The contribution-style grid shows real note creation/latest-update dates. A GitHub contribution source can be added later if desired.

# RLearning

A personal, evolving knowledge base for Computer Science, Machine Learning, LLMs, and AI Infrastructure.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Run `npm run build` to generate the static site in `out/`.

## Current state

The site uses Next.js App Router, TypeScript, Tailwind CSS, MDX, and static export. It includes a white and pale-yellow reading layout, a persistent desktop sidebar, a mobile navigation drawer, an article table of contents, a topic homepage, and a growing set of notes. Interactive visualizations exist in two forms: self-contained lab pages under `public/labs/` embedded with `LabFrame`, and React client components under `components/visualization/` (wrapped in `VisualizationFrame`, styled by `styles/visualization.css`) imported directly from MDX. Search and math rendering remain future work.

The top activity grid summarizes the recorded creation and latest-update dates in `content/notes.ts`; it is not a GitHub commit feed. The header uses the public avatar from the configured `Ryanrc03` GitHub profile, saved in `public/avatar.jpg`. Update `content/profile.ts` to change the displayed name, avatar URL, or GitHub link.

The [design document](docs/design.md) records the handoff. See [NEXT_STEPS.md](NEXT_STEPS.md) for the implementation order.

## Content

Notes live under `content/`. Current examples are `content/cs/os/virtual-memory.mdx` and `content/ml/reinforcement-learning/ucb.mdx`. Register a note in `content/notes.ts` and import its MDX component in `content/noteComponents.ts` (an import plus a `noteComponents` entry). An English translation sits beside the original as `content/<slug>.en.mdx`, gets a `noteComponentsEn` entry in the same file and an `en` block (`title`, `description`, `updated`, `seriesTitle`) on the note's entry in `content/notes.ts`, and is served at `/en/notes/<slug>/`. Figures it uses take `const COPY: Record<Lang, typeof zh>` plus `useLang()` (labels kept in `lib/ml/` become `Localized`), with the Chinese rendering left byte-identical. Links inside a `.en.mdx` point to `/en/notes/<slug>/` when the target is translated and to `/notes/<slug>/` otherwise; translating a note means updating the other `.en.mdx` links to it. Navigation, homepage entries, static route parameters, and activity counts use this shared metadata. `content/navigation.ts` controls category order; article headings generate the table of contents at build time.

Static routes use trailing slashes. For a local production preview, run `python -m http.server 4173 --directory out` after building, then open <http://localhost:4173/>.

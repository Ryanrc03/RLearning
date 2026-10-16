---
name: writing-model-note
description: Use when adding a long note on an ML / DL model or architecture (BERT, GPT, ResNet, a recommender model, an RL algorithm) to RLearning's ML & LLM section, or when the owner asks to 讲一下模型架构、损失函数、训练方法、举个例子、和 X 对比, or complains that a note's diagrams are 草图 / 文字画的 / 颜色太单调.
---

# Writing a model note (ML / DL)

## Overview

A model note is the long page that makes an engineer understand one model: what it is, why it exists, how it is built, what it optimizes, how it is trained, one worked example, and how it compares with its nearest sibling. It is the opposite of a fundamentals note: depth is welcome, sketches are not. Every structural picture is a drawn SVG figure, every number carries its source.

Reference page: `content/ml/transformers/bert.mdx` with `components/visualization/transformers/`. Match its shape, not its wording: the contract below is written for any model.

## The page contract

Chinese prose, English question headings, model terms in English with a space on each side (`[CLS]`, `pooler`, `softmax`). Sections in this order:

| Heading | What it holds | Figure |
| --- | --- | --- |
| opening paragraph | full name, year, authors; one-line definition; the note's roadmap | — |
| `## What is it?` | one-sentence definition, then the sizes table from the paper | pipeline: data → training stage(s) → model → how it is used (fine-tuned, prompted, served) |
| `## Why does it exist?` | what came before and its hard limit; the idea; defer the cost to Trade-offs | — |
| `## Architecture` | `###` for input, core block, output (the note's three stages, whatever the network calls its own); prose per `###` | one figure per `###`, or one shared by two neighbours (BERT's output heads sit inside the stack figure) |
| `## Loss functions` | formulas in ```text fences; what is predicted, where the loss is computed, why that design | simulator that builds one training example and scores it: sample it, apply what the objective does (mask, shift, augment), show the loss |
| `## How is it trained?` | the main training run as a table (pre-training for self-supervised models, the supervised run otherwise: data, batch, steps, optimizer, schedule, hardware); then how the model is reused, as a table: fine-tuning, prompting, plain inference, or as a backbone | — |
| `## A <task> example` | numbered steps with tensor shapes; short Hugging Face / PyTorch snippet; results table from the paper; 3 practical notes | stepper walking the shapes |
| `## <Model> vs <Sibling>` | comparison table: structure, objective, signal per example, strengths, how it is reused, scale, plus the rows where this pair actually differs (depth, normalization, params, FLOPs); identical rows say 相同; two paragraphs: why the two lines diverged, what each line kept | side-by-side figure on the same input; reuse an existing one when the pair already has it (`BertVsGptAttentionViz`) |
| `## Trade-offs` | bullets, each naming the successor that fixed it | — |
| `## Key ideas to remember` | 5 numbered sentences | — |
| `## Related notes` | only when a related note exists; add the back-link in that note too | — |
| `## Further reading` | papers with links, one-line why | — |

`readingMinutes` 12–16.

## Facts

Before writing, get the primary text: ar5iv for arXiv papers, the publisher or lab PDF otherwise. Extract model sizes, every percentage in the objective, training hyperparameters, hardware and time, the headline results table, and quote them. Numbers the paper omits come from the official repo or the canonical open checkpoint's config (Hugging Face, torchvision) and say so (`来自 openai/gpt-2 的 hparams`); if nothing reports them, write 论文未披露. Parameter counts are that checkpoint's real count, named (`bert-base-uncased`: 109,482,240), with the paper's rounded figure beside it when they differ. A number you derive from the paper's own figures is labeled 按论文数字换算; a value that only appears in a plot is described, never read off. Illustrative numbers inside figures (probabilities, logits) are allowed; the figure footnote says 示意值 and names which numbers are real.

## The figure contract

Client components in `components/visualization/<area>/`, wrapped in `VisualizationFrame`. Layout and controls use the classes in `styles/visualization.css` (`viz-controls`, `viz-btn`, `viz-chip`, `viz-legend`, `viz-narr`, `viz-scroll`); colors inside SVGs and chips are inline hex from the table below; no new CSS files. Two kinds:

**Static diagram** (pipeline, input layout, block stack): same shape as a fundamentals figure, different button semantics. SVG in `div.viz-scroll`, viewBox 640–700 wide, text 8–11 px. Two action buttons plus 重置; each button **focuses** one part (thicker stroke) and **dims** the rest (opacity 0.25–0.35) instead of playing an event. One `viz-narr` per state, two to four sentences, `is-warn` for the first button and `is-good` for the second. A `viz-legend` under the SVG. The default state is already fully colored. No sliders, selects or modes.

**Interactive simulator** (building a loss example, shape stepper, attention masks, side-by-side with a selectable position): state inside the component; anything random uses a seeded generator (mulberry32) so server and client render the same first frame; chips, sliders, steppers and tables are fine.

Color by meaning, consistent across the note's figures:

| Color | Box fill | Grid cell fill | Means |
| --- | --- | --- | --- |
| blue `#2a78d6` (`--v1`) | `#dbe8f8` | `#cfe0f7` | the model's main computation and its blocks (attention, convolution), the training side, segment A |
| orange `#eb6834` (`--v2`) | `#fbe3d8` | `#f9d6c2` | the head and whatever reuses the model (task head, fc classifier, feed-forward, fine-tuning or prompting side), segment B, generated tokens |
| green `#1baf7a` (`--v3`) | `#d9f1e6` | `#c6ead9` | what makes the model trainable or shared (residual shortcuts, normalization, tied weights, position embeddings), token-level heads |
| yellow `#d9b24a` (site yellow, not `--v4`) | `#fbf1cf` | `#fbe7a1` | tensors, feature maps, embeddings |
| ink `#3b4234` | — | — | sums (`F(x) + x`, summed embeddings), `[MASK]`, the current token or step |
| grey `#9a9c8d` dashed | `#fff` | — | parts that exist only during training (augmentation, loss node, pre-training heads) |

Dashed is reserved for that last row; a paper's own dotted notation (ResNet's projection shortcut) becomes solid with a label. SVG marker ids are prefixed per component (`pf-blue`, `enc-blue`); several figures share one page.

## Registration checklist

1. `content/ml/<section>/<slug>.mdx` importing the components; the path equals the slug (`getNoteToc` reads `content/${slug}.mdx`). A new section takes its name from the information architecture in `docs/design.md` (Deep Learning, Transformers, LLM, Post-training).
2. `content/notes.ts`: `categoryId: "ml"`, the section, tags include the model name and `"interactive"`. Related notes are those in the same category that the text cites.
3. `app/notes/[...slug]/page.tsx`: import + `noteComponents` entry.
4. `content/navigation.ts`: add the section to the ml `topics` string if it is new.
5. `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`: a table of figures (component, section, what it shows).
6. `npm run typecheck && npm run lint && npm run build`; stop the `dev` preview before building, they share `.next` manifests.
7. Preview with the `dev` launch config: click every button, check desktop and 375 px (`scrollWidth === innerWidth`; scroll with `scrollIntoView({behavior:'instant'})` before clicking refs, the site smooth-scrolls).

## Common mistakes

| Mistake | Fix |
| --- | --- |
| A pipeline or layer stack drawn with `│ ▼ ──▶` inside a ```text fence | Draw it as an SVG figure; fences hold formulas and code only |
| A list of input formats or corruption cases as a text block | Markdown table |
| Figures grey until a button is pressed | Color by meaning in the default state; buttons dim and focus |
| One giant architecture figure | One figure per `###`: input, block, output |
| Hyperparameters or scores from memory | Fetch the paper and quote the table; label other sources |
| Rebuilding a comparison figure the sibling note already has | Import the existing component |
| Reusing `arr-blue` marker ids across components | Prefix per component |
| `next build` while `next dev` is running | 500s with `Unexpected end of JSON input`; stop the preview first |
| Applying the 450-字 fundamentals cap | Model notes are long by design; cut sketches, not depth |

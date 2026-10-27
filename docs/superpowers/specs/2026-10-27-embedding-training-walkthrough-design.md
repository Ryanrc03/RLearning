# Embedding training walkthrough

## Intent

Improve `ml/recsys/training-step` so readers can locate embedding inside the full network and follow an actual parameter update. Preserve the existing quiet documentation style and eight-step UI.

## Approach

Extend the existing figure with a persistent SVG overview and an embedded worked example. A separate page would split the explanation; replacing the current UI would discard the real KuaiRand walkthrough. This approach preserves both context and detail.

## Network overview

Show categorical inputs → vocabulary indices → per-field embedding tables → selected rows, alongside the numeric-feature preprocessing branch. Join the branches at x0 (27 × 16 + 61 = 493), then show shared layers 512 → 256, four towers 128 → 1, sigmoid probabilities, labels and BCE. Draw forward arrows and a distinct backward gradient path. Highlight the current stage while keeping the whole network visible. Expand one embedding table to show row indexing and vector coordinates.

## Worked example

Use a clearly labelled teaching model: four categories, two embedding coordinates, one sigmoid click head and BCE. Seed random initialisation; show the selected category, its row, the head weights, logit, probability and loss. Compute analytic gradients, first-step Adam moments and bias correction, then show before / gradient / after values. Re-run forward with the updated embedding and head to show the loss change. The unselected rows remain unchanged for this first update, with no weight decay or prior momentum. Explain that later Adam updates can also move rows with existing optimizer state, depending on sparse/dense implementation.

Keep the existing primary step control; reveal example detail at the matching stages. Label the example separately from the observed KuaiRand checkpoint vectors, which are measured after 2.5 epochs rather than after one update.

## Scope and verification

Update the existing MDX, visualization, pure computation module, focused numerical tests and registry date if needed. Preserve the five-section article structure and static export. Test gradients with finite differences, deterministic initialisation, untouched rows on the first step, Adam bias correction, and reduced loss. Run the full suite, typecheck, source lint and static build; inspect desktop and mobile rendering and each step.

## Implementation choices

Use existing React/SVG primitives and visualization colour tokens, HTML tables for matrices, and no new dependency. Keep the current real-model dimensions and data; clearly mark the small model as pedagogical.

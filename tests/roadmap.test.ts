import { test } from "node:test";
import assert from "node:assert/strict";
import { roadmapNodes, roadmapEdges, roadmapNode, notesForNode, prerequisites, nextSteps, deriveMlEdges } from "@/content/roadmap";
import { noteEntries } from "@/content/notes";

test("every node's section exists in notes.ts with the same category", () => {
  for (const node of roadmapNodes) {
    const notes = noteEntries.filter((note) => note.section === node.section && note.categoryId === node.categoryId);
    assert.ok(notes.length, `no notes for ${node.id} (${node.categoryId} / ${node.section})`);
  }
});

test("every section in notes.ts is drawn exactly once", () => {
  const sections = new Set(noteEntries.map((note) => `${note.categoryId}/${note.section}`));
  const drawn = roadmapNodes.map((node) => `${node.categoryId}/${node.section}`);
  assert.equal(new Set(drawn).size, drawn.length, "a section is drawn twice");
  for (const section of sections) assert.ok(drawn.includes(section), `section missing from the roadmap: ${section}`);
});

test("node ids are unique and no two nodes share a grid cell", () => {
  assert.equal(new Set(roadmapNodes.map((node) => node.id)).size, roadmapNodes.length);
  const cells = roadmapNodes.map((node) => `${node.row}:${node.col}`);
  assert.equal(new Set(cells).size, cells.length);
});

test("edges connect existing nodes and always point down the page", () => {
  for (const edge of roadmapEdges) {
    const from = roadmapNode(edge.from);
    const to = roadmapNode(edge.to);
    assert.ok(from, `unknown from: ${edge.from}`);
    assert.ok(to, `unknown to: ${edge.to}`);
    assert.ok(to.row > from.row, `${edge.from} → ${edge.to} does not point down`);
  }
});

test("the graph has no cycles", () => {
  const out = new Map<string, string[]>();
  for (const edge of roadmapEdges) out.set(edge.from, [...(out.get(edge.from) ?? []), edge.to]);
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string) => {
    assert.notEqual(state.get(id), "visiting", `cycle through ${id}`);
    if (state.get(id) === "done") return;
    state.set(id, "visiting");
    for (const next of out.get(id) ?? []) visit(next);
    state.set(id, "done");
  };
  for (const node of roadmapNodes) visit(node.id);
});

test("ML chapter edges come from the knowledge tree, and redundant ones are dropped", () => {
  const derived = deriveMlEdges();
  assert.ok(derived.some((edge) => edge.from === "ml-dl-blocks" && edge.to === "ml-llms"));
  // classifiers → LLM Engineering is implied by classifiers → LLMs → LLM Engineering.
  assert.ok(derived.some((edge) => edge.from === "ml-classifiers" && edge.to === "ml-llm-engineering"));
  assert.ok(!roadmapEdges.some((edge) => edge.from === "ml-classifiers" && edge.to === "ml-llm-engineering"));
  assert.ok(roadmapEdges.some((edge) => edge.from === "ml-classifiers" && edge.to === "ml-llms"));
});

test("a node's notes come back in reading order, overview first", () => {
  const notes = notesForNode("ml-evaluation");
  assert.equal(notes[0].slug, "ml/evaluation/overview");
  const orders = notes.filter((note) => note.series).map((note) => note.series!.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});

test("prerequisites and next steps follow the drawn edges", () => {
  assert.ok(prerequisites("ml-llms").some((node) => node.id === "ml-dl-blocks"));
  assert.ok(nextSteps("ml-dl-blocks").some((node) => node.id === "ml-llms"));
  assert.equal(prerequisites("cs-fundamentals").length, 0);
});

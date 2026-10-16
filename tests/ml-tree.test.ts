import { test } from "node:test";
import assert from "node:assert/strict";
import { chapters, edges, nodeBySlug } from "@/content/ml/tree";
import { noteEntries } from "@/content/notes";

const registered = new Set(noteEntries.map((e) => e.slug));

test("every edge connects two nodes that exist, and never a node to itself", () => {
  for (const e of edges) {
    assert.ok(nodeBySlug[e.from], `unknown from: ${e.from}`);
    assert.ok(nodeBySlug[e.to], `unknown to: ${e.to}`);
    assert.notEqual(e.from, e.to);
  }
});

test("node slugs are unique across chapters", () => {
  const all = chapters.flatMap((c) => c.nodes.map((n) => n.slug));
  assert.equal(new Set(all).size, all.length);
});

test("every ready node and started chapter's overview is a registered note in its chapter's section", () => {
  for (const c of chapters) {
    const started = c.nodes.some((node) => node.status === "ready");
    if (c.overview && started) {
      const note = noteEntries.find((e) => e.slug === c.overview);
      assert.ok(note, `overview not registered: ${c.overview}`);
      assert.equal(note.section, c.section);
    }
    for (const node of c.nodes) {
      if (node.status !== "ready") continue;
      const note = noteEntries.find((e) => e.slug === node.slug);
      assert.ok(note, `ready node not registered: ${node.slug}`);
      assert.equal(note.section, c.section, `${node.slug} section`);
    }
  }
});

test("planned nodes are not registered yet (flip them to ready when the page lands)", () => {
  for (const c of chapters) {
    for (const node of c.nodes) {
      if (node.status === "planned") assert.ok(!registered.has(node.slug), `${node.slug} exists but is still marked planned`);
    }
  }
});

test("every ml note that is not an overview appears in the tree", () => {
  const overviews = new Set(chapters.map((c) => c.overview).filter(Boolean));
  for (const e of noteEntries) {
    if (e.categoryId !== "ml") continue;
    if (e.slug === "ml/overview" || overviews.has(e.slug)) continue;
    assert.ok(nodeBySlug[e.slug], `ml note missing from the tree: ${e.slug}`);
  }
});

test("ready nodes in a chapter share one series ordered like the chain", () => {
  for (const c of chapters) {
    if (c.existing) continue;
    const ready = c.nodes.filter((node) => node.status === "ready");
    if (ready.length < 2) continue;
    const orders = ready.map((node) => noteEntries.find((e) => e.slug === node.slug)?.series);
    const ids = new Set(orders.map((s) => s?.id));
    assert.equal(ids.size, 1, `${c.id} series ids: ${[...ids].join(",")}`);
    for (let i = 1; i < orders.length; i++) assert.ok((orders[i]?.order ?? 0) > (orders[i - 1]?.order ?? 0), `${c.id} series order`);
  }
});

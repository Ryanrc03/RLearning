import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigation } from '@/content/navigation';
import { noteEntries } from '@/content/notes';

test('SQL Basics is a nested System Design subsection containing GROUP BY and MapReduce/Spark', () => {
  const system = navigation.find(n=>n.id==='systems')!;
  const design = system.children.find(s=>s.title==='System Design')!;
  assert.deepEqual(design.subsections.find(s=>s.title==='SQL & DB Basics')?.children.map(n=>n.slug), ['systems/sql-db-basics/group-by', 'systems/sql-db-basics/mapreduce-spark']);
  assert.ok(design.children.some(n=>n.slug==='systems/design/message-queue' && !n.subsection));
});
test('navigation retains all notes exactly once and existing Ads Backend Systems', () => {
  const all = navigation.flatMap(c=>c.children.flatMap(s=>s.children));
  assert.equal(all.length, noteEntries.length);
  assert.equal(new Set(all.map(n=>n.slug)).size, noteEntries.length);
  assert.ok(all.some(n=>n.slug==='systems/ads/identity-resolution'));
});

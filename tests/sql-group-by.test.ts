import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLICK_EVENTS, groupEvents, filterEvents } from '@/lib/systems/sql/groupBy';

test('all key modes return correct counts and joint-key membership', () => {
  assert.deepEqual(groupEvents(CLICK_EVENTS, 'adId').map(g => [g.key, g.count]), [['A',4],['B',3],['C',1]]);
  assert.deepEqual(groupEvents(CLICK_EVENTS, 'minute').map(g => [g.key,g.count]), [['10:00',4],['10:01',4]]);
  assert.deepEqual(groupEvents(CLICK_EVENTS, 'both').map(g => [g.key,g.rows.map(r=>r.eventId)]), [
    ['A · 10:00',['e1','e2']], ['A · 10:01',['e4','e8']], ['B · 10:00',['e3']], ['B · 10:01',['e5','e6']], ['C · 10:00',['e7']],
  ]);
});
test('money aggregates use exact cents', () => {
  assert.deepEqual(groupEvents(CLICK_EVENTS,'adId').map(g=>[g.sumCents,g.avgCents]), [[140,35],[120,40],[70,70]]);
});
test('WHERE removes rows before counting while HAVING removes counted groups', () => {
  const where = filterEvents('where');
  assert.deepEqual(where.rows.map(r=>r.eventId), ['e2','e3','e5','e7','e8']);
  assert.deepEqual(where.result.map(g=>g.count), [2,2,1]);
  const having = filterEvents('having');
  assert.equal(having.rows.length,8);
  assert.equal(having.groups.length,3);
  assert.deepEqual(having.result.map(g=>[g.key,g.count]), [['A',4],['B',3]]);
  assert.deepEqual(filterEvents('none').result.map(g=>g.count), [4,3,1]);
});
test('empty data has no groups; repeated input rows are counted, not deduplicated', () => {
  assert.deepEqual(groupEvents([], 'both'), []);
  assert.equal(groupEvents([CLICK_EVENTS[0],CLICK_EVENTS[0]],'adId')[0].count, 2);
});

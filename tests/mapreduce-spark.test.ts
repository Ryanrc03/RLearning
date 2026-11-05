import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPipeline, combineCost, taskWaves, skewModel, executionStep, INITIAL_EXECUTION, writeResult } from '@/lib/systems/sql/mapReduce';

test('split/map/combine preserve toy events and match local counts', () => {
  const p = buildPipeline();
  assert.deepEqual(p.split.map(rows=>rows.map(r=>r.eventId)), [['e1','e2','e3','e4'],['e5','e6','e7','e8']]);
  assert.equal(p.mapped.flat().length,8);
  assert.deepEqual(p.combined.map(rows=>rows.map(r=>[r.key,r.count])), [
    [['A · 10:00',2],['A · 10:01',1],['B · 10:00',1]],
    [['A · 10:01',1],['B · 10:01',2],['C · 10:00',1]],
  ]);
});
test('shuffle converges equal keys and reduce preserves all counts', () => {
  const p=buildPipeline();
  const shared=p.routed.filter(r=>r.key==='A · 10:01');
  assert.deepEqual(shared.map(r=>r.source),[0,1]);
  assert.equal(new Set(shared.map(r=>r.target)).size,1);
  assert.deepEqual(p.reduced.map(r=>[r.key,r.count]),[['A · 10:00',2],['A · 10:01',2],['B · 10:00',1],['B · 10:01',2],['C · 10:00',1]]);
  assert.equal(p.routed.reduce((s,r)=>s+r.count,0),8);
});
test('combine costs bound keys by rows; waves round up', () => {
  assert.deepEqual(combineCost(1000000,1000,true),{records:1000,reduction:0.999});
  assert.equal(combineCost(1000,1000,true).records,1000);
  assert.equal(combineCost(1000,10,false).records,1000);
  assert.equal(combineCost(10,100,true).records,10);
  assert.deepEqual([2,4,10,20].map(n=>taskWaves(100,n)),[50,25,10,5]);
  assert.equal(taskWaves(101,10),11);
});
test('salting conserves input, keeps four reducers, merges back to the original keys', () => {
  for (const hot of [false,true]) for (const salts of [1,2,4,8]) {
    const model=skewModel(hot,salts,true);
    assert.equal(model.loads.length,4);
    assert.equal(model.loads.reduce((a,b)=>a+b,0),model.total);
    assert.equal(model.results.reduce((s,r)=>s+r.count,0),model.total);
    assert.equal(model.results.find(r=>r.key==='A')?.count,hot?100000000:1000000);
    assert.equal(model.complete,true);
  }
  assert.equal(skewModel(true,4,false).complete,false);
  assert.ok(skewModel(true,4,false).results.some(r=>r.key==='A#0'));
  assert.ok(skewModel(true,4,true).maxLoad < skewModel(true,1,true).maxLoad);
  assert.equal(skewModel(true,8,true).loads.length,4);
});
test('lazy execution, failed task retry and shuffle-loss recovery have explicit state transitions', () => {
  let state=INITIAL_EXECUTION;
  assert.equal(executionStep(state,'fail'),state);
  state=executionStep(state,'run');
  assert.equal(state.phase,'map');
  state=executionStep(state,'next');
  assert.equal(state.phase,'reduce');
  state=executionStep(state,'fail');
  assert.equal(state.phase,'failed');
  assert.equal(executionStep(state,'next'),state);
  state=executionStep(state,'retry');
  assert.equal(state.phase,'reduce');
  assert.equal(state.attempt,2);
  state=executionStep(state,'lose');
  assert.equal(state.phase,'lost');
  state=executionStep(state,'retry');
  assert.equal(state.phase,'recompute');
  state=executionStep(state,'next');
  assert.equal(state.phase,'reduce');
  state=executionStep(state,'next');
  assert.equal(state.phase,'done');
  assert.deepEqual(executionStep(state,'reset'),INITIAL_EXECUTION);
});
test('successful external write replay doubles additive sink but not stable-key replacement', () => {
  assert.equal(writeResult(false,1),1000);
  assert.equal(writeResult(false,2),2000);
  assert.equal(writeResult(true,2),1000);
});

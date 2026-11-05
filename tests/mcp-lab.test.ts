import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protocolSteps, modernRequest, contextCost, LAB_STEPS, SAMPLE_DIFF, diagnoseMock } from '@/lib/agent-harness/mcp';

test('modern trace has discovery and no legacy handshake; legacy completes initialization before list', () => {
  const modern=protocolSteps('2026-07-28').map(s=>s.label).join('\n');
  assert.match(modern,/server\/discover/);
  assert.doesNotMatch(modern,/initialize/);
  const legacy=protocolSteps('2025-11-25').map(s=>s.label);
  assert.ok(legacy.findIndex(s=>s.includes('notifications/initialized')) < legacy.findIndex(s=>s==='tools/list'));
});
test('modern wire examples carry required metadata and do not hide tool arguments in session state', () => {
  const req=modernRequest('tools/call','get_experiment_metrics');
  assert.equal(req.params._meta['io.modelcontextprotocol/protocolVersion'],'2026-07-28');
  assert.deepEqual(req.params._meta['io.modelcontextprotocol/clientCapabilities'],{});
  assert.deepEqual(req.params.arguments,{experiment_id:'exp_123'});
  assert.equal(req.params.name,'get_experiment_metrics');
});
test('deferred schemas never exceed available catalogs including small catalogs', () => {
  for(const n of [1,3,6]) for(const k of [1,5,14,40]) {
    const c=contextCost(n,k,true);
    assert.equal(c.loaded,Math.min(2,n*k));
    assert.equal(c.used,n*k*20+c.loaded*(250-20));
  }
  assert.equal(contextCost(3,14,false).used,10500);
});
test('mock diagnosis separates joiner counts from Flink divergence and does not invent cause', () => {
  assert.equal(LAB_STEPS.length,7);
  assert.equal(SAMPLE_DIFF[0].control,SAMPLE_DIFF[0].treatment);
  assert.equal(Math.abs(SAMPLE_DIFF[1].control-SAMPLE_DIFF[1].treatment),20000);
  const diagnosis=diagnoseMock();
  assert.equal(diagnosis.firstDiverged,'Flink');
  assert.equal(diagnosis.provenCause,false);
  assert.ok(diagnosis.leads.includes('Timer'));
});

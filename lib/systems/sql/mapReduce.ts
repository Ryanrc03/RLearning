import { CLICK_EVENTS, groupEvents } from './groupBy';

export type PartialCount = { key: string; count: number; source: number };
export type RoutedCount = PartialCount & { target: number };
/** Deterministic teaching partitioner, deliberately not Spark's hash implementation. */
export function reducePartition(key: string, partitions = 2): number {
  return [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % partitions;
}
export function buildPipeline() {
  const split = [CLICK_EVENTS.slice(0,4), CLICK_EVENTS.slice(4)];
  const mapped = split.map((rows,source) => rows.map(row => ({ key: `${row.adId} · ${row.minute}`, count: 1, source, eventId: row.eventId })));
  const combined: PartialCount[][] = split.map((rows,source) => groupEvents(rows,'both').map(g => ({ key: g.key, count: g.count, source })));
  const routed: RoutedCount[] = combined.flat().map(row => ({...row,target:reducePartition(row.key)}));
  const reduced = groupEvents(CLICK_EVENTS,'both').map(g => ({key:g.key,count:routed.filter(r=>r.key===g.key).reduce((sum,r)=>sum+r.count,0)}));
  return {split,mapped,combined,routed,reduced};
}
export function combineCost(rows: number, keys: number, enabled: boolean) {
  const records = enabled ? Math.min(rows,keys) : rows;
  return { records, reduction: rows ? 1-records/rows : 0 };
}
export const taskWaves = (partitions: number, slots: number) => Math.ceil(partitions / slots);
/** Raw-equivalent workload, not post-combine bytes or measured runtime. */
export function skewModel(hot: boolean, salts: number, twoStage: boolean) {
  const original = ['A','B','C','D'].map((key,i)=>({key,count:hot ? (i===0?100000000:1000) : 1000000}));
  const salted = original.flatMap((r,i) => Array.from({length:salts},(_,salt)=>({
    key: salts===1 ? r.key : `${r.key}#${salt}`,
    count: Math.floor(r.count/salts) + (salt<r.count%salts ? 1 : 0),
    target:(i+salt)%4,
  })));
  const loads=Array.from({length:4},(_,i)=>salted.filter(r=>r.target===i).reduce((s,r)=>s+r.count,0));
  const total=original.reduce((s,r)=>s+r.count,0);
  const results=twoStage ? original : salted.map(({key,count})=>({key,count}));
  const maxLoad=Math.max(...loads);
  return {loads,total,maxLoad,skew:maxLoad/(total/4),results,complete:twoStage||salts===1,salted,mergeRecords:twoStage ? salted.length : 0};
}
export type ExecutionState = { phase: 'planned'|'map'|'reduce'|'failed'|'lost'|'recompute'|'done'; attempt: number };
export type ExecutionEvent = 'run'|'next'|'fail'|'lose'|'retry'|'reset';
export const INITIAL_EXECUTION: ExecutionState = {phase:'planned',attempt:1};
export function executionStep(state: ExecutionState,event: ExecutionEvent): ExecutionState {
  if(event==='reset') return INITIAL_EXECUTION;
  if(event==='run' && state.phase==='planned') return {...state,phase:'map'};
  if(event==='next') {
    if(state.phase==='map'||state.phase==='recompute') return {...state,phase:'reduce'};
    if(state.phase==='reduce') return {...state,phase:'done'};
  }
  if(event==='fail'&&state.phase==='reduce') return {...state,phase:'failed'};
  if(event==='lose'&&state.phase==='reduce') return {...state,phase:'lost'};
  if(event==='retry'&&state.phase==='failed') return {phase:'reduce',attempt:state.attempt+1};
  if(event==='retry'&&state.phase==='lost') return {phase:'recompute',attempt:state.attempt+1};
  return state;
}
export const writeResult = (idempotent: boolean, attempts: number) => idempotent ? (attempts?1000:0) : 1000*attempts;

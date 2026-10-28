import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CANDIDATES, DEFAULT_FUSION_PARAMETERS, scoreCandidates, rankDecay, componentRanks, productLogScore, productScore, weightedSum, ctrWeightedSum } from "../lib/ml/scoreFusion";

test("course additive and CTR-gated example reverses A/B", () => {
  const [a, b] = DEFAULT_CANDIDATES;
  const weights = DEFAULT_FUSION_PARAMETERS.weights;
  assert.ok(Math.abs(weightedSum(a, weights) - 0.435) < 1e-12);
  assert.ok(Math.abs(weightedSum(b, weights) - 0.5) < 1e-12);
  assert.ok(Math.abs(ctrWeightedSum(a, weights) - 0.414) < 1e-12);
  assert.ok(Math.abs(ctrWeightedSum(b, weights) - 0.26) < 1e-12);
  assert.equal(scoreCandidates([a,b], "sum")[0].id, "B");
  assert.equal(scoreCandidates([a,b], "ctr")[0].id, "A");
});

test("component ranks use competition ties before weighted fusion", () => {
  const candidates = [DEFAULT_CANDIDATES[0], { ...DEFAULT_CANDIDATES[1], click: 0.4 }, DEFAULT_CANDIDATES[2]];
  const ranks = componentRanks(candidates);
  assert.deepEqual(ranks.map(r => r.click), [1,1,3]);
  const results = scoreCandidates(candidates, "rank");
  for (const result of results) {
    const r = ranks[candidates.findIndex(c => c.id === result.id)];
    const expected = Object.values(r).reduce((s, rank) => s + 1/(rank + 1), 0);
    assert.ok(Math.abs(result.score - expected) < 1e-12);
  }
});

test("rank decay boundaries and monotonicity", () => {
  assert.equal(rankDecay(1, 1, 0), 1);
  assert.equal(rankDecay(2, 2, 1), 0.2);
  for (let r=1; r<20; r++) assert.ok(rankDecay(r, 1.5, 2) > rankDecay(r+1, 1.5, 2));
  assert.throws(() => rankDecay(0, 1, 0));
  assert.throws(() => rankDecay(1, 0, 0));
  assert.throws(() => rankDecay(1, 1, -1));
});

test("product and log-space agree, price units normalize, and zero semantics are explicit", () => {
  const candidate = DEFAULT_CANDIDATES[0];
  const powers = { click: 1, like: 1, favorite: 1, pay: 1, price: 1 };
  const expected = candidate.click * candidate.like * candidate.favorite * candidate.pay * candidate.price / 100;
  assert.ok(Math.abs(productScore(candidate, powers, 100) - expected) < 1e-15);
  assert.ok(Math.abs(Math.exp(productLogScore(candidate, powers, 100)) - expected) < 1e-15);
  assert.equal(productScore({ ...candidate, pay: 0 }, powers, 100), 0);
  assert.ok(Math.abs(productScore({ ...candidate, pay: 0 }, { ...powers, pay: 0 }, 100) - expected/candidate.pay) < 1e-15);
  assert.throws(() => productScore(candidate, powers, 0));
});

test("weight, rank alpha/beta, and exponent edits affect calculated scores; inputs remain intact", () => {
  const before = JSON.stringify(DEFAULT_CANDIDATES);
  for (const mode of ["sum", "ctr", "rank", "product"] as const) {
    const base = scoreCandidates(DEFAULT_CANDIDATES, mode);
    const changed = scoreCandidates(DEFAULT_CANDIDATES, mode, { ...DEFAULT_FUSION_PARAMETERS,
      weights: { ...DEFAULT_FUSION_PARAMETERS.weights, like: 3 },
      alpha: 2, beta: 0,
      powers: { ...DEFAULT_FUSION_PARAMETERS.powers, like: 2 },
    });
    assert.ok(base.some(r => r.score !== changed.find(c => c.id === r.id)!.score));
    assert.ok(changed.every(r => Number.isFinite(r.score)));
  }
  assert.equal(JSON.stringify(DEFAULT_CANDIDATES), before);
});

test("four-candidate rank fusion matches hand-computed scores and all-zero ties", () => {
  const results=scoreCandidates(DEFAULT_CANDIDATES,"rank");
  assert.deepEqual(results.map(r=>r.id),["B","C","A","D"]);
  const expected:Record<string,number>={A:1.1,B:1.75,C:4/3,D:.95};
  for(const r of results) assert.ok(Math.abs(r.score-expected[r.id])<1e-12);
  const tied=scoreCandidates(DEFAULT_CANDIDATES,"sum",{...DEFAULT_FUSION_PARAMETERS,weights:{click:0,like:0,favorite:0,pay:0}});
  assert.deepEqual(tied.map(r=>r.rank),[1,1,1,1]);
  assert.deepEqual(tied.map(r=>r.score),[0,0,0,0]);
});

test("reachable decimal weights preserve a mathematical tie instead of ranking roundoff", () => {
  const rows=scoreCandidates(DEFAULT_CANDIDATES,"sum",{...DEFAULT_FUSION_PARAMETERS,weights:{click:1.6,like:2,favorite:0,pay:0}});
  assert.equal(rows.find(r=>r.id==='A')!.rank,rows.find(r=>r.id==='B')!.rank);
  assert.deepEqual(rows.slice(0,2).map(r=>r.id),['A','B']);
});

test("distinct tiny product scores remain distinct when ranking uses relative tie tolerance", () => {
  const rows=scoreCandidates(DEFAULT_CANDIDATES,"product",{...DEFAULT_FUSION_PARAMETERS,powers:{click:3,like:3,favorite:3,pay:3,price:0}});
  assert.ok(rows.every(r=>r.score>0 && r.score<1e-10));
  assert.deepEqual(rows.map(r=>r.rank),[1,2,3,4]);
});

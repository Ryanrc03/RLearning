import { test } from "node:test";
import assert from "node:assert/strict";
import { watchTimeTransform, softTimeBce, mixtureTimeOptimum, completionLabel, lengthBaseline, completionScore } from "@/lib/ml/watchTime";
const close = (a: number, b: number) => assert.ok(Math.abs(a-b) < 1e-10, `${a} != ${b}`);

test("watch-time labels and exp inference match the fixed-target example including t=0", () => {
  const rows = [[0,0],[1,.5],[9,.9],[99,.99],[300,300/301]];
  for (const [time,label] of rows) {
    const v=watchTimeTransform(time);
    close(v.label,label); close(v.inferred,time);
    if(time===0) assert.equal(v.logit,-Infinity); else close(v.logit,Math.log(time));
  }
});

test("soft-label BCE is stable at extreme logits and has the correct target optimum", () => {
  close(softTimeBce(9,Math.log(9)),0.3250829733914482);
  assert.ok(softTimeBce(9,Math.log(9)) < softTimeBce(9,0));
  close(softTimeBce(0,0),Math.log(2));
  assert.equal(softTimeBce(0,-Infinity),0);
  assert.equal(softTimeBce(9,-Infinity),Infinity);
  close(softTimeBce(0,1000),1000);
});

test("random durations give an odds proxy rather than mean time", () => {
  const v=mixtureTimeOptimum([1,9],[.5,.5]);
  close(v.label,.7);close(v.proxy,7/3);close(v.mean,5);
  const zero=mixtureTimeOptimum([0,0],[.25,.75]);close(zero.proxy,0);
});

test("completion uses an inclusive 80 percent threshold with positive duration", () => {
  assert.equal(completionLabel(480,600),1);
  assert.equal(completionLabel(479,600),0);
  assert.equal(completionLabel(0,15),0);
  assert.equal(completionLabel(20,15),1);
});

test("synthetic baseline passes through the two declared anchors and decreases with length", () => {
  close(lengthBaseline(15),.5);close(lengthBaseline(180),.1);
  assert.ok(lengthBaseline(60)<lengthBaseline(15));
  assert.ok(lengthBaseline(60)>lengthBaseline(180));
});

test("completion normalization reproduces course scores, rank reversal and denominator protection", () => {
  close(completionScore(.4,.5).score,.8);
  close(completionScore(.3,.1).score,3);
  assert.ok(.4>.3);
  assert.ok(completionScore(.4,.5).score<completionScore(.3,.1).score);
  const protectedScore=completionScore(.3,0);
  assert.equal(protectedScore.protected,true);
  close(protectedScore.denominator,.01);
  close(protectedScore.score,30);
});

test("invalid times, probabilities and mixture weights cannot produce misleading output", () => {
  for(const t of [-1,NaN,Infinity]) assert.throws(()=>watchTimeTransform(t));
  assert.throws(()=>completionLabel(1,0));
  assert.throws(()=>completionScore(1.1,.1));
  assert.throws(()=>completionScore(.3,-.1));
  assert.throws(()=>completionScore(.3,.1,0));
  assert.throws(()=>mixtureTimeOptimum([1,9],[1]));
  assert.throws(()=>mixtureTimeOptimum([1,9],[0,0]));
});

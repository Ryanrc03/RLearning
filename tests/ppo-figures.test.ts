import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RoleArchitectureFigure from "@/components/visualization/ml/post-training/ppo/RoleArchitectureFigure";
import AdvantageFigure from "@/components/visualization/ml/post-training/ppo/AdvantageFigure";
import PipelineFigure from "@/components/visualization/ml/post-training/ppo/PipelineFigure";
import PpoVsGrpoFigure from "@/components/visualization/ml/post-training/ppo/PpoVsGrpoFigure";
import GaeFigure from "@/components/visualization/ml/post-training/ppo/GaeFigure";
import ClippingFigure from "@/components/visualization/ml/post-training/ppo/ClippingFigure";

test("PPO interactive figures render deterministic accessible server markup without warnings",()=>{
 const errors: string[]=[];const previous=console.error;
 console.error=(...args:unknown[])=>errors.push(args.map(String).join(" "));
 try {for(const Figure of [RoleArchitectureFigure,AdvantageFigure,PipelineFigure,PpoVsGrpoFigure,GaeFigure,ClippingFigure]){
   const render=()=>renderToStaticMarkup(createElement(Figure));const markup=render();
   assert.equal(markup,render());assert.ok(markup.includes("aria-label="));assert.ok(!markup.includes("NaN"));
 }} finally {console.error=previous;}
 assert.deepEqual(errors,[]);
});

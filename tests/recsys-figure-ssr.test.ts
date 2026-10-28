import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WatchTimeFigure from "@/components/visualization/ml/recsys/WatchTimeFigure";
import RankDecayFigure from "@/components/visualization/ml/recsys/RankDecayFigure";

test("course SVG tooltips server-render without hydration-unsafe title child arrays", () => {
  const errors: string[]=[];
  const originalError=console.error;
  console.error=(...args: unknown[])=>{ errors.push(args.map(String).join(' ')); };
  try {
    for(const Figure of [WatchTimeFigure,RankDecayFigure]) {
      const markup=renderToStaticMarkup(createElement(Figure));
      assert.ok(markup.includes('<title>'),"exercise actual tooltip rendering");
    }
  } finally { console.error=originalError; }
  assert.deepEqual(errors.filter(message=>message.includes('<title>')),[]);
});

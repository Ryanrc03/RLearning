import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE_ALIASES, charNgrams, cosineTable, DROP_TRAILING_QIAN, fitIdf, normalize, tfidf } from "@/lib/ml/tfidf";

const r3 = (x: number) => Math.round(x * 1000) / 1000;

test("step 1: the alias table maps 国家补贴 to 国补, so both queries share a key", () => {
  assert.equal(normalize("国家补贴多少"), "国补多少");
  assert.equal(normalize("政府补贴多少"), "国补多少");
  assert.equal(normalize("国补多少"), "国补多少");
  assert.equal(normalize("国补多少钱"), "国补多少钱");
  assert.equal(normalize("国补多少钱", [...BASE_ALIASES, DROP_TRAILING_QIAN]), "国补多少");
});

test("step 2: 国补多少 has 7 n-grams; each weight is its idf, normalised as in the notes", () => {
  const grams = charNgrams("国补多少");
  assert.equal(grams.size, 7);
  assert.ok([...grams.values()].every((tf) => tf === 1));
  const v = tfidf("国补多少");
  const expected: Record<string, number> = { 补多: 0.602, 国补: 0.465, 多少: 0.382, 补: 0.323, 国: 0.271, 少: 0.259, 多: 0.176 };
  for (const [g, w] of Object.entries(expected)) assert.equal(r3(v.unit.get(g)!), w, g);
  assert.ok(Math.abs([...v.unit.values()].reduce((s, w) => s + w * w, 0) - 1) < 1e-12);
});

test("a repeated character weighs (1 + ln tf) × idf, not tf × idf", () => {
  assert.equal(charNgrams("多多").get("多"), 2);
  const v = tfidf("多多", { 多: 2, 多多: 1 });
  assert.ok(Math.abs(v.raw.get("多")! - (1 + Math.log(2)) * 2) < 1e-12);
});

test("step 3: identical keys give cosine 1", () => {
  const { cosine } = cosineTable(tfidf("国补多少"), tfidf("国补多少"));
  assert.ok(Math.abs(cosine - 1) < 1e-12);
});

test("国补多少 vs 国补多少钱: two extra n-grams pull the cosine to 0.870, which is ‖a‖ / ‖b‖", () => {
  const a = tfidf("国补多少");
  const b = tfidf("国补多少钱");
  assert.equal(b.unit.size, 9);
  assert.equal(r3(b.unit.get("补多")!), 0.524);
  const { cosine, rows } = cosineTable(a, b);
  assert.equal(r3(cosine), 0.87);
  assert.ok(Math.abs(cosine - a.norm / b.norm) < 1e-12);
  assert.ok(cosine < 0.9 && cosine > 0.85);
  assert.deepEqual(rows.filter((r) => r.product === 0).map((r) => r.gram).sort(), ["少钱", "钱"].sort());
});

test("fitting idf on the four-sentence toy corpus gives the page's hand-computed table", () => {
  const idf = fitIdf(["国补多少", "国补怎么领", "运费多少", "多少钱"]);
  assert.equal(r3(idf["多少"]), 1.223);
  assert.equal(r3(idf["国补"]), 1.511);
  assert.equal(r3(idf["补多"]), 1.916);
});

test("8.15 back-solves to (1 + N) / (1 + df) ≈ 1274; N = 2547 with df = 1 reproduces it", () => {
  assert.equal(Math.round(Math.exp(8.15 - 1)), 1274);
  assert.equal(Math.round((Math.log(2548 / 2) + 1) * 100) / 100, 8.15);
});

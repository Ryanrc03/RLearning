// Representations, TF-IDF: character 1-gram + 2-gram TF-IDF vectors for short
// Chinese queries, as used by a semantic cache (normalize → vectorize → cosine
// against a threshold). The IDF table is the one a real service fitted at
// start-up on a synthetic vocabulary plus the ChnSentiCorp training set; only
// the n-grams the demo queries need are listed. Pure functions, no React; see
// tests/tfidf.test.ts.

/** IDF per n-gram: rarer n-grams weigh more. */
export const DEMO_IDF: Record<string, number> = {
  补多: 8.15,
  国补: 6.3,
  多少: 5.17,
  补: 4.37,
  国: 3.67,
  少: 3.51,
  多: 2.38,
  钱: 3.94,
  少钱: 6.57,
};

/** Alias rules applied before vectorizing, in order: [pattern, replacement]. */
export type AliasRule = [RegExp, string];

export const BASE_ALIASES: AliasRule[] = [[/国家补贴|政府补贴|国补贴/g, "国补"]];
/** The extra rule the page proposes so that 「多少钱」 and 「多少」 share a key. */
export const DROP_TRAILING_QIAN: AliasRule = [/钱$/, ""];

export function normalize(text: string, rules: AliasRule[] = BASE_ALIASES): string {
  return rules.reduce((s, [re, to]) => s.replace(re, to), text.trim());
}

/** Character n-grams of every length in [minN, maxN], in order of appearance, with counts. */
export function charNgrams(text: string, minN = 1, maxN = 2): Map<string, number> {
  const chars = Array.from(text);
  const counts = new Map<string, number>();
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i + n <= chars.length; i++) {
      const g = chars.slice(i, i + n).join("");
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  return counts;
}

export type TfidfVector = {
  /** Raw weight (1 + ln tf) × idf per n-gram. */
  raw: Map<string, number>;
  /** L2 length of the raw vector. */
  norm: number;
  /** raw / norm, so the squares sum to 1. */
  unit: Map<string, number>;
};

/** Sublinear TF times IDF, then L2-normalised. Unknown n-grams are an error: the demo IDF table must cover the text. */
export function tfidf(text: string, idf: Record<string, number> = DEMO_IDF): TfidfVector {
  const raw = new Map<string, number>();
  for (const [g, tf] of charNgrams(text)) {
    if (!(g in idf)) throw new Error(`no idf for ${g}`);
    raw.set(g, (1 + Math.log(tf)) * idf[g]);
  }
  const norm = Math.sqrt([...raw.values()].reduce((s, w) => s + w * w, 0));
  const unit = new Map([...raw].map(([g, w]) => [g, norm === 0 ? 0 : w / norm]));
  return { raw, norm, unit };
}

export type CosineRow = { gram: string; idf: number; a: number; b: number; product: number };

/** Cosine of two unit vectors as a per-n-gram table: rows for every n-gram in either vector, sorted by idf. */
export function cosineTable(a: TfidfVector, b: TfidfVector, idf: Record<string, number> = DEMO_IDF): { rows: CosineRow[]; cosine: number } {
  const grams = [...new Set([...a.unit.keys(), ...b.unit.keys()])].sort((x, y) => idf[y] - idf[x]);
  const rows = grams.map((gram) => {
    const wa = a.unit.get(gram) ?? 0;
    const wb = b.unit.get(gram) ?? 0;
    return { gram, idf: idf[gram], a: wa, b: wb, product: wa * wb };
  });
  return { rows, cosine: rows.reduce((s, r) => s + r.product, 0) };
}

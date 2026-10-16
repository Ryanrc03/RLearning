// Naive Bayes on the handwritten notes' spam example: 12 emails (8 正常, 4 垃圾)
// and four words. Everything the figure shows is derived from these counts.
// No React here; see tests/bayes.test.ts.

export const WORDS = ["Dear", "Friend", "Lunch", "Money"] as const;
export type Word = (typeof WORDS)[number];
export type MailClass = "ham" | "spam";
export const CLASSES: MailClass[] = ["ham", "spam"];
export const CLASS_LABEL: Record<MailClass, string> = { ham: "正常", spam: "垃圾" };

export type ClassTable = { docs: number; counts: Record<Word, number>; total: number };

export const TOTAL_DOCS = 12;
export const TABLE: Record<MailClass, ClassTable> = {
  ham: { docs: 8, counts: { Dear: 8, Friend: 5, Lunch: 3, Money: 1 }, total: 17 },
  spam: { docs: 4, counts: { Dear: 2, Friend: 1, Lunch: 0, Money: 4 }, total: 7 },
};

export type Fraction = { num: number; den: number; value: number };

const frac = (num: number, den: number): Fraction => ({ num, den, value: den === 0 ? 0 : num / den });

// P(class) = emails of that class / all emails.
export function prior(cls: MailClass): Fraction {
  return frac(TABLE[cls].docs, TOTAL_DOCS);
}

// P(word | class) = count of the word in that class / all word tokens of that class.
// Laplace smoothing adds 1 to every count, so the denominator grows by the vocabulary size.
export function likelihood(word: Word, cls: MailClass, smoothing = false): Fraction {
  const t = TABLE[cls];
  const add = smoothing ? 1 : 0;
  return frac(t.counts[word] + add, t.total + add * WORDS.length);
}

export type Term = { label: string; fraction: Fraction };
export type ClassPosterior = { cls: MailClass; terms: Term[]; product: number; prob: number };
export type Posterior = { ham: ClassPosterior; spam: ClassPosterior; winner: MailClass | null };

// Unnormalised score of each class = prior × Π likelihood of the words present,
// then both scores normalised to sum to 1. Words are treated as independent given
// the class; that is the "naive" part.
export function posterior(words: readonly Word[], smoothing = false): Posterior {
  const score = (cls: MailClass): Omit<ClassPosterior, "prob"> => {
    const terms: Term[] = [{ label: `P(${CLASS_LABEL[cls]})`, fraction: prior(cls) }];
    for (const w of words) terms.push({ label: `P(${w} | ${CLASS_LABEL[cls]})`, fraction: likelihood(w, cls, smoothing) });
    const product = terms.reduce((acc, t) => acc * t.fraction.value, 1);
    return { cls, terms, product };
  };
  const ham = score("ham");
  const spam = score("spam");
  const sum = ham.product + spam.product;
  const probHam = sum === 0 ? 0 : ham.product / sum;
  const probSpam = sum === 0 ? 0 : spam.product / sum;
  const winner: MailClass | null = sum === 0 ? null : ham.product >= spam.product ? "ham" : "spam";
  return { ham: { ...ham, prob: probHam }, spam: { ...spam, prob: probSpam }, winner };
}

import { noteEntries } from "./notes";

// `description` is reader-facing (Localized); titles and topics are English in both languages.
export const categories = [
  { id: "cs", title: "CS Foundations", description: { zh: "回到基础，理解计算机如何工作。", en: "Back to basics: how a computer works." }, icon: "code", topics: "CS Fundamentals · Computer Networks · Operating Systems" },
  { id: "systems", title: "Systems", description: { zh: "从单个组件到协作运行的系统。", en: "From single components to systems that work together." }, icon: "layers", topics: "Distributed Systems · Data Infrastructure · System Design · Backend Systems" },
  { id: "ml", title: "ML & LLM", description: { zh: "理解模型，也理解学习本身。", en: "Understand the models, and learning itself." }, icon: "brain", topics: "Evaluation · Classifiers · Trees · LLMs · Multimodal · RecSys · RL" },
  { id: "ai-infra", title: "AI Infrastructure", description: { zh: "让模型高效运行的工程细节。", en: "The engineering that makes models run fast." }, icon: "cpu", topics: "Agent Harness · GPU · Inference" },
  { id: "algorithms", title: "Algorithms", description: { zh: "学 pattern，而不只是题解。", en: "Learn the pattern, not just the solution." }, icon: "search", topics: "Binary Search · Two Pointers · Sliding Window · Stack · Heap · Trees · Graphs · DP" },
] as const;

// Sections hold the note entries themselves, so the sidebar can pick each note's path and title per language.
export const navigation = categories.map((category) => {
  const notes = noteEntries.filter((note) => note.categoryId === category.id);
  return {
    ...category,
    count: notes.length,
    children: [...new Set(notes.map((note) => note.section))].map((section) => ({
      title: section,
      children: notes.filter((note) => note.section === section),
    })),
  };
});

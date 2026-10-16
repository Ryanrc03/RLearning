import { noteEntries } from "./notes";

export const categories = [
  { id: "cs", title: "CS Foundations", description: "回到基础，理解计算机如何工作。", icon: "code", topics: "CS Fundamentals · Computer Networks · Operating Systems" },
  { id: "systems", title: "Systems", description: "从单个组件到协作运行的系统。", icon: "layers", topics: "Distributed Systems · Backend Systems · Architecture" },
  { id: "ml", title: "ML & LLM", description: "理解模型，也理解学习本身。", icon: "brain", topics: "Reinforcement Learning · Recommender Systems · LLMs" },
  { id: "ai-infra", title: "AI Infrastructure", description: "让模型高效运行的工程细节。", icon: "cpu", topics: "Agent Harness · GPU · Inference" },
] as const;

export const navigation = categories.map((category) => {
  const notes = noteEntries.filter((note) => note.categoryId === category.id);
  return {
    ...category,
    count: notes.length,
    children: [...new Set(notes.map((note) => note.section))].map((section) => ({
      title: section,
      children: notes.filter((note) => note.section === section).map((note) => ({ title: note.title, href: `/notes/${note.slug}/` })),
    })),
  };
});

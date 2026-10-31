import { noteEntries } from "./notes";

// Category titles are English on both sites.
export const categories = [
  { id: "cs", title: "CS Foundations", icon: "code" },
  { id: "systems", title: "Systems", icon: "layers" },
  { id: "ml", title: "ML & LLM", icon: "brain" },
  { id: "ai-infra", title: "AI Infrastructure", icon: "cpu" },
  { id: "algorithms", title: "Algorithms", icon: "search" },
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

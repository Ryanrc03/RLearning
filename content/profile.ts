import type { Localized } from "@/lib/i18n";

/** Personal details for the static site. Replace the avatar in public/ to update it. */
export const profile = {
  name: "Ryan",
  fullName: "Ryan Rongcheng Li",
  initials: "R",
  tagline: "Learning in public",
  avatarUrl: "/avatar.jpg" as string | null,
  githubUrl: "https://github.com/Ryanrc03" as string | null,
  homepageUrl: "https://nextmile-lime.vercel.app/" as string | null,
  intro: {
    zh: "我是 Ryan，在 Houston 的 Rice University 读书。这里是我公开学习的笔记：计算机系统、机器学习，最近在啃 LLM 后训练。图里是我桌上那台主机，笔记里的 GRPO 就是在这张 RTX 3060 上训的。",
    en: "I'm Ryan, a student at Rice University in Houston. These are my notes from learning in public: computer systems, machine learning, and lately LLM post-training. The machine pictured is the PC on my desk; the GRPO run in these notes trained on its RTX 3060.",
  } satisfies Localized,
};

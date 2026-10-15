# Drafts

未注册的草稿笔记。这里的 MDX 不在 `content/notes.ts` 里，也不被 `app/notes/[...slug]/page.tsx` 导入，所以不会构建成页面、不会出现在侧边栏。

要启用一篇：把文件移到正式目录，在 `content/notes.ts` 加一条，在 `page.tsx` 加 import 和 `noteComponents` 条目。

- `cs-fundamentals/`：存储层级的四个两两对比页（Cache vs RAM、RAM vs Disk、RAM vs VRAM、Register vs Cache），用 `components/visualization/storage/StoragePairDiagram`。正式页面是总览 `content/cs/fundamentals/memory-hierarchy.mdx`。

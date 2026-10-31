import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// Math is rendered to HTML at build time; only katex.min.css ships to the browser.
const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: { remarkPlugins: [remarkGfm, remarkMath], rehypePlugins: [rehypeKatex] },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Two root layouts ((zh), (en)) leave no single layout for the 404; app/global-not-found.tsx fills in.
  experimental: { globalNotFound: true },
};

export default withMDX(nextConfig);

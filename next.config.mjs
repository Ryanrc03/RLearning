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
};

export default withMDX(nextConfig);

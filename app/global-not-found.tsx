import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

// With two root layouts ((zh) and (en)) there is no single layout to wrap a 404, so Next
// serves this full document for unmatched URLs instead (experimental.globalNotFound).
export const metadata: Metadata = {
  title: "页面不存在 / Page not found | RLearning",
};

export default function GlobalNotFound() {
  return (
    <html lang="zh-CN">
      <body>
        <main className="home-page" style={{ maxWidth: 640, margin: "0 auto", padding: "42px 16px" }}>
          <div className="page-intro">
            <p className="eyebrow"><span /> 404</p>
            <h1>页面不存在</h1>
            <p lang="en">Page not found.</p>
            <p className="intro-links" style={{ marginLeft: 0 }}>
              <Link href="/">回到知识库</Link>
              <Link href="/en/" lang="en">Back to the library</Link>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}

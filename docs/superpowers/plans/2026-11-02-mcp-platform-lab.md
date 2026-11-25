# MCP platform lab implementation plan

User explicitly requests direct implementation; design discussion opted out. Use the current checkout on codex/mcp-platform-lab, preserving unpublished main commit 8027a34.

Goal: extend only the MCP part of Subagent/Skill/MCP note, preserve its preceding two sections and visuals byte-for-byte. No quiz, new website dependency or runtime server.

1. Verify official protocol 2026-07-28 and legacy 2025-11-25, plus Python SDK version/imports/run/client APIs. Local Python example and mock REST backend live in examples/ads-mcp, outside the exported site's runtime.
2. Test first: pure TypeScript protocol traces, context-cost bounds and mock diagnostic progression. Keep modern per-request metadata distinct from legacy initialize/initialized. Host, its Client, Server, LLM and underlying API have separate responsibilities.
3. Add architecture/path comparison, InternalMcpLab (7 steps: request/schema/metrics call/response/diff call/response/diagnostic leads), granularity switch, updated version-selectable McpSequenceViz with context-cost controls. Scope styling and mobile/dark support. All case numbers mock; Delayed Model inside Flink, negative samples direct, positives delayed. AUC 0.0012 vs 0.0005; Joiner equal, Flink 20K difference. Diagnosis is a clue, not a proven cause.
4. Runnable official Python SDK example: two read-only tools, validated exp ID, configured API URL/token, fixed API paths, timeout/redirect/error control. No model or diagnostic reasoning in server. Mock backend with same data, client smoke test covers schemas/calls, invalid parameters and upstream failures. Pin dependencies, run isolated environment and HTTP roundtrip. Keep config illustrative; do not alter user's actual Host registration.
5. Rewrite MCP subsection only, CLI vs REST vs MCP vs function calling table, short main example and collapsible setup/debug details, update summary/metadata/source links. Clearly separate modern diagram from any pinned older runnable SDK if package availability differs.
6. Run tests, lint, typecheck, static build, SDK smoke test and browser interactions on desktop/390px/dark. Independent read-only review, fix important findings, commit validated work; no push/merge/deploy without request.

## Verification and delivered files

- Protocol verified against official 2026-07-28 versioning/base/discover pages and official 2026-07-28 release note. Installed official mcp==2.0.0 in a temporary Python 3.12.16 environment. Constructor, run options, schema and Client APIs were checked against the installed package as well as SDK docs.
- Python HTTP smoke test passes: tools/list and generated parameter constraints, both read-only tools through the Mock HTTP API, invalid ID, upstream 503, malformed JSON and sanitized errors. No live service or actual Host configuration was used. `client.py` provides the manual equivalent. Inspector commands are documented for Node 22.19+; Inspector UI itself was not run.
- npm test: 549 passed, zero failed. npm run lint, npm run typecheck, npm run build and git diff --check: exit 0.
- Exact byte comparison: Subagent and Skill sections (from first Subagent heading to MCP heading) unchanged. Embedded server.py exactly equals the runnable source file.
- Browser checks on static export: full 14-step modern/15-step legacy traces; correct discovery/handshake separation; seven case steps, previous/reset and 20K table; architecture modes and four role explanations; fine/coarse flows; schema toggle and slider keyboard boundary (one tool correctly estimates 250 tokens); Python source expands; all TOC anchors resolve. Console warning/error log empty.
- At 390×844 the document scrollWidth is 390 and all four MCP figures have width/scrollWidth 350. Desktop screenshot and keyboard controls checked. A separate temporary server forces dark CSS media branches without product/OS changes; text rgb(238,234,245) on rgb(34,33,39).
- Independent read-only review: no important findings. No quiz, website dependency, unrelated page or deployment changes.

Files: modified original MDX, McpSequenceViz.tsx and that note's metadata; added McpArchitectureViz.tsx, InternalMcpLab.tsx, McpGranularityViz.tsx, McpFrame.tsx, lib/agent-harness/mcp.ts, styles/mcp.css, tests/mcp-lab.test.ts, examples/ads-mcp/{server.py,mock_api.py,client.py,smoke_test.py,requirements.txt,README.md,.gitignore}, and this implementation record.

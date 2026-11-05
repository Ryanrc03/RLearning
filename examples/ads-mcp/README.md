# Ads MCP adapter (local teaching example)

Official Python SDK **mcp==2.0.0**, protocol **2026-07-28**, tested with Python 3.12.16. Use Python 3.11+ and `uv`; shell commands below are for macOS/Linux. Website rendering does not require Python or this server. All counts/tokens are fictional. These scripts never contact a real Ads platform by default.

## Install

From this directory:

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
```

## Run locally

Terminal 1:

```sh
.venv/bin/python mock_api.py
```

Terminal 2:

```sh
export ADS_API_URL=http://127.0.0.1:3002
export ADS_API_TOKEN=local-demo-token
.venv/bin/python server.py
```

The MCP endpoint is `http://127.0.0.1:3001/mcp`. The environment token is accepted only by this mock; it is not an actual credential. For a real adapter use a configured HTTPS origin (illustration: `https://ads-api.example.invalid`) and a separately provisioned scoped credential.

Terminal 3:

```sh
.venv/bin/python client.py
```

Expect both tools, metrics with `auc_diff=0.0012`, and Joiner counts 1,000,000/1,000,000 versus Flink 980,000/960,000. This client explicitly selects the modern revision; the SDK supplies protocol metadata and transport headers. It is a plumbing check, not an Agent.

## Isolated smoke test

```sh
.venv/bin/python smoke_test.py
```

It starts its own ephemeral loopback mock API and MCP HTTP server, verifies `tools/list`, schema constraints, both `tools/call` mappings, invalid ID rejection, upstream HTTP 503 and malformed JSON, then stops both servers. It overrides the child process credentials/URLs with fictional local values and does not use production environment values.

## Host configuration (illustrative only)

For a compatible Claude Code Host, a project `.mcp.json` can contain:

```json
{
  "mcpServers": {
    "ads-experiments": {
      "type": "http",
      "url": "http://127.0.0.1:3001/mcp"
    }
  }
}
```

This repository intentionally does NOT register a server with your actual Host. Configuration, approval and protocol-era support vary by Host; `.mcp.json` and `mcp__server__tool` aliases are not MCP wire requirements. For older Hosts use an explicitly compatible server/client revision rather than mixing legacy initialize messages with modern requests. The mock endpoint has no inbound user authentication and binds loopback only.

## Inspector

Use Node **22.19+** (separate from this site's Node runtime), with the local servers already running:

```sh
npx @modelcontextprotocol/inspector@2.13.0
```

Choose Streamable HTTP, URL `http://127.0.0.1:3001/mcp`, then inspect Tools/List Tools and call `get_experiment_metrics` with `experiment_id=exp_123`. Inspect the generated required string/pattern Schema and structured response. Try `../private` to observe validation failure. The Inspector launch token authorizes the local debugging UI; it is unrelated to the mock Ads API token. Do not publish it.

Optional command-line listing:

```sh
npx @modelcontextprotocol/inspector@2.13.0 --cli http://127.0.0.1:3001/mcp --transport http --method tools/list
```

## Boundaries

- Two read-only adapters only; coarse `diagnose_experiment` and pipeline/error tools are design alternatives, not implemented endpoints.
- Delayed Model belongs inside Flink for the case's positive-sample wait; negative samples go straight through. Counts alone cannot establish a cause or equivalence of sample IDs/labels.
- Production requires user/tenant authorization, scoped API credentials, upstream response filtering, audit and an authenticated MCP deployment. An ID format constraint is not an access-control check. Never pass a model-supplied URL into the adapter.
- HTTP errors are sanitized; redirects are not followed, IDs have a bounded pattern, API paths are fixed, and requests time out. The SDK handles MCP messages and type-derived JSON Schema; server code implements business adaptation.

Official references: [Python SDK](https://py.sdk.modelcontextprotocol.io/), [running a server](https://py.sdk.modelcontextprotocol.io/run/), [modern protocol](https://modelcontextprotocol.io/specification/2026-07-28), [Inspector](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector).

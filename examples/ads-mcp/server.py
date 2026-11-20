"""Two read-only API adapters; official mcp==2.0.0, Python 3.11+."""
import os
from typing import Annotated, Any
from urllib.parse import urlsplit

import httpx
from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from pydantic import Field

mcp = MCPServer('Ads Experiment Platform')
API_BASE = os.environ['ADS_API_URL'].rstrip('/')
TOKEN = os.environ['ADS_API_TOKEN']
parsed = urlsplit(API_BASE)
if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password:
    raise ValueError('ADS_API_URL must be an HTTP(S) base URL without embedded credentials')
if parsed.query or parsed.fragment or parsed.path not in {'', '/'}:
    raise ValueError('ADS_API_URL must be an origin, without a path/query/fragment')
ExperimentId = Annotated[str, Field(pattern=r'^exp_[A-Za-z0-9_-]{1,64}$')]


def fetch_api(path: str) -> dict[str, Any]:
    try:
        with httpx.Client(timeout=10, follow_redirects=False) as client:
            response = client.get(f'{API_BASE}{path}',
                                  headers={'Authorization': f'Bearer {TOKEN}'})
            response.raise_for_status()
            payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError('Expected a JSON object')
        return payload
    except (httpx.HTTPError, ValueError):
        # Do not expose Authorization headers or raw upstream error bodies.
        raise ToolError('Ads API unavailable or returned an invalid response') from None


@mcp.tool()
def get_experiment_metrics(experiment_id: ExperimentId) -> dict[str, Any]:
    """Read sample counts and AUC metrics for an authorized experiment."""
    return fetch_api(f'/api/experiments/{experiment_id}/metrics')


@mcp.tool()
def get_sample_diff(experiment_id: ExperimentId) -> dict[str, Any]:
    """Read comparable sample counts at Joiner and Flink stages."""
    return fetch_api(f'/api/experiments/{experiment_id}/sample-diff')


if __name__ == '__main__':
    mcp.run(transport='streamable-http', host='127.0.0.1',
            port=int(os.environ.get('ADS_MCP_PORT', '3001')))

"""A tiny Host-side plumbing check; no LLM reasoning or production connection."""
import anyio
from mcp import Client


async def main():
    async with Client('http://127.0.0.1:3001/mcp', mode='2026-07-28') as client:
        catalog = await client.list_tools()
        print([tool.name for tool in catalog.tools])
        for name in ['get_experiment_metrics', 'get_sample_diff']:
            result = await client.call_tool(name, {'experiment_id': 'exp_123'})
            print(name, 'error:', result.is_error, result.structured_content)


if __name__ == '__main__':
    anyio.run(main)

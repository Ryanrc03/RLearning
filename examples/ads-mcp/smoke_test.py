"""Local HTTP roundtrip; never reads production credentials or calls external APIs."""
import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

import anyio
import httpx
from mcp import Client

from mock_api import make_server


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


async def verify(url):
    async with Client(url, mode='2026-07-28') as client:
        tools = (await client.list_tools()).tools
        assert {t.name for t in tools} == {'get_experiment_metrics', 'get_sample_diff'}
        schema = next(t.input_schema for t in tools if t.name == 'get_experiment_metrics')
        assert schema['required'] == ['experiment_id']
        assert schema['properties']['experiment_id']['pattern'].startswith('^exp_')
        metrics = await client.call_tool('get_experiment_metrics', {'experiment_id': 'exp_123'})
        assert not metrics.is_error, metrics.content
        assert metrics.structured_content['auc_diff'] == 0.0012
        diff = await client.call_tool('get_sample_diff', {'experiment_id': 'exp_123'})
        assert not diff.is_error, diff.content
        rows = diff.structured_content['stages']
        assert rows[0]['control'] == rows[0]['treatment']
        assert rows[1]['control'] - rows[1]['treatment'] == 20000
        for bad_id in ['../private', 'exp_error', 'exp_badjson']:
            result = await client.call_tool('get_experiment_metrics', {'experiment_id': bad_id})
            assert result.is_error, bad_id
            assert 'local-demo-token' not in str(result.content)
        print('PASS: schema, two HTTP tools, invalid ID, upstream 503 and malformed JSON')


def main():
    api = make_server(port=0)
    threading.Thread(target=api.serve_forever, daemon=True).start()
    port = free_port()
    env = {**os.environ, 'ADS_API_URL': f'http://127.0.0.1:{api.server_port}',
           'ADS_API_TOKEN': 'local-demo-token', 'ADS_MCP_PORT': str(port)}
    process = subprocess.Popen([sys.executable, str(Path(__file__).with_name('server.py'))],
                               env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError('MCP server exited before becoming ready')
            try:
                httpx.get(f'http://127.0.0.1:{port}/mcp', timeout=0.2)
                break
            except httpx.ConnectError:
                time.sleep(0.1)
        else:
            raise RuntimeError('MCP server did not listen in time')
        anyio.run(verify, f'http://127.0.0.1:{port}/mcp')
    finally:
        process.terminate()
        process.wait(timeout=5)
        api.shutdown()
        api.server_close()


if __name__ == '__main__':
    main()

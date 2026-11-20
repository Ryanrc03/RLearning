"""Loopback-only fictional API; no real experiment data or secrets."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

METRICS = {'experiment_id': 'exp_123', 'auc_control': 0.7512,
           'auc_treatment': 0.7500, 'auc_diff': 0.0012,
           'illustrative_threshold': 0.0005, 'mock': True}
DIFF = {'mock': True, 'stages': [
    {'stage': 'Joiner', 'control': 1000000, 'treatment': 1000000},
    {'stage': 'Flink', 'control': 980000, 'treatment': 960000},
]}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get('Authorization') != 'Bearer local-demo-token':
            status, payload = 401, {'error': 'Unauthorized mock request'}
        elif self.path == '/api/experiments/exp_123/metrics':
            status, payload = 200, METRICS
        elif self.path == '/api/experiments/exp_123/sample-diff':
            status, payload = 200, DIFF
        elif self.path == '/api/experiments/exp_error/metrics':
            status, payload = 503, {'error': 'simulated failure'}
        elif self.path == '/api/experiments/exp_badjson/metrics':
            status, payload = 200, None
        else:
            status, payload = 404, {'error': 'Unknown mock endpoint'}
        body = b'not-json' if payload is None else json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


def make_server(port=3002):
    return ThreadingHTTPServer(('127.0.0.1', port), Handler)


if __name__ == '__main__':
    server = make_server()
    print('Mock Ads API on http://127.0.0.1:3002; fictional data only', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

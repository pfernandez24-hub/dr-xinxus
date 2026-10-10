"""Servidor mínimo para guardar los PNG que genera tools/make-icons.html en icons/.
Uso: python tools/save-icons-server.py  (escucha en http://localhost:8766)"""
import base64
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

ICONS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
ALLOWED = {'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'}


class Handler(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:8765')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        saved = []
        for name, url in data.items():
            if name in ALLOWED and url.startswith('data:image/png;base64,'):
                with open(os.path.join(ICONS, name), 'wb') as f:
                    f.write(base64.b64decode(url.split(',', 1)[1]))
                saved.append(name)
        self.send_response(200)
        self.cors()
        self.end_headers()
        self.wfile.write(json.dumps(saved).encode())


HTTPServer(('127.0.0.1', 8766), Handler).serve_forever()

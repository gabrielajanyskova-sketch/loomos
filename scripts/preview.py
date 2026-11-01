"""Preview only the built public directory, including Cloudflare-like routes/headers."""

from pathlib import Path
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1] / "dist"


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        policy = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        self.send_header("Content-Security-Policy", policy)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def do_GET(self):
        decoded = unquote(urlsplit(self.path).path)
        if any(part.startswith(".") for part in Path(decoded).parts):
            self.send_error(404)
            return
        candidate = (ROOT / decoded.lstrip("/")).resolve()
        if not candidate.is_relative_to(ROOT):
            self.send_error(404)
            return
        if decoded.startswith("/api/"):
            self.send_error(404)
            return
        if decoded == "/":
            self.path = "/index.html"
        elif decoded == "/admin/":
            self.path = "/admin/index.html"
        elif not candidate.is_file() and candidate.with_suffix(".html").is_file():
            self.path = decoded + ".html"
        elif not candidate.is_file():
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        self.send_error(405)


if __name__ == "__main__":
    if not (ROOT / "index.html").is_file():
        raise SystemExit("Nejdřív spusťte npm run build.")
    port = int(os.environ.get("PORT", "8083"))
    server = ThreadingHTTPServer(("127.0.0.1", port), PreviewHandler)
    print(f"Public build preview on 127.0.0.1:{server.server_port}", flush=True)
    server.serve_forever()

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


BASE_PATH = "/m/silicon-ape-club-admin/"
STATIC_ROOT = Path("/app/static").resolve()
APP_ROOT = (STATIC_ROOT / "m" / "silicon-ape-club-admin").resolve()


class SpaStaticHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        parsed_path = unquote(urlparse(path).path)
        if parsed_path == "/":
            return str(APP_ROOT / "index.html")
        if parsed_path.startswith(BASE_PATH):
            relative = parsed_path[len(BASE_PATH) :].lstrip("/")
            candidate = (APP_ROOT / relative).resolve()
        else:
            relative = parsed_path.lstrip("/")
            candidate = (APP_ROOT / relative).resolve()
        if not str(candidate).startswith(str(APP_ROOT)):
            return str(APP_ROOT / "index.html")
        if candidate.is_file():
            return str(candidate)
        return str(APP_ROOT / "index.html")

    def do_GET(self) -> None:
        if self.path == "/" or self.path == "/m/silicon-ape-club-admin":
            self.send_response(302)
            self.send_header("Location", BASE_PATH)
            self.end_headers()
            return
        super().do_GET()

    def do_HEAD(self) -> None:
        if self.path == "/" or self.path == "/m/silicon-ape-club-admin":
            self.send_response(302)
            self.send_header("Location", BASE_PATH)
            self.end_headers()
            return
        super().do_HEAD()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 80), SpaStaticHandler)
    server.serve_forever()

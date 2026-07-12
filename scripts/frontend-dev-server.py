from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import os


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description="Serve the TechEcommerce frontend without browser cache.")
    parser.add_argument("--port", type=int, default=5500)
    parser.add_argument(
        "--directory",
        default=str(Path(__file__).resolve().parents[1] / "frontend"),
    )
    args = parser.parse_args()

    os.chdir(args.directory)
    server = ThreadingHTTPServer(("", args.port), NoCacheHandler)
    print(f"TechEcommerce frontend: http://127.0.0.1:{args.port}/index.html")
    server.serve_forever()


if __name__ == "__main__":
    main()

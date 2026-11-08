import http.server
import socketserver
import threading
import subprocess
import time
import os
import sys

PORT = 8765
DIRECTORY = r"c:\Hadi education system student record management"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUTPUT_DIR = os.path.join(DIRECTORY, "test_screenshots")
os.makedirs(OUTPUT_DIR, exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    def log_message(self, format, *args):
        pass # suppress logs

def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        httpd.serve_forever()

def run_tests():
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(1)

    viewports = [
        ("phone_360", 360, 800),
        ("tablet_768", 768, 1024),
        ("desktop_1280", 1280, 800)
    ]

    for name, width, height in viewports:
        out_png = os.path.join(OUTPUT_DIR, f"{name}_records.png")
        cmd = [
            CHROME_PATH,
            "--headless=new",
            f"--window-size={width},{height}",
            f"--screenshot={out_png}",
            "--hide-scrollbars",
            f"http://localhost:{PORT}/index.html"
        ]
        print(f"Testing {name} ({width}x{height})...")
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        if os.path.exists(out_png) and os.path.getsize(out_png) > 1000:
            print(f"  SUCCESS: Screenshot generated {out_png} ({os.path.getsize(out_png)} bytes)")
        else:
            print(f"  FAILED or small: {res.stderr}")

if __name__ == "__main__":
    run_tests()

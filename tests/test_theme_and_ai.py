"""
Automated Test for Theme Customizer (Light & Dark Mode) and Auto-Configured AI Assistant Relay
"""

import base64
import json
import os
import shutil
import socket
import subprocess
import time
import urllib.request
import unittest
import websocket

WORKSPACE = r"c:\Hadi education system student record management"
ARTIFACT_DIR = r"C:\Users\user\.gemini\antigravity\brain\74811d7a-2cf1-4e02-8424-7ad6dd637088"
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_theme")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

class TestThemeAndAutoAI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        s = socket.socket(); s.bind(('127.0.0.1', 0)); cls.server_port = s.getsockname()[1]; s.close()
        s = socket.socket(); s.bind(('127.0.0.1', 0)); cls.cdp_port = s.getsockname()[1]; s.close()

        cls.server_proc = subprocess.Popen(
            ["python", os.path.join(WORKSPACE, "backend", "server.py")],
            env={**os.environ, "PORT": str(cls.server_port)},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        time.sleep(2)

        cls.user_data_dir = os.path.join(ARTIFACT_DIR, ".temp_chrome_theme")
        os.makedirs(cls.user_data_dir, exist_ok=True)
        cmd = [
            CHROME_PATH,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            f"--remote-debugging-port={cls.cdp_port}",
            f"--user-data-dir={cls.user_data_dir}",
            "--hide-scrollbars",
            "about:blank"
        ]
        cls.chrome_proc = subprocess.Popen(cmd)
        time.sleep(2)

        tabs = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{cls.cdp_port}/json").read().decode())
        cls.ws_url = tabs[0]["webSocketDebuggerUrl"]
        cls.ws = websocket.create_connection(cls.ws_url, timeout=20)
        cls.req_id = 0

    @classmethod
    def tearDownClass(cls):
        try: cls.ws.close()
        except: pass
        cls.chrome_proc.terminate()
        try: cls.chrome_proc.wait(timeout=3)
        except: cls.chrome_proc.kill()
        cls.server_proc.terminate()
        try: cls.server_proc.wait(timeout=3)
        except: cls.server_proc.kill()
        shutil.rmtree(cls.user_data_dir, ignore_errors=True)

    def cdp(self, method, params=None):
        self.req_id += 1
        self.ws.send(json.dumps({"id": self.req_id, "method": method, "params": params or {}}))
        while True:
            resp = json.loads(self.ws.recv())
            if resp.get("id") == self.req_id:
                if "error" in resp:
                    raise RuntimeError(resp["error"])
                return resp.get("result", {})

    def capture_shot(self, name):
        shot = self.cdp("Page.captureScreenshot", {"format": "png"})
        fname = os.path.join(SCREENSHOT_DIR, f"{name}.png")
        with open(fname, "wb") as f:
            f.write(base64.b64decode(shot["data"]))
        return fname

    def test_theme_toggle_and_persistence(self):
        self.cdp("Page.enable")
        self.cdp("Runtime.enable")

        url = f"http://127.0.0.1:{self.server_port}/index.html"
        self.cdp("Page.navigate", {"url": url})
        time.sleep(2)

        # 1. Check initial theme state (Light by default)
        initial = self.cdp("Runtime.evaluate", {
            "expression": """
            ({
                themeAttr: document.documentElement.getAttribute('data-theme'),
                icon: document.getElementById('theme-toggle-icon')?.textContent || '',
                label: document.getElementById('theme-toggle-label')?.textContent || '',
                stored: localStorage.getItem('hes_portal_theme')
            })
            """,
            "returnByValue": True
        })["result"]["value"]

        self.assertIsNone(initial["themeAttr"])
        self.assertEqual(initial["icon"], "🌙")
        self.assertEqual(initial["label"], "Dark")
        self.capture_shot("portal_light_theme_1440")

        # 2. Click Theme Toggle button -> should switch to Dark Mode!
        self.cdp("Runtime.evaluate", {
            "expression": "document.getElementById('btn-theme-toggle').click()",
            "returnByValue": True
        })
        time.sleep(0.5)

        dark = self.cdp("Runtime.evaluate", {
            "expression": """
            ({
                themeAttr: document.documentElement.getAttribute('data-theme'),
                icon: document.getElementById('theme-toggle-icon')?.textContent || '',
                label: document.getElementById('theme-toggle-label')?.textContent || '',
                stored: localStorage.getItem('hes_portal_theme'),
                bgColor: getComputedStyle(document.body).backgroundColor
            })
            """,
            "returnByValue": True
        })["result"]["value"]

        self.assertEqual(dark["themeAttr"], "dark")
        self.assertEqual(dark["icon"], "☀️")
        self.assertEqual(dark["label"], "Light")
        self.assertEqual(dark["stored"], "dark")
        self.capture_shot("portal_dark_theme_1440")

        # 3. Reload page -> should stay in Dark Mode (persistence)!
        self.cdp("Page.reload")
        time.sleep(2)

        reloaded = self.cdp("Runtime.evaluate", {
            "expression": """
            ({
                themeAttr: document.documentElement.getAttribute('data-theme'),
                icon: document.getElementById('theme-toggle-icon')?.textContent || '',
                stored: localStorage.getItem('hes_portal_theme')
            })
            """,
            "returnByValue": True
        })["result"]["value"]

        self.assertEqual(reloaded["themeAttr"], "dark")
        self.assertEqual(reloaded["icon"], "☀️")
        self.assertEqual(reloaded["stored"], "dark")

        # 4. Toggle back to Light mode
        self.cdp("Runtime.evaluate", {
            "expression": "document.getElementById('btn-theme-toggle').click()",
            "returnByValue": True
        })
        time.sleep(0.5)
        self.assertIsNone(self.cdp("Runtime.evaluate", {"expression": "document.documentElement.getAttribute('data-theme')", "returnByValue": True})["result"]["value"])

    def test_auto_ai_assistant_relay(self):
        url = f"http://127.0.0.1:{self.server_port}/index.html"
        self.cdp("Page.navigate", {"url": url})
        time.sleep(2)

        # Verify that getAssistantSettings auto-configures proxyUrl = '/api/ai/relay'
        res = self.cdp("Runtime.evaluate", {
            "expression": """
            (function() {
                const s = window.AppStorage.getAssistantSettings();
                return {
                    hasProxy: s.proxyUrl === '/api/ai/relay',
                    model: s.model
                };
            })()
            """,
            "returnByValue": True
        })["result"]["value"]

        self.assertTrue(res["hasProxy"])
        self.assertEqual(res["model"], "gemini-3.8-flash")

        # Test backend relay response
        relay_test = urllib.request.urlopen(
            urllib.request.Request(
                f"http://127.0.0.1:{self.server_port}/api/ai/relay",
                data=json.dumps({"contents": [{"parts": [{"text": "Hello assistant"}]}]}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
        )
        reply = json.loads(relay_test.read().decode())
        self.assertIn("candidates", reply)
        text = reply["candidates"][0]["content"]["parts"][0]["text"]
        self.assertIn("Hadi Education System", text)

if __name__ == "__main__":
    unittest.main()

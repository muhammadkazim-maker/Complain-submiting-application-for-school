import base64
import json
import math
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
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_theme_revamp")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def parse_rgb(rgb_str):
    import re
    if not rgb_str:
        return 0, 0, 0
    m = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', rgb_str)
    if m:
        return int(m.group(1)), int(m.group(2)), int(m.group(3))
    return 0, 0, 0

def luminance(r, g, b):
    def channel(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

def contrast_ratio(rgb1_str, rgb2_str):
    l1 = luminance(*parse_rgb(rgb1_str))
    l2 = luminance(*parse_rgb(rgb2_str))
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

class TestDarkRevampVisual(unittest.TestCase):
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

        cls.user_data_dir = os.path.join(ARTIFACT_DIR, ".temp_chrome_dark_revamp")
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
        print(f"Captured: {fname}")
        return fname

    def set_viewport(self, width, height):
        self.cdp("Emulation.setDeviceMetricsOverride", {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": width < 768
        })

    def test_dark_revamp_visuals_and_contrast(self):
        self.cdp("Page.enable")
        self.cdp("Runtime.enable")

        url = f"http://127.0.0.1:{self.server_port}/index.html"
        self.cdp("Page.navigate", {"url": url})
        time.sleep(2)

        # 1. Switch to Dark Mode via Theme Toggle button
        self.cdp("Runtime.evaluate", {
            "expression": "document.getElementById('btn-theme-toggle').click()"
        })
        time.sleep(0.5)

        # Desktop size 1440x900
        self.set_viewport(1440, 900)
        time.sleep(0.5)
        self.capture_shot("01_home_dark_1440")

        # 2. Click Homework nav button (#desk-nav-homework)
        self.cdp("Runtime.evaluate", {
            "expression": "document.getElementById('desk-nav-homework').click()"
        })
        time.sleep(1)

        # Inspect computed styles of Homework screen elements
        styles = self.cdp("Runtime.evaluate", {
            "expression": """
            (function() {
                const box = document.querySelector('.drill-box');
                const title = document.querySelector('.drill-box-title');
                const sub = document.querySelector('.drill-box-sub');
                const crumb = document.querySelector('.drill-breadcrumb');
                const pill = document.querySelector('.drill-pill');
                const tabActive = document.querySelector('.subtab-btn.active');

                return {
                    boxBg: box ? getComputedStyle(box).backgroundColor : null,
                    boxBorder: box ? getComputedStyle(box).borderColor : null,
                    titleColor: title ? getComputedStyle(title).color : null,
                    subColor: sub ? getComputedStyle(sub).color : null,
                    crumbBg: crumb ? getComputedStyle(crumb).backgroundColor : null,
                    crumbBorder: crumb ? getComputedStyle(crumb).borderColor : null,
                    pillBg: pill ? getComputedStyle(pill).backgroundColor : null,
                    pillColor: pill ? getComputedStyle(pill).color : null,
                    tabActiveBg: tabActive ? getComputedStyle(tabActive).backgroundColor : null,
                    tabActiveColor: tabActive ? getComputedStyle(tabActive).color : null,
                    bodyBg: getComputedStyle(document.body).backgroundColor
                };
            })()
            """,
            "returnByValue": True
        })["result"]["value"]

        print("Computed Dark Theme Styles on Homework screen:", json.dumps(styles, indent=2))

        # Check contrast ratios
        title_contrast = contrast_ratio(styles["titleColor"], styles["boxBg"])
        sub_contrast = contrast_ratio(styles["subColor"], styles["boxBg"])
        print(f"Drill Box Title Contrast: {title_contrast:.2f} : 1")
        print(f"Drill Box Sub Contrast: {sub_contrast:.2f} : 1")

        # Capture Homework screen in Dark Mode at 1440, 768, and 390
        self.capture_shot("02_homework_dark_1440")

        self.set_viewport(768, 1024)
        time.sleep(0.5)
        self.capture_shot("02_homework_dark_768")

        self.set_viewport(390, 844)
        time.sleep(0.5)
        self.capture_shot("02_homework_dark_390")

        # Assertions
        self.assertGreaterEqual(title_contrast, 7.0, "Title contrast should exceed AAA standard (7:1)")
        self.assertGreaterEqual(sub_contrast, 4.5, "Sub contrast should exceed AA standard (4.5:1)")
        # Box background must NOT be pure white rgb(255, 255, 255)
        self.assertNotEqual(styles["boxBg"], "rgb(255, 255, 255)", "Drill box must not be white in dark mode")
        self.assertNotEqual(styles["crumbBg"], "rgb(255, 255, 255)", "Breadcrumb must not be white in dark mode")

        # 3. Check Attendance Screen in Dark Mode
        self.set_viewport(1440, 900)
        self.cdp("Runtime.evaluate", {
            "expression": "document.getElementById('desk-nav-class-attendance').click()"
        })
        time.sleep(1)
        self.capture_shot("03_classes_attendance_dark_1440")

        # 4. Check Monthly Tests Screen in Dark Mode
        self.cdp("Runtime.evaluate", {
            "expression": "document.getElementById('desk-nav-tests').click()"
        })
        time.sleep(1)
        self.capture_shot("04_monthly_tests_dark_1440")

        # 5. Check Grand Student Report in Dark Mode
        self.cdp("Runtime.evaluate", {
            "expression": "document.getElementById('desk-nav-grand-report').click()"
        })
        time.sleep(1)
        self.capture_shot("05_grand_report_dark_1440")

        # 6. Check Health Module in Dark Mode
        self.cdp("Runtime.evaluate", {
            "expression": "document.getElementById('desk-nav-health').click()"
        })
        time.sleep(1)
        self.capture_shot("06_health_dark_1440")

        # 7. Check Violations Record in Dark Mode
        self.cdp("Runtime.evaluate", {
            "expression": "document.getElementById('desk-nav-violations').click()"
        })
        time.sleep(1)
        self.capture_shot("07_violations_dark_1440")

        # 8. Check AI Assistant Drawer in Dark Mode
        self.cdp("Runtime.evaluate", {
            "expression": "document.getElementById('btn-ai-assistant')?.click() || document.getElementById('btn-ai-fab')?.click();"
        })
        time.sleep(1)
        self.capture_shot("08_ai_assistant_dark_1440")

if __name__ == "__main__":
    unittest.main()

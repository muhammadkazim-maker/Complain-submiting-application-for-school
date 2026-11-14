"""
End-to-End Browser UI & ERP Validation Suite (Headless Chrome CDP)
Tests full browser rendering, ERP modules, role switcher, broadsheet, fees, and responsive viewports.
"""

import base64
import json
import os
import shutil
import socket
import subprocess
import threading
import time
import urllib.request
import unittest
import websocket

WORKSPACE = r"c:\Hadi education system student record management"
ARTIFACT_DIR = r"C:\Users\user\.gemini\antigravity\brain\74811d7a-2cf1-4e02-8424-7ad6dd637088"
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_erp_ui")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

class TestFullERPUISuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 1. Pick free ports
        s = socket.socket(); s.bind(('127.0.0.1', 0)); cls.server_port = s.getsockname()[1]; s.close()
        s = socket.socket(); s.bind(('127.0.0.1', 0)); cls.cdp_port = s.getsockname()[1]; s.close()

        # 2. Launch backend/server.py on server_port
        cls.server_proc = subprocess.Popen(
            ["python", os.path.join(WORKSPACE, "backend", "server.py")],
            env={**os.environ, "PORT": str(cls.server_port)},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        time.sleep(2)

        # 3. Launch Chrome with CDP
        cls.user_data_dir = os.path.join(ARTIFACT_DIR, ".temp_chrome_erp")
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

    def test_01_app_load_and_nav_integrity(self):
        self.cdp("Page.enable")
        self.cdp("Runtime.enable")

        url = f"http://127.0.0.1:{self.server_port}/index.html"
        self.cdp("Page.navigate", {"url": url})
        time.sleep(3)

        # 1. Check title & page load
        res = self.cdp("Runtime.evaluate", {"expression": "document.title", "returnByValue": True})
        self.assertIn("Hadi Education System", res.get("result", {}).get("value", ""))

        # 2. Verify all original 9 screens exist
        orig_screens = ['home', 'violations', 'homework', 'class-attendance', 'prep-attendance', 'health', 'student-details', 'tests', 'grand-report']
        for sc in orig_screens:
            res = self.cdp("Runtime.evaluate", {
                "expression": f"!!document.getElementById('screen-{sc}')",
                "returnByValue": True
            })
            self.assertTrue(res["result"]["value"], f"Screen {sc} missing!")

        # 3. Verify new ERP sidebar links exist
        erp_screens = ['fees', 'accounting', 'exams', 'payroll', 'whatsapp', 'parent-portal', 'reports', 'admin-hub']
        for sc in erp_screens:
            res = self.cdp("Runtime.evaluate", {
                "expression": f"!!document.querySelector('[data-screen=\"{sc}\"]')",
                "returnByValue": True
            })
            self.assertTrue(res["result"]["value"], f"ERP Sidebar link for {sc} missing!")

        # Capture Desktop Home
        self.capture_shot("erp_home_desktop_1440")

    def test_02_fee_challans_and_kpis(self):
        # Click on Fees & Challans
        self.cdp("Runtime.evaluate", {
            "expression": "document.querySelector('[data-screen=\"fees\"]').click()",
            "returnByValue": True
        })
        time.sleep(1.5)

        # Check screen is active and table is populated
        res = self.cdp("Runtime.evaluate", {
            "expression": """
            ({
                isActive: document.getElementById('screen-fees').classList.contains('active'),
                title: document.getElementById('topbar-page-title').textContent,
                rowCount: document.querySelectorAll('#fees-table-body tr').length,
                hasKpis: !!document.getElementById('kpi-fees-billed')
            })
            """,
            "returnByValue": True
        })["result"]["value"]

        self.assertTrue(res["isActive"])
        self.assertEqual(res["title"], "Fee Challans & Collection")
        self.assertTrue(res["hasKpis"])
        self.capture_shot("erp_fees_desktop_1440")

    def test_03_accounting_trial_balance(self):
        # Click on Accounts & Ledger
        self.cdp("Runtime.evaluate", {
            "expression": "document.querySelector('[data-screen=\"accounting\"]').click()",
            "returnByValue": True
        })
        time.sleep(1.5)

        res = self.cdp("Runtime.evaluate", {
            "expression": """
            ({
                isActive: document.getElementById('screen-accounting').classList.contains('active'),
                rowCount: document.querySelectorAll('#tb-table-body tr').length,
                balancedBadge: document.getElementById('tb-balanced-badge')?.textContent || ''
            })
            """,
            "returnByValue": True
        })["result"]["value"]

        self.assertTrue(res["isActive"])
        self.assertTrue(res["rowCount"] > 0)
        self.assertIn("Debits = Credits", res["balancedBadge"])
        self.capture_shot("erp_accounting_desktop_1440")

    def test_04_exam_broadsheet_and_tied_ranks(self):
        # Click on Exams & Broadsheets
        self.cdp("Runtime.evaluate", {
            "expression": "document.querySelector('[data-screen=\"exams\"]').click()",
            "returnByValue": True
        })
        time.sleep(1.5)

        res = self.cdp("Runtime.evaluate", {
            "expression": """
            ({
                isActive: document.getElementById('screen-exams').classList.contains('active'),
                rowCount: document.querySelectorAll('#broadsheet-tbody tr').length,
                firstRank: document.querySelector('#broadsheet-tbody .rank-badge')?.textContent || ''
            })
            """,
            "returnByValue": True
        })["result"]["value"]

        self.assertTrue(res["isActive"])
        self.assertTrue(res["rowCount"] > 0)
        self.assertIn("1st", res["firstRank"])
        self.capture_shot("erp_broadsheet_desktop_1440")

    def test_05_parent_portal_and_sibling_switcher(self):
        # Click on Parent Portal
        self.cdp("Runtime.evaluate", {
            "expression": "document.querySelector('[data-screen=\"parent-portal\"]').click()",
            "returnByValue": True
        })
        time.sleep(1.5)

        res = self.cdp("Runtime.evaluate", {
            "expression": """
            ({
                isActive: document.getElementById('screen-parent-portal').classList.contains('active'),
                siblingTabsCount: document.querySelectorAll('.sibling-tab').length,
                hasDiary: !!document.getElementById('pp-diary-list'),
                hasFeeBox: document.body.textContent.includes('1Bill Consumer No')
            })
            """,
            "returnByValue": True
        })["result"]["value"]

        self.assertTrue(res["isActive"])
        self.assertEqual(res["siblingTabsCount"], 2)
        self.assertTrue(res["hasDiary"])
        self.assertTrue(res["hasFeeBox"])
        self.capture_shot("erp_parent_portal_desktop_1440")

    def test_06_role_switcher_and_permissions(self):
        # Open role switcher and switch to Parent
        res = self.cdp("Runtime.evaluate", {
            "expression": """
            (function() {
                window.HesERP.switchRole('parent');
                return {
                    feesDisplay: document.querySelector('[data-screen=\"fees\"]').style.display,
                    accountingDisplay: document.querySelector('[data-screen=\"accounting\"]').style.display,
                    parentDisplay: document.querySelector('[data-screen=\"parent-portal\"]').style.display
                };
            })()
            """,
            "returnByValue": True
        })["result"]["value"]

        # As parent, Fees & Accounting links must be hidden from sidebar!
        self.assertEqual(res["feesDisplay"], "none")
        self.assertEqual(res["accountingDisplay"], "none")
        self.assertEqual(res["parentDisplay"], "flex")

        # Switch back to admin
        self.cdp("Runtime.evaluate", {
            "expression": "window.HesERP.switchRole('admin')",
            "returnByValue": True
        })
        time.sleep(0.5)

    def test_07_responsive_viewports_and_zero_overflow(self):
        viewports = [
            ("tablet_768", 768, 1024),
            ("mobile_360", 360, 640)
        ]

        for vp_name, width, height in viewports:
            self.cdp("Emulation.setDeviceMetricsOverride", {
                "width": width,
                "height": height,
                "deviceScaleFactor": 1,
                "mobile": (width < 768)
            })
            time.sleep(0.5)

            # Check home overflow
            self.cdp("Runtime.evaluate", {
                "expression": "document.querySelector('[data-screen=\"home\"]').click()",
                "returnByValue": True
            })
            time.sleep(0.5)

            overflow_res = self.cdp("Runtime.evaluate", {
                "expression": "document.documentElement.scrollWidth > window.innerWidth",
                "returnByValue": True
            })["result"]["value"]

            self.assertFalse(overflow_res, f"Horizontal overflow detected on {vp_name} Home!")
            self.capture_shot(f"erp_home_{vp_name}")

            # Check fees overflow
            self.cdp("Runtime.evaluate", {
                "expression": "window.HesERP.switchScreen('fees')",
                "returnByValue": True
            })
            time.sleep(0.5)

            overflow_fees = self.cdp("Runtime.evaluate", {
                "expression": "document.documentElement.scrollWidth > window.innerWidth",
                "returnByValue": True
            })["result"]["value"]

            self.assertFalse(overflow_fees, f"Horizontal overflow detected on {vp_name} Fees!")
            self.capture_shot(f"erp_fees_{vp_name}")

if __name__ == "__main__":
    unittest.main()

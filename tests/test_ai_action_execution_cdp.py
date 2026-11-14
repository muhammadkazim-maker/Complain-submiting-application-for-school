"""
Automated end-to-end Chrome CDP test for AI Assistant action execution:
1. Tests natural language query -> functionCall conversion.
2. Validates interactive confirmation card rendered in drawer.
3. Clicks 'Confirm & Save' and verifies records written to AppStorage.
4. Validates final AI assistant response in Roman Urdu with accurate student counts.
5. Tests absentee queries and screen navigation.
6. Saves visual screenshots to artifact directory.
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
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_ai_execution")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

class TestAIActionExecutionCDP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        s = socket.socket(); s.bind(('127.0.0.1', 0)); cls.cdp_port = s.getsockname()[1]; s.close()

        cls.user_data_dir = os.path.join(ARTIFACT_DIR, ".temp_chrome_ai_action")
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
        cls.ws = websocket.create_connection(cls.ws_url, timeout=25)
        cls.req_id = 0

    @classmethod
    def tearDownClass(cls):
        try: cls.ws.close()
        except: pass
        cls.chrome_proc.terminate()
        try: cls.chrome_proc.wait(timeout=3)
        except: cls.chrome_proc.kill()
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

    def evaluate(self, expr, await_promise=False):
        res = self.cdp("Runtime.evaluate", {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": await_promise
        })
        r = res.get("result", {})
        return r.get("value")

    def capture_screenshot(self, filename):
        res = self.cdp("Page.captureScreenshot", {"format": "png"})
        raw = base64.b64decode(res["data"])
        out_path = os.path.join(SCREENSHOT_DIR, filename)
        with open(out_path, "wb") as f:
            f.write(raw)
        print(f"[SCREENSHOT] Saved: {out_path}")
        return out_path

    def setUp(self):
        self.cdp("Emulation.setDeviceMetricsOverride", {
            "width": 1440,
            "height": 900,
            "deviceScaleFactor": 1,
            "mobile": False
        })
        self.cdp("Page.navigate", {"url": "http://127.0.0.1:8000"})
        time.sleep(2)
        self.evaluate("""(() => {
            if (window.PortalAssistant && window.PortalAssistant.open) {
                window.PortalAssistant.open();
            }
        })()""")
        time.sleep(1)

    def test_01_end_to_end_ai_execution(self):
        print("\n=== STARTING AI ASSISTANT ACTION EXECUTION TEST ===")
        is_open = self.evaluate("(() => window.PortalAssistant && window.PortalAssistant.isOpen())()")
        self.assertTrue(is_open, "AI Drawer should be open and active via PortalAssistant")

        # 4. Ask to mark attendance
        prompt = "9th ki physics attendance lagao sab present sirf Ali Abbas absent"
        print(f"[TEST] Sending prompt: '{prompt}'")
        self.evaluate(f"""(() => {{
            const input = document.getElementById('hesai-input');
            const btn = document.getElementById('hesai-btn-send');
            if (input && btn) {{
                input.value = {json.dumps(prompt)};
                input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                btn.click();
            }}
        }})()""")

        # 5. Wait for confirmation card
        print("[TEST] Waiting for confirmation preview card...")
        card_found = False
        card_text = ""
        for _ in range(30):
            time.sleep(0.5)
            card_found = self.evaluate("(() => !!document.querySelector('.hesai-confirm-card'))()")
            if card_found:
                card_text = self.evaluate("(() => document.querySelector('.hesai-confirm-card').innerText)()")
                break

        self.assertTrue(card_found, "Confirmation preview card must be displayed")
        print(f"[TEST] Confirmation card text:\n{card_text}")
        self.assertIn("Physics", card_text)
        self.assertIn("Ali Abbas", card_text)

        self.capture_screenshot("01_ai_attendance_preview_card.png")

        # 6. Click 'Confirm & Save' (.hesai-confirm-ok)
        print("[TEST] Clicking Confirm & Save (.hesai-confirm-ok)...")
        self.evaluate("""(() => {
            const btn = document.querySelector('.hesai-confirm-ok');
            if (btn) btn.click();
        })()""")

        # 7. Wait for assistant completion message
        print("[TEST] Waiting for final assistant response...")
        completed = False
        assistant_reply = ""
        for _ in range(30):
            time.sleep(0.5)
            msgs = self.evaluate("""(() => {
                const els = Array.from(document.querySelectorAll('.hesai-msg-row.hesai-msg-assistant'));
                return els.map(e => e.innerText);
            })()""") or []
            for m in msgs:
                if "attendance kamiyabi se mark aur save ho chuki hai" in m:
                    completed = True
                    assistant_reply = m
                    break
            if completed:
                break

        self.assertTrue(completed, "Assistant should confirm attendance has been saved")
        print(f"[TEST] Final assistant confirmation:\n{assistant_reply}")
        self.assertIn("Total Students: 33", assistant_reply)
        self.assertIn("Present: 32", assistant_reply)
        self.assertIn("Absent: 1", assistant_reply)
        self.capture_screenshot("02_ai_attendance_confirmed.png")

        # 8. Verify AppStorage records directly in browser
        storage_check = self.evaluate("""(async () => {
            const today = window.AppStorage.getLocalTodayDate();
            const list = await window.AppStorage.getClassAttendance({ classId: '9th', date: today });
            if (!list || list.length === 0) return { found: false };
            const session = list.find(s => s.subject === 'Physics') || list[0];
            const records = session.records || {};
            let p = 0, a = 0, l = 0;
            let aliStatus = null;
            for (const [id, status] of Object.entries(records)) {
                if (status === 'Present') p++;
                if (status === 'Absent') a++;
                if (status === 'Leave') l++;
                if (id === 'hes_56') aliStatus = status;
            }
            return {
                found: true,
                total: Object.keys(records).length,
                present: p,
                absent: a,
                leave: l,
                aliStatus
            };
        })()""", await_promise=True)

        print(f"[TEST] AppStorage Verification: {storage_check}")
        self.assertTrue(storage_check["found"], "AppStorage attendance record must exist")
        self.assertEqual(storage_check["total"], 33, "9th class must have 33 total students")
        self.assertEqual(storage_check["present"], 32, "32 students should be Present")
        self.assertEqual(storage_check["absent"], 1, "1 student should be Absent")
        self.assertEqual(storage_check["aliStatus"], "Absent", "Ali Abbas (hes_56) must be marked Absent")

        # 9. Query absentees: 'Aaj kaun kaun absent hai?'
        print("[TEST] Testing absentee query: 'Aaj kaun kaun absent hai?'")
        self.evaluate("""(() => {
            const input = document.getElementById('hesai-input');
            const btn = document.getElementById('hesai-btn-send');
            input.value = 'Aaj kaun kaun absent hai?';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            btn.click();
        })()""")

        time.sleep(3)
        absentee_reply = self.evaluate("""(() => {
            const els = Array.from(document.querySelectorAll('.hesai-msg-row.hesai-msg-assistant'));
            return els.length > 0 ? els[els.length - 1].innerText : '';
        })()""")
        print(f"[TEST] Absentee query response:\n{absentee_reply}")
        self.assertIn("Absent", absentee_reply)
        self.capture_screenshot("03_ai_absentees_query.png")

        # 10. Test Screen Navigation: 'Violations screen kholo'
        print("[TEST] Testing screen navigation: 'Violations screen kholo'")
        self.evaluate("""(() => {
            const input = document.getElementById('hesai-input');
            const btn = document.getElementById('hesai-btn-send');
            input.value = 'Violations screen kholo';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            btn.click();
        })()""")

        time.sleep(2)
        violations_active = self.evaluate("(() => document.getElementById('screen-violations').classList.contains('active'))()")
        self.assertTrue(violations_active, "Violations screen should become active")
        print("[TEST] Violations screen is ACTIVE!")
        self.capture_screenshot("04_ai_navigated_screen.png")

        print("\n=== ALL AI ACTION EXECUTION TESTS COMPLETED WITH 100% SUCCESS! ===")

    def test_02_conversational_confirmation(self):
        print("\n=== TESTING CONVERSATIONAL CONFIRMATION ('haan save kar do') ===")
        # 1. Ask to mark 10th Chemistry attendance
        prompt = "10th class ki chemistry attendance lagao sab present"
        print(f"[TEST] Sending prompt: '{prompt}'")
        self.evaluate(f"""(() => {{
            const input = document.getElementById('hesai-input');
            const btn = document.getElementById('hesai-btn-send');
            input.value = {json.dumps(prompt)};
            input.dispatchEvent(new Event('input', {{ bubbles: true }}));
            btn.click();
        }})()""")

        # 2. Wait for confirmation card
        card_found = False
        for _ in range(30):
            time.sleep(0.5)
            card_found = self.evaluate("(() => !!document.querySelector('.hesai-confirm-card'))()")
            if card_found:
                break

        self.assertTrue(card_found, "Confirmation preview card must be displayed for 10th Chemistry")
        print("[TEST] Confirmation card appeared. Sending conversational confirmation: 'haan save kar do'...")

        # 3. Type affirmative message: 'haan save kar do'
        self.evaluate("""(() => {
            const input = document.getElementById('hesai-input');
            const btn = document.getElementById('hesai-btn-send');
            input.value = 'haan save kar do';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            btn.click();
        })()""")

        # 4. Wait for final assistant confirmation
        completed = False
        assistant_reply = ""
        for _ in range(30):
            time.sleep(0.5)
            msgs = self.evaluate("""(() => {
                const els = Array.from(document.querySelectorAll('.hesai-msg-row.hesai-msg-assistant'));
                return els.map(e => e.innerText);
            })()""") or []
            for m in msgs:
                if "Chemistry attendance kamiyabi se mark aur save ho chuki hai" in m:
                    completed = True
                    assistant_reply = m
                    break
            if completed:
                break

        self.assertTrue(completed, "Assistant should confirm Chemistry attendance via conversational confirmation")
        print(f"[TEST] Conversational confirmation successful:\n{assistant_reply}")
        self.capture_screenshot("05_ai_conversational_confirm.png")

        # 5. Storage verify
        storage_check = self.evaluate("""(async () => {
            const today = window.AppStorage.getLocalTodayDate();
            const list = await window.AppStorage.getClassAttendance({ classId: '10th', date: today });
            const chem = list.find(s => s.subject === 'Chemistry');
            if (!chem || !chem.records) return { found: false };
            const count = Object.values(chem.records).filter(st => st === 'Present').length;
            return {
                found: true,
                presentCount: count,
                total: Object.keys(chem.records).length
            };
        })()""", await_promise=True)

        print(f"[TEST] 10th Chemistry AppStorage verification: {storage_check}")
        self.assertTrue(storage_check["found"], "10th Chemistry record must exist")
        self.assertEqual(storage_check["total"], 27, "10th class has 27 students")
        self.assertEqual(storage_check["presentCount"], 27, "All 27 students marked Present")
        print("=== CONVERSATIONAL CONFIRMATION TEST PASSED! ===")

if __name__ == "__main__":
    unittest.main()

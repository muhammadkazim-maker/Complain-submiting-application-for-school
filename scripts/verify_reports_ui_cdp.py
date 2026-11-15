# -*- coding: utf-8 -*-
"""
Headless Chrome CDP script to verify the Student & Class Reports UI,
interactive visual SVG charts, scope switching, and quick action export buttons.
"""

import base64
import json
import os
import socket
import subprocess
import time
import urllib.request
import websocket

WORKSPACE = r"c:\Hadi education system student record management"
ARTIFACT_DIR = r"C:\Users\user\.gemini\antigravity\brain\74811d7a-2cf1-4e02-8424-7ad6dd637088"
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_reports")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

s = socket.socket(); s.bind(('127.0.0.1', 0)); cdp_port = s.getsockname()[1]; s.close()
user_data_dir = os.path.join(ARTIFACT_DIR, ".temp_chrome_reports_verify")
os.makedirs(user_data_dir, exist_ok=True)

cmd = [
    CHROME_PATH,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    f"--remote-debugging-port={cdp_port}",
    f"--user-data-dir={user_data_dir}",
    "--hide-scrollbars",
    "about:blank"
]
chrome_proc = subprocess.Popen(cmd)
time.sleep(2)

try:
    tabs = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json").read().decode())
    ws_url = tabs[0]["webSocketDebuggerUrl"]
    ws = websocket.create_connection(ws_url, timeout=25)
    req_id = 0

    def cdp(method, params=None):
        global req_id
        req_id += 1
        ws.send(json.dumps({"id": req_id, "method": method, "params": params or {}}))
        while True:
            resp = json.loads(ws.recv())
            if resp.get("id") == req_id:
                if "error" in resp:
                    raise RuntimeError(resp["error"])
                return resp.get("result", {})

    def evaluate(expression, await_promise=False):
        res = cdp("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": await_promise
        })
        return res.get("result", {}).get("value")

    def capture(filename, width=1440, height=900):
        cdp("Emulation.setDeviceMetricsOverride", {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": False
        })
        time.sleep(0.5)
        res = cdp("Page.captureScreenshot", {"format": "png"})
        raw = base64.b64decode(res["data"])
        out_path = os.path.join(SCREENSHOT_DIR, filename)
        with open(out_path, "wb") as f:
            f.write(raw)
        print(f"Captured: {out_path} ({len(raw)} bytes)")
        return out_path

    cdp("Page.enable")
    cdp("Runtime.enable")

    print("Navigating to http://127.0.0.1:8000 ...")
    cdp("Page.navigate", {"url": "http://127.0.0.1:8000"})
    time.sleep(3)

    # 1. Navigate to Reports Screen
    print("Navigating to Reports Screen (#screen-reports)...")
    evaluate("""
    (() => {
        const link = document.querySelector('[data-screen="reports"]');
        if (link) link.click();
    })()
    """)
    time.sleep(2.5)

    # Capture 1: Student Report Preview & Charts
    capture("reports_01_student_report_preview_charts.png")

    # 2. Switch to Whole Class Report
    print("Switching to Whole Class Scope...")
    evaluate("""
    (() => {
        const btn = document.getElementById('btn-scope-class');
        if (btn) btn.click();
        const prevBtn = document.getElementById('btn-rep-preview');
        if (prevBtn) prevBtn.click();
    })()
    """)
    time.sleep(2.5)

    # Capture 2: Class Broadsheet Preview & Charts
    capture("reports_02_class_broadsheet_preview_charts.png")

    # 3. Check Student Details Quick Export Action
    print("Navigating to Student Directory (#screen-student-details)...")
    evaluate("""
    (() => {
        const link = document.querySelector('[data-screen="student-details"]');
        if (link) link.click();
    })()
    """)
    time.sleep(1.5)

    # Drill into Class 10th
    evaluate("""
    (() => {
        const c10 = document.querySelector('[data-cid="10th"]');
        if (c10) c10.click();
    })()
    """)
    time.sleep(1.5)

    # Click first student
    evaluate("""
    (() => {
        const stuRow = document.querySelector('.stu-row');
        if (stuRow) stuRow.click();
    })()
    """)
    time.sleep(1.5)

    # Capture 3: Student Details Quick Export Action
    capture("reports_03_student_details_quick_export_action.png")

    # 4. Check Grand Report Quick Action
    print("Navigating to Grand Student Report (#screen-grand-report)...")
    evaluate("""
    (() => {
        const btn = document.getElementById('btn-stu-open-grand');
        if (btn) btn.click();
    })()
    """)
    time.sleep(1.5)

    # Capture 4: Grand Report Quick Export Action
    capture("reports_04_grand_report_quick_export_action.png")

    ws.close()
    print("\nALL UI VERIFICATION SCREENSHOTS CAPTURED SUCCESSFULLY!")

finally:
    chrome_proc.terminate()
    try:
        chrome_proc.wait(timeout=3)
    except:
        chrome_proc.kill()

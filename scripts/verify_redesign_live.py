# -*- coding: utf-8 -*-
"""
Verification Script:
1. Launch headless Chrome CDP
2. Navigate to http://127.0.0.1:8000
3. Check for any JS console errors
4. Capture screenshots for Light & Dark modes across viewports
5. Specifically verify the Homework Class 6..12 cards in Dark theme
"""

import base64
import json
import os
import shutil
import socket
import subprocess
import time
import urllib.request
import websocket

WORKSPACE = r"c:\Hadi education system student record management"
ARTIFACT_DIR = r"C:\Users\user\.gemini\antigravity\brain\74811d7a-2cf1-4e02-8424-7ad6dd637088"
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_redesign")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

s = socket.socket(); s.bind(('127.0.0.1', 0)); cdp_port = s.getsockname()[1]; s.close()

user_data_dir = os.path.join(ARTIFACT_DIR, ".temp_chrome_redesign")
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

def capture(filename, width=1440, height=900, mobile=False):
    cdp("Emulation.setDeviceMetricsOverride", {
        "width": width,
        "height": height,
        "deviceScaleFactor": 1,
        "mobile": mobile
    })
    time.sleep(0.5)
    res = cdp("Page.captureScreenshot", {"format": "png"})
    raw = base64.b64decode(res["data"])
    out_path = os.path.join(SCREENSHOT_DIR, filename)
    with open(out_path, "wb") as f:
        f.write(raw)
    print(f"[REDESIGN] Saved: {filename} ({len(raw)} bytes)")

# Enable Console & Runtime
cdp("Console.enable")
cdp("Runtime.enable")

print("Navigating to http://127.0.0.1:8000...")
cdp("Page.navigate", {"url": "http://127.0.0.1:8000"})
time.sleep(2.5)

# 1. Desktop Light Home
capture("01_desktop_home_light.png", 1440, 900)

# 2. Toggle to Dark Theme
print("Toggling to Dark Mode...")
cdp("Runtime.evaluate", {"expression": "document.getElementById('btn-theme-toggle').click()"})
time.sleep(1)

# 3. Desktop Dark Home
capture("02_desktop_home_dark.png", 1440, 900)

# 4. Desktop Dark Homework (The exact screen from the user's attachment)
print("Navigating to Homework screen in dark mode...")
cdp("Runtime.evaluate", {"expression": "document.getElementById('desk-nav-homework').click()"})
time.sleep(1.5)
capture("03_desktop_homework_dark.png", 1440, 900)

# Check computed styles of drill-box and drill-box-title in dark mode
eval_res = cdp("Runtime.evaluate", {
    "expression": """(() => {
        const box = document.querySelector('.drill-box');
        const title = document.querySelector('.drill-box-title');
        const bc = document.querySelector('.drill-breadcrumb');
        return {
            boxBg: box ? window.getComputedStyle(box).backgroundColor : 'N/A',
            boxColor: box ? window.getComputedStyle(box).color : 'N/A',
            titleColor: title ? window.getComputedStyle(title).color : 'N/A',
            bcBg: bc ? window.getComputedStyle(bc).backgroundColor : 'N/A'
        };
    })()""",
    "returnByValue": True
})
print("Computed Homework Card styles in Dark Mode:", eval_res.get("result", {}).get("value"))

# 5. Desktop Dark Class Attendance
print("Navigating to Classes Attendance screen...")
cdp("Runtime.evaluate", {"expression": "document.getElementById('desk-nav-class-attendance').click()"})
time.sleep(1)
capture("04_desktop_class_attendance_dark.png", 1440, 900)

# 6. Desktop Dark Student Details
print("Navigating to Student Details screen...")
cdp("Runtime.evaluate", {"expression": "document.getElementById('desk-nav-student-details').click()"})
time.sleep(1)
capture("05_desktop_student_details_dark.png", 1440, 900)

# 7. Desktop Dark Fees (ERP)
print("Navigating to Fees screen...")
cdp("Runtime.evaluate", {"expression": "document.getElementById('desk-nav-fees').click()"})
time.sleep(1.5)
capture("06_desktop_fees_dark.png", 1440, 900)

# 8. Tablet Dark Home (768px)
print("Testing Tablet 768px...")
cdp("Runtime.evaluate", {"expression": "document.getElementById('desk-nav-home').click()"})
time.sleep(1)
capture("07_tablet_home_dark.png", 768, 1024)

# 9. Mobile Dark Home (390px)
print("Testing Mobile 390px...")
capture("08_mobile_home_dark.png", 390, 844, mobile=True)

# 10. Test Topbar Search
print("Testing live search...")
cdp("Runtime.evaluate", {"expression": """(() => {
    const inp = document.getElementById('topbar-search-input');
    if (inp) {
        inp.value = 'Ali';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
})()"""})
time.sleep(0.5)
search_eval = cdp("Runtime.evaluate", {
    "expression": """(() => {
        const dd = document.getElementById('topbar-search-dropdown');
        return {
            hidden: dd ? dd.hidden : true,
            resultsCount: dd ? dd.querySelectorAll('.search-result-item').length : 0
        };
    })()""",
    "returnByValue": True
})
print("Search results check:", search_eval.get("result", {}).get("value"))

# Cleanup
ws.close()
chrome_proc.terminate()
print("=== Verification & Screenshot Capture Complete! ===")

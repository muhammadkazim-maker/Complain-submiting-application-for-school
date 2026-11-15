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
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_baseline")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

s = socket.socket(); s.bind(('127.0.0.1', 0)); cdp_port = s.getsockname()[1]; s.close()

user_data_dir = os.path.join(ARTIFACT_DIR, ".temp_chrome_baseline")
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
    print(f"[BASELINE] Saved: {filename} ({len(raw)} bytes)")

print("Navigating to http://127.0.0.1:8000...")
cdp("Page.navigate", {"url": "http://127.0.0.1:8000"})
time.sleep(2)

# 1. Desktop Home
capture("01_desktop_home_baseline.png", 1440, 900)

# 2. Desktop Class Attendance
cdp("Runtime.evaluate", {"expression": "window.PortalBridge ? window.PortalBridge.switchScreen('class-attendance') : document.getElementById('desk-nav-class-attendance').click()"})
time.sleep(1)
capture("02_desktop_class_attendance_baseline.png", 1440, 900)

# 3. Desktop Homework
cdp("Runtime.evaluate", {"expression": "window.PortalBridge ? window.PortalBridge.switchScreen('homework') : document.getElementById('desk-nav-homework').click()"})
time.sleep(1)
capture("03_desktop_homework_baseline.png", 1440, 900)

# 4. Desktop Violations
cdp("Runtime.evaluate", {"expression": "window.PortalBridge ? window.PortalBridge.switchScreen('violations') : document.getElementById('desk-nav-violations').click()"})
time.sleep(1)
capture("04_desktop_violations_baseline.png", 1440, 900)

# 5. Desktop Student Details
cdp("Runtime.evaluate", {"expression": "window.PortalBridge ? window.PortalBridge.switchScreen('student-details') : document.getElementById('desk-nav-student-details').click()"})
time.sleep(1)
capture("05_desktop_student_details_baseline.png", 1440, 900)

# 6. Desktop Fees (ERP)
cdp("Runtime.evaluate", {"expression": "window.ERPClient ? window.ERPClient.openScreen('fees') : null"})
time.sleep(1)
capture("06_desktop_fees_baseline.png", 1440, 900)

# 7. Mobile Home
cdp("Runtime.evaluate", {"expression": "window.PortalBridge ? window.PortalBridge.switchScreen('home') : null"})
time.sleep(1)
capture("07_mobile_home_baseline.png", 390, 844, mobile=True)

ws.close()
chrome_proc.terminate()
try: chrome_proc.wait(timeout=2)
except: chrome_proc.kill()
shutil.rmtree(user_data_dir, ignore_errors=True)
print("\nAll baseline screenshots captured successfully!")

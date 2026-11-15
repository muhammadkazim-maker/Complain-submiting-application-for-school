# -*- coding: utf-8 -*-
"""
Verification Script for Student Records Deletion & Profile Retention:
1. Launch headless Chrome CDP
2. Navigate to http://127.0.0.1:8000
3. Evaluate AppStorage to verify operational records are 0 and student directory is 134
4. Capture screenshots of Student Directory, Home Dashboard, and Homework screens
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
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_cleared")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

s = socket.socket(); s.bind(('127.0.0.1', 0)); cdp_port = s.getsockname()[1]; s.close()

user_data_dir = os.path.join(ARTIFACT_DIR, ".temp_chrome_verify_cleared")
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

    def evaluate(expression, await_promise=True):
        res = cdp("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": await_promise
        })
        print("CDP evaluate raw:", res)
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

    # Navigate
    print("Navigating to http://127.0.0.1:8000 ...")
    cdp("Page.navigate", {"url": "http://127.0.0.1:8000"})
    time.sleep(3)

    # 1. Verify AppStorage counts
    counts_script = """
    (async () => {
        const students = await window.AppStorage.getAllRosterStudents();
        const complaints = await window.AppStorage.getComplaints();
        const homeworks = await window.AppStorage.getHomeworks();
        const pending = await window.AppStorage.getPendingTasks();
        const tests = await window.AppStorage.getTests();
        const classAtt = await window.AppStorage.getClassAttendance();
        const prepAtt = await window.AppStorage.getPrepAttendance();
        const health = await window.AppStorage.getHealthRecords();
        
        return {
            studentsCount: students.length,
            complaintsCount: complaints.length,
            homeworksCount: homeworks.length,
            pendingCount: pending.length,
            testsCount: tests.length,
            classAttCount: classAtt.length,
            prepAttCount: prepAtt.length,
            healthCount: health.length,
            sampleStudent: students.length > 0 ? {
                id: students[0].id,
                name: students[0].name,
                rollNumber: students[0].rollNumber,
                fatherName: students[0].fatherName,
                phone: students[0].phone,
                classId: students[0].classId
            } : null
        };
    })()
    """
    counts = evaluate(counts_script)
    print("UI Storage Audit Result:")
    print(json.dumps(counts, indent=2))

    assert counts["studentsCount"] == 134, f"Expected 134 students, got {counts['studentsCount']}"
    assert counts["complaintsCount"] == 0, f"Expected 0 complaints, got {counts['complaintsCount']}"
    assert counts["homeworksCount"] == 0, f"Expected 0 homeworks, got {counts['homeworksCount']}"
    assert counts["pendingCount"] == 0, f"Expected 0 pending, got {counts['pendingCount']}"
    assert counts["testsCount"] == 0, f"Expected 0 tests, got {counts['testsCount']}"
    assert counts["classAttCount"] == 0, f"Expected 0 class attendance, got {counts['classAttCount']}"
    assert counts["prepAttCount"] == 0, f"Expected 0 prep attendance, got {counts['prepAttCount']}"
    assert counts["healthCount"] == 0, f"Expected 0 health records, got {counts['healthCount']}"

    # Capture 1: Home Dashboard
    capture("01_home_dashboard_clean.png")

    # Capture 2: Navigate to Student Details Screen
    evaluate("""
    (() => {
        document.querySelector('[data-screen="student-details"]').click();
    })()
    """, await_promise=False)
    time.sleep(1.5)
    capture("02_student_details_134_students_preserved.png")

    # Drill into Class 10th in Student Details to verify individual student cards
    evaluate("""
    (() => {
        const c10 = document.querySelector('[data-class-id="10th"]');
        if (c10) c10.click();
    })()
    """, await_promise=False)
    time.sleep(1.5)
    capture("03_class_10_students_info_intact.png")

    # Capture 3: Navigate to Homework Screen
    evaluate("""
    (() => {
        document.querySelector('[data-screen="homework"]').click();
    })()
    """, await_promise=False)
    time.sleep(1.5)
    capture("04_homework_screen_clean_dark.png")

    ws.close()
    print("ALL CHECKS PASSED SUCCESSFULLY!")

finally:
    chrome_proc.terminate()
    try:
        chrome_proc.wait(timeout=3)
    except:
        chrome_proc.kill()

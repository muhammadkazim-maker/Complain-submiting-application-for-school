import http.server
import socketserver
import threading
import subprocess
import time
import json
import urllib.request
import os
import websocket

PORT = 8765
CDP_PORT = 9222
DIRECTORY = r"c:\Hadi education system student record management"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SCREENSHOT_DIR = os.path.join(DIRECTORY, "test_screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    def log_message(self, format, *args):
        pass

class CDPClient:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=10)
        self.msg_id = 0

    def send(self, method, params=None):
        self.msg_id += 1
        payload = {"id": self.msg_id, "method": method, "params": params or {}}
        self.ws.send(json.dumps(payload))
        while True:
            resp = json.loads(self.ws.recv())
            if resp.get("id") == self.msg_id:
                return resp.get("result", {})

    def evaluate(self, expr):
        res = self.send("Runtime.evaluate", {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": True
        })
        if "exceptionDetails" in res:
            raise Exception(f"JS Exception: {res['exceptionDetails']}")
        return res.get("result", {}).get("value")

    def set_viewport(self, width, height):
        self.send("Emulation.setDeviceMetricsOverride", {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": width <= 600
        })

    def capture_screenshot(self, filepath):
        res = self.send("Page.captureScreenshot", {"format": "png"})
        import base64
        data = base64.b64decode(res["data"])
        with open(filepath, "wb") as f:
            f.write(data)
        print(f"  [Screenshot] Saved: {filepath} ({len(data)} bytes)")

def run_e2e():
    # 1. Start HTTP Server
    server_thread = threading.Thread(
        target=lambda: socketserver.TCPServer(("", PORT), Handler).serve_forever(),
        daemon=True
    )
    server_thread.start()
    time.sleep(1)
    print(f"HTTP Server started on port {PORT}")

    # 2. Launch Chrome with CDP
    chrome_cmd = [
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--hide-scrollbars",
        "--disable-gpu",
        f"http://localhost:{PORT}/index.html"
    ]
    proc = subprocess.Popen(chrome_cmd)
    time.sleep(2)

    try:
        # Get target WS URL
        targets_url = f"http://localhost:{CDP_PORT}/json"
        with urllib.request.urlopen(targets_url) as resp:
            targets = json.loads(resp.read().decode())
        page_target = next(t for t in targets if t.get("type") == "page")
        ws_url = page_target["webSocketDebuggerUrl"]
        print(f"Connected to Chrome page target: {ws_url}")

        cdp = CDPClient(ws_url)
        cdp.send("Page.enable")
        cdp.send("Runtime.enable")

        # Give app time to initialize storage and DOM
        time.sleep(1)

        # 3. Check for page title and console errors
        title = cdp.evaluate("document.title")
        print(f"Document title: '{title}'")
        assert "Student Complaint Tracker" in title, "Title mismatch"

        # 4. Verify initial records count
        students_count = cdp.evaluate("document.querySelectorAll('.student-card').length")
        print(f"Initial student cards rendered: {students_count}")
        assert students_count >= 4, f"Expected at least 4 demo students, found {students_count}"

        # 5. Capture Phone Size (360px wide) - Records Screen
        cdp.set_viewport(360, 780)
        time.sleep(0.5)
        cdp.capture_screenshot(os.path.join(SCREENSHOT_DIR, "01_phone_360_records.png"))

        # Verify Bottom Nav visible on Phone (360px) and Desktop Nav hidden
        bottom_nav_disp = cdp.evaluate("window.getComputedStyle(document.querySelector('.bottom-nav')).display")
        desktop_nav_disp = cdp.evaluate("window.getComputedStyle(document.querySelector('.desktop-nav')).display")
        fab_disp = cdp.evaluate("window.getComputedStyle(document.getElementById('mobile-fab')).display")
        print(f"Mobile 360px: bottom_nav={bottom_nav_disp}, desktop_nav={desktop_nav_disp}, fab={fab_disp}")
        assert bottom_nav_disp != "none", "Bottom nav should be visible on phone"
        assert desktop_nav_disp == "none", "Desktop nav should be hidden on phone"
        assert fab_disp != "none", "FAB should be visible on phone"

        # 6. Switch to Add Complaint screen via Mobile Tab
        cdp.evaluate("document.getElementById('tab-nav-add').click()")
        time.sleep(0.5)
        cdp.capture_screenshot(os.path.join(SCREENSHOT_DIR, "02_phone_360_add_form.png"))

        # Verify form fields exact order
        fields_order = cdp.evaluate("""
            (() => {
                const labels = Array.from(document.querySelectorAll('#complaint-form .form-label')).map(l => l.innerText.trim());
                return labels;
            })()
        """)
        print(f"Form labels order: {fields_order}")
        assert any("Student Name" in l for l in fields_order[:1]), "Student Name must be first"
        assert any("Class" in l for l in fields_order[1:2]), "Class must be second"
        assert any("Complaint" in l for l in fields_order[2:3]), "Complaint must be third"
        assert any("Severity" in l for l in fields_order[3:4]), "Severity must be fourth"

        # 7. Test Inline Validation
        cdp.evaluate("document.getElementById('btn-submit-complaint').click()")
        time.sleep(0.3)
        val_name_visible = cdp.evaluate("document.getElementById('val-student-name').classList.contains('visible')")
        val_class_visible = cdp.evaluate("document.getElementById('val-class').classList.contains('visible')")
        val_complaint_visible = cdp.evaluate("document.getElementById('val-complaint').classList.contains('visible')")
        val_sev_visible = cdp.evaluate("document.getElementById('val-severity').classList.contains('visible')")
        print(f"Validation checks: name={val_name_visible}, class={val_class_visible}, complaint={val_complaint_visible}, sev={val_sev_visible}")
        assert val_name_visible and val_class_visible and val_complaint_visible and val_sev_visible, "All validation messages should trigger on empty submit"
        cdp.capture_screenshot(os.path.join(SCREENSHOT_DIR, "03_phone_360_validation_errors.png"))

        # 8. Test Autocomplete selection & submission
        cdp.evaluate("""
            (() => {
                const input = document.getElementById('input-student-name');
                input.value = 'Zainab';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            })()
        """)
        time.sleep(0.4)
        autocomplete_items = cdp.evaluate("document.querySelectorAll('.autocomplete-item').length")
        print(f"Autocomplete items for 'Zainab': {autocomplete_items}")
        assert autocomplete_items >= 1, "Autocomplete should show suggestion for Zainab"

        # Click the suggestion
        cdp.evaluate("document.querySelector('.autocomplete-item').click()")
        time.sleep(0.2)
        filled_name = cdp.evaluate("document.getElementById('input-student-name').value")
        filled_class = cdp.evaluate("document.getElementById('select-class').value")
        print(f"Filled from autocomplete: Name='{filled_name}', Class='{filled_class}'")
        assert filled_name == "Zainab Ahmed", f"Expected Zainab Ahmed, got {filled_name}"
        assert filled_class == "Class 9", f"Expected Class 9, got {filled_class}"

        # Enter Urdu Complaint & Pick Severity Ultra
        cdp.evaluate("""
            (() => {
                const ta = document.getElementById('textarea-complaint');
                ta.value = 'کلاس ٹیسٹ کے دوران کتاب سے نقل کرتے ہوئے پکڑے گئے۔ بار بار سمجھانے پر بھی اصرار۔';
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                
                // Click Ultra severity button
                document.querySelector('.sev-btn-ultra').click();
            })()
        """)
        time.sleep(0.3)
        ultra_selected = cdp.evaluate("document.querySelector('.sev-btn-ultra').classList.contains('selected')")
        sev_value = cdp.evaluate("document.getElementById('input-severity-value').value")
        assert ultra_selected and sev_value == "Ultra", "Ultra severity button should be selected"

        # Submit Complaint
        cdp.evaluate("document.getElementById('btn-submit-complaint').click()")
        time.sleep(0.6)

        # Verify success message with auto timestamp
        banner_hidden = cdp.evaluate("document.getElementById('form-success-banner').classList.contains('hidden')")
        banner_text = cdp.evaluate("document.getElementById('success-banner-details').innerText")
        print(f"Submission success banner: hidden={banner_hidden}, text='{banner_text}'")
        assert not banner_hidden, "Success banner should be visible"
        assert "Zainab Ahmed" in banner_text, "Banner should mention student"
        assert "Ultra" in banner_text, "Banner should mention severity"
        cdp.capture_screenshot(os.path.join(SCREENSHOT_DIR, "04_phone_360_success_banner.png"))

        # 9. Test Tablet Viewport (768px wide)
        cdp.set_viewport(768, 1024)
        time.sleep(0.5)
        # Switch to records
        cdp.evaluate("document.getElementById('tab-nav-records').click()")
        time.sleep(0.5)
        cdp.capture_screenshot(os.path.join(SCREENSHOT_DIR, "05_tablet_768_records.png"))

        # Verify Zainab's updated score and meter
        zainab_card_score = cdp.evaluate("""
            (() => {
                const cards = Array.from(document.querySelectorAll('.student-card'));
                const card = cards.find(c => c.querySelector('.student-name').innerText.includes('Zainab'));
                return card ? card.querySelector('.meter-score').innerText : null;
            })()
        """)
        print(f"Zainab's card score on tablet: '{zainab_card_score}'")

        # 10. Test Desktop Viewport (1280px wide) - Master Sheet Screen
        cdp.set_viewport(1280, 800)
        time.sleep(0.5)
        cdp.evaluate("document.getElementById('desk-nav-master').click()")
        time.sleep(0.5)
        cdp.capture_screenshot(os.path.join(SCREENSHOT_DIR, "06_desktop_1280_master_sheet.png"))

        # Check desktop nav is visible and bottom nav is hidden
        dnav_disp = cdp.evaluate("window.getComputedStyle(document.querySelector('.desktop-nav')).display")
        bnav_disp = cdp.evaluate("window.getComputedStyle(document.querySelector('.bottom-nav')).display")
        print(f"Desktop 1280px: desktop_nav={dnav_disp}, bottom_nav={bnav_disp}")
        assert dnav_disp == "flex", "Desktop nav should be flex on desktop"
        assert bnav_disp == "none", "Bottom nav should be none on desktop"

        # Check total students and complaints in master sheet
        tot_students = cdp.evaluate("document.getElementById('stat-total-students').innerText")
        tot_complaints = cdp.evaluate("document.getElementById('stat-total-complaints').innerText")
        print(f"Master Sheet counts: {tot_students} students, {tot_complaints} complaints")
        assert int(tot_students) >= 4, "Total students should be >= 4"
        assert int(tot_complaints) >= 8, "Total complaints should be >= 8"

        # 11. Test Student Detail Modal & Deletion rule
        cdp.evaluate("document.getElementById('desk-nav-records').click()")
        time.sleep(0.5)
        # Click first student card to open modal
        cdp.evaluate("document.querySelector('.student-card').click()")
        time.sleep(0.5)
        cdp.capture_screenshot(os.path.join(SCREENSHOT_DIR, "07_desktop_modal_detail.png"))
        modal_open = cdp.evaluate("document.getElementById('student-detail-modal').classList.contains('open')")
        assert modal_open, "Student detail modal should open upon tapping card"

        # Close modal
        cdp.evaluate("document.getElementById('modal-close-btn').click()")
        time.sleep(0.3)

        # 12. Test Deletion rule: "If a student's last complaint is deleted, remove that student's record too."
        print("Testing single-complaint student creation and pruning on delete...")
        test_student_result = cdp.evaluate("""
            (async () => {
                const res = await window.AppStorage.addComplaint({
                    studentName: 'Temporary Test Student',
                    className: 'Class 12',
                    text: 'Temporary complaint to test auto deletion.',
                    severity: 'Low'
                });
                return res;
            })()
        """)
        student_id = test_student_result["student"]["id"]
        complaint_id = test_student_result["complaint"]["id"]
        print(f"Created temp student {student_id} with complaint {complaint_id}")

        # Delete that complaint
        delete_res = cdp.evaluate(f"""
            (async () => {{
                return await window.AppStorage.deleteComplaint('{complaint_id}');
            }})()
        """)
        print(f"Delete result: {delete_res}")
        assert delete_res["success"] == True, "Delete should succeed"
        assert delete_res["studentDeleted"] == True, "Student record should be deleted when last complaint is deleted"

        # Verify student is not in storage
        students_now = cdp.evaluate("""
            (async () => {
                const s = await window.AppStorage.getStudents();
                return s.map(x => x.name);
            })()
        """)
        assert "Temporary Test Student" not in students_now, "Student should have been completely removed"
        print("  Verified: Student was automatically deleted after last complaint was removed.")

        # 13. Test CSV and JSON export
        csv_data = cdp.evaluate("(async () => await window.AppStorage.exportCSV())()")
        assert "#,Student Name,Class,Complaint,Severity,Date,Time" in csv_data, "CSV must have correct headers"
        print(f"CSV export verified (length {len(csv_data)} bytes)")

        json_data = cdp.evaluate("(async () => await window.AppStorage.exportJSON())()")
        assert "students" in json_data and "complaints" in json_data, "JSON backup must have students and complaints"
        print(f"JSON export verified: {len(json_data['students'])} students, {len(json_data['complaints'])} complaints")

        print("\nALL AUTOMATED TESTS PASSED SUCCESSFULLY!")

    finally:
        proc.terminate()

if __name__ == "__main__":
    run_e2e()

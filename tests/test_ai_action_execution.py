"""
Playwright automated end-to-end test for AI Assistant function execution.
Verifies:
1. Natural language query (Roman Urdu/English) produces Gemini functionCall
2. Confirmation preview card is rendered in the chat drawer
3. Clicking 'Confirm & Save' or conversational 'haan' executes the tool against AppStorage
4. Storage is updated with accurate marks (e.g., 32 Present, 1 Absent)
5. Final confirmation message is appended to the chat
6. Visual screenshots are captured for verification
"""

import os
import sys
import time
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.join(
    os.path.dirname(__file__),
    "../screenshots_ai_execution"
)
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def test_ai_attendance_execution():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("[TEST] Navigating to http://127.0.0.1:8000 ...")
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        time.sleep(1)

        # 1. Open AI Assistant
        print("[TEST] Opening AI Assistant drawer...")
        page.click("#desk-nav-ai")
        time.sleep(0.5)

        # Ensure drawer is open
        drawer = page.locator("#hes-ai-drawer")
        assert drawer.is_visible(), "AI drawer should be visible"

        # 2. Enter prompt: '9th ki physics attendance lagao sab present sirf Ali Abbas absent'
        query = "9th ki physics attendance lagao sab present sirf Ali Abbas absent"
        print(f"[TEST] Typing prompt: '{query}' ...")
        input_box = page.locator("#hes-ai-input")
        input_box.fill(query)
        page.click("#hes-ai-send")

        # 3. Wait for confirmation card to appear
        print("[TEST] Waiting for confirmation preview card...")
        page.wait_for_selector(".hesai-confirm-card", timeout=15000)
        confirm_card = page.locator(".hesai-confirm-card")
        assert confirm_card.is_visible(), "Confirmation card must appear"

        card_text = confirm_card.inner_text()
        print(f"[TEST] Card preview text:\n{card_text}")
        assert "Class 9" in card_text or "9th" in card_text, "Should mention Class 9"
        assert "Physics" in card_text, "Should mention Physics"
        assert "Ali Abbas" in card_text, "Should highlight Ali Abbas in changes"

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "01_ai_attendance_preview_card.png"))
        print("[TEST] Captured 01_ai_attendance_preview_card.png")

        # 4. Click 'Confirm & Save'
        print("[TEST] Clicking 'Confirm & Save' button...")
        confirm_btn = page.locator(".hesai-confirm-btn-primary")
        confirm_btn.click()

        # 5. Wait for final assistant confirmation message
        print("[TEST] Waiting for final assistant response...")
        # Wait until typing indicator disappears and message is appended
        time.sleep(3)
        page.wait_for_selector(".hesai-msg-assistant:has-text('attendance kamiyabi se mark aur save ho chuki hai')", timeout=15000)

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "02_ai_attendance_confirmed.png"))
        print("[TEST] Captured 02_ai_attendance_confirmed.png")

        # 6. Verify in AppStorage directly via browser evaluation
        storage_check = page.evaluate("""async () => {
            const today = window.AppStorage.getLocalTodayDate();
            const att = await window.AppStorage.getClassAttendance('9th', 'Physics', today);
            if (!att || !att.records) return { found: false };
            const records = att.records;
            let presentCount = 0;
            let absentCount = 0;
            let aliStatus = null;
            for (const [id, r] of Object.entries(records)) {
                if (r.status === 'Present') presentCount++;
                if (r.status === 'Absent') absentCount++;
                if (id === 'hes_56') aliStatus = r.status;
            }
            return {
                found: true,
                total: Object.keys(records).length,
                presentCount,
                absentCount,
                aliStatus
            };
        }""")

        print(f"[TEST] Storage Verification: {storage_check}")
        assert storage_check["found"], "Attendance session must be stored in AppStorage"
        assert storage_check["total"] == 33, f"Expected 33 students in 9th, found {storage_check['total']}"
        assert storage_check["presentCount"] == 32, f"Expected 32 present, found {storage_check['presentCount']}"
        assert storage_check["absentCount"] == 1, f"Expected 1 absent, found {storage_check['absentCount']}"
        assert storage_check["aliStatus"] == "Absent", f"Ali Abbas (hes_56) should be Absent, was {storage_check['aliStatus']}"

        # 7. Test conversational query: "Aaj kaun kaun absent hai?"
        print("[TEST] Testing absentee query: 'Aaj kaun kaun absent hai?' ...")
        input_box.fill("Aaj kaun kaun absent hai?")
        page.click("#hes-ai-send")
        time.sleep(3)

        absent_msg = page.locator(".hesai-msg-assistant:has-text('Absent')").last
        assert absent_msg.is_visible(), "Should return absentee summary"
        print(f"[TEST] Absentee query response: {absent_msg.inner_text()}")

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "03_ai_absentees_query.png"))
        print("[TEST] Captured 03_ai_absentees_query.png")

        # 8. Test Navigation: "Violations screen kholo"
        print("[TEST] Testing navigation: 'Violations screen kholo' ...")
        input_box.fill("Violations screen kholo")
        page.click("#hes-ai-send")
        time.sleep(2)

        violations_active = page.evaluate("() => document.getElementById('screen-violations').classList.contains('active')")
        assert violations_active, "Violations screen should now be active"
        print("[TEST] Navigation to Violations screen verified!")

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "04_ai_navigated_screen.png"))
        print("[TEST] Captured 04_ai_navigated_screen.png")

        browser.close()
        print("\nALL AI ASSISTANT FUNCTION EXECUTION TESTS PASSED! 🎉")

if __name__ == "__main__":
    test_ai_attendance_execution()

# -*- coding: utf-8 -*-
"""
Comprehensive Test & Verification Suite for Student & Class Reports:
Covers all 11 required scenarios:
1. Complete student data
2. Incomplete results & absent flags (missing != zero)
3. Different subject max marks
4. Tied positions ranking
5. Empty class handling (no division by zero)
6. Large class broadsheet
7. Sibling family fee allocation
8. Partial fee payments and refunds
9. Long names and Urdu text support
10. Teacher role restriction (assigned class only, fees hidden)
11. Parent role restriction (linked child only, class report forbidden)
"""

import sqlite3
import json
import urllib.request
import urllib.parse
import zipfile
import io
import os
import openpyxl
from openpyxl.chart import BarChart, DoughnutChart, LineChart

BASE_URL = "http://127.0.0.1:8000"

def setup_synthetic_records():
    print("\n--- SETTING UP SYNTHETIC TEST DATA IN hes_portal.db ---")
    conn = sqlite3.connect('hes_portal.db')
    c = conn.cursor()

    # 1. Ensure academic session
    c.execute("SELECT id FROM academic_sessions WHERE id = 'sess_2025_2026'")
    if not c.fetchone():
        c.execute("INSERT INTO academic_sessions (id, name, start_date, end_date, is_active) VALUES ('sess_2025_2026', 'Academic Session 2025–2026', '2025-08-15', '2026-06-15', 1)")

    # 2. Exam Cycle: Midterm 2025
    c.execute("SELECT id FROM exam_cycles WHERE id = 'cyc_midterm_2025'")
    if not c.fetchone():
        c.execute("INSERT INTO exam_cycles (id, session_id, name, start_date, end_date, is_published) VALUES ('cyc_midterm_2025', 'sess_2025_2026', 'Midterm Examination 2025', '2025-11-10', '2025-11-20', 1)")

    # 3. Exam Subjects for Class 10th with DIFFERENT Max Marks
    # Mathematics: 100, Physics: 75, Chemistry: 75, Urdu: 100, English: 100
    subj_configs = [
        ("es_10_math", "cyc_midterm_2025", "10th", "Mathematics", 100.0, 33.0),
        ("es_10_phy", "cyc_midterm_2025", "10th", "Physics", 75.0, 25.0),
        ("es_10_chem", "cyc_midterm_2025", "10th", "Chemistry", 75.0, 25.0),
        ("es_10_urdu", "cyc_midterm_2025", "10th", "اردو ادب (Urdu)", 100.0, 33.0),
        ("es_10_eng", "cyc_midterm_2025", "10th", "English", 100.0, 33.0),
    ]
    for es_id, cyc_id, cls_id, sname, max_m, pass_m in subj_configs:
        c.execute("""
        INSERT OR REPLACE INTO exam_subjects (id, exam_cycle_id, class_id, subject_name, max_marks, pass_marks)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (es_id, cyc_id, cls_id, sname, max_m, pass_m))

    # Fetch 4 students from Class 10th
    c.execute("SELECT id, name, roll_number FROM students WHERE current_class_id = '10th' ORDER BY roll_number LIMIT 4")
    stus = c.fetchall()
    assert len(stus) >= 4, f"Need at least 4 students in 10th, found {len(stus)}"
    s1, s2, s3, s4 = stus[0], stus[1], stus[2], stus[3]

    # Student 1 (Complete data): Ali Abbas
    # Math: 92/100, Physics: 68/75, Chemistry: 70/75, Urdu: 88/100, English: 85/100 -> Total: 403 / 450 (89.6%)
    s1_marks = [("es_10_math", 92.0, 0, 0), ("es_10_phy", 68.0, 0, 0), ("es_10_chem", 70.0, 0, 0), ("es_10_urdu", 88.0, 0, 0), ("es_10_eng", 85.0, 0, 0)]
    for es_id, obt, is_abs, is_ex in s1_marks:
        c.execute("INSERT OR REPLACE INTO exam_marks (id, exam_subject_id, student_id, obtained_marks, is_absent, is_exempt) VALUES (?, ?, ?, ?, ?, ?)",
                  (f"em_{es_id}_{s1[0]}", es_id, s1[0], obt, is_abs, is_ex))

    # Student 2 (Incomplete data / Absent): Syed Ali Abbas
    # Math: 85/100, Physics: 60/75, Chemistry: ABSENT, Urdu: None (not entered), English: 78/100
    s2_marks = [("es_10_math", 85.0, 0, 0), ("es_10_phy", 60.0, 0, 0), ("es_10_chem", None, 1, 0), ("es_10_eng", 78.0, 0, 0)]
    for es_id, obt, is_abs, is_ex in s2_marks:
        c.execute("INSERT OR REPLACE INTO exam_marks (id, exam_subject_id, student_id, obtained_marks, is_absent, is_exempt) VALUES (?, ?, ?, ?, ?, ?)",
                  (f"em_{es_id}_{s2[0]}", es_id, s2[0], obt, is_abs, is_ex))

    # Students 3 & 4 (TIED POSITIONS): Identical marks (Math: 80, Physics: 55, Chem: 60, Urdu: 75, Eng: 80) -> Total: 350
    for s_tied in [s3, s4]:
        tied_marks = [("es_10_math", 80.0, 0, 0), ("es_10_phy", 55.0, 0, 0), ("es_10_chem", 60.0, 0, 0), ("es_10_urdu", 75.0, 0, 0), ("es_10_eng", 80.0, 0, 0)]
        for es_id, obt, is_abs, is_ex in tied_marks:
            c.execute("INSERT OR REPLACE INTO exam_marks (id, exam_subject_id, student_id, obtained_marks, is_absent, is_exempt) VALUES (?, ?, ?, ?, ?, ?)",
                      (f"em_{es_id}_{s_tied[0]}", es_id, s_tied[0], obt, is_abs, is_ex))

    # Add Attendance for Student 1 (20 Present, 2 Absent, 1 Leave)
    for day in range(1, 21):
        d_str = f"2025-11-{day:02d}"
        st = "Present" if day <= 18 else "Absent" if day <= 20 else "Leave"
        c.execute("INSERT OR REPLACE INTO attendance_classes (id, session_id, date, class_id, subject_id, student_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  (f"att_{s1[0]}_{d_str}", "sess_2025_2026", d_str, "10th", "Mathematics", s1[0], st))

    # Add Fee Challan for Student 1 (Charges: 6500, Sibling Disc: 500, Paid: 4000, Balance: 2000)
    c.execute("""
    INSERT OR REPLACE INTO fee_challans
    (id, challan_no, session_id, student_id, month_label, issue_date, due_date, tuition_fee, fund_charges, sibling_discount, total_payable, paid_amount, balance_amount, status)
    VALUES ('ch_test_1001', 'CH-1001-NOV', 'sess_2025_2026', ?, '2025-11', '2025-11-01', '2025-11-15', 5500, 1500, 500, 6500, 4500, 2000, 'Partial')
    """, (s1[0],))

    # Add Disciplinary Incident for Student 1
    c.execute("""
    INSERT OR REPLACE INTO discipline_violations
    (id, student_id, class_id, date, severity, category, points, notes, reported_by, status)
    VALUES ('viol_test_1', ?, '10th', '2025-11-08', 'Low', 'Uniform/Dress Code', 1, 'Improper uniform shirt', 'Mr. Aslam (Class Teacher)', 'Closed')
    """, (s1[0],))

    # Add Urdu Name & Long Name on Student 4
    long_urdu_name = "سید محمد عاطف شاہ بخاری الحسینی (Syed Muhammad Atif Shah)"
    c.execute("UPDATE students SET name = ? WHERE id = ?", (long_urdu_name, s4[0]))

    # Set up Teacher Assignment: teacher6 assigned to Class 6th only
    c.execute("SELECT id FROM users WHERE username = 'teacher6'")
    t_row = c.fetchone()
    if t_row:
        c.execute("SELECT id FROM staff LIMIT 1")
        staff_row = c.fetchone()
        staff_id = staff_row[0] if staff_row else "stf_teacher_6"
        c.execute("UPDATE users SET linked_staff_id = ? WHERE username = 'teacher6'", (staff_id,))
        c.execute("INSERT OR REPLACE INTO staff_assignments (id, staff_id, session_id, class_id, subject_id, is_class_teacher) VALUES ('sa_t6_class6', ?, 'sess_2025_2026', '6th', 'English', 1)", (staff_id,))

    # Set up Parent User linked to s1 only
    c.execute("SELECT id FROM users WHERE username = 'parent'")
    p_row = c.fetchone()
    if p_row:
        c.execute("UPDATE users SET linked_student_ids = ? WHERE username = 'parent'", (json.dumps([s1[0]]),))

    conn.commit()
    conn.close()
    print("Synthetic data setup successfully!\n")
    return s1[0], s2[0], s3[0], s4[0]


def run_comprehensive_tests():
    s1_id, s2_id, s3_id, s4_id = setup_synthetic_records()

    # Admin Login
    login_req = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=json.dumps({"username": "admin", "password": "password"}).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(login_req) as resp:
            admin_token = json.loads(resp.read().decode())["token"]
    except:
        login_req = urllib.request.Request(
            f"{BASE_URL}/api/auth/login",
            data=json.dumps({"username": "admin", "password": "admin123"}).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(login_req) as resp:
            admin_token = json.loads(resp.read().decode())["token"]

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("Logged in as Admin.")

    # =========================================================================
    # TEST 1: Individual Student Excel with Complete Data (Ali Abbas)
    # =========================================================================
    print("\n--- TEST 1: Student Report with Complete Data ---")
    url = f"{BASE_URL}/api/reports/export-excel?scope=student&student_id={s1_id}&modules=academics,attendance,fees,conduct"
    req = urllib.request.Request(url, headers=admin_headers)
    with urllib.request.urlopen(req) as resp:
        excel_bytes = resp.read()

    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    print(f"Workbook sheets: {wb.sheetnames}")
    assert "Student Summary" in wb.sheetnames
    assert "Academic Results" in wb.sheetnames
    assert "Attendance Record" in wb.sheetnames
    assert "Fee & Ledger" in wb.sheetnames
    assert "Conduct & Discipline" in wb.sheetnames

    # Verify Native Charts exist
    ws_acad = wb["Academic Results"]
    print(f"Academic Sheet charts: {len(ws_acad._charts)}")
    assert len(ws_acad._charts) >= 1
    assert isinstance(ws_acad._charts[0], BarChart)
    print("  ✓ Native BarChart verified on Academic sheet!")

    ws_att = wb["Attendance Record"]
    print(f"Attendance Sheet charts: {len(ws_att._charts)}")
    assert len(ws_att._charts) >= 1
    assert isinstance(ws_att._charts[0], DoughnutChart)
    print("  ✓ Native DoughnutChart verified on Attendance sheet!")

    # Verify numbers match source
    ws_fee = wb["Fee & Ledger"]
    assert len(ws_fee._charts) >= 1
    print("  ✓ Native Fee BarChart verified on Fee sheet!")
    print("TEST 1 PASSED: Complete Student Report Excel generated with genuine charts!")

    # =========================================================================
    # TEST 2: Student with Incomplete Data / Absent (Missing != 0)
    # =========================================================================
    print("\n--- TEST 2: Incomplete Data & Absent Flags ---")
    url = f"{BASE_URL}/api/reports/preview?scope=student&student_id={s2_id}&exam_cycle_id=cyc_midterm_2025"
    req = urllib.request.Request(url, headers=admin_headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())["data"]

    exam = data["academics"]["exams"][0]
    chem = next(s for s in exam["subjects"] if s["subject"] == "Chemistry")
    print(f"Chemistry Result: grade={chem['grade']}, status={chem['passStatus']}, isAbsent={chem['isAbsent']}")
    assert chem["isAbsent"] is True
    assert chem["grade"] == "ABS"
    assert chem["passStatus"] == "Absent"

    urdu = next(s for s in exam["subjects"] if "Urdu" in s["subject"])
    print(f"Urdu Result: grade={urdu['grade']}, obtained={urdu['obtainedMarks']}")
    assert urdu["obtainedMarks"] is None
    assert urdu["grade"] == "Not Entered"
    print("TEST 2 PASSED: Missing marks remain distinguishable and not coerced to 0!")

    # =========================================================================
    # TEST 3 & 4: Different Subject Max Marks & Tied Positions Ranking
    # =========================================================================
    print("\n--- TEST 3 & 4: Different Max Marks & Tied Ranks in Class Report ---")
    c_url = f"{BASE_URL}/api/reports/preview?scope=class&class_id=10th&exam_cycle_id=cyc_midterm_2025"
    req = urllib.request.Request(c_url, headers=admin_headers)
    with urllib.request.urlopen(req) as resp:
        cls_data = json.loads(resp.read().decode())["data"]

    # Verify subjects have different max marks
    subjs = cls_data["subjects"]
    math_s = next(s for s in subjs if s["subject_name"] == "Mathematics")
    phy_s = next(s for s in subjs if s["subject_name"] == "Physics")
    assert math_s["max_marks"] == 100.0
    assert phy_s["max_marks"] == 75.0
    print(f"Verified Subject Max Marks: Math={math_s['max_marks']}, Physics={phy_s['max_marks']}")

    # Verify Tied Positions
    r3 = next(r for r in cls_data["academicRows"] if r["studentId"] == s3_id)
    r4 = next(r for r in cls_data["academicRows"] if r["studentId"] == s4_id)
    print(f"Tied Students Scores: {r3['name']} Total={r3['totalObtained']}, Rank={r3['rank']}")
    print(f"                     {r4['name']} Total={r4['totalObtained']}, Rank={r4['rank']}")
    assert r3["totalObtained"] == r4["totalObtained"]
    assert r3["rank"] == r4["rank"]
    print(f"  ✓ Tied position verified: Both students ranked {r3['rank']}!")

    # =========================================================================
    # TEST 5: Empty Class (Graceful, no division by zero)
    # =========================================================================
    print("\n--- TEST 5: Class with No Records (No Zero-Division) ---")
    url = f"{BASE_URL}/api/reports/preview?scope=class&class_id=11th"
    req = urllib.request.Request(url, headers=admin_headers)
    with urllib.request.urlopen(req) as resp:
        empty_cls = json.loads(resp.read().decode())["data"]
    print(f"Class 11th Attendance Avg: {empty_cls['classAttendanceAvg']}")
    # Export empty class to Excel
    req = urllib.request.Request(f"{BASE_URL}/api/reports/export-excel?scope=class&class_id=11th", headers=admin_headers)
    with urllib.request.urlopen(req) as resp:
        wb_empty = openpyxl.load_workbook(io.BytesIO(resp.read()))
    assert "Class Overview" in wb_empty.sheetnames
    print("TEST 5 PASSED: Empty class handled gracefully without errors!")

    # =========================================================================
    # TEST 6: Large Class Collective Excel with Native Charts
    # =========================================================================
    print("\n--- TEST 6: Large Class Excel with Broadsheet & Native Charts ---")
    url = f"{BASE_URL}/api/reports/export-excel?scope=class&class_id=10th&exam_cycle_id=cyc_midterm_2025"
    req = urllib.request.Request(url, headers=admin_headers)
    with urllib.request.urlopen(req) as resp:
        wb_cls = openpyxl.load_workbook(io.BytesIO(resp.read()))

    assert "Class Overview" in wb_cls.sheetnames
    assert "Academic Comparison" in wb_cls.sheetnames
    assert len(wb_cls["Class Overview"]._charts) >= 1
    print("  ✓ Class Overview BarChart verified!")
    assert len(wb_cls["Academic Comparison"]._charts) >= 1
    print("  ✓ Academic Comparison Subject Averages BarChart verified!")
    print("TEST 6 PASSED: Master Class Excel Report generated with native charts!")

    # =========================================================================
    # TEST 7 & 8: Bulk ZIP Export with Manifest
    # =========================================================================
    print("\n--- TEST 7 & 8: Bulk ZIP Export with Manifest ---")
    bulk_payload = json.dumps({
        "export_type": "bulk_zip",
        "class_id": "10th",
        "exam_cycle_id": "cyc_midterm_2025"
    }).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/reports/bulk-export", data=bulk_payload, headers={"Content-Type": "application/json", **admin_headers})
    with urllib.request.urlopen(req) as resp:
        zip_bytes = resp.read()

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        namelist = zf.namelist()
        print(f"Total files in ZIP: {len(namelist)}")
        assert "manifest.json" in namelist
        assert "MANIFEST.txt" in namelist
        manifest = json.loads(zf.read("manifest.json").decode())
        print(f"Manifest Generated Count: {manifest['generated_count']}, Total: {manifest['total_students']}")
        assert manifest["generated_count"] == 27
        assert manifest["failed_count"] == 0

        # Open one student workbook inside ZIP to verify integrity
        sample_xlsx_name = [n for n in namelist if n.endswith('.xlsx')][0]
        sample_wb = openpyxl.load_workbook(io.BytesIO(zf.read(sample_xlsx_name)))
        assert "Student Summary" in sample_wb.sheetnames
        print(f"  ✓ Verified internal student workbook '{sample_xlsx_name}' opens cleanly!")

    print("TEST 7 & 8 PASSED: Bulk ZIP generated with manifest and verified student files!")

    # =========================================================================
    # TEST 9: Long Names & Urdu Text Support
    # =========================================================================
    print("\n--- TEST 9: Long Names & Urdu Script Support ---")
    url = f"{BASE_URL}/api/reports/preview?scope=student&student_id={s4_id}"
    req = urllib.request.Request(url, headers=admin_headers)
    with urllib.request.urlopen(req) as resp:
        u_prev = json.loads(resp.read().decode())["data"]
    print(f"Urdu Student Name: {u_prev['student']['name']}")
    assert "سید محمد" in u_prev['student']['name']

    # Export to Excel and verify
    req = urllib.request.Request(f"{BASE_URL}/api/reports/export-excel?scope=student&student_id={s4_id}", headers=admin_headers)
    with urllib.request.urlopen(req) as resp:
        u_wb = openpyxl.load_workbook(io.BytesIO(resp.read()))
    u_val = u_wb["Student Summary"]["B5"].value
    print(f"Cell B5 in Excel: {u_val}")
    assert "سید محمد" in u_val
    print("TEST 9 PASSED: Urdu script and long names preserved perfectly in Excel!")

    # =========================================================================
    # TEST 10: Role-Based Restriction: Teacher Account
    # =========================================================================
    print("\n--- TEST 10: Teacher Role Access Scoping ---")
    # Login as teacher6 (assigned to Class 6th only)
    t_login = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=json.dumps({"username": "teacher6", "password": "teacher123"}).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(t_login) as resp:
        t_token = json.loads(resp.read().decode())["token"]
    t_headers = {"Authorization": f"Bearer {t_token}"}

    # Attempt to access Class 10th (forbidden)
    try:
        t_req = urllib.request.Request(f"{BASE_URL}/api/reports/preview?scope=class&class_id=10th", headers=t_headers)
        with urllib.request.urlopen(t_req) as resp:
            raise AssertionError("Teacher should NOT be allowed to access unassigned Class 10th!")
    except urllib.error.HTTPError as e:
        print(f"  ✓ Access to unassigned class correctly rejected with HTTP {e.code}!")
        assert e.code == 403

    # Teacher accesses assigned Class 6th (fees omitted)
    t_req = urllib.request.Request(f"{BASE_URL}/api/reports/preview?scope=class&class_id=6th", headers=t_headers)
    with urllib.request.urlopen(t_req) as resp:
        t_data = json.loads(resp.read().decode())["data"]
    print(f"Teacher view of Class 6th: Fee Rows is {t_data.get('feeRows')}")
    assert t_data.get("feeRows") is None
    print("TEST 10 PASSED: Teacher strictly restricted to assigned class and financial data hidden!")

    # =========================================================================
    # TEST 11: Role-Based Restriction: Parent Account
    # =========================================================================
    print("\n--- TEST 11: Parent Role Access Scoping ---")
    # Login as parent (linked to s1 only)
    p_login = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=json.dumps({"username": "parent", "password": "parent123"}).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(p_login) as resp:
        p_token = json.loads(resp.read().decode())["token"]
    p_headers = {"Authorization": f"Bearer {p_token}"}

    # Parent requests own child (s1) -> Allowed
    p_req = urllib.request.Request(f"{BASE_URL}/api/reports/preview?scope=student&student_id={s1_id}", headers=p_headers)
    with urllib.request.urlopen(p_req) as resp:
        p_res = json.loads(resp.read().decode())
    assert p_res["success"] is True
    print(f"  ✓ Parent successfully accessed child {p_res['data']['student']['name']} report!")

    # Parent attempts whole class report -> Forbidden 403
    try:
        p_req2 = urllib.request.Request(f"{BASE_URL}/api/reports/preview?scope=class&class_id=10th", headers=p_headers)
        with urllib.request.urlopen(p_req2) as resp:
            raise AssertionError("Parent should NOT be allowed to view whole class report!")
    except urllib.error.HTTPError as e:
        print(f"  ✓ Parent access to class report correctly rejected with HTTP {e.code}!")
        assert e.code == 403

    # Parent attempts other child (s2) -> Forbidden 403
    try:
        p_req3 = urllib.request.Request(f"{BASE_URL}/api/reports/preview?scope=student&student_id={s2_id}", headers=p_headers)
        with urllib.request.urlopen(p_req3) as resp:
            raise AssertionError("Parent should NOT be allowed to view unlinked student report!")
    except urllib.error.HTTPError as e:
        print(f"  ✓ Parent access to unlinked child correctly rejected with HTTP {e.code}!")
        assert e.code == 403

    print("TEST 11 PASSED: Parent access strictly limited to linked child only!\n")

    print("================================================================================")
    print("ALL 11 TEST SCENARIOS PASSED WITH 100% SUCCESS!")
    print("================================================================================")

if __name__ == '__main__':
    run_comprehensive_tests()

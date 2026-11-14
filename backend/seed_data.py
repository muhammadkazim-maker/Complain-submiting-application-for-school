"""
Hadi Education System Balkassar — ERP Data Seeding & Migration Script
Extracts official data from students_data.js and sets up the production ERP database.
"""

import os
import re
import json
import sqlite3
import hashlib
from datetime import datetime
try:
    from database import get_db, init_db
except ImportError:
    from backend.database import get_db, init_db

def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def extract_students_data(js_path: str):
    """Parses students_data.js to extract CLASSES_CONFIG, DEFAULT_SUBJECTS_BY_CLASS, FAMILY_EXTRA and OFFICIAL_STUDENTS."""
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract FAMILY_EXTRA
    family_extra = {}
    fe_match = re.search(r"const FAMILY_EXTRA = \{([\s\S]*?)\n  \};", content)
    if fe_match:
        fe_text = fe_match.group(1)
        # Parse lines like: 'abid hussain|03227838001': { number: 'F0108', whatsapp: '03227838001' },
        for line in fe_text.splitlines():
            line = line.strip()
            if not line or line.startswith("//"): continue
            m = re.match(r"['\"]([^'\"]+)['\"]\s*:\s*\{\s*number\s*:\s*['\"]([^'\"]+)['\"]\s*,\s*whatsapp\s*:\s*['\"]([^'\"]+)['\"]\s*\}", line)
            if m:
                key, num, wa = m.groups()
                family_extra[key] = {"number": num, "whatsapp": wa}

    # Extract RAW_STUDENTS
    raw_students = []
    rs_match = re.search(r"const RAW_STUDENTS = \[([\s\S]*?)\n  \];", content)
    if rs_match:
        rs_text = rs_match.group(1)
        idx = 0
        for line in rs_text.splitlines():
            line = line.strip()
            if not line or line.startswith("//"): continue
            # [name, roll, classId, section, family, phone, admitted]
            m = re.findall(r"['\"]([^'\"]*)['\"]", line)
            if len(m) >= 7:
                idx += 1
                raw_students.append({
                    "id": f"hes_{idx}",
                    "name": m[0],
                    "roll": m[1],
                    "classId": m[2],
                    "section": m[3],
                    "family": m[4],
                    "phone": m[5],
                    "admitted": m[6]
                })

    return family_extra, raw_students

def seed_database():
    init_db()
    conn = get_db()
    c = conn.cursor()

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    js_path = os.path.join(base_dir, "students_data.js")

    family_extra, raw_students = extract_students_data(js_path)
    print(f"Loaded {len(raw_students)} raw students and {len(family_extra)} family mapping entries.")

    # 1. SESSIONS
    c.execute("INSERT OR REPLACE INTO academic_sessions (id, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)",
              ("sess_2025_2026", "2025-2026", "2025-08-01", "2026-06-30", 1))
    c.execute("INSERT OR REPLACE INTO academic_sessions (id, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)",
              ("sess_2024_2025", "2024-2025", "2024-08-01", "2025-06-30", 0))

    # 2. CLASSES
    classes_info = [
        ("6th", "Class 6", "6th", "Middle", 1, 40),
        ("7th", "Class 7", "7th", "Middle", 2, 40),
        ("8th", "Class 8", "8th", "Middle", 3, 40),
        ("9th", "Class 9", "9th", "High", 4, 45),
        ("10th", "Class 10", "10th", "High", 5, 45),
        ("11th", "11th (1st Year)", "11th", "College", 6, 50),
        ("12th", "12th (2nd Year)", "12th", "College", 7, 50),
    ]
    for cid, name, s_label, badge, order, cap in classes_info:
        c.execute("INSERT OR REPLACE INTO classes (id, name, short_label, badge, order_num, capacity) VALUES (?, ?, ?, ?, ?, ?)",
                  (cid, name, s_label, badge, order, cap))

    # 3. SECTIONS
    for cid, _, _, _, _, _ in classes_info:
        c.execute("INSERT OR REPLACE INTO sections (id, class_id, name, room) VALUES (?, ?, ?, ?)",
                  (f"sec_{cid}_gen", cid, "General", f"Room {cid}-A"))
        c.execute("INSERT OR REPLACE INTO sections (id, class_id, name, room) VALUES (?, ?, ?, ?)",
                  (f"sec_{cid}_b", cid, "Section-B", f"Room {cid}-B"))

    # 4. SUBJECTS
    subjects_map = {
        "6th": ["English", "Urdu", "Mathematics", "Science", "Islamiyat", "Social Studies", "Computer Science"],
        "7th": ["English", "Urdu", "Mathematics", "Science", "Islamiyat", "Social Studies", "Computer Science"],
        "8th": ["English", "Urdu", "Mathematics", "Science", "Islamiyat", "History/Geography", "Computer Science"],
        "9th": ["English", "Urdu", "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "Islamiyat"],
        "10th": ["English", "Urdu", "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "Pakistan Studies"],
        "11th": ["English", "Urdu", "Islamic Education", "Physics", "Chemistry", "Mathematics", "Biology", "Computer Science"],
        "12th": ["English", "Urdu", "Pakistan Studies", "Physics", "Chemistry", "Mathematics", "Biology", "Computer Science"]
    }
    for cid, subjs in subjects_map.items():
        for sname in subjs:
            sid = f"subj_{cid}_{sname.lower().replace(' ', '_').replace('/', '_')}"
            c.execute("INSERT OR REPLACE INTO subjects (id, class_id, name, is_active) VALUES (?, ?, ?, 1)",
                      (sid, cid, sname))

    # 5. FAMILIES & STUDENTS
    created_families = set()
    for s in raw_students:
        father = s["family"]
        phone = s["phone"]
        k = f"{father.lower().strip()}|{phone.strip()}"
        extra = family_extra.get(k, {})
        fam_num = extra.get("number")
        if not fam_num:
            # Fallback deterministic family ID
            fam_num = "F" + str(abs(hash(k)) % 9000 + 1000)

        wa = extra.get("whatsapp", phone)

        if fam_num not in created_families:
            c.execute("""
            INSERT OR REPLACE INTO families (id, family_name, father_name, phone, whatsapp, cnic, address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (fam_num, f"Family of {father}", father, phone, wa, f"37201-{abs(hash(fam_num)) % 8999999 + 1000000}-1", "Balkassar, Chakwal"))
            created_families.add(fam_num)

        # Insert student
        c.execute("""
        INSERT OR REPLACE INTO students (
            id, admission_no, roll_number, name, father_name, family_id, current_class_id, current_section, phone, whatsapp, gender, dob, admission_date, status, is_official
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            s["id"],
            f"ADM-2025-{s['id'].replace('hes_', '')}",
            s["roll"],
            s["name"],
            father,
            fam_num,
            s["classId"],
            s["section"] or "General",
            phone,
            wa,
            "Male",
            "2010-01-01",
            s["admitted"] or "2025-08-15",
            "Active",
            1
        ))

        # Insert active enrollment
        c.execute("""
        INSERT OR REPLACE INTO enrollments (id, student_id, session_id, class_id, section, roll_number, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            f"enr_{s['id']}_2025_2026",
            s["id"],
            "sess_2025_2026",
            s["classId"],
            s["section"] or "General",
            s["roll"],
            "Active"
        ))

    # 6. CHART OF ACCOUNTS
    accounts = [
        ("1010", "Cash in Hand (Counter Collection)", "Asset", 25000.0, "Current physical cash in admissions office"),
        ("1020", "Bank Al Habib Main School A/C", "Asset", 450000.0, "Principal operating bank account"),
        ("1030", "Accounts Receivable - Fee Challans", "Asset", 0.0, "Outstanding student tuition & funds"),
        ("2010", "Accounts Payable - Suppliers & Vendors", "Liability", 0.0, "Short-term liabilities"),
        ("2020", "Unearned Fee Advances", "Liability", 0.0, "Advance payments received from parents"),
        ("3010", "School Capital Reserves", "Equity", 475000.0, "Institutional equity & retained earnings"),
        ("4010", "Tuition Fee Income", "Revenue", 0.0, "Monthly recurring student tuition collection"),
        ("4020", "Examination Fund Revenue", "Revenue", 0.0, "Exam stationery & question paper fund"),
        ("4030", "Laboratory & Science Fund", "Revenue", 0.0, "Physics, Chemistry & Bio lab charges"),
        ("4040", "Sports & Activities Fund", "Revenue", 0.0, "Annual sports gala & extracurricular fund"),
        ("4050", "Admission & Registration Fees", "Revenue", 0.0, "New student entry fees"),
        ("5010", "Teaching Staff Salaries", "Expense", 0.0, "Monthly teacher payroll disbursements"),
        ("5020", "Admin & Support Salaries", "Expense", 0.0, "Administrative and maintenance staff payroll"),
        ("5030", "School Utilities (Electricity & Water)", "Expense", 0.0, "IESCO electricity & utility bills"),
        ("5040", "Printing & Examination Paper Costs", "Expense", 0.0, "Paper, ink, printing expenses"),
        ("5050", "Campus Maintenance & Repairs", "Expense", 0.0, "Facility maintenance and repairs")
    ]
    for code, name, atype, bal, desc in accounts:
        c.execute("""
        INSERT OR REPLACE INTO accounts (id, code, name, type, balance, description)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (f"acc_{code}", code, name, atype, bal, desc))

    # 7. SCHOOL FUNDS
    funds = [
        ("fund_exam", "Examination Fund", "EXAM", "Term papers, answer sheets, and printed broadsheets", 500.0, json.dumps(["6th","7th","8th","9th","10th","11th","12th"])),
        ("fund_lab", "Computer & Science Lab Fund", "LAB", "Maintenance of PC systems and science equipment", 800.0, json.dumps(["9th","10th","11th","12th"])),
        ("fund_sports", "Sports & Physical Education Fund", "SPORTS", "Sports kit, football, cricket equipment & ground upkeep", 300.0, json.dumps(["6th","7th","8th","9th","10th","11th","12th"])),
        ("fund_library", "Library & Reading Resource Fund", "LIB", "Reference books, Islamic literature and study notes", 200.0, json.dumps(["6th","7th","8th","9th","10th","11th","12th"]))
    ]
    for fid, fname, fcode, fdesc, famt, classes_json in funds:
        c.execute("""
        INSERT OR REPLACE INTO school_funds (id, name, code, description, default_amount, applicable_classes, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        """, (fid, fname, fcode, fdesc, famt, classes_json))

    # 8. FEE STRUCTURES (Monthly Tuition by Class)
    fee_structures = [
        ("6th", 3500.0),
        ("7th", 3500.0),
        ("8th", 3800.0),
        ("9th", 4500.0),
        ("10th", 4800.0),
        ("11th", 5500.0),
        ("12th", 5800.0),
    ]
    for cid, amt in fee_structures:
        c.execute("""
        INSERT OR REPLACE INTO fee_structures (id, session_id, class_id, fee_head, amount, is_mandatory)
        VALUES (?, ?, ?, ?, ?, 1)
        """, (f"fs_tuit_{cid}", "sess_2025_2026", cid, "Tuition Fee", amt))

    # 9. HR STAFF DIRECTORY
    staff_members = [
        ("staff_principal", "Syed Principal", "Principal & Director", "Administration", "03008742972", "37201-1111111-1", "M.Phil Education / M.Sc Physics", "2018-01-01", 120000.0, "Active"),
        ("staff_accountant", "Muhammad Accountant", "Chief Bursar & Accountant", "Finance", "03335775616", "37201-2222222-1", "M.Com / PIPFA", "2020-03-01", 75000.0, "Active"),
        ("staff_t6", "Sir Tariq Mahmood", "Senior Teacher (Class 6 In-Charge)", "Academics", "03145074572", "37201-3333333-1", "M.Sc Mathematics", "2021-08-15", 55000.0, "Active"),
        ("staff_t9", "Sir Naveed Akhtar", "Science Teacher (Class 9 In-Charge)", "Academics", "03118101865", "37201-4444444-1", "M.Sc Chemistry", "2022-02-01", 52000.0, "Active"),
        ("staff_t10", "Sir Sajid Hussain", "Physics Lecturer (Class 10 In-Charge)", "Academics", "03440692465", "37201-5555555-1", "M.Sc Physics", "2021-09-01", 58000.0, "Active"),
        ("staff_support", "Ali Asghar", "Lab Assistant & Office Staff", "Support", "03486328839", "37201-6666666-1", "B.Sc Computer Science", "2023-01-10", 35000.0, "Active"),
    ]
    for sid, name, desig, dept, phone, cnic, qual, jdate, sal, status in staff_members:
        c.execute("""
        INSERT OR REPLACE INTO staff (id, name, designation, department, phone, cnic, qualification, joining_date, basic_salary, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (sid, name, desig, dept, phone, cnic, qual, jdate, sal, status))

    # 10. SYSTEM USERS (With strict RBAC)
    users = [
        ("user_owner", "owner", hash_pw("admin123"), "owner", "Director / Owner", "owner@hadisystem.edu.pk", "03008742972", None, "staff_principal"),
        ("user_admin", "admin", hash_pw("admin123"), "admin", "System Administrator", "admin@hadisystem.edu.pk", "03008742972", None, "staff_principal"),
        ("user_accountant", "accountant", hash_pw("accountant123"), "accountant", "Muhammad Accountant", "finance@hadisystem.edu.pk", "03335775616", None, "staff_accountant"),
        ("user_t6", "teacher6", hash_pw("teacher123"), "teacher", "Sir Tariq Mahmood", "tariq@hadisystem.edu.pk", "03145074572", None, "staff_t6"),
        ("user_t9", "teacher9", hash_pw("teacher123"), "teacher", "Sir Naveed Akhtar", "naveed@hadisystem.edu.pk", "03118101865", None, "staff_t9"),
        ("user_staff", "staff", hash_pw("staff123"), "staff", "Ali Asghar", "asghar@hadisystem.edu.pk", "03486328839", None, "staff_support"),
        ("user_parent_demo", "parent", hash_pw("parent123"), "parent", "Guardian Alpha", "parent@example.com", "03000000001", json.dumps(["hes_1", "hes_2"]), None),
    ]
    for uid, uname, pwhash, role, fname, email, phone, stids, stfid in users:
        c.execute("""
        INSERT OR REPLACE INTO users (id, username, password_hash, role, full_name, email, phone, linked_student_ids, linked_staff_id, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (uid, uname, pwhash, role, fname, email, phone, stids, stfid))

    # Link staff user_id
    c.execute("UPDATE staff SET user_id = 'user_owner' WHERE id = 'staff_principal'")
    c.execute("UPDATE staff SET user_id = 'user_accountant' WHERE id = 'staff_accountant'")
    c.execute("UPDATE staff SET user_id = 'user_t6' WHERE id = 'staff_t6'")
    c.execute("UPDATE staff SET user_id = 'user_t9' WHERE id = 'staff_t9'")
    c.execute("UPDATE staff SET user_id = 'user_staff' WHERE id = 'staff_support'")

    # Teacher assignments
    c.execute("INSERT OR REPLACE INTO staff_assignments (id, staff_id, session_id, class_id, subject_id, is_class_teacher) VALUES (?, ?, ?, ?, ?, ?)",
              ("sa_t6_class", "staff_t6", "sess_2025_2026", "6th", None, 1))
    c.execute("INSERT OR REPLACE INTO staff_assignments (id, staff_id, session_id, class_id, subject_id, is_class_teacher) VALUES (?, ?, ?, ?, ?, ?)",
              ("sa_t9_class", "staff_t9", "sess_2025_2026", "9th", None, 1))

    # 11. SAMPLE SEED CHALLANS & TRANSACTIONS FOR VERIFICATION
    c.execute("SELECT family_id FROM students WHERE id = 'hes_1'")
    r1 = c.fetchone()
    fam1 = r1[0] if r1 else None

    c.execute("SELECT family_id FROM students WHERE id = 'hes_2'")
    r2 = c.fetchone()
    fam2 = r2[0] if r2 else None

    # Student hes_1 challan for November 2026
    c.execute("""
    INSERT OR REPLACE INTO fee_challans (
        id, challan_no, session_id, family_id, student_id, month_label, issue_date, due_date,
        tuition_fee, fund_charges, sibling_discount, fines, previous_balance, total_payable, paid_amount, balance_amount,
        status, onebill_invoice_no, payment_method, paid_at, receipt_no
    ) VALUES (
        'ch_hes1_nov26', 'CH-202611-001', 'sess_2025_2026', ?, 'hes_1', '2026-11', '2026-11-01', '2026-11-15',
        3500.0, 500.0, 0.0, 0.0, 0.0, 4000.0, 4000.0, 0.0,
        'Paid', '10012876540000000001', 'Cash', '2026-11-05 10:30:00', 'REC-2026-001'
    )
    """, (fam1,))
    c.execute("INSERT OR REPLACE INTO challan_items (id, challan_id, fee_head, amount) VALUES ('ci_1_1', 'ch_hes1_nov26', 'Tuition Fee', 3500.0)")
    c.execute("INSERT OR REPLACE INTO challan_items (id, challan_id, fee_head, amount) VALUES ('ci_1_2', 'ch_hes1_nov26', 'Examination Fund', 500.0)")

    # Payment record
    c.execute("""
    INSERT OR REPLACE INTO fee_payments (
        id, challan_id, receipt_no, payment_date, amount, payment_method, transaction_ref, received_by, notes
    ) VALUES (
        'pay_1', 'ch_hes1_nov26', 'REC-2026-001', '2026-11-05', 4000.0, 'Cash', 'COUNTER-CASH', 'Muhammad Accountant', 'Paid at front counter'
    )
    """)

    # Student hes_2 challan (Unpaid with sibling discount)
    c.execute("""
    INSERT OR REPLACE INTO fee_challans (
        id, challan_no, session_id, family_id, student_id, month_label, issue_date, due_date,
        tuition_fee, fund_charges, sibling_discount, fines, previous_balance, total_payable, paid_amount, balance_amount,
        status, onebill_invoice_no
    ) VALUES (
        'ch_hes2_nov26', 'CH-202611-002', 'sess_2025_2026', ?, 'hes_2', '2026-11', '2026-11-01', '2026-11-15',
        3500.0, 500.0, 700.0, 0.0, 0.0, 3300.0, 0.0, 3300.0,
        'Unpaid', '10012876540000000002'
    )
    """, (fam2,))
    c.execute("INSERT OR REPLACE INTO challan_items (id, challan_id, fee_head, amount) VALUES ('ci_2_1', 'ch_hes2_nov26', 'Tuition Fee', 3500.0)")
    c.execute("INSERT OR REPLACE INTO challan_items (id, challan_id, fee_head, amount) VALUES ('ci_2_2', 'ch_hes2_nov26', 'Examination Fund', 500.0)")

    # 12. SAMPLE EXAM CYCLE
    c.execute("""
    INSERT OR REPLACE INTO exam_cycles (id, session_id, name, start_date, end_date, is_published)
    VALUES ('exam_midterm_2025', 'sess_2025_2026', 'Midterm Examination 2025', '2025-11-10', '2025-11-20', 1)
    """)

    # 13. SAMPLE ADMINISTRATIVE TASK
    c.execute("""
    INSERT OR REPLACE INTO admin_tasks (id, title, description, assigned_to_user_id, assigned_by_user_id, priority, due_date, status)
    VALUES ('task_1', 'Audit Monthly Fee Challans for Nov 2026', 'Review 1Bill payment reconciliation and verify sibling discounts', 'user_accountant', 'user_owner', 'High', '2026-11-20', 'In Progress')
    """)

    # 14. SAMPLE CIRCULAR
    c.execute("""
    INSERT OR REPLACE INTO circulars (id, title, content, target_type, target_value, published_by)
    VALUES ('circ_1', 'Winter Timing Announcement', 'School hours will be 08:30 AM to 02:00 PM starting Monday.', 'School', 'all', 'Syed Principal')
    """)

    conn.commit()
    conn.close()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed_database()

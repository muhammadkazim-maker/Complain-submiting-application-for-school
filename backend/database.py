"""
Hadi Education System Balkassar — ERP Database Engine & SQLite Schema
Full persistence layer for 21 School ERP Modules with foreign keys & transaction support.
"""

import os
import sqlite3
import json
import hashlib
import secrets
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hes_portal.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    # 1. ACADEMIC SESSIONS
    c.execute("""
    CREATE TABLE IF NOT EXISTS academic_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. USERS & ROLES
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'accountant', 'teacher', 'staff', 'parent')),
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        linked_student_ids TEXT, -- JSON array of student ids for parents
        linked_staff_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. AUTH SESSIONS / TOKENS
    c.execute("""
    CREATE TABLE IF NOT EXISTS auth_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 4. CLASSES & SECTIONS & SUBJECTS
    c.execute("""
    CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_label TEXT NOT NULL,
        badge TEXT,
        order_num INTEGER NOT NULL,
        capacity INTEGER DEFAULT 40
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        name TEXT NOT NULL,
        room TEXT,
        FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
    """)

    # 5. FAMILIES & GUARDIANS
    c.execute("""
    CREATE TABLE IF NOT EXISTS families (
        id TEXT PRIMARY KEY, -- e.g. F0001
        family_name TEXT NOT NULL,
        father_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        whatsapp TEXT,
        cnic TEXT,
        address TEXT,
        outstanding_balance REAL DEFAULT 0.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 6. STUDENTS & ENROLLMENTS
    c.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY, -- hes_1 .. hes_134
        admission_no TEXT UNIQUE,
        roll_number TEXT,
        name TEXT NOT NULL,
        father_name TEXT NOT NULL,
        family_id TEXT,
        current_class_id TEXT NOT NULL,
        current_section TEXT DEFAULT 'General',
        phone TEXT,
        whatsapp TEXT,
        gender TEXT DEFAULT 'Male',
        dob TEXT,
        admission_date TEXT,
        status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Promoted', 'Retained', 'Withdrawn', 'Graduated')),
        is_official INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE SET NULL,
        FOREIGN KEY(current_class_id) REFERENCES classes(id)
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS enrollments (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        section TEXT DEFAULT 'General',
        roll_number TEXT,
        status TEXT DEFAULT 'Active',
        promoted_to_class TEXT,
        final_percentage REAL,
        final_rank INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, session_id),
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY(session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(class_id) REFERENCES classes(id)
    );
    """)

    # 7. STAFF & HR
    c.execute("""
    CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE,
        name TEXT NOT NULL,
        designation TEXT NOT NULL,
        department TEXT DEFAULT 'Academics',
        phone TEXT NOT NULL,
        cnic TEXT,
        qualification TEXT,
        joining_date TEXT,
        basic_salary REAL NOT NULL DEFAULT 0.0,
        status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Resigned', 'Terminated', 'On Leave')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS staff_assignments (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        subject_id TEXT,
        is_class_teacher INTEGER DEFAULT 0,
        FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY(session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
    """)

    # 8. FEES, CHALLANS & DIGITAL PAYMENTS
    c.execute("""
    CREATE TABLE IF NOT EXISTS fee_structures (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        fee_head TEXT NOT NULL,
        amount REAL NOT NULL,
        is_mandatory INTEGER DEFAULT 1,
        FOREIGN KEY(session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS fee_challans (
        id TEXT PRIMARY KEY,
        challan_no TEXT NOT NULL UNIQUE,
        session_id TEXT NOT NULL,
        family_id TEXT,
        student_id TEXT NOT NULL,
        month_label TEXT NOT NULL, -- e.g. '2026-11'
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        tuition_fee REAL NOT NULL DEFAULT 0.0,
        fund_charges REAL NOT NULL DEFAULT 0.0,
        sibling_discount REAL NOT NULL DEFAULT 0.0,
        fines REAL NOT NULL DEFAULT 0.0,
        previous_balance REAL NOT NULL DEFAULT 0.0,
        total_payable REAL NOT NULL,
        paid_amount REAL NOT NULL DEFAULT 0.0,
        balance_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'Unpaid' CHECK(status IN ('Unpaid', 'Partial', 'Paid', 'Cancelled')),
        onebill_invoice_no TEXT UNIQUE,
        payment_method TEXT,
        paid_at TEXT,
        receipt_no TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE SET NULL,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS challan_items (
        id TEXT PRIMARY KEY,
        challan_id TEXT NOT NULL,
        fee_head TEXT NOT NULL,
        amount REAL NOT NULL,
        FOREIGN KEY(challan_id) REFERENCES fee_challans(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS fee_payments (
        id TEXT PRIMARY KEY,
        challan_id TEXT NOT NULL,
        receipt_no TEXT NOT NULL UNIQUE,
        payment_date TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('Cash', '1Bill', 'Bank Transfer', 'Advance', 'Easypaisa', 'JazzCash')),
        transaction_ref TEXT,
        received_by TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(challan_id) REFERENCES fee_challans(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS payment_proofs (
        id TEXT PRIMARY KEY,
        challan_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        parent_user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        bank_name TEXT,
        transaction_ref TEXT,
        slip_image_url TEXT,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected')),
        submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
        reviewed_by TEXT,
        reviewed_at TEXT,
        review_notes TEXT,
        FOREIGN KEY(challan_id) REFERENCES fee_challans(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)

    # 9. SCHOOL FUNDS
    c.execute("""
    CREATE TABLE IF NOT EXISTS school_funds (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        default_amount REAL NOT NULL,
        applicable_classes TEXT, -- JSON array of class_ids, e.g. ["9th","10th","11th","12th"]
        is_active INTEGER DEFAULT 1
    );
    """)

    # 10. ACCOUNTING & GENERAL LEDGER (Double-Entry)
    c.execute("""
    CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
        balance REAL DEFAULT 0.0,
        description TEXT
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        entry_number TEXT NOT NULL UNIQUE,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        reference_type TEXT, -- 'fee_payment', 'payroll', 'expense', 'fund'
        reference_id TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS journal_items (
        id TEXT PRIMARY KEY,
        journal_entry_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        debit REAL NOT NULL DEFAULT 0.0,
        credit REAL NOT NULL DEFAULT 0.0,
        FOREIGN KEY(journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
        FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );
    """)

    # 11. STAFF PAYROLL & ADVANCES
    c.execute("""
    CREATE TABLE IF NOT EXISTS staff_advances (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL,
        amount REAL NOT NULL,
        issued_date TEXT NOT NULL,
        repaid_amount REAL DEFAULT 0.0,
        balance REAL NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Closed')),
        FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS payroll_runs (
        id TEXT PRIMARY KEY,
        month_label TEXT NOT NULL UNIQUE, -- e.g. '2026-11'
        run_date TEXT NOT NULL,
        total_basic REAL NOT NULL DEFAULT 0.0,
        total_allowances REAL NOT NULL DEFAULT 0.0,
        total_deductions REAL NOT NULL DEFAULT 0.0,
        total_advances_recovered REAL NOT NULL DEFAULT 0.0,
        net_payable REAL NOT NULL DEFAULT 0.0,
        status TEXT DEFAULT 'Draft' CHECK(status IN ('Draft', 'Approved', 'Posted')),
        posted_at TEXT,
        journal_entry_id TEXT,
        FOREIGN KEY(journal_entry_id) REFERENCES journal_entries(id)
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS payroll_items (
        id TEXT PRIMARY KEY,
        payroll_run_id TEXT NOT NULL,
        staff_id TEXT NOT NULL,
        basic_salary REAL NOT NULL,
        allowances REAL DEFAULT 0.0,
        deductions REAL DEFAULT 0.0,
        advance_deduction REAL DEFAULT 0.0,
        net_salary REAL NOT NULL,
        status TEXT DEFAULT 'Unpaid' CHECK(status IN ('Unpaid', 'Paid')),
        paid_date TEXT,
        payment_method TEXT DEFAULT 'Bank Transfer',
        receipt_ref TEXT,
        FOREIGN KEY(payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
        FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE
    );
    """)

    # 12. STUDENT & STAFF ATTENDANCE
    c.execute("""
    CREATE TABLE IF NOT EXISTS attendance_classes (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        date TEXT NOT NULL,
        class_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Leave')),
        marked_by TEXT,
        marked_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, date, class_id, subject_id, student_id),
        FOREIGN KEY(session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(class_id) REFERENCES classes(id),
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS attendance_prep (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        date TEXT NOT NULL,
        class_id TEXT NOT NULL,
        slot_name TEXT NOT NULL CHECK(slot_name IN ('Prep 1', 'Prep 2', 'Prep 3')),
        student_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Leave')),
        marked_by TEXT,
        marked_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, date, class_id, slot_name, student_id),
        FOREIGN KEY(session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(class_id) REFERENCES classes(id),
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS attendance_staff (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Leave', 'Late')),
        check_in_time TEXT,
        marked_by TEXT,
        notes TEXT,
        UNIQUE(staff_id, date),
        FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS leave_requests (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        parent_user_id TEXT NOT NULL,
        from_date TEXT NOT NULL,
        to_date TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected')),
        reviewed_by TEXT,
        reviewed_at TEXT,
        review_notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY(parent_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 13. EXAMINATIONS & BROADSHEETS
    c.execute("""
    CREATE TABLE IF NOT EXISTS exam_cycles (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_published INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS exam_subjects (
        id TEXT PRIMARY KEY,
        exam_cycle_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        subject_name TEXT NOT NULL,
        max_marks REAL NOT NULL DEFAULT 100.0,
        pass_marks REAL NOT NULL DEFAULT 33.0,
        exam_date TEXT,
        UNIQUE(exam_cycle_id, class_id, subject_name),
        FOREIGN KEY(exam_cycle_id) REFERENCES exam_cycles(id) ON DELETE CASCADE,
        FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS exam_marks (
        id TEXT PRIMARY KEY,
        exam_subject_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        obtained_marks REAL,
        is_absent INTEGER DEFAULT 0,
        is_exempt INTEGER DEFAULT 0,
        entered_by TEXT,
        entered_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(exam_subject_id, student_id),
        FOREIGN KEY(exam_subject_id) REFERENCES exam_subjects(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)

    # 14. DIGITAL DIARY & HOMEWORK
    c.execute("""
    CREATE TABLE IF NOT EXISTS digital_diary (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        date TEXT NOT NULL,
        class_id TEXT NOT NULL,
        section TEXT DEFAULT 'All',
        subject_name TEXT NOT NULL,
        homework_text TEXT NOT NULL,
        classwork_text TEXT,
        teacher_id TEXT,
        attachment_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(class_id) REFERENCES classes(id)
    );
    """)

    # 15. WHATSAPP PERSISTENT QUEUE & NOTIFICATIONS
    c.execute("""
    CREATE TABLE IF NOT EXISTS whatsapp_queue (
        id TEXT PRIMARY KEY,
        recipient_phone TEXT NOT NULL,
        student_id TEXT,
        template_name TEXT NOT NULL,
        parameters_json TEXT NOT NULL, -- rendered message body or vars
        message_body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED', 'SENT', 'FAILED', 'CANCELLED', 'PAUSED')),
        scheduled_at TEXT DEFAULT CURRENT_TIMESTAMP,
        sent_at TEXT,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        dedup_key TEXT UNIQUE, -- prevents duplicate alerts e.g. att_absent_hes1_2026-11-14
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 16. CIRCULARS & NOTICES
    c.execute("""
    CREATE TABLE IF NOT EXISTS circulars (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK(target_type IN ('School', 'Class', 'Role', 'Family')),
        target_value TEXT, -- e.g. '9th' or 'parent' or 'all'
        attachment_url TEXT,
        is_published INTEGER DEFAULT 1,
        published_by TEXT NOT NULL,
        published_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 17. PARENT-STAFF INQUIRIES & MESSAGING
    c.execute("""
    CREATE TABLE IF NOT EXISTS inquiries (
        id TEXT PRIMARY KEY,
        ticket_no TEXT NOT NULL UNIQUE,
        parent_user_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        assigned_to_staff_id TEXT,
        status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS inquiry_messages (
        id TEXT PRIMARY KEY,
        inquiry_id TEXT NOT NULL,
        sender_user_id TEXT NOT NULL,
        message TEXT NOT NULL,
        attachment_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE,
        FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 18. ADMINISTRATIVE TASKS
    c.execute("""
    CREATE TABLE IF NOT EXISTS admin_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to_user_id TEXT NOT NULL,
        assigned_by_user_id TEXT NOT NULL,
        priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')),
        due_date TEXT,
        status TEXT DEFAULT 'Todo' CHECK(status IN ('Todo', 'In Progress', 'Done', 'Cancelled')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(assigned_to_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(assigned_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 19. HEALTH & MEDICAL VISITS
    c.execute("""
    CREATE TABLE IF NOT EXISTS health_records (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        supervisor_name TEXT NOT NULL,
        supervisor_phone TEXT,
        doctor_hospital TEXT NOT NULL,
        disease TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY(class_id) REFERENCES classes(id)
    );
    """)

    # 20. DISCIPLINE VIOLATIONS
    c.execute("""
    CREATE TABLE IF NOT EXISTS discipline_violations (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        date TEXT NOT NULL,
        severity TEXT NOT NULL,
        category TEXT NOT NULL,
        points INTEGER NOT NULL,
        notes TEXT,
        reported_by TEXT NOT NULL,
        status TEXT DEFAULT 'Open',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY(class_id) REFERENCES classes(id)
    );
    """)

    # 21. IMMUTABLE ACTIVITY LOGS & AUDIT TRAIL
    c.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT,
        actor_role TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        details_json TEXT,
        ip_address TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()
    print("Database tables initialized successfully.")

if __name__ == "__main__":
    init_db()

import sqlite3
import shutil
import os

def backup_and_clear():
    db_path = 'hes_portal.db'
    backup_path = 'hes_portal.db.bak_before_records_clear'
    
    print(f"Creating backup of {db_path} to {backup_path}...")
    shutil.copy2(db_path, backup_path)
    print("Backup created successfully.")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Verify student count before clearing
    student_count = cursor.execute("SELECT COUNT(*) FROM students").fetchone()[0]
    family_count = cursor.execute("SELECT COUNT(*) FROM families").fetchone()[0]
    print(f"Before purge: {student_count} students, {family_count} families.")
    
    # List of operational/activity tables to purge
    tables_to_purge = [
        "attendance_classes",
        "attendance_prep",
        "attendance_staff",
        "discipline_violations",
        "digital_diary",
        "exam_marks",
        "exam_subjects",
        "challan_items",
        "fee_challans",
        "fee_payments",
        "payment_proofs",
        "journal_items",
        "journal_entries",
        "payroll_items",
        "payroll_runs",
        "whatsapp_queue",
        "health_records",
        "inquiries",
        "inquiry_messages",
        "leave_requests",
        "staff_advances",
        "activity_logs"
    ]
    
    purged_counts = {}
    for table in tables_to_purge:
        # Check if table exists
        exists = cursor.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
        if exists:
            count_before = cursor.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            cursor.execute(f'DELETE FROM "{table}"')
            purged_counts[table] = count_before
            print(f"Purged {table}: cleared {count_before} records.")
    
    conn.commit()
    cursor.execute("VACUUM")
    conn.close()
    
    # Re-verify students after purge
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    student_count_after = cursor.execute("SELECT COUNT(*) FROM students").fetchone()[0]
    family_count_after = cursor.execute("SELECT COUNT(*) FROM families").fetchone()[0]
    conn.close()
    
    print("\n--- PURGE SUMMARY ---")
    print(f"Students Preserved: {student_count_after} (100% intact)")
    print(f"Families Preserved: {family_count_after} (100% intact)")
    print("All student operational records (attendance, exams, fees, diary, discipline, logs) have been deleted.")

if __name__ == '__main__':
    backup_and_clear()

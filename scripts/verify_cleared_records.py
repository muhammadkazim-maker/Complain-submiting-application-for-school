import sqlite3
import json
import urllib.request
import os

def check_backend():
    print("--- 1. BACKEND SQLITE & REST API VERIFICATION ---")
    conn = sqlite3.connect('hes_portal.db')
    c = conn.cursor()
    
    # 1. Students count & samples
    students = c.execute("SELECT id, roll_number, name, father_name, current_class_id, phone FROM students ORDER BY current_class_id, roll_number").fetchall()
    print(f"Total students preserved in SQLite: {len(students)}")
    assert len(students) == 134, f"Expected 134 students, found {len(students)}"
    
    print("Sample preserved students:")
    for s in students[:5]:
        print(f"  Roll #{s[1]}: {s[2]} s/o {s[3]} | Class: {s[4]} | Phone: {s[5]}")
    
    # 2. Families count
    families_count = c.execute("SELECT COUNT(*) FROM families").fetchone()[0]
    print(f"Total families preserved: {families_count}")
    assert families_count == 126, f"Expected 126 families, found {families_count}"
    
    # 3. Operational records count (should all be 0)
    operational_tables = [
        "attendance_classes", "attendance_prep", "attendance_staff",
        "discipline_violations", "digital_diary", "exam_marks",
        "fee_challans", "fee_payments", "journal_entries", "whatsapp_queue", "health_records"
    ]
    for tbl in operational_tables:
        cnt = c.execute(f'SELECT COUNT(*) FROM "{tbl}"').fetchone()[0]
        print(f"Operational Table '{tbl}': {cnt} records (Expected 0)")
        assert cnt == 0, f"Expected 0 for {tbl}, got {cnt}"
        
    conn.close()
    print("Backend database verification: PASSED!\n")

if __name__ == '__main__':
    check_backend()

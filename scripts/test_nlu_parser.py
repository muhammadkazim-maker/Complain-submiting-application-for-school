import re
import sqlite3

def normalize_text(text):
    if not text: return ""
    return re.sub(r'\s+', ' ', text.strip().lower())

def extract_attendance_changes(text, class_id, default_status):
    text_norm = normalize_text(text)
    conn = sqlite3.connect('hes_portal.db')
    c = conn.cursor()
    c.execute("SELECT id, name FROM students WHERE current_class_id = ?", (class_id,))
    roster = c.fetchall()
    conn.close()

    # Sort by name length descending so full names match first
    roster_sorted = sorted(roster, key=lambda r: len(r[1]), reverse=True)

    changes = []
    opposite = 'Absent' if default_status == 'Present' else 'Present'
    matched_names = set()

    for stu_id, full_name in roster_sorted:
        fn = normalize_text(full_name)
        # Check if full name is in query
        if re.search(rf'\b{re.escape(fn)}\b', text_norm):
            # Already covered?
            if any(fn in m for m in matched_names):
                continue
            matched_names.add(fn)
            changes.append({"studentId": stu_id, "name": full_name, "status": opposite})

    return changes

print("Test 10th:")
changes2 = extract_attendance_changes("iss class 10th kay chemistry kay tamam students ko present mark kar do aur Ali Haider ko absent mark kar do", "10th", "Present")
print(changes2)

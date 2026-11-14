"""
Hadi Education System Portal — School NLU & Function Call Planner
Interprets Roman Urdu, Urdu script, and English queries into native Gemini functionCalls
for attendance, violations, homework, tests, health, reports, and portal actions.
"""

import re
import os
import sqlite3
import datetime

def normalize_text(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', str(text).strip().lower())

def get_db_path():
    p1 = os.path.join(os.path.dirname(__file__), 'hes_portal.db')
    if os.path.exists(p1):
        return p1
    return 'hes_portal.db'

def extract_class_id(text):
    t = normalize_text(text)
    patterns = [
        (r'\b(6th|class\s*6|6vi|chhati|sixth)\b', '6th'),
        (r'\b(7th|class\s*7|7vi|satvi|seventh)\b', '7th'),
        (r'\b(8th|class\s*8|8vi|aathvi|eighth)\b', '8th'),
        (r'\b(9th|class\s*9|9vi|nauvi|ninth)\b', '9th'),
        (r'\b(10th|class\s*10|10vi|dasvi|tenth|matric)\b', '10th'),
        (r'\b(11th|class\s*11|11vi|gyarvi|eleventh|1st\s*year|first\s*year)\b', '11th'),
        (r'\b(12th|class\s*12|12vi|barvi|twelfth|2nd\s*year|second\s*year)\b', '12th')
    ]
    for pat, cid in patterns:
        if re.search(pat, t):
            return cid
    return None

def extract_subject(text):
    t = normalize_text(text)
    subs = [
        ('Physics', ['physics', 'phisics', 'fiziks', 'fizix', 'فزکس']),
        ('Chemistry', ['chemistry', 'kemistry', 'chem', 'کیمسٹری']),
        ('Biology', ['biology', 'bio', 'بائیولوجی']),
        ('Mathematics', ['mathematics', 'maths', 'math', 'ریاضی']),
        ('English', ['english', 'inglish', 'eng', 'انگریزی']),
        ('Urdu', ['urdu', 'اردو']),
        ('Computer Science', ['computer science', 'computer', 'comp', 'کمپیوٹر']),
        ('Islamiyat', ['islamiyat', 'islamiat', 'islamic studies', 'اسلامیات']),
        ('Pak Studies', ['pak studies', 'pak study', 'mutalia pakistan', 'مطالعہ پاکستان']),
        ('General Science', ['general science', 'gen science', 'جنرل سائنس'])
    ]
    for canon, aliases in subs:
        for al in aliases:
            if re.search(rf'\b{re.escape(al)}\b', t):
                return canon
    return 'General'

def extract_prep_slot(text):
    t = normalize_text(text)
    if re.search(r'\b(prep\s*1|prep\s*one|pehli\s*prep)\b', t):
        return 'Prep 1'
    if re.search(r'\b(prep\s*2|prep\s*two|dusri\s*prep)\b', t):
        return 'Prep 2'
    if re.search(r'\b(prep\s*3|prep\s*three|teesri\s*prep)\b', t):
        return 'Prep 3'
    return 'Prep 1'

def get_class_roster(class_id):
    try:
        conn = sqlite3.connect(get_db_path())
        c = conn.cursor()
        c.execute("SELECT id, name, father_name, current_class_id FROM students WHERE current_class_id = ? AND status = 'Active'", (class_id,))
        roster = c.fetchall()
        conn.close()
        return roster
    except Exception as e:
        print("DB roster fetch error:", e)
        return []

def extract_attendance_changes(text, class_id, default_status):
    t = normalize_text(text)
    roster = get_class_roster(class_id)
    if not roster:
        return []

    # Sort roster by name length descending so specific full names match first
    roster_sorted = sorted(roster, key=lambda r: len(r[1]), reverse=True)

    changes = []
    opposite = 'Absent' if default_status == 'Present' else 'Present'
    matched_ids = set()

    for stu_id, full_name, father_name, cid in roster_sorted:
        fn = normalize_text(full_name)
        pos = t.find(fn)
        if pos != -1:
            if stu_id not in matched_ids:
                matched_ids.add(stu_id)
                # Look around name for status cues
                snippet = t[max(0, pos-30):min(len(t), pos+len(fn)+30)]
                if any(w in snippet for w in ['absent', 'ghair hazir']):
                    changes.append({"studentId": stu_id, "status": "Absent"})
                elif any(w in snippet for w in ['present', 'hazir']):
                    changes.append({"studentId": stu_id, "status": "Present"})
                elif any(w in snippet for w in ['leave', 'chutti', 'rukhsat']):
                    changes.append({"studentId": stu_id, "status": "Leave"})
                else:
                    changes.append({"studentId": stu_id, "status": opposite})

    # If no full name matched, try distinctive first/last tokens (excluding common prefixes)
    if not changes:
        common_prefixes = {'syed', 'muhammad', 'malik', 'sheikh'}
        for stu_id, full_name, father_name, cid in roster_sorted:
            fn = normalize_text(full_name)
            tokens = [tok for tok in fn.split() if tok not in common_prefixes and len(tok) >= 4]
            for tok in tokens:
                pos = t.find(tok)
                if pos != -1:
                    if stu_id not in matched_ids:
                        matched_ids.add(stu_id)
                        snippet = t[max(0, pos-30):min(len(t), pos+len(tok)+30)]
                        if any(w in snippet for w in ['absent', 'ghair hazir']):
                            changes.append({"studentId": stu_id, "status": "Absent"})
                        elif any(w in snippet for w in ['present', 'hazir']):
                            changes.append({"studentId": stu_id, "status": "Present"})
                        elif any(w in snippet for w in ['leave', 'chutti', 'rukhsat']):
                            changes.append({"studentId": stu_id, "status": "Leave"})
                        else:
                            changes.append({"studentId": stu_id, "status": opposite})
                        break

    return changes

def parse_user_intent_and_plan(user_text):
    """
    Parses user request into a Gemini-compatible functionCall or conversational response.
    """
    t = normalize_text(user_text)
    today = datetime.date.today().strftime('%Y-%m-%d')

    # 1. Class Attendance Request
    is_att = any(k in t for k in ['attendance', 'hazri', 'present', 'absent', 'roll call', 'hazir'])
    is_prep = 'prep' in t

    if is_prep and is_att:
        class_id = extract_class_id(t)
        prep_slot = extract_prep_slot(t)
        if not class_id:
            return {
                "type": "text",
                "text": f"Aap kis class (6th–12th) ki **{prep_slot}** attendance mark karna chahte hain? Misal: '9th Prep 1: sab present'."
            }
        
        is_all_absent = bool(re.search(r'\b(sab\s+absent|tamam\s+absent|all\s+absent|sab\s+.*absent|tamam\s+.*absent|sab\s+bacho\s+ko\s+absent|sab\s+ko\s+absent)\b', t))
        is_all_present = bool(re.search(r'\b(sab\s+present|tamam\s+present|all\s+present|sab\s+.*present|tamam\s+.*present|sab\s+bacho\s+ko\s+present|sab\s+ko\s+present)\b', t))
        default_status = 'Absent' if (is_all_absent and not is_all_present) else 'Present'

        changes = extract_attendance_changes(t, class_id, default_status)
        return {
            "type": "functionCall",
            "name": "set_prep_attendance",
            "args": {
                "classId": class_id,
                "prepSlot": prep_slot,
                "date": today,
                "defaultStatus": default_status,
                "changes": changes
            }
        }

    if is_att and any(k in t for k in ['lagao', 'mark', 'karo', 'kar do', 'banao', 'sab present', 'sab absent', 'tamam', 'ko present', 'ko absent']):
        class_id = extract_class_id(t)
        subject = extract_subject(t)

        if not class_id:
            return {
                "type": "text",
                "text": f"Aap kis class ki **{subject}** attendance mark karna chahte hain?\n\nClasses: **6th, 7th, 8th, 9th, 10th, 11th, ya 12th**.\nMisal ke tor par: *'9th ki physics attendance lagao: sab present sirf Ali Abbas absent'*."
            }

        is_all_absent = bool(re.search(r'\b(sab\s+absent|tamam\s+absent|all\s+absent|sab\s+.*absent|tamam\s+.*absent|sab\s+bacho\s+ko\s+absent|sab\s+ko\s+absent)\b', t))
        is_all_present = bool(re.search(r'\b(sab\s+present|tamam\s+present|all\s+present|sab\s+.*present|tamam\s+.*present|sab\s+bacho\s+ko\s+present|sab\s+ko\s+present)\b', t))
        default_status = 'Absent' if (is_all_absent and not is_all_present) else 'Present'

        changes = extract_attendance_changes(t, class_id, default_status)

        return {
            "type": "functionCall",
            "name": "set_class_attendance",
            "args": {
                "classId": class_id,
                "subject": subject,
                "date": today,
                "defaultStatus": default_status,
                "changes": changes
            }
        }

    # 2. Query Absentees
    if any(k in t for k in ['kaun kaun absent', 'kon absent', 'who is absent', 'aaj absent', 'absent list', 'absent kaun', 'kitne absent']):
        class_id = extract_class_id(t)
        return {
            "type": "functionCall",
            "name": "get_attendance",
            "args": {
                "kind": "both",
                "date": today,
                **({"classId": class_id} if class_id else {})
            }
        }

    # 3. Navigation
    nav_map = {
        'home': ['home', 'dashboard'],
        'violations': ['violation', 'violations', 'discipline'],
        'homework': ['homework', 'pending'],
        'class-attendance': ['class attendance', 'classes attendance', 'attendance'],
        'prep-attendance': ['prep attendance', 'prep'],
        'health': ['health', 'medical'],
        'student-details': ['student detail', 'directory'],
        'tests': ['monthly test', 'tests'],
        'grand-report': ['grand report', 'dossier', 'report card']
    }
    for scr, keys in nav_map.items():
        if any(f"{k} screen" in t or f"open {k}" in t or f"{k} par jao" in t or f"{k} kholo" in t or f"{k} dikhao" in t for k in keys):
            return {
                "type": "functionCall",
                "name": "open_screen",
                "args": {"screen": scr}
            }

    # 4. Violation Logging
    if any(k in t for k in ['violation', 'shikayat', 'shor machaya', 'mar peet', 'late aaya']):
        class_id = extract_class_id(t)
        # Extract severity
        sev = 'Medium'
        if 'low' in t or '1' in t: sev = 'Low'
        elif 'high' in t or '3' in t: sev = 'High'
        elif 'extreme' in t or '4' in t: sev = 'Extreme'
        elif 'ultra' in t or '5' in t: sev = 'Ultra'

        # Match student
        stu_match = None
        if class_id:
            roster = get_class_roster(class_id)
            for sid, sname, fname, cid in roster:
                if normalize_text(sname) in t:
                    stu_match = sid
                    break

        if not stu_match:
            # Search all students
            conn = sqlite3.connect(get_db_path())
            c = conn.cursor()
            c.execute("SELECT id, name FROM students WHERE status='Active'")
            for sid, sname in c.fetchall():
                if normalize_text(sname) in t:
                    stu_match = sid
                    break
            conn.close()

        if stu_match:
            return {
                "type": "functionCall",
                "name": "add_violation",
                "args": {
                    "studentId": stu_match,
                    "severity": sev,
                    "description": user_text
                }
            }
        else:
            return {
                "type": "functionCall",
                "name": "get_violations",
                "args": {}
            }

    # 4. Homework & Pending Tasks
    if any(k in t for k in ['pending homework', 'pending tasks', 'unclear concept', 'pending task']):
        class_id = extract_class_id(t)
        return {
            "type": "functionCall",
            "name": "get_pending_tasks",
            "args": {
                **({"classId": class_id} if class_id else {})
            }
        }

    if 'homework' in t:
        class_id = extract_class_id(t)
        subject = extract_subject(t)
        return {
            "type": "functionCall",
            "name": "get_homework",
            "args": {
                **({"classId": class_id} if class_id else {}),
                **({"subject": subject} if subject != 'General' else {})
            }
        }

    # 5. Monthly Tests & Results
    if any(k in t for k in ['result', 'monthly test', 'test marks', 'test result']):
        class_id = extract_class_id(t)
        if any(k in t for k in ['create', 'banao', 'add']):
            sub = extract_subject(t)
            return {
                "type": "functionCall",
                "name": "create_test",
                "args": {
                    "name": f"{sub or 'Monthly'} Test",
                    "subject": sub or 'General',
                    "classId": class_id or '9th',
                    "totalMarks": 50,
                    "date": today
                }
            }
        return {
            "type": "functionCall",
            "name": "get_tests",
            "args": {}
        }

    # 6. Health & Medical Records
    if any(k in t for k in ['health', 'medical', 'bimari', 'doctor', 'hospital', 'bukhar']):
        class_id = extract_class_id(t)
        return {
            "type": "functionCall",
            "name": "get_health_records",
            "args": {
                **({"classId": class_id} if class_id else {})
            }
        }

    # 8. Student Grand Report & Lookup
    if any(k in t for k in ['report', 'dossier', 'profile', 'detail']):
        # Find student name in query
        conn = sqlite3.connect(get_db_path())
        c = conn.cursor()
        c.execute("SELECT id, name, current_class_id FROM students WHERE status='Active'")
        all_stu = c.fetchall()
        conn.close()

        for sid, sname, cid in all_stu:
            if normalize_text(sname) in t:
                return {
                    "type": "functionCall",
                    "name": "get_student_grand_report",
                    "args": {"studentId": sid}
                }

    # Fallback to Portal Overview
    return {
        "type": "text",
        "text": (
            "Hadi Education System AI Assistant Ready!\n\n"
            "Main aap ki portal par tamam academic aur administrative operations mein madad kar sakta hoon:\n"
            "- **Classes Attendance:** '9th ki physics attendance lagao: sab present sirf Ali Abbas absent'\n"
            "- **Prep Attendance:** '10th Prep 1: sab present'\n"
            "- **Absentees:** 'Aaj kaun kaun absent hai?'\n"
            "- **Violations:** 'Discipline records dikhao' ya 'Ali ki violation add karo'\n"
            "- **Homework:** '9th ka pending homework kis kis ka hai?'\n"
            "- **Tests & Marks:** 'Monthly tests dikhao' ya 'Result dikhao'\n"
            "- **Health & Medical:** 'Medical records dikhao'\n"
            "- **Navigation:** 'Attendance screen kholo' ya 'Grand Report screen par jao'"
        )
    }

def format_tool_response(tool_name, output):
    """
    Constructs a polite, natural response in Roman Urdu and English once a tool executes.
    """
    if not isinstance(output, dict):
        return f"Action complete: {str(output)}"

    if output.get("cancelledByUser"):
        return "Aap ne confirmation card par cancel kar diya hai. Portal records mein koi tabdeeli nahi ki gayi."

    if not output.get("ok", True):
        return f"Action perform karne mein masla aaya: {output.get('error', 'Unknown error')}."

    if tool_name == 'set_class_attendance':
        cls_lbl = output.get('classLabel', output.get('classId', 'Class'))
        sub = output.get('subject', 'Subject')
        tot = output.get('totalInClass', output.get('total', 0))
        p = output.get('presentCount', output.get('present', 0))
        a = output.get('absentCount', output.get('absent', 0))
        l = output.get('leaveCount', output.get('leave', 0))
        dt = output.get('date', '')
        abs_stus = output.get('absentStudents', [])
        abs_names = ", ".join(s.get('name') for s in abs_stus if isinstance(s, dict))
        abs_line = f"\n- **Absent Students:** {abs_names}" if abs_names else ""
        return (
            f"Ji bilkul! **{cls_lbl}** ki **{sub}** attendance kamiyabi se mark aur save ho chuki hai! 📝\n\n"
            f"- **Date:** {dt}\n"
            f"- **Total Students:** {tot}\n"
            f"- **Present:** {p}\n"
            f"- **Absent:** {a}\n"
            f"- **Leave:** {l}"
            f"{abs_line}\n\n"
            f"Live portal attendance cards aur sidebar badges update kar diye gaye hain."
        )

    if tool_name == 'set_prep_attendance':
        cls_lbl = output.get('classLabel', output.get('classId', 'Class'))
        slot = output.get('prepSlot', 'Prep')
        tot = output.get('totalInClass', output.get('total', 0))
        p = output.get('presentCount', output.get('present', 0))
        a = output.get('absentCount', output.get('absent', 0))
        l = output.get('leaveCount', output.get('leave', 0))
        dt = output.get('date', '')
        abs_stus = output.get('absentStudents', [])
        abs_names = ", ".join(s.get('name') for s in abs_stus if isinstance(s, dict))
        abs_line = f"\n- **Absent Students:** {abs_names}" if abs_names else ""
        return (
            f"Ji bilkul! **{cls_lbl}** ki **{slot}** attendance save ho chuki hai.\n\n"
            f"- **Date:** {dt}\n"
            f"- **Total:** {tot} | **Present:** {p} | **Absent:** {a} | **Leave:** {l}"
            f"{abs_line}\n\n"
            f"Live prep register update ho chuka hai."
        )

    if tool_name in ('get_attendance', 'get_class_attendance'):
        sessions = output.get('items', output.get('sessions', []))
        if not sessions:
            return "Aaj ke liye abhi tak koi attendance session save nahi hua."
        lines = ["**Aaj ki Attendance Summary & Absentees:**\n"]
        for s in sessions[:8]:
            c_lbl = s.get('classLabel', s.get('classId', 'Class'))
            item = s.get('subject') or s.get('prepSlot') or 'General'
            p = s.get('presentCount', 0)
            a = s.get('absentCount', 0)
            l = s.get('leaveCount', 0)
            abs_stus = s.get('absentStudents', [])
            abs_names = ", ".join(stu.get('name') for stu in abs_stus if isinstance(stu, dict))
            line = f"- **{c_lbl} ({item})**: {p} Present, {a} Absent, {l} Leave"
            if abs_names:
                line += f"\n  - *Absent Students:* **{abs_names}**"
            lines.append(line)
        return "\n".join(lines)

    if tool_name == 'open_screen':
        scr = output.get('navigatedTo', '')
        return f"Main ne aap ke liye **{scr}** screen open kar di hai."

    if tool_name == 'add_violation':
        return f"Discipline violation record save ho chuka hai. Student score update ho chuka hai."

    if tool_name == 'get_violations':
        comp = output.get('items', output.get('complaints', []))
        if not comp:
            return "Discipline record mein koi active violation darj nahi hai."
        lines = [f"**Kul {len(comp)} Discipline Violations darj hain:**\n"]
        for c in comp[:6]:
            lines.append(f"- **{c.get('studentName')} ({c.get('classId')})**: {c.get('severity')} - {c.get('description')}")
        return "\n".join(lines)

    if tool_name == 'get_pending_tasks':
        tasks = output.get('items', output.get('tasks', []))
        if not tasks:
            return "Koi pending homework ya unclear concept task baqi nahi hai. Sab clear hain! 🎉"
        lines = [f"**Kul {len(tasks)} Pending Concept Tasks:**\n"]
        for t in tasks[:6]:
            lines.append(f"- **{t.get('studentName')} ({t.get('classId')})**: {t.get('subject')} - {t.get('description')}")
        return "\n".join(lines)

    if tool_name == 'get_health_records':
        rec = output.get('items', output.get('records', []))
        if not rec:
            return "Koi medical report ya doctor visit record darj nahi hai."
        lines = [f"**Health & Medical Records ({len(rec)}):**\n"]
        for r in rec[:6]:
            lines.append(f"- **{r.get('studentName')} ({r.get('classId')})**: {r.get('disease')} - Dr. {r.get('doctorName')}")
        return "\n".join(lines)

    return f"Action '{tool_name}' kamiyabi se perform ho gaya hai."

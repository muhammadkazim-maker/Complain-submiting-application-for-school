"""
Hadi Education System Balkassar — Student & Class Reports Service
Generates genuine .xlsx reports with native editable Excel charts,
bulk ZIP downloads, interactive graph data, and multi-sheet workbooks.
"""

import io
import os
import json
import zipfile
import re
from datetime import datetime, date
from collections import defaultdict

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, LineChart, PieChart, DoughnutChart, Reference, Series

# Palette matching application design tokens
NAVY_FILL = PatternFill(start_color="101B30", end_color="101B30", fill_type="solid")
TEAL_FILL = PatternFill(start_color="087F8C", end_color="087F8C", fill_type="solid")
SUBTLE_FILL = PatternFill(start_color="F4F7FB", end_color="F4F7FB", fill_type="solid")
ALT_ROW_FILL = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
SUCCESS_FILL = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
WARNING_FILL = PatternFill(start_color="FFFBEB", end_color="FFFBEB", fill_type="solid")
DANGER_FILL = PatternFill(start_color="FEF2F2", end_color="FEF2F2", fill_type="solid")

FONT_NAME = "Segoe UI"
WHITE_FONT_BOLD = Font(name=FONT_NAME, size=11, bold=True, color="FFFFFF")
WHITE_FONT_TITLE = Font(name=FONT_NAME, size=15, bold=True, color="FFFFFF")
DARK_FONT_TITLE = Font(name=FONT_NAME, size=14, bold=True, color="101B30")
DARK_FONT_SUB = Font(name=FONT_NAME, size=10, italic=True, color="59677E")
REG_FONT = Font(name=FONT_NAME, size=10, color="142139")
BOLD_FONT = Font(name=FONT_NAME, size=10, bold=True, color="142139")
MUTED_FONT = Font(name=FONT_NAME, size=9, color="59677E")
SUCCESS_FONT_BOLD = Font(name=FONT_NAME, size=10, bold=True, color="16A34A")
DANGER_FONT_BOLD = Font(name=FONT_NAME, size=10, bold=True, color="DC2626")

BORDER_THIN = Border(
    left=Side(style="thin", color="DDE5EF"),
    right=Side(style="thin", color="DDE5EF"),
    top=Side(style="thin", color="DDE5EF"),
    bottom=Side(style="thin", color="DDE5EF")
)
BORDER_TOP_BOTTOM = Border(
    top=Side(style="thin", color="101B30"),
    bottom=Side(style="double", color="101B30")
)

ALIGN_LEFT = Alignment(horizontal="left", vertical="center")
ALIGN_CENTER = Alignment(horizontal="center", vertical="center")
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")
ALIGN_WRAP = Alignment(horizontal="left", vertical="center", wrap_text=True)

# Grade scale according to school policy
def calculate_grade(pct):
    if pct is None:
        return "N/A"
    if pct >= 90.0:
        return "A+"
    elif pct >= 80.0:
        return "A"
    elif pct >= 70.0:
        return "B"
    elif pct >= 60.0:
        return "C"
    elif pct >= 50.0:
        return "D"
    else:
        return "F"

def sanitize_sheet_title(title):
    clean = re.sub(r'[\\/*?:\[\]]', '', str(title).strip())
    if not clean:
        clean = "Report"
    return clean[:31]

def auto_fit_columns(ws, min_width=12, max_width=45):
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = cell.value
            if val is not None:
                # ignore formulas when calculating column width
                val_str = str(val)
                if val_str.startswith("="):
                    val_str = "FormulaValue"
                line_len = max([len(line) for line in val_str.split("\n")] or [0])
                if line_len > max_len:
                    max_len = line_len
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, min_width), max_width)

def apply_report_header(ws, report_title, subtitle, filters_text=None):
    ws.views.sheetView[0].showGridLines = True
    
    # Row 1: School Branding
    ws.merge_cells("A1:G1")
    ws["A1"] = "HADI EDUCATION SYSTEM BALKASSAR"
    ws["A1"].font = WHITE_FONT_TITLE
    ws["A1"].fill = NAVY_FILL
    ws["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 36

    # Row 2: Subtitle / Report Title
    ws.merge_cells("A2:G2")
    ws["A2"] = f"{report_title.upper()} — {subtitle}"
    ws["A2"].font = WHITE_FONT_BOLD
    ws["A2"].fill = TEAL_FILL
    ws["A2"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[2].height = 24

    # Row 3: Meta & Generation Timestamp
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    meta_text = f"Generated: {now_str} | Campus: Balkassar, Chakwal (Tel: +92 300 8742972)"
    if filters_text:
        meta_text += f" | Filters: {filters_text}"
    ws.merge_cells("A3:G3")
    ws["A3"] = meta_text
    ws["A3"].font = MUTED_FONT
    ws["A3"].fill = SUBTLE_FILL
    ws["A3"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[3].height = 20
    ws.append([]) # Row 4 empty spacer

# ==============================================================================
# DATA ACCESS & AGGREGATION
# ==============================================================================

def get_student_report_data(conn, student_id, session_id=None, exam_cycle_id=None, start_date=None, end_date=None, current_user=None):
    c = conn.cursor()

    # 1. Student Profile & Family
    c.execute("""
    SELECT s.id, s.admission_no, s.roll_number, s.name, s.father_name, s.gender, s.dob,
           s.current_class_id, s.current_section, s.phone, s.whatsapp, s.family_id, s.status, s.admission_date,
           f.id as family_code, f.family_name, f.phone as family_phone, f.whatsapp as family_whatsapp, f.address as family_address
    FROM students s
    LEFT JOIN families f ON s.family_id = f.id
    WHERE s.id = ?
    """, (student_id,))
    stu_row = c.fetchone()
    if not stu_row:
        return None
    student = dict(stu_row)

    # Scoping by session
    if not session_id:
        c.execute("SELECT id, name FROM academic_sessions WHERE is_active = 1 LIMIT 1")
        sess_row = c.fetchone()
        session_id = sess_row[0] if sess_row else "sess_2025_2026"
        session_name = sess_row[1] if sess_row else "Academic Session 2025–2026"
    else:
        c.execute("SELECT name FROM academic_sessions WHERE id = ?", (session_id,))
        sr = c.fetchone()
        session_name = sr[0] if sr else session_id

    # RBAC filtering
    user_role = current_user.get("role", "admin") if current_user else "admin"
    include_fees = user_role in ["owner", "admin", "accountant", "parent"]
    include_conduct = user_role in ["owner", "admin", "teacher"]

    # 2. Academic Results
    # Find exam cycles for this session
    exam_q = "SELECT id, name, start_date, end_date FROM exam_cycles WHERE session_id = ?"
    params = [session_id]
    if exam_cycle_id and exam_cycle_id != "all":
        exam_q += " AND id = ?"
        params.append(exam_cycle_id)
    exam_q += " ORDER BY start_date DESC"
    c.execute(exam_q, params)
    cycles = [dict(r) for r in c.fetchall()]

    exams_data = []
    subject_marks_list = []
    total_obtained_all = 0.0
    total_max_all = 0.0
    has_academic_records = False

    for cyc in cycles:
        c.execute("""
        SELECT es.id as exam_subject_id, es.subject_name, es.max_marks, es.pass_marks,
               em.obtained_marks, em.is_absent, em.is_exempt
        FROM exam_subjects es
        LEFT JOIN exam_marks em ON es.id = em.exam_subject_id AND em.student_id = ?
        WHERE es.exam_cycle_id = ? AND es.class_id = ?
        ORDER BY es.subject_name
        """, (student_id, cyc["id"], student["current_class_id"]))
        rows = [dict(r) for r in c.fetchall()]

        # Also get all students in this class for ranking in this exam
        c.execute("""
        SELECT em.student_id, SUM(CASE WHEN em.is_absent = 1 OR em.is_exempt = 1 THEN 0 ELSE COALESCE(em.obtained_marks, 0) END) as tot
        FROM exam_marks em
        JOIN exam_subjects es ON em.exam_subject_id = es.id
        WHERE es.exam_cycle_id = ? AND es.class_id = ?
        GROUP BY em.student_id
        ORDER BY tot DESC
        """, (cyc["id"], student["current_class_id"]))
        ranked_stus = [dict(r) for r in c.fetchall()]

        # Compute student position (tied position handling)
        position = "N/A"
        cur_rank = 1
        for i, rs in enumerate(ranked_stus):
            if i > 0 and rs["tot"] < ranked_stus[i - 1]["tot"]:
                cur_rank = i + 1
            if rs["student_id"] == student_id:
                position = f"{cur_rank}"
                break

        cyc_obtained = 0.0
        cyc_max = 0.0
        cyc_subjects = []
        for r in rows:
            max_m = float(r["max_marks"] or 100.0)
            obt = r["obtained_marks"]
            is_abs = bool(r["is_absent"])
            is_ex = bool(r["is_exempt"])

            pct = None
            grade = "Not Entered"
            status_str = "Pending"

            if is_abs:
                grade = "ABS"
                status_str = "Absent"
            elif is_ex:
                grade = "EXEMPT"
                status_str = "Exempt"
            elif obt is not None:
                has_academic_records = True
                obt_f = float(obt)
                cyc_obtained += obt_f
                cyc_max += max_m
                pct = round((obt_f / max_m) * 100.0, 1) if max_m > 0 else 0.0
                grade = calculate_grade(pct)
                status_str = "Passed" if obt_f >= float(r["pass_marks"] or 33.0) else "Failed"

            cyc_subjects.append({
                "subject": r["subject_name"],
                "maxMarks": max_m,
                "obtainedMarks": obt,
                "isAbsent": is_abs,
                "isExempt": is_ex,
                "percentage": pct,
                "grade": grade,
                "passStatus": status_str,
                "passMarks": float(r["pass_marks"] or 33.0)
            })

            if pct is not None:
                subject_marks_list.append({
                    "exam": cyc["name"],
                    "subject": r["subject_name"],
                    "percentage": pct,
                    "obtained": obt,
                    "max": max_m,
                    "grade": grade
                })

        cyc_pct = round((cyc_obtained / cyc_max) * 100.0, 1) if cyc_max > 0 else None
        exams_data.append({
            "cycleId": cyc["id"],
            "cycleName": cyc["name"],
            "position": position,
            "subjects": cyc_subjects,
            "totalObtained": cyc_obtained,
            "totalMax": cyc_max,
            "percentage": cyc_pct,
            "grade": calculate_grade(cyc_pct) if cyc_pct is not None else "N/A"
        })

        total_obtained_all += cyc_obtained
        total_max_all += cyc_max

    overall_academic_pct = round((total_obtained_all / total_max_all) * 100.0, 1) if total_max_all > 0 else None

    # 3. Attendance Records
    att_q = """
    SELECT date, subject_id, status, 'Class' as type
    FROM attendance_classes
    WHERE student_id = ? AND session_id = ?
    """
    att_params = [student_id, session_id]
    if start_date:
        att_q += " AND date >= ?"
        att_params.append(start_date)
    if end_date:
        att_q += " AND date <= ?"
        att_params.append(end_date)
    att_q += " ORDER BY date DESC"
    c.execute(att_q, att_params)
    att_rows = [dict(r) for r in c.fetchall()]

    present_count = sum(1 for r in att_rows if r["status"] == "Present")
    absent_count = sum(1 for r in att_rows if r["status"] == "Absent")
    leave_count = sum(1 for r in att_rows if r["status"] == "Leave")
    total_att_days = len(att_rows)
    att_pct = round((present_count / total_att_days) * 100.0, 1) if total_att_days > 0 else None

    # Monthly attendance trend
    monthly_att = defaultdict(lambda: {"present": 0, "absent": 0, "leave": 0, "total": 0})
    for r in att_rows:
        m_key = r["date"][:7] # YYYY-MM
        monthly_att[m_key]["total"] += 1
        if r["status"] == "Present":
            monthly_att[m_key]["present"] += 1
        elif r["status"] == "Absent":
            monthly_att[m_key]["absent"] += 1
        elif r["status"] == "Leave":
            monthly_att[m_key]["leave"] += 1

    monthly_att_list = []
    for m in sorted(monthly_att.keys()):
        d = monthly_att[m]
        p = round((d["present"] / d["total"]) * 100.0, 1) if d["total"] > 0 else 0.0
        monthly_att_list.append({
            "month": m,
            "present": d["present"],
            "absent": d["absent"],
            "leave": d["leave"],
            "total": d["total"],
            "percentage": p
        })

    # 4. Fee Records
    fee_data = {"challans": [], "totalBilled": 0.0, "totalPaid": 0.0, "totalBalance": 0.0, "siblingDiscount": 0.0}
    if include_fees:
        fee_q = "SELECT * FROM fee_challans WHERE student_id = ? AND session_id = ?"
        fee_p = [student_id, session_id]
        if start_date:
            fee_q += " AND issue_date >= ?"
            fee_p.append(start_date)
        if end_date:
            fee_q += " AND issue_date <= ?"
            fee_p.append(end_date)
        fee_q += " ORDER BY issue_date DESC"
        c.execute(fee_q, fee_p)
        fee_rows = [dict(r) for r in c.fetchall()]

        for ch in fee_rows:
            fee_data["challans"].append(ch)
            fee_data["totalBilled"] += float(ch.get("total_payable") or 0.0)
            fee_data["totalPaid"] += float(ch.get("paid_amount") or 0.0)
            fee_data["totalBalance"] += float(ch.get("balance_amount") or 0.0)
            fee_data["siblingDiscount"] += float(ch.get("sibling_discount") or 0.0)

    # 5. Conduct Records
    conduct_data = {"records": [], "totalPoints": 0}
    if include_conduct:
        con_q = "SELECT * FROM discipline_violations WHERE student_id = ?"
        con_p = [student_id]
        if start_date:
            con_q += " AND date >= ?"
            con_p.append(start_date)
        if end_date:
            con_q += " AND date <= ?"
            con_p.append(end_date)
        con_q += " ORDER BY date DESC"
        c.execute(con_q, con_p)
        con_rows = [dict(r) for r in c.fetchall()]
        conduct_data["records"] = con_rows
        conduct_data["totalPoints"] = sum(int(r.get("points") or 0) for r in con_rows)

    return {
        "student": student,
        "session": {"id": session_id, "name": session_name},
        "academics": {
            "exams": exams_data,
            "overallPercentage": overall_academic_pct,
            "overallGrade": calculate_grade(overall_academic_pct) if overall_academic_pct is not None else "N/A",
            "subjectMarks": subject_marks_list,
            "hasRecords": has_academic_records
        },
        "attendance": {
            "records": att_rows,
            "totalDays": total_att_days,
            "presentCount": present_count,
            "absentCount": absent_count,
            "leaveCount": leave_count,
            "percentage": att_pct,
            "monthlyTrend": monthly_att_list
        },
        "fees": fee_data if include_fees else None,
        "conduct": conduct_data if include_conduct else None,
        "userRole": user_role
    }


def get_class_report_data(conn, class_id, section_id=None, session_id=None, exam_cycle_id=None, start_date=None, end_date=None, current_user=None):
    c = conn.cursor()

    if not session_id:
        c.execute("SELECT id, name FROM academic_sessions WHERE is_active = 1 LIMIT 1")
        sess_row = c.fetchone()
        session_id = sess_row[0] if sess_row else "sess_2025_2026"
        session_name = sess_row[1] if sess_row else "Academic Session 2025–2026"
    else:
        c.execute("SELECT name FROM academic_sessions WHERE id = ?", (session_id,))
        sr = c.fetchone()
        session_name = sr[0] if sr else session_id

    # Students in class/section
    stu_q = """
    SELECT s.id, s.admission_no, s.roll_number, s.name, s.father_name, s.gender,
           s.current_class_id, s.current_section, s.phone, s.whatsapp, s.family_id, s.status,
           f.id as family_code
    FROM students s
    LEFT JOIN families f ON s.family_id = f.id
    WHERE s.current_class_id = ?
    """
    params = [class_id]
    if section_id and section_id.lower() not in ["all", ""]:
        stu_q += " AND s.current_section = ?"
        params.append(section_id)
    stu_q += " ORDER BY s.roll_number, s.name"
    c.execute(stu_q, params)
    students = [dict(r) for r in c.fetchall()]

    # RBAC permissions
    user_role = current_user.get("role", "admin") if current_user else "admin"
    include_fees = user_role in ["owner", "admin", "accountant"]
    include_conduct = user_role in ["owner", "admin", "teacher"]

    # Examination cycle & subjects
    if not exam_cycle_id or exam_cycle_id == "all":
        c.execute("SELECT id, name FROM exam_cycles WHERE session_id = ? ORDER BY start_date DESC LIMIT 1", (session_id,))
        ec = c.fetchone()
        cycle_id = ec[0] if ec else None
        cycle_name = ec[1] if ec else "Current Term"
    else:
        c.execute("SELECT id, name FROM exam_cycles WHERE id = ?", (exam_cycle_id,))
        ec = c.fetchone()
        cycle_id = ec[0] if ec else exam_cycle_id
        cycle_name = ec[1] if ec else "Selected Term"

    subjects = []
    if cycle_id:
        c.execute("""
        SELECT id, subject_name, max_marks, pass_marks
        FROM exam_subjects
        WHERE exam_cycle_id = ? AND class_id = ?
        ORDER BY subject_name
        """, (cycle_id, class_id))
        subjects = [dict(r) for r in c.fetchall()]

    # Student marks map
    marks_map = {}
    if subjects:
        subj_ids = [s["id"] for s in subjects]
        placeholders = ",".join(["?"] * len(subj_ids))
        c.execute(f"""
        SELECT exam_subject_id, student_id, obtained_marks, is_absent, is_exempt
        FROM exam_marks
        WHERE exam_subject_id IN ({placeholders})
        """, subj_ids)
        for r in c.fetchall():
            marks_map[(r[0], r[1])] = {
                "obtained": r[2],
                "absent": bool(r[3]),
                "exempt": bool(r[4])
            }

    tot_max = sum(float(s["max_marks"] or 100.0) for s in subjects) or 100.0
    academic_rows = []
    grade_distribution = {"A+": 0, "A": 0, "B": 0, "C": 0, "D": 0, "F": 0, "Incomplete": 0}
    subject_sums = {s["subject_name"]: 0.0 for s in subjects}
    subject_counts = {s["subject_name"]: 0 for s in subjects}

    for stu in students:
        sid = stu["id"]
        subj_scores = {}
        tot_obt = 0.0
        has_any_mark = False
        all_passed = True

        for s in subjects:
            rec = marks_map.get((s["id"], sid))
            if not rec or rec["obtained"] is None:
                if rec and rec["absent"]:
                    subj_scores[s["subject_name"]] = "ABS"
                    all_passed = False
                elif rec and rec["exempt"]:
                    subj_scores[s["subject_name"]] = "EXEMPT"
                else:
                    subj_scores[s["subject_name"]] = "-"
            else:
                has_any_mark = True
                val = float(rec["obtained"])
                subj_scores[s["subject_name"]] = val
                tot_obt += val
                subject_sums[s["subject_name"]] += val
                subject_counts[s["subject_name"]] += 1
                if val < float(s["pass_marks"] or 33.0):
                    all_passed = False

        pct = round((tot_obt / tot_max) * 100.0, 1) if (tot_max > 0 and has_any_mark) else None
        grd = calculate_grade(pct) if pct is not None else "Incomplete"
        grade_distribution[grd] = grade_distribution.get(grd, 0) + 1

        academic_rows.append({
            "studentId": sid,
            "rollNumber": stu["roll_number"],
            "name": stu["name"],
            "fatherName": stu["father_name"],
            "subjectScores": subj_scores,
            "totalObtained": tot_obt if has_any_mark else None,
            "totalMax": tot_max,
            "percentage": pct,
            "grade": grd,
            "passed": all_passed if has_any_mark else False,
            "hasMarks": has_any_mark
        })

    # Sort and rank
    academic_rows.sort(key=lambda x: (x["totalObtained"] is not None, x["totalObtained"] or 0.0), reverse=True)
    cur_rank = 1
    for i, row in enumerate(academic_rows):
        if row["totalObtained"] is None:
            row["rank"] = "-"
        else:
            if i > 0 and academic_rows[i - 1]["totalObtained"] is not None and row["totalObtained"] < academic_rows[i - 1]["totalObtained"]:
                cur_rank = i + 1
            row["rank"] = cur_rank

    # Sort back by roll number for readable master sheet
    academic_rows.sort(key=lambda x: int(re.sub(r'\D', '', str(x["rollNumber"])) or 0))

    # Compute subject averages
    subject_averages = {}
    for s in subjects:
        cnt = subject_counts[s["subject_name"]]
        subject_averages[s["subject_name"]] = round(subject_sums[s["subject_name"]] / cnt, 1) if cnt > 0 else 0.0

    # Attendance Summary per student
    att_rows = []
    class_tot_present = 0
    class_tot_days = 0

    for stu in students:
        sid = stu["id"]
        q = "SELECT status FROM attendance_classes WHERE student_id = ? AND session_id = ?"
        p = [sid, session_id]
        if start_date:
            q += " AND date >= ?"
            p.append(start_date)
        if end_date:
            q += " AND date <= ?"
            p.append(end_date)
        c.execute(q, p)
        statuses = [r[0] for r in c.fetchall()]
        p_cnt = statuses.count("Present")
        a_cnt = statuses.count("Absent")
        l_cnt = statuses.count("Leave")
        tot_d = len(statuses)
        p_pct = round((p_cnt / tot_d) * 100.0, 1) if tot_d > 0 else None

        class_tot_present += p_cnt
        class_tot_days += tot_d

        att_rows.append({
            "studentId": sid,
            "rollNumber": stu["roll_number"],
            "name": stu["name"],
            "fatherName": stu["father_name"],
            "present": p_cnt,
            "absent": a_cnt,
            "leave": l_cnt,
            "totalDays": tot_d,
            "percentage": p_pct,
            "lowAttendance": p_pct is not None and p_pct < 75.0
        })

    class_att_avg = round((class_tot_present / class_tot_days) * 100.0, 1) if class_tot_days > 0 else None

    # Fee Summary per student
    fee_rows = []
    tot_billed = 0.0
    tot_paid = 0.0
    tot_balance = 0.0

    if include_fees:
        for stu in students:
            sid = stu["id"]
            fq = "SELECT total_payable, paid_amount, balance_amount, sibling_discount, challan_no FROM fee_challans WHERE student_id = ? AND session_id = ?"
            fp = [sid, session_id]
            if start_date:
                fq += " AND issue_date >= ?"
                fp.append(start_date)
            if end_date:
                fq += " AND issue_date <= ?"
                fp.append(end_date)
            c.execute(fq, fp)
            ch_list = [dict(r) for r in c.fetchall()]

            s_billed = sum(float(x.get("total_payable") or 0.0) for x in ch_list)
            s_paid = sum(float(x.get("paid_amount") or 0.0) for x in ch_list)
            s_bal = sum(float(x.get("balance_amount") or 0.0) for x in ch_list)
            s_disc = sum(float(x.get("sibling_discount") or 0.0) for x in ch_list)

            tot_billed += s_billed
            tot_paid += s_paid
            tot_balance += s_bal

            fee_rows.append({
                "studentId": sid,
                "rollNumber": stu["roll_number"],
                "name": stu["name"],
                "fatherName": stu["father_name"],
                "familyCode": stu["family_code"] or "—",
                "billed": s_billed,
                "paid": s_paid,
                "balance": s_bal,
                "discount": s_disc,
                "challanCount": len(ch_list)
            })

    # Conduct Summary per student
    conduct_rows = []
    if include_conduct:
        for stu in students:
            sid = stu["id"]
            cq = "SELECT severity, points FROM discipline_violations WHERE student_id = ?"
            cp = [sid]
            if start_date:
                cq += " AND date >= ?"
                cp.append(start_date)
            if end_date:
                cq += " AND date <= ?"
                cp.append(end_date)
            c.execute(cq, cp)
            v_list = c.fetchall()
            v_cnt = len(v_list)
            v_pts = sum(int(r[1] or 0) for r in v_list)
            conduct_rows.append({
                "studentId": sid,
                "rollNumber": stu["roll_number"],
                "name": stu["name"],
                "fatherName": stu["father_name"],
                "violationCount": v_cnt,
                "penaltyPoints": v_pts
            })

    return {
        "classId": class_id,
        "sectionId": section_id or "All",
        "session": {"id": session_id, "name": session_name},
        "cycle": {"id": cycle_id, "name": cycle_name},
        "studentCount": len(students),
        "subjects": subjects,
        "academicRows": academic_rows,
        "subjectAverages": subject_averages,
        "gradeDistribution": grade_distribution,
        "attendanceRows": att_rows,
        "classAttendanceAvg": class_att_avg,
        "feeRows": fee_rows if include_fees else None,
        "feeTotals": {
            "billed": tot_billed,
            "paid": tot_paid,
            "balance": tot_balance,
            "collectionRate": round((tot_paid / tot_billed) * 100.0, 1) if tot_billed > 0 else 0.0
        } if include_fees else None,
        "conductRows": conduct_rows if include_conduct else None,
        "userRole": user_role
    }

# ==============================================================================
# EXCEL GENERATION: INDIVIDUAL STUDENT REPORT WITH NATIVE CHARTS
# ==============================================================================

def generate_student_report_workbook(data, selected_modules=None):
    wb = openpyxl.Workbook()
    student = data["student"]
    session = data["session"]
    academics = data["academics"]
    attendance = data["attendance"]
    fees = data.get("fees")
    conduct = data.get("conduct")

    if not selected_modules:
        selected_modules = ["academics", "attendance", "fees", "conduct"]

    # --- TAB 1: SUMMARY ---
    ws_sum = wb.active
    ws_sum.title = "Student Summary"
    apply_report_header(
        ws_sum,
        "INDIVIDUAL STUDENT PROGRESS REPORT",
        f"{student['name']} (Roll #{student['roll_number']})",
        f"Class: {student['current_class_id']} {student['current_section']} | Session: {session['name']}"
    )

    # Student Info Grid
    info_rows = [
        ("Student Name:", student["name"], "Admission No:", student["admission_no"]),
        ("Roll Number:", str(student["roll_number"]), "Class & Section:", f"{student['current_class_id']} ({student['current_section']})"),
        ("Father Name:", student["father_name"], "Contact Phone:", student["phone"] or "—"),
        ("Family Code:", student.get("family_code") or "—", "Academic Session:", session["name"])
    ]
    cur_r = 5
    for r_data in info_rows:
        ws_sum.cell(row=cur_r, column=1, value=r_data[0]).font = BOLD_FONT
        ws_sum.cell(row=cur_r, column=1).fill = SUBTLE_FILL
        ws_sum.cell(row=cur_r, column=2, value=r_data[1]).font = REG_FONT

        ws_sum.cell(row=cur_r, column=4, value=r_data[2]).font = BOLD_FONT
        ws_sum.cell(row=cur_r, column=4).fill = SUBTLE_FILL
        ws_sum.cell(row=cur_r, column=5, value=r_data[3]).font = REG_FONT
        cur_r += 1

    cur_r += 1
    # KPI Highlights Table
    ws_sum.cell(row=cur_r, column=1, value="Performance Metric").font = WHITE_FONT_BOLD
    ws_sum.cell(row=cur_r, column=1).fill = NAVY_FILL
    ws_sum.cell(row=cur_r, column=2, value="Recorded Value").font = WHITE_FONT_BOLD
    ws_sum.cell(row=cur_r, column=2).fill = NAVY_FILL
    ws_sum.cell(row=cur_r, column=3, value="Performance Status").font = WHITE_FONT_BOLD
    ws_sum.cell(row=cur_r, column=3).fill = NAVY_FILL
    cur_r += 1

    kpis = [
        ("Overall Academic Score", f"{academics['overallPercentage']}%" if academics['overallPercentage'] is not None else "No Exam Marks", f"Grade {academics['overallGrade']}"),
        ("Attendance Rate", f"{attendance['percentage']}%" if attendance['percentage'] is not None else "No Attendance", f"{attendance['presentCount']}/{attendance['totalDays']} Days Present")
    ]
    if fees:
        kpis.append(("Fee Dues / Balance", f"PKR {fees['totalBalance']:,.0f}", "Paid in Full" if fees['totalBalance'] <= 0 else "Outstanding Balance"))
    if conduct:
        kpis.append(("Conduct Points", f"{conduct['totalPoints']} Pts", "Good Standing" if conduct['totalPoints'] == 0 else f"{len(conduct['records'])} Infractions"))

    for metric, val, stat in kpis:
        ws_sum.cell(row=cur_r, column=1, value=metric).font = BOLD_FONT
        ws_sum.cell(row=cur_r, column=1).border = BORDER_THIN
        ws_sum.cell(row=cur_r, column=2, value=val).font = REG_FONT
        ws_sum.cell(row=cur_r, column=2).border = BORDER_THIN
        ws_sum.cell(row=cur_r, column=3, value=stat).font = BOLD_FONT
        ws_sum.cell(row=cur_r, column=3).border = BORDER_THIN
        cur_r += 1

    auto_fit_columns(ws_sum)

    # --- TAB 2: ACADEMIC RESULTS ---
    if "academics" in selected_modules:
        ws_acad = wb.create_sheet(title="Academic Results")
        apply_report_header(
            ws_acad,
            "ACADEMIC EXAMINATION RESULTS",
            f"{student['name']} | Class {student['current_class_id']}",
            f"Session: {session['name']}"
        )

        r_idx = 5
        chart_data_start = r_idx + 1
        headers = ["Examination", "Subject", "Max Marks", "Obtained Marks", "Percentage", "Grade", "Pass Status"]
        for col_i, h in enumerate(headers, start=1):
            cell = ws_acad.cell(row=r_idx, column=col_i, value=h)
            cell.font = WHITE_FONT_BOLD
            cell.fill = NAVY_FILL
            cell.alignment = ALIGN_CENTER if col_i in [3, 4, 5, 6, 7] else ALIGN_LEFT
        r_idx += 1

        chart_rows = []
        for ex in academics["exams"]:
            for subj in ex["subjects"]:
                ws_acad.cell(row=r_idx, column=1, value=ex["cycleName"]).font = REG_FONT
                ws_acad.cell(row=r_idx, column=2, value=subj["subject"]).font = BOLD_FONT
                
                c_max = ws_acad.cell(row=r_idx, column=3, value=subj["maxMarks"])
                c_max.font = REG_FONT
                c_max.alignment = ALIGN_RIGHT
                c_max.number_format = "#,##0"

                obt_val = subj["obtainedMarks"]
                c_obt = ws_acad.cell(row=r_idx, column=4, value=obt_val if obt_val is not None else 0)
                c_obt.font = REG_FONT
                c_obt.alignment = ALIGN_RIGHT
                c_obt.number_format = "#,##0"

                # Formula for percentage
                c_pct = ws_acad.cell(row=r_idx, column=5, value=f"=D{r_idx}/C{r_idx}")
                c_pct.font = BOLD_FONT
                c_pct.alignment = ALIGN_RIGHT
                c_pct.number_format = "0.0%"

                c_grd = ws_acad.cell(row=r_idx, column=6, value=subj["grade"])
                c_grd.font = BOLD_FONT
                c_grd.alignment = ALIGN_CENTER

                c_stat = ws_acad.cell(row=r_idx, column=7, value=subj["passStatus"])
                c_stat.font = SUCCESS_FONT_BOLD if subj["passStatus"] == "Passed" else DANGER_FONT_BOLD if subj["passStatus"] == "Failed" else REG_FONT
                c_stat.alignment = ALIGN_CENTER

                for c_i in range(1, 8):
                    ws_acad.cell(row=r_idx, column=c_i).border = BORDER_THIN

                chart_rows.append(r_idx)
                r_idx += 1

        # Native BarChart: Subject Performance
        if len(chart_rows) > 0:
            chart = BarChart()
            chart.type = "col"
            chart.style = 10
            chart.title = f"Subject Scores — {student['name']}"
            chart.y_axis.title = "Marks"
            chart.x_axis.title = "Subjects"
            chart.height = 12
            chart.width = 18

            data_ref = Reference(ws_acad, min_col=4, min_row=chart_data_start - 1, max_row=r_idx - 1)
            cats_ref = Reference(ws_acad, min_col=2, min_row=chart_data_start, max_row=r_idx - 1)
            chart.add_data(data_ref, titles_from_data=True)
            chart.set_categories(cats_ref)
            ws_acad.add_chart(chart, "I5")

        ws_acad.freeze_panes = "A6"
        auto_fit_columns(ws_acad)

    # --- TAB 3: ATTENDANCE ---
    if "attendance" in selected_modules:
        ws_att = wb.create_sheet(title="Attendance Record")
        apply_report_header(
            ws_att,
            "STUDENT ATTENDANCE & PRESENCE LOG",
            f"{student['name']} | Total Days Recorded: {attendance['totalDays']}",
            f"Rate: {attendance['percentage']}% | Present: {attendance['presentCount']} | Absent: {attendance['absentCount']} | Leave: {attendance['leaveCount']}"
        )

        # Monthly summary sub-table (for native charts)
        r_idx = 5
        ws_att.cell(row=r_idx, column=1, value="Monthly Trend Summary").font = DARK_FONT_TITLE
        r_idx += 1

        month_headers = ["Month", "Present", "Absent", "Leave", "Total Days", "Presence %"]
        for col_i, h in enumerate(month_headers, start=1):
            cell = ws_att.cell(row=r_idx, column=col_i, value=h)
            cell.font = WHITE_FONT_BOLD
            cell.fill = TEAL_FILL
            cell.alignment = ALIGN_CENTER if col_i > 1 else ALIGN_LEFT
        r_idx += 1
        month_data_start = r_idx

        for m in attendance["monthlyTrend"]:
            ws_att.cell(row=r_idx, column=1, value=m["month"]).font = BOLD_FONT
            ws_att.cell(row=r_idx, column=2, value=m["present"]).alignment = ALIGN_RIGHT
            ws_att.cell(row=r_idx, column=3, value=m["absent"]).alignment = ALIGN_RIGHT
            ws_att.cell(row=r_idx, column=4, value=m["leave"]).alignment = ALIGN_RIGHT
            ws_att.cell(row=r_idx, column=5, value=f"=SUM(B{r_idx}:D{r_idx})").alignment = ALIGN_RIGHT
            c_p = ws_att.cell(row=r_idx, column=6, value=f"=B{r_idx}/E{r_idx}")
            c_p.number_format = "0.0%"
            c_p.alignment = ALIGN_RIGHT
            for c_i in range(1, 7):
                ws_att.cell(row=r_idx, column=c_i).border = BORDER_THIN
            r_idx += 1

        # Attendance Breakdown for Doughnut Chart
        pie_start = r_idx + 1
        ws_att.cell(row=pie_start, column=1, value="Status").font = WHITE_FONT_BOLD
        ws_att.cell(row=pie_start, column=1).fill = NAVY_FILL
        ws_att.cell(row=pie_start, column=2, value="Count").font = WHITE_FONT_BOLD
        ws_att.cell(row=pie_start, column=2).fill = NAVY_FILL

        ws_att.cell(row=pie_start + 1, column=1, value="Present")
        ws_att.cell(row=pie_start + 1, column=2, value=attendance["presentCount"])
        ws_att.cell(row=pie_start + 2, column=1, value="Absent")
        ws_att.cell(row=pie_start + 2, column=2, value=attendance["absentCount"])
        ws_att.cell(row=pie_start + 3, column=1, value="Leave")
        ws_att.cell(row=pie_start + 3, column=2, value=attendance["leaveCount"])

        # Doughnut Chart: Attendance status distribution
        donut = DoughnutChart()
        donut.title = "Attendance Status Distribution"
        donut.height = 10
        donut.width = 14
        d_data = Reference(ws_att, min_col=2, min_row=pie_start, max_row=pie_start + 3)
        d_cats = Reference(ws_att, min_col=1, min_row=pie_start + 1, max_row=pie_start + 3)
        donut.add_data(d_data, titles_from_data=True)
        donut.set_categories(d_cats)
        ws_att.add_chart(donut, "H5")

        # Line Chart: Monthly attendance trend (if multiple months exist)
        if len(attendance["monthlyTrend"]) >= 2:
            line_c = LineChart()
            line_c.title = "Monthly Attendance Presence (%)"
            line_c.style = 13
            line_c.y_axis.title = "% Present"
            line_c.x_axis.title = "Month"
            line_c.height = 10
            line_c.width = 14
            l_data = Reference(ws_att, min_col=6, min_row=month_data_start - 1, max_row=r_idx - 1)
            l_cats = Reference(ws_att, min_col=1, min_row=month_data_start, max_row=r_idx - 1)
            line_c.add_data(l_data, titles_from_data=True)
            line_c.set_categories(l_cats)
            ws_att.add_chart(line_c, "H19")

        # Daily Attendance Log
        r_idx = pie_start + 5
        ws_att.cell(row=r_idx, column=1, value="Detailed Daily Attendance Log").font = DARK_FONT_TITLE
        r_idx += 1
        daily_hdrs = ["Date", "Type", "Status"]
        for col_i, h in enumerate(daily_hdrs, start=1):
            cell = ws_att.cell(row=r_idx, column=col_i, value=h)
            cell.font = WHITE_FONT_BOLD
            cell.fill = NAVY_FILL
        r_idx += 1
        for row in attendance["records"][:100]: # limit to top 100 for sheet compactness
            ws_att.cell(row=r_idx, column=1, value=row["date"]).font = REG_FONT
            ws_att.cell(row=r_idx, column=2, value=row["type"]).font = REG_FONT
            st_cell = ws_att.cell(row=r_idx, column=3, value=row["status"])
            st_cell.font = SUCCESS_FONT_BOLD if row["status"] == "Present" else DANGER_FONT_BOLD if row["status"] == "Absent" else BOLD_FONT
            for c_i in range(1, 4):
                ws_att.cell(row=r_idx, column=c_i).border = BORDER_THIN
            r_idx += 1

        auto_fit_columns(ws_att)

    # --- TAB 4: FEES ---
    if "fees" in selected_modules and fees:
        ws_fee = wb.create_sheet(title="Fee & Ledger")
        apply_report_header(
            ws_fee,
            "FEES, CHALLANS & PAYMENT LEDGER",
            f"{student['name']} | Family: {student.get('family_code') or '—'}",
            f"Total Billed: PKR {fees['totalBilled']:,.0f} | Paid: PKR {fees['totalPaid']:,.0f} | Balance: PKR {fees['totalBalance']:,.0f}"
        )

        r_idx = 5
        f_hdrs = ["Challan No", "Month", "Due Date", "Charges (PKR)", "Discount (PKR)", "Payable (PKR)", "Paid (PKR)", "Balance (PKR)", "Status"]
        for col_i, h in enumerate(f_hdrs, start=1):
            cell = ws_fee.cell(row=r_idx, column=col_i, value=h)
            cell.font = WHITE_FONT_BOLD
            cell.fill = NAVY_FILL
            cell.alignment = ALIGN_RIGHT if col_i in [4, 5, 6, 7, 8] else ALIGN_LEFT
        r_idx += 1
        fee_start_row = r_idx

        for ch in fees["challans"]:
            ws_fee.cell(row=r_idx, column=1, value=ch.get("challan_no")).font = BOLD_FONT
            ws_fee.cell(row=r_idx, column=2, value=ch.get("month_label")).font = REG_FONT
            ws_fee.cell(row=r_idx, column=3, value=ch.get("due_date")).font = REG_FONT

            for col_i, key in [(4, "tuition_fee"), (5, "sibling_discount"), (6, "total_payable"), (7, "paid_amount"), (8, "balance_amount")]:
                val = float(ch.get(key) or 0.0)
                c_num = ws_fee.cell(row=r_idx, column=col_i, value=val)
                c_num.number_format = '"PKR "#,##0'
                c_num.alignment = ALIGN_RIGHT
                c_num.font = REG_FONT

            st_val = ch.get("status", "Unpaid")
            c_st = ws_fee.cell(row=r_idx, column=9, value=st_val)
            c_st.font = SUCCESS_FONT_BOLD if st_val == "Paid" else DANGER_FONT_BOLD if st_val == "Unpaid" else BOLD_FONT
            c_st.alignment = ALIGN_CENTER

            for c_i in range(1, 10):
                ws_fee.cell(row=r_idx, column=c_i).border = BORDER_THIN
            r_idx += 1

        # Summary Row
        if len(fees["challans"]) > 0:
            ws_fee.cell(row=r_idx, column=1, value="Total / Reconciliation").font = BOLD_FONT
            for col_i, col_ltr in [(6, "F"), (7, "G"), (8, "H")]:
                cell = ws_fee.cell(row=r_idx, column=col_i, value=f"=SUM({col_ltr}{fee_start_row}:{col_ltr}{r_idx-1})")
                cell.font = BOLD_FONT
                cell.number_format = '"PKR "#,##0'
                cell.alignment = ALIGN_RIGHT
                cell.border = BORDER_TOP_BOTTOM
            r_idx += 2

            # Native BarChart: Fee Billed vs Paid vs Balance
            fee_chart = BarChart()
            fee_chart.type = "col"
            fee_chart.style = 11
            fee_chart.title = f"Fee Overview — {student['name']}"
            fee_chart.y_axis.title = "Amount (PKR)"
            fee_chart.height = 10
            fee_chart.width = 14

            # Prepare mini-table for chart
            ws_fee.cell(row=r_idx, column=1, value="Category").font = BOLD_FONT
            ws_fee.cell(row=r_idx, column=2, value="Amount").font = BOLD_FONT
            ws_fee.cell(row=r_idx + 1, column=1, value="Total Paid")
            ws_fee.cell(row=r_idx + 1, column=2, value=fees["totalPaid"])
            ws_fee.cell(row=r_idx + 2, column=1, value="Outstanding Balance")
            ws_fee.cell(row=r_idx + 2, column=2, value=fees["totalBalance"])

            f_data = Reference(ws_fee, min_col=2, min_row=r_idx, max_row=r_idx + 2)
            f_cats = Reference(ws_fee, min_col=1, min_row=r_idx + 1, max_row=r_idx + 2)
            fee_chart.add_data(f_data, titles_from_data=True)
            fee_chart.set_categories(f_cats)
            ws_fee.add_chart(fee_chart, "K5")

        auto_fit_columns(ws_fee)

    # --- TAB 5: CONDUCT ---
    if "conduct" in selected_modules and conduct:
        ws_con = wb.create_sheet(title="Conduct & Discipline")
        apply_report_header(
            ws_con,
            "STUDENT DISCIPLINARY & MERIT REGISTER",
            f"{student['name']} | Total Demerit Points: {conduct['totalPoints']}",
            "Status: Good Standing" if conduct["totalPoints"] == 0 else f"Total Violations Recorded: {len(conduct['records'])}"
        )

        r_idx = 5
        c_hdrs = ["Date", "Category", "Severity", "Points", "Remarks / Description", "Reported By", "Status"]
        for col_i, h in enumerate(c_hdrs, start=1):
            cell = ws_con.cell(row=r_idx, column=col_i, value=h)
            cell.font = WHITE_FONT_BOLD
            cell.fill = NAVY_FILL
        r_idx += 1

        if len(conduct["records"]) == 0:
            ws_con.cell(row=r_idx, column=1, value="No disciplinary violations recorded for this student.").font = SUCCESS_FONT_BOLD
        else:
            for rec in conduct["records"]:
                ws_con.cell(row=r_idx, column=1, value=rec.get("date")).font = REG_FONT
                ws_con.cell(row=r_idx, column=2, value=rec.get("category")).font = BOLD_FONT
                ws_con.cell(row=r_idx, column=3, value=rec.get("severity")).font = REG_FONT
                ws_con.cell(row=r_idx, column=4, value=rec.get("points")).font = REG_FONT
                ws_con.cell(row=r_idx, column=5, value=rec.get("notes") or "—").font = REG_FONT
                ws_con.cell(row=r_idx, column=6, value=rec.get("reported_by")).font = REG_FONT
                ws_con.cell(row=r_idx, column=7, value=rec.get("status", "Closed")).font = REG_FONT
                for c_i in range(1, 8):
                    ws_con.cell(row=r_idx, column=c_i).border = BORDER_THIN
                r_idx += 1

        auto_fit_columns(ws_con)

    return wb

# ==============================================================================
# EXCEL GENERATION: COLLECTIVE CLASS REPORT WITH NATIVE CHARTS
# ==============================================================================

def generate_class_report_workbook(data, selected_modules=None):
    wb = openpyxl.Workbook()
    class_id = data["classId"]
    section_id = data["sectionId"]
    session = data["session"]
    cycle = data["cycle"]
    subjects = data["subjects"]
    academic_rows = data["academicRows"]
    subject_averages = data["subjectAverages"]
    grade_dist = data["gradeDistribution"]
    attendance_rows = data["attendanceRows"]
    fee_rows = data.get("feeRows")
    fee_totals = data.get("feeTotals")
    conduct_rows = data.get("conductRows")

    if not selected_modules:
        selected_modules = ["academics", "attendance", "fees", "conduct"]

    # --- TAB 1: CLASS OVERVIEW ---
    ws_ov = wb.active
    ws_ov.title = "Class Overview"
    apply_report_header(
        ws_ov,
        "COLLECTIVE CLASS MASTER REPORT",
        f"Class: {class_id} ({section_id}) | Session: {session['name']}",
        f"Total Enrolled Students: {data['studentCount']} | Examination: {cycle['name']}"
    )

    r_idx = 5
    summary_boxes = [
        ("Total Students Enrolled", str(data["studentCount"])),
        ("Examination Cycle", cycle["name"]),
        ("Class Attendance Average", f"{data['classAttendanceAvg']}%" if data['classAttendanceAvg'] is not None else "No Records"),
        ("Active Subjects Count", str(len(subjects)))
    ]
    if fee_totals:
        summary_boxes.append(("Class Fee Billed", f"PKR {fee_totals['billed']:,.0f}"))
        summary_boxes.append(("Class Fee Collected", f"PKR {fee_totals['paid']:,.0f}"))
        summary_boxes.append(("Total Outstanding Balance", f"PKR {fee_totals['balance']:,.0f}"))
        summary_boxes.append(("Collection Efficiency Rate", f"{fee_totals['collectionRate']}%"))

    for title, val in summary_boxes:
        ws_ov.cell(row=r_idx, column=1, value=title).font = BOLD_FONT
        ws_ov.cell(row=r_idx, column=1).fill = SUBTLE_FILL
        ws_ov.cell(row=r_idx, column=2, value=val).font = REG_FONT
        ws_ov.cell(row=r_idx, column=1).border = BORDER_THIN
        ws_ov.cell(row=r_idx, column=2).border = BORDER_THIN
        r_idx += 1

    r_idx += 2
    # Grade Distribution Summary on Overview
    ws_ov.cell(row=r_idx, column=1, value="Grade Distribution").font = DARK_FONT_TITLE
    r_idx += 1
    ws_ov.cell(row=r_idx, column=1, value="Grade").font = WHITE_FONT_BOLD
    ws_ov.cell(row=r_idx, column=1).fill = NAVY_FILL
    ws_ov.cell(row=r_idx, column=2, value="Student Count").font = WHITE_FONT_BOLD
    ws_ov.cell(row=r_idx, column=2).fill = NAVY_FILL
    r_idx += 1
    grade_chart_start = r_idx

    for grd in ["A+", "A", "B", "C", "D", "F", "Incomplete"]:
        ws_ov.cell(row=r_idx, column=1, value=grd).font = BOLD_FONT
        ws_ov.cell(row=r_idx, column=2, value=grade_dist.get(grd, 0)).alignment = ALIGN_RIGHT
        ws_ov.cell(row=r_idx, column=1).border = BORDER_THIN
        ws_ov.cell(row=r_idx, column=2).border = BORDER_THIN
        r_idx += 1

    # Native BarChart: Grade Distribution
    grd_chart = BarChart()
    grd_chart.type = "col"
    grd_chart.style = 10
    grd_chart.title = f"Grade Distribution — Class {class_id}"
    grd_chart.y_axis.title = "Number of Students"
    grd_chart.x_axis.title = "Grades"
    grd_chart.height = 10
    grd_chart.width = 14
    g_data = Reference(ws_ov, min_col=2, min_row=grade_chart_start - 1, max_row=r_idx - 1)
    g_cats = Reference(ws_ov, min_col=1, min_row=grade_chart_start, max_row=r_idx - 1)
    grd_chart.add_data(g_data, titles_from_data=True)
    grd_chart.set_categories(g_cats)
    ws_ov.add_chart(grd_chart, "D5")

    auto_fit_columns(ws_ov)

    # --- TAB 2: ACADEMIC COMPARISON MATRIX ---
    if "academics" in selected_modules:
        ws_acad = wb.create_sheet(title="Academic Comparison")
        apply_report_header(
            ws_acad,
            f"CLASS {class_id} ACADEMIC BROADSHEET & COMPARISON",
            f"Exam: {cycle['name']} | Session: {session['name']}",
            f"Total Students: {len(academic_rows)} | Subjects: {len(subjects)}"
        )

        r_idx = 5
        fixed_cols_before = ["Roll #", "Student Name", "Father Name"]
        fixed_cols_after = ["Total Marks", "Max Marks", "Percentage", "Grade", "Rank", "Result"]

        # Build Headers
        all_headers = fixed_cols_before + [s["subject_name"] for s in subjects] + fixed_cols_after
        for col_i, h in enumerate(all_headers, start=1):
            cell = ws_acad.cell(row=r_idx, column=col_i, value=h)
            cell.font = WHITE_FONT_BOLD
            cell.fill = NAVY_FILL
            cell.alignment = ALIGN_CENTER if col_i not in [2, 3] else ALIGN_LEFT
        r_idx += 1
        data_start_row = r_idx

        for stu in academic_rows:
            ws_acad.cell(row=r_idx, column=1, value=stu["rollNumber"]).alignment = ALIGN_CENTER
            ws_acad.cell(row=r_idx, column=2, value=stu["name"]).font = BOLD_FONT
            ws_acad.cell(row=r_idx, column=3, value=stu["fatherName"]).font = REG_FONT

            # Subject scores
            col_curr = 4
            for s in subjects:
                val = stu["subjectScores"].get(s["subject_name"], "-")
                c_s = ws_acad.cell(row=r_idx, column=col_curr, value=val if val != "-" else "")
                if isinstance(val, (int, float)):
                    c_s.number_format = "#,##0"
                c_s.alignment = ALIGN_RIGHT
                c_s.font = REG_FONT
                col_curr += 1

            # Totals & Rankings
            c_tot = ws_acad.cell(row=r_idx, column=col_curr, value=stu["totalObtained"] if stu["totalObtained"] is not None else "")
            c_tot.number_format = "#,##0"
            c_tot.font = BOLD_FONT
            c_tot.alignment = ALIGN_RIGHT

            c_max = ws_acad.cell(row=r_idx, column=col_curr + 1, value=stu["totalMax"])
            c_max.number_format = "#,##0"
            c_max.font = REG_FONT
            c_max.alignment = ALIGN_RIGHT

            c_pct = ws_acad.cell(row=r_idx, column=col_curr + 2, value=(stu["percentage"] / 100.0) if stu["percentage"] is not None else "")
            c_pct.number_format = "0.0%"
            c_pct.font = BOLD_FONT
            c_pct.alignment = ALIGN_RIGHT

            c_grd = ws_acad.cell(row=r_idx, column=col_curr + 3, value=stu["grade"])
            c_grd.font = BOLD_FONT
            c_grd.alignment = ALIGN_CENTER

            c_rnk = ws_acad.cell(row=r_idx, column=col_curr + 4, value=stu["rank"])
            c_rnk.font = BOLD_FONT
            c_rnk.alignment = ALIGN_CENTER

            c_res = ws_acad.cell(row=r_idx, column=col_curr + 5, value="Pass" if stu["passed"] else "Fail" if stu["hasMarks"] else "Incomplete")
            c_res.font = SUCCESS_FONT_BOLD if stu["passed"] else DANGER_FONT_BOLD
            c_res.alignment = ALIGN_CENTER

            for c_i in range(1, len(all_headers) + 1):
                ws_acad.cell(row=r_idx, column=c_i).border = BORDER_THIN
            r_idx += 1

        # Class Subject Averages Row
        if len(academic_rows) > 0:
            ws_acad.cell(row=r_idx, column=2, value="Class Subject Averages").font = BOLD_FONT
            col_curr = 4
            for s in subjects:
                avg_val = subject_averages.get(s["subject_name"], 0.0)
                c_avg = ws_acad.cell(row=r_idx, column=col_curr, value=avg_val)
                c_avg.font = BOLD_FONT
                c_avg.number_format = "#,##0.0"
                c_avg.alignment = ALIGN_RIGHT
                c_avg.border = BORDER_TOP_BOTTOM
                col_curr += 1
            ws_acad.row_dimensions[r_idx].height = 22
            r_idx += 2

            # Native BarChart: Subject Averages
            if len(subjects) > 0:
                avg_chart = BarChart()
                avg_chart.type = "col"
                avg_chart.style = 10
                avg_chart.title = f"Class {class_id} Subject Averages"
                avg_chart.y_axis.title = "Average Marks"
                avg_chart.x_axis.title = "Subjects"
                avg_chart.height = 11
                avg_chart.width = 18

                # Data is the average row
                avg_data = Reference(ws_acad, min_col=4, max_col=3 + len(subjects), min_row=r_idx - 2, max_row=r_idx - 2)
                avg_cats = Reference(ws_acad, min_col=4, max_col=3 + len(subjects), min_row=5, max_row=5)
                avg_chart.add_data(avg_data, from_rows=True, titles_from_data=False)
                avg_chart.set_categories(avg_cats)
                ws_acad.add_chart(avg_chart, f"{get_column_letter(len(all_headers) + 2)}5")

        ws_acad.freeze_panes = "D6"
        auto_fit_columns(ws_acad)

    # --- TAB 3: ATTENDANCE SUMMARY ---
    if "attendance" in selected_modules:
        ws_att = wb.create_sheet(title="Attendance Summary")
        apply_report_header(
            ws_att,
            f"CLASS {class_id} ATTENDANCE SUMMARY MATRIX",
            f"Class Presence Rate: {data['classAttendanceAvg']}%",
            f"Session: {session['name']}"
        )

        r_idx = 5
        att_hdrs = ["Roll #", "Student Name", "Father Name", "Present Days", "Absent Days", "Leave Days", "Total Eligible Days", "Attendance %", "Low Attendance Alert"]
        for col_i, h in enumerate(att_hdrs, start=1):
            cell = ws_att.cell(row=r_idx, column=col_i, value=h)
            cell.font = WHITE_FONT_BOLD
            cell.fill = NAVY_FILL
            cell.alignment = ALIGN_RIGHT if col_i in [4, 5, 6, 7, 8] else ALIGN_CENTER if col_i in [1, 9] else ALIGN_LEFT
        r_idx += 1

        for a in attendance_rows:
            ws_att.cell(row=r_idx, column=1, value=a["rollNumber"]).alignment = ALIGN_CENTER
            ws_att.cell(row=r_idx, column=2, value=a["name"]).font = BOLD_FONT
            ws_att.cell(row=r_idx, column=3, value=a["fatherName"]).font = REG_FONT
            ws_att.cell(row=r_idx, column=4, value=a["present"]).alignment = ALIGN_RIGHT
            ws_att.cell(row=r_idx, column=5, value=a["absent"]).alignment = ALIGN_RIGHT
            ws_att.cell(row=r_idx, column=6, value=a["leave"]).alignment = ALIGN_RIGHT
            ws_att.cell(row=r_idx, column=7, value=a["totalDays"]).alignment = ALIGN_RIGHT

            c_pct = ws_att.cell(row=r_idx, column=8, value=(a["percentage"] / 100.0) if a["percentage"] is not None else "")
            c_pct.number_format = "0.0%"
            c_pct.alignment = ALIGN_RIGHT
            c_pct.font = BOLD_FONT

            c_alert = ws_att.cell(row=r_idx, column=9, value="<75% ALERT" if a["lowAttendance"] else "Normal")
            c_alert.font = DANGER_FONT_BOLD if a["lowAttendance"] else REG_FONT
            c_alert.alignment = ALIGN_CENTER

            for c_i in range(1, 10):
                ws_att.cell(row=r_idx, column=c_i).border = BORDER_THIN
            r_idx += 1

        auto_fit_columns(ws_att)

    # --- TAB 4: FEE SUMMARY ---
    if "fees" in selected_modules and fee_rows:
        ws_f = wb.create_sheet(title="Fee Summary")
        apply_report_header(
            ws_f,
            f"CLASS {class_id} FINANCIAL COLLECTION & OUTSTANDING REPORT",
            f"Billed: PKR {fee_totals['billed']:,.0f} | Collected: PKR {fee_totals['paid']:,.0f} | Outstanding: PKR {fee_totals['balance']:,.0f}",
            f"Session: {session['name']} | Note: Family discounts allocated accurately per student"
        )

        r_idx = 5
        f_hdrs = ["Roll #", "Student Name", "Father Name", "Family Code", "Total Billed (PKR)", "Sibling Discount (PKR)", "Paid Amount (PKR)", "Balance Outstanding (PKR)", "Challans Count"]
        for col_i, h in enumerate(f_hdrs, start=1):
            cell = ws_f.cell(row=r_idx, column=col_i, value=h)
            cell.font = WHITE_FONT_BOLD
            cell.fill = NAVY_FILL
            cell.alignment = ALIGN_RIGHT if col_i in [5, 6, 7, 8, 9] else ALIGN_CENTER if col_i in [1, 4] else ALIGN_LEFT
        r_idx += 1
        data_start_r = r_idx

        for f in fee_rows:
            ws_f.cell(row=r_idx, column=1, value=f["rollNumber"]).alignment = ALIGN_CENTER
            ws_f.cell(row=r_idx, column=2, value=f["name"]).font = BOLD_FONT
            ws_f.cell(row=r_idx, column=3, value=f["fatherName"]).font = REG_FONT
            ws_f.cell(row=r_idx, column=4, value=f["familyCode"]).alignment = ALIGN_CENTER

            for col_i, key in [(5, "billed"), (6, "discount"), (7, "paid"), (8, "balance")]:
                cell = ws_f.cell(row=r_idx, column=col_i, value=f[key])
                cell.number_format = '"PKR "#,##0'
                cell.alignment = ALIGN_RIGHT
                cell.font = REG_FONT

            ws_f.cell(row=r_idx, column=9, value=f["challanCount"]).alignment = ALIGN_RIGHT
            for c_i in range(1, 10):
                ws_f.cell(row=r_idx, column=c_i).border = BORDER_THIN
            r_idx += 1

        # Class Totals Row
        if len(fee_rows) > 0:
            ws_f.cell(row=r_idx, column=3, value="Total Class Collection").font = BOLD_FONT
            for col_i, col_ltr in [(5, "E"), (6, "F"), (7, "G"), (8, "H")]:
                c_tot = ws_f.cell(row=r_idx, column=col_i, value=f"=SUM({col_ltr}{data_start_r}:{col_ltr}{r_idx-1})")
                c_tot.font = BOLD_FONT
                c_tot.number_format = '"PKR "#,##0'
                c_tot.alignment = ALIGN_RIGHT
                c_tot.border = BORDER_TOP_BOTTOM

            # Native BarChart: Fee Billed vs Collected
            fee_chart = BarChart()
            fee_chart.type = "col"
            fee_chart.style = 10
            fee_chart.title = f"Class {class_id} Fee Collection Summary"
            fee_chart.y_axis.title = "Amount (PKR)"
            fee_chart.height = 10
            fee_chart.width = 14

            # Mini table for chart
            ws_f.cell(row=r_idx + 2, column=1, value="Category").font = BOLD_FONT
            ws_f.cell(row=r_idx + 2, column=2, value="Amount").font = BOLD_FONT
            ws_f.cell(row=r_idx + 3, column=1, value="Total Collected")
            ws_f.cell(row=r_idx + 3, column=2, value=fee_totals["paid"])
            ws_f.cell(row=r_idx + 4, column=1, value="Total Outstanding")
            ws_f.cell(row=r_idx + 4, column=2, value=fee_totals["balance"])

            f_data = Reference(ws_f, min_col=2, min_row=r_idx + 2, max_row=r_idx + 4)
            f_cats = Reference(ws_f, min_col=1, min_row=r_idx + 3, max_row=r_idx + 4)
            fee_chart.add_data(f_data, titles_from_data=True)
            fee_chart.set_categories(f_cats)
            ws_f.add_chart(fee_chart, "K5")

        auto_fit_columns(ws_f)

    # --- TAB 5: CONDUCT SUMMARY ---
    if "conduct" in selected_modules and conduct_rows:
        ws_con = wb.create_sheet(title="Conduct Summary")
        apply_report_header(
            ws_con,
            f"CLASS {class_id} DISCIPLINARY & MERIT OVERVIEW",
            f"Session: {session['name']}",
            f"Class Infraction Log & Penalty Points"
        )
        r_idx = 5
        c_hdrs = ["Roll #", "Student Name", "Father Name", "Total Violations", "Penalty Points", "Status"]
        for col_i, h in enumerate(c_hdrs, start=1):
            cell = ws_con.cell(row=r_idx, column=col_i, value=h)
            cell.font = WHITE_FONT_BOLD
            cell.fill = NAVY_FILL
            cell.alignment = ALIGN_CENTER if col_i in [1, 4, 5, 6] else ALIGN_LEFT
        r_idx += 1

        for c in conduct_rows:
            ws_con.cell(row=r_idx, column=1, value=c["rollNumber"]).alignment = ALIGN_CENTER
            ws_con.cell(row=r_idx, column=2, value=c["name"]).font = BOLD_FONT
            ws_con.cell(row=r_idx, column=3, value=c["fatherName"]).font = REG_FONT
            ws_con.cell(row=r_idx, column=4, value=c["violationCount"]).alignment = ALIGN_RIGHT
            ws_con.cell(row=r_idx, column=5, value=c["penaltyPoints"]).alignment = ALIGN_RIGHT
            st_text = "Good Standing" if c["violationCount"] == 0 else f"{c['violationCount']} Infractions"
            ws_con.cell(row=r_idx, column=6, value=st_text).font = SUCCESS_FONT_BOLD if c["violationCount"] == 0 else DANGER_FONT_BOLD
            for c_i in range(1, 7):
                ws_con.cell(row=r_idx, column=c_i).border = BORDER_THIN
            r_idx += 1

        auto_fit_columns(ws_con)

    return wb

# ==============================================================================
# CLASS WITH INDIVIDUAL STUDENT SHEETS
# ==============================================================================

def generate_class_with_individual_sheets(conn, class_data, selected_modules=None, current_user=None):
    wb = generate_class_report_workbook(class_data, selected_modules)
    class_id = class_data["classId"]
    session_id = class_data["session"]["id"]
    cycle_id = class_data["cycle"]["id"]

    for row in class_data["academicRows"]:
        stu_id = row["studentId"]
        stu_data = get_student_report_data(conn, stu_id, session_id=session_id, exam_cycle_id=cycle_id, current_user=current_user)
        if not stu_data:
            continue

        sheet_name = sanitize_sheet_title(f"R{row['rollNumber']}-{row['name']}")
        # Ensure sheet title uniqueness
        idx = 2
        orig_name = sheet_name
        while sheet_name in wb.sheetnames:
            sheet_name = f"{orig_name[:28]}_{idx}"
            idx += 1

        ws = wb.create_sheet(title=sheet_name)
        apply_report_header(
            ws,
            f"STUDENT DOSSIER — {row['name'].upper()}",
            f"Roll #{row['rollNumber']} | Class {class_id}",
            f"Total Marks: {row['totalObtained']} / {row['totalMax']} ({row['percentage']}%) | Grade: {row['grade']}"
        )

        r_idx = 5
        ws.cell(row=r_idx, column=1, value="Subject").font = WHITE_FONT_BOLD
        ws.cell(row=r_idx, column=1).fill = NAVY_FILL
        ws.cell(row=r_idx, column=2, value="Obtained Marks").font = WHITE_FONT_BOLD
        ws.cell(row=r_idx, column=2).fill = NAVY_FILL
        ws.cell(row=r_idx, column=3, value="Max Marks").font = WHITE_FONT_BOLD
        ws.cell(row=r_idx, column=3).fill = NAVY_FILL
        ws.cell(row=r_idx, column=4, value="Percentage").font = WHITE_FONT_BOLD
        ws.cell(row=r_idx, column=4).fill = NAVY_FILL
        ws.cell(row=r_idx, column=5, value="Grade").font = WHITE_FONT_BOLD
        ws.cell(row=r_idx, column=5).fill = NAVY_FILL
        r_idx += 1

        for sname, sval in row["subjectScores"].items():
            ws.cell(row=r_idx, column=1, value=sname).font = BOLD_FONT
            ws.cell(row=r_idx, column=2, value=sval if isinstance(sval, (int, float)) else str(sval)).alignment = ALIGN_RIGHT
            ws.cell(row=r_idx, column=3, value=100).alignment = ALIGN_RIGHT
            ws.cell(row=r_idx, column=4, value=f"{sval}%" if isinstance(sval, (int, float)) else "-").alignment = ALIGN_RIGHT
            ws.cell(row=r_idx, column=5, value=calculate_grade(sval) if isinstance(sval, (int, float)) else "-").alignment = ALIGN_CENTER
            for ci in range(1, 6):
                ws.cell(row=r_idx, column=ci).border = BORDER_THIN
            r_idx += 1

        auto_fit_columns(ws)

    return wb

# ==============================================================================
# BULK ZIP EXPORT GENERATOR WITH MANIFEST
# ==============================================================================

def generate_bulk_student_zip(conn, class_id, section_id=None, session_id=None, exam_cycle_id=None, selected_modules=None, current_user=None):
    class_data = get_class_report_data(conn, class_id, section_id=section_id, session_id=session_id, exam_cycle_id=exam_cycle_id, current_user=current_user)
    students = class_data["academicRows"]

    zip_buffer = io.BytesIO()
    manifest_records = []
    generated_count = 0
    failed_count = 0

    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for s in students:
            try:
                stu_data = get_student_report_data(conn, s["studentId"], session_id=session_id, exam_cycle_id=exam_cycle_id, current_user=current_user)
                if not stu_data:
                    failed_count += 1
                    continue

                wb = generate_student_report_workbook(stu_data, selected_modules)
                wb_io = io.BytesIO()
                wb.save(wb_io)
                wb_io.seek(0)

                ascii_name = re.sub(r'[^\x00-\x7F]+', '', s['name']).strip()
                safe_name = re.sub(r'[^A-Za-z0-9_\-]', '_', ascii_name).strip() or f"Student_{s['rollNumber']}"
                safe_adm = re.sub(r'[^A-Za-z0-9_\-]', '_', str(stu_data['student']['admission_no'])).strip()
                sess_slug = re.sub(r'[^A-Za-z0-9_\-]', '_', class_data['session']['name']).strip()
                filename = f"StudentReport_{safe_adm}_{safe_name}_{sess_slug}.xlsx"

                zf.writestr(filename, wb_io.getvalue())
                generated_count += 1
                manifest_records.append({
                    "student_id": s["studentId"],
                    "roll_number": s["rollNumber"],
                    "name": s["name"],
                    "father_name": s["fatherName"],
                    "filename": filename,
                    "status": "Success",
                    "file_size_bytes": len(wb_io.getvalue())
                })
            except Exception as e:
                failed_count += 1
                manifest_records.append({
                    "student_id": s["studentId"],
                    "roll_number": s["rollNumber"],
                    "name": s["name"],
                    "father_name": s["fatherName"],
                    "filename": None,
                    "status": f"Failed: {str(e)}",
                    "file_size_bytes": 0
                })

        # Add manifest.json
        manifest_meta = {
            "school": "Hadi Education System Balkassar",
            "class_id": class_id,
            "section": section_id or "All",
            "session": class_data["session"]["name"],
            "generated_at": datetime.now().isoformat(),
            "total_students": len(students),
            "generated_count": generated_count,
            "failed_count": failed_count,
            "records": manifest_records
        }
        zf.writestr("manifest.json", json.dumps(manifest_meta, indent=2))

        # Add human-readable MANIFEST.txt
        txt_lines = [
            "================================================================================",
            "HADI EDUCATION SYSTEM BALKASSAR — BULK STUDENT REPORTS MANIFEST",
            "================================================================================",
            f"Class: {class_id} ({section_id or 'All'})",
            f"Session: {class_data['session']['name']}",
            f"Generated At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Reports Generated: {generated_count} / {len(students)} (Failed: {failed_count})",
            "--------------------------------------------------------------------------------",
            f"{'Roll':<6} | {'Student Name':<25} | {'Father Name':<25} | {'Status':<10} | Filename",
            "--------------------------------------------------------------------------------"
        ]
        for r in manifest_records:
            txt_lines.append(f"{str(r['roll_number']):<6} | {str(r['name'])[:25]:<25} | {str(r['father_name'])[:25]:<25} | {r['status'][:10]:<10} | {r['filename'] or 'N/A'}")
        txt_lines.append("================================================================================")
        zf.writestr("MANIFEST.txt", "\n".join(txt_lines))

    zip_buffer.seek(0)
    return zip_buffer.getvalue(), manifest_meta

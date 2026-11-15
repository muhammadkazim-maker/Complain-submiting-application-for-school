import urllib.request
import urllib.parse
import json
import os

SAMPLE_DIR = r"C:\Users\user\.gemini\antigravity\brain\74811d7a-2cf1-4e02-8424-7ad6dd637088\sample_reports"
os.makedirs(SAMPLE_DIR, exist_ok=True)
BASE_URL = "http://127.0.0.1:8000"

# 1. Login
login_req = urllib.request.Request(
    f"{BASE_URL}/api/auth/login",
    data=json.dumps({"username": "admin", "password": "password"}).encode('utf-8'),
    headers={"Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(login_req) as resp:
        token = json.loads(resp.read().decode())["token"]
except:
    login_req = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=json.dumps({"username": "admin", "password": "admin123"}).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(login_req) as resp:
        token = json.loads(resp.read().decode())["token"]

headers = {"Authorization": f"Bearer {token}"}

# 2. Export Sample Individual Student Report (Ali Abbas, 10th)
q1 = urllib.parse.urlencode({"scope": "student", "student_id": "hes_91", "exam_cycle_id": "cyc_midterm_2025", "modules": "academics,attendance,fees,conduct"})
req1 = urllib.request.Request(f"{BASE_URL}/api/reports/export-excel?{q1}", headers=headers)
with urllib.request.urlopen(req1) as resp:
    p1 = os.path.join(SAMPLE_DIR, "Sample_Student_Report_Ali_Abbas.xlsx")
    with open(p1, "wb") as f:
        f.write(resp.read())
print(f"Saved: {p1}")

# 3. Export Sample Class Master Report (Class 10th)
q2 = urllib.parse.urlencode({"scope": "class", "class_id": "10th", "exam_cycle_id": "cyc_midterm_2025", "modules": "academics,attendance,fees,conduct"})
req2 = urllib.request.Request(f"{BASE_URL}/api/reports/export-excel?{q2}", headers=headers)
with urllib.request.urlopen(req2) as resp:
    p2 = os.path.join(SAMPLE_DIR, "Sample_Class_10th_Master_Report.xlsx")
    with open(p2, "wb") as f:
        f.write(resp.read())
print(f"Saved: {p2}")

# 4. Export Sample Class with Individual Dossier Sheets
payload_dossiers = json.dumps({"export_type": "class_individual_sheets", "class_id": "10th", "exam_cycle_id": "cyc_midterm_2025"}).encode('utf-8')
req3 = urllib.request.Request(f"{BASE_URL}/api/reports/bulk-export", data=payload_dossiers, headers={"Content-Type": "application/json", **headers})
with urllib.request.urlopen(req3) as resp:
    p3 = os.path.join(SAMPLE_DIR, "Sample_Class_10th_With_Individual_Dossiers.xlsx")
    with open(p3, "wb") as f:
        f.write(resp.read())
print(f"Saved: {p3}")

# 5. Export Sample Bulk ZIP
payload_zip = json.dumps({"export_type": "bulk_zip", "class_id": "10th", "exam_cycle_id": "cyc_midterm_2025"}).encode('utf-8')
req4 = urllib.request.Request(f"{BASE_URL}/api/reports/bulk-export", data=payload_zip, headers={"Content-Type": "application/json", **headers})
with urllib.request.urlopen(req4) as resp:
    p4 = os.path.join(SAMPLE_DIR, "Sample_Bulk_Student_Reports_Class_10th.zip")
    with open(p4, "wb") as f:
        f.write(resp.read())
print(f"Saved: {p4}")

print("All sample files generated successfully!")

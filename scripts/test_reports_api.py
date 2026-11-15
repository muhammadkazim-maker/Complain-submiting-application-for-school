import json
import urllib.request
import urllib.parse
import zipfile
import io
import openpyxl

def test_reports():
    base_url = "http://127.0.0.1:8000"
    
    # 1. Login as Admin
    login_req = urllib.request.Request(
        f"{base_url}/api/auth/login",
        data=json.dumps({"username": "admin", "password": "password"}).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(login_req) as resp:
            login_data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        # try admin / admin123
        login_req = urllib.request.Request(
            f"{base_url}/api/auth/login",
            data=json.dumps({"username": "admin", "password": "admin123"}).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(login_req) as resp:
            login_data = json.loads(resp.read().decode())

    token = login_data["token"]
    print("Logged in successfully, token:", token[:15] + "...")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Test filter options
    req = urllib.request.Request(f"{base_url}/api/reports/filter-options", headers=headers)
    with urllib.request.urlopen(req) as resp:
        filters = json.loads(resp.read().decode())
    print("Filter Options:")
    print(f"  Sessions: {len(filters['sessions'])}")
    print(f"  Classes: {len(filters['classes'])}")
    print(f"  Sections: {len(filters['sections'])}")
    print(f"  Exam Cycles: {len(filters['examCycles'])}")
    print(f"  Students: {len(filters['students'])}")
    assert len(filters["students"]) == 134, "Expected 134 students in filter options"
    sample_stu = filters["students"][0]
    sample_class = sample_stu["current_class_id"]

    # 3. Test Student Report Preview
    params = urllib.parse.urlencode({
        "scope": "student",
        "student_id": sample_stu["id"],
        "modules": "academics,attendance,fees,conduct"
    })
    req = urllib.request.Request(f"{base_url}/api/reports/preview?{params}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        stu_prev = json.loads(resp.read().decode())
    print(f"\nStudent Preview ({sample_stu['name']}):")
    print(f"  Student: {stu_prev['data']['student']['name']}")
    print(f"  Class: {stu_prev['data']['student']['current_class_id']}")
    print(f"  Attendance Days: {stu_prev['data']['attendance']['totalDays']}")

    # 4. Test Class Report Preview
    c_params = urllib.parse.urlencode({
        "scope": "class",
        "class_id": sample_class,
        "section_id": "All",
        "modules": "academics,attendance,fees,conduct"
    })
    req = urllib.request.Request(f"{base_url}/api/reports/preview?{c_params}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        cls_prev = json.loads(resp.read().decode())
    print(f"\nClass Preview (Class {sample_class}):")
    print(f"  Student Count: {cls_prev['data']['studentCount']}")
    print(f"  Academic Rows: {len(cls_prev['data']['academicRows'])}")

    # 5. Test Student Excel Export
    req = urllib.request.Request(f"{base_url}/api/reports/export-excel?{params}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        stu_excel_bytes = resp.read()
    print(f"\nStudent Excel Export: {len(stu_excel_bytes)} bytes")
    # Verify with openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(stu_excel_bytes))
    print(f"  Sheets in Student Excel: {wb.sheetnames}")
    assert "Student Summary" in wb.sheetnames
    assert "Academic Results" in wb.sheetnames
    assert "Attendance Record" in wb.sheetnames

    # 6. Test Class Excel Export
    req = urllib.request.Request(f"{base_url}/api/reports/export-excel?{c_params}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        cls_excel_bytes = resp.read()
    print(f"\nClass Excel Export: {len(cls_excel_bytes)} bytes")
    wb_cls = openpyxl.load_workbook(io.BytesIO(cls_excel_bytes))
    print(f"  Sheets in Class Excel: {wb_cls.sheetnames}")
    assert "Class Overview" in wb_cls.sheetnames
    assert "Academic Comparison" in wb_cls.sheetnames
    assert "Attendance Summary" in wb_cls.sheetnames

    # 7. Test Bulk ZIP Export
    bulk_data = json.dumps({
        "export_type": "bulk_zip",
        "class_id": sample_class,
        "section_id": "All",
        "modules": ["academics", "attendance", "fees", "conduct"]
    }).encode('utf-8')
    bulk_req = urllib.request.Request(
        f"{base_url}/api/reports/bulk-export",
        data=bulk_data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(bulk_req) as resp:
        zip_bytes = resp.read()
    print(f"\nBulk ZIP Export: {len(zip_bytes)} bytes")
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        namelist = zf.namelist()
        print(f"  Files in ZIP ({len(namelist)} files):")
        print(f"  Contains manifest.json: {'manifest.json' in namelist}")
        print(f"  Contains MANIFEST.txt: {'MANIFEST.txt' in namelist}")
        for n in namelist[:3]:
            print(f"    - {n}")

    # 8. Test Class with Individual Dossier Sheets
    ind_data = json.dumps({
        "export_type": "class_individual_sheets",
        "class_id": sample_class,
        "section_id": "All",
        "modules": ["academics", "attendance", "fees", "conduct"]
    }).encode('utf-8')
    ind_req = urllib.request.Request(
        f"{base_url}/api/reports/bulk-export",
        data=ind_data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(ind_req) as resp:
        ind_bytes = resp.read()
    print(f"\nClass with Individual Sheets Export: {len(ind_bytes)} bytes")
    wb_ind = openpyxl.load_workbook(io.BytesIO(ind_bytes))
    print(f"  Total Sheets in Combined Dossier: {len(wb_ind.sheetnames)}")
    print(f"  Sample Sheets: {wb_ind.sheetnames[:5]}")

    print("\nALL BACKEND REPORT APIS VERIFIED SUCCESSFULLY!")

if __name__ == '__main__':
    test_reports()

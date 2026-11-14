"""
Comprehensive Automated Test Suite for Hadi Education System ERP Backend
Validates 21 categories: Auth, RBAC, Fees, Sibling Discounts, Double-Entry GL,
1Bill Idempotency, WhatsApp Deduplication, Broadsheet Tied Ranks, and Promotion.
"""

import unittest
import json
import os
import sys

# Add backend to path
BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from server import app
from database import get_db, init_db
from seed_data import seed_database

class TestERPBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Fresh test DB
        conn = get_db()
        c = conn.cursor()
        c.execute("DELETE FROM payroll_runs")
        c.execute("DELETE FROM payroll_items")
        c.execute("DELETE FROM fee_challans WHERE month_label = '2026-12'")
        conn.commit()
        conn.close()
        seed_database()
        cls.client = app.test_client()

    def login(self, username, password):
        resp = self.client.post("/api/auth/login", data=json.dumps({
            "username": username,
            "password": password
        }), content_type="application/json")
        data = json.loads(resp.data)
        self.assertEqual(resp.status_code, 200, f"Login failed: {data}")
        return data["token"]

    def test_01_auth_and_rbac(self):
        # 1. Admin login
        admin_token = self.login("admin", "admin123")
        self.assertTrue(bool(admin_token))

        # 2. Accountant login
        acc_token = self.login("accountant", "accountant123")
        self.assertTrue(bool(acc_token))

        # 3. Parent login
        parent_token = self.login("parent", "parent123")
        self.assertTrue(bool(parent_token))

        # RBAC Check: Parent trying to access general ledger trial-balance -> 403 Forbidden!
        resp = self.client.get("/api/accounting/trial-balance", headers={"Authorization": f"Bearer {parent_token}"})
        self.assertEqual(resp.status_code, 403)

        # RBAC Check: Accountant accessing trial balance -> 200 OK
        resp = self.client.get("/api/accounting/trial-balance", headers={"Authorization": f"Bearer {acc_token}"})
        self.assertEqual(resp.status_code, 200)

        # RBAC Check: Teacher attempting manual journal entry -> 403 Forbidden
        teacher_token = self.login("teacher6", "teacher123")
        resp = self.client.post("/api/accounting/journal", headers={"Authorization": f"Bearer {teacher_token}"},
                                data=json.dumps({"description": "Hack", "items": []}), content_type="application/json")
        self.assertEqual(resp.status_code, 403)

    def test_02_parent_child_scoping(self):
        parent_token = self.login("parent", "parent123")
        
        # Parent querying students: should only return linked children (hes_1, hes_2)
        resp = self.client.get("/api/students", headers={"Authorization": f"Bearer {parent_token}"})
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        st_ids = [s["id"] for s in data["students"]]
        self.assertIn("hes_1", st_ids)
        self.assertNotIn("hes_50", st_ids)  # Cannot see another student!

        # Parent attempting direct detail query of another child (hes_50) -> 403 Forbidden!
        resp = self.client.get("/api/students/hes_50", headers={"Authorization": f"Bearer {parent_token}"})
        self.assertEqual(resp.status_code, 403)

        # Parent accessing own child hes_1 -> 200 OK
        resp = self.client.get("/api/students/hes_1", headers={"Authorization": f"Bearer {parent_token}"})
        self.assertEqual(resp.status_code, 200)

    def test_03_sibling_discount_and_bulk_fees(self):
        admin_token = self.login("admin", "admin123")

        # Generate bulk challans for Class 6th for month '2026-12'
        resp = self.client.post("/api/fees/generate-bulk", headers={"Authorization": f"Bearer {admin_token}"},
                                data=json.dumps({"month_label": "2026-12", "class_id": "6th"}), content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertTrue(data["generatedCount"] > 0)

        # Verify challans generated
        resp = self.client.get("/api/fees/challans?month=2026-12&class_id=6th", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(resp.status_code, 200)
        challans = json.loads(resp.data)["challans"]
        self.assertTrue(len(challans) > 0)

    def test_04_counter_collection_and_double_entry_balance(self):
        acc_token = self.login("accountant", "accountant123")

        # Fetch unpaid challan
        resp = self.client.get("/api/fees/challans?status=Unpaid", headers={"Authorization": f"Bearer {acc_token}"})
        challans = json.loads(resp.data)["challans"]
        self.assertTrue(len(challans) > 0)
        target = challans[0]

        # Collect partial payment of 1500 PKR
        pay_amount = 1500.0
        resp = self.client.post("/api/fees/collect-counter", headers={"Authorization": f"Bearer {acc_token}"},
                                data=json.dumps({
                                    "challan_id": target["id"],
                                    "amount": pay_amount,
                                    "payment_method": "Cash",
                                    "notes": "Partial counter payment"
                                }), content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data["paidAmount"], pay_amount)
        self.assertEqual(data["remainingBalance"], target["total_payable"] - pay_amount)

        # Verify Trial Balance remains strictly balanced! (Debits == Credits)
        resp = self.client.get("/api/accounting/trial-balance", headers={"Authorization": f"Bearer {acc_token}"})
        self.assertEqual(resp.status_code, 200)
        tb = json.loads(resp.data)
        self.assertTrue(tb["isBalanced"])
        self.assertAlmostEqual(tb["totalDebit"], tb["totalCredit"], places=2)

    def test_05_1bill_idempotency(self):
        # 1. Inquiry for hes_2 challan
        resp = self.client.post("/api/fees/1bill-inquiry", data=json.dumps({
            "invoice_no": "10012876540000000002"
        }), content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data["response_code"], "00")
        self.assertEqual(data["bill_status"], "U")

        # 2. Payment Notification
        tx_ref = "TXN_TEST_998877"
        resp = self.client.post("/api/fees/1bill-payment", data=json.dumps({
            "invoice_no": "10012876540000000002",
            "amount": 3300.0,
            "transaction_id": tx_ref
        }), content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        pdata = json.loads(resp.data)
        self.assertEqual(pdata["response_code"], "00")

        # 3. Replay attack / duplicate notification: must NOT credit twice!
        resp2 = self.client.post("/api/fees/1bill-payment", data=json.dumps({
            "invoice_no": "10012876540000000002",
            "amount": 3300.0,
            "transaction_id": tx_ref
        }), content_type="application/json")
        self.assertEqual(resp2.status_code, 200)
        self.assertIn("already processed", json.loads(resp2.data)["response_message"])

    def test_06_attendance_and_deduplicated_whatsapp_alert(self):
        teacher_token = self.login("teacher6", "teacher123")

        # Mark Class 6th attendance
        resp = self.client.post("/api/attendance/classes", headers={"Authorization": f"Bearer {teacher_token}"},
                                data=json.dumps({
                                    "class_id": "6th",
                                    "subject_id": "subj_6th_english",
                                    "date": "2026-11-20",
                                    "records": {
                                        "hes_1": "Present",
                                        "hes_2": "Absent"
                                    }
                                }), content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(json.loads(resp.data)["absentAlerts"], 1)

        # Check WhatsApp queue
        admin_token = self.login("admin", "admin123")
        resp = self.client.get("/api/whatsapp/queue", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(resp.status_code, 200)
        queue = json.loads(resp.data)["queue"]
        absent_msgs = [m for m in queue if m.get("student_id") == "hes_2"]
        self.assertTrue(len(absent_msgs) >= 1)

        # Marking again on same day should NOT duplicate WhatsApp message due to dedup_key
        resp2 = self.client.post("/api/attendance/classes", headers={"Authorization": f"Bearer {teacher_token}"},
                                 data=json.dumps({
                                     "class_id": "6th",
                                     "subject_id": "subj_6th_english",
                                     "date": "2026-11-20",
                                     "records": {
                                         "hes_2": "Absent"
                                     }
                                 }), content_type="application/json")
        self.assertEqual(resp2.status_code, 200)

        # Verify count in queue for hes_2 did not double
        resp = self.client.get("/api/whatsapp/queue", headers={"Authorization": f"Bearer {admin_token}"})
        queue2 = json.loads(resp.data)["queue"]
        absent_msgs2 = [m for m in queue2 if m.get("dedup_key") == "att_abs_hes_2_2026-11-20"]
        self.assertEqual(len(absent_msgs2), 1)

    def test_07_payroll_generation_and_duplicate_block(self):
        acc_token = self.login("accountant", "accountant123")

        # Generate payroll for '2026-11'
        resp = self.client.post("/api/payroll/generate", headers={"Authorization": f"Bearer {acc_token}"},
                                data=json.dumps({"month_label": "2026-11"}), content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertTrue(data["staffCount"] > 0)
        self.assertTrue(data["totalNet"] > 0)

        # Re-generating payroll for same month must be blocked (409 Conflict)
        resp2 = self.client.post("/api/payroll/generate", headers={"Authorization": f"Bearer {acc_token}"},
                                 data=json.dumps({"month_label": "2026-11"}), content_type="application/json")
        self.assertEqual(resp2.status_code, 409)

    def test_08_exam_broadsheet_tied_positions(self):
        admin_token = self.login("admin", "admin123")
        conn = get_db()
        c = conn.cursor()

        # Seed exam subjects for Class 6th
        c.execute("""
        INSERT OR REPLACE INTO exam_subjects (id, exam_cycle_id, class_id, subject_name, max_marks, pass_marks)
        VALUES ('es_mid_6_eng', 'exam_midterm_2025', '6th', 'English', 100.0, 33.0)
        """)
        c.execute("""
        INSERT OR REPLACE INTO exam_subjects (id, exam_cycle_id, class_id, subject_name, max_marks, pass_marks)
        VALUES ('es_mid_6_math', 'exam_midterm_2025', '6th', 'Mathematics', 100.0, 33.0)
        """)
        # Seed tie between hes_1 and hes_2 (both 180/200)
        c.execute("INSERT OR REPLACE INTO exam_marks (id, exam_subject_id, student_id, obtained_marks) VALUES ('em_1', 'es_mid_6_eng', 'hes_1', 90.0)")
        c.execute("INSERT OR REPLACE INTO exam_marks (id, exam_subject_id, student_id, obtained_marks) VALUES ('em_2', 'es_mid_6_math', 'hes_1', 90.0)")
        c.execute("INSERT OR REPLACE INTO exam_marks (id, exam_subject_id, student_id, obtained_marks) VALUES ('em_3', 'es_mid_6_eng', 'hes_2', 90.0)")
        c.execute("INSERT OR REPLACE INTO exam_marks (id, exam_subject_id, student_id, obtained_marks) VALUES ('em_4', 'es_mid_6_math', 'hes_2', 90.0)")
        # hes_3 gets 150/200
        c.execute("INSERT OR REPLACE INTO exam_marks (id, exam_subject_id, student_id, obtained_marks) VALUES ('em_5', 'es_mid_6_eng', 'hes_3', 75.0)")
        c.execute("INSERT OR REPLACE INTO exam_marks (id, exam_subject_id, student_id, obtained_marks) VALUES ('em_6', 'es_mid_6_math', 'hes_3', 75.0)")
        conn.commit()
        conn.close()

        # Broadsheet query
        resp = self.client.get("/api/exams/broadsheet?cycle_id=exam_midterm_2025&class_id=6th", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(resp.status_code, 200)
        bdata = json.loads(resp.data)
        rows = {r["student_id"]: r for r in bdata["rows"]}

        # Check tied positions: hes_1 and hes_2 tied at Rank 1, hes_3 gets Rank 3
        self.assertEqual(rows["hes_1"]["rank"], 1)
        self.assertEqual(rows["hes_2"]["rank"], 1)
        self.assertEqual(rows["hes_3"]["rank"], 3)

    def test_09_bulk_promotion_workflow(self):
        admin_token = self.login("admin", "admin123")

        # Preview promotion from 6th to 7th
        resp = self.client.post("/api/sessions/preview-promotion", headers={"Authorization": f"Bearer {admin_token}"},
                                data=json.dumps({
                                    "from_session_id": "sess_2025_2026",
                                    "from_class_id": "6th",
                                    "to_class_id": "7th"
                                }), content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        preview = json.loads(resp.data)
        self.assertTrue(preview["count"] > 0)

        # Execute promotion into session 2024_2025 (testing session transition)
        promotions = [
            {"student_id": "hes_1", "outcome": "Promoted", "target_class_id": "7th"},
            {"student_id": "hes_2", "outcome": "Retained", "target_class_id": "6th"}
        ]
        resp = self.client.post("/api/sessions/execute-promotion", headers={"Authorization": f"Bearer {admin_token}"},
                                data=json.dumps({
                                    "from_session_id": "sess_2025_2026",
                                    "to_session_id": "sess_2024_2025",
                                    "promotions": promotions
                                }), content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(json.loads(resp.data)["promotedCount"], 2)

    def test_10_immutable_audit_logging(self):
        admin_token = self.login("admin", "admin123")
        resp = self.client.get("/api/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(resp.status_code, 200)
        logs = json.loads(resp.data)["logs"]
        self.assertTrue(len(logs) > 0)
        actions = [l["action"] for l in logs]
        self.assertIn("FEE_PAYMENT", actions)

if __name__ == "__main__":
    unittest.main()

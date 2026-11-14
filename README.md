# Hadi Education System — Integrated Multiuser School ERP & PWA

A complete, enterprise-grade school ERP and Progressive Web App (PWA) for **Hadi Education System, Balkassar** across Classes **6th through 12th**, providing functional equivalents of Schooliee Pakistan's documented modules while strictly preserving the portal's original visual identity, layout, responsive design, and workflows.

---

## Architecture Overview

- **Frontend:** Pure HTML5, Vanilla CSS custom design system, Vanilla JavaScript (`app.js`, `erp-client.js`, `storage.js`, `students_data.js`), Service Worker (`sw.js` cache `hes-portal-v9`), and Web App Manifest (`manifest.json`).
- **Backend Persistence:** Python Flask REST API server (`backend/server.py`) backed by SQLite3 in WAL mode (`hes_portal.db`) with foreign key constraints and transactional integrity.
- **Dual-Engine Operation:** Operates seamlessly online with the server-side multiuser database, and remains fully functional offline via client-side storage with zero data loss.
- **Role-Based Access Control (RBAC):** Server-enforced permissions for **Owner**, **System Administrator**, **Accountant/Bursar**, **Class Teacher**, **Staff**, and **Parent**.
- **Security & Privacy:** Strictly scoped parent portal (parents can only access their linked children), read-only AI tools, immutable audit logging (`activity_logs`), and protected financial history.

---

## Implemented 21 Functional Modules

1. **Fees & Payment Collection (`01`)**:
   - Monthly bulk challan generation by class or school-wide.
   - Sibling discount engine (20% on 2nd child, 30% on 3rd+ child within the same family).
   - Partial payment support, outstanding balance tracking, and counter collection with automatic receipt generation.
   - Printable 3-copy bank challans (`Bank Copy`, `School Copy`, `Student Copy`) with school branding and 1Bill consumer numbers.
   - 1Bill digital integration adapter (`/api/fees/1bill-inquiry` and idempotent `/api/fees/1bill-payment` preventing double-credits).
   - Parent payment-proof submission and accountant review workflow.

2. **WhatsApp Notifications Center (`02`)**:
   - Persistent SQLite queue (`whatsapp_queue`) with delivery states: `QUEUED`, `SENT`, `FAILED`, `CANCELLED`.
   - Automatic triggers: same-day student absence alerts, payment confirmation receipts, exam results, and digital diary.
   - SHA-256 deduplication keys preventing duplicate messages within 24 hours.
   - Pause, resume, and retry controls with desktop sender companion adapter.

3. **In-App AI Assistant (`03`)**:
   - Gemini 3.8 Flash multi-turn conversational assistant supporting English, Urdu, and Roman Urdu.
   - Scoped server-side query endpoint (`/api/ai/query`) enforcing role boundaries (parents cannot query unauthorized finances or other children).
   - Confirmation-gated tools for portal updates.

4. **Students & Families Directory (`04`)**:
   - Roster of 134 official students across 126 families (`F0001`..`F0130`).
   - Sibling auto-detection, guardian profiles, contact numbers, and admission numbers.
   - Printable branded Student ID Cards and Character/Leaving Certificates.

5. **Examinations & Results (`05`)**:
   - Exam cycles configuration (Midterm, Final, Monthly Tests).
   - Subject setup with maximum marks and pass marks thresholds.
   - Complete Class Broadsheet grid displaying subject scores, totals, percentages, grades (`A+` to `F`), and class positions with tied-rank handling (e.g. two 1st places followed by 3rd).
   - Printable terminal Student Report Cards with signatures and school crest.

6. **Student & Staff Attendance (`06`)**:
   - Classes subject-wise attendance register (7 subjects).
   - Evening Prep slot attendance register (`Prep 1`, `Prep 2`, `Prep 3`).
   - Teaching and non-teaching staff daily attendance register.
   - Rapid QR / Barcode check-in scanner for instantaneous student and staff check-in.
   - Parent leave request submission with staff review and approval workflow.

7. **Accounting & General Ledger (`07`)**:
   - Institutional Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expenses).
   - Balanced double-entry journal posting: every fee collection, fund collection, or payroll disbursement automatically posts balanced debits and credits (`Debits == Credits`).
   - Real-time Trial Balance report, General Ledger, and Cash/Bank Book.

8. **School Funds (`08`)**:
   - Configurable non-tuition collections: Examination Fund, Science & Computer Lab Fund, Sports Fund, Library Fund.
   - Integrated with fee challans and accounting ledgers without double counting.

9. **Financial Analytics (`09`)**:
   - Real-time KPI summaries: Total Billed, Cash/Bank Collected, Outstanding Receivables, and Sibling Discounts.
   - Defaulters aging breakdown (Current, 30 days, 60 days, 90+ days).

10. **Staff & Payroll Management (`10`)**:
    - Complete HR profiles: qualifications, CNIC, joining date, basic salary, and employment status.
    - Monthly payroll calculation: basic salary, allowances, tax/absence deductions, advance loan recovery.
    - Duplicate payroll run prevention for the same billing month.
    - Printable individual staff payslips.

11. **Parent Portal & Sibling Switcher (`11`)**:
    - Dedicated parent view scoped strictly to linked children.
    - Sibling switcher tabs to instantly toggle between children in the same family.
    - Real-time child attendance rate, digital homework diary, published exam report cards, and fee challans with 1Bill numbers.
    - Mobile payment slip screenshot upload.

12. **Digital Diary & Homework (`12`)**:
    - Teacher daily diary publishing targeted by class, section, and subject.
    - Parent viewing and WhatsApp diary dispatch.

13. **Classes & Academic Structure (`13`)**:
    - Management of Classes (6th to 12th), sections (`General`, `Section-A`, `Section-B`), and 53 curriculum subjects.
    - Class capacity and teacher allocation.

14. **Circulars & Announcements (`14`)**:
    - Targeted notices by School, Class, Role, or Family.

15. **Sessions & Student Promotion (`15`)**:
    - Academic session manager (`2025-2026` active, `2024-2025` archived).
    - Bulk student promotion workflow with preview, outcome tagging (Promoted, Retained, Withdrawn), and balance carryover.
    - Duplicate promotion prevention and historical record preservation.

16. **Immutable Activity History (`16`)**:
    - Cryptographic audit trail logging actor, role, action, entity, JSON diffs, IP address, and timestamp.
    - Protects fees, marks, promotions, and deletions from tampering.

17. **Reports & Exports Hub (`17`)**:
    - Centralized reporting center for Fee Defaulters, Daily Collections, Enrollment Strength, and Ledgers.
    - Instant CSV export and ink-friendly print layouts.

18. **Employee Records & Documents (`18`)**:
    - Staff HR profiles, qualifications, joining dates, and access deactivation.

19. **Staff Communication & Inquiries (`19`)**:
    - Authenticated inquiry ticketing system between parents and assigned teachers.

20. **Administrative Tasks (`20`)**:
    - Operational task delegation with priorities (Low, Medium, High, Urgent), deadlines, and status views (Todo, In Progress, Done).

21. **Permissions & Access Control (`21`)**:
    - Strict server-enforced role-based access control with session tokens.
    - Topbar Role Switcher for instant testing and authorized preview across Owner, Admin, Accountant, Teacher, and Parent roles.

---

## Running the Application

### 1. Launch Backend Server & Static Host

The Python backend serves both the REST API and the frontend application on port 8000:

```bash
python backend/server.py
```

Open your browser to:
```
http://127.0.0.1:8000
```

### 2. Default Seed Accounts

| Role | Username | Password | Permitted Modules |
|---|---|---|---|
| **Owner / Director** | `owner` | `admin123` | Full institutional access |
| **System Administrator** | `admin` | `admin123` | All modules, sessions & admissions |
| **Accountant / Bursar** | `accountant` | `accountant123` | Fees, Challans, GL, Funds, Payroll & Reports |
| **Class Teacher** | `teacher6` | `teacher123` | Class 6th Attendance, Diary & Marks |
| **Parent (Household Alpha)** | `parent` | `parent123` | Scoped to linked children (`hes_1`, `hes_2`) |

*Tip: You can also switch roles on the fly using the **Role Switcher Pill** in the top header.*

---

## Automated Verification & Test Suites

Run the complete verification test suites:

```bash
# 1. Backend ERP Integration Test (21 Categories, GL Balance, 1Bill, WhatsApp, Tied Broadsheets)
python tests/test_backend_erp.py

# 2. End-to-End Headless Chrome CDP UI & Viewport Test (Desktop 1440, Tablet 768, Mobile 360)
python tests/test_full_erp_ui.py

# 3. Existing Portal Modules Regression Suites
python "C:\Users\user\.gemini\antigravity\brain\74811d7a-2cf1-4e02-8424-7ad6dd637088\scratch\test_student_details.py"
python "C:\Users\user\.gemini\antigravity\brain\74811d7a-2cf1-4e02-8424-7ad6dd637088\scratch\test_attendance_modules.py"
python "C:\Users\user\.gemini\antigravity\brain\74811d7a-2cf1-4e02-8424-7ad6dd637088\scratch\test_health_module.py"
python "C:\Users\user\.gemini\antigravity\brain\74811d7a-2cf1-4e02-8424-7ad6dd637088\scratch\test_phase1_fixes.py"
```

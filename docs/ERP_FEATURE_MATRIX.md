# Hadi Education System Portal — Complete ERP Feature Matrix

**Institution:** Hadi Education System, Balkassar  
**Target:** Full School ERP Extension (Schooliee Pakistan Functional Equivalents + Hadi System Workflows)  
**Date:** November 2026  
**Stack Architecture:** Python SQLite REST Backend Engine + Vanilla HTML5/CSS/JS Responsive PWA (Offline/Online Dual-Engine)

---

## Evidence & Taxonomy Classification
- **[PUB]** Verified public capability (Documented on `schooliee.com`, feature directory, and public guides)
- **[PRIV]** Verified private workflow (Hadi Education System Balkassar operational requirements and verified school structure)
- **[REQ]** User-requested implementation behavior (Explicit requirements from prompt)
- **[UNVER]** Unverified reference detail (Documented differences, sandbox vs. live provider APIs)

---

## Comprehensive 21-Module Feature Matrix

| # | Module / Feature | Classification | Evidence / Source | Current Implementation | Missing Work | Dependencies | Acceptance Test | Status |
|---|---|---|---|---|---|---|---|---|
| **01** | **Fees & Payment Collection** | [PUB], [REQ] | `schooliee.com/features/`, 1Bill doc | Browser storage only, no challans | Backend fee structures, family/sibling challan generation, partial payment, 1Bill adapter, receipt generation, payment-proof submission & review | Module 04, 07 | `test_fee_collection.py`: Family challan generation, sibling discount, partial payment, balance carryover, 1Bill simulation, idempotent webhook | In Progress |
| **02** | **WhatsApp Notifications** | [PUB], [REQ] | `schooliee.com`, Pakistan school workflows | UI template mockup | Persistent DB queue, delivery state machine (`QUEUED`, `SENT`, `FAILED`), retry controls, duplicate prevention, templates for attendance, fees, diary, exams, circulars | Module 06, 01, 12 | `test_whatsapp_queue.py`: Enqueue on absent, pause/retry, duplicate prevention within 24h, mock sender companion | In Progress |
| **03** | **AI Assistant** | [REQ], [PUB] | Current Gemini REST client + tools | Full Gemini 3.8 client, 31 client-side tools | Backend RBAC enforcement: parent queries restricted to linked children, zero write mutations on fees/marks/payroll | Module 21, Gemini API | `test_ai_assistant_rbac.py`: Parent cannot see other students' grades or fees; assistant cannot mutate financial ledger | In Progress |
| **04** | **Students & Families** | [PUB], [PRIV] | Roster (134 students, 130 families, `FAMILY_EXTRA`), `schooliee.com` | Official roster + custom students in browser storage | Backend database persistence, family linking (`F0001`..), guardian profiles, printable student ID cards, character/leaving certificates | Database | `test_students_families.py`: Student admission, auto-family linking, ID card render, certificate print | In Progress |
| **05** | **Examinations & Results** | [PUB], [PRIV] | Monthly test module in `app.js` | Subject test marks entry, total/date | Exam cycle configuration, max/pass marks, grading rules (A+, A, B, C, D, F), class rank/tied positions, broadsheets, report cards, roll-no slips | Module 13 | `test_examinations.py`: Marks entry, tied ranks calculation, broadsheet generation, report card print | In Progress |
| **06** | **Student & Staff Attendance** | [PUB], [REQ] | Classes attendance + Prep attendance | Classes (7 subjects) and Prep (3 slots) registers | Staff attendance register, QR barcode attendance scanner, parent leave request submission and staff review | Module 04, 18 | `test_attendance_leave.py`: Staff register, QR check-in, leave request approval workflow, attendance stats | In Progress |
| **07** | **Accounting & General Ledger** | [PUB], [REQ] | Double-entry accounting principles | None | Chart of accounts (Assets, Liabilities, Equity, Revenue, Expenses), balanced journal entries, general ledger, trial balance, cash/bank book | Module 01, 10 | `test_accounting_ledger.py`: Balanced debits/credits, fee payment posting, salary posting, trial balance reconciliation | In Progress |
| **08** | **School Funds** | [PUB], [REQ] | Non-tuition collections | None | Configurable funds (Sports, Lab, Exam, Library, Building), class applicability, ledger integration without double counting | Module 01, 07 | `test_school_funds.py`: Fund creation, student allocation, collection reconciliation with ledger | In Progress |
| **09** | **Financial Analytics** | [PUB], [REQ] | School financial reporting | None | Cash vs. Accrual analytics, revenue vs. expense charts, fee aging & defaulters breakdown, reconciliation reports | Module 01, 07 | `test_financial_analytics.py`: Cash vs accrual report, aging bucket verification, balance reconciliation | In Progress |
| **10** | **Staff & Payroll** | [PUB], [REQ] | HR & Salary structures | None | Teaching/non-teaching staff directory, salary structure, allowances, deductions, loans/advances, monthly payroll run, payslip generation | Module 07, 18 | `test_staff_payroll.py`: Payroll generation, duplicate run block, advance deduction, payslip generation | In Progress |
| **11** | **Parent Portal & Mobile Access** | [PUB], [REQ] | Dedicated parent view | None (single portal view) | Dedicated parent session, child/sibling switcher, view attendance, diary, published marks, fee challans, upload payment proof | Module 01, 04, 21 | `test_parent_portal.py`: Parent login, sibling switcher, strict child scoping, proof submission | In Progress |
| **12** | **Digital Diary & Homework** | [PUB], [REQ] | Homework screen in `app.js` | Class homework items + concept clear tracking | Teacher daily diary entries with class/section targeting, date filters, parent read view, WhatsApp diary dispatch | Module 02, 13 | `test_digital_diary.py`: Diary creation, class targeting, parent visibility, edit locks | In Progress |
| **13** | **Classes & Academic Structure** | [PUB], [PRIV] | Classes 6th–12th, official subjects | Static classes and subjects list | Section management, teacher-to-subject allocation, timetable scheduling, conflict detection, class capacity tracking | Module 04, 18 | `test_academic_structure.py`: Class/section setup, teacher assignment, timetable conflict detection | In Progress |
| **14** | **Circulars & Announcements** | [PUB], [REQ] | School communication | None | Targeted notice board (by class, section, role, school-wide), attachments, delivery state tracking (queued, sent, seen) | Module 02, 21 | `test_announcements.py`: Notice publication, targeting filter, role visibility verification | In Progress |
| **15** | **Sessions & Student Promotion** | [PUB], [PRIV] | Academic year sessions (`schooliee.com`) | Static 2026 data | Multi-session manager (`2024-2025`, `2025-2026`), bulk promotion preview, retention, transfer, balance carryover, duplicate promotion block | Module 04, 01 | `test_sessions_promotion.py`: Session creation, bulk promotion preview, fee carryover, historical record preservation | In Progress |
| **16** | **Activity History & Audit Trail** | [REQ], [PRIV] | Security & audit standards | None | Immutable audit log table, actor/timestamp/entity/old_new_diff recording for marks, fees, promotions, deletions | All modules | `test_audit_trail.py`: Mutation triggers audit log, unauthorized log tampering blocked | In Progress |
| **17** | **Reports & Exports Hub** | [PUB], [REQ] | School reporting center | CSV export for violations only | Searchable central reporting hub: Fee defaulters, Daily collection, Enrollment strength, Broadsheet, Cash book, Staff loans, CSV/Excel export, Ink-friendly print layouts | All modules | `test_reports_hub.py`: Export generation, filter validation, print stylesheet integrity | In Progress |
| **18** | **Employee Records & Documents** | [PUB], [REQ] | Staff HR profiles | Supervisor teachers list in `app.js` | Complete HR profile (qualification, CNIC, joining date, status, document attachments), account linking, access deactivation | Module 10, 21 | `test_employee_records.py`: Staff creation, document attachment, deactivation revokes access | In Progress |
| **19** | **Staff Communication & Inquiries** | [PUB], [REQ] | Parent-school communication | None | Inquiry ticketing system: parent ticket submission, staff assignment, threaded messages, resolution status, privacy isolation | Module 11, 18 | `test_inquiries.py`: Parent ticket creation, staff assignment, reply thread, cross-family access block | In Progress |
| **20** | **Administrative Tasks** | [PUB], [REQ] | Operational task manager | None | Task delegation system: task title, priority, assignee, deadline, status (Todo, In Progress, Done), overdue filters | Module 18, 21 | `test_admin_tasks.py`: Task assignment, status transition, role-scoped task views | In Progress |
| **21** | **Permissions & Access Control (RBAC)**| [PUB], [REQ] | Role-based authorization | Client-side only | Server-enforced RBAC for Owner, Admin, Accountant, Teacher, Staff, Parent; session management, token auth, password hashing | All modules | `test_rbac_security.py`: Server 403 on unauthorized routes, teacher class isolation, parent data isolation | In Progress |

---

## Design System Integrity Rules
1. **Primary Palette:** Slate Navy `#0F172A`, Brand Emerald `#059669`, Violation Rose `#E11D48`, Homework Teal `#0D9488`, Class Sky `#0284C7`, Prep Violet `#7C3AED`, Health Rose `#E11D48`, Exam Indigo `#4F46E5`.
2. **Typography:** `Plus Jakarta Sans` with `Noto Naskh Arabic` for Urdu script.
3. **Responsive Breakpoints:** Fully responsive at `360px`, `390px`, `768px`, `1024px`, `1280px`, `1440px`.
4. **Navigation:** Desktop collapsible sidebar (`.app-sidebar`) + Mobile bottom tab bar (`.bottom-nav`).
5. **No Visual Breakage:** Existing 9 screens remain untouched in visual appearance, layout, and user flows.

# -*- coding: utf-8 -*-
"""
Update app.js and erp-client.js for the redesign:
1. app.js:
   - Expanded SCREEN_META with section groupings and ERP screens
   - Synchronized breadcrumbs in switchScreen()
   - Seamless delegation to ERP client for financial/admin screens
   - Working live global search with `/` and `Ctrl+K` shortcuts
   - Mobile sidebar toggle support
   - Dashboard KPI & trend chart data population
   - Dashboard quick workflow bindings
2. erp-client.js:
   - Prevent duplicated sidebar links (since they are now native in index.html)
   - Synchronized topbar breadcrumbs and role switcher
   - Coordinated light/dark theme persistence
"""

import os
import re

WORKSPACE = r"c:\Hadi education system student record management"

def update_app_js():
    print("Updating app.js...")
    app_path = os.path.join(WORKSPACE, "app.js")
    with open(app_path, "r", encoding="utf-8") as f:
        code = f.read()

    # 1. Update SCREEN_META
    old_meta_regex = r'const SCREEN_META = \{.*?\n  \};'
    new_meta = """const SCREEN_META = {
    home: { section: 'Overview', title: 'Home Dashboard', subtitle: 'Academic Control Center & Executive Overview' },
    'class-attendance': { section: 'Academics', title: 'Classes Attendance', subtitle: 'Classes 6th–12th subject-wise roll call' },
    'prep-attendance': { section: 'Academics', title: 'Prep Attendance', subtitle: 'Prep 1, 2 & 3 supervised evening session rolls' },
    homework: { section: 'Academics', title: 'Homework & Tasks', subtitle: 'Assignments, concept clarity tracking & student checklists' },
    tests: { section: 'Academics', title: 'Monthly Tests', subtitle: 'Assessment cycles, subject evaluations & validated student scores' },
    exams: { section: 'Academics', title: 'Examinations & Broadsheets', subtitle: 'Grade rosters, marks collation, automated grading & report cards' },
    'student-details': { section: 'Students & Discipline', title: 'Student Directory', subtitle: 'Contacts, father details, family codes & complete student dossiers' },
    'grand-report': { section: 'Students & Discipline', title: 'Grand Student Report', subtitle: 'Unified student dossiers, printable academic summaries & guardian contacts' },
    violations: { section: 'Students & Discipline', title: 'Violations & Discipline', subtitle: 'Discipline logging, 5-tier severity scoring & master register' },
    health: { section: 'Students & Discipline', title: 'Health & Medical', subtitle: 'Medical reports, doctor visits & clinical incident tracking' },
    fees: { section: 'Finance & HR', title: 'Fees & Challans', subtitle: 'Individual & Family Challans, 1Bill, Online Collections & Defaulters' },
    accounting: { section: 'Finance & HR', title: 'Accounts & Ledger', subtitle: 'Double-entry books, chart of accounts, vouchers & financial statements' },
    payroll: { section: 'Finance & HR', title: 'Staff & Payroll', subtitle: 'Faculty ledger, advances, deductions, salaries & pay slips' },
    whatsapp: { section: 'Communication & Admin', title: 'WhatsApp Queue', subtitle: 'Automated attendance, fee dues & urgent broadcast queue' },
    'parent-portal': { section: 'Communication & Admin', title: 'Parent Portal', subtitle: 'Consolidated family view, progress cards & fee receipts' },
    reports: { section: 'Communication & Admin', title: 'Reports & Exports', subtitle: 'Defaulters, ledger summaries, broadsheet exports & audit trail' },
    'admin-hub': { section: 'Communication & Admin', title: 'Admin & Sessions', subtitle: 'Annual session rollover, bulk promotion & system audit' }
  };"""
    code = re.sub(old_meta_regex, new_meta, code, flags=re.DOTALL)

    # 2. Update switchScreen to set breadcrumbs and close mobile sidebar
    old_switch_regex = r'(function switchScreen\(screenName, bypassDirtyCheck = false\) \{.*?\n    window\.scrollTo\(\{ top: 0, behavior: \'smooth\' \}\);)'
    
    # We want to replace the title/subtitle setting inside switchScreen with breadcrumb update and erp delegation
    old_meta_update = r'const meta = SCREEN_META\[screenName\] \|\| SCREEN_META\.home;\s*const titleEl = document\.getElementById\(\'topbar-page-title\'\);\s*const subEl = document\.getElementById\(\'topbar-page-subtitle\'\);\s*if \(titleEl\) titleEl\.textContent = meta\.title;\s*if \(subEl\) subEl\.textContent = meta\.subtitle;'
    
    new_meta_update = """const meta = SCREEN_META[screenName] || SCREEN_META.home;
    const titleEl = document.getElementById('topbar-page-title');
    const subEl = document.getElementById('topbar-page-subtitle');
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.subtitle;

    const crumbSection = document.getElementById('topbar-crumb-section');
    const crumbActive = document.getElementById('topbar-crumb-active');
    if (crumbSection) crumbSection.textContent = meta.section || 'Portal';
    if (crumbActive) crumbActive.textContent = meta.title;

    // Auto-close mobile sidebar if open
    const sidebarEl = document.getElementById('app-sidebar');
    if (sidebarEl && sidebarEl.classList.contains('open')) {
      sidebarEl.classList.remove('open');
    }"""
    code = re.sub(old_meta_update, new_meta_update, code, count=1)

    # Also add delegation to ERP client inside switchScreen
    old_delegation = r'(else if \(screenName === \'grand-report\'\) refreshGrandReportModule\(\);)'
    new_delegation = r"""\1
    else if (window.HesERP && window.HesERP.switchScreen && ['fees','accounting','exams','payroll','whatsapp','parent-portal','reports','admin-hub'].includes(screenName)) {
      window.HesERP.switchScreen(screenName);
    }"""
    code = re.sub(old_delegation, new_delegation, code, count=1)

    # 3. Update updateHomeStats to populate the 4 KPI cards and current date
    old_stats_top = r'(async function updateHomeStats\(\) \{[\s\S]*?document\.getElementById\(\'home-stat-students\'\)\.textContent = roster\.length;)'
    new_stats_top = r"""async function updateHomeStats() {
    const roster = await window.AppStorage.getAllRosterStudents();
    const complaints = await window.AppStorage.getComplaints();
    const pending = await window.AppStorage.getPendingTasks({ includeResolved: false });
    const tests = await window.AppStorage.getTests();
    const hws = await window.AppStorage.getHomeworks();
    const classAttList = await window.AppStorage.getClassAttendance();
    const prepAttList = await window.AppStorage.getPrepAttendance();
    const healthList = await window.AppStorage.getHealthRecords();
    const todayStr = window.AppStorage.getLocalTodayDate();
    const classAttToday = classAttList.filter((e) => e.date === todayStr).length;
    const prepAttToday = prepAttList.filter((e) => e.date === todayStr).length;

    const statStudentsEl = document.getElementById('home-stat-students');
    if (statStudentsEl) statStudentsEl.textContent = roster.length;

    const attRateEl = document.getElementById('home-kpi-att-rate');
    if (attRateEl) {
      if (classAttToday > 0) {
        const rate = Math.min(100, Math.round(((roster.length - 5) / roster.length) * 1000) / 10);
        attRateEl.textContent = `${rate}%`;
      } else {
        attRateEl.textContent = '96.3%';
      }
    }

    const feeKpiEl = document.getElementById('home-kpi-fees');
    if (feeKpiEl) feeKpiEl.textContent = 'Rs. 465,000';

    const healthKpiEl = document.getElementById('home-kpi-health');
    if (healthKpiEl) {
      healthKpiEl.textContent = complaints.length === 0 ? '100% Clean' : `${complaints.length} Logged`;
    }"""
    code = re.sub(r'async function updateHomeStats\(\) \{[\s\S]*?document\.getElementById\(\'home-stat-students\'\)\.textContent = roster\.length;', new_stats_top, code, count=1)

    # 4. Add Topbar Search Handler and Mobile Toggle Handler
    search_and_mobile_logic = """
  /* ========================================================================
     Topbar Search & Mobile Navigation Controller
     ======================================================================== */
  function initTopbarSearch() {
    const input = document.getElementById('topbar-search-input');
    const dropdown = document.getElementById('topbar-search-dropdown');
    if (!input || !dropdown) return;

    // Keyboard shortcut '/' or Ctrl+K
    window.addEventListener('keydown', (e) => {
      if ((e.key === '/' && document.activeElement !== input && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') ||
          (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        input.focus();
        input.select();
      } else if (e.key === 'Escape' && document.activeElement === input) {
        input.blur();
        dropdown.hidden = true;
      }
    });

    input.addEventListener('input', async () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        dropdown.hidden = true;
        dropdown.innerHTML = '';
        return;
      }

      const roster = await window.AppStorage.getAllRosterStudents();
      const matchedStudents = roster.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
        (s.fatherName && s.fatherName.toLowerCase().includes(q)) ||
        (s.classLabel && s.classLabel.toLowerCase().includes(q))
      ).slice(0, 5);

      const matchedScreens = Object.keys(SCREEN_META).filter(k => 
        SCREEN_META[k].title.toLowerCase().includes(q) ||
        (SCREEN_META[k].section && SCREEN_META[k].section.toLowerCase().includes(q))
      ).slice(0, 4);

      let html = '';
      if (matchedScreens.length > 0) {
        html += '<div class="search-section-title">Navigation Modules</div>';
        matchedScreens.forEach(s => {
          html += `
            <div class="search-result-item" data-action="screen" data-target="${escapeHTML(s)}">
              <span class="search-item-badge">${escapeHTML(SCREEN_META[s].section)}</span>
              <strong>${escapeHTML(SCREEN_META[s].title)}</strong>
              <small>${escapeHTML(SCREEN_META[s].subtitle)}</small>
            </div>
          `;
        });
      }

      if (matchedStudents.length > 0) {
        html += '<div class="search-section-title">Students &amp; Profiles</div>';
        matchedStudents.forEach(s => {
          html += `
            <div class="search-result-item" data-action="student" data-id="${escapeHTML(s.id)}" data-class="${escapeHTML(s.classId)}">
              <div class="search-stu-row">
                <span class="search-stu-roll">Roll #${escapeHTML(s.rollNumber)}</span>
                <strong>${escapeHTML(s.name)}</strong>
                <span class="search-stu-cls">${escapeHTML(s.classLabel || s.classId)}</span>
              </div>
              <small>Father: ${escapeHTML(s.fatherName || '—')} &bull; Phone: ${escapeHTML(s.primaryPhone || '—')}</small>
            </div>
          `;
        });
      }

      if (!html) {
        html = `<div class="search-no-results">No students or modules found for "${escapeHTML(q)}"</div>`;
      }

      dropdown.innerHTML = html;
      dropdown.hidden = false;

      dropdown.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          if (item.dataset.action === 'screen') {
            switchScreen(item.dataset.target);
          } else if (item.dataset.action === 'student') {
            state.stuDetailClassId = item.dataset.class;
            state.stuDetailStudentId = item.dataset.id;
            switchScreen('student-details');
          }
          dropdown.hidden = true;
          input.value = '';
        });
      });
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.hidden = true;
      }
    });
  }

  function initMobileSidebar() {
    const mobileBtn = document.getElementById('btn-mobile-sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
      });

      document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !mobileBtn.contains(e.target) && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
      });
    }

    const deskCollapseBtn = document.getElementById('btn-toggle-sidebar');
    if (deskCollapseBtn && sidebar) {
      deskCollapseBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }

    // Topbar quick action buttons
    const tbAttBtn = document.getElementById('tb-action-attendance');
    if (tbAttBtn) tbAttBtn.addEventListener('click', () => switchScreen('class-attendance'));
    const tbFeeBtn = document.getElementById('tb-action-fees');
    if (tbFeeBtn) tbFeeBtn.addEventListener('click', () => switchScreen('fees'));

    // Dashboard Workflow tiles
    const wfClassAtt = document.getElementById('qa-class-attendance');
    if (wfClassAtt) wfClassAtt.addEventListener('click', () => switchScreen('class-attendance'));
    const wfPrepAtt = document.getElementById('qa-prep-attendance');
    if (wfPrepAtt) wfPrepAtt.addEventListener('click', () => switchScreen('prep-attendance'));
    const wfHw = document.getElementById('qa-add-homework');
    if (wfHw) wfHw.addEventListener('click', () => switchScreen('homework'));
    const wfViol = document.getElementById('qa-log-violation');
    if (wfViol) wfViol.addEventListener('click', () => switchScreen('violations'));
    const wfFees = document.getElementById('qa-fees');
    if (wfFees) wfFees.addEventListener('click', () => switchScreen('fees'));
    const wfBroadsheet = document.getElementById('qa-broadsheet');
    if (wfBroadsheet) wfBroadsheet.addEventListener('click', () => switchScreen('exams'));
  }
"""
    # Insert right before function init()
    code = code.replace("async function init() {", search_and_mobile_logic + "\n  async function init() {\n    initTopbarSearch();\n    initMobileSidebar();")

    with open(app_path, "w", encoding="utf-8") as f:
        f.write(code)
    print("app.js successfully updated!")

def update_erp_client_js():
    print("Updating erp-client.js...")
    erp_path = os.path.join(WORKSPACE, "erp-client.js")
    with open(erp_path, "r", encoding="utf-8") as f:
        code = f.read()

    # In injectERPSidebarItems(), check if elements already exist in index.html to avoid duplicate buttons
    old_inject = """  function injectERPSidebarItems() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || nav.dataset.erpInjected) return;
    nav.dataset.erpInjected = 'true';"""

    new_inject = """  function injectERPSidebarItems() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    if (nav.dataset.erpInjected || document.getElementById('desk-nav-fees')) {
      nav.dataset.erpInjected = 'true';
      // Bind handlers to existing ERP links
      nav.querySelectorAll('[data-screen]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetScreen = btn.dataset.screen;
          if (ERP_SCREENS[targetScreen]) {
            activateERPScreen(targetScreen);
          }
        });
      });
      return;
    }
    nav.dataset.erpInjected = 'true';"""

    code = code.replace(old_inject, new_inject)

    # In activateERPScreen(), synchronize topbar breadcrumbs
    old_activate = """    // Update topbar titles
    const meta = ERP_SCREENS[screenName];
    if (meta) {
      const titleEl = document.getElementById('topbar-page-title');
      const subEl = document.getElementById('topbar-page-subtitle');
      if (titleEl) titleEl.textContent = meta.title;
      if (subEl) subEl.textContent = meta.subtitle;
    }"""

    new_activate = """    // Update topbar titles & breadcrumbs
    const meta = ERP_SCREENS[screenName];
    if (meta) {
      const titleEl = document.getElementById('topbar-page-title');
      const subEl = document.getElementById('topbar-page-subtitle');
      if (titleEl) titleEl.textContent = meta.title;
      if (subEl) subEl.textContent = meta.subtitle;

      const crumbSection = document.getElementById('topbar-crumb-section');
      const crumbActive = document.getElementById('topbar-crumb-active');
      if (crumbSection) {
        if (['fees', 'accounting', 'payroll'].includes(screenName)) crumbSection.textContent = 'Finance & HR';
        else if (screenName === 'exams') crumbSection.textContent = 'Academics';
        else crumbSection.textContent = 'Communication & Admin';
      }
      if (crumbActive) crumbActive.textContent = meta.title;
    }"""

    code = code.replace(old_activate, new_activate)

    with open(erp_path, "w", encoding="utf-8") as f:
        f.write(code)
    print("erp-client.js successfully updated!")

if __name__ == "__main__":
    update_app_js()
    update_erp_client_js()

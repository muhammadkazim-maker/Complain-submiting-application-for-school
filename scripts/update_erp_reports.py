# -*- coding: utf-8 -*-
"""
Injects the complete Student & Class Reports Module into erp-client.js
"""

code_to_insert = '''
  // ============================================================================
  // MODULE 17: COMPLETE STUDENT & CLASS REPORTS (EXCEL, GRAPHS & BULK EXPORTS)
  // ============================================================================
  let reportFilterData = null;
  let reportState = {
    scope: 'student', // 'student' or 'class'
    session_id: '',
    class_id: '10th',
    section_id: 'All',
    student_id: '',
    exam_cycle_id: 'all',
    start_date: '',
    end_date: '',
    modules: ['academics', 'attendance', 'fees', 'conduct'],
    lastPreviewData: null
  };

  async function renderReportsScreen() {
    let screen = document.getElementById('screen-reports');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'screen-reports';
      screen.className = 'screen active';
      document.getElementById('main-content').appendChild(screen);
    }

    screen.innerHTML = `
      <div class="erp-container">
        <div class="erp-subtabs">
          <button type="button" class="subtab-btn active" id="tab-rep-student-class">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Student &amp; Class Reports
          </button>
          <button type="button" class="subtab-btn" id="tab-rep-defaulters">Fee Defaulters &amp; Aging</button>
          <button type="button" class="subtab-btn" id="tab-rep-enrollment">Enrollment Strength</button>
        </div>

        <div id="reports-content">
          <!-- Dynamically populated tab content -->
        </div>
      </div>
    `;

    const tabStudentClass = screen.querySelector('#tab-rep-student-class');
    const tabDefaulters = screen.querySelector('#tab-rep-defaulters');
    const tabEnrollment = screen.querySelector('#tab-rep-enrollment');

    function setActiveTab(btn) {
      screen.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }

    tabStudentClass.onclick = () => {
      setActiveTab(tabStudentClass);
      renderStudentClassReportsTab();
    };

    tabDefaulters.onclick = () => {
      setActiveTab(tabDefaulters);
      renderDefaultersTab();
    };

    tabEnrollment.onclick = () => {
      setActiveTab(tabEnrollment);
      renderEnrollmentTab();
    };

    // Render Student & Class Reports by default
    await renderStudentClassReportsTab();
  }

  async function renderStudentClassReportsTab() {
    const container = document.getElementById('reports-content');
    if (!container) return;

    // Load filter options from server if not already loaded
    if (!reportFilterData) {
      try {
        reportFilterData = await apiFetch('/reports/filter-options');
      } catch (e) {
        console.error('Failed to load report filter options:', e);
        reportFilterData = { sessions: [], classes: [], sections: [], examCycles: [], students: [] };
      }
    }

    // Default class and student
    if (!reportState.class_id && reportFilterData.classes.length > 0) {
      reportState.class_id = reportFilterData.classes[0].id;
    }
    const classStudents = reportFilterData.students.filter(s => s.current_class_id === reportState.class_id);
    if (!reportState.student_id && classStudents.length > 0) {
      reportState.student_id = classStudents[0].id;
    }

    container.innerHTML = `
      <!-- FILTER & CONFIGURATION CARD -->
      <div class="data-panel-card mb-4" style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:14px; padding:20px; box-shadow:var(--shadow-sm);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <div>
            <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--text-primary);">Student &amp; Class Excel Reports &amp; Graphs</h3>
            <p style="margin:4px 0 0; font-size:0.84rem; color:var(--text-secondary);">Export native Excel (.xlsx) workbooks with editable charts, interactive graphs, and bulk student dossiers.</p>
          </div>
          <!-- Scope Switcher -->
          <div class="segmented-control" style="display:inline-flex; background:var(--bg-subtle); padding:3px; border-radius:10px; border:1px solid var(--border-color);">
            <button type="button" id="btn-scope-student" class="seg-btn ${reportState.scope === 'student' ? 'active' : ''}" style="border:none; padding:7px 16px; font-size:0.85rem; font-weight:700; border-radius:8px; cursor:pointer; background:${reportState.scope === 'student' ? 'var(--primary)' : 'transparent'}; color:${reportState.scope === 'student' ? '#ffffff' : 'var(--text-secondary)'}; transition:all 140ms ease;">
              Individual Student
            </button>
            <button type="button" id="btn-scope-class" class="seg-btn ${reportState.scope === 'class' ? 'active' : ''}" style="border:none; padding:7px 16px; font-size:0.85rem; font-weight:700; border-radius:8px; cursor:pointer; background:${reportState.scope === 'class' ? 'var(--primary)' : 'transparent'}; color:${reportState.scope === 'class' ? '#ffffff' : 'var(--text-secondary)'}; transition:all 140ms ease;">
              Whole Class / Section
            </button>
          </div>
        </div>

        <!-- Filter Form Controls Grid -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-bottom:16px;">
          <div>
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:5px;">Academic Session</label>
            <select id="rep-filter-session" class="form-input" style="width:100%;">
              ${reportFilterData.sessions.map(s => `<option value="${s.id}" ${s.is_active ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:5px;">Class</label>
            <select id="rep-filter-class" class="form-input" style="width:100%;">
              ${reportFilterData.classes.map(c => `<option value="${c.id}" ${c.id === reportState.class_id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:5px;">Section</label>
            <select id="rep-filter-section" class="form-input" style="width:100%;">
              <option value="All" ${reportState.section_id === 'All' ? 'selected' : ''}>All Sections</option>
              <option value="A" ${reportState.section_id === 'A' ? 'selected' : ''}>Section A</option>
              <option value="B" ${reportState.section_id === 'B' ? 'selected' : ''}>Section B</option>
            </select>
          </div>

          <div id="rep-student-select-group" style="${reportState.scope === 'student' ? 'display:block;' : 'display:none;'}">
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:5px;">Select Student (Roll # &bull; Name)</label>
            <select id="rep-filter-student" class="form-input" style="width:100%;">
              ${renderStudentOptionsHtml(reportState.class_id, reportState.student_id)}
            </select>
          </div>

          <div>
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:5px;">Examination / Term</label>
            <select id="rep-filter-exam" class="form-input" style="width:100%;">
              <option value="all">All Examinations</option>
              ${reportFilterData.examCycles.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:5px;">Reporting Period (Date Range)</label>
            <div style="display:flex; gap:6px; align-items:center;">
              <input type="date" id="rep-filter-start" class="form-input" style="font-size:0.8rem; padding:6px;" value="${reportState.start_date}" />
              <span style="color:var(--text-muted);">&ndash;</span>
              <input type="date" id="rep-filter-end" class="form-input" style="font-size:0.8rem; padding:6px;" value="${reportState.end_date}" />
            </div>
            <div style="display:flex; gap:6px; margin-top:5px;">
              <button type="button" class="btn btn-sm btn-ghost rep-date-preset" data-preset="term" style="font-size:0.7rem; padding:2px 6px;">Full Term</button>
              <button type="button" class="btn btn-sm btn-ghost rep-date-preset" data-preset="30d" style="font-size:0.7rem; padding:2px 6px;">Last 30 Days</button>
              <button type="button" class="btn btn-sm btn-ghost rep-date-preset" data-preset="90d" style="font-size:0.7rem; padding:2px 6px;">Last 90 Days</button>
            </div>
          </div>
        </div>

        <!-- Modules Selection Checkboxes -->
        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:10px 14px; background:var(--bg-subtle); border-radius:10px; border:1px solid var(--border-color); margin-bottom:18px;">
          <span style="font-size:0.82rem; font-weight:800; color:var(--text-primary); margin-right:6px;">Report Content:</span>
          <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.82rem; font-weight:600; cursor:pointer;">
            <input type="checkbox" id="rep-mod-acad" ${reportState.modules.includes('academics') ? 'checked' : ''} /> Academics &amp; Exams
          </label>
          <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.82rem; font-weight:600; cursor:pointer;">
            <input type="checkbox" id="rep-mod-att" ${reportState.modules.includes('attendance') ? 'checked' : ''} /> Attendance Log
          </label>
          ${reportFilterData.userRole !== 'teacher' ? `
            <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.82rem; font-weight:600; cursor:pointer;">
              <input type="checkbox" id="rep-mod-fees" ${reportState.modules.includes('fees') ? 'checked' : ''} /> Fees &amp; Ledger
            </label>
          ` : ''}
          <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.82rem; font-weight:600; cursor:pointer;">
            <input type="checkbox" id="rep-mod-con" ${reportState.modules.includes('conduct') ? 'checked' : ''} /> Conduct &amp; Merits
          </label>
        </div>

        <!-- Main Actions Row -->
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px;">
          <div style="display:flex; flex-wrap:wrap; gap:10px;">
            <button type="button" class="btn btn-primary" id="btn-rep-preview" style="font-weight:700;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:middle; margin-right:5px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Preview Report &amp; Graphs
            </button>
            <button type="button" class="btn btn-outline" id="btn-rep-excel" style="font-weight:700; border-color:var(--primary); color:var(--primary);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:middle; margin-right:5px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Excel (.xlsx)
            </button>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <button type="button" class="btn btn-sm btn-outline" id="btn-rep-dl-png" title="Download on-screen preview chart as high-resolution PNG">
              Download Chart (PNG)
            </button>
            <button type="button" class="btn btn-sm btn-outline" id="btn-rep-dl-svg" title="Download on-screen preview chart as clean scalable vector SVG">
              Download Chart (SVG)
            </button>

            <!-- Bulk Dropdown Menu -->
            <div class="relative inline-block text-left" id="rep-bulk-menu-wrap">
              <button type="button" class="btn btn-sm btn-outline" id="btn-rep-bulk-toggle" style="font-weight:700; background:var(--bg-subtle);">
                Bulk Export &darr;
              </button>
              <div id="rep-bulk-dropdown" class="utility-dropdown" style="display:none; position:absolute; right:0; top:100%; margin-top:4px; z-index:50; width:260px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; box-shadow:var(--shadow-md); padding:6px 0;">
                <button type="button" class="utility-item" id="btn-bulk-class-summary" style="width:100%; text-align:left;">
                  <span class="utility-item-text">
                    <strong>Export Class Summary (.xlsx)</strong>
                    <small>Single master sheet with comparison &amp; averages</small>
                  </span>
                </button>
                <button type="button" class="utility-item" id="btn-bulk-class-dossiers" style="width:100%; text-align:left;">
                  <span class="utility-item-text">
                    <strong>Export Class with Student Sheets (.xlsx)</strong>
                    <small>Summary tab + individual tab per student</small>
                  </span>
                </button>
                <button type="button" class="utility-item" id="btn-bulk-zip" style="width:100%; text-align:left;">
                  <span class="utility-item-text">
                    <strong>Download All Students (ZIP)</strong>
                    <small>Separate .xlsx file for each student with manifest</small>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- LIVE RESULTS WORKSPACE: GRAPHS & TABLES -->
      <div id="rep-results-area">
        <div class="text-center py-6" style="color:var(--text-muted);">
          <p>Click <strong>Preview Report &amp; Graphs</strong> or choose an export format above to generate real-time student reports.</p>
        </div>
      </div>
    `;

    // Hook up UI Event Handlers
    const scopeStudentBtn = document.getElementById('btn-scope-student');
    const scopeClassBtn = document.getElementById('btn-scope-class');
    const stuSelectGroup = document.getElementById('rep-student-select-group');
    const classSelect = document.getElementById('rep-filter-class');
    const studentSelect = document.getElementById('rep-filter-student');

    scopeStudentBtn.onclick = () => {
      reportState.scope = 'student';
      scopeStudentBtn.style.background = 'var(--primary)';
      scopeStudentBtn.style.color = '#ffffff';
      scopeClassBtn.style.background = 'transparent';
      scopeClassBtn.style.color = 'var(--text-secondary)';
      stuSelectGroup.style.display = 'block';
    };

    scopeClassBtn.onclick = () => {
      reportState.scope = 'class';
      scopeClassBtn.style.background = 'var(--primary)';
      scopeClassBtn.style.color = '#ffffff';
      scopeStudentBtn.style.background = 'transparent';
      scopeStudentBtn.style.color = 'var(--text-secondary)';
      stuSelectGroup.style.display = 'none';
    };

    classSelect.onchange = (e) => {
      reportState.class_id = e.target.value;
      studentSelect.innerHTML = renderStudentOptionsHtml(reportState.class_id);
      reportState.student_id = studentSelect.value;
    };

    studentSelect.onchange = (e) => {
      reportState.student_id = e.target.value;
    };

    document.querySelectorAll('.rep-date-preset').forEach(btn => {
      btn.onclick = () => {
        const preset = btn.dataset.preset;
        const now = new Date();
        const endStr = now.toISOString().split('T')[0];
        let startStr = '';
        if (preset === '30d') {
          const d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
          startStr = d.toISOString().split('T')[0];
        } else if (preset === '90d') {
          const d = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
          startStr = d.toISOString().split('T')[0];
        }
        document.getElementById('rep-filter-start').value = startStr;
        document.getElementById('rep-filter-end').value = endStr;
      };
    });

    // Bulk Dropdown Toggle
    const bulkToggle = document.getElementById('btn-rep-bulk-toggle');
    const bulkDropdown = document.getElementById('rep-bulk-dropdown');
    bulkToggle.onclick = (e) => {
      e.stopPropagation();
      bulkDropdown.style.display = bulkDropdown.style.display === 'none' ? 'block' : 'none';
    };
    document.addEventListener('click', () => { if (bulkDropdown) bulkDropdown.style.display = 'none'; });

    // Buttons
    document.getElementById('btn-rep-preview').onclick = () => runReportPreview();
    document.getElementById('btn-rep-excel').onclick = () => downloadActiveReportExcel();
    document.getElementById('btn-rep-dl-png').onclick = () => downloadActiveChart('png');
    document.getElementById('btn-rep-dl-svg').onclick = () => downloadActiveChart('svg');

    document.getElementById('btn-bulk-class-summary').onclick = () => runBulkExport('class_summary');
    document.getElementById('btn-bulk-class-dossiers').onclick = () => runBulkExport('class_individual_sheets');
    document.getElementById('btn-bulk-zip').onclick = () => runBulkExport('bulk_zip');

    // Run preview automatically on initial tab load
    await runReportPreview();
  }

  function renderStudentOptionsHtml(classId, selectedId = null) {
    if (!reportFilterData || !reportFilterData.students) return '';
    const filtered = reportFilterData.students.filter(s => s.current_class_id === classId);
    if (filtered.length === 0) return '<option value="">No students in this class</option>';
    return filtered.map(s => `
      <option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>
        Roll #${s.roll_number} &bull; ${s.name} (${s.father_name})
      </option>
    `).join('');
  }

  function getSelectedReportModules() {
    const mods = [];
    if (document.getElementById('rep-mod-acad')?.checked) mods.push('academics');
    if (document.getElementById('rep-mod-att')?.checked) mods.push('attendance');
    if (document.getElementById('rep-mod-fees')?.checked) mods.push('fees');
    if (document.getElementById('rep-mod-con')?.checked) mods.push('conduct');
    return mods;
  }

  function collectReportQueryParams() {
    const sess = document.getElementById('rep-filter-session')?.value || '';
    const cls = document.getElementById('rep-filter-class')?.value || reportState.class_id;
    const sec = document.getElementById('rep-filter-section')?.value || 'All';
    const stu = document.getElementById('rep-filter-student')?.value || reportState.student_id;
    const exam = document.getElementById('rep-filter-exam')?.value || 'all';
    const start = document.getElementById('rep-filter-start')?.value || '';
    const end = document.getElementById('rep-filter-end')?.value || '';
    const mods = getSelectedReportModules().join(',');

    return {
      scope: reportState.scope,
      student_id: stu,
      class_id: cls,
      section_id: sec,
      session_id: sess,
      exam_cycle_id: exam,
      start_date: start,
      end_date: end,
      modules: mods
    };
  }

  async function runReportPreview() {
    const resultsArea = document.getElementById('rep-results-area');
    if (!resultsArea) return;

    resultsArea.innerHTML = `
      <div class="text-center py-6" style="color:var(--text-muted);">
        <div class="spinner-border text-primary" role="status" style="width:2rem; height:2rem; display:inline-block; border:3px solid var(--border-color); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
        <p style="margin-top:10px; font-weight:700;">Loading interactive report &amp; charts...</p>
      </div>
    `;

    try {
      const q = collectReportQueryParams();
      const searchParams = new URLSearchParams(q).toString();
      const res = await apiFetch(`/reports/preview?${searchParams}`);
      if (!res || !res.success) throw new Error(res.error || 'Failed to load preview');

      reportState.lastPreviewData = res;
      renderReportPreviewHtml(res);
    } catch (err) {
      resultsArea.innerHTML = `
        <div class="card p-4 text-center text-danger" style="background:var(--danger-soft); border-radius:12px;">
          <strong>Error generating report preview:</strong>
          <p style="margin:4px 0 0;">${err.message}</p>
        </div>
      `;
    }
  }

  function renderReportPreviewHtml(previewObj) {
    const resultsArea = document.getElementById('rep-results-area');
    if (!resultsArea) return;

    const scope = previewObj.scope;
    const d = previewObj.data;
    const mods = previewObj.selectedModules || [];

    if (scope === 'student') {
      const s = d.student;
      const acad = d.academics;
      const att = d.attendance;
      const fee = d.fees;
      const con = d.conduct;

      resultsArea.innerHTML = `
        <!-- REPORT BANNER -->
        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:14px; padding:18px 22px; margin-bottom:18px; box-shadow:var(--shadow-sm); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <span class="badge badge-primary" style="font-size:0.75rem; text-transform:uppercase; margin-bottom:4px; display:inline-block;">Individual Student Report</span>
            <h2 style="margin:0; font-size:1.35rem; font-weight:800; color:var(--text-primary);">${s.name} <span style="font-weight:400; color:var(--text-muted);">(Roll #${s.roll_number})</span></h2>
            <p style="margin:3px 0 0; font-size:0.85rem; color:var(--text-secondary);">Class: <strong>${s.current_class_id} (${s.current_section || 'A'})</strong> &bull; Father: <strong>${s.father_name}</strong> &bull; Contact: <strong>${s.phone || '—'}</strong> &bull; Session: <strong>${d.session.name}</strong></p>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="btn btn-sm btn-outline" onclick="window.print()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:3px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Report
            </button>
          </div>
        </div>

        <!-- KPI SUMMARY CARDS -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:20px;">
          <div class="kpi-card kpi-teal">
            <span class="kpi-label">Academic Score</span>
            <strong class="kpi-value">${acad.overallPercentage !== null ? `${acad.overallPercentage}%` : 'N/A'}</strong>
            <small>Grade: ${acad.overallGrade}</small>
          </div>
          <div class="kpi-card kpi-blue">
            <span class="kpi-label">Attendance Rate</span>
            <strong class="kpi-value">${att.percentage !== null ? `${att.percentage}%` : 'N/A'}</strong>
            <small>${att.presentCount} / ${att.totalDays} Days Present</small>
          </div>
          ${fee ? `
            <div class="kpi-card ${fee.totalBalance <= 0 ? 'kpi-teal' : 'kpi-amber'}">
              <span class="kpi-label">Fee Balance</span>
              <strong class="kpi-value">PKR ${fee.totalBalance.toLocaleString()}</strong>
              <small>${fee.totalBalance <= 0 ? 'Fully Cleared' : 'Outstanding Balance'}</small>
            </div>
          ` : ''}
          ${con ? `
            <div class="kpi-card ${con.totalPoints === 0 ? 'kpi-teal' : 'kpi-rose'}">
              <span class="kpi-label">Conduct Standing</span>
              <strong class="kpi-value">${con.totalPoints === 0 ? 'Good' : `${con.totalPoints} Pts`}</strong>
              <small>${con.records.length} Recorded Infractions</small>
            </div>
          ` : ''}
        </div>

        <!-- INTERACTIVE CHARTS GRID -->
        <div class="dashboard-charts-grid mb-4" id="preview-charts-wrapper">
          <!-- Chart 1: Subject Performance -->
          ${mods.includes('academics') ? renderStudentSubjectChartHtml(acad, s.name) : ''}
          <!-- Chart 2: Attendance Distribution -->
          ${mods.includes('attendance') ? renderAttendanceDonutChartHtml(att, s.name) : ''}
          <!-- Chart 3: Fee Overview -->
          ${mods.includes('fees') && fee ? renderStudentFeeChartHtml(fee, s.name) : ''}
        </div>

        <!-- DATA TABLES TABS / ACCORDIONS -->
        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:14px; padding:20px; box-shadow:var(--shadow-sm);">
          <h3 style="margin:0 0 14px; font-size:1.05rem; font-weight:800; color:var(--text-primary);">Detailed Records &amp; Breakdown</h3>
          
          <!-- Academics Table -->
          ${mods.includes('academics') ? renderStudentAcademicsTableHtml(acad) : ''}
          <!-- Attendance Table -->
          ${mods.includes('attendance') ? renderStudentAttendanceTableHtml(att) : ''}
          <!-- Fees Table -->
          ${mods.includes('fees') && fee ? renderStudentFeesTableHtml(fee) : ''}
        </div>
      `;
    } else {
      // CLASS REPORT PREVIEW
      const acadRows = d.academicRows || [];
      const subjs = d.subjects || [];
      const attRows = d.attendanceRows || [];
      const feeRows = d.feeRows || [];
      const feeTotals = d.feeTotals;

      resultsArea.innerHTML = `
        <!-- CLASS REPORT BANNER -->
        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:14px; padding:18px 22px; margin-bottom:18px; box-shadow:var(--shadow-sm); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <span class="badge badge-primary" style="font-size:0.75rem; text-transform:uppercase; margin-bottom:4px; display:inline-block;">Collective Class Master Report</span>
            <h2 style="margin:0; font-size:1.35rem; font-weight:800; color:var(--text-primary);">Class ${d.classId} (${d.sectionId})</h2>
            <p style="margin:3px 0 0; font-size:0.85rem; color:var(--text-secondary);">Enrolled Students: <strong>${d.studentCount}</strong> &bull; Examination: <strong>${d.cycle.name}</strong> &bull; Session: <strong>${d.session.name}</strong></p>
          </div>
          <div>
            <button type="button" class="btn btn-sm btn-outline" onclick="window.print()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:3px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Master Report
            </button>
          </div>
        </div>

        <!-- KPI SUMMARY CARDS -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:20px;">
          <div class="kpi-card kpi-teal">
            <span class="kpi-label">Class Size</span>
            <strong class="kpi-value">${d.studentCount} Students</strong>
            <small>${subjs.length} Active Subjects</small>
          </div>
          <div class="kpi-card kpi-blue">
            <span class="kpi-label">Class Attendance Avg</span>
            <strong class="kpi-value">${d.classAttendanceAvg !== null ? `${d.classAttendanceAvg}%` : 'N/A'}</strong>
            <small>Presence Benchmark</small>
          </div>
          ${feeTotals ? `
            <div class="kpi-card kpi-amber">
              <span class="kpi-label">Total Fee Collected</span>
              <strong class="kpi-value">PKR ${feeTotals.paid.toLocaleString()}</strong>
              <small>${feeTotals.collectionRate}% Collection Rate</small>
            </div>
            <div class="kpi-card kpi-rose">
              <span class="kpi-label">Total Outstanding</span>
              <strong class="kpi-value">PKR ${feeTotals.balance.toLocaleString()}</strong>
              <small>Across All Class Students</small>
            </div>
          ` : ''}
        </div>

        <!-- CLASS INTERACTIVE CHARTS GRID -->
        <div class="dashboard-charts-grid mb-4" id="preview-charts-wrapper">
          <!-- Chart 1: Subject Averages -->
          ${mods.includes('academics') ? renderClassSubjectAveragesChartHtml(d.subjectAverages, d.classId) : ''}
          <!-- Chart 2: Grade Distribution -->
          ${mods.includes('academics') ? renderClassGradeDistributionChartHtml(d.gradeDistribution, d.classId) : ''}
          <!-- Chart 3: Fee Collection vs Balance -->
          ${mods.includes('fees') && feeTotals ? renderClassFeeChartHtml(feeTotals, d.classId) : ''}
        </div>

        <!-- MASTER BROADSHEET & COMPARISON TABLE -->
        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:14px; padding:20px; box-shadow:var(--shadow-sm); overflow-x:auto;">
          <h3 style="margin:0 0 14px; font-size:1.05rem; font-weight:800; color:var(--text-primary);">Academic Broadsheet &amp; Subject Scores</h3>
          
          <table class="erp-table" style="width:100%; font-size:0.84rem;">
            <thead>
              <tr>
                <th style="width:60px; text-align:center;">Roll #</th>
                <th>Student Name</th>
                <th>Father Name</th>
                ${subjs.map(s => `<th style="text-align:right;">${s.subject_name}</th>`).join('')}
                <th style="text-align:right;">Total</th>
                <th style="text-align:right;">%</th>
                <th style="text-align:center;">Grade</th>
                <th style="text-align:center;">Rank</th>
                <th style="text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${acadRows.length === 0 ? `<tr><td colspan="${subjs.length + 7}" class="text-center py-4">No students or exam records for this class.</td></tr>` : ''}
              ${acadRows.map(r => `
                <tr>
                  <td style="text-align:center; font-weight:700;">${r.rollNumber}</td>
                  <td><strong>${r.name}</strong></td>
                  <td>${r.fatherName}</td>
                  ${subjs.map(s => {
                    const score = r.subjectScores[s.subject_name];
                    return `<td style="text-align:right;">${score !== undefined ? score : '-'}</td>`;
                  }).join('')}
                  <td style="text-align:right; font-weight:700;">${r.totalObtained !== null ? r.totalObtained : '-'}</td>
                  <td style="text-align:right; font-weight:700;">${r.percentage !== null ? `${r.percentage}%` : '-'}</td>
                  <td style="text-align:center;"><span class="badge ${r.grade === 'A+' || r.grade === 'A' ? 'badge-teal' : r.grade === 'F' ? 'badge-rose' : 'badge-blue'}">${r.grade}</span></td>
                  <td style="text-align:center; font-weight:800; color:var(--primary);">${r.rank}</td>
                  <td style="text-align:center;">
                    <button type="button" class="btn btn-sm btn-outline" onclick="window.HesERP.exportStudentReportExcel('${r.studentId}')" title="Export this student's individual Excel workbook">
                      Excel
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // --- SVG CHART GENERATORS ---

  function renderStudentSubjectChartHtml(acad, studentName) {
    const list = acad.subjectMarks || [];
    if (list.length === 0) {
      return `
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title-wrap">
              <h3>Subject Performance</h3>
              <p>Examination marks breakdown for ${studentName}</p>
            </div>
          </div>
          <div class="chart-body" style="display:flex; align-items:center; justify-content:center; color:var(--text-muted); min-height:180px;">
            No exam marks recorded yet.
          </div>
        </div>
      `;
    }

    const maxScore = Math.max(...list.map(s => s.percentage), 100);
    const barWidth = Math.max(18, Math.min(36, Math.floor(340 / list.length) - 10));

    return `
      <div class="chart-card rep-svg-card" data-chart-name="Subject_Performance_${studentName}">
        <div class="chart-header">
          <div class="chart-title-wrap">
            <h3>Subject Performance (%)</h3>
            <p>Score percentages by subject for ${studentName}</p>
          </div>
          <span class="chart-tag">Overall: ${acad.overallPercentage}%</span>
        </div>
        <div class="chart-body">
          <svg viewBox="0 0 450 200" preserveAspectRatio="none" style="width:100%; height:190px;">
            <!-- Grid lines -->
            <line x1="35" y1="25" x2="435" y2="25" stroke="var(--border-color)" stroke-dasharray="3 3"/>
            <line x1="35" y1="70" x2="435" y2="70" stroke="var(--border-color)" stroke-dasharray="3 3"/>
            <line x1="35" y1="115" x2="435" y2="115" stroke="var(--border-color)" stroke-dasharray="3 3"/>
            <line x1="35" y1="160" x2="435" y2="160" stroke="var(--border-color)"/>

            <text x="30" y="29" font-size="10" fill="var(--text-muted)" text-anchor="end">100%</text>
            <text x="30" y="74" font-size="10" fill="var(--text-muted)" text-anchor="end">66%</text>
            <text x="30" y="119" font-size="10" fill="var(--text-muted)" text-anchor="end">33%</text>
            <text x="30" y="164" font-size="10" fill="var(--text-muted)" text-anchor="end">0%</text>

            ${list.map((s, idx) => {
              const x = 50 + idx * ((420 - 50) / Math.max(1, list.length));
              const barH = (s.percentage / 100) * 135;
              const y = 160 - barH;
              const fill = s.percentage >= 80 ? 'var(--primary)' : s.percentage >= 50 ? 'var(--accent)' : 'var(--danger)';
              return `
                <g>
                  <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${fill}">
                    <title>${s.subject}: ${s.percentage}% (${s.obtained}/${s.max} Marks)</title>
                  </rect>
                  <text x="${x + barWidth / 2}" y="${y - 4}" font-size="10" font-weight="700" fill="var(--text-primary)" text-anchor="middle">${s.percentage}%</text>
                  <text x="${x + barWidth / 2}" y="176" font-size="9" fill="var(--text-muted)" text-anchor="middle">${s.subject.slice(0, 7)}</text>
                </g>
              `;
            }).join('')}
          </svg>
        </div>
        <div class="chart-footer">
          <span>Benchmark: 33% Passing</span>
          <strong style="color:var(--primary);">Grade: ${acad.overallGrade}</strong>
        </div>
      </div>
    `;
  }

  function renderAttendanceDonutChartHtml(att, studentName) {
    const total = att.totalDays || 0;
    if (total === 0) {
      return `
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title-wrap">
              <h3>Attendance Distribution</h3>
              <p>Presence vs absence for ${studentName}</p>
            </div>
          </div>
          <div class="chart-body" style="display:flex; align-items:center; justify-content:center; color:var(--text-muted); min-height:180px;">
            No attendance recorded for this period.
          </div>
        </div>
      `;
    }

    const presentPct = Math.round((att.presentCount / total) * 100);
    const absentPct = Math.round((att.absentCount / total) * 100);
    const leavePct = 100 - presentPct - absentPct;

    // Circumference = 2 * PI * r = 2 * 3.14159 * 54 = 339.29
    const c = 339.29;
    const pDash = (presentPct / 100) * c;
    const aDash = (absentPct / 100) * c;
    const lDash = (leavePct / 100) * c;

    return `
      <div class="chart-card rep-svg-card" data-chart-name="Attendance_Donut_${studentName}">
        <div class="chart-header">
          <div class="chart-title-wrap">
            <h3>Attendance Breakdown</h3>
            <p>Presence rate across recorded days</p>
          </div>
          <span class="chart-tag" style="background:var(--primary-soft); color:var(--primary); font-weight:700;">${presentPct}% Present</span>
        </div>
        <div class="chart-body" style="display:flex; align-items:center; justify-content:space-around; padding:10px;">
          <svg width="150" height="150" viewBox="0 0 150 150">
            <circle cx="75" cy="75" r="54" fill="transparent" stroke="var(--border-color)" stroke-width="16"/>
            <!-- Present Segment -->
            <circle cx="75" cy="75" r="54" fill="transparent" stroke="var(--primary)" stroke-width="16" stroke-dasharray="${pDash} ${c}" stroke-dashoffset="0" transform="rotate(-90 75 75)"/>
            <!-- Absent Segment -->
            <circle cx="75" cy="75" r="54" fill="transparent" stroke="var(--danger)" stroke-width="16" stroke-dasharray="${aDash} ${c}" stroke-dashoffset="${-pDash}" transform="rotate(-90 75 75)"/>
            <!-- Leave Segment -->
            <circle cx="75" cy="75" r="54" fill="transparent" stroke="var(--warning)" stroke-width="16" stroke-dasharray="${lDash} ${c}" stroke-dashoffset="${-(pDash + aDash)}" transform="rotate(-90 75 75)"/>
            <text x="75" y="70" font-size="18" font-weight="800" fill="var(--text-primary)" text-anchor="middle">${presentPct}%</text>
            <text x="75" y="86" font-size="10" fill="var(--text-muted)" text-anchor="middle">Presence</text>
          </svg>

          <div style="font-size:0.82rem; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:10px; height:10px; border-radius:50%; background:var(--primary); display:inline-block;"></span>
              <span>Present: <strong>${att.presentCount}</strong> (${presentPct}%)</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:10px; height:10px; border-radius:50%; background:var(--danger); display:inline-block;"></span>
              <span>Absent: <strong>${att.absentCount}</strong> (${absentPct}%)</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:10px; height:10px; border-radius:50%; background:var(--warning); display:inline-block;"></span>
              <span>Leave: <strong>${att.leaveCount}</strong> (${leavePct}%)</span>
            </div>
            <div style="border-top:1px solid var(--border-color); padding-top:4px; margin-top:2px;">
              Total Days: <strong>${total}</strong>
            </div>
          </div>
        </div>
        <div class="chart-footer">
          <span>Target Policy: &ge; 75% Required</span>
          <strong style="color:${presentPct >= 75 ? 'var(--success)' : 'var(--danger)'};">${presentPct >= 75 ? 'Good Standing' : 'Low Attendance Alert'}</strong>
        </div>
      </div>
    `;
  }

  function renderStudentFeeChartHtml(fee, studentName) {
    return `
      <div class="chart-card rep-svg-card" data-chart-name="Fee_Overview_${studentName}">
        <div class="chart-header">
          <div class="chart-title-wrap">
            <h3>Fee Payment &amp; Balance</h3>
            <p>Billed vs Collected vs Dues (PKR)</p>
          </div>
          <span class="chart-tag">PKR ${fee.totalBilled.toLocaleString()} Billed</span>
        </div>
        <div class="chart-body">
          <svg viewBox="0 0 450 180" preserveAspectRatio="none" style="width:100%; height:170px;">
            <rect x="60" y="30" width="80" height="110" rx="6" fill="var(--border-color)"/>
            <text x="100" y="22" font-size="11" font-weight="700" fill="var(--text-primary)" text-anchor="middle">PKR ${fee.totalBilled.toLocaleString()}</text>
            <text x="100" y="160" font-size="11" fill="var(--text-muted)" text-anchor="middle">Total Billed</text>

            <rect x="185" y="55" width="80" height="85" rx="6" fill="var(--primary)"/>
            <text x="225" y="47" font-size="11" font-weight="700" fill="var(--primary)" text-anchor="middle">PKR ${fee.totalPaid.toLocaleString()}</text>
            <text x="225" y="160" font-size="11" fill="var(--text-muted)" text-anchor="middle">Paid Amount</text>

            <rect x="310" y="90" width="80" height="50" rx="6" fill="${fee.totalBalance > 0 ? 'var(--danger)' : 'var(--border-color)'}"/>
            <text x="350" y="82" font-size="11" font-weight="700" fill="${fee.totalBalance > 0 ? 'var(--danger)' : 'var(--success)'}" text-anchor="middle">PKR ${fee.totalBalance.toLocaleString()}</text>
            <text x="350" y="160" font-size="11" fill="var(--text-muted)" text-anchor="middle">Balance Due</text>
          </svg>
        </div>
        <div class="chart-footer">
          <span>Discounts: PKR ${fee.siblingDiscount.toLocaleString()}</span>
          <strong style="color:${fee.totalBalance <= 0 ? 'var(--success)' : 'var(--danger)'};">${fee.totalBalance <= 0 ? 'Fully Cleared' : 'Payment Overdue'}</strong>
        </div>
      </div>
    `;
  }

  function renderClassSubjectAveragesChartHtml(subjAvgs, classId) {
    const keys = Object.keys(subjAvgs || {});
    if (keys.length === 0) return '';
    return `
      <div class="chart-card rep-svg-card" data-chart-name="Class_${classId}_Subject_Averages">
        <div class="chart-header">
          <div class="chart-title-wrap">
            <h3>Class Subject Averages</h3>
            <p>Average marks obtained across all class students</p>
          </div>
          <span class="chart-tag">Class ${classId}</span>
        </div>
        <div class="chart-body">
          <svg viewBox="0 0 450 180" preserveAspectRatio="none" style="width:100%; height:170px;">
            ${keys.map((k, i) => {
              const val = subjAvgs[k] || 0;
              const x = 40 + i * ((420 - 40) / keys.length);
              const barH = (val / 100) * 110;
              const y = 140 - barH;
              return `
                <g>
                  <rect x="${x}" y="${y}" width="26" height="${barH}" rx="4" fill="var(--primary)"/>
                  <text x="${x + 13}" y="${y - 4}" font-size="10" font-weight="700" fill="var(--text-primary)" text-anchor="middle">${val}</text>
                  <text x="${x + 13}" y="156" font-size="9" fill="var(--text-muted)" text-anchor="middle">${k.slice(0, 6)}</text>
                </g>
              `;
            }).join('')}
          </svg>
        </div>
      </div>
    `;
  }

  function renderClassGradeDistributionChartHtml(gradeDist, classId) {
    const grades = ['A+', 'A', 'B', 'C', 'D', 'F'];
    const maxCnt = Math.max(...grades.map(g => gradeDist[g] || 0), 10);
    return `
      <div class="chart-card rep-svg-card" data-chart-name="Class_${classId}_Grade_Distribution">
        <div class="chart-header">
          <div class="chart-title-wrap">
            <h3>Grade Distribution</h3>
            <p>Student count per letter grade</p>
          </div>
          <span class="chart-tag">Academic Spread</span>
        </div>
        <div class="chart-body">
          <svg viewBox="0 0 450 180" preserveAspectRatio="none" style="width:100%; height:170px;">
            ${grades.map((g, i) => {
              const cnt = gradeDist[g] || 0;
              const x = 50 + i * 65;
              const barH = (cnt / maxCnt) * 110;
              const y = 140 - barH;
              const fill = g === 'A+' || g === 'A' ? 'var(--primary)' : g === 'F' ? 'var(--danger)' : 'var(--accent)';
              return `
                <g>
                  <rect x="${x}" y="${y}" width="34" height="${barH}" rx="4" fill="${fill}"/>
                  <text x="${x + 17}" y="${y - 4}" font-size="11" font-weight="800" fill="var(--text-primary)" text-anchor="middle">${cnt}</text>
                  <text x="${x + 17}" y="158" font-size="11" font-weight="700" fill="var(--text-muted)" text-anchor="middle">${g}</text>
                </g>
              `;
            }).join('')}
          </svg>
        </div>
      </div>
    `;
  }

  function renderClassFeeChartHtml(totals, classId) {
    return `
      <div class="chart-card rep-svg-card" data-chart-name="Class_${classId}_Fee_Collection">
        <div class="chart-header">
          <div class="chart-title-wrap">
            <h3>Fee Collection vs Balance</h3>
            <p>Total Billed vs Collected in PKR</p>
          </div>
          <span class="chart-tag">${totals.collectionRate}% Collected</span>
        </div>
        <div class="chart-body">
          <svg viewBox="0 0 450 180" preserveAspectRatio="none" style="width:100%; height:170px;">
            <rect x="70" y="30" width="120" height="110" rx="6" fill="var(--primary)"/>
            <text x="130" y="22" font-size="12" font-weight="700" fill="var(--primary)" text-anchor="middle">PKR ${totals.paid.toLocaleString()}</text>
            <text x="130" y="158" font-size="11" fill="var(--text-muted)" text-anchor="middle">Collected</text>

            <rect x="250" y="60" width="120" height="80" rx="6" fill="var(--danger)"/>
            <text x="310" y="52" font-size="12" font-weight="700" fill="var(--danger)" text-anchor="middle">PKR ${totals.balance.toLocaleString()}</text>
            <text x="310" y="158" font-size="11" fill="var(--text-muted)" text-anchor="middle">Outstanding</text>
          </svg>
        </div>
      </div>
    `;
  }

  // --- TABLES HTML GENERATORS ---

  function renderStudentAcademicsTableHtml(acad) {
    return `
      <div class="mb-4">
        <h4 style="margin:0 0 8px; font-size:0.92rem; font-weight:800; color:var(--text-primary);">Academic Examination Marks</h4>
        <table class="erp-table" style="width:100%; font-size:0.84rem;">
          <thead>
            <tr>
              <th>Examination</th>
              <th>Subject</th>
              <th style="text-align:right;">Max Marks</th>
              <th style="text-align:right;">Obtained</th>
              <th style="text-align:right;">Percentage</th>
              <th style="text-align:center;">Grade</th>
              <th style="text-align:center;">Pass Status</th>
            </tr>
          </thead>
          <tbody>
            ${(acad.exams || []).map(ex => ex.subjects.map(subj => `
              <tr>
                <td>${ex.cycleName}</td>
                <td><strong>${subj.subject}</strong></td>
                <td style="text-align:right;">${subj.maxMarks}</td>
                <td style="text-align:right; font-weight:700;">${subj.obtainedMarks !== null ? subj.obtainedMarks : '-'}</td>
                <td style="text-align:right; font-weight:700;">${subj.percentage !== null ? `${subj.percentage}%` : '-'}</td>
                <td style="text-align:center;"><span class="badge ${subj.grade === 'A+' || subj.grade === 'A' ? 'badge-teal' : subj.grade === 'F' ? 'badge-rose' : 'badge-blue'}">${subj.grade}</span></td>
                <td style="text-align:center; font-weight:700; color:${subj.passStatus === 'Passed' ? 'var(--success)' : 'var(--danger)'};">${subj.passStatus}</td>
              </tr>
            `).join('')).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderStudentAttendanceTableHtml(att) {
    return `
      <div class="mb-4">
        <h4 style="margin:0 0 8px; font-size:0.92rem; font-weight:800; color:var(--text-primary);">Monthly Attendance Trend</h4>
        <table class="erp-table" style="width:100%; font-size:0.84rem;">
          <thead>
            <tr>
              <th>Month</th>
              <th style="text-align:right;">Present Days</th>
              <th style="text-align:right;">Absent Days</th>
              <th style="text-align:right;">Leave Days</th>
              <th style="text-align:right;">Total Days</th>
              <th style="text-align:right;">Presence %</th>
            </tr>
          </thead>
          <tbody>
            ${att.monthlyTrend.length === 0 ? '<tr><td colspan="6" class="text-center py-3">No monthly attendance records found.</td></tr>' : ''}
            ${att.monthlyTrend.map(m => `
              <tr>
                <td><strong>${m.month}</strong></td>
                <td style="text-align:right; color:var(--success); font-weight:700;">${m.present}</td>
                <td style="text-align:right; color:var(--danger); font-weight:700;">${m.absent}</td>
                <td style="text-align:right; color:var(--warning);">${m.leave}</td>
                <td style="text-align:right;">${m.total}</td>
                <td style="text-align:right; font-weight:800; color:var(--primary);">${m.percentage}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderStudentFeesTableHtml(fee) {
    return `
      <div>
        <h4 style="margin:0 0 8px; font-size:0.92rem; font-weight:800; color:var(--text-primary);">Fee Challans &amp; Payment Ledger</h4>
        <table class="erp-table" style="width:100%; font-size:0.84rem;">
          <thead>
            <tr>
              <th>Challan No</th>
              <th>Month</th>
              <th>Due Date</th>
              <th style="text-align:right;">Charges (PKR)</th>
              <th style="text-align:right;">Discount</th>
              <th style="text-align:right;">Paid (PKR)</th>
              <th style="text-align:right;">Balance (PKR)</th>
              <th style="text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${fee.challans.length === 0 ? '<tr><td colspan="8" class="text-center py-3">No fee challans recorded for this period.</td></tr>' : ''}
            ${fee.challans.map(ch => `
              <tr>
                <td><strong>${ch.challan_no}</strong></td>
                <td>${ch.month_label}</td>
                <td>${ch.due_date}</td>
                <td style="text-align:right;">PKR ${parseFloat(ch.total_payable || 0).toLocaleString()}</td>
                <td style="text-align:right; color:var(--success);">PKR ${parseFloat(ch.sibling_discount || 0).toLocaleString()}</td>
                <td style="text-align:right; font-weight:700;">PKR ${parseFloat(ch.paid_amount || 0).toLocaleString()}</td>
                <td style="text-align:right; font-weight:800; color:${parseFloat(ch.balance_amount || 0) > 0 ? 'var(--danger)' : 'var(--success)'};">PKR ${parseFloat(ch.balance_amount || 0).toLocaleString()}</td>
                <td style="text-align:center;"><span class="badge ${ch.status === 'Paid' ? 'badge-teal' : 'badge-amber'}">${ch.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // --- DOWNLOAD & EXPORT ACTIONS ---

  async function downloadActiveReportExcel() {
    const q = collectReportQueryParams();
    const searchParams = new URLSearchParams(q).toString();
    const url = `/api/reports/export-excel?${searchParams}`;
    const filename = q.scope === 'student' ? 'Student_Report.xlsx' : `Class_${q.class_id}_Report.xlsx`;
    await downloadFileWithAuth(url, filename);
  }

  async function downloadFileWithAuth(url, defaultFilename) {
    try {
      const headers = erpState.token ? { 'Authorization': `Bearer ${erpState.token}` } : {};
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Download failed (${res.status})`);
      }
      const disposition = res.headers.get('Content-Disposition');
      let filename = defaultFilename;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e) {
      alert(`Export error: ${e.message}`);
    }
  }

  function downloadActiveChart(format = 'png') {
    const svgCards = document.querySelectorAll('.rep-svg-card svg');
    if (svgCards.length === 0) {
      alert('No chart found on screen to download.');
      return;
    }
    const targetSvg = svgCards[0];
    const parentCard = targetSvg.closest('.rep-svg-card');
    const chartName = parentCard?.dataset?.chartName || 'Report_Chart';

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(targetSvg);

    if (format === 'svg') {
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chartName}.svg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }

    // Convert SVG to high-res PNG canvas
    const canvas = document.createElement('canvas');
    const bbox = targetSvg.getBoundingClientRect();
    const scale = 2; // high-resolution 2x
    canvas.width = (bbox.width || 500) * scale;
    canvas.height = (bbox.height || 220) * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${chartName}.png`;
      a.click();
    };
    img.src = url;
  }

  async function runBulkExport(exportType) {
    const q = collectReportQueryParams();
    const payload = {
      export_type: exportType,
      class_id: q.class_id,
      section_id: q.section_id,
      session_id: q.session_id,
      exam_cycle_id: q.exam_cycle_id,
      modules: getSelectedReportModules()
    };

    // Show Progress Modal
    showBulkProgressModal(exportType, q.class_id);

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(erpState.token ? { 'Authorization': `Bearer ${erpState.token}` } : {})
      };

      const res = await fetch('/api/reports/bulk-export', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Bulk export failed (${res.status})`);
      }

      const disposition = res.headers.get('Content-Disposition');
      let filename = exportType === 'bulk_zip' ? `BulkReports_Class_${q.class_id}.zip` : `Class_${q.class_id}_Individual_Dossiers.xlsx`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      closeBulkProgressModal();
    } catch (e) {
      closeBulkProgressModal();
      alert(`Bulk Export Error: ${e.message}`);
    }
  }

  function showBulkProgressModal(type, classId) {
    let modal = document.getElementById('rep-bulk-progress-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'rep-bulk-progress-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,17,32,0.65); display:flex; align-items:center; justify-content:center; z-index:9999; backdrop-filter:blur(3px);';
      document.body.appendChild(modal);
    }

    const typeLabel = type === 'bulk_zip' ? 'Individual Student Workbooks (ZIP Package)' : 'Class Overview with Student Dossier Sheets';
    modal.innerHTML = `
      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; width:440px; max-width:92vw; padding:26px; box-shadow:var(--shadow-lg); text-align:center;">
        <h3 style="margin:0 0 8px; font-size:1.15rem; font-weight:800; color:var(--text-primary);">Generating Bulk Export</h3>
        <p style="margin:0 0 16px; font-size:0.84rem; color:var(--text-secondary);">${typeLabel} for Class ${classId}</p>

        <!-- Animated Progress Bar -->
        <div style="background:var(--border-color); border-radius:8px; height:12px; width:100%; overflow:hidden; margin-bottom:14px;">
          <div id="rep-progress-fill" style="background:var(--primary); height:100%; width:85%; border-radius:8px; animation:indeterminate 1.5s infinite ease-in-out;"></div>
        </div>
        <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:18px;">Compiling grades, attendance records, financial statements, and native Excel charts...</p>

        <button type="button" class="btn btn-outline btn-sm" id="btn-cancel-bulk-modal" style="width:100%;">
          Cancel
        </button>
      </div>
    `;

    document.getElementById('btn-cancel-bulk-modal').onclick = () => closeBulkProgressModal();
  }

  function closeBulkProgressModal() {
    const modal = document.getElementById('rep-bulk-progress-modal');
    if (modal) modal.remove();
  }

  // Quick action: export student report excel from any screen
  async function exportStudentReportExcel(studentId) {
    const url = `/api/reports/export-excel?scope=student&student_id=${studentId}&modules=academics,attendance,fees,conduct`;
    await downloadFileWithAuth(url, `StudentReport_${studentId}.xlsx`);
  }

  // Quick action: export class report excel from any screen
  async function exportClassReportExcel(classId, sectionId = 'All') {
    const url = `/api/reports/export-excel?scope=class&class_id=${classId}&section_id=${sectionId}&modules=academics,attendance,fees,conduct`;
    await downloadFileWithAuth(url, `ClassReport_${classId}.xlsx`);
  }
'''

with open('erp-client.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the existing renderReportsScreen implementation
old_start = "  // MODULE 17: REPORTS & EXPORTS HUB"
old_end = "  // MODULE 15 & 20: ADMINISTRATIVE HUB"

idx_start = content.find(old_start)
idx_end = content.find(old_end)

if idx_start == -1 or idx_end == -1:
    print("Could not find markers in erp-client.js!")
else:
    # also add exportStudentReportExcel and exportClassReportExcel to window.HesERP
    new_content = content[:idx_start] + code_to_insert + "\n  " + content[idx_end:]
    
    # Update HesERP public interface
    if 'exportStudentReportExcel' not in new_content:
        new_content = new_content.replace(
            "printPayslip: printPayslip,",
            "printPayslip: printPayslip,\n    exportStudentReportExcel: exportStudentReportExcel,\n    exportClassReportExcel: exportClassReportExcel,"
        )

    with open('erp-client.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("erp-client.js updated successfully with Student & Class Reports Module!")

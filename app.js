/**
 * Hadi Education System Balkassar — Main Application Controller
 * Modules: Home Dashboard | Violation Record | Homework & Pending Tasks | Monthly Tests | Grand Report
 */

(function () {
  'use strict';

  const state = {
    currentScreen: 'home',
    // Violations module
    vTab: 'form',
    searchQuery: '',
    filterClass: 'ALL',
    filterSeverity: 'ALL',
    sortBy: 'severity',
    sortAscending: false,
    selectedSeverity: '',
    activeStudentDetailId: null,

    // Homework module
    hwMode: 'browse', // 'browse' | 'pending'
    hwClassId: null,
    hwSubject: null,
    hwSectionFilter: 'ALL',
    hwFormOpen: false,
    hwDraftMeta: null,
    hwDraftMarks: {}, // studentId -> { hwDone: true, conceptClear: true }
    hwModalStudentId: null,
    hwModalRange: '30d',
    hwModalCustomStart: '',
    hwModalCustomEnd: '',

    // Monthly Tests module
    testId: null,
    testClassId: null,
    testSubject: null,
    testSectionFilter: 'ALL',

    // Grand Report module
    grandClassId: null,
    grandStudentId: null,
    grandSearch: '',
    grandSectionFilter: 'ALL',
    grandHwRange: 'all',

    // Pending confirmation callback
    confirmCallback: null
  };

  /* ========================================================================
     Utilities & Formatters
     ======================================================================== */
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateTime(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Invalid date';
    const now = new Date();
    const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return `Today at ${timeStr}`;
    const dateStr = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
    return `${dateStr}, ${timeStr}`;
  }

  function formatDateOnly(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatTimeOnly(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function getGradeLabel(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return '-';
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    if (pct >= 40) return 'E';
    return 'F';
  }

  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function openConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm }) {
    document.getElementById('confirm-title').textContent = title || 'Confirm Action';
    document.getElementById('confirm-msg').textContent = message || 'Are you sure?';
    const proceedBtn = document.getElementById('btn-confirm-proceed');
    proceedBtn.textContent = confirmLabel;
    state.confirmCallback = onConfirm;
    document.getElementById('confirm-modal').classList.add('open');
  }

  function closeConfirmDialog() {
    document.getElementById('confirm-modal').classList.remove('open');
    state.confirmCallback = null;
  }

  /* ========================================================================
     Navigation Controller
     ======================================================================== */
  function switchScreen(screenName) {
    state.currentScreen = screenName;

    document.querySelectorAll('.screen').forEach((el) => {
      el.classList.toggle('active', el.id === `screen-${screenName}`);
    });
    document.querySelectorAll('.desktop-nav .nav-link').forEach((el) => {
      el.classList.toggle('active', el.dataset.screen === screenName);
    });
    document.querySelectorAll('.bottom-nav .tab-btn').forEach((el) => {
      el.classList.toggle('active', el.dataset.screen === screenName);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (screenName === 'home') updateHomeStats();
    else if (screenName === 'violations') refreshViolationsModule();
    else if (screenName === 'homework') refreshHomeworkModule();
    else if (screenName === 'tests') refreshTestsModule();
    else if (screenName === 'grand-report') refreshGrandReportModule();
  }

  /* ========================================================================
     SCREEN 0: Home Stats
     ======================================================================== */
  async function updateHomeStats() {
    const roster = await window.AppStorage.getAllRosterStudents();
    const complaints = await window.AppStorage.getComplaints();
    const pending = await window.AppStorage.getPendingTasks({ includeResolved: false });
    const tests = await window.AppStorage.getTests();
    const hws = await window.AppStorage.getHomeworks();

    document.getElementById('home-stat-students').textContent = roster.length;
    document.getElementById('home-stat-violations').textContent = complaints.length;
    document.getElementById('home-stat-pending').textContent = pending.length;
    document.getElementById('home-stat-tests').textContent = tests.length;

    document.getElementById('home-violations-tag').textContent = `${complaints.length} Logged`;
    document.getElementById('home-homework-tag').textContent = `${hws.length} HW • ${pending.length} Pending`;
    document.getElementById('home-tests-tag').textContent = `${tests.length} ${tests.length === 1 ? 'Test' : 'Tests'}`;
  }

  /* ========================================================================
     MODULE 1: Violation Record
     ======================================================================== */
  function switchViolationSubTab(tab) {
    state.vTab = tab;
    document.querySelectorAll('#screen-violations .subtab-btn').forEach((b) => {
      const active = b.dataset.vtab === tab;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('#screen-violations .vview').forEach((v) => {
      v.classList.toggle('active', v.id === `vview-${tab}`);
    });

    if (tab === 'records') renderViolationRecords();
    else if (tab === 'master') renderViolationMasterSheet();
  }

  async function refreshViolationsModule() {
    const studentsStats = await window.AppStorage.getStudentsWithStats();
    const complaints = await window.AppStorage.getComplaints();
    document.getElementById('vtab-count-students').textContent = studentsStats.length;
    document.getElementById('vtab-count-total').textContent = complaints.length;

    if (state.vTab === 'records') await renderViolationRecords();
    else if (state.vTab === 'master') await renderViolationMasterSheet();
  }

  function populateClassDropdowns() {
    const classes = window.AppStorage.getClasses();
    const formSelect = document.getElementById('select-class');
    const filterSelect = document.getElementById('filter-class');
    const hwSelect = document.getElementById('hw-select-class');
    const pendingFilter = document.getElementById('pending-filter-class');

    const optsHtml = classes.map((c) => `<option value="${c.id}">${escapeHTML(c.label)}</option>`).join('');

    formSelect.innerHTML = '<option value="">-- Select Class --</option>' + optsHtml;
    filterSelect.innerHTML = '<option value="ALL">All Classes</option>' + optsHtml;
    hwSelect.innerHTML = optsHtml;
    pendingFilter.innerHTML = '<option value="ALL">All Classes</option>' + optsHtml;
  }

  async function handleViolationNameInput(e) {
    const val = e.target.value.trim().toLowerCase();
    document.getElementById('input-student-id').value = '';
    document.getElementById('val-student-name').classList.remove('visible');
    e.target.classList.remove('is-invalid');

    const dropdown = document.getElementById('autocomplete-list');
    if (!val) {
      dropdown.classList.remove('show');
      dropdown.innerHTML = '';
      return;
    }

    const roster = await window.AppStorage.getAllRosterStudents();
    const matches = roster.filter((s) =>
      s.name.toLowerCase().includes(val) || (s.rollNumber && s.rollNumber.toString().includes(val))
    ).slice(0, 15);

    if (matches.length === 0) {
      dropdown.classList.remove('show');
      dropdown.innerHTML = '';
      return;
    }

    dropdown.innerHTML = matches.map((s) => `
      <div class="autocomplete-item" data-id="${escapeHTML(s.id)}" data-name="${escapeHTML(s.name)}" data-class="${escapeHTML(s.classId)}">
        <div>
          <strong>${escapeHTML(s.name)}</strong>
          <small style="color:var(--text-muted); margin-left:6px;">#${escapeHTML(s.rollNumber || '-')} &bull; ${escapeHTML(s.section || '')}</small>
        </div>
        <span class="drill-pill drill-pill-blue">${escapeHTML(window.AppStorage.getClassLabel(s.classId))}</span>
      </div>
    `).join('');
    dropdown.classList.add('show');
  }

  function handleViolationAutocompletePick(e) {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;

    document.getElementById('input-student-id').value = item.dataset.id;
    document.getElementById('input-student-name').value = item.dataset.name;
    document.getElementById('select-class').value = item.dataset.class;

    document.getElementById('autocomplete-list').classList.remove('show');
    document.getElementById('val-student-name').classList.remove('visible');
    document.getElementById('input-student-name').classList.remove('is-invalid');
    document.getElementById('val-class').classList.remove('visible');
    document.getElementById('select-class').classList.remove('is-invalid');
    document.getElementById('textarea-complaint').focus();
  }

  async function handleViolationSubmit(e) {
    e.preventDefault();
    const studentId = document.getElementById('input-student-id').value;
    const nameInput = document.getElementById('input-student-name');
    const classSelect = document.getElementById('select-class');
    const textArea = document.getElementById('textarea-complaint');
    const sevInput = document.getElementById('input-severity-value');

    let valid = true;
    if (!nameInput.value.trim()) {
      document.getElementById('val-student-name').classList.add('visible');
      nameInput.classList.add('is-invalid');
      valid = false;
    }
    if (!classSelect.value) {
      document.getElementById('val-class').classList.add('visible');
      classSelect.classList.add('is-invalid');
      valid = false;
    }
    if (!textArea.value.trim()) {
      document.getElementById('val-complaint').classList.add('visible');
      textArea.classList.add('is-invalid');
      valid = false;
    }
    if (!sevInput.value) {
      document.getElementById('val-severity').classList.add('visible');
      valid = false;
    }
    if (!valid) return;

    try {
      const res = await window.AppStorage.addComplaint({
        studentId: studentId || null,
        studentName: nameInput.value.trim(),
        className: classSelect.value,
        text: textArea.value.trim(),
        severity: sevInput.value
      });

      const banner = document.getElementById('form-success-banner');
      document.getElementById('success-banner-details').textContent =
        `Recorded for ${res.student.name} (${window.AppStorage.getClassLabel(res.student.classId)}) on ${formatDateTime(res.complaint.createdAt)}. Severity: ${res.complaint.severity}.`;
      banner.classList.remove('hidden');

      showToast(`Violation logged at ${formatTimeOnly(res.complaint.createdAt)}`, 'success');

      document.getElementById('complaint-form').reset();
      document.getElementById('input-student-id').value = '';
      sevInput.value = '';
      state.selectedSeverity = '';
      document.querySelectorAll('.sev-btn').forEach((b) => {
        b.classList.remove('selected');
        b.setAttribute('aria-checked', 'false');
      });
      document.getElementById('char-counter').textContent = '0 chars';

      await refreshViolationsModule();
      await updateHomeStats();
      setTimeout(() => banner.classList.add('hidden'), 8000);
    } catch (err) {
      showToast(err.message || 'Error saving violation.', 'error');
    }
  }

  function getClassOrderIndex(classId) {
    const order = ['6th', '7th', '8th', '9th', '10th', '11th', '12th'];
    const idx = order.indexOf(window.AppStorage.normalizeClassId(classId));
    return idx === -1 ? 99 : idx;
  }

  async function renderViolationRecords() {
    let students = await window.AppStorage.getStudentsWithStats();

    const q = state.searchQuery.trim().toLowerCase();
    if (q) students = students.filter((s) => s.name.toLowerCase().includes(q));
    if (state.filterClass !== 'ALL') {
      students = students.filter((s) => window.AppStorage.normalizeClassId(s.classId) === state.filterClass);
    }
    if (state.filterSeverity !== 'ALL') {
      students = students.filter((s) => (s.severityCounts[state.filterSeverity] || 0) > 0);
    }

    students.sort((a, b) => {
      let diff = 0;
      if (state.sortBy === 'severity') diff = b.severityScore - a.severityScore || b.totalComplaints - a.totalComplaints;
      else if (state.sortBy === 'complaints') diff = b.totalComplaints - a.totalComplaints || b.severityScore - a.severityScore;
      else if (state.sortBy === 'latest') diff = new Date(b.latestComplaintAt || 0) - new Date(a.latestComplaintAt || 0);
      else if (state.sortBy === 'name') diff = a.name.localeCompare(b.name);
      else if (state.sortBy === 'class') diff = getClassOrderIndex(a.classId) - getClassOrderIndex(b.classId);
      return state.sortAscending ? -diff : diff;
    });

    document.getElementById('record-count-text').textContent = `Showing ${students.length} ${students.length === 1 ? 'student' : 'students'}`;
    const hasFilters = q || state.filterClass !== 'ALL' || state.filterSeverity !== 'ALL';
    document.getElementById('active-filters-hint').style.display = hasFilters ? 'inline' : 'none';

    const grid = document.getElementById('students-grid');
    const empty = document.getElementById('records-empty');

    if (students.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'flex';
      document.getElementById('records-empty-msg').textContent = hasFilters
        ? 'No students match your current search or filters.'
        : 'No student violations have been logged yet.';
      return;
    }

    empty.style.display = 'none';
    grid.innerHTML = students.map((s) => {
      const chips = Object.entries(s.severityCounts)
        .filter(([_, c]) => c > 0)
        .map(([sev, c]) => `<span class="sev-chip sev-chip-${sev.toLowerCase()}">${sev} &times; ${c}</span>`)
        .join('');

      return `
        <article class="student-card" data-student-id="${escapeHTML(s.id)}" tabindex="0" role="button">
          <div class="student-card-header">
            <div>
              <span class="student-name">${escapeHTML(s.name)}</span>
              <div><span class="student-class-badge">${escapeHTML(s.className)} ${s.rollNumber && s.rollNumber !== '-' ? '&bull; #' + escapeHTML(s.rollNumber) : ''}</span></div>
            </div>
            <span class="complaint-count-badge">${s.totalComplaints} ${s.totalComplaints === 1 ? 'violation' : 'violations'}</span>
          </div>
          <div class="meter-section">
            <div class="meter-track"><div class="meter-fill-reveal" style="--meter-fill: ${s.fillPercent}%;"></div></div>
            <div class="meter-info">
              <span class="meter-score">Score: ${s.severityScore} <span>/ ${window.AppStorage.MAX_SCORE}</span></span>
              <span class="status-badge ${s.statusClass}">${s.statusLabel}</span>
            </div>
          </div>
          <div class="severity-chips">${chips}</div>
          <div class="student-card-footer">
            <span class="latest-time">${formatDateTime(s.latestComplaintAt)}</span>
            <span class="tap-indicator">Tap to view &rarr;</span>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('.student-card').forEach((card) => {
      card.addEventListener('click', () => openViolationDetailModal(card.dataset.studentId));
    });
  }

  async function openViolationDetailModal(studentId) {
    const students = await window.AppStorage.getStudentsWithStats();
    const s = students.find((x) => x.id === studentId);
    if (!s) return;

    state.activeStudentDetailId = studentId;
    document.getElementById('modal-student-name').textContent = s.name;
    document.getElementById('modal-student-meta').textContent = `${s.className} • ${s.totalComplaints} violations • Score: ${s.severityScore}`;

    document.getElementById('modal-meter-section').innerHTML = `
      <div class="meter-track" style="height:14px;"><div class="meter-fill-reveal" style="--meter-fill:${s.fillPercent}%;"></div></div>
      <div class="meter-info" style="margin-top:6px;">
        <span class="meter-score">Severity Score: ${s.severityScore} <span>/ ${window.AppStorage.MAX_SCORE}</span></span>
        <span class="status-badge ${s.statusClass}">${s.statusLabel}</span>
      </div>
    `;

    document.getElementById('modal-history-list').innerHTML = s.complaints.map((c) => `
      <div class="history-card">
        <div class="history-card-header">
          <span class="sev-chip sev-chip-${c.severity.toLowerCase()}">${escapeHTML(c.severity)}</span>
          <span class="history-time">${formatDateTime(c.createdAt)}</span>
        </div>
        <div class="history-text" dir="auto">${escapeHTML(c.text)}</div>
        <div class="history-footer">
          <button class="btn btn-outline btn-sm btn-danger btn-del-violation" data-cid="${escapeHTML(c.id)}">Delete</button>
        </div>
      </div>
    `).join('');

    document.getElementById('btn-detail-add-complaint').onclick = () => {
      closeViolationDetailModal();
      switchViolationSubTab('form');
      document.getElementById('input-student-id').value = s.id;
      document.getElementById('input-student-name').value = s.name;
      document.getElementById('select-class').value = window.AppStorage.normalizeClassId(s.classId);
      document.getElementById('textarea-complaint').focus();
    };

    document.getElementById('btn-detail-open-grand').onclick = () => {
      closeViolationDetailModal();
      state.grandClassId = window.AppStorage.normalizeClassId(s.classId);
      state.grandStudentId = s.id;
      switchScreen('grand-report');
    };

    document.querySelectorAll('.btn-del-violation').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = btn.dataset.cid;
        openConfirmDialog({
          title: 'Delete Violation',
          message: 'Delete this violation record? If it is the student’s last violation, they will be cleared from the active violations list.',
          confirmLabel: 'Delete',
          onConfirm: async () => {
            const res = await window.AppStorage.deleteComplaint(cid);
            if (res.success) {
              showToast('Violation deleted.', 'success');
              if (res.studentDeleted) closeViolationDetailModal();
              else openViolationDetailModal(studentId);
              await refreshViolationsModule();
              await updateHomeStats();
            }
          }
        });
      });
    });

    document.getElementById('student-detail-modal').classList.add('open');
  }

  function closeViolationDetailModal() {
    document.getElementById('student-detail-modal').classList.remove('open');
    state.activeStudentDetailId = null;
  }

  async function renderViolationMasterSheet() {
    const students = await window.AppStorage.getStudentsWithStats();
    const complaints = await window.AppStorage.getComplaints();
    document.getElementById('stat-total-students').textContent = students.length;
    document.getElementById('stat-total-complaints').textContent = complaints.length;

    const tbody = document.getElementById('master-table-body');
    const empty = document.getElementById('master-empty');

    if (complaints.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';

    let rowsHtml = '';
    let counter = 1;
    const isGrouped = ['severity', 'complaints', 'name', 'class'].includes(state.sortBy);

    if (isGrouped) {
      const sorted = [...students].sort((a, b) => {
        let d = 0;
        if (state.sortBy === 'severity') d = b.severityScore - a.severityScore;
        else if (state.sortBy === 'complaints') d = b.totalComplaints - a.totalComplaints;
        else if (state.sortBy === 'name') d = a.name.localeCompare(b.name);
        else if (state.sortBy === 'class') d = getClassOrderIndex(a.classId) - getClassOrderIndex(b.classId);
        return state.sortAscending ? -d : d;
      });
      sorted.forEach((s) => {
        rowsHtml += `
          <tr class="student-group-row">
            <td colspan="7"><strong>${escapeHTML(s.name)}</strong> (${escapeHTML(s.className)}) — ${s.totalComplaints} violations | Score: ${s.severityScore}/${window.AppStorage.MAX_SCORE} (${s.statusLabel})</td>
          </tr>
        `;
        s.complaints.forEach((c) => {
          rowsHtml += `
            <tr>
              <td>${counter++}</td>
              <td><strong>${escapeHTML(s.name)}</strong></td>
              <td>${escapeHTML(s.className)}</td>
              <td class="complaint-cell" dir="auto">${escapeHTML(c.text)}</td>
              <td><span class="sev-chip sev-chip-${c.severity.toLowerCase()}">${escapeHTML(c.severity)}</span></td>
              <td>${formatDateOnly(c.createdAt)}</td>
              <td>${formatTimeOnly(c.createdAt)}</td>
            </tr>
          `;
        });
      });
    } else {
      const roster = await window.AppStorage.getAllRosterStudents();
      const map = new Map(roster.map((s) => [s.id, s]));
      const sorted = [...complaints].sort((a, b) => {
        const d = new Date(b.createdAt) - new Date(a.createdAt);
        return state.sortAscending ? -d : d;
      });
      sorted.forEach((c) => {
        const s = map.get(c.studentId) || { name: 'Unknown', classId: '-' };
        rowsHtml += `
          <tr>
            <td>${counter++}</td>
            <td><strong>${escapeHTML(s.name)}</strong></td>
            <td>${escapeHTML(window.AppStorage.getClassLabel(s.classId))}</td>
            <td class="complaint-cell" dir="auto">${escapeHTML(c.text)}</td>
            <td><span class="sev-chip sev-chip-${c.severity.toLowerCase()}">${escapeHTML(c.severity)}</span></td>
            <td>${formatDateOnly(c.createdAt)}</td>
            <td>${formatTimeOnly(c.createdAt)}</td>
          </tr>
        `;
      });
    }
    tbody.innerHTML = rowsHtml;
  }

  /* ========================================================================
     MODULE 2: Homework & Pending Tasks
     ======================================================================== */
  function startLiveClock() {
    const updateClock = () => {
      const now = new Date();
      const dayName = now.toLocaleDateString(undefined, { weekday: 'long' });
      const dateStr = now.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const txt = `${dayName} • ${dateStr} • ${timeStr}`;
      const el1 = document.getElementById('hw-live-datetime');
      const el2 = document.getElementById('hw-form-readonly-dt');
      if (el1) el1.textContent = txt;
      if (el2) el2.textContent = txt;
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  async function populateHwFormSubjects(classId, preselectSubject = null) {
    const subjects = await window.AppStorage.getSubjects(classId);
    const sel = document.getElementById('hw-select-subject');
    sel.innerHTML = subjects.map((s) => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('');
    if (preselectSubject && subjects.includes(preselectSubject)) {
      sel.value = preselectSubject;
    }
  }

  async function refreshKnownTeachersDatalist() {
    const teachers = await window.AppStorage.getKnownTeachers();
    document.getElementById('hw-teachers-datalist').innerHTML =
      teachers.map((t) => `<option value="${escapeHTML(t)}">`).join('');
  }

  function toggleHwFormDrawer(forceState = null, prefillClass = null, prefillSubject = null) {
    state.hwFormOpen = forceState !== null ? forceState : !state.hwFormOpen;
    const drawer = document.getElementById('hw-form-drawer');
    const pill = document.getElementById('hw-toggle-pill');
    drawer.style.display = state.hwFormOpen ? 'block' : 'none';
    pill.innerHTML = state.hwFormOpen ? 'Close Form &#9652;' : 'Open Form &#9662;';

    if (state.hwFormOpen) {
      document.getElementById('hw-create-form').style.display = 'block';
      document.getElementById('hw-marking-panel').style.display = 'none';
      const cls = prefillClass || state.hwClassId || '6th';
      document.getElementById('hw-select-class').value = cls;
      populateHwFormSubjects(cls, prefillSubject || state.hwSubject);
      refreshKnownTeachersDatalist();
      document.getElementById('hw-input-teacher').focus();
    }
  }

  async function handleHwFormProceed(e) {
    e.preventDefault();
    const classId = document.getElementById('hw-select-class').value;
    const subject = document.getElementById('hw-select-subject').value;
    const teacherName = document.getElementById('hw-input-teacher').value.trim();
    const description = document.getElementById('hw-textarea-desc').value.trim();

    if (!teacherName) { showToast('Please enter Teacher Name.', 'error'); return; }
    if (!description) { showToast('Please describe what was taught or assigned.', 'error'); return; }

    state.hwDraftMeta = { classId, subject, teacherName, description };
    const students = await window.AppStorage.getStudentsByClass(classId);

    // Default each student to hwDone: true, conceptClear: true (teachers can flip any student with 1 tap)
    state.hwDraftMarks = {};
    students.forEach((s) => {
      state.hwDraftMarks[s.id] = { hwDone: true, conceptClear: true };
    });

    document.getElementById('hw-create-form').style.display = 'none';
    document.getElementById('hw-marking-panel').style.display = 'block';
    document.getElementById('hw-marking-title').textContent =
      `Mark ${students.length} Students — ${window.AppStorage.getClassLabel(classId)} (${subject})`;
    document.getElementById('hw-marking-subtitle').textContent =
      `Teacher: ${teacherName} • "${description}"`;

    renderHwDraftRows(students);
  }

  function renderHwDraftRows(students) {
    const container = document.getElementById('hw-marking-rows');
    container.innerHTML = students.map((s) => {
      const m = state.hwDraftMarks[s.id] || { hwDone: true, conceptClear: true };
      return `
        <div class="hw-student-mark-row" data-sid="${escapeHTML(s.id)}">
          <div class="hw-stu-info">
            <div>
              <div class="hw-stu-name">${escapeHTML(s.name)}</div>
              <div class="hw-stu-meta">Roll #${escapeHTML(s.rollNumber)} &bull; ${escapeHTML(s.section)}</div>
            </div>
          </div>
          <div class="hw-stu-toggles">
            <div class="toggle-pair" role="group" aria-label="Homework Status">
              <button type="button" class="mark-toggle-btn ${m.hwDone ? 'active-tick' : ''}" data-action="hw-done">&#10003; Done</button>
              <button type="button" class="mark-toggle-btn ${!m.hwDone ? 'active-cross' : ''}" data-action="hw-cross">&#10007; Not Done</button>
            </div>
            <div class="toggle-pair" role="group" aria-label="Concept Understanding">
              <button type="button" class="mark-toggle-btn ${m.conceptClear ? 'active-clear' : ''}" data-action="concept-clear">&#128161; Clear</button>
              <button type="button" class="mark-toggle-btn ${!m.conceptClear ? 'active-unclear' : ''}" data-action="concept-unclear">&#9888; Unclear</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.hw-student-mark-row').forEach((row) => {
      const sid = row.dataset.sid;
      row.querySelectorAll('.mark-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = btn.dataset.action;
          if (act === 'hw-done') state.hwDraftMarks[sid].hwDone = true;
          else if (act === 'hw-cross') state.hwDraftMarks[sid].hwDone = false;
          else if (act === 'concept-clear') state.hwDraftMarks[sid].conceptClear = true;
          else if (act === 'concept-unclear') state.hwDraftMarks[sid].conceptClear = false;
          renderHwDraftRows(students);
        });
      });
    });
  }

  async function saveDraftHomework() {
    if (!state.hwDraftMeta) return;
    const records = {};
    Object.entries(state.hwDraftMarks).forEach(([sid, val]) => {
      records[sid] = {
        hwDone: !!val.hwDone,
        conceptClear: !!val.conceptClear,
        conceptResolved: false
      };
    });

    const hw = await window.AppStorage.addHomework({
      ...state.hwDraftMeta,
      records
    });

    const unclearCount = Object.values(records).filter((r) => !r.conceptClear).length;
    showToast(
      `Homework saved! ${unclearCount > 0 ? `${unclearCount} unclear task(s) added to Pending Tasks.` : 'All concepts clear.'}`,
      'success'
    );

    document.getElementById('hw-create-form').reset();
    state.hwDraftMeta = null;
    state.hwDraftMarks = {};
    toggleHwFormDrawer(false);
    await refreshHomeworkModule();
    await updateHomeStats();
  }

  async function refreshHomeworkModule() {
    const pending = await window.AppStorage.getPendingTasks({ includeResolved: false });
    document.getElementById('hw-pending-badge-count').textContent = pending.length;

    document.getElementById('hw-mode-browse').classList.toggle('active', state.hwMode === 'browse');
    document.getElementById('hw-mode-pending').classList.toggle('active', state.hwMode === 'pending');

    document.getElementById('hw-browse-container').style.display = state.hwMode === 'browse' ? 'block' : 'none';
    document.getElementById('hw-pending-container').style.display = state.hwMode === 'pending' ? 'block' : 'none';

    if (state.hwMode === 'browse') await renderHomeworkDrill();
    else await renderPendingTasksList();
  }

  async function renderHomeworkDrill() {
    const bc = document.getElementById('hw-breadcrumb');
    const content = document.getElementById('hw-drill-content');
    const classes = window.AppStorage.getClasses();

    // Build Breadcrumb
    let bcHtml = `<button class="crumb-btn" id="hw-bc-root">All Classes (6th–12th)</button>`;
    if (state.hwClassId) {
      bcHtml += `<span class="crumb-sep">/</span>`;
      if (state.hwSubject) {
        bcHtml += `<button class="crumb-btn" id="hw-bc-class">${escapeHTML(window.AppStorage.getClassLabel(state.hwClassId))}</button>`;
        bcHtml += `<span class="crumb-sep">/</span><span class="crumb-current">${escapeHTML(state.hwSubject)}</span>`;
      } else {
        bcHtml += `<span class="crumb-current">${escapeHTML(window.AppStorage.getClassLabel(state.hwClassId))}</span>`;
      }
    }
    bc.innerHTML = bcHtml;

    document.getElementById('hw-bc-root').onclick = () => { state.hwClassId = null; state.hwSubject = null; renderHomeworkDrill(); };
    const bcCls = document.getElementById('hw-bc-class');
    if (bcCls) bcCls.onclick = () => { state.hwSubject = null; renderHomeworkDrill(); };

    // LEVEL 0: Class Boxes (6th to 12th)
    if (!state.hwClassId) {
      const hws = await window.AppStorage.getHomeworks();
      const pending = await window.AppStorage.getPendingTasks();
      const cards = [];
      for (const c of classes) {
        const stus = await window.AppStorage.getStudentsByClass(c.id);
        const subjects = await window.AppStorage.getSubjects(c.id);
        const clsHwCount = hws.filter((h) => h.classId === c.id).length;
        const clsPending = pending.filter((p) => p.classId === c.id).length;

        cards.push(`
          <div class="drill-box" data-class-id="${c.id}" tabindex="0" role="button">
            <div class="drill-box-top">
              <div>
                <div class="drill-box-title">${escapeHTML(c.label)}</div>
                <div class="drill-box-sub">${stus.length} Students &bull; ${subjects.length} Subjects</div>
              </div>
              <span class="drill-pill ${clsPending > 0 ? 'drill-pill-amber' : 'drill-pill-blue'}">
                ${clsPending > 0 ? `${clsPending} Pending` : `${clsHwCount} HW`}
              </span>
            </div>
            <div class="drill-box-footer">
              <span>View Subjects &rarr;</span>
            </div>
          </div>
        `);
      }
      content.innerHTML = `<div class="drill-grid">${cards.join('')}</div>`;
      content.querySelectorAll('.drill-box').forEach((b) => {
        b.addEventListener('click', () => {
          state.hwClassId = b.dataset.classId;
          state.hwSubject = null;
          state.hwSectionFilter = 'ALL';
          renderHomeworkDrill();
        });
      });
      return;
    }

    // LEVEL 1: Subject Boxes inside Selected Class
    if (!state.hwSubject) {
      const subjects = await window.AppStorage.getSubjects(state.hwClassId);
      const classHws = await window.AppStorage.getHomeworks({ classId: state.hwClassId });
      const classPending = await window.AppStorage.getPendingTasks({ classId: state.hwClassId });

      let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
          <h3 style="font-size:1.1rem; font-weight:800;">${escapeHTML(window.AppStorage.getClassLabel(state.hwClassId))} — Subjects</h3>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <input type="text" id="input-add-subject" class="input-control input-sm" placeholder="New subject name..." style="min-width:170px;" />
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-subject">+ Add Subject</button>
          </div>
        </div>
        <div class="drill-grid">
      `;

      subjects.forEach((subj) => {
        const sHwCount = classHws.filter((h) => h.subject === subj).length;
        const sPendCount = classPending.filter((p) => p.subject === subj).length;
        html += `
          <div class="drill-box" data-subject="${escapeHTML(subj)}" tabindex="0" role="button">
            <div class="drill-box-top">
              <div>
                <div class="drill-box-title">${escapeHTML(subj)}</div>
                <div class="drill-box-sub">${sHwCount} Homework${sHwCount === 1 ? '' : 's'} Assigned</div>
              </div>
              ${sPendCount > 0 ? `<span class="drill-pill drill-pill-amber">${sPendCount} Unclear</span>` : `<span class="drill-pill drill-pill-green">Clear</span>`}
            </div>
            <div class="drill-box-footer">
              <span>Open Students &amp; Reports &rarr;</span>
            </div>
          </div>
        `;
      });
      html += `</div>`;
      content.innerHTML = html;

      document.getElementById('btn-add-subject').onclick = async () => {
        const inp = document.getElementById('input-add-subject');
        try {
          await window.AppStorage.addSubject(state.hwClassId, inp.value);
          showToast(`Added subject "${inp.value.trim()}"`, 'success');
          renderHomeworkDrill();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };

      content.querySelectorAll('.drill-box').forEach((b) => {
        b.addEventListener('click', () => {
          state.hwSubject = b.dataset.subject;
          renderHomeworkDrill();
        });
      });
      return;
    }

    // LEVEL 2: Student Name Boxes inside Selected Subject + Quick Add HW + Recent HW History
    const students = await window.AppStorage.getStudentsByClass(state.hwClassId);
    const subjHws = await window.AppStorage.getHomeworks({ classId: state.hwClassId, subject: state.hwSubject });

    // Optional section filter (useful for 9th Bio A/B/Computer)
    const sections = Array.from(new Set(students.map((s) => s.section).filter(Boolean)));
    const filteredStudents = state.hwSectionFilter === 'ALL'
      ? students
      : students.filter((s) => s.section === state.hwSectionFilter);

    let sectionPills = '';
    if (sections.length > 1) {
      sectionPills = `<div class="timeframe-pills" style="margin-bottom:12px;">
        <button type="button" class="tf-pill ${state.hwSectionFilter === 'ALL' ? 'active' : ''}" data-sec="ALL">All (${students.length})</button>
        ${sections.map((sec) => `<button type="button" class="tf-pill ${state.hwSectionFilter === sec ? 'active' : ''}" data-sec="${escapeHTML(sec)}">${escapeHTML(sec)}</button>`).join('')}
      </div>`;
    }

    let stuCardsHtml = '';
    for (const s of filteredStudents) {
      const report = await window.AppStorage.getStudentHomeworkReport(s.id, state.hwSubject, { range: '30d' });
      const pct = report && report.percentage !== null ? `${report.percentage}% (${report.doneCount}/${report.totalMarked})` : 'No HW Yet';
      const pillClass = report && report.percentage !== null
        ? (report.percentage >= 75 ? 'drill-pill-green' : report.percentage >= 50 ? 'drill-pill-amber' : 'drill-pill-red')
        : '';

      stuCardsHtml += `
        <div class="drill-box hw-stu-card" data-sid="${escapeHTML(s.id)}" tabindex="0" role="button">
          <div class="drill-box-top">
            <div>
              <div class="drill-box-title">${escapeHTML(s.name)}</div>
              <div class="drill-box-sub">Roll #${escapeHTML(s.rollNumber)} &bull; ${escapeHTML(s.section)}</div>
            </div>
            <span class="drill-pill ${pillClass}">${pct}</span>
          </div>
          <div class="drill-box-footer">
            <span>${report && report.conceptUnclearActive > 0 ? `<strong style="color:#d97706;">${report.conceptUnclearActive} Pending Task(s)</strong>` : 'View Student Report'}</span>
            <span>&rarr;</span>
          </div>
        </div>
      `;
    }

    const recentHwHtml = subjHws.length === 0 ? '' : `
      <div class="dossier-section-card" style="margin-top:20px;">
        <div class="dossier-section-title">
          <span>Assigned Homeworks History (${subjHws.length})</span>
        </div>
        <div class="history-list">
          ${subjHws.map((h) => {
            const recs = Object.values(h.records || {});
            const done = recs.filter((r) => r.hwDone).length;
            const unclear = recs.filter((r) => !r.conceptClear && !r.conceptResolved).length;
            return `
              <div class="history-card">
                <div class="history-card-header">
                  <strong>Teacher: ${escapeHTML(h.teacherName)}</strong>
                  <span class="history-time">${escapeHTML(h.dayName)}, ${formatDateTime(h.createdAt)}</span>
                </div>
                <div class="history-text" dir="auto">${escapeHTML(h.description)}</div>
                <div class="history-footer" style="justify-content:space-between; align-items:center;">
                  <span style="font-size:0.78rem; color:var(--text-muted);">Done: ${done}/${recs.length} &bull; Active Unclear: ${unclear}</span>
                  <button class="btn btn-outline btn-sm btn-danger btn-del-hw" data-hwid="${escapeHTML(h.id)}">Delete</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    content.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
        <h3 style="font-size:1.1rem; font-weight:800;">${escapeHTML(window.AppStorage.getClassLabel(state.hwClassId))} &mdash; ${escapeHTML(state.hwSubject)} Students</h3>
        <button type="button" class="btn btn-primary btn-sm" id="btn-quick-add-subj-hw">+ Add Homework for ${escapeHTML(state.hwSubject)}</button>
      </div>
      ${sectionPills}
      <div class="drill-grid">${stuCardsHtml}</div>
      ${recentHwHtml}
    `;

    document.getElementById('btn-quick-add-subj-hw').onclick = () => {
      toggleHwFormDrawer(true, state.hwClassId, state.hwSubject);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    content.querySelectorAll('[data-sec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.hwSectionFilter = btn.dataset.sec;
        renderHomeworkDrill();
      });
    });

    content.querySelectorAll('.hw-stu-card').forEach((card) => {
      card.addEventListener('click', () => openHwStudentReportModal(card.dataset.sid));
    });

    content.querySelectorAll('.btn-del-hw').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hwid = btn.dataset.hwid;
        openConfirmDialog({
          title: 'Delete Homework Entry',
          message: 'Delete this homework record and its student marks?',
          confirmLabel: 'Delete',
          onConfirm: async () => {
            await window.AppStorage.deleteHomework(hwid);
            showToast('Homework entry deleted.', 'success');
            await refreshHomeworkModule();
            await updateHomeStats();
          }
        });
      });
    });
  }

  /* Student Subject Homework Report Modal (with 1d, 7d, 1m, all, custom selector) */
  async function openHwStudentReportModal(studentId) {
    state.hwModalStudentId = studentId;
    document.getElementById('hw-student-report-modal').classList.add('open');
    await renderHwStudentReportBody();
  }

  async function renderHwStudentReportBody() {
    const sid = state.hwModalStudentId;
    if (!sid) return;

    const report = await window.AppStorage.getStudentHomeworkReport(sid, state.hwSubject, {
      range: state.hwModalRange,
      customStart: state.hwModalCustomStart,
      customEnd: state.hwModalCustomEnd
    });
    if (!report) return;

    const s = report.student;
    document.getElementById('hw-modal-student-name').textContent = `${s.name} — ${state.hwSubject}`;
    document.getElementById('hw-modal-student-meta').textContent = `${window.AppStorage.getClassLabel(s.classId)} • Roll #${s.rollNumber} • ${s.section}`;

    const body = document.getElementById('hw-modal-report-body');
    const pctText = report.percentage !== null ? `${report.percentage}%` : 'N/A';
    const mark10Text = report.markingScore10 !== null ? `${report.markingScore10} / 10` : 'N/A';

    // Pending tasks for this student + subject (all time so unclear tasks never get lost)
    const pendingList = await window.AppStorage.getPendingTasks({
      studentId: sid,
      subject: state.hwSubject,
      includeResolved: false
    });

    const pendingHtml = pendingList.length === 0
      ? `<p style="font-size:0.85rem; color:var(--emerald); font-weight:600;">No pending unclear concepts in ${escapeHTML(state.hwSubject)}.</p>`
      : `<div class="pending-tasks-list">
          ${pendingList.map((pt) => `
            <div class="pending-task-card">
              <div class="pending-top">
                <div>
                  <strong>${escapeHTML(pt.subject)}</strong> &bull; <small>${formatDateOnly(pt.createdAt)} (${pt.dayName})</small>
                  <div style="font-size:0.82rem; color:var(--text-muted);">Teacher: ${escapeHTML(pt.teacherName)}</div>
                </div>
                <button type="button" class="btn btn-success btn-sm btn-resolve-modal-pt" data-hwid="${escapeHTML(pt.homeworkId)}">&#10003; Mark Cleared</button>
              </div>
              <div dir="auto" style="font-family:var(--font-urdu); font-size:0.9rem;">${escapeHTML(pt.description)}</div>
            </div>
          `).join('')}
        </div>`;

    const historyHtml = report.entries.length === 0
      ? `<p style="font-size:0.875rem; color:var(--text-muted);">No homework entries found in this selected time period.</p>`
      : `<div class="history-list">
          ${report.entries.map((e) => `
            <div class="history-card">
              <div class="history-card-header">
                <strong>${escapeHTML(e.dayName)}, ${formatDateTime(e.createdAt)}</strong>
                <div style="display:flex; gap:6px;">
                  <span class="drill-pill ${e.hwDone ? 'drill-pill-green' : 'drill-pill-red'}">${e.hwDone ? '&#10003; HW Done' : '&#10007; Not Done'}</span>
                  <span class="drill-pill ${e.conceptClear ? 'drill-pill-blue' : e.conceptResolved ? 'drill-pill-green' : 'drill-pill-amber'}">
                    ${e.conceptClear ? 'Concept Clear' : e.conceptResolved ? 'Cleared Later' : 'Concept Unclear'}
                  </span>
                </div>
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted);">Teacher: ${escapeHTML(e.teacherName)}</div>
              <div class="history-text" dir="auto">${escapeHTML(e.description)}</div>
            </div>
          `).join('')}
        </div>`;

    body.innerHTML = `
      <div class="dossier-kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
        <div class="kpi-box">
          <div class="kpi-label">Homework Ratio</div>
          <div class="kpi-value">${report.doneCount} / ${report.totalMarked}</div>
          <div class="kpi-sub">${pctText} Completion</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">HW Marking Score</div>
          <div class="kpi-value" style="color:var(--primary);">${mark10Text}</div>
          <div class="kpi-sub">Based on period ratio</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">Concept Status</div>
          <div class="kpi-value">${report.conceptClearCount} Clear</div>
          <div class="kpi-sub">${report.conceptUnclearActive} Unclear Pending</div>
        </div>
      </div>

      <div>
        <h4 style="font-size:0.95rem; font-weight:800; margin-bottom:8px;">Active Pending Tasks (${pendingList.length})</h4>
        ${pendingHtml}
      </div>

      <div>
        <h4 style="font-size:0.95rem; font-weight:800; margin-bottom:8px;">Homework Log (${report.entries.length})</h4>
        ${historyHtml}
      </div>
    `;

    body.querySelectorAll('.btn-resolve-modal-pt').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.AppStorage.resolvePendingTask(btn.dataset.hwid, sid);
        showToast('Concept marked as Cleared!', 'success');
        await renderHwStudentReportBody();
        await refreshHomeworkModule();
        await updateHomeStats();
      });
    });
  }

  /* Pending Tasks Tab Renderer */
  async function renderPendingTasksList() {
    const search = document.getElementById('pending-search-input').value.trim().toLowerCase();
    const clsFilter = document.getElementById('pending-filter-class').value;
    const statusFilter = document.getElementById('pending-filter-status').value;

    let tasks = await window.AppStorage.getPendingTasks({
      classId: clsFilter === 'ALL' ? null : clsFilter,
      includeResolved: statusFilter === 'all'
    });

    if (search) {
      tasks = tasks.filter((t) =>
        t.studentName.toLowerCase().includes(search) ||
        t.subject.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search)
      );
    }

    const listEl = document.getElementById('pending-tasks-list');
    if (tasks.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <h3>No Pending Tasks!</h3>
          <p>All students' unclear concept tasks are resolved or none match your filter.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = tasks.map((t) => `
      <div class="pending-task-card ${t.conceptResolved ? 'resolved' : ''}">
        <div class="pending-top">
          <div>
            <strong style="font-size:1rem;">${escapeHTML(t.studentName)}</strong>
            <span class="drill-pill drill-pill-blue" style="margin-left:6px;">${escapeHTML(window.AppStorage.getClassLabel(t.classId))} &bull; #${escapeHTML(t.rollNumber)}</span>
            <span class="drill-pill" style="margin-left:4px;">${escapeHTML(t.subject)}</span>
          </div>
          ${t.conceptResolved
            ? `<button type="button" class="btn btn-outline btn-sm btn-reopen-pt" data-hwid="${escapeHTML(t.homeworkId)}" data-sid="${escapeHTML(t.studentId)}">Cleared ✓ (Undo)</button>`
            : `<button type="button" class="btn btn-success btn-sm btn-resolve-pt" data-hwid="${escapeHTML(t.homeworkId)}" data-sid="${escapeHTML(t.studentId)}">&#10003; Mark Cleared</button>`
          }
        </div>
        <div dir="auto" style="font-family:var(--font-urdu); font-size:0.95rem;">${escapeHTML(t.description)}</div>
        <div style="font-size:0.78rem; color:var(--text-muted);">
          Teacher: ${escapeHTML(t.teacherName)} &bull; Assigned: ${escapeHTML(t.dayName)}, ${formatDateTime(t.createdAt)}
          ${t.conceptResolved && t.resolvedAt ? ` &bull; Cleared: ${formatDateTime(t.resolvedAt)}` : ''}
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.btn-resolve-pt').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.AppStorage.resolvePendingTask(btn.dataset.hwid, btn.dataset.sid);
        showToast('Pending concept task marked as Cleared!', 'success');
        await refreshHomeworkModule();
        await updateHomeStats();
      });
    });

    listEl.querySelectorAll('.btn-reopen-pt').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.AppStorage.reopenPendingTask(btn.dataset.hwid, btn.dataset.sid);
        showToast('Task moved back to Pending.', 'info');
        await refreshHomeworkModule();
        await updateHomeStats();
      });
    });
  }

  /* ========================================================================
     MODULE 3: Monthly Tests & Marks
     ======================================================================== */
  async function refreshTestsModule() {
    const bc = document.getElementById('tests-breadcrumb');
    const content = document.getElementById('tests-drill-content');
    const createBar = document.getElementById('tests-create-bar');

    // Only show "+ Create New Monthly Test" bar at top level
    createBar.style.display = state.testId ? 'none' : 'block';

    const tests = await window.AppStorage.getTests();
    const activeTest = state.testId ? tests.find((t) => t.id === state.testId) : null;
    if (state.testId && !activeTest) { state.testId = null; state.testClassId = null; state.testSubject = null; }

    // Breadcrumb
    let bcHtml = `<button class="crumb-btn" id="test-bc-root">All Monthly Tests</button>`;
    if (activeTest) {
      bcHtml += `<span class="crumb-sep">/</span>`;
      if (state.testClassId) {
        bcHtml += `<button class="crumb-btn" id="test-bc-test">${escapeHTML(activeTest.name)}</button>`;
        bcHtml += `<span class="crumb-sep">/</span>`;
        if (state.testSubject) {
          bcHtml += `<button class="crumb-btn" id="test-bc-class">${escapeHTML(window.AppStorage.getClassLabel(state.testClassId))}</button>`;
          bcHtml += `<span class="crumb-sep">/</span><span class="crumb-current">${escapeHTML(state.testSubject)}</span>`;
        } else {
          bcHtml += `<span class="crumb-current">${escapeHTML(window.AppStorage.getClassLabel(state.testClassId))}</span>`;
        }
      } else {
        bcHtml += `<span class="crumb-current">${escapeHTML(activeTest.name)}</span>`;
      }
    }
    bc.innerHTML = bcHtml;

    document.getElementById('test-bc-root').onclick = () => { state.testId = null; state.testClassId = null; state.testSubject = null; refreshTestsModule(); };
    const bTest = document.getElementById('test-bc-test');
    if (bTest) bTest.onclick = () => { state.testClassId = null; state.testSubject = null; refreshTestsModule(); };
    const bCls = document.getElementById('test-bc-class');
    if (bCls) bCls.onclick = () => { state.testSubject = null; refreshTestsModule(); };

    // LEVEL 0: Monthly Test Boxes List
    if (!activeTest) {
      if (tests.length === 0) {
        content.innerHTML = `
          <div class="empty-state">
            <h3>No Monthly Tests Created Yet</h3>
            <p>Tap the "+ Create New Monthly Test Box" button above, type a name (like "November Test"), and press Enter.</p>
          </div>
        `;
        return;
      }

      content.innerHTML = `
        <div class="drill-grid">
          ${tests.map((t) => {
            const gradedSubjectsCount = t.marks ? Object.keys(t.marks).length : 0;
            return `
              <div class="drill-box test-box-card" data-tid="${escapeHTML(t.id)}" tabindex="0" role="button">
                <div class="drill-box-top">
                  <div>
                    <div class="drill-box-title">${escapeHTML(t.name)}</div>
                    <div class="drill-box-sub">Created: ${formatDateOnly(t.createdAt)} &bull; Default Max: ${t.defaultTotalMarks}</div>
                  </div>
                  <span class="drill-pill drill-pill-green">${gradedSubjectsCount} Subjects Graded</span>
                </div>
                <div class="drill-box-footer">
                  <span>Open Classes (6th–2nd Year) &rarr;</span>
                  <button type="button" class="btn btn-outline btn-sm btn-danger btn-del-test" data-tid="${escapeHTML(t.id)}" onclick="event.stopPropagation();">Delete</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      content.querySelectorAll('.test-box-card').forEach((card) => {
        card.addEventListener('click', () => {
          state.testId = card.dataset.tid;
          state.testClassId = null;
          state.testSubject = null;
          refreshTestsModule();
        });
      });

      content.querySelectorAll('.btn-del-test').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tid = btn.dataset.tid;
          openConfirmDialog({
            title: 'Delete Monthly Test',
            message: 'Are you sure you want to delete this Monthly Test and all marks entered inside it?',
            confirmLabel: 'Delete Test',
            onConfirm: async () => {
              await window.AppStorage.deleteTest(tid);
              showToast('Monthly test deleted.', 'success');
              await refreshTestsModule();
              await updateHomeStats();
            }
          });
        });
      });
      return;
    }

    // LEVEL 1: Classes 6th to 12th (2nd Year) inside Selected Test
    if (!state.testClassId) {
      const classes = window.AppStorage.getClasses();
      const cards = [];
      for (const c of classes) {
        const stus = await window.AppStorage.getStudentsByClass(c.id);
        const subjects = await window.AppStorage.getSubjects(c.id);
        let gradedSubjs = 0;
        if (activeTest.marks) {
          gradedSubjs = Object.keys(activeTest.marks).filter((k) => k.startsWith(c.id + '|')).length;
        }
        cards.push(`
          <div class="drill-box" data-cid="${c.id}" tabindex="0" role="button">
            <div class="drill-box-top">
              <div>
                <div class="drill-box-title">${escapeHTML(c.label)}</div>
                <div class="drill-box-sub">${stus.length} Students &bull; ${subjects.length} Subjects</div>
              </div>
              <span class="drill-pill ${gradedSubjs > 0 ? 'drill-pill-green' : ''}">${gradedSubjs} / ${subjects.length} Graded</span>
            </div>
            <div class="drill-box-footer">
              <span>Open Class Subjects &rarr;</span>
            </div>
          </div>
        `);
      }
      content.innerHTML = `<div class="drill-grid">${cards.join('')}</div>`;
      content.querySelectorAll('.drill-box').forEach((b) => {
        b.addEventListener('click', () => {
          state.testClassId = b.dataset.cid;
          state.testSubject = null;
          state.testSectionFilter = 'ALL';
          refreshTestsModule();
        });
      });
      return;
    }

    // LEVEL 2: Subjects inside Selected Class
    if (!state.testSubject) {
      const subjects = await window.AppStorage.getSubjects(state.testClassId);
      const classStudents = await window.AppStorage.getStudentsByClass(state.testClassId);

      content.innerHTML = `
        <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:12px;">
          ${escapeHTML(activeTest.name)} &mdash; ${escapeHTML(window.AppStorage.getClassLabel(state.testClassId))} Subjects
        </h3>
        <div class="drill-grid">
          ${subjects.map((subj) => {
            const key = `${state.testClassId}|${subj}`;
            const marksMap = (activeTest.marks && activeTest.marks[key]) || {};
            const gradedCount = Object.values(marksMap).filter((v) => v !== '' && v !== null && v !== undefined).length;
            const totalMarks = (activeTest.subjectTotals && activeTest.subjectTotals[key]) || activeTest.defaultTotalMarks || 100;
            return `
              <div class="drill-box" data-subject="${escapeHTML(subj)}" tabindex="0" role="button">
                <div class="drill-box-top">
                  <div>
                    <div class="drill-box-title">${escapeHTML(subj)}</div>
                    <div class="drill-box-sub">Total Marks: ${totalMarks}</div>
                  </div>
                  <span class="drill-pill ${gradedCount > 0 ? 'drill-pill-green' : ''}">${gradedCount} / ${classStudents.length} Graded</span>
                </div>
                <div class="drill-box-footer">
                  <span>Enter Student Marks &rarr;</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      content.querySelectorAll('.drill-box').forEach((b) => {
        b.addEventListener('click', () => {
          state.testSubject = b.dataset.subject;
          refreshTestsModule();
        });
      });
      return;
    }

    // LEVEL 3: Student Marks Entry Sheet for Selected Subject
    const students = await window.AppStorage.getStudentsByClass(state.testClassId);
    const key = `${state.testClassId}|${state.testSubject}`;
    const existingMarks = (activeTest.marks && activeTest.marks[key]) || {};
    const existingTotal = (activeTest.subjectTotals && activeTest.subjectTotals[key]) || activeTest.defaultTotalMarks || 100;
    const existingDate = (activeTest.subjectDates && activeTest.subjectDates[key]) || new Date().toISOString().slice(0, 10);

    const sections = Array.from(new Set(students.map((s) => s.section).filter(Boolean)));
    const filteredStudents = state.testSectionFilter === 'ALL'
      ? students
      : students.filter((s) => s.section === state.testSectionFilter);

    let secPills = '';
    if (sections.length > 1) {
      secPills = `<div class="timeframe-pills" style="margin-bottom:12px;">
        <button type="button" class="tf-pill ${state.testSectionFilter === 'ALL' ? 'active' : ''}" data-sec="ALL">All (${students.length})</button>
        ${sections.map((sec) => `<button type="button" class="tf-pill ${state.testSectionFilter === sec ? 'active' : ''}" data-sec="${escapeHTML(sec)}">${escapeHTML(sec)}</button>`).join('')}
      </div>`;
    }

    content.innerHTML = `
      <div class="marks-sheet-card">
        <div class="marks-sheet-header">
          <div>
            <h3 style="font-size:1.15rem; font-weight:800;">${escapeHTML(state.testSubject)} — ${escapeHTML(window.AppStorage.getClassLabel(state.testClassId))}</h3>
            <p style="font-size:0.82rem; color:var(--text-muted);">${escapeHTML(activeTest.name)} &bull; Enter obtained marks for each student</p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
            <div>
              <label style="font-size:0.75rem; font-weight:700; display:block;">Total Marks</label>
              <input type="number" id="input-subj-total-marks" class="input-control input-sm" value="${existingTotal}" min="1" style="width:95px;" />
            </div>
            <div>
              <label style="font-size:0.75rem; font-weight:700; display:block;">Test Date</label>
              <input type="date" id="input-subj-test-date" class="input-control input-sm" value="${existingDate}" />
            </div>
          </div>
        </div>
        ${secPills}
        <div id="marks-entry-list">
          ${filteredStudents.map((s) => {
            const val = existingMarks[s.id] !== undefined && existingMarks[s.id] !== null ? existingMarks[s.id] : '';
            const pct = val !== '' && existingTotal > 0 ? Math.round((Number(val) / existingTotal) * 100) : null;
            return `
              <div class="marks-entry-row">
                <div>
                  <div class="hw-stu-name">${escapeHTML(s.name)}</div>
                  <div class="hw-stu-meta">Roll #${escapeHTML(s.rollNumber)} &bull; ${escapeHTML(s.section)}</div>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  inputmode="decimal"
                  class="marks-num-input"
                  data-sid="${escapeHTML(s.id)}"
                  value="${val}"
                  placeholder="Marks"
                />
                <span class="drill-pill marks-pct-badge" id="pct-${escapeHTML(s.id)}" style="min-width:64px; text-align:center;">
                  ${pct !== null ? `${pct}% (${getGradeLabel(pct)})` : '-'}
                </span>
              </div>
            `;
          }).join('')}
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:16px; gap:10px;">
          <button type="button" class="btn btn-primary" id="btn-save-subject-marks">Save ${escapeHTML(state.testSubject)} Marks</button>
        </div>
      </div>
    `;

    const totalInp = document.getElementById('input-subj-total-marks');
    const updatePctBadges = () => {
      const tot = Number(totalInp.value) || 100;
      content.querySelectorAll('.marks-num-input').forEach((inp) => {
        const sid = inp.dataset.sid;
        const badge = document.getElementById(`pct-${sid}`);
        if (inp.value === '') {
          badge.textContent = '-';
          badge.className = 'drill-pill marks-pct-badge';
        } else {
          const pct = Math.round((Number(inp.value) / tot) * 100);
          badge.textContent = `${pct}% (${getGradeLabel(pct)})`;
          badge.className = `drill-pill marks-pct-badge ${pct >= 50 ? 'drill-pill-green' : 'drill-pill-red'}`;
        }
      });
    };

    totalInp.addEventListener('input', updatePctBadges);
    content.querySelectorAll('.marks-num-input').forEach((inp) => {
      inp.addEventListener('input', updatePctBadges);
    });

    content.querySelectorAll('[data-sec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.testSectionFilter = btn.dataset.sec;
        refreshTestsModule();
      });
    });

    document.getElementById('btn-save-subject-marks').onclick = async () => {
      const total = Number(totalInp.value) || 100;
      const dateVal = document.getElementById('input-subj-test-date').value;
      const mergedMarks = { ...existingMarks };

      content.querySelectorAll('.marks-num-input').forEach((inp) => {
        const sid = inp.dataset.sid;
        if (inp.value === '') {
          delete mergedMarks[sid];
        } else {
          mergedMarks[sid] = Number(inp.value);
        }
      });

      await window.AppStorage.saveSubjectTestMarks(activeTest.id, state.testClassId, state.testSubject, total, mergedMarks, dateVal);
      showToast(`Saved marks for ${state.testSubject} (${window.AppStorage.getClassLabel(state.testClassId)})!`, 'success');
      refreshTestsModule();
    };
  }

  /* ========================================================================
     MODULE 4: Grand Report (Classes -> Students -> Complete Dossier)
     ======================================================================== */
  async function refreshGrandReportModule() {
    const bc = document.getElementById('grand-breadcrumb');
    const content = document.getElementById('grand-drill-content');

    let bcHtml = `<button class="crumb-btn" id="grand-bc-root">All Classes (6th–12th)</button>`;
    if (state.grandClassId) {
      bcHtml += `<span class="crumb-sep">/</span>`;
      if (state.grandStudentId) {
        const stu = await window.AppStorage.getStudentById(state.grandStudentId);
        bcHtml += `<button class="crumb-btn" id="grand-bc-class">${escapeHTML(window.AppStorage.getClassLabel(state.grandClassId))}</button>`;
        bcHtml += `<span class="crumb-sep">/</span><span class="crumb-current">${escapeHTML(stu ? stu.name : 'Student')}</span>`;
      } else {
        bcHtml += `<span class="crumb-current">${escapeHTML(window.AppStorage.getClassLabel(state.grandClassId))}</span>`;
      }
    }
    bc.innerHTML = bcHtml;

    document.getElementById('grand-bc-root').onclick = () => { state.grandClassId = null; state.grandStudentId = null; refreshGrandReportModule(); };
    const bCls = document.getElementById('grand-bc-class');
    if (bCls) bCls.onclick = () => { state.grandStudentId = null; refreshGrandReportModule(); };

    // LEVEL 0: All Class Boxes
    if (!state.grandClassId) {
      const classes = window.AppStorage.getClasses();
      const allComplaints = await window.AppStorage.getComplaints();
      const allPending = await window.AppStorage.getPendingTasks();

      const cards = [];
      for (const c of classes) {
        const stus = await window.AppStorage.getStudentsByClass(c.id);
        const stuIds = new Set(stus.map((s) => s.id));
        const clsViolations = allComplaints.filter((v) => stuIds.has(v.studentId)).length;
        const clsPending = allPending.filter((p) => p.classId === c.id).length;

        cards.push(`
          <div class="drill-box" data-cid="${c.id}" tabindex="0" role="button">
            <div class="drill-box-top">
              <div>
                <div class="drill-box-title">${escapeHTML(c.label)}</div>
                <div class="drill-box-sub">${stus.length} Active Students</div>
              </div>
              <span class="drill-pill drill-pill-blue">${c.badge || ''}</span>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <span class="drill-pill ${clsViolations > 0 ? 'drill-pill-red' : ''}">${clsViolations} Violations</span>
              <span class="drill-pill ${clsPending > 0 ? 'drill-pill-amber' : ''}">${clsPending} Pending Tasks</span>
            </div>
            <div class="drill-box-footer">
              <span>View Student List &rarr;</span>
            </div>
          </div>
        `);
      }
      content.innerHTML = `<div class="drill-grid">${cards.join('')}</div>`;
      content.querySelectorAll('.drill-box').forEach((b) => {
        b.addEventListener('click', () => {
          state.grandClassId = b.dataset.cid;
          state.grandStudentId = null;
          state.grandSearch = '';
          state.grandSectionFilter = 'ALL';
          refreshGrandReportModule();
        });
      });
      return;
    }

    // LEVEL 1: All Student Name Boxes of Selected Class
    if (!state.grandStudentId) {
      const students = await window.AppStorage.getStudentsByClass(state.grandClassId);
      const allComplaints = await window.AppStorage.getComplaints();
      const allPending = await window.AppStorage.getPendingTasks({ classId: state.grandClassId });

      const sections = Array.from(new Set(students.map((s) => s.section).filter(Boolean)));
      let filtered = state.grandSectionFilter === 'ALL'
        ? students
        : students.filter((s) => s.section === state.grandSectionFilter);

      const q = state.grandSearch.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter((s) =>
          s.name.toLowerCase().includes(q) || (s.rollNumber && s.rollNumber.toString().includes(q)) || (s.family && s.family.toLowerCase().includes(q))
        );
      }

      let secHtml = '';
      if (sections.length > 1) {
        secHtml = `<div class="timeframe-pills" style="margin-bottom:12px;">
          <button type="button" class="tf-pill ${state.grandSectionFilter === 'ALL' ? 'active' : ''}" data-sec="ALL">All (${students.length})</button>
          ${sections.map((sec) => `<button type="button" class="tf-pill ${state.grandSectionFilter === sec ? 'active' : ''}" data-sec="${escapeHTML(sec)}">${escapeHTML(sec)}</button>`).join('')}
        </div>`;
      }

      const stuCards = filtered.map((s) => {
        const vCount = allComplaints.filter((c) => c.studentId === s.id).length;
        const pCount = allPending.filter((p) => p.studentId === s.id).length;
        return `
          <div class="drill-box grand-stu-card" data-sid="${escapeHTML(s.id)}" tabindex="0" role="button">
            <div class="drill-box-top">
              <div>
                <div class="drill-box-title">${escapeHTML(s.name)}</div>
                <div class="drill-box-sub">Roll #${escapeHTML(s.rollNumber)} &bull; ${escapeHTML(s.section)} &bull; S/O ${escapeHTML(s.family)}</div>
              </div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <span class="drill-pill ${vCount > 0 ? 'drill-pill-red' : 'drill-pill-green'}">${vCount} Violations</span>
              <span class="drill-pill ${pCount > 0 ? 'drill-pill-amber' : 'drill-pill-blue'}">${pCount} Pending</span>
            </div>
            <div class="drill-box-footer">
              <span>Open Full Grand Report &rarr;</span>
            </div>
          </div>
        `;
      }).join('');

      content.innerHTML = `
        <div style="margin-bottom:12px;">
          <div class="search-box">
            <span class="search-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
            <input type="search" id="grand-student-search" class="search-input" value="${escapeHTML(state.grandSearch)}" placeholder="Search student name, roll #, or father name..." />
          </div>
        </div>
        ${secHtml}
        <div class="drill-grid">${stuCards}</div>
      `;

      const searchInp = document.getElementById('grand-student-search');
      searchInp.addEventListener('input', (e) => {
        state.grandSearch = e.target.value;
        refreshGrandReportModule();
        // Keep focus on search after re-render
        setTimeout(() => {
          const el = document.getElementById('grand-student-search');
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }, 0);
      });

      content.querySelectorAll('[data-sec]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.grandSectionFilter = btn.dataset.sec;
          refreshGrandReportModule();
        });
      });

      content.querySelectorAll('.grand-stu-card').forEach((card) => {
        card.addEventListener('click', () => {
          state.grandStudentId = card.dataset.sid;
          refreshGrandReportModule();
        });
      });
      return;
    }

    // LEVEL 2: COMPLETE STUDENT GRAND REPORT (Everything of the student!)
    const dossier = await window.AppStorage.getStudentGrandReport(state.grandStudentId, { range: state.grandHwRange });
    if (!dossier) return;

    const s = dossier.student;
    const hw = dossier.homework;
    const viol = dossier.violations;
    const tst = dossier.tests;

    const hwPct = hw.overall && hw.overall.percentage !== null ? `${hw.overall.percentage}%` : 'No Data';
    const hwRatio = hw.overall ? `${hw.overall.doneCount} / ${hw.overall.totalMarked}` : '0 / 0';
    const testPct = tst.overallPercent !== null ? `${tst.overallPercent}% (${getGradeLabel(tst.overallPercent)})` : 'No Tests';

    // WhatsApp message formatter
    const cleanPhoneForWa = (num) => {
      if (!num || num === '-' || num === '—') return '';
      let p = num.replace(/[^\d+]/g, '');
      if (p.startsWith('03')) p = '92' + p.slice(1);
      else if (p.startsWith('+')) p = p.slice(1);
      return p;
    };
    const waNumber = cleanPhoneForWa(s.whatsapp || s.phone);
    const waSummaryText = encodeURIComponent(
      `*Hadi Education System Balkassar — Student Grand Report*\n` +
      `Student: *${s.name}* (Roll #${s.rollNumber})\n` +
      `Class: ${s.classLabel} (${s.section}) | Father: ${s.family}\n\n` +
      `• *Violations:* ${viol.total} (Score: ${viol.score}/${window.AppStorage.MAX_SCORE} - ${viol.statusLabel})\n` +
      `• *Homework Completion:* ${hwRatio} (${hwPct})\n` +
      `• *Pending Unclear Concepts:* ${hw.activePendingTasks.length}\n` +
      `• *Monthly Test Average:* ${testPct}`
    );

    content.innerHTML = `
      <div class="grand-dossier-container">
        
        <!-- 1. Identity & Guardian Header -->
        <div class="dossier-header-card">
          <div class="dossier-id-row">
            <div>
              <h3 class="dossier-student-name">${escapeHTML(s.name)}</h3>
              <div class="dossier-meta-tags">
                <span class="dossier-tag">${escapeHTML(s.classLabel)} &bull; Section ${escapeHTML(s.section)}</span>
                <span class="dossier-tag">Roll #${escapeHTML(s.rollNumber || '-')}</span>
                <span class="dossier-tag">Admitted: ${escapeHTML(s.admitted || '-')}</span>
              </div>
            </div>
            <div class="dossier-actions no-print">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.print()">&#128424; Print Report</button>
              ${waNumber ? `<a class="btn btn-success btn-sm" href="https://wa.me/${waNumber}?text=${waSummaryText}" target="_blank" rel="noopener">Share on WhatsApp</a>` : ''}
            </div>
          </div>
          <div class="dossier-guardian-row">
            <span>Father / Family: <strong>${escapeHTML(s.family || '-')}</strong> ${s.familyNumber ? `(${escapeHTML(s.familyNumber)})` : ''}</span>
            <span>Phone: <strong>${escapeHTML(s.phone || '-')}</strong></span>
            <span>WhatsApp: <strong>${escapeHTML(s.whatsapp || s.phone || '-')}</strong></span>
          </div>
        </div>

        <!-- 2. Overall 4 KPI Cards -->
        <div class="dossier-kpi-grid">
          <div class="kpi-box">
            <div class="kpi-label">Violation Score</div>
            <div class="kpi-value">${viol.score} / ${window.AppStorage.MAX_SCORE}</div>
            <div class="kpi-sub"><span class="status-badge ${viol.statusClass}">${viol.statusLabel}</span> (${viol.total} violations)</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Homework Marking</div>
            <div class="kpi-value" style="color:var(--primary);">${hwPct}</div>
            <div class="kpi-sub">${hwRatio} Completed</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Pending Concepts</div>
            <div class="kpi-value" style="color:${hw.activePendingTasks.length > 0 ? '#d97706' : '#059669'};">${hw.activePendingTasks.length}</div>
            <div class="kpi-sub">${hw.resolvedTasks.length} cleared previously</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Monthly Test Avg</div>
            <div class="kpi-value" style="color:var(--emerald);">${testPct}</div>
            <div class="kpi-sub">${tst.overallObtained} / ${tst.overallTotal} marks</div>
          </div>
        </div>

        <!-- 3. Section A: Homework Breakdown & Pending Tasks -->
        <div class="dossier-section-card">
          <div class="dossier-section-title">
            <span>Homework Performance &amp; Pending Tasks</span>
            <div class="timeframe-pills no-print">
              <button type="button" class="tf-pill ${state.grandHwRange === '7d' ? 'active' : ''}" data-grange="7d">7 Days</button>
              <button type="button" class="tf-pill ${state.grandHwRange === '30d' ? 'active' : ''}" data-grange="30d">1 Month</button>
              <button type="button" class="tf-pill ${state.grandHwRange === 'all' ? 'active' : ''}" data-grange="all">All Time</button>
            </div>
          </div>

          ${hw.subjectBreakdown.length === 0
            ? `<p style="font-size:0.875rem; color:var(--text-muted); margin-bottom:14px;">No homework records found for this student in the selected timeframe.</p>`
            : `<div class="table-wrapper" style="margin-bottom:16px;">
                <div class="table-scroll-container">
                  <table class="sheet-table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Done / Assigned</th>
                        <th>Completion %</th>
                        <th>Active Pending Tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${hw.subjectBreakdown.map((sb) => `
                        <tr>
                          <td><strong>${escapeHTML(sb.subject)}</strong></td>
                          <td>${sb.doneCount} / ${sb.totalMarked}</td>
                          <td><span class="drill-pill ${sb.percentage >= 75 ? 'drill-pill-green' : sb.percentage >= 50 ? 'drill-pill-amber' : 'drill-pill-red'}">${sb.percentage}%</span></td>
                          <td>${sb.pendingCount > 0 ? `<span class="drill-pill drill-pill-amber">${sb.pendingCount} Unclear</span>` : 'All Clear'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>`
          }

          <h4 style="font-size:0.95rem; font-weight:800; margin-bottom:8px;">Active Pending Tasks (Unclear Concepts: ${hw.activePendingTasks.length})</h4>
          ${hw.activePendingTasks.length === 0
            ? `<p style="font-size:0.85rem; color:var(--emerald); font-weight:600;">No pending unclear concepts!</p>`
            : `<div class="pending-tasks-list">
                ${hw.activePendingTasks.map((pt) => `
                  <div class="pending-task-card">
                    <div class="pending-top">
                      <div>
                        <strong>${escapeHTML(pt.subject)}</strong> &bull; <small>${formatDateOnly(pt.createdAt)} (${pt.dayName})</small>
                        <div style="font-size:0.8rem; color:var(--text-muted);">Teacher: ${escapeHTML(pt.teacherName)}</div>
                      </div>
                      <button type="button" class="btn btn-success btn-sm no-print btn-grand-resolve" data-hwid="${escapeHTML(pt.homeworkId)}">&#10003; Mark Cleared</button>
                    </div>
                    <div dir="auto" style="font-family:var(--font-urdu); font-size:0.9rem;">${escapeHTML(pt.description)}</div>
                  </div>
                `).join('')}
              </div>`
          }
        </div>

        <!-- 4. Section B: Monthly Test Results -->
        <div class="dossier-section-card">
          <div class="dossier-section-title">
            <span>Monthly Test Results (${tst.tests.length} Tests)</span>
          </div>
          ${tst.tests.length === 0
            ? `<p style="font-size:0.875rem; color:var(--text-muted);">No monthly test marks recorded for this student yet.</p>`
            : tst.tests.map((t) => `
                <div style="margin-bottom:16px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="font-size:0.95rem;">${escapeHTML(t.testName)}</strong>
                    <span class="drill-pill drill-pill-blue">Total: ${t.testObtained} / ${t.testTotal} (${t.testPercent}% &bull; ${getGradeLabel(t.testPercent)})</span>
                  </div>
                  <div class="table-wrapper">
                    <div class="table-scroll-container">
                      <table class="sheet-table">
                        <thead>
                          <tr>
                            <th>Subject</th>
                            <th>Obtained</th>
                            <th>Total</th>
                            <th>Percentage</th>
                            <th>Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${t.subjectScores.map((sc) => `
                            <tr>
                              <td><strong>${escapeHTML(sc.subject)}</strong></td>
                              <td>${sc.obtained}</td>
                              <td>${sc.total}</td>
                              <td>${sc.percent}%</td>
                              <td><span class="drill-pill ${sc.percent >= 50 ? 'drill-pill-green' : 'drill-pill-red'}">${getGradeLabel(sc.percent)}</span></td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              `).join('')
          }
        </div>

        <!-- 5. Section C: Violation & Discipline History -->
        <div class="dossier-section-card">
          <div class="dossier-section-title">
            <span>Violation &amp; Discipline Record (${viol.total})</span>
            <button type="button" class="btn btn-outline btn-sm no-print" id="btn-grand-add-violation">+ Log Violation</button>
          </div>
          <div class="meter-section" style="margin-bottom:14px;">
            <div class="meter-track"><div class="meter-fill-reveal" style="--meter-fill:${viol.fillPercent}%;"></div></div>
            <div class="meter-info">
              <span class="meter-score">Severity Score: ${viol.score} <span>/ ${window.AppStorage.MAX_SCORE}</span></span>
              <span class="status-badge ${viol.statusClass}">${viol.statusLabel}</span>
            </div>
          </div>
          ${viol.list.length === 0
            ? `<p style="font-size:0.875rem; color:var(--emerald); font-weight:600;">Clean discipline record — 0 violations.</p>`
            : `<div class="history-list">
                ${viol.list.map((c) => `
                  <div class="history-card">
                    <div class="history-card-header">
                      <span class="sev-chip sev-chip-${c.severity.toLowerCase()}">${escapeHTML(c.severity)}</span>
                      <span class="history-time">${formatDateTime(c.createdAt)}</span>
                    </div>
                    <div class="history-text" dir="auto">${escapeHTML(c.text)}</div>
                  </div>
                `).join('')}
              </div>`
          }
        </div>

      </div>
    `;

    content.querySelectorAll('[data-grange]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.grandHwRange = btn.dataset.grange;
        refreshGrandReportModule();
      });
    });

    content.querySelectorAll('.btn-grand-resolve').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.AppStorage.resolvePendingTask(btn.dataset.hwid, s.id);
        showToast('Pending concept task cleared!', 'success');
        refreshGrandReportModule();
        updateHomeStats();
      });
    });

    const addViolBtn = document.getElementById('btn-grand-add-violation');
    if (addViolBtn) {
      addViolBtn.onclick = () => {
        switchScreen('violations');
        switchViolationSubTab('form');
        document.getElementById('input-student-id').value = s.id;
        document.getElementById('input-student-name').value = s.name;
        document.getElementById('select-class').value = s.classId;
        document.getElementById('textarea-complaint').focus();
      };
    }
  }

  /* ========================================================================
     Import / Export Handlers
     ======================================================================== */
  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  async function handleExportCsv() {
    const csv = await window.AppStorage.exportCSV();
    downloadBlob(csv, `hadi_violations_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
    showToast('Violations CSV downloaded.', 'success');
  }

  async function handleExportBackup() {
    const data = await window.AppStorage.exportJSON();
    downloadBlob(JSON.stringify(data, null, 2), `hadi_portal_backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    showToast('Full portal JSON backup downloaded.', 'success');
  }

  function handleFileImportSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        const res = await window.AppStorage.importJSON(json);
        showToast(`Restored: ${res.complaintsCount} violations, ${res.homeworksCount} homeworks, ${res.testsCount} tests.`, 'success');
        switchScreen(state.currentScreen);
        updateHomeStats();
      } catch (err) {
        showToast('Invalid JSON backup file.', 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  /* ========================================================================
     Bind All Event Listeners
     ======================================================================== */
  function bindEvents() {
    // Brand & Back to Home
    const brand = document.getElementById('brand-home-link');
    brand.addEventListener('click', () => switchScreen('home'));
    document.querySelectorAll('.btn-back-home').forEach((b) => {
      b.addEventListener('click', () => switchScreen('home'));
    });

    // Home Curved Boxes
    document.querySelectorAll('.curved-action-card').forEach((card) => {
      card.addEventListener('click', () => switchScreen(card.dataset.target));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchScreen(card.dataset.target); }
      });
    });

    // Top Desktop Nav & Mobile Bottom Nav
    document.querySelectorAll('.desktop-nav .nav-link, .bottom-nav .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
    });

    // Global Header Actions
    document.getElementById('btn-export-csv').addEventListener('click', handleExportCsv);
    document.getElementById('btn-export-backup').addEventListener('click', handleExportBackup);
    document.getElementById('btn-import-backup').addEventListener('click', () => document.getElementById('file-import-input').click());
    document.getElementById('file-import-input').addEventListener('change', handleFileImportSelected);

    // Violations Sub-Tabs & Form
    document.querySelectorAll('#screen-violations .subtab-btn').forEach((b) => {
      b.addEventListener('click', () => switchViolationSubTab(b.dataset.vtab));
    });
    document.getElementById('btn-empty-add').addEventListener('click', () => switchViolationSubTab('form'));
    document.getElementById('btn-master-empty-add').addEventListener('click', () => switchViolationSubTab('form'));

    document.getElementById('input-student-name').addEventListener('input', handleViolationNameInput);
    document.getElementById('autocomplete-list').addEventListener('click', handleViolationAutocompletePick);
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) document.getElementById('autocomplete-list').classList.remove('show');
    });

    document.getElementById('textarea-complaint').addEventListener('input', (e) => {
      document.getElementById('char-counter').textContent = `${e.target.value.length} chars`;
      document.getElementById('val-complaint').classList.remove('visible');
      e.target.classList.remove('is-invalid');
    });
    document.getElementById('select-class').addEventListener('change', (e) => {
      document.getElementById('val-class').classList.remove('visible');
      e.target.classList.remove('is-invalid');
    });
    document.querySelectorAll('.sev-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedSeverity = btn.dataset.severity;
        document.getElementById('input-severity-value').value = btn.dataset.severity;
        document.querySelectorAll('.sev-btn').forEach((b) => {
          const match = b === btn;
          b.classList.toggle('selected', match);
          b.setAttribute('aria-checked', match ? 'true' : 'false');
        });
        document.getElementById('val-severity').classList.remove('visible');
      });
    });
    document.getElementById('complaint-form').addEventListener('submit', handleViolationSubmit);

    // Violations Filter & Sort
    document.getElementById('search-input').addEventListener('input', (e) => { state.searchQuery = e.target.value; renderViolationRecords(); });
    document.getElementById('filter-class').addEventListener('change', (e) => { state.filterClass = e.target.value; renderViolationRecords(); });
    document.getElementById('filter-severity').addEventListener('change', (e) => { state.filterSeverity = e.target.value; renderViolationRecords(); });
    document.getElementById('sort-by').addEventListener('change', (e) => { state.sortBy = e.target.value; renderViolationRecords(); renderViolationMasterSheet(); });
    document.getElementById('sort-direction-btn').addEventListener('click', () => {
      state.sortAscending = !state.sortAscending;
      document.getElementById('sort-icon-asc').style.display = state.sortAscending ? 'block' : 'none';
      document.getElementById('sort-icon-desc').style.display = state.sortAscending ? 'none' : 'block';
      renderViolationRecords();
      renderViolationMasterSheet();
    });

    // Violation Detail Modal
    document.getElementById('modal-close-btn').addEventListener('click', closeViolationDetailModal);
    document.getElementById('student-detail-modal').addEventListener('click', (e) => {
      if (e.target.id === 'student-detail-modal') closeViolationDetailModal();
    });

    // Homework Top Box & Form
    document.getElementById('hw-banner-toggle').addEventListener('click', () => toggleHwFormDrawer());
    document.getElementById('hw-btn-cancel-form').addEventListener('click', () => toggleHwFormDrawer(false));
    document.getElementById('hw-select-class').addEventListener('change', (e) => populateHwFormSubjects(e.target.value));
    document.getElementById('hw-create-form').addEventListener('submit', handleHwFormProceed);
    document.getElementById('hw-btn-back-edit').addEventListener('click', () => {
      document.getElementById('hw-marking-panel').style.display = 'none';
      document.getElementById('hw-create-form').style.display = 'block';
    });
    document.getElementById('hw-mark-all-done').addEventListener('click', async () => {
      Object.keys(state.hwDraftMarks).forEach((sid) => state.hwDraftMarks[sid].hwDone = true);
      const stus = await window.AppStorage.getStudentsByClass(state.hwDraftMeta.classId);
      renderHwDraftRows(stus);
    });
    document.getElementById('hw-mark-all-clear').addEventListener('click', async () => {
      Object.keys(state.hwDraftMarks).forEach((sid) => state.hwDraftMarks[sid].conceptClear = true);
      const stus = await window.AppStorage.getStudentsByClass(state.hwDraftMeta.classId);
      renderHwDraftRows(stus);
    });
    document.getElementById('hw-btn-save-all').addEventListener('click', saveDraftHomework);

    // Homework Mode Tabs & Pending Filters
    document.getElementById('hw-mode-browse').addEventListener('click', () => { state.hwMode = 'browse'; refreshHomeworkModule(); });
    document.getElementById('hw-mode-pending').addEventListener('click', () => { state.hwMode = 'pending'; refreshHomeworkModule(); });
    document.getElementById('pending-search-input').addEventListener('input', renderPendingTasksList);
    document.getElementById('pending-filter-class').addEventListener('change', renderPendingTasksList);
    document.getElementById('pending-filter-status').addEventListener('change', renderPendingTasksList);

    // Homework Student Report Modal Timeframe Pills
    document.getElementById('hw-modal-close-btn').addEventListener('click', () => {
      document.getElementById('hw-student-report-modal').classList.remove('open');
    });
    document.getElementById('hw-student-report-modal').addEventListener('click', (e) => {
      if (e.target.id === 'hw-student-report-modal') e.target.classList.remove('open');
    });
    document.querySelectorAll('#hw-timeframe-pills .tf-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#hw-timeframe-pills .tf-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        state.hwModalRange = pill.dataset.range;
        document.getElementById('hw-custom-range-inputs').style.display = state.hwModalRange === 'custom' ? 'flex' : 'none';
        if (state.hwModalRange !== 'custom') renderHwStudentReportBody();
      });
    });
    document.getElementById('hw-apply-custom-range').addEventListener('click', () => {
      state.hwModalCustomStart = document.getElementById('hw-custom-start').value;
      state.hwModalCustomEnd = document.getElementById('hw-custom-end').value;
      renderHwStudentReportBody();
    });

    // Monthly Tests Creation (+ button & form)
    document.getElementById('btn-show-create-test').addEventListener('click', () => {
      document.getElementById('btn-show-create-test').style.display = 'none';
      document.getElementById('create-test-form').style.display = 'flex';
      document.getElementById('input-new-test-name').focus();
    });
    document.getElementById('btn-cancel-create-test').addEventListener('click', () => {
      document.getElementById('create-test-form').style.display = 'none';
      document.getElementById('btn-show-create-test').style.display = 'flex';
    });
    document.getElementById('create-test-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-new-test-name').value.trim();
      const defTotal = document.getElementById('input-new-test-total').value;
      if (!name) { showToast('Please enter a test name.', 'error'); return; }
      await window.AppStorage.createTest({ name, defaultTotalMarks: defTotal });
      document.getElementById('create-test-form').reset();
      document.getElementById('input-new-test-total').value = '100';
      document.getElementById('create-test-form').style.display = 'none';
      document.getElementById('btn-show-create-test').style.display = 'flex';
      showToast(`Test box "${name}" created!`, 'success');
      refreshTestsModule();
      updateHomeStats();
    });

    // Confirmation Dialog
    document.getElementById('btn-confirm-cancel').addEventListener('click', closeConfirmDialog);
    document.getElementById('btn-confirm-proceed').addEventListener('click', async () => {
      const cb = state.confirmCallback;
      closeConfirmDialog();
      if (cb) await cb();
    });
    document.getElementById('confirm-modal').addEventListener('click', (e) => {
      if (e.target.id === 'confirm-modal') closeConfirmDialog();
    });
  }

  /* ========================================================================
     Initialization
     ======================================================================== */
  async function init() {
    await window.AppStorage.migrateIfNeeded();
    populateClassDropdowns();
    await populateHwFormSubjects('6th');
    startLiveClock();
    bindEvents();
    await updateHomeStats();
    switchScreen('home');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

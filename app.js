/**
 * Hadi Education System Balkassar — Main Application Controller
 * Modules: Home Dashboard | Violation Record | Homework & Pending Tasks | Classes Attendance | Prep Attendance | Monthly Tests | Grand Report
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
    hwEditingId: null,
    hwDraftMeta: null,
    hwDraftMarks: {}, // studentId -> { hwDone: true, conceptClear: true, conceptResolved?: boolean, resolvedAt?: string }
    hwModalStudentId: null,
    hwModalRange: '30d',
    hwModalCustomStart: '',
    hwModalCustomEnd: '',

    // Classes Attendance module
    caClassId: null,
    caSubject: null,
    caDate: '',
    caSectionFilter: 'ALL',
    caDraftRecords: {}, // studentId -> 'Present' | 'Absent' | 'Leave'
    caDirty: false,

    // Prep Attendance module
    paClassId: null,
    paPrepSlot: null,
    paDate: '',
    paSectionFilter: 'ALL',
    paDraftRecords: {}, // studentId -> 'Present' | 'Absent' | 'Leave'
    paDirty: false,

    // Health & Medical Records module
    healthClassId: null,
    healthStudentId: null,
    healthSearch: '',
    healthSearchComposing: false,
    healthSectionFilter: 'ALL',
    healthFormOpen: false,
    healthDirty: false,

    // Student Detail & Directory module
    stuDetailClassId: null,
    stuDetailStudentId: null,
    stuDetailSearch: '',
    stuDetailGlobalSearch: '',
    stuDetailSectionFilter: 'ALL',
    stuDetailComposing: false,
    stuFormOpen: false,
    stuFormDirty: false,

    // Monthly Tests module
    testId: null,
    testClassId: null,
    testSubject: null,
    testSectionFilter: 'ALL',
    testsDirty: false,

    // Grand Report module
    grandClassId: null,
    grandStudentId: null,
    grandSearch: '',
    grandSearchComposing: false,
    grandSectionFilter: 'ALL',
    grandHwRange: 'all',

    // Pending confirmation & modal focus restoration
    confirmCallback: null,
    confirmCancelCallback: null,
    lastFocusedElement: null,
    lastConfirmTrigger: null
  };

  const SCREEN_META = {
    home: { title: 'Home Dashboard', subtitle: 'Daily summary & quick academic workflows' },
    violations: { title: 'Violation Record', subtitle: 'Discipline logging, severity tracking & master register' },
    homework: { title: 'Homework & Pending Tasks', subtitle: 'Daily assignments, checklists & unclear concept clearance' },
    'class-attendance': { title: 'Classes Attendance', subtitle: 'Classes 6th–12th subject-wise attendance roll call' },
    'prep-attendance': { title: 'Prep Attendance', subtitle: 'Classes 6th–12th Prep 1, Prep 2 & Prep 3 attendance' },
    health: { title: 'Health & Medical Records', subtitle: 'Student medical reports, doctor/hospital visits & supervisor details' },
    'student-details': { title: 'Student Detail & Directory', subtitle: 'Complete student contacts, father details, family codes, roll numbers & profiles' },
    tests: { title: 'Monthly Tests', subtitle: 'Assessment boxes, class subjects & validated student marks' },
    'grand-report': { title: 'Grand Student Report', subtitle: 'Unified student dossier, print profile & guardian contact' }
  };

  function getFocusableElements(container) {
    if (!container) return [];
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from(container.querySelectorAll(selectors)).filter((el) => {
      if (el.hidden || el.closest('[hidden]')) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  function focusDialogInitialElement(modalEl, targetEl) {
    if (!modalEl || !targetEl) return;
    void modalEl.offsetHeight;
    try { targetEl.focus({ preventScroll: true }); } catch (e) {}
    requestAnimationFrame(() => {
      if (modalEl.classList.contains('open') && !modalEl.contains(document.activeElement)) {
        try { targetEl.focus({ preventScroll: true }); } catch (e) {}
      }
    });
  }

  function restoreTriggerFocus(el) {
    if (el && typeof el.focus === 'function' && document.contains(el)) {
      setTimeout(() => {
        try { el.focus(); } catch (e) {}
      }, 0);
    }
  }

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

  function formatPhoneForWa(num) {
    if (!num || num === '-' || num === '—') return '';
    let p = String(num).replace(/[^\d+]/g, '');
    if (p.startsWith('03')) p = '92' + p.slice(1);
    else if (p.startsWith('+')) p = p.slice(1);
    return p;
  }

  async function copyTextSafe(text, label = 'Value') {
    const clean = String(text || '').trim();
    if (!clean || clean === '-') return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(clean);
      } else {
        const tmp = document.createElement('textarea');
        tmp.value = clean;
        tmp.setAttribute('readonly', '');
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        tmp.remove();
      }
      showToast(`${label} copied: ${clean}`, 'success', 2200);
    } catch {
      showToast(`Unable to copy ${label}.`, 'error');
    }
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

  function openConfirmDialog({
    title,
    message,
    detailsHtml = '',
    confirmLabel = 'Confirm',
    confirmBtnClass = 'btn-danger',
    onConfirm,
    onCancel = null
  }) {
    state.lastConfirmTrigger = document.activeElement;
    document.getElementById('confirm-title').textContent = title || 'Confirm Action';
    document.getElementById('confirm-msg').textContent = message || 'Are you sure?';
    const detailsEl = document.getElementById('confirm-details');
    if (detailsEl) {
      if (detailsHtml) {
        detailsEl.innerHTML = detailsHtml;
        detailsEl.style.display = 'block';
      } else {
        detailsEl.innerHTML = '';
        detailsEl.style.display = 'none';
      }
    }
    const proceedBtn = document.getElementById('btn-confirm-proceed');
    proceedBtn.textContent = confirmLabel;
    proceedBtn.className = `btn ${confirmBtnClass}`;
    state.confirmCallback = onConfirm;
    state.confirmCancelCallback = onCancel;
    const modal = document.getElementById('confirm-modal');
    modal.classList.add('open');

    const cancelBtn = document.getElementById('btn-confirm-cancel');
    focusDialogInitialElement(modal, cancelBtn);
  }

  function closeConfirmDialog(triggerCancel = false) {
    const cancelCb = triggerCancel ? state.confirmCancelCallback : null;
    const triggerEl = state.lastConfirmTrigger;
    document.getElementById('confirm-modal').classList.remove('open');
    state.confirmCallback = null;
    state.confirmCancelCallback = null;
    state.lastConfirmTrigger = null;
    if (typeof cancelCb === 'function') cancelCb();
    restoreTriggerFocus(triggerEl);
  }

  function closeUtilityMenu(restoreFocus = false) {
    const btn = document.getElementById('btn-utility-menu');
    const menu = document.getElementById('utility-menu-dropdown');
    if (!btn || !menu || menu.hidden) return;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) btn.focus();
  }

  function hasUnsavedTestMarks() {
    return state.currentScreen === 'tests' && !!state.testId && !!state.testClassId && !!state.testSubject && !!state.testsDirty;
  }

  function hasUnsavedAttendance(mode = null) {
    const classDirty = state.currentScreen === 'class-attendance' && !!state.caClassId && !!state.caSubject && !!state.caDirty;
    const prepDirty = state.currentScreen === 'prep-attendance' && !!state.paClassId && !!state.paPrepSlot && !!state.paDirty;
    if (mode === 'class') return classDirty;
    if (mode === 'prep') return prepDirty;
    return classDirty || prepDirty;
  }

  function hasUnsavedHealthForm() {
    return state.currentScreen === 'health' && !!state.healthFormOpen && !!state.healthDirty;
  }

  function hasUnsavedStudentForm() {
    return state.currentScreen === 'student-details' && !!state.stuFormOpen && !!state.stuFormDirty;
  }

  function guardUnsavedPortalEdits(proceedCallback, cancelCallback = null) {
    if (hasUnsavedTestMarks()) {
      openConfirmDialog({
        title: 'Unsaved Test Marks',
        message: 'You have unsaved marks changes for this subject. Discard unsaved changes and continue?',
        confirmLabel: 'Discard Changes',
        confirmBtnClass: 'btn-danger',
        onConfirm: () => {
          state.testsDirty = false;
          proceedCallback();
        },
        onCancel: cancelCallback
      });
      return;
    }
    if (hasUnsavedAttendance()) {
      openConfirmDialog({
        title: 'Unsaved Attendance Marks',
        message: 'You have unsaved attendance marks for this session. Discard unsaved changes and continue?',
        confirmLabel: 'Discard Changes',
        confirmBtnClass: 'btn-danger',
        onConfirm: () => {
          state.caDirty = false;
          state.paDirty = false;
          proceedCallback();
        },
        onCancel: cancelCallback
      });
      return;
    }
    if (hasUnsavedHealthForm()) {
      openConfirmDialog({
        title: 'Unsaved Medical Form',
        message: 'You have unsaved details in the medical record form. Discard this entry and continue?',
        confirmLabel: 'Discard Form',
        confirmBtnClass: 'btn-danger',
        onConfirm: () => {
          state.healthDirty = false;
          state.healthFormOpen = false;
          proceedCallback();
        },
        onCancel: cancelCallback
      });
      return;
    }
    if (hasUnsavedStudentForm()) {
      openConfirmDialog({
        title: 'Unsaved Student Details',
        message: 'You have unsaved changes in the student details form. Discard changes and continue?',
        confirmLabel: 'Discard Form',
        confirmBtnClass: 'btn-danger',
        onConfirm: () => {
          state.stuFormDirty = false;
          state.stuFormOpen = false;
          proceedCallback();
        },
        onCancel: cancelCallback
      });
      return;
    }
    proceedCallback();
  }

  function guardUnsavedTestMarks(proceedCallback) {
    guardUnsavedPortalEdits(proceedCallback);
  }

  /* ========================================================================
     Navigation Controller
     ======================================================================== */
  function switchScreen(screenName, bypassDirtyCheck = false) {
    if (
      !bypassDirtyCheck &&
      screenName !== state.currentScreen &&
      (hasUnsavedTestMarks() || hasUnsavedAttendance() || hasUnsavedHealthForm() || hasUnsavedStudentForm())
    ) {
      guardUnsavedPortalEdits(() => switchScreen(screenName, true));
      return;
    }

    closeUtilityMenu(false);
    state.currentScreen = screenName;

    document.querySelectorAll('.screen').forEach((el) => {
      el.classList.toggle('active', el.id === `screen-${screenName}`);
    });
    document.querySelectorAll('.sidebar-nav .nav-link').forEach((el) => {
      const isCurrent = el.dataset.screen === screenName;
      el.classList.toggle('active', isCurrent);
      if (isCurrent) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    document.querySelectorAll('.bottom-nav .tab-btn').forEach((el) => {
      const isCurrent = el.dataset.screen === screenName;
      el.classList.toggle('active', isCurrent);
      if (isCurrent) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });

    const meta = SCREEN_META[screenName] || SCREEN_META.home;
    const titleEl = document.getElementById('topbar-page-title');
    const subEl = document.getElementById('topbar-page-subtitle');
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.subtitle;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (screenName === 'home') updateHomeStats();
    else if (screenName === 'violations') refreshViolationsModule();
    else if (screenName === 'homework') refreshHomeworkModule();
    else if (screenName === 'class-attendance') refreshAttendanceModule('class');
    else if (screenName === 'prep-attendance') refreshAttendanceModule('prep');
    else if (screenName === 'health') refreshHealthModule();
    else if (screenName === 'student-details') refreshStudentDetailModule();
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
    const classAttList = await window.AppStorage.getClassAttendance();
    const prepAttList = await window.AppStorage.getPrepAttendance();
    const healthList = await window.AppStorage.getHealthRecords();
    const todayStr = window.AppStorage.getLocalTodayDate();
    const classAttToday = classAttList.filter((e) => e.date === todayStr).length;
    const prepAttToday = prepAttList.filter((e) => e.date === todayStr).length;

    document.getElementById('home-stat-students').textContent = roster.length;
    document.getElementById('home-stat-violations').textContent = complaints.length;
    document.getElementById('home-stat-pending').textContent = pending.length;
    document.getElementById('home-stat-tests').textContent = tests.length;
    const statClassAtt = document.getElementById('home-stat-class-att');
    const statPrepAtt = document.getElementById('home-stat-prep-att');
    if (statClassAtt) statClassAtt.textContent = classAttToday;
    if (statPrepAtt) statPrepAtt.textContent = prepAttToday;

    const dateEl = document.getElementById('home-current-date');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    document.getElementById('home-violations-tag').textContent = `${complaints.length} Logged`;
    document.getElementById('home-homework-tag').textContent = `${hws.length} HW • ${pending.length} Pending`;
    document.getElementById('home-tests-tag').textContent = `${tests.length} ${tests.length === 1 ? 'Test' : 'Tests'}`;
    const classAttTag = document.getElementById('home-class-att-tag');
    if (classAttTag) classAttTag.textContent = `${classAttList.length} Saved ${classAttList.length === 1 ? 'Roll' : 'Rolls'}`;
    const prepAttTag = document.getElementById('home-prep-att-tag');
    if (prepAttTag) {
      prepAttTag.textContent = prepAttList.length > 0
        ? `${prepAttList.length} Saved • Prep 1–3`
        : 'Prep 1 • 2 • 3';
    }
    const healthTag = document.getElementById('home-health-tag');
    if (healthTag) {
      healthTag.textContent = `${healthList.length} ${healthList.length === 1 ? 'Visit' : 'Visits'}`;
    }
    const stuTag = document.getElementById('home-students-tag');
    if (stuTag) stuTag.textContent = `${roster.length} Student Profiles`;
    const stuDetailsTag = document.getElementById('home-student-details-tag');
    if (stuDetailsTag) stuDetailsTag.textContent = `${roster.length} Students • Contacts`;

    const badgeViol = document.getElementById('snav-badge-violations');
    const badgePend = document.getElementById('snav-badge-pending');
    const badgeTests = document.getElementById('snav-badge-tests');
    const badgeClassAtt = document.getElementById('snav-badge-class-att');
    const badgePrepAtt = document.getElementById('snav-badge-prep-att');
    const badgeHealth = document.getElementById('snav-badge-health');
    const badgeStuDetails = document.getElementById('snav-badge-student-details');
    if (badgeViol) badgeViol.textContent = complaints.length;
    if (badgePend) badgePend.textContent = pending.length;
    if (badgeTests) badgeTests.textContent = tests.length;
    if (badgeClassAtt) badgeClassAtt.textContent = classAttToday;
    if (badgePrepAtt) badgePrepAtt.textContent = prepAttToday;
    if (badgeHealth) badgeHealth.textContent = healthList.length;
    if (badgeStuDetails) badgeStuDetails.textContent = roster.length;

    const recoverBtn = document.getElementById('btn-restore-recovery');
    if (recoverBtn) {
      recoverBtn.hidden = !window.AppStorage.hasRecoverySnapshot();
    }
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
    const healthSelect = document.getElementById('health-select-class');
    const stuDetailSelect = document.getElementById('stu-select-class');
    const filterSelect = document.getElementById('filter-class');
    const hwSelect = document.getElementById('hw-select-class');
    const pendingFilter = document.getElementById('pending-filter-class');

    const optsHtml = classes.map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.label)}</option>`).join('');

    formSelect.innerHTML = '<option value="">-- Select Class --</option>' + optsHtml;
    if (healthSelect) healthSelect.innerHTML = '<option value="">-- Select Class --</option>' + optsHtml;
    if (stuDetailSelect) stuDetailSelect.innerHTML = '<option value="">-- Select Class --</option>' + optsHtml;
    filterSelect.innerHTML = '<option value="ALL">All Classes</option>' + optsHtml;
    hwSelect.innerHTML = optsHtml;
    pendingFilter.innerHTML = '<option value="ALL">All Classes</option>' + optsHtml;
  }

  function clearViolationBanners() {
    const succ = document.getElementById('form-success-banner');
    const err = document.getElementById('form-error-banner');
    if (succ) succ.classList.add('hidden');
    if (err) err.classList.add('hidden');
  }

  async function updateViolationMatchStatus() {
    const statusEl = document.getElementById('violation-match-status');
    const idInput = document.getElementById('input-student-id');
    const nameInput = document.getElementById('input-student-name');
    const classSelect = document.getElementById('select-class');
    if (!statusEl || !idInput || !nameInput || !classSelect) return;

    const sid = idInput.value.trim();
    const typedName = nameInput.value.trim();
    const cid = classSelect.value ? window.AppStorage.normalizeClassId(classSelect.value) : '';

    if (sid) {
      const stu = await window.AppStorage.getStudentById(sid);
      const stuCid = stu ? window.AppStorage.normalizeClassId(stu.classId || stu.className) : '';
      if (stu && (!cid || stuCid === cid)) {
        statusEl.className = 'violation-match-status matched';
        statusEl.textContent = `Selected student: ${stu.name} (${window.AppStorage.getClassLabel(stu.classId)} • Roll #${stu.rollNumber || '-'})`;
        return;
      }
      // Class changed or student missing -> clear stale ID
      idInput.value = '';
    }

    if (!typedName) {
      statusEl.className = 'violation-match-status';
      statusEl.textContent = '';
      return;
    }

    const roster = await window.AppStorage.getAllRosterStudents();
    const normTyped = window.AppStorage.normalizeText(typedName).toLowerCase();
    const sameClass = cid
      ? roster.filter((s) => window.AppStorage.normalizeText(s.name).toLowerCase() === normTyped && window.AppStorage.normalizeClassId(s.classId || s.className) === cid)
      : [];
    const otherClass = cid
      ? roster.filter((s) => window.AppStorage.normalizeText(s.name).toLowerCase() === normTyped && window.AppStorage.normalizeClassId(s.classId || s.className) !== cid)
      : [];

    if (sameClass.length === 1) {
      statusEl.className = 'violation-match-status unmatched';
      statusEl.textContent = `Matches ${sameClass[0].name} (Roll #${sameClass[0].rollNumber || '-'}) — pick from suggestions or submit to confirm.`;
    } else if (sameClass.length > 1) {
      statusEl.className = 'violation-match-status unmatched';
      statusEl.textContent = `Multiple students named "${typedName}" exist in this class — select one from suggestions.`;
    } else if (otherClass.length > 0) {
      const classesList = otherClass.map((s) => window.AppStorage.getClassLabel(s.classId || s.className)).join(', ');
      statusEl.className = 'violation-match-status unmatched';
      statusEl.textContent = `"${typedName}" exists in ${classesList} (not ${window.AppStorage.getClassLabel(cid)}). Re-select or submit to confirm a separate record.`;
    } else if (cid) {
      statusEl.className = 'violation-match-status unmatched';
      statusEl.textContent = `Not in ${window.AppStorage.getClassLabel(cid)} roster — submitting will ask to confirm creating a new custom student.`;
    } else {
      statusEl.className = 'violation-match-status';
      statusEl.textContent = 'Select a class or pick a student from the suggestions list.';
    }
  }

  async function handleViolationNameInput(e) {
    const val = e.target.value.trim().toLowerCase();
    document.getElementById('input-student-id').value = '';
    document.getElementById('val-student-name').classList.remove('visible');
    e.target.classList.remove('is-invalid');
    clearViolationBanners();

    const dropdown = document.getElementById('autocomplete-list');
    if (!val) {
      dropdown.classList.remove('show');
      dropdown.innerHTML = '';
      await updateViolationMatchStatus();
      return;
    }

    const roster = await window.AppStorage.getAllRosterStudents();
    const matches = roster.filter((s) =>
      s.name.toLowerCase().includes(val) || (s.rollNumber && s.rollNumber.toString().includes(val))
    ).slice(0, 15);

    if (matches.length === 0) {
      dropdown.classList.remove('show');
      dropdown.innerHTML = '';
      await updateViolationMatchStatus();
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
    await updateViolationMatchStatus();
  }

  async function handleViolationAutocompletePick(e) {
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
    clearViolationBanners();
    await updateViolationMatchStatus();
    document.getElementById('textarea-complaint').focus();
  }

  async function executeViolationSave({ resolvedStudentId = null, allowCreateCustom = false }) {
    const nameInput = document.getElementById('input-student-name');
    const classSelect = document.getElementById('select-class');
    const textArea = document.getElementById('textarea-complaint');
    const sevInput = document.getElementById('input-severity-value');
    const successBanner = document.getElementById('form-success-banner');
    const errorBanner = document.getElementById('form-error-banner');

    try {
      const res = await window.AppStorage.addComplaint({
        studentId: resolvedStudentId,
        studentName: nameInput.value.trim(),
        className: classSelect.value,
        text: textArea.value.trim(),
        severity: sevInput.value,
        allowCreateCustom
      });

      if (errorBanner) errorBanner.classList.add('hidden');
      document.getElementById('success-banner-details').textContent =
        `Recorded for ${res.student.name} (${window.AppStorage.getClassLabel(res.student.classId)}) on ${formatDateTime(res.complaint.createdAt)}. Severity: ${res.complaint.severity}.`;
      successBanner.classList.remove('hidden');

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
      await updateViolationMatchStatus();

      await refreshViolationsModule();
      await updateHomeStats();
      setTimeout(() => successBanner.classList.add('hidden'), 8000);
    } catch (err) {
      if (successBanner) successBanner.classList.add('hidden');
      if (errorBanner) {
        document.getElementById('error-banner-details').textContent = err.message || 'Unable to save violation to browser storage.';
        errorBanner.classList.remove('hidden');
      }
      showToast(err.message || 'Error saving violation.', 'error');
    }
  }

  async function handleViolationSubmit(e) {
    e.preventDefault();
    clearViolationBanners();

    const studentIdInput = document.getElementById('input-student-id');
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

    const cid = window.AppStorage.normalizeClassId(classSelect.value);
    const cleanName = window.AppStorage.normalizeText(nameInput.value);
    const normLower = cleanName.toLowerCase();
    const roster = await window.AppStorage.getAllRosterStudents();

    let studentId = studentIdInput.value.trim();
    if (studentId) {
      const matched = roster.find((s) => s.id === studentId);
      if (matched && window.AppStorage.normalizeClassId(matched.classId || matched.className) === cid) {
        await executeViolationSave({ resolvedStudentId: matched.id, allowCreateCustom: false });
        return;
      }
      // Revalidate failure: selected ID does not match chosen class
      studentIdInput.value = '';
      studentId = '';
      await updateViolationMatchStatus();
    }

    const sameClassMatches = roster.filter((s) =>
      window.AppStorage.normalizeText(s.name).toLowerCase() === normLower &&
      window.AppStorage.normalizeClassId(s.classId || s.className) === cid
    );

    if (sameClassMatches.length > 1) {
      const errorBanner = document.getElementById('form-error-banner');
      const msg = `Multiple students named "${cleanName}" exist in ${window.AppStorage.getClassLabel(cid)}. Please select the exact student from the suggestions list.`;
      if (errorBanner) {
        document.getElementById('error-banner-details').textContent = msg;
        errorBanner.classList.remove('hidden');
      }
      showToast(msg, 'error');
      nameInput.focus();
      return;
    }

    if (sameClassMatches.length === 1) {
      const stu = sameClassMatches[0];
      openConfirmDialog({
        title: 'Confirm Student Attribution',
        message: 'Log this violation for the matched student in the selected class?',
        detailsHtml: `
          <div class="confirm-details-row"><span>Student</span><strong>${escapeHTML(stu.name)}</strong></div>
          <div class="confirm-details-row"><span>Class &amp; Roll</span><strong>${escapeHTML(window.AppStorage.getClassLabel(stu.classId))} (#${escapeHTML(stu.rollNumber || '-')})</strong></div>
          <div class="confirm-details-row"><span>Section</span><strong>${escapeHTML(stu.section || '-')}</strong></div>
        `,
        confirmLabel: 'Confirm & Submit',
        confirmBtnClass: 'btn-primary',
        onConfirm: async () => {
          document.getElementById('input-student-id').value = stu.id;
          await updateViolationMatchStatus();
          await executeViolationSave({ resolvedStudentId: stu.id, allowCreateCustom: false });
        }
      });
      return;
    }

    const otherClassMatches = roster.filter((s) =>
      window.AppStorage.normalizeText(s.name).toLowerCase() === normLower &&
      window.AppStorage.normalizeClassId(s.classId || s.className) !== cid
    );

    if (otherClassMatches.length > 0) {
      const existingClasses = otherClassMatches.map((s) => `${window.AppStorage.getClassLabel(s.classId || s.className)} (#${s.rollNumber || '-'})`).join(', ');
      openConfirmDialog({
        title: 'Student Exists in Another Class',
        message: `"${cleanName}" is enrolled in ${existingClasses}, not ${window.AppStorage.getClassLabel(cid)}. Choose Cancel to pick the existing student or proceed to create a new custom student record in ${window.AppStorage.getClassLabel(cid)}.`,
        detailsHtml: `
          <div class="confirm-details-row"><span>Entered Name</span><strong>${escapeHTML(cleanName)}</strong></div>
          <div class="confirm-details-row"><span>Selected Class</span><strong>${escapeHTML(window.AppStorage.getClassLabel(cid))}</strong></div>
          <div class="confirm-details-row"><span>Existing Roster Match</span><strong>${escapeHTML(existingClasses)}</strong></div>
        `,
        confirmLabel: 'Create Custom Record & Submit',
        confirmBtnClass: 'btn-primary',
        onConfirm: () => executeViolationSave({ resolvedStudentId: null, allowCreateCustom: true })
      });
      return;
    }

    openConfirmDialog({
      title: 'Create New Custom Student?',
      message: `"${cleanName}" was not found in the ${window.AppStorage.getClassLabel(cid)} roster. Confirm creating a new custom student record and logging this violation?`,
      detailsHtml: `
        <div class="confirm-details-row"><span>Student Name</span><strong>${escapeHTML(cleanName)}</strong></div>
        <div class="confirm-details-row"><span>Class</span><strong>${escapeHTML(window.AppStorage.getClassLabel(cid))}</strong></div>
        <div class="confirm-details-row"><span>Severity</span><strong>${escapeHTML(sevInput.value)}</strong></div>
      `,
      confirmLabel: 'Create & Submit Violation',
      confirmBtnClass: 'btn-primary',
      onConfirm: () => executeViolationSave({ resolvedStudentId: null, allowCreateCustom: true })
    });
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
        .map(([sev, c]) => `<span class="sev-chip sev-chip-${escapeHTML(sev.toLowerCase())}">${escapeHTML(sev)} &times; ${escapeHTML(c)}</span>`)
        .join('');

      return `
        <article class="student-card" data-student-id="${escapeHTML(s.id)}" tabindex="0" role="button">
          <div class="student-card-header">
            <div>
              <span class="student-name">${escapeHTML(s.name)}</span>
              <div><span class="student-class-badge">${escapeHTML(s.className)} ${s.rollNumber && s.rollNumber !== '-' ? '&bull; #' + escapeHTML(s.rollNumber) : ''}</span></div>
            </div>
            <span class="complaint-count-badge">${escapeHTML(s.totalComplaints)} ${s.totalComplaints === 1 ? 'violation' : 'violations'}</span>
          </div>
          <div class="meter-section">
            <div class="meter-track"><div class="meter-fill-reveal" style="--meter-fill: ${escapeHTML(s.fillPercent)}%;"></div></div>
            <div class="meter-info">
              <span class="meter-score">Score: ${escapeHTML(s.severityScore)} <span>/ ${escapeHTML(window.AppStorage.MAX_SCORE)}</span></span>
              <span class="status-badge ${escapeHTML(s.statusClass)}">${escapeHTML(s.statusLabel)}</span>
            </div>
          </div>
          <div class="severity-chips">${chips}</div>
          <div class="student-card-footer">
            <span class="latest-time">${escapeHTML(formatDateTime(s.latestComplaintAt))}</span>
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

    const modalEl = document.getElementById('student-detail-modal');
    const wasOpen = modalEl.classList.contains('open');
    if (!wasOpen) {
      state.lastFocusedElement = document.activeElement;
    }

    state.activeStudentDetailId = studentId;
    document.getElementById('modal-student-name').textContent = s.name;
    document.getElementById('modal-student-meta').textContent = `${s.className} • ${s.totalComplaints} violations • Score: ${s.severityScore}`;

    document.getElementById('modal-meter-section').innerHTML = `
      <div class="meter-track" style="height:14px;"><div class="meter-fill-reveal" style="--meter-fill:${escapeHTML(s.fillPercent)}%;"></div></div>
      <div class="meter-info" style="margin-top:6px;">
        <span class="meter-score">Severity Score: ${escapeHTML(s.severityScore)} <span>/ ${escapeHTML(window.AppStorage.MAX_SCORE)}</span></span>
        <span class="status-badge ${escapeHTML(s.statusClass)}">${escapeHTML(s.statusLabel)}</span>
      </div>
    `;

    const sevPts = (sev) => (window.AppStorage.SEVERITY_CONFIG[sev] ? window.AppStorage.SEVERITY_CONFIG[sev].points : 1);
    document.getElementById('modal-history-list').innerHTML = s.complaints.map((c) => `
      <div class="history-card">
        <div class="history-card-header">
          <span class="sev-chip sev-chip-${escapeHTML(c.severity.toLowerCase())}">${escapeHTML(c.severity)} (${escapeHTML(sevPts(c.severity))} pt)</span>
          <span class="history-time">${escapeHTML(formatDateTime(c.createdAt))}</span>
        </div>
        <div class="history-text" dir="auto">${escapeHTML(c.text)}</div>
        <div class="history-footer">
          <button type="button" class="btn btn-outline btn-sm btn-danger btn-del-violation" data-cid="${escapeHTML(c.id)}">Delete</button>
        </div>
      </div>
    `).join('');

    document.getElementById('btn-detail-add-complaint').onclick = async () => {
      closeViolationDetailModal(false);
      switchViolationSubTab('form');
      document.getElementById('input-student-id').value = s.id;
      document.getElementById('input-student-name').value = s.name;
      document.getElementById('select-class').value = window.AppStorage.normalizeClassId(s.classId);
      await updateViolationMatchStatus();
      document.getElementById('textarea-complaint').focus();
    };

    document.getElementById('btn-detail-open-grand').onclick = () => {
      closeViolationDetailModal(false);
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
            try {
              const res = await window.AppStorage.deleteComplaint(cid);
              if (res.success) {
                showToast('Violation deleted.', 'success');
                if (res.studentDeleted) closeViolationDetailModal(true);
                else openViolationDetailModal(studentId);
                await refreshViolationsModule();
                await updateHomeStats();
              }
            } catch (err) {
              showToast(err.message || 'Unable to delete violation.', 'error');
            }
          }
        });
      });
    });

    modalEl.classList.add('open');
    if (!wasOpen) {
      focusDialogInitialElement(modalEl, document.getElementById('modal-close-btn'));
    }
  }

  function closeViolationDetailModal(shouldRestoreFocus = true) {
    document.getElementById('student-detail-modal').classList.remove('open');
    state.activeStudentDetailId = null;
    if (shouldRestoreFocus) {
      restoreTriggerFocus(state.lastFocusedElement);
      state.lastFocusedElement = null;
    }
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

    const sevPts = (sev) => (window.AppStorage.SEVERITY_CONFIG[sev] ? window.AppStorage.SEVERITY_CONFIG[sev].points : 1);
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
            <td colspan="7"><strong>${escapeHTML(s.name)}</strong> (${escapeHTML(s.className)}) — ${escapeHTML(s.totalComplaints)} ${s.totalComplaints === 1 ? 'violation' : 'violations'} | Score: ${escapeHTML(s.severityScore)}/${escapeHTML(window.AppStorage.MAX_SCORE)} (${escapeHTML(s.statusLabel)})</td>
          </tr>
        `;
        s.complaints.forEach((c) => {
          rowsHtml += `
            <tr>
              <td>${counter++}</td>
              <td><strong>${escapeHTML(s.name)}</strong></td>
              <td>${escapeHTML(s.className)}</td>
              <td class="complaint-cell" dir="auto">${escapeHTML(c.text)}</td>
              <td><span class="sev-chip sev-chip-${escapeHTML(c.severity.toLowerCase())}">${escapeHTML(c.severity)} (${escapeHTML(sevPts(c.severity))} pt)</span></td>
              <td>${escapeHTML(formatDateOnly(c.createdAt))}</td>
              <td>${escapeHTML(formatTimeOnly(c.createdAt))}</td>
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
            <td><span class="sev-chip sev-chip-${escapeHTML(c.severity.toLowerCase())}">${escapeHTML(c.severity)} (${escapeHTML(sevPts(c.severity))} pt)</span></td>
            <td>${escapeHTML(formatDateOnly(c.createdAt))}</td>
            <td>${escapeHTML(formatTimeOnly(c.createdAt))}</td>
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
      const hel1 = document.getElementById('health-readonly-datetime');
      const hel2 = document.getElementById('health-form-clock-box');
      if (el1) el1.textContent = txt;
      if (el2) el2.textContent = txt;
      if (hel1) hel1.textContent = txt;
      if (hel2) hel2.textContent = txt;
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
    if (!state.hwFormOpen || forceState === true) {
      state.hwEditingId = null;
    }

    const drawer = document.getElementById('hw-form-drawer');
    const toggleHeader = document.getElementById('hw-banner-toggle');
    const pill = document.getElementById('hw-toggle-pill');
    const backBtn = document.getElementById('hw-btn-back-edit');
    const saveBtn = document.getElementById('hw-btn-save-all');

    drawer.style.display = state.hwFormOpen ? 'block' : 'none';
    if (toggleHeader) toggleHeader.setAttribute('aria-expanded', state.hwFormOpen ? 'true' : 'false');
    pill.innerHTML = state.hwFormOpen ? 'Close Form &#9652;' : 'Open Form &#9662;';

    if (backBtn) backBtn.innerHTML = '&larr; Edit Form';
    if (saveBtn) saveBtn.textContent = 'Save Homework & Student Marks';

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

  async function openHwEditChecklist(hw) {
    if (!hw) return;
    state.hwFormOpen = true;
    state.hwEditingId = hw.id;
    state.hwDraftMeta = {
      classId: hw.classId,
      subject: hw.subject,
      teacherName: hw.teacherName,
      description: hw.description,
      createdAt: hw.createdAt,
      dayName: hw.dayName
    };

    const students = await window.AppStorage.getStudentsByClass(hw.classId);
    const existingRecords = hw.records || {};
    state.hwDraftMarks = {};

    students.forEach((s) => {
      const prev = existingRecords[s.id];
      if (prev) {
        state.hwDraftMarks[s.id] = {
          hwDone: !!prev.hwDone,
          conceptClear: !!prev.conceptClear,
          conceptResolved: !!prev.conceptResolved,
          resolvedAt: prev.resolvedAt || null
        };
      } else {
        state.hwDraftMarks[s.id] = {
          hwDone: true,
          conceptClear: true,
          conceptResolved: false,
          resolvedAt: null
        };
      }
    });

    const drawer = document.getElementById('hw-form-drawer');
    const toggleHeader = document.getElementById('hw-banner-toggle');
    const pill = document.getElementById('hw-toggle-pill');
    const backBtn = document.getElementById('hw-btn-back-edit');
    const saveBtn = document.getElementById('hw-btn-save-all');

    drawer.style.display = 'block';
    if (toggleHeader) toggleHeader.setAttribute('aria-expanded', 'true');
    pill.innerHTML = 'Close Form &#9652;';
    document.getElementById('hw-create-form').style.display = 'none';
    document.getElementById('hw-marking-panel').style.display = 'block';
    document.getElementById('hw-marking-title').textContent =
      `Edit Saved Checklist — ${window.AppStorage.getClassLabel(hw.classId)} (${hw.subject})`;
    document.getElementById('hw-marking-subtitle').textContent =
      `Teacher: ${hw.teacherName} • Assigned: ${hw.dayName}, ${formatDateTime(hw.createdAt)} • "${hw.description}"`;
    if (backBtn) backBtn.textContent = 'Cancel Edit';
    if (saveBtn) saveBtn.textContent = 'Update Saved Checklist';

    renderHwDraftRows(students);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleHwFormProceed(e) {
    e.preventDefault();
    state.hwEditingId = null;
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
      state.hwDraftMarks[s.id] = { hwDone: true, conceptClear: true, conceptResolved: false };
    });

    document.getElementById('hw-create-form').style.display = 'none';
    document.getElementById('hw-marking-panel').style.display = 'block';
    document.getElementById('hw-btn-back-edit').innerHTML = '&larr; Edit Form';
    document.getElementById('hw-btn-save-all').textContent = 'Save Homework & Student Marks';
    document.getElementById('hw-marking-title').textContent =
      `Mark ${students.length} Students — ${window.AppStorage.getClassLabel(classId)} (${subject})`;
    document.getElementById('hw-marking-subtitle').textContent =
      `Teacher: ${teacherName} • "${description}"`;

    renderHwDraftRows(students);
  }

  function renderHwDraftRows(students) {
    const summaryEl = document.getElementById('hw-selection-summary');
    if (summaryEl) {
      let doneCnt = 0;
      let notDoneCnt = 0;
      let clearCnt = 0;
      let unclearCnt = 0;
      students.forEach((s) => {
        const m = state.hwDraftMarks[s.id] || { hwDone: true, conceptClear: true };
        if (m.hwDone) doneCnt++;
        else notDoneCnt++;
        if (m.conceptClear) clearCnt++;
        else unclearCnt++;
      });
      summaryEl.innerHTML = `
        <span class="drill-pill drill-pill-blue">Students: ${escapeHTML(students.length)}</span>
        <span class="drill-pill drill-pill-green">&#10003; Done: ${escapeHTML(doneCnt)}</span>
        <span class="drill-pill ${notDoneCnt > 0 ? 'drill-pill-red' : ''}">&#10007; Not Done: ${escapeHTML(notDoneCnt)}</span>
        <span class="drill-pill drill-pill-green">&#9679; Clear: ${escapeHTML(clearCnt)}</span>
        <span class="drill-pill ${unclearCnt > 0 ? 'drill-pill-amber' : ''}">&#9650; Unclear: ${escapeHTML(unclearCnt)}</span>
      `;
    }

    const container = document.getElementById('hw-marking-rows');
    container.innerHTML = students.map((s) => {
      const m = state.hwDraftMarks[s.id] || { hwDone: true, conceptClear: true, conceptResolved: false };
      const resolvedTag = (!m.conceptClear && m.conceptResolved)
        ? '<span class="hw-resolved-pill">&#10003; Cleared Later</span>'
        : '';
      return `
        <div class="hw-student-mark-row" data-sid="${escapeHTML(s.id)}">
          <div class="hw-stu-info">
            <div>
              <div class="hw-stu-name">${escapeHTML(s.name)} ${resolvedTag}</div>
              <div class="hw-stu-meta">Roll #${escapeHTML(s.rollNumber)} &bull; ${escapeHTML(s.section)}</div>
            </div>
          </div>
          <div class="hw-stu-toggles">
            <div class="toggle-pair" role="group" aria-label="Homework Status">
              <button type="button" class="mark-toggle-btn ${m.hwDone ? 'active-tick' : ''}" data-action="hw-done" aria-pressed="${m.hwDone ? 'true' : 'false'}">&#10003; Done</button>
              <button type="button" class="mark-toggle-btn ${!m.hwDone ? 'active-cross' : ''}" data-action="hw-cross" aria-pressed="${!m.hwDone ? 'true' : 'false'}">&#10007; Not Done</button>
            </div>
            <div class="toggle-pair" role="group" aria-label="Concept Understanding">
              <button type="button" class="mark-toggle-btn ${m.conceptClear ? 'active-clear' : ''}" data-action="concept-clear" aria-pressed="${m.conceptClear ? 'true' : 'false'}">&#9679; Clear</button>
              <button type="button" class="mark-toggle-btn ${!m.conceptClear ? 'active-unclear' : ''}" data-action="concept-unclear" aria-pressed="${!m.conceptClear ? 'true' : 'false'}">&#9650; Unclear</button>
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
          const draft = state.hwDraftMarks[sid] || (state.hwDraftMarks[sid] = { hwDone: true, conceptClear: true, conceptResolved: false });
          if (act === 'hw-done') draft.hwDone = true;
          else if (act === 'hw-cross') draft.hwDone = false;
          else if (act === 'concept-clear') {
            draft.conceptClear = true;
            draft.conceptResolved = false;
            draft.resolvedAt = null;
          } else if (act === 'concept-unclear') {
            draft.conceptClear = false;
            draft.conceptResolved = false;
            draft.resolvedAt = null;
          }
          renderHwDraftRows(students);
        });
      });
    });
  }

  async function saveDraftHomework() {
    if (!state.hwDraftMeta) return;
    const records = {};
    Object.entries(state.hwDraftMarks).forEach(([sid, val]) => {
      const rec = {
        hwDone: !!val.hwDone,
        conceptClear: !!val.conceptClear,
        conceptResolved: !val.conceptClear ? !!val.conceptResolved : false
      };
      if (rec.conceptResolved && val.resolvedAt) {
        rec.resolvedAt = val.resolvedAt;
      }
      records[sid] = rec;
    });

    try {
      if (state.hwEditingId) {
        await window.AppStorage.updateHomeworkRecords(state.hwEditingId, records);
        const activeUnclear = Object.values(records).filter((r) => !r.conceptClear && !r.conceptResolved).length;
        showToast(
          `Checklist updated (assignment preserved). Active unclear tasks: ${activeUnclear}.`,
          'success'
        );
      } else {
        await window.AppStorage.addHomework({
          ...state.hwDraftMeta,
          records
        });
        const unclearCount = Object.values(records).filter((r) => !r.conceptClear).length;
        showToast(
          `Homework saved! ${unclearCount > 0 ? `${unclearCount} unclear task(s) added to Pending Tasks.` : 'All concepts clear.'}`,
          'success'
        );
      }

      document.getElementById('hw-create-form').reset();
      state.hwEditingId = null;
      state.hwDraftMeta = null;
      state.hwDraftMarks = {};
      toggleHwFormDrawer(false);
      await refreshHomeworkModule();
      await updateHomeStats();
    } catch (err) {
      showToast(err.message || 'Unable to save homework to browser storage. Your marks have been preserved.', 'error');
    }
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
          <div class="drill-box" data-class-id="${escapeHTML(c.id)}" tabindex="0" role="button">
            <div class="drill-box-top">
              <div>
                <div class="drill-box-title">${escapeHTML(c.label)}</div>
                <div class="drill-box-sub">${escapeHTML(stus.length)} ${stus.length === 1 ? 'Student' : 'Students'} &bull; ${escapeHTML(subjects.length)} ${subjects.length === 1 ? 'Subject' : 'Subjects'}</div>
              </div>
              <span class="drill-pill ${clsPending > 0 ? 'drill-pill-amber' : 'drill-pill-blue'}">
                ${clsPending > 0 ? `${escapeHTML(clsPending)} Pending` : `${escapeHTML(clsHwCount)} HW`}
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
            <span class="drill-pill ${pillClass}">${escapeHTML(pct)}</span>
          </div>
          <div class="drill-box-footer">
            <span>${report && report.conceptUnclearActive > 0 ? `<strong style="color:#d97706;">${escapeHTML(report.conceptUnclearActive)} Pending Task(s)</strong>` : 'View Student Report'}</span>
            <span>&rarr;</span>
          </div>
        </div>
      `;
    }

    const recentHwHtml = subjHws.length === 0 ? '' : `
      <div class="dossier-section-card" style="margin-top:20px;">
        <div class="dossier-section-title">
          <span>Assigned Homeworks History (${escapeHTML(subjHws.length)})</span>
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
                  <span class="history-time">${escapeHTML(h.dayName)}, ${escapeHTML(formatDateTime(h.createdAt))}</span>
                </div>
                <div class="history-text" dir="auto">${escapeHTML(h.description)}</div>
                <div class="history-footer" style="justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span style="font-size:0.78rem; color:var(--text-muted);">Done: ${escapeHTML(done)}/${escapeHTML(recs.length)} &bull; Active Unclear: ${escapeHTML(unclear)}</span>
                  <div style="display:flex; gap:8px;">
                    <button type="button" class="btn btn-outline btn-sm btn-edit-hw" data-hwid="${escapeHTML(h.id)}">Edit Checklist</button>
                    <button type="button" class="btn btn-outline btn-sm btn-danger btn-del-hw" data-hwid="${escapeHTML(h.id)}">Delete</button>
                  </div>
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

    content.querySelectorAll('.btn-edit-hw').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetHw = subjHws.find((h) => h.id === btn.dataset.hwid);
        if (targetHw) openHwEditChecklist(targetHw);
      });
    });

    content.querySelectorAll('.btn-del-hw').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hwid = btn.dataset.hwid;
        openConfirmDialog({
          title: 'Delete Homework Entry',
          message: 'Delete this homework record and its student marks?',
          confirmLabel: 'Delete',
          onConfirm: async () => {
            try {
              await window.AppStorage.deleteHomework(hwid);
              showToast('Homework entry deleted.', 'success');
              await refreshHomeworkModule();
              await updateHomeStats();
            } catch (err) {
              showToast(err.message || 'Unable to delete homework.', 'error');
            }
          }
        });
      });
    });
  }

  /* Student Subject Homework Report Modal (with 1d, 7d, 1m, all, custom selector) */
  async function openHwStudentReportModal(studentId) {
    const modalEl = document.getElementById('hw-student-report-modal');
    if (!modalEl.classList.contains('open')) {
      state.lastFocusedElement = document.activeElement;
    }
    state.hwModalStudentId = studentId;
    modalEl.classList.add('open');
    await renderHwStudentReportBody();
    focusDialogInitialElement(modalEl, document.getElementById('hw-modal-close-btn'));
  }

  function closeHwStudentReportModal() {
    document.getElementById('hw-student-report-modal').classList.remove('open');
    state.hwModalStudentId = null;
    restoreTriggerFocus(state.lastFocusedElement);
    state.lastFocusedElement = null;
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
                  <strong>${escapeHTML(pt.subject)}</strong> &bull; <small>${escapeHTML(formatDateOnly(pt.createdAt))} (${escapeHTML(pt.dayName)})</small>
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
                <strong>${escapeHTML(e.dayName)}, ${escapeHTML(formatDateTime(e.createdAt))}</strong>
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
          <div class="kpi-value">${escapeHTML(report.doneCount)} / ${escapeHTML(report.totalMarked)}</div>
          <div class="kpi-sub">${escapeHTML(pctText)} Completion</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">HW Marking Score</div>
          <div class="kpi-value" style="color:var(--primary);">${escapeHTML(mark10Text)}</div>
          <div class="kpi-sub">Based on period ratio</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">Concept Status</div>
          <div class="kpi-value">${escapeHTML(report.conceptClearCount)} Clear</div>
          <div class="kpi-sub">${escapeHTML(report.conceptUnclearActive)} Unclear Pending</div>
        </div>
      </div>

      <div>
        <h4 style="font-size:0.95rem; font-weight:800; margin-bottom:8px;">Active Pending Tasks (${escapeHTML(pendingList.length)})</h4>
        ${pendingHtml}
      </div>

      <div>
        <h4 style="font-size:0.95rem; font-weight:800; margin-bottom:8px;">Homework Log (${escapeHTML(report.entries.length)})</h4>
        ${historyHtml}
      </div>
    `;

    body.querySelectorAll('.btn-resolve-modal-pt').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await window.AppStorage.resolvePendingTask(btn.dataset.hwid, sid);
          showToast('Concept marked as Cleared!', 'success');
          await renderHwStudentReportBody();
          await refreshHomeworkModule();
          await updateHomeStats();
        } catch (err) {
          showToast(err.message || 'Unable to update task status.', 'error');
        }
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
        try {
          await window.AppStorage.resolvePendingTask(btn.dataset.hwid, btn.dataset.sid);
          showToast('Pending concept task marked as Cleared!', 'success');
          await refreshHomeworkModule();
          await updateHomeStats();
        } catch (err) {
          showToast(err.message || 'Unable to resolve pending task.', 'error');
        }
      });
    });

    listEl.querySelectorAll('.btn-reopen-pt').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await window.AppStorage.reopenPendingTask(btn.dataset.hwid, btn.dataset.sid);
          showToast('Task moved back to Pending.', 'info');
          await refreshHomeworkModule();
          await updateHomeStats();
        } catch (err) {
          showToast(err.message || 'Unable to reopen pending task.', 'error');
        }
      });
    });
  }

  /* ========================================================================
     MODULE 2B & 2C: Shared Classes Attendance & Prep Attendance Engine
     ======================================================================== */
  const ATTENDANCE_MODES = {
    class: {
      screen: 'class-attendance',
      prefix: 'ca',
      title: 'Classes Attendance',
      breadcrumbElId: 'ca-breadcrumb',
      contentElId: 'ca-drill-content',
      classKey: 'caClassId',
      itemKey: 'caSubject',
      dateKey: 'caDate',
      secKey: 'caSectionFilter',
      draftKey: 'caDraftRecords',
      dirtyKey: 'caDirty',
      itemField: 'subject',
      itemPluralLabel: 'Subjects',
      level1Prompt: 'Open Class Subjects',
      getSessions: (filter) => window.AppStorage.getClassAttendance(filter),
      saveSession: (payload) => window.AppStorage.saveClassAttendance(payload),
      getLevel1Items: async (classId) => window.AppStorage.getSubjects(classId)
    },
    prep: {
      screen: 'prep-attendance',
      prefix: 'pa',
      title: 'Prep Attendance',
      breadcrumbElId: 'pa-breadcrumb',
      contentElId: 'pa-drill-content',
      classKey: 'paClassId',
      itemKey: 'paPrepSlot',
      dateKey: 'paDate',
      secKey: 'paSectionFilter',
      draftKey: 'paDraftRecords',
      dirtyKey: 'paDirty',
      itemField: 'prepSlot',
      itemPluralLabel: '3 Prep Boxes',
      level1Prompt: 'Open Prep 1–3',
      getSessions: (filter) => window.AppStorage.getPrepAttendance(filter),
      saveSession: (payload) => window.AppStorage.savePrepAttendance(payload),
      getLevel1Items: async () => [...window.AppStorage.PREP_SLOTS]
    }
  };

  function summarizeAttendanceDraft(students, draft) {
    let present = 0;
    let absent = 0;
    let leave = 0;
    students.forEach((s) => {
      const st = draft[s.id];
      if (st === 'Present') present++;
      else if (st === 'Absent') absent++;
      else if (st === 'Leave') leave++;
    });
    const marked = present + absent + leave;
    return {
      total: students.length,
      marked,
      unmarked: Math.max(0, students.length - marked),
      present,
      absent,
      leave
    };
  }

  function syncAttendanceDraftDom(mode, allStudents, visibleStudents, savedSession) {
    const cfg = ATTENDANCE_MODES[mode];
    const draft = state[cfg.draftKey] || {};
    const countsAll = summarizeAttendanceDraft(allStudents, draft);
    const countsVis = summarizeAttendanceDraft(visibleStudents, draft);

    const listEl = document.getElementById(`${cfg.prefix}-rows-list`);
    if (listEl) {
      listEl.querySelectorAll('.att-student-row').forEach((row) => {
        const sid = row.dataset.sid;
        const st = draft[sid] || '';
        row.classList.toggle('att-row-present', st === 'Present');
        row.classList.toggle('att-row-absent', st === 'Absent');
        row.classList.toggle('att-row-leave', st === 'Leave');

        row.querySelectorAll('.att-status-btn').forEach((btn) => {
          const btnStatus = btn.dataset.status;
          const active = st === btnStatus;
          btn.setAttribute('aria-pressed', active ? 'true' : 'false');
          btn.classList.toggle('active-present', active && btnStatus === 'Present');
          btn.classList.toggle('active-absent', active && btnStatus === 'Absent');
          btn.classList.toggle('active-leave', active && btnStatus === 'Leave');
        });
      });
    }

    const summaryEl = document.getElementById(`${cfg.prefix}-summary`);
    if (summaryEl) {
      const filterNote = visibleStudents.length !== allStudents.length
        ? `Showing ${escapeHTML(visibleStudents.length)} of ${escapeHTML(allStudents.length)} &bull; `
        : '';
      summaryEl.innerHTML = `
        <span>${filterNote}Class Marked: <strong>${escapeHTML(countsAll.marked)} / ${escapeHTML(countsAll.total)}</strong></span>
        <span class="drill-pill att-pill-present">&#10003; Present: ${escapeHTML(countsVis.present)}</span>
        <span class="drill-pill att-pill-absent">&#10005; Absent: ${escapeHTML(countsVis.absent)}</span>
        <span class="drill-pill att-pill-leave">&#9719; Leave: ${escapeHTML(countsVis.leave)}</span>
        <span>Unmarked: ${escapeHTML(countsVis.unmarked)}</span>
      `;
    }

    const badgeEl = document.getElementById(`${cfg.prefix}-unsaved-badge`);
    if (badgeEl) {
      const dirty = !!state[cfg.dirtyKey];
      badgeEl.classList.toggle('is-dirty', dirty);
      if (dirty) {
        badgeEl.textContent = 'Unsaved edits — click Save below';
      } else if (savedSession) {
        badgeEl.textContent = `Saved roll (${countsAll.marked} marked)`;
      } else {
        badgeEl.textContent = 'Not saved for this date yet';
      }
    }

    const footerStatusEl = document.getElementById(`${cfg.prefix}-footer-status`);
    if (footerStatusEl) {
      footerStatusEl.textContent = `${countsAll.marked} / ${countsAll.total} students marked (P:${countsAll.present} • A:${countsAll.absent} • L:${countsAll.leave})`;
    }
  }

  async function refreshAttendanceModule(mode, options = {}) {
    const cfg = ATTENDANCE_MODES[mode];
    if (!cfg) return;

    const bc = document.getElementById(cfg.breadcrumbElId);
    const content = document.getElementById(cfg.contentElId);
    if (!bc || !content) return;

    const classId = state[cfg.classKey];
    const itemVal = state[cfg.itemKey];
    const todayStr = window.AppStorage.getLocalTodayDate();

    // Render Breadcrumb
    let bcHtml = `<button type="button" class="crumb-btn" id="${cfg.prefix}-bc-root">All Classes</button>`;
    if (classId) {
      const clsLabel = window.AppStorage.getClassLabel(classId);
      bcHtml += `<span class="crumb-sep">/</span>`;
      if (itemVal) {
        bcHtml += `<button type="button" class="crumb-btn" id="${cfg.prefix}-bc-class">${escapeHTML(clsLabel)}</button>`;
        bcHtml += `<span class="crumb-sep">/</span><span class="crumb-current">${escapeHTML(itemVal)}</span>`;
      } else {
        bcHtml += `<span class="crumb-current">${escapeHTML(clsLabel)}</span>`;
      }
    }
    bc.innerHTML = bcHtml;

    const rootBtn = document.getElementById(`${cfg.prefix}-bc-root`);
    if (rootBtn) {
      rootBtn.addEventListener('click', () => {
        if (!classId) return;
        guardUnsavedPortalEdits(() => {
          state[cfg.classKey] = null;
          state[cfg.itemKey] = null;
          state[cfg.dirtyKey] = false;
          refreshAttendanceModule(mode);
        });
      });
    }

    const classBcBtn = document.getElementById(`${cfg.prefix}-bc-class`);
    if (classBcBtn) {
      classBcBtn.addEventListener('click', () => {
        if (!itemVal) return;
        guardUnsavedPortalEdits(() => {
          state[cfg.itemKey] = null;
          state[cfg.dirtyKey] = false;
          refreshAttendanceModule(mode);
        });
      });
    }

    // LEVEL 0: All Classes (6th to 12th)
    if (!classId) {
      state[cfg.dirtyKey] = false;
      const classes = window.AppStorage.getClasses();
      const allSessions = await cfg.getSessions({});
      const cards = [];

      for (const c of classes) {
        const stus = await window.AppStorage.getStudentsByClass(c.id);
        const items = await cfg.getLevel1Items(c.id);
        const todayCount = allSessions.filter((s) => s.classId === c.id && s.date === todayStr).length;
        const itemLabel = mode === 'prep' ? '3 Prep Boxes' : `${items.length} Subjects`;

        cards.push(`
          <div class="drill-box" data-cid="${escapeHTML(c.id)}" tabindex="0" role="button">
            <div class="drill-box-top">
              <div>
                <div class="drill-box-title">${escapeHTML(c.label)}</div>
                <div class="drill-box-sub">${escapeHTML(stus.length)} ${stus.length === 1 ? 'Student' : 'Students'} &bull; ${escapeHTML(itemLabel)}</div>
              </div>
              <span class="drill-pill ${todayCount > 0 ? 'drill-pill-green' : ''}">${escapeHTML(todayCount)} / ${escapeHTML(items.length)} Today</span>
            </div>
            <div class="drill-box-footer">
              <span>${escapeHTML(cfg.level1Prompt)} &rarr;</span>
            </div>
          </div>
        `);
      }

      content.innerHTML = `<div class="drill-grid">${cards.join('')}</div>`;
      content.querySelectorAll('.drill-box').forEach((box) => {
        box.addEventListener('click', () => {
          state[cfg.classKey] = box.dataset.cid;
          state[cfg.itemKey] = null;
          state[cfg.secKey] = 'ALL';
          state[cfg.dirtyKey] = false;
          refreshAttendanceModule(mode);
        });
      });
      return;
    }

    // LEVEL 1: Subjects (Classes Attendance) OR Prep 1, Prep 2, Prep 3 (Prep Attendance)
    if (!itemVal) {
      state[cfg.dirtyKey] = false;
      const classLabel = window.AppStorage.getClassLabel(classId);
      const classStudents = await window.AppStorage.getStudentsByClass(classId);
      const items = await cfg.getLevel1Items(classId);
      const classSessions = await cfg.getSessions({ classId });

      content.innerHTML = `
        <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:12px;">
          ${escapeHTML(classLabel)} &mdash; ${mode === 'prep' ? 'Select Prep Box (Prep 1, 2, 3)' : 'Select Subject'}
        </h3>
        <div class="drill-grid">
          ${items.map((itemName) => {
            const matchingAll = classSessions.filter(
              (e) => window.AppStorage.normalizeText(e[cfg.itemField]).toLowerCase() === itemName.toLowerCase()
            );
            const todayEntry = matchingAll.find((e) => e.date === todayStr);
            const counts = todayEntry ? summarizeAttendanceDraft(classStudents, todayEntry.records || {}) : null;

            const subLine = counts
              ? `Today (${todayStr}): P:${counts.present} • A:${counts.absent} • L:${counts.leave}`
              : `${classStudents.length} Students • ${matchingAll.length} saved ${matchingAll.length === 1 ? 'date' : 'dates'}`;
            const pillHtml = counts
              ? `<span class="drill-pill drill-pill-green">&#10003; ${escapeHTML(counts.marked)}/${escapeHTML(classStudents.length)} Today</span>`
              : `<span class="drill-pill">${escapeHTML(matchingAll.length)} Saved</span>`;

            return `
              <div class="drill-box" data-item="${escapeHTML(itemName)}" tabindex="0" role="button">
                <div class="drill-box-top">
                  <div>
                    <div class="drill-box-title">${escapeHTML(itemName)}</div>
                    <div class="drill-box-sub">${escapeHTML(subLine)}</div>
                  </div>
                  ${pillHtml}
                </div>
                <div class="drill-box-footer">
                  <span>Open Student Roll (${escapeHTML(classStudents.length)}) &rarr;</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      content.querySelectorAll('.drill-box').forEach((box) => {
        box.addEventListener('click', () => {
          state[cfg.itemKey] = box.dataset.item;
          state[cfg.dateKey] = window.AppStorage.getLocalTodayDate();
          state[cfg.secKey] = 'ALL';
          state[cfg.dirtyKey] = false;
          state[cfg.draftKey] = {};
          refreshAttendanceModule(mode);
        });
      });
      return;
    }

    // LEVEL 2: All Students with Three Toggle Boxes (Present, Absent, Leave)
    const activeDate = window.AppStorage.isValidYmdDate(state[cfg.dateKey])
      ? state[cfg.dateKey]
      : todayStr;
    state[cfg.dateKey] = activeDate;

    const students = await window.AppStorage.getStudentsByClass(classId);
    const sessionsForItem = await cfg.getSessions({ classId, [cfg.itemField]: itemVal });
    const savedSession = sessionsForItem.find((e) => e.date === activeDate) || null;

    if (!options.preserveDraft) {
      state[cfg.draftKey] = savedSession && savedSession.records ? { ...savedSession.records } : {};
      state[cfg.dirtyKey] = false;
    }

    const sections = Array.from(new Set(students.map((s) => s.section).filter(Boolean)));
    if (state[cfg.secKey] !== 'ALL' && !sections.includes(state[cfg.secKey])) {
      state[cfg.secKey] = 'ALL';
    }
    const filteredStudents = state[cfg.secKey] === 'ALL'
      ? students
      : students.filter((s) => s.section === state[cfg.secKey]);

    const recentDatesHtml = sessionsForItem.length > 0
      ? `
        <div class="att-history-strip">
          <span class="att-history-label">Saved Dates:</span>
          ${sessionsForItem.slice(0, 8).map((entry) => {
            const c = summarizeAttendanceDraft(students, entry.records || {});
            const isCurrent = entry.date === activeDate;
            return `
              <button
                type="button"
                class="att-history-chip ${isCurrent ? 'active' : ''}"
                data-att-date="${escapeHTML(entry.date)}"
              >${escapeHTML(entry.date)} (P:${escapeHTML(c.present)} A:${escapeHTML(c.absent)} L:${escapeHTML(c.leave)})</button>
            `;
          }).join('')}
        </div>
      `
      : '';

    const sectionPillsHtml = sections.length > 1
      ? `
        <div class="att-section-pills" role="group" aria-label="Filter students by section">
          <button type="button" class="att-filter-pill ${state[cfg.secKey] === 'ALL' ? 'active' : ''}" data-att-sec="ALL">
            All (${escapeHTML(students.length)})
          </button>
          ${sections.map((sec) => `
            <button type="button" class="att-filter-pill ${state[cfg.secKey] === sec ? 'active' : ''}" data-att-sec="${escapeHTML(sec)}">
              ${escapeHTML(sec)}
            </button>
          `).join('')}
        </div>
      `
      : `<div><span class="drill-pill">${escapeHTML(students.length)} Students in Class</span></div>`;

    content.innerHTML = `
      <div class="att-toolbar">
        <div class="att-toolbar-top">
          <div>
            <h3 class="att-toolbar-title">${escapeHTML(itemVal)} &mdash; ${escapeHTML(window.AppStorage.getClassLabel(classId))}</h3>
            <p class="att-toolbar-sub">Mark Present, Absent, or Leave in front of each student and click Save.</p>
            <span id="${cfg.prefix}-unsaved-badge" class="tests-unsaved-badge" aria-live="polite" style="margin-top:6px;"></span>
          </div>
          <div class="att-toolbar-meta">
            <div class="att-date-field">
              <label for="${cfg.prefix}-date-input">Date:</label>
              <input type="date" id="${cfg.prefix}-date-input" class="att-date-input" value="${escapeHTML(activeDate)}" />
            </div>
          </div>
        </div>

        <div class="att-filter-bar">
          ${sectionPillsHtml}
          <div class="att-bulk-actions">
            <button type="button" class="btn btn-outline btn-sm" id="${cfg.prefix}-mark-all-present">&#10003; Mark All Present</button>
            <button type="button" class="btn btn-outline btn-sm" id="${cfg.prefix}-clear-draft">Clear View</button>
          </div>
        </div>

        ${recentDatesHtml}
      </div>

      <div id="${cfg.prefix}-summary" class="att-summary-bar" aria-live="polite"></div>

      <div id="${cfg.prefix}-rows-list" class="att-rows-list">
        ${filteredStudents.length === 0
          ? `<div class="empty-state"><h3>No Students Found</h3><p>No students belong to the selected class or section filter.</p></div>`
          : filteredStudents.map((s, idx) => `
              <div class="att-student-row" data-sid="${escapeHTML(s.id)}">
                <div class="att-student-info">
                  <div class="att-student-name">${idx + 1}. ${escapeHTML(s.name)}</div>
                  <div class="att-student-meta">Roll #${escapeHTML(s.rollNumber || '-')} &bull; ${escapeHTML(s.section || 'General')} &bull; Father: ${escapeHTML(s.family || '-')}</div>
                </div>
                <div class="att-status-group" role="group" aria-label="Attendance status for ${escapeHTML(s.name)}">
                  <button type="button" class="att-status-btn" data-sid="${escapeHTML(s.id)}" data-status="Present" aria-pressed="false">&#10003; Present</button>
                  <button type="button" class="att-status-btn" data-sid="${escapeHTML(s.id)}" data-status="Absent" aria-pressed="false">&#10005; Absent</button>
                  <button type="button" class="att-status-btn" data-sid="${escapeHTML(s.id)}" data-status="Leave" aria-pressed="false">&#9719; Leave</button>
                </div>
              </div>
            `).join('')
        }
      </div>

      <div class="att-footer">
        <span id="${cfg.prefix}-footer-status" style="font-size:0.84rem; font-weight:700; color:var(--navy);"></span>
        <button type="button" class="btn btn-primary" id="${cfg.prefix}-btn-save">
          Save ${escapeHTML(cfg.title)}
        </button>
      </div>
    `;

    syncAttendanceDraftDom(mode, students, filteredStudents, savedSession);

    // Per-student 3-box clicks (Present / Absent / Leave)
    const rowsContainer = document.getElementById(`${cfg.prefix}-rows-list`);
    if (rowsContainer) {
      rowsContainer.querySelectorAll('.att-status-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sid = btn.dataset.sid;
          const status = btn.dataset.status;
          state[cfg.draftKey][sid] = status;
          state[cfg.dirtyKey] = true;
          syncAttendanceDraftDom(mode, students, filteredStudents, savedSession);
        });
      });
    }

    // Mark All Present (visible section or full class)
    const markAllBtn = document.getElementById(`${cfg.prefix}-mark-all-present`);
    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => {
        filteredStudents.forEach((s) => {
          state[cfg.draftKey][s.id] = 'Present';
        });
        state[cfg.dirtyKey] = true;
        syncAttendanceDraftDom(mode, students, filteredStudents, savedSession);
      });
    }

    // Clear visible draft marks
    const clearBtn = document.getElementById(`${cfg.prefix}-clear-draft`);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        filteredStudents.forEach((s) => {
          delete state[cfg.draftKey][s.id];
        });
        state[cfg.dirtyKey] = true;
        syncAttendanceDraftDom(mode, students, filteredStudents, savedSession);
      });
    }

    // Section filter pills (preserve unsaved draft across sections)
    content.querySelectorAll('[data-att-sec]').forEach((pill) => {
      pill.addEventListener('click', () => {
        state[cfg.secKey] = pill.dataset.attSec;
        refreshAttendanceModule(mode, { preserveDraft: true });
      });
    });

    // Date switcher with unsaved guard
    const dateInput = document.getElementById(`${cfg.prefix}-date-input`);
    if (dateInput) {
      dateInput.addEventListener('change', () => {
        const chosen = dateInput.value;
        if (!window.AppStorage.isValidYmdDate(chosen)) {
          dateInput.value = activeDate;
          showToast('Please select a valid calendar date.', 'error');
          return;
        }
        if (chosen === activeDate) return;
        guardUnsavedPortalEdits(
          () => {
            state[cfg.dateKey] = chosen;
            state[cfg.dirtyKey] = false;
            refreshAttendanceModule(mode);
          },
          () => {
            dateInput.value = activeDate;
          }
        );
      });
    }

    // Recent saved dates quick chips
    content.querySelectorAll('[data-att-date]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const chosen = chip.dataset.attDate;
        if (chosen === activeDate) return;
        guardUnsavedPortalEdits(() => {
          state[cfg.dateKey] = chosen;
          state[cfg.dirtyKey] = false;
          refreshAttendanceModule(mode);
        });
      });
    });

    // Save button
    const saveBtn = document.getElementById(`${cfg.prefix}-btn-save`);
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const draft = state[cfg.draftKey] || {};
        if (Object.keys(draft).length === 0) {
          showToast('Mark Present, Absent, or Leave for at least one student before saving.', 'error');
          return;
        }
        try {
          await cfg.saveSession({
            classId,
            [cfg.itemField]: itemVal,
            date: activeDate,
            records: draft
          });
          state[cfg.dirtyKey] = false;
          showToast(`${cfg.title} saved for ${itemVal} (${activeDate})!`, 'success');
          await refreshAttendanceModule(mode);
          await updateHomeStats();
        } catch (err) {
          showToast(err.message || 'Unable to save attendance.', 'error', 5000);
        }
      });
    }
  }

  /* ========================================================================
     MODULE 2D: Health & Medical Records
     ======================================================================== */
  let healthKnownSupervisors = [];

  function clearHealthFormErrors() {
    ['val-health-student-name', 'val-health-class', 'val-health-supervisor', 'val-health-doctor', 'val-health-disease'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('visible');
    });
    ['health-input-student-name', 'health-select-class', 'health-input-supervisor', 'health-input-doctor', 'health-textarea-disease'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('is-invalid');
    });
    const errBanner = document.getElementById('health-form-error-banner');
    if (errBanner) errBanner.classList.add('hidden');
  }

  function applyHealthStudentPrefill(stu) {
    const idInp = document.getElementById('health-input-student-id');
    const nameInp = document.getElementById('health-input-student-name');
    const classSel = document.getElementById('health-select-class');
    const fatherInp = document.getElementById('health-input-father-name');
    const phoneInp = document.getElementById('health-input-phone');
    const statusEl = document.getElementById('health-match-status');
    if (!stu) return;

    if (idInp) idInp.value = stu.id;
    if (nameInp) nameInp.value = stu.name;
    if (classSel) classSel.value = window.AppStorage.normalizeClassId(stu.classId || stu.className);
    if (fatherInp) {
      fatherInp.value = stu.family && stu.family !== '-' ? stu.family : '';
      fatherInp.dataset.autofilled = 'true';
    }
    if (phoneInp) {
      const num = (stu.phone && stu.phone !== '-') ? stu.phone : ((stu.whatsapp && stu.whatsapp !== '-') ? stu.whatsapp : '');
      phoneInp.value = num;
      phoneInp.dataset.autofilled = 'true';
    }
    if (statusEl) {
      statusEl.className = 'violation-match-status matched';
      statusEl.textContent = `Auto-filled Father Name & Phone for ${stu.name} (${window.AppStorage.getClassLabel(stu.classId || stu.className)} • Roll #${stu.rollNumber || '-'})`;
    }
    ['val-health-student-name', 'val-health-class'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('visible');
    });
    if (nameInp) nameInp.classList.remove('is-invalid');
    if (classSel) classSel.classList.remove('is-invalid');
  }

  async function refreshHealthKnownDatalists() {
    const meta = await window.AppStorage.getKnownHealthMeta();
    healthKnownSupervisors = meta.supervisors || [];
    const supList = document.getElementById('health-supervisors-datalist');
    const docList = document.getElementById('health-doctors-datalist');
    if (supList) {
      supList.innerHTML = healthKnownSupervisors.map((s) => `<option value="${escapeHTML(s.name)}">`).join('');
    }
    if (docList) {
      docList.innerHTML = (meta.doctors || []).map((d) => `<option value="${escapeHTML(d)}">`).join('');
    }
  }

  async function updateHealthMatchStatus(autoFillSingleExact = false) {
    const statusEl = document.getElementById('health-match-status');
    const idInp = document.getElementById('health-input-student-id');
    const nameInp = document.getElementById('health-input-student-name');
    const classSel = document.getElementById('health-select-class');
    const fatherInp = document.getElementById('health-input-father-name');
    const phoneInp = document.getElementById('health-input-phone');
    if (!statusEl || !idInp || !nameInp || !classSel) return;

    const sid = idInp.value.trim();
    const typedName = nameInp.value.trim();
    const cid = classSel.value ? window.AppStorage.normalizeClassId(classSel.value) : '';

    if (sid) {
      const stu = await window.AppStorage.getStudentById(sid);
      const stuCid = stu ? window.AppStorage.normalizeClassId(stu.classId || stu.className) : '';
      if (stu && (!cid || stuCid === cid)) {
        statusEl.className = 'violation-match-status matched';
        statusEl.textContent = `Auto-filled Father Name & Phone for ${stu.name} (${window.AppStorage.getClassLabel(stuCid)} • Roll #${stu.rollNumber || '-'})`;
        return;
      }
      idInp.value = '';
    }

    if (!typedName) {
      if (fatherInp && fatherInp.dataset.autofilled === 'true') fatherInp.value = '';
      if (phoneInp && phoneInp.dataset.autofilled === 'true') phoneInp.value = '';
      statusEl.className = 'violation-match-status';
      statusEl.textContent = 'Type student name or select from suggestions to auto-fill Father Name & Phone.';
      return;
    }

    const roster = await window.AppStorage.getAllRosterStudents();
    const normTyped = window.AppStorage.normalizeText(typedName).toLowerCase();
    const exactSameClass = cid
      ? roster.filter((s) => window.AppStorage.normalizeText(s.name).toLowerCase() === normTyped && window.AppStorage.normalizeClassId(s.classId || s.className) === cid)
      : roster.filter((s) => window.AppStorage.normalizeText(s.name).toLowerCase() === normTyped);

    if (exactSameClass.length === 1) {
      if (autoFillSingleExact) {
        applyHealthStudentPrefill(exactSameClass[0]);
      } else {
        statusEl.className = 'violation-match-status unmatched';
        statusEl.textContent = `Matches ${exactSameClass[0].name} (Roll #${exactSameClass[0].rollNumber || '-'}) — pick suggestion or select class to auto-fill.`;
      }
    } else if (exactSameClass.length > 1) {
      statusEl.className = 'violation-match-status unmatched';
      statusEl.textContent = `Multiple students share the name "${typedName}" — pick the exact student from suggestions.`;
    } else {
      if (fatherInp && fatherInp.dataset.autofilled === 'true') {
        fatherInp.value = '';
        delete fatherInp.dataset.autofilled;
      }
      if (phoneInp && phoneInp.dataset.autofilled === 'true') {
        phoneInp.value = '';
        delete phoneInp.dataset.autofilled;
      }
      statusEl.className = 'violation-match-status';
      statusEl.textContent = 'Pick a suggested student or fill details for a new custom student record.';
    }
  }

  async function handleHealthNameInput(e) {
    state.healthDirty = true;
    const val = e.target.value.trim().toLowerCase();
    document.getElementById('health-input-student-id').value = '';
    document.getElementById('val-health-student-name').classList.remove('visible');
    e.target.classList.remove('is-invalid');
    const errBanner = document.getElementById('health-form-error-banner');
    if (errBanner) errBanner.classList.add('hidden');

    const dropdown = document.getElementById('health-autocomplete-list');
    if (!val) {
      dropdown.classList.remove('show');
      dropdown.innerHTML = '';
      await updateHealthMatchStatus(false);
      return;
    }

    const chosenCid = document.getElementById('health-select-class').value;
    const roster = await window.AppStorage.getAllRosterStudents();
    const matches = roster
      .filter((s) => s.name.toLowerCase().includes(val) || (s.rollNumber && s.rollNumber.toString().includes(val)))
      .sort((a, b) => {
        if (!chosenCid) return 0;
        const aMatch = window.AppStorage.normalizeClassId(a.classId || a.className) === chosenCid ? 0 : 1;
        const bMatch = window.AppStorage.normalizeClassId(b.classId || b.className) === chosenCid ? 0 : 1;
        return aMatch - bMatch;
      })
      .slice(0, 15);

    if (matches.length === 0) {
      dropdown.classList.remove('show');
      dropdown.innerHTML = '';
      await updateHealthMatchStatus(false);
      return;
    }

    dropdown.innerHTML = matches.map((s) => `
      <div class="autocomplete-item" data-id="${escapeHTML(s.id)}">
        <div>
          <strong>${escapeHTML(s.name)}</strong>
          <small style="color:var(--text-muted); margin-left:6px;">#${escapeHTML(s.rollNumber || '-')} &bull; Father: ${escapeHTML(s.family || '-')}</small>
        </div>
        <span class="drill-pill drill-pill-blue">${escapeHTML(window.AppStorage.getClassLabel(s.classId))}</span>
      </div>
    `).join('');
    dropdown.classList.add('show');
    await updateHealthMatchStatus(true);
  }

  async function handleHealthAutocompletePick(e) {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const stu = await window.AppStorage.getStudentById(item.dataset.id);
    if (!stu) return;

    state.healthDirty = true;
    applyHealthStudentPrefill(stu);
    document.getElementById('health-autocomplete-list').classList.remove('show');
    document.getElementById('health-input-supervisor').focus();
  }

  async function openHealthFormPage(prefillStudentId = null, prefillClassId = null) {
    state.healthFormOpen = true;
    state.healthDirty = false;
    clearHealthFormErrors();

    const form = document.getElementById('health-record-form');
    if (form) form.reset();
    document.getElementById('health-input-student-id').value = '';
    const dropdown = document.getElementById('health-autocomplete-list');
    if (dropdown) {
      dropdown.classList.remove('show');
      dropdown.innerHTML = '';
    }
    const fatherInp = document.getElementById('health-input-father-name');
    const phoneInp = document.getElementById('health-input-phone');
    const supPhoneInp = document.getElementById('health-input-supervisor-phone');
    if (fatherInp) delete fatherInp.dataset.autofilled;
    if (phoneInp) delete phoneInp.dataset.autofilled;
    if (supPhoneInp) delete supPhoneInp.dataset.autofilled;

    await refreshHealthKnownDatalists();

    const stuId = prefillStudentId !== null ? prefillStudentId : state.healthStudentId;
    const clsId = prefillClassId !== null ? prefillClassId : state.healthClassId;

    if (stuId) {
      const stu = await window.AppStorage.getStudentById(stuId);
      if (stu) applyHealthStudentPrefill(stu);
    } else if (clsId) {
      document.getElementById('health-select-class').value = clsId;
      await updateHealthMatchStatus(false);
    } else {
      await updateHealthMatchStatus(false);
    }

    await refreshHealthModule();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      if (stuId) document.getElementById('health-input-supervisor').focus();
      else document.getElementById('health-input-student-name').focus();
    }, 30);
  }

  function closeHealthFormPage(bypassDirtyCheck = false) {
    if (!bypassDirtyCheck && hasUnsavedHealthForm()) {
      guardUnsavedPortalEdits(() => closeHealthFormPage(true));
      return;
    }
    state.healthFormOpen = false;
    state.healthDirty = false;
    clearHealthFormErrors();
    refreshHealthModule();
  }

  async function executeHealthSave({ resolvedStudentId = null, allowCreateCustom = false }) {
    const nameInp = document.getElementById('health-input-student-name');
    const classSel = document.getElementById('health-select-class');
    const fatherInp = document.getElementById('health-input-father-name');
    const phoneInp = document.getElementById('health-input-phone');
    const supInp = document.getElementById('health-input-supervisor');
    const supPhoneInp = document.getElementById('health-input-supervisor-phone');
    const docInp = document.getElementById('health-input-doctor');
    const diseaseArea = document.getElementById('health-textarea-disease');
    const errBanner = document.getElementById('health-form-error-banner');

    try {
      const res = await window.AppStorage.addHealthRecord({
        studentId: resolvedStudentId,
        studentName: nameInp.value.trim(),
        classId: classSel.value,
        fatherName: fatherInp.value.trim(),
        phone: phoneInp.value.trim(),
        supervisorTeacher: supInp.value.trim(),
        supervisorPhone: supPhoneInp.value.trim(),
        doctorOrHospital: docInp.value.trim(),
        disease: diseaseArea.value.trim(),
        allowCreateCustom
      });

      if (errBanner) errBanner.classList.add('hidden');
      state.healthFormOpen = false;
      state.healthDirty = false;
      state.healthClassId = res.student.classId;
      state.healthStudentId = res.student.id;
      document.getElementById('health-record-form').reset();
      document.getElementById('health-input-student-id').value = '';

      showToast(`Medical record saved for ${res.student.name} at ${formatTimeOnly(res.record.createdAt)}!`, 'success');
      await refreshHealthModule();
      await updateHomeStats();
    } catch (err) {
      if (errBanner) {
        document.getElementById('health-error-details').textContent = err.message || 'Unable to save medical record.';
        errBanner.classList.remove('hidden');
      }
      showToast(err.message || 'Unable to save medical record.', 'error', 5000);
    }
  }

  async function handleHealthFormSubmit(e) {
    e.preventDefault();
    clearHealthFormErrors();

    const idInp = document.getElementById('health-input-student-id');
    const nameInp = document.getElementById('health-input-student-name');
    const classSel = document.getElementById('health-select-class');
    const supInp = document.getElementById('health-input-supervisor');
    const docInp = document.getElementById('health-input-doctor');
    const diseaseArea = document.getElementById('health-textarea-disease');

    const studentName = nameInp.value.trim();
    const classId = classSel.value;
    const supervisor = supInp.value.trim();
    const doctor = docInp.value.trim();
    const disease = diseaseArea.value.trim();

    let firstInvalid = null;
    if (!studentName) {
      nameInp.classList.add('is-invalid');
      document.getElementById('val-health-student-name').classList.add('visible');
      firstInvalid = firstInvalid || nameInp;
    }
    if (!classId) {
      classSel.classList.add('is-invalid');
      document.getElementById('val-health-class').classList.add('visible');
      firstInvalid = firstInvalid || classSel;
    }
    if (!supervisor) {
      supInp.classList.add('is-invalid');
      document.getElementById('val-health-supervisor').classList.add('visible');
      firstInvalid = firstInvalid || supInp;
    }
    if (!doctor) {
      docInp.classList.add('is-invalid');
      document.getElementById('val-health-doctor').classList.add('visible');
      firstInvalid = firstInvalid || docInp;
    }
    if (!disease) {
      diseaseArea.classList.add('is-invalid');
      document.getElementById('val-health-disease').classList.add('visible');
      firstInvalid = firstInvalid || diseaseArea;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    let resolvedId = idInp.value.trim() || null;
    if (resolvedId) {
      const stu = await window.AppStorage.getStudentById(resolvedId);
      if (!stu || window.AppStorage.normalizeClassId(stu.classId || stu.className) !== classId) {
        resolvedId = null;
      }
    }

    if (!resolvedId) {
      const roster = await window.AppStorage.getAllRosterStudents();
      const targetKey = window.AppStorage.getStudentKey(studentName, classId);
      const matches = roster.filter((s) => window.AppStorage.getStudentKey(s.name, s.classId || s.className) === targetKey);
      if (matches.length === 1) {
        resolvedId = matches[0].id;
      } else if (matches.length > 1) {
        nameInp.classList.add('is-invalid');
        showToast(`Multiple students named "${studentName}" exist in ${window.AppStorage.getClassLabel(classId)}. Pick one from suggestions.`, 'error', 4500);
        nameInp.focus();
        return;
      } else {
        openConfirmDialog({
          title: 'Create New Student Profile?',
          message: `"${studentName}" is not in ${window.AppStorage.getClassLabel(classId)}. Confirm adding them as a new custom student and saving this medical record?`,
          confirmLabel: 'Create & Save Record',
          confirmBtnClass: 'btn-primary',
          onConfirm: () => executeHealthSave({ resolvedStudentId: null, allowCreateCustom: true })
        });
        return;
      }
    }

    await executeHealthSave({ resolvedStudentId: resolvedId, allowCreateCustom: false });
  }

  async function renderHealthClassStudents() {
    const grid = document.getElementById('health-students-grid');
    const secContainer = document.getElementById('health-section-pills');
    if (!grid || !secContainer) return;

    const allStudents = await window.AppStorage.getStudentsByClass(state.healthClassId);
    const classHealth = await window.AppStorage.getHealthRecords({ classId: state.healthClassId });

    const byStudent = new Map();
    classHealth.forEach((rec) => {
      if (!byStudent.has(rec.studentId)) byStudent.set(rec.studentId, []);
      byStudent.get(rec.studentId).push(rec);
    });

    const sections = Array.from(new Set(allStudents.map((s) => s.section).filter(Boolean)));
    if (state.healthSectionFilter !== 'ALL' && !sections.includes(state.healthSectionFilter)) {
      state.healthSectionFilter = 'ALL';
    }

    if (sections.length > 1) {
      secContainer.innerHTML = `
        <div class="timeframe-pills" style="margin-bottom:14px;">
          <button type="button" class="tf-pill ${state.healthSectionFilter === 'ALL' ? 'active' : ''}" data-hsec="ALL">All (${escapeHTML(allStudents.length)})</button>
          ${sections.map((sec) => `<button type="button" class="tf-pill ${state.healthSectionFilter === sec ? 'active' : ''}" data-hsec="${escapeHTML(sec)}">${escapeHTML(sec)}</button>`).join('')}
        </div>
      `;
      secContainer.querySelectorAll('[data-hsec]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.healthSectionFilter = btn.dataset.hsec;
          renderHealthClassStudents();
        });
      });
    } else {
      secContainer.innerHTML = '';
    }

    let students = allStudents;
    if (state.healthSectionFilter !== 'ALL') {
      students = students.filter((s) => s.section === state.healthSectionFilter);
    }
    if (state.healthSearch.trim()) {
      const q = state.healthSearch.trim().toLowerCase();
      students = students.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
        (s.family && s.family.toLowerCase().includes(q))
      );
    }

    if (students.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><h3>No Students Found</h3><p>No student matches your search in this class.</p></div>';
      return;
    }

    grid.innerHTML = students.map((s) => {
      const records = byStudent.get(s.id) || [];
      const latest = records[0] || null;
      return `
        <div class="drill-box" data-sid="${escapeHTML(s.id)}" tabindex="0" role="button">
          <div class="drill-box-top">
            <div>
              <div class="drill-box-title">${escapeHTML(s.name)}</div>
              <div class="drill-box-sub">Roll #${escapeHTML(s.rollNumber || '-')} &bull; Father: ${escapeHTML(s.family || '-')}</div>
              <div class="drill-box-sub">Phone: ${escapeHTML(s.phone || s.whatsapp || '-')}</div>
            </div>
            <span class="drill-pill ${records.length > 0 ? 'tag-health-pill' : ''}">${escapeHTML(records.length)} ${records.length === 1 ? 'Visit' : 'Visits'}</span>
          </div>
          ${latest ? `<div style="font-size:0.76rem; color:var(--text-muted);">Latest (${escapeHTML(latest.visitDate || formatDateOnly(latest.createdAt))}): ${escapeHTML(latest.disease.slice(0, 55))}${latest.disease.length > 55 ? '…' : ''}</div>` : ''}
          <div class="drill-box-footer">
            <span>Open Complete Medical Report &rarr;</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.drill-box').forEach((box) => {
      box.addEventListener('click', () => {
        state.healthStudentId = box.dataset.sid;
        refreshHealthModule();
      });
    });
  }

  async function refreshHealthModule() {
    const browseView = document.getElementById('health-browse-view');
    const formView = document.getElementById('health-form-view');
    if (browseView) browseView.style.display = state.healthFormOpen ? 'none' : 'block';
    if (formView) formView.style.display = state.healthFormOpen ? 'block' : 'none';

    if (state.healthFormOpen) return;

    const bc = document.getElementById('health-breadcrumb');
    const content = document.getElementById('health-drill-content');
    if (!bc || !content) return;

    // Breadcrumb
    let bcHtml = `<button type="button" class="crumb-btn" id="health-bc-root">All Classes (6th–12th)</button>`;
    let stuObj = null;
    if (state.healthClassId) {
      const clsLabel = window.AppStorage.getClassLabel(state.healthClassId);
      bcHtml += `<span class="crumb-sep">/</span>`;
      if (state.healthStudentId) {
        stuObj = await window.AppStorage.getStudentById(state.healthStudentId);
        if (!stuObj) {
          state.healthStudentId = null;
        } else {
          bcHtml += `<button type="button" class="crumb-btn" id="health-bc-class">${escapeHTML(clsLabel)}</button>`;
          bcHtml += `<span class="crumb-sep">/</span><span class="crumb-current">${escapeHTML(stuObj.name)}</span>`;
        }
      }
      if (!state.healthStudentId) {
        bcHtml += `<span class="crumb-current">${escapeHTML(clsLabel)}</span>`;
      }
    }
    bc.innerHTML = bcHtml;

    const rootBtn = document.getElementById('health-bc-root');
    if (rootBtn) {
      rootBtn.addEventListener('click', () => {
        state.healthClassId = null;
        state.healthStudentId = null;
        state.healthSearch = '';
        state.healthSectionFilter = 'ALL';
        refreshHealthModule();
      });
    }
    const clsBtn = document.getElementById('health-bc-class');
    if (clsBtn) {
      clsBtn.addEventListener('click', () => {
        state.healthStudentId = null;
        refreshHealthModule();
      });
    }

    // LEVEL 0: All Classes (6th to 12th)
    if (!state.healthClassId) {
      const classes = window.AppStorage.getClasses();
      const allRecords = await window.AppStorage.getHealthRecords();
      const cards = [];
      for (const c of classes) {
        const stus = await window.AppStorage.getStudentsByClass(c.id);
        const clsCount = allRecords.filter((r) => window.AppStorage.normalizeClassId(r.classId) === c.id).length;
        cards.push(`
          <div class="drill-box" data-cid="${escapeHTML(c.id)}" tabindex="0" role="button">
            <div class="drill-box-top">
              <div>
                <div class="drill-box-title">${escapeHTML(c.label)}</div>
                <div class="drill-box-sub">${escapeHTML(stus.length)} ${stus.length === 1 ? 'Student' : 'Students'}</div>
              </div>
              <span class="drill-pill ${clsCount > 0 ? 'tag-health-pill' : ''}">${escapeHTML(clsCount)} ${clsCount === 1 ? 'Medical Visit' : 'Medical Visits'}</span>
            </div>
            <div class="drill-box-footer">
              <span>View Class Students &rarr;</span>
            </div>
          </div>
        `);
      }
      content.innerHTML = `<div class="drill-grid">${cards.join('')}</div>`;
      content.querySelectorAll('.drill-box').forEach((box) => {
        box.addEventListener('click', () => {
          state.healthClassId = box.dataset.cid;
          state.healthStudentId = null;
          state.healthSearch = '';
          state.healthSearchComposing = false;
          state.healthSectionFilter = 'ALL';
          refreshHealthModule();
        });
      });
      return;
    }

    // LEVEL 1: All Students inside Selected Class
    if (!state.healthStudentId) {
      const existingShell = document.getElementById('health-level1-shell');
      const needsMount = !existingShell || existingShell.dataset.classId !== String(state.healthClassId);
      if (needsMount) {
        content.innerHTML = `
          <div id="health-level1-shell" data-class-id="${escapeHTML(state.healthClassId)}">
            <div style="margin-bottom:12px;">
              <div class="search-box">
                <span class="search-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                <input type="search" id="health-student-search" class="search-input" value="${escapeHTML(state.healthSearch)}" placeholder="Search student name, roll #, or father name..." autocomplete="off" />
              </div>
            </div>
            <div id="health-section-pills"></div>
            <div id="health-students-grid" class="drill-grid"></div>
          </div>
        `;
        const searchInp = document.getElementById('health-student-search');
        searchInp.addEventListener('compositionstart', () => { state.healthSearchComposing = true; });
        searchInp.addEventListener('compositionend', (e) => {
          state.healthSearchComposing = false;
          state.healthSearch = e.target.value;
          renderHealthClassStudents();
        });
        searchInp.addEventListener('input', (e) => {
          state.healthSearch = e.target.value;
          if (!state.healthSearchComposing) renderHealthClassStudents();
        });
      }
      await renderHealthClassStudents();
      return;
    }

    // LEVEL 2: Complete Student Medical Report Page
    const summary = await window.AppStorage.getStudentHealthSummary(state.healthStudentId);
    const s = stuObj || await window.AppStorage.getStudentById(state.healthStudentId);
    if (!s) return;

    const latest = summary.latest;
    const clsLabel = window.AppStorage.getClassLabel(s.classId || s.className);

    content.innerHTML = `
      <div class="grand-dossier-container">
        <div class="dossier-header-card">
          <div class="dossier-id-row">
            <div>
              <h3 class="dossier-student-name">${escapeHTML(s.name)} — Medical Report</h3>
              <div class="dossier-meta-tags">
                <span class="dossier-tag">${escapeHTML(clsLabel)} &bull; Section ${escapeHTML(s.section || 'General')}</span>
                <span class="dossier-tag">Roll #${escapeHTML(s.rollNumber || '-')}</span>
              </div>
            </div>
            <div class="dossier-actions no-print">
              <button type="button" class="btn btn-health-plus btn-sm" id="btn-health-student-plus">
                <span class="health-plus-circle" aria-hidden="true">+</span>
                <span>Add Medical Visit</span>
              </button>
              <button type="button" class="btn btn-outline btn-sm" id="btn-health-print">&#128424; Print Report</button>
            </div>
          </div>
          <div class="dossier-guardian-row">
            <span>Father Name: <strong>${escapeHTML(s.family || '-')}</strong></span>
            <span>Phone: <strong>${escapeHTML(s.phone || '-')}</strong></span>
            <span>WhatsApp: <strong>${escapeHTML(s.whatsapp || s.phone || '-')}</strong></span>
          </div>
        </div>

        <div class="dossier-kpi-grid">
          <div class="kpi-box">
            <div class="kpi-label">Total Medical Visits</div>
            <div class="kpi-value" style="color:var(--health-rose);">${escapeHTML(summary.total)}</div>
            <div class="kpi-sub">Logged health reports</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Last Visit Date</div>
            <div class="kpi-value" style="font-size:1.12rem;">${escapeHTML(latest ? (latest.visitDate || formatDateOnly(latest.createdAt)) : 'None')}</div>
            <div class="kpi-sub">${escapeHTML(latest ? formatTimeOnly(latest.createdAt) : 'No visits logged')}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Latest Issue</div>
            <div class="kpi-value" style="font-size:1rem;">${escapeHTML(latest ? (latest.disease.slice(0, 32) + (latest.disease.length > 32 ? '…' : '')) : 'Healthy / Clear')}</div>
            <div class="kpi-sub">Most recent condition</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Last Doctor / Hospital</div>
            <div class="kpi-value" style="font-size:1rem;">${escapeHTML(latest ? latest.doctorOrHospital : '-')}</div>
            <div class="kpi-sub">${escapeHTML(latest ? `Supervisor: ${latest.supervisorTeacher}` : 'No clinic visit')}</div>
          </div>
        </div>

        ${summary.list.length === 0
          ? `<div class="empty-state">
              <div class="empty-state-icon" style="background:var(--health-soft); color:var(--health-rose);" aria-hidden="true">+</div>
              <h3>No Medical Reports Recorded Yet</h3>
              <p>Tap the + button to log a medical visit, disease details, doctor/hospital, and supervising teacher for ${escapeHTML(s.name)}.</p>
              <button type="button" class="btn btn-health-plus" id="btn-health-empty-plus">
                <span class="health-plus-circle" aria-hidden="true">+</span>
                <span>Add First Medical Record</span>
              </button>
            </div>`
          : `<div class="history-list">
              ${summary.list.map((rec) => `
                <article class="health-visit-card">
                  <div class="health-visit-header">
                    <div>
                      <span class="health-visit-dt">${escapeHTML(rec.visitDate || formatDateOnly(rec.createdAt))} &bull; ${escapeHTML(formatTimeOnly(rec.createdAt))}</span>
                      <div style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">Recorded: ${escapeHTML(formatDateTime(rec.createdAt))}</div>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm btn-danger no-print btn-del-health" data-hid="${escapeHTML(rec.id)}">Delete</button>
                  </div>

                  <div class="health-disease-box">
                    <span class="health-disease-lbl">Disease / Medical Condition &amp; Notes</span>
                    <div class="health-disease-text" dir="auto">${escapeHTML(rec.disease)}</div>
                  </div>

                  <div class="health-detail-grid">
                    <div class="health-meta-cell">
                      <small>Student Name &amp; Class</small>
                      <strong>${escapeHTML(rec.studentName)} (${escapeHTML(window.AppStorage.getClassLabel(rec.classId))})</strong>
                    </div>
                    <div class="health-meta-cell">
                      <small>Father Name</small>
                      <strong>${escapeHTML(rec.fatherName || '-')}</strong>
                    </div>
                    <div class="health-meta-cell">
                      <small>Parent Phone Number</small>
                      <strong>${escapeHTML(rec.phone || '-')}</strong>
                    </div>
                    <div class="health-meta-cell">
                      <small>Doctor / Hospital Name</small>
                      <strong>${escapeHTML(rec.doctorOrHospital)}</strong>
                    </div>
                    <div class="health-meta-cell">
                      <small>Supervisor Teacher</small>
                      <strong>${escapeHTML(rec.supervisorTeacher)}</strong>
                    </div>
                    <div class="health-meta-cell">
                      <small>Supervisor Teacher Number</small>
                      <strong>${escapeHTML(rec.supervisorPhone || '-')}</strong>
                    </div>
                  </div>
                </article>
              `).join('')}
            </div>`
        }
      </div>
    `;

    const stuPlusBtn = document.getElementById('btn-health-student-plus');
    if (stuPlusBtn) {
      stuPlusBtn.addEventListener('click', () => openHealthFormPage(s.id, s.classId));
    }
    const emptyPlusBtn = document.getElementById('btn-health-empty-plus');
    if (emptyPlusBtn) {
      emptyPlusBtn.addEventListener('click', () => openHealthFormPage(s.id, s.classId));
    }
    const printBtn = document.getElementById('btn-health-print');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }
    content.querySelectorAll('.btn-del-health').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hid = btn.dataset.hid;
        openConfirmDialog({
          title: 'Delete Medical Record?',
          message: 'Are you sure you want to delete this medical record?',
          confirmLabel: 'Delete Record',
          onConfirm: async () => {
            try {
              await window.AppStorage.deleteHealthRecord(hid);
              showToast('Medical record deleted.', 'success');
              await refreshHealthModule();
              await updateHomeStats();
            } catch (err) {
              showToast(err.message || 'Unable to delete medical record.', 'error');
            }
          }
        });
      });
    });
  }

  /* ========================================================================
     MODULE 2E: Student Detail & Complete Directory
     ======================================================================== */
  function clearStudentFormErrors() {
    const banner = document.getElementById('stu-form-error-banner');
    if (banner) banner.classList.add('hidden');
    [
      ['stu-input-name', 'val-stu-name'],
      ['stu-select-class', 'val-stu-class']
    ].forEach(([inpId, valId]) => {
      const inp = document.getElementById(inpId);
      const val = document.getElementById(valId);
      if (inp) inp.classList.remove('is-invalid');
      if (val) val.classList.remove('visible');
    });
  }

  async function openStudentDetailForm(editStudent = null) {
    state.stuFormOpen = true;
    state.stuFormDirty = false;
    clearStudentFormErrors();

    const form = document.getElementById('stu-detail-form');
    if (form) form.reset();

    const modeBadge = document.getElementById('stu-form-mode-badge');
    const titleEl = document.getElementById('stu-form-title');
    const idInp = document.getElementById('stu-input-edit-id');
    const nameInp = document.getElementById('stu-input-name');
    const clsSel = document.getElementById('stu-select-class');
    const rollInp = document.getElementById('stu-input-roll');
    const secInp = document.getElementById('stu-input-section');
    const fatherInp = document.getElementById('stu-input-father');
    const famNoInp = document.getElementById('stu-input-family-number');
    const phoneInp = document.getElementById('stu-input-phone');
    const waInp = document.getElementById('stu-input-whatsapp');
    const admittedInp = document.getElementById('stu-input-admitted');
    const statusSel = document.getElementById('stu-select-status');
    const notesInp = document.getElementById('stu-textarea-notes');

    if (editStudent) {
      if (modeBadge) modeBadge.textContent = editStudent.isOfficial ? 'Editing Official Record' : 'Editing Custom Record';
      if (titleEl) titleEl.textContent = `Edit Details — ${editStudent.name}`;
      if (idInp) idInp.value = editStudent.id || '';
      if (nameInp) nameInp.value = editStudent.name || '';
      if (clsSel) clsSel.value = window.AppStorage.normalizeClassId(editStudent.classId || editStudent.className);
      if (rollInp) rollInp.value = editStudent.rollNumber && editStudent.rollNumber !== '-' ? editStudent.rollNumber : '';
      if (secInp) secInp.value = editStudent.section || '';
      if (fatherInp) fatherInp.value = editStudent.family && editStudent.family !== '-' ? editStudent.family : '';
      if (famNoInp) famNoInp.value = editStudent.familyNumber || '';
      if (phoneInp) phoneInp.value = editStudent.phone && editStudent.phone !== '-' ? editStudent.phone : '';
      if (waInp) waInp.value = editStudent.whatsapp && editStudent.whatsapp !== '-' ? editStudent.whatsapp : '';
      if (admittedInp) admittedInp.value = editStudent.admitted && editStudent.admitted !== '-' ? editStudent.admitted : '';
      if (statusSel) statusSel.value = editStudent.status || 'Active';
      if (notesInp) notesInp.value = editStudent.notes || '';
    } else {
      if (modeBadge) modeBadge.textContent = 'New Student Record';
      if (titleEl) titleEl.textContent = 'Add New Student Details';
      if (idInp) idInp.value = '';
      if (clsSel) clsSel.value = state.stuDetailClassId || '';
      if (secInp) secInp.value = 'A';
      if (admittedInp) admittedInp.value = window.AppStorage.getLocalTodayDate();
      if (statusSel) statusSel.value = 'Active';
    }

    await refreshStudentDetailModule();
    setTimeout(() => {
      if (nameInp) nameInp.focus();
    }, 30);
  }

  function closeStudentDetailForm(bypassDirtyCheck = false) {
    if (!bypassDirtyCheck && hasUnsavedStudentForm()) {
      guardUnsavedPortalEdits(() => closeStudentDetailForm(true));
      return;
    }
    state.stuFormOpen = false;
    state.stuFormDirty = false;
    clearStudentFormErrors();
    refreshStudentDetailModule();
  }

  async function handleStudentDetailFormSubmit(e) {
    e.preventDefault();
    clearStudentFormErrors();

    const idInp = document.getElementById('stu-input-edit-id');
    const nameInp = document.getElementById('stu-input-name');
    const clsSel = document.getElementById('stu-select-class');
    const name = nameInp ? nameInp.value.trim() : '';
    const classId = clsSel ? clsSel.value : '';

    let firstInvalid = null;
    if (!name) {
      if (nameInp) nameInp.classList.add('is-invalid');
      const v = document.getElementById('val-stu-name');
      if (v) v.classList.add('visible');
      firstInvalid = firstInvalid || nameInp;
    }
    if (!classId) {
      if (clsSel) clsSel.classList.add('is-invalid');
      const v = document.getElementById('val-stu-class');
      if (v) v.classList.add('visible');
      firstInvalid = firstInvalid || clsSel;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    try {
      const saved = await window.AppStorage.saveStudentDetails({
        studentId: idInp && idInp.value ? idInp.value.trim() : null,
        name,
        classId,
        rollNumber: document.getElementById('stu-input-roll').value.trim(),
        section: document.getElementById('stu-input-section').value.trim(),
        family: document.getElementById('stu-input-father').value.trim(),
        familyNumber: document.getElementById('stu-input-family-number').value.trim(),
        phone: document.getElementById('stu-input-phone').value.trim(),
        whatsapp: document.getElementById('stu-input-whatsapp').value.trim(),
        admitted: document.getElementById('stu-input-admitted').value.trim(),
        status: document.getElementById('stu-select-status').value,
        notes: document.getElementById('stu-textarea-notes').value
      });

      state.stuFormOpen = false;
      state.stuFormDirty = false;
      state.stuDetailClassId = window.AppStorage.normalizeClassId(saved.classId || saved.className);
      state.stuDetailStudentId = saved.id;
      showToast(`Student details saved for ${saved.name}!`, 'success');
      await refreshStudentDetailModule();
      await updateHomeStats();
    } catch (err) {
      const banner = document.getElementById('stu-form-error-banner');
      const det = document.getElementById('stu-form-error-details');
      if (det) det.textContent = err.message || 'Unable to save student details.';
      if (banner) banner.classList.remove('hidden');
      showToast(err.message || 'Unable to save student details.', 'error');
    }
  }

  function matchesStudentDetailQuery(s, queryLower) {
    if (!queryLower) return true;
    const fields = [
      s.name,
      s.rollNumber,
      s.classId,
      window.AppStorage.getClassLabel(s.classId || s.className),
      s.section,
      s.family,
      s.familyNumber,
      s.phone,
      s.whatsapp,
      s.admitted,
      s.status,
      s.notes
    ];
    return fields.some((f) => String(f || '').toLowerCase().includes(queryLower));
  }

  function renderStudentDirectoryCardHtml(s, showClassLabel = false) {
    const clsLabel = window.AppStorage.getClassLabel(s.classId || s.className);
    const waDisplay = s.whatsapp || s.phone || '-';
    return `
      <div class="drill-box stu-dir-card" data-sid="${escapeHTML(s.id)}" data-cid="${escapeHTML(window.AppStorage.normalizeClassId(s.classId || s.className))}" tabindex="0" role="button">
        <div class="drill-box-top">
          <div>
            <div class="drill-box-title">${escapeHTML(s.name)}</div>
            <div class="drill-box-sub">${showClassLabel ? `${escapeHTML(clsLabel)} &bull; ` : ''}Roll #${escapeHTML(s.rollNumber || '-')} &bull; Sec ${escapeHTML(s.section || '-')}</div>
            <div class="drill-box-sub">Father: <strong>${escapeHTML(s.family || '-')}</strong>${s.familyNumber ? ` &bull; ${escapeHTML(s.familyNumber)}` : ''}</div>
            <div class="drill-box-sub">Phone: <strong>${escapeHTML(s.phone || '-')}</strong> &bull; WA: <strong>${escapeHTML(waDisplay)}</strong></div>
          </div>
          <span class="drill-pill ${s.hasOverride ? 'drill-pill-blue' : (!s.isOfficial ? 'tag-student-detail' : '')}">${escapeHTML(s.status || 'Active')}</span>
        </div>
        <div class="drill-box-footer">
          <span>View Full Details &rarr;</span>
        </div>
      </div>
    `;
  }

  async function renderStudentDetailGlobalResults() {
    const resultsWrap = document.getElementById('stu-global-results');
    const classesWrap = document.getElementById('stu-classes-overview');
    if (!resultsWrap || !classesWrap) return;

    const q = state.stuDetailGlobalSearch.trim().toLowerCase();
    if (!q) {
      resultsWrap.innerHTML = '';
      classesWrap.style.display = 'block';
      return;
    }

    classesWrap.style.display = 'none';
    const roster = await window.AppStorage.getAllRosterStudents();
    const matches = roster.filter((s) => matchesStudentDetailQuery(s, q));

    if (matches.length === 0) {
      resultsWrap.innerHTML = `<div class="empty-state"><h3>No Matching Students</h3><p>No student matches "${escapeHTML(state.stuDetailGlobalSearch.trim())}" across Name, Roll #, Father Name, Family #, Phone, or WhatsApp.</p></div>`;
      return;
    }

    resultsWrap.innerHTML = `
      <div style="margin-bottom:10px; font-size:0.86rem; font-weight:700; color:var(--text-muted);">
        Found ${escapeHTML(matches.length)} matching ${matches.length === 1 ? 'student' : 'students'}
      </div>
      <div class="drill-grid">${matches.map((s) => renderStudentDirectoryCardHtml(s, true)).join('')}</div>
    `;
    resultsWrap.querySelectorAll('.stu-dir-card').forEach((card) => {
      card.addEventListener('click', () => {
        state.stuDetailClassId = card.dataset.cid;
        state.stuDetailStudentId = card.dataset.sid;
        refreshStudentDetailModule();
      });
    });
  }

  async function renderStudentDetailClassStudents() {
    const pillsEl = document.getElementById('stu-section-pills');
    const gridEl = document.getElementById('stu-class-grid');
    if (!pillsEl || !gridEl || !state.stuDetailClassId) return;

    const allStudents = await window.AppStorage.getStudentsByClass(state.stuDetailClassId);
    const sections = Array.from(new Set(allStudents.map((s) => s.section).filter(Boolean)));
    if (state.stuDetailSectionFilter !== 'ALL' && !sections.includes(state.stuDetailSectionFilter)) {
      state.stuDetailSectionFilter = 'ALL';
    }

    if (sections.length > 1) {
      pillsEl.innerHTML = `
        <div class="timeframe-pills" style="margin-bottom:14px;">
          <button type="button" class="tf-pill ${state.stuDetailSectionFilter === 'ALL' ? 'active' : ''}" data-ssec="ALL">All (${escapeHTML(allStudents.length)})</button>
          ${sections.map((sec) => `<button type="button" class="tf-pill ${state.stuDetailSectionFilter === sec ? 'active' : ''}" data-ssec="${escapeHTML(sec)}">${escapeHTML(sec)}</button>`).join('')}
        </div>
      `;
      pillsEl.querySelectorAll('[data-ssec]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.stuDetailSectionFilter = btn.dataset.ssec;
          renderStudentDetailClassStudents();
        });
      });
    } else {
      pillsEl.innerHTML = '';
    }

    let filtered = state.stuDetailSectionFilter === 'ALL'
      ? allStudents
      : allStudents.filter((s) => s.section === state.stuDetailSectionFilter);

    const q = state.stuDetailSearch.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((s) => matchesStudentDetailQuery(s, q));
    }

    if (filtered.length === 0) {
      gridEl.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><h3>No Students Found</h3><p>No student matches your filter or search in this class.</p></div>';
      return;
    }

    gridEl.innerHTML = filtered.map((s) => renderStudentDirectoryCardHtml(s, false)).join('');
    gridEl.querySelectorAll('.stu-dir-card').forEach((card) => {
      card.addEventListener('click', () => {
        state.stuDetailStudentId = card.dataset.sid;
        refreshStudentDetailModule();
      });
    });
  }

  async function refreshStudentDetailModule() {
    const browseView = document.getElementById('stu-detail-browse-view');
    const formView = document.getElementById('stu-detail-form-view');
    if (browseView) browseView.style.display = state.stuFormOpen ? 'none' : 'block';
    if (formView) formView.style.display = state.stuFormOpen ? 'block' : 'none';
    if (state.stuFormOpen) return;

    const bc = document.getElementById('stu-detail-breadcrumb');
    const content = document.getElementById('stu-detail-drill-content');
    if (!bc || !content) return;

    let bcHtml = `<button type="button" class="crumb-btn" id="stu-bc-root">All Classes (6th–12th)</button>`;
    let stuObj = null;
    if (state.stuDetailClassId) {
      const clsLabel = window.AppStorage.getClassLabel(state.stuDetailClassId);
      bcHtml += `<span class="crumb-sep">/</span>`;
      if (state.stuDetailStudentId) {
        stuObj = await window.AppStorage.getStudentById(state.stuDetailStudentId);
        if (!stuObj) {
          state.stuDetailStudentId = null;
        } else {
          bcHtml += `<button type="button" class="crumb-btn" id="stu-bc-class">${escapeHTML(clsLabel)}</button>`;
          bcHtml += `<span class="crumb-sep">/</span><span class="crumb-current">${escapeHTML(stuObj.name)}</span>`;
        }
      }
      if (!state.stuDetailStudentId) {
        bcHtml += `<span class="crumb-current">${escapeHTML(clsLabel)}</span>`;
      }
    }
    bc.innerHTML = bcHtml;

    const rootBtn = document.getElementById('stu-bc-root');
    if (rootBtn) {
      rootBtn.addEventListener('click', () => {
        state.stuDetailClassId = null;
        state.stuDetailStudentId = null;
        state.stuDetailSearch = '';
        state.stuDetailSectionFilter = 'ALL';
        refreshStudentDetailModule();
      });
    }
    const clsBtn = document.getElementById('stu-bc-class');
    if (clsBtn) {
      clsBtn.addEventListener('click', () => {
        state.stuDetailStudentId = null;
        refreshStudentDetailModule();
      });
    }

    // LEVEL 0: Global Student Search + All 7 Class Boxes
    if (!state.stuDetailClassId) {
      const existingShell = document.getElementById('stu-level0-shell');
      if (!existingShell) {
        content.innerHTML = `
          <div id="stu-level0-shell">
            <div class="stu-search-banner">
              <div class="search-box">
                <span class="search-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                <input type="search" id="stu-global-search" class="search-input" value="${escapeHTML(state.stuDetailGlobalSearch)}" placeholder="Search ALL students by name, roll #, father name, family #, phone, or WhatsApp..." autocomplete="off" />
              </div>
            </div>
            <div id="stu-global-results"></div>
            <div id="stu-classes-overview"></div>
          </div>
        `;
        const gInp = document.getElementById('stu-global-search');
        gInp.addEventListener('compositionstart', () => { state.stuDetailComposing = true; });
        gInp.addEventListener('compositionend', (e) => {
          state.stuDetailComposing = false;
          state.stuDetailGlobalSearch = e.target.value;
          renderStudentDetailGlobalResults();
        });
        gInp.addEventListener('input', (e) => {
          state.stuDetailGlobalSearch = e.target.value;
          if (!state.stuDetailComposing) renderStudentDetailGlobalResults();
        });
      }

      const classes = window.AppStorage.getClasses();
      const cards = [];
      for (const c of classes) {
        const stus = await window.AppStorage.getStudentsByClass(c.id);
        const sections = Array.from(new Set(stus.map((s) => s.section).filter(Boolean)));
        cards.push(`
          <div class="drill-box stu-class-box" data-cid="${escapeHTML(c.id)}" tabindex="0" role="button">
            <div class="drill-box-top">
              <div>
                <div class="drill-box-title">${escapeHTML(c.label)}</div>
                <div class="drill-box-sub">${escapeHTML(stus.length)} ${stus.length === 1 ? 'Student' : 'Students'}${sections.length > 0 ? ` &bull; Sec: ${escapeHTML(sections.join(', '))}` : ''}</div>
              </div>
              <span class="drill-pill drill-pill-blue">${escapeHTML(c.badge || '')}</span>
            </div>
            <div class="drill-box-footer">
              <span>Browse Class Student Details &rarr;</span>
            </div>
          </div>
        `);
      }
      const classesWrap = document.getElementById('stu-classes-overview');
      if (classesWrap) {
        classesWrap.innerHTML = `<div class="drill-grid">${cards.join('')}</div>`;
        classesWrap.querySelectorAll('.stu-class-box').forEach((box) => {
          box.addEventListener('click', () => {
            state.stuDetailClassId = box.dataset.cid;
            state.stuDetailStudentId = null;
            state.stuDetailSearch = '';
            state.stuDetailComposing = false;
            state.stuDetailSectionFilter = 'ALL';
            refreshStudentDetailModule();
          });
        });
      }
      await renderStudentDetailGlobalResults();
      return;
    }

    // LEVEL 1: Selected Class Student List
    if (!state.stuDetailStudentId) {
      const existingL1 = document.getElementById('stu-level1-shell');
      const needsMount = !existingL1 || existingL1.dataset.classId !== String(state.stuDetailClassId);
      if (needsMount) {
        content.innerHTML = `
          <div id="stu-level1-shell" data-class-id="${escapeHTML(state.stuDetailClassId)}">
            <div style="margin-bottom:12px;">
              <div class="search-box">
                <span class="search-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                <input type="search" id="stu-class-search" class="search-input" value="${escapeHTML(state.stuDetailSearch)}" placeholder="Search by name, roll #, father name, family #, phone, or WhatsApp..." autocomplete="off" />
              </div>
            </div>
            <div id="stu-section-pills"></div>
            <div id="stu-class-grid" class="drill-grid"></div>
          </div>
        `;
        const cInp = document.getElementById('stu-class-search');
        cInp.addEventListener('compositionstart', () => { state.stuDetailComposing = true; });
        cInp.addEventListener('compositionend', (e) => {
          state.stuDetailComposing = false;
          state.stuDetailSearch = e.target.value;
          renderStudentDetailClassStudents();
        });
        cInp.addEventListener('input', (e) => {
          state.stuDetailSearch = e.target.value;
          if (!state.stuDetailComposing) renderStudentDetailClassStudents();
        });
      }
      await renderStudentDetailClassStudents();
      return;
    }

    // LEVEL 2: Complete Student Detail Profile Page
    const s = stuObj || await window.AppStorage.getStudentById(state.stuDetailStudentId);
    if (!s) return;
    const clsLabel = window.AppStorage.getClassLabel(s.classId || s.className);
    const primaryPhone = s.phone && s.phone !== '-' ? s.phone : '';
    const waDisplay = s.whatsapp && s.whatsapp !== '-' ? s.whatsapp : (primaryPhone || '-');
    const waHrefNum = formatPhoneForWa(waDisplay !== '-' ? waDisplay : primaryPhone);
    const telHrefNum = primaryPhone ? primaryPhone.replace(/[^\d+]/g, '') : '';

    content.innerHTML = `
      <div class="stu-detail-card">
        <div class="stu-detail-head">
          <div>
            <h3 class="stu-detail-name">${escapeHTML(s.name)}</h3>
            <div class="stu-detail-badges">
              <span class="dossier-tag">${escapeHTML(clsLabel)} &bull; Section ${escapeHTML(s.section || 'General')}</span>
              <span class="dossier-tag">Roll #${escapeHTML(s.rollNumber || '-')}</span>
              <span class="dossier-tag">${escapeHTML(s.status || 'Active')}</span>
              <span class="dossier-tag">${s.isOfficial ? 'Official Roster' : 'Custom Added'}</span>
              ${s.hasOverride ? '<span class="dossier-tag">Edited</span>' : ''}
            </div>
          </div>
          <div class="stu-detail-actions no-print">
            <button type="button" class="btn btn-primary btn-sm" id="btn-stu-edit">Edit Details</button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-stu-detail-print">&#128424; Print</button>
            ${s.hasOverride ? '<button type="button" class="btn btn-outline btn-sm" id="btn-stu-reset-official">Reset Official</button>' : ''}
            ${!s.isOfficial ? '<button type="button" class="btn btn-danger btn-sm" id="btn-stu-delete-custom">Remove</button>' : ''}
          </div>
        </div>

        <div class="stu-detail-grid">
          <div class="stu-detail-item">
            <span class="stu-detail-label">Student Name</span>
            <span class="stu-detail-value">${escapeHTML(s.name)}</span>
          </div>
          <div class="stu-detail-item">
            <span class="stu-detail-label">Student ID</span>
            <span class="stu-detail-value">${escapeHTML(s.id)}</span>
          </div>
          <div class="stu-detail-item">
            <span class="stu-detail-label">Class &amp; Section</span>
            <span class="stu-detail-value">${escapeHTML(clsLabel)} &mdash; Section ${escapeHTML(s.section || 'General')}</span>
          </div>
          <div class="stu-detail-item">
            <span class="stu-detail-label">Roll Number</span>
            <span class="stu-detail-value">${escapeHTML(s.rollNumber || '-')}</span>
          </div>
          <div class="stu-detail-item">
            <span class="stu-detail-label">Father / Guardian Name</span>
            <span class="stu-detail-value">${escapeHTML(s.family || '-')}</span>
          </div>
          <div class="stu-detail-item">
            <span class="stu-detail-label">Family Code / Number</span>
            <span class="stu-detail-value">${escapeHTML(s.familyNumber || '-')}</span>
          </div>
          <div class="stu-detail-item">
            <span class="stu-detail-label">Primary / Father Phone Number</span>
            <span class="stu-detail-value">${escapeHTML(s.phone || '-')}</span>
            ${telHrefNum ? `
              <div class="stu-detail-phone-actions no-print">
                <a class="btn btn-outline btn-sm" href="tel:${escapeHTML(telHrefNum)}">Call</a>
                <button type="button" class="btn btn-outline btn-sm" id="btn-stu-copy-phone">Copy</button>
              </div>
            ` : ''}
          </div>
          <div class="stu-detail-item">
            <span class="stu-detail-label">WhatsApp Number</span>
            <span class="stu-detail-value">${escapeHTML(waDisplay)}</span>
            ${waHrefNum ? `
              <div class="stu-detail-phone-actions no-print">
                <a class="btn btn-success btn-sm" href="https://wa.me/${escapeHTML(waHrefNum)}" target="_blank" rel="noopener">WhatsApp</a>
                <button type="button" class="btn btn-outline btn-sm" id="btn-stu-copy-wa">Copy</button>
              </div>
            ` : ''}
          </div>
          <div class="stu-detail-item">
            <span class="stu-detail-label">Admission Date</span>
            <span class="stu-detail-value">${escapeHTML(s.admitted || '-')}</span>
          </div>
          <div class="stu-detail-item">
            <span class="stu-detail-label">Enrollment Status</span>
            <span class="stu-detail-value">${escapeHTML(s.status || 'Active')}</span>
          </div>
          <div class="stu-detail-item stu-detail-item-full">
            <span class="stu-detail-label">Additional Details / Address / Notes</span>
            <span class="stu-detail-value" dir="auto">${escapeHTML(s.notes || 'No extra notes added.')}</span>
          </div>
        </div>

        <div class="stu-detail-links-bar no-print">
          <button type="button" class="btn btn-outline btn-sm" id="btn-stu-open-grand">Open Grand Student Report &rarr;</button>
          <button type="button" class="btn btn-outline btn-sm" id="btn-stu-open-health">Open Health &amp; Medical Report &rarr;</button>
          <button type="button" class="btn btn-outline btn-sm" id="btn-stu-open-violations">Open Violation Record &rarr;</button>
        </div>
      </div>
    `;

    const editBtn = document.getElementById('btn-stu-edit');
    if (editBtn) editBtn.addEventListener('click', () => openStudentDetailForm(s));

    const printBtn = document.getElementById('btn-stu-detail-print');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const copyPhoneBtn = document.getElementById('btn-stu-copy-phone');
    if (copyPhoneBtn) copyPhoneBtn.addEventListener('click', () => copyTextSafe(s.phone, 'Phone number'));

    const copyWaBtn = document.getElementById('btn-stu-copy-wa');
    if (copyWaBtn) copyWaBtn.addEventListener('click', () => copyTextSafe(waDisplay, 'WhatsApp number'));

    const resetBtn = document.getElementById('btn-stu-reset-official');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        openConfirmDialog({
          title: 'Reset to Official Student Record?',
          message: `Revert custom edits for ${s.name} back to the original school directory record?`,
          confirmLabel: 'Reset Record',
          onConfirm: async () => {
            await window.AppStorage.resetOfficialStudentDetails(s.id);
            showToast(`Restored original details for ${s.name}.`, 'success');
            await refreshStudentDetailModule();
            await updateHomeStats();
          }
        });
      });
    }

    const delBtn = document.getElementById('btn-stu-delete-custom');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        openConfirmDialog({
          title: 'Remove Custom Student?',
          message: `Remove ${s.name} from the directory? (Only allowed when no attendance, violations, homework, health, or test records exist.)`,
          confirmLabel: 'Remove Student',
          onConfirm: async () => {
            try {
              await window.AppStorage.deleteCustomStudent(s.id);
              state.stuDetailStudentId = null;
              showToast(`Removed ${s.name}.`, 'success');
              await refreshStudentDetailModule();
              await updateHomeStats();
            } catch (err) {
              showToast(err.message || 'Unable to remove student.', 'error', 4500);
            }
          }
        });
      });
    }

    const openGrandBtn = document.getElementById('btn-stu-open-grand');
    if (openGrandBtn) openGrandBtn.addEventListener('click', () => window.PortalBridge.openGrandReport(s.id));

    const openHealthBtn = document.getElementById('btn-stu-open-health');
    if (openHealthBtn) {
      openHealthBtn.addEventListener('click', () => {
        state.healthClassId = window.AppStorage.normalizeClassId(s.classId || s.className);
        state.healthStudentId = s.id;
        state.healthFormOpen = false;
        switchScreen('health');
      });
    }

    const openViolBtn = document.getElementById('btn-stu-open-violations');
    if (openViolBtn) {
      openViolBtn.addEventListener('click', async () => {
        const stats = await window.AppStorage.getStudentsWithStats();
        const found = stats.find((x) => x.id === s.id);
        if (found) {
          openViolationDetailModal(s.id);
        } else {
          switchScreen('violations');
          switchViolationSubTab('form');
          document.getElementById('input-student-id').value = s.id;
          document.getElementById('select-class').value = window.AppStorage.normalizeClassId(s.classId || s.className);
          document.getElementById('input-student-name').value = s.name;
          await updateViolationMatchStatus();
        }
      });
    }
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
    if (state.testId && !activeTest) { state.testId = null; state.testClassId = null; state.testSubject = null; state.testsDirty = false; }

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

    document.getElementById('test-bc-root').onclick = () => {
      guardUnsavedTestMarks(() => { state.testId = null; state.testClassId = null; state.testSubject = null; refreshTestsModule(); });
    };
    const bTest = document.getElementById('test-bc-test');
    if (bTest) bTest.onclick = () => {
      guardUnsavedTestMarks(() => { state.testClassId = null; state.testSubject = null; refreshTestsModule(); });
    };
    const bCls = document.getElementById('test-bc-class');
    if (bCls) bCls.onclick = () => {
      guardUnsavedTestMarks(() => { state.testSubject = null; refreshTestsModule(); });
    };

    // LEVEL 0: Monthly Test Boxes List
    if (!activeTest) {
      state.testsDirty = false;
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
                    <div class="drill-box-sub">Created: ${escapeHTML(formatDateOnly(t.createdAt))} &bull; Default Max: ${escapeHTML(t.defaultTotalMarks)}</div>
                  </div>
                  <span class="drill-pill drill-pill-green">${escapeHTML(gradedSubjectsCount)} Subjects Graded</span>
                </div>
                <div class="drill-box-footer">
                  <span>Open Classes (6th–2nd Year) &rarr;</span>
                  <button type="button" class="btn btn-outline btn-sm btn-danger btn-del-test" data-tid="${escapeHTML(t.id)}">Delete</button>
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
          state.testsDirty = false;
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
              try {
                await window.AppStorage.deleteTest(tid);
                showToast('Monthly test deleted.', 'success');
                await refreshTestsModule();
                await updateHomeStats();
              } catch (err) {
                showToast(err.message || 'Unable to delete test.', 'error');
              }
            }
          });
        });
      });
      return;
    }

    // LEVEL 1: Classes 6th to 12th (2nd Year) inside Selected Test
    if (!state.testClassId) {
      state.testsDirty = false;
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
          <div class="drill-box" data-cid="${escapeHTML(c.id)}" tabindex="0" role="button">
            <div class="drill-box-top">
              <div>
                <div class="drill-box-title">${escapeHTML(c.label)}</div>
                <div class="drill-box-sub">${escapeHTML(stus.length)} ${stus.length === 1 ? 'Student' : 'Students'} &bull; ${escapeHTML(subjects.length)} ${subjects.length === 1 ? 'Subject' : 'Subjects'}</div>
              </div>
              <span class="drill-pill ${gradedSubjs > 0 ? 'drill-pill-green' : ''}">${escapeHTML(gradedSubjs)} / ${escapeHTML(subjects.length)} Graded</span>
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
          state.testsDirty = false;
          refreshTestsModule();
        });
      });
      return;
    }

    // LEVEL 2: Subjects inside Selected Class
    if (!state.testSubject) {
      state.testsDirty = false;
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
                    <div class="drill-box-sub">Total Marks: ${escapeHTML(totalMarks)}</div>
                  </div>
                  <span class="drill-pill ${gradedCount > 0 ? 'drill-pill-green' : ''}">${escapeHTML(gradedCount)} / ${escapeHTML(classStudents.length)} Graded</span>
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
          state.testSectionFilter = 'ALL';
          state.testsDirty = false;
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

    state.testsDirty = false;

    const sections = Array.from(new Set(students.map((s) => s.section).filter(Boolean)));
    const filteredStudents = state.testSectionFilter === 'ALL'
      ? students
      : students.filter((s) => s.section === state.testSectionFilter);

    let secPills = '';
    if (sections.length > 1) {
      secPills = `<div class="timeframe-pills" style="margin-bottom:12px;">
        <button type="button" class="tf-pill ${state.testSectionFilter === 'ALL' ? 'active' : ''}" data-sec="ALL">All (${escapeHTML(students.length)})</button>
        ${sections.map((sec) => `<button type="button" class="tf-pill ${state.testSectionFilter === sec ? 'active' : ''}" data-sec="${escapeHTML(sec)}">${escapeHTML(sec)}</button>`).join('')}
      </div>`;
    }

    content.innerHTML = `
      <div class="marks-sheet-card">
        <div class="marks-sheet-header">
          <div>
            <h3 style="font-size:1.15rem; font-weight:800;">${escapeHTML(state.testSubject)} — ${escapeHTML(window.AppStorage.getClassLabel(state.testClassId))}</h3>
            <p style="font-size:0.82rem; color:var(--text-muted);">${escapeHTML(activeTest.name)} &bull; Enter obtained marks (leave blank if ungraded; enter 0 for zero marks)</p>
            <span id="tests-unsaved-badge" class="tests-unsaved-badge" aria-live="polite">All changes saved</span>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
            <div>
              <label style="font-size:0.75rem; font-weight:700; display:block;" for="input-subj-total-marks">Total Marks</label>
              <input type="number" id="input-subj-total-marks" class="input-control input-sm" value="${escapeHTML(existingTotal)}" min="1" step="0.5" style="width:95px;" />
            </div>
            <div>
              <label style="font-size:0.75rem; font-weight:700; display:block;" for="input-subj-test-date">Test Date</label>
              <input type="date" id="input-subj-test-date" class="input-control input-sm" value="${escapeHTML(existingDate)}" />
            </div>
          </div>
        </div>
        <div id="marks-validation-msg" class="marks-validation-msg" style="display:none;" role="alert"></div>
        ${secPills}
        <div id="marks-entry-list">
          ${filteredStudents.map((s) => {
            const val = existingMarks[s.id] !== undefined && existingMarks[s.id] !== null && existingMarks[s.id] !== '' ? existingMarks[s.id] : '';
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
                  data-name="${escapeHTML(s.name)}"
                  value="${escapeHTML(val)}"
                  placeholder="Marks"
                />
                <span class="drill-pill marks-pct-badge" id="pct-${escapeHTML(s.id)}" style="min-width:64px; text-align:center;">
                  ${pct !== null ? `${escapeHTML(pct)}% (${escapeHTML(getGradeLabel(pct))})` : '-'}
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
    const dateInp = document.getElementById('input-subj-test-date');
    const valMsgEl = document.getElementById('marks-validation-msg');
    const dirtyBadgeEl = document.getElementById('tests-unsaved-badge');

    const updateUnsavedBadge = () => {
      if (!dirtyBadgeEl) return;
      if (state.testsDirty) {
        dirtyBadgeEl.className = 'tests-unsaved-badge is-dirty';
        dirtyBadgeEl.textContent = 'Unsaved edits — click Save Marks';
      } else {
        dirtyBadgeEl.className = 'tests-unsaved-badge';
        dirtyBadgeEl.textContent = 'All changes saved';
      }
    };

    const validateAndRefreshBadges = () => {
      const rawTot = totalInp.value.trim();
      const tot = rawTot === '' ? NaN : Number(rawTot);
      const totalValid = Number.isFinite(tot) && tot > 0;
      let firstError = totalValid ? '' : 'Total Marks must be a positive number greater than 0.';

      totalInp.classList.toggle('is-invalid', !totalValid);

      content.querySelectorAll('.marks-num-input').forEach((inp) => {
        const sid = inp.dataset.sid;
        const badge = document.getElementById(`pct-${sid}`);
        const raw = inp.value.trim();

        inp.classList.remove('is-invalid');
        if (raw === '') {
          badge.textContent = '-';
          badge.className = 'drill-pill marks-pct-badge';
          return;
        }

        const num = Number(raw);
        if (!totalValid || !Number.isFinite(num) || num < 0 || num > tot) {
          inp.classList.add('is-invalid');
          badge.textContent = 'Invalid';
          badge.className = 'drill-pill marks-pct-badge drill-pill-red';
          if (!firstError && totalValid) {
            firstError = `Marks for ${inp.dataset.name || 'student'} must be between 0 and ${tot}.`;
          }
        } else {
          const pct = Math.round((num / tot) * 100);
          badge.textContent = `${pct}% (${getGradeLabel(pct)})`;
          badge.className = `drill-pill marks-pct-badge ${pct >= 50 ? 'drill-pill-green' : 'drill-pill-red'}`;
        }
      });

      if (firstError) {
        valMsgEl.textContent = firstError;
        valMsgEl.style.display = 'block';
      } else {
        valMsgEl.textContent = '';
        valMsgEl.style.display = 'none';
      }

      return { valid: !firstError, total: tot, error: firstError };
    };

    totalInp.addEventListener('input', () => {
      state.testsDirty = true;
      updateUnsavedBadge();
      validateAndRefreshBadges();
    });
    dateInp.addEventListener('change', () => {
      state.testsDirty = true;
      updateUnsavedBadge();
    });
    content.querySelectorAll('.marks-num-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        state.testsDirty = true;
        updateUnsavedBadge();
        validateAndRefreshBadges();
      });
    });

    content.querySelectorAll('[data-sec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.sec === state.testSectionFilter) return;
        guardUnsavedTestMarks(() => {
          state.testSectionFilter = btn.dataset.sec;
          refreshTestsModule();
        });
      });
    });

    document.getElementById('btn-save-subject-marks').onclick = async () => {
      const check = validateAndRefreshBadges();
      if (!check.valid) {
        showToast(check.error || 'Please fix invalid marks before saving.', 'error');
        return;
      }

      const total = check.total;
      const dateVal = dateInp.value;
      const mergedMarks = { ...existingMarks };

      content.querySelectorAll('.marks-num-input').forEach((inp) => {
        const sid = inp.dataset.sid;
        const raw = inp.value.trim();
        if (raw === '') {
          delete mergedMarks[sid];
        } else {
          mergedMarks[sid] = Number(raw); // 0 stays numeric 0, distinct from blank ''
        }
      });

      try {
        await window.AppStorage.saveSubjectTestMarks(activeTest.id, state.testClassId, state.testSubject, total, mergedMarks, dateVal);
        state.testsDirty = false;
        showToast(`Saved marks for ${state.testSubject} (${window.AppStorage.getClassLabel(state.testClassId)})!`, 'success');
        refreshTestsModule();
      } catch (err) {
        showToast(err.message || 'Unable to save marks to browser storage. Unsaved edits remain on screen.', 'error');
      }
    };
  }

  /* ========================================================================
     MODULE 4: Grand Report (Classes -> Students -> Complete Dossier)
     ======================================================================== */
  async function renderGrandStudentResults() {
    const pillsEl = document.getElementById('grand-section-pills');
    const gridEl = document.getElementById('grand-students-grid');
    if (!pillsEl || !gridEl || !state.grandClassId) return;

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
        s.name.toLowerCase().includes(q) ||
        (s.rollNumber && s.rollNumber.toString().toLowerCase().includes(q)) ||
        (s.family && s.family.toLowerCase().includes(q))
      );
    }

    if (sections.length > 1) {
      pillsEl.innerHTML = `<div class="timeframe-pills" style="margin-bottom:12px;">
        <button type="button" class="tf-pill ${state.grandSectionFilter === 'ALL' ? 'active' : ''}" data-sec="ALL">All (${escapeHTML(students.length)})</button>
        ${sections.map((sec) => `<button type="button" class="tf-pill ${state.grandSectionFilter === sec ? 'active' : ''}" data-sec="${escapeHTML(sec)}">${escapeHTML(sec)}</button>`).join('')}
      </div>`;
      pillsEl.querySelectorAll('[data-sec]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.grandSectionFilter = btn.dataset.sec;
          renderGrandStudentResults();
        });
      });
    } else {
      pillsEl.innerHTML = '';
    }

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="empty-state" style="grid-column:1 / -1;">
          <h3>No Students Found</h3>
          <p>No student matches "${escapeHTML(state.grandSearch.trim() || state.grandSectionFilter)}" in ${escapeHTML(window.AppStorage.getClassLabel(state.grandClassId))}.</p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = filtered.map((s) => {
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
            <span class="drill-pill ${vCount > 0 ? 'drill-pill-red' : 'drill-pill-green'}">${escapeHTML(vCount)} Violations</span>
            <span class="drill-pill ${pCount > 0 ? 'drill-pill-amber' : 'drill-pill-blue'}">${escapeHTML(pCount)} Pending</span>
          </div>
          <div class="drill-box-footer">
            <span>Open Full Grand Report &rarr;</span>
          </div>
        </div>
      `;
    }).join('');

    gridEl.querySelectorAll('.grand-stu-card').forEach((card) => {
      card.addEventListener('click', () => {
        state.grandStudentId = card.dataset.sid;
        refreshGrandReportModule();
      });
    });
  }

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
          <div class="drill-box" data-cid="${escapeHTML(c.id)}" tabindex="0" role="button">
            <div class="drill-box-top">
              <div>
                <div class="drill-box-title">${escapeHTML(c.label)}</div>
                <div class="drill-box-sub">${escapeHTML(stus.length)} Active Students</div>
              </div>
              <span class="drill-pill drill-pill-blue">${escapeHTML(c.badge || '')}</span>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <span class="drill-pill ${clsViolations > 0 ? 'drill-pill-red' : ''}">${escapeHTML(clsViolations)} ${clsViolations === 1 ? 'Violation' : 'Violations'}</span>
              <span class="drill-pill ${clsPending > 0 ? 'drill-pill-amber' : ''}">${escapeHTML(clsPending)} Pending</span>
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
          state.grandSearchComposing = false;
          state.grandSectionFilter = 'ALL';
          refreshGrandReportModule();
        });
      });
      return;
    }

    // LEVEL 1: All Student Name Boxes of Selected Class (Persistent Search Shell)
    if (!state.grandStudentId) {
      const existingShell = document.getElementById('grand-level1-shell');
      const needsMount = !existingShell || existingShell.dataset.classId !== String(state.grandClassId);

      if (needsMount) {
        content.innerHTML = `
          <div id="grand-level1-shell" data-class-id="${escapeHTML(state.grandClassId)}">
            <div style="margin-bottom:12px;">
              <div class="search-box">
                <span class="search-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                <input type="search" id="grand-student-search" class="search-input" value="${escapeHTML(state.grandSearch)}" placeholder="Search student name, roll #, or father name..." autocomplete="off" />
              </div>
            </div>
            <div id="grand-section-pills"></div>
            <div id="grand-students-grid" class="drill-grid"></div>
          </div>
        `;

        const searchInp = document.getElementById('grand-student-search');
        searchInp.addEventListener('compositionstart', () => {
          state.grandSearchComposing = true;
        });
        searchInp.addEventListener('compositionend', (e) => {
          state.grandSearchComposing = false;
          state.grandSearch = e.target.value;
          renderGrandStudentResults();
        });
        searchInp.addEventListener('input', (e) => {
          state.grandSearch = e.target.value;
          if (!state.grandSearchComposing) {
            renderGrandStudentResults();
          }
        });
      }

      await renderGrandStudentResults();
      return;
    }

    // LEVEL 2: COMPLETE STUDENT GRAND REPORT (Everything of the student!)
    const dossier = await window.AppStorage.getStudentGrandReport(state.grandStudentId, { range: state.grandHwRange });
    if (!dossier) return;

    const s = dossier.student;
    const hw = dossier.homework;
    const viol = dossier.violations;
    const tst = dossier.tests;
    const att = dossier.attendance || {
      classAttendance: { total: 0, present: 0, absent: 0, leave: 0, percent: null, recent: [] },
      prepAttendance: { total: 0, present: 0, absent: 0, leave: 0, percent: null, recent: [] },
      combined: { total: 0, present: 0, absent: 0, leave: 0, percent: null }
    };
    const hlth = dossier.health || { list: [], total: 0, latest: null };

    const hwPct = hw.overall && hw.overall.percentage !== null ? `${hw.overall.percentage}%` : 'No Data';
    const hwRatio = hw.overall ? `${hw.overall.doneCount} / ${hw.overall.totalMarked}` : '0 / 0';
    const testPct = tst.overallPercent !== null ? `${tst.overallPercent}% (${getGradeLabel(tst.overallPercent)})` : 'No Tests';
    const classAttPct = att.classAttendance.percent !== null ? `${att.classAttendance.percent}%` : 'No Data';
    const prepAttPct = att.prepAttendance.percent !== null ? `${att.prepAttendance.percent}%` : 'No Data';

    const attMergedRecent = [
      ...att.classAttendance.recent.map((r) => ({ ...r, category: 'Class Subject' })),
      ...att.prepAttendance.recent.map((r) => ({ ...r, category: 'Prep Session' }))
    ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 12);

    const renderAttSummaryTile = (title, stats) => {
      const rateStr = stats.percent !== null ? `${stats.percent}% Present` : 'No Rolls Yet';
      return `
        <div class="kpi-box" style="box-shadow:none; background:var(--bg-muted-surface);">
          <div class="kpi-label">${escapeHTML(title)}</div>
          <div class="kpi-value" style="font-size:1.25rem;">${escapeHTML(rateStr)}</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
            <span class="drill-pill att-pill-present">&#10003; P: ${escapeHTML(stats.present)}</span>
            <span class="drill-pill att-pill-absent">&#10005; A: ${escapeHTML(stats.absent)}</span>
            <span class="drill-pill att-pill-leave">&#9719; L: ${escapeHTML(stats.leave)}</span>
          </div>
          <div class="kpi-sub" style="margin-top:6px;">${escapeHTML(stats.total)} recorded ${stats.total === 1 ? 'session' : 'sessions'}</div>
        </div>
      `;
    };

    // WhatsApp message formatter
    const waNumber = formatPhoneForWa(s.whatsapp || s.phone);
    const waSummaryText = encodeURIComponent(
      `*Hadi Education System Balkassar — Student Grand Report*\n` +
      `Student: *${s.name}* (Roll #${s.rollNumber})\n` +
      `Class: ${s.classLabel} (${s.section}) | Father: ${s.family}\n\n` +
      `• *Classes Attendance:* ${classAttPct} (P:${att.classAttendance.present}, A:${att.classAttendance.absent}, L:${att.classAttendance.leave})\n` +
      `• *Prep Attendance:* ${prepAttPct} (P:${att.prepAttendance.present}, A:${att.prepAttendance.absent}, L:${att.prepAttendance.leave})\n` +
      `• *Medical / Health Visits:* ${hlth.total}${hlth.latest ? ` (Latest: ${hlth.latest.disease.slice(0, 45)})` : ''}\n` +
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
              <button type="button" class="btn btn-outline btn-sm" id="btn-print-grand-report">&#128424; Print Report</button>
              ${waNumber ? `<a class="btn btn-success btn-sm" href="https://wa.me/${escapeHTML(waNumber)}?text=${escapeHTML(waSummaryText)}" target="_blank" rel="noopener">Share on WhatsApp</a>` : ''}
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
            <div class="kpi-value">${escapeHTML(viol.score)} / ${escapeHTML(window.AppStorage.MAX_SCORE)}</div>
            <div class="kpi-sub"><span class="status-badge ${escapeHTML(viol.statusClass)}">${escapeHTML(viol.statusLabel)}</span> (${escapeHTML(viol.total)} ${viol.total === 1 ? 'violation' : 'violations'})</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Homework Marking</div>
            <div class="kpi-value" style="color:var(--primary);">${escapeHTML(hwPct)}</div>
            <div class="kpi-sub">${escapeHTML(hwRatio)} Completed</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Pending Concepts</div>
            <div class="kpi-value" style="color:${hw.activePendingTasks.length > 0 ? '#d97706' : '#059669'};">${escapeHTML(hw.activePendingTasks.length)}</div>
            <div class="kpi-sub">${escapeHTML(hw.resolvedTasks.length)} cleared previously</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Monthly Test Avg</div>
            <div class="kpi-value" style="color:var(--emerald);">${escapeHTML(testPct)}</div>
            <div class="kpi-sub">${escapeHTML(tst.overallObtained)} / ${escapeHTML(tst.overallTotal)} marks</div>
          </div>
        </div>

        <!-- 2B. Attendance Overview (Classes Attendance & Prep Attendance) -->
        <div class="dossier-section-card">
          <div class="dossier-section-title">
            <span>Attendance Summary (Classes &amp; Prep)</span>
            <span class="drill-pill drill-pill-blue">
              ${att.combined.percent !== null ? `Overall: ${escapeHTML(att.combined.percent)}% (${escapeHTML(att.combined.present)} / ${escapeHTML(att.combined.total)})` : 'No Attendance Recorded'}
            </span>
          </div>
          <div class="drill-grid" style="margin-bottom:${attMergedRecent.length > 0 ? '16px' : '0'};">
            ${renderAttSummaryTile('Classes Attendance (Subject-Wise)', att.classAttendance)}
            ${renderAttSummaryTile('Prep Attendance (Prep 1–3)', att.prepAttendance)}
          </div>
          ${attMergedRecent.length === 0
            ? `<p style="font-size:0.875rem; color:var(--text-muted);">No class or prep attendance marked for this student yet.</p>`
            : `<div class="table-wrapper">
                <div class="table-scroll-container">
                  <table class="sheet-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Subject / Prep Box</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${attMergedRecent.map((item) => {
                        const pillCls = item.status === 'Present'
                          ? 'att-pill-present'
                          : item.status === 'Absent'
                            ? 'att-pill-absent'
                            : 'att-pill-leave';
                        return `
                          <tr>
                            <td>${escapeHTML(item.date)}</td>
                            <td>${escapeHTML(item.category)}</td>
                            <td><strong>${escapeHTML(item.label)}</strong></td>
                            <td><span class="drill-pill ${pillCls}">${escapeHTML(item.status)}</span></td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>`
          }
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
                          <td>${escapeHTML(sb.doneCount)} / ${escapeHTML(sb.totalMarked)}</td>
                          <td><span class="drill-pill ${sb.percentage >= 75 ? 'drill-pill-green' : sb.percentage >= 50 ? 'drill-pill-amber' : 'drill-pill-red'}">${escapeHTML(sb.percentage)}%</span></td>
                          <td>${sb.pendingCount > 0 ? `<span class="drill-pill drill-pill-amber">${escapeHTML(sb.pendingCount)} Unclear</span>` : 'All Clear'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>`
          }

          <h4 style="font-size:0.95rem; font-weight:800; margin-bottom:8px;">Active Pending Tasks (Unclear Concepts: ${escapeHTML(hw.activePendingTasks.length)})</h4>
          ${hw.activePendingTasks.length === 0
            ? `<p style="font-size:0.85rem; color:var(--emerald); font-weight:600;">No pending unclear concepts!</p>`
            : `<div class="pending-tasks-list">
                ${hw.activePendingTasks.map((pt) => `
                  <div class="pending-task-card">
                    <div class="pending-top">
                      <div>
                        <strong>${escapeHTML(pt.subject)}</strong> &bull; <small>${escapeHTML(formatDateOnly(pt.createdAt))} (${escapeHTML(pt.dayName)})</small>
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
            <span>Monthly Test Results (${escapeHTML(tst.tests.length)} ${tst.tests.length === 1 ? 'Test' : 'Tests'})</span>
          </div>
          ${tst.tests.length === 0
            ? `<p style="font-size:0.875rem; color:var(--text-muted);">No monthly test marks recorded for this student yet.</p>`
            : tst.tests.map((t) => `
                <div style="margin-bottom:16px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="font-size:0.95rem;">${escapeHTML(t.testName)}</strong>
                    <span class="drill-pill drill-pill-blue">Total: ${escapeHTML(t.testObtained)} / ${escapeHTML(t.testTotal)} (${escapeHTML(t.testPercent)}% &bull; ${escapeHTML(getGradeLabel(t.testPercent))})</span>
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
                              <td>${escapeHTML(sc.obtained)}</td>
                              <td>${escapeHTML(sc.total)}</td>
                              <td>${escapeHTML(sc.percent)}%</td>
                              <td><span class="drill-pill ${sc.percent >= 50 ? 'drill-pill-green' : 'drill-pill-red'}">${escapeHTML(getGradeLabel(sc.percent))}</span></td>
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
            <span>Violation &amp; Discipline Record (${escapeHTML(viol.total)})</span>
            <button type="button" class="btn btn-outline btn-sm no-print" id="btn-grand-add-violation">+ Log Violation</button>
          </div>
          <div class="meter-section" style="margin-bottom:14px;">
            <div class="meter-track"><div class="meter-fill-reveal" style="--meter-fill:${escapeHTML(viol.fillPercent)}%;"></div></div>
            <div class="meter-info">
              <span class="meter-score">Severity Score: ${escapeHTML(viol.score)} <span>/ ${escapeHTML(window.AppStorage.MAX_SCORE)}</span></span>
              <span class="status-badge ${escapeHTML(viol.statusClass)}">${escapeHTML(viol.statusLabel)}</span>
            </div>
          </div>
          ${viol.list.length === 0
            ? `<p style="font-size:0.875rem; color:var(--emerald); font-weight:600;">Clean discipline record — 0 violations.</p>`
            : `<div class="history-list">
                ${viol.list.map((c) => `
                  <div class="history-card">
                    <div class="history-card-header">
                      <span class="sev-chip sev-chip-${escapeHTML(c.severity.toLowerCase())}">${escapeHTML(c.severity)}</span>
                      <span class="history-time">${escapeHTML(formatDateTime(c.createdAt))}</span>
                    </div>
                    <div class="history-text" dir="auto">${escapeHTML(c.text)}</div>
                  </div>
                `).join('')}
              </div>`
          }
        </div>

        <!-- 6. Section D: Health & Medical History -->
        <div class="dossier-section-card">
          <div class="dossier-section-title">
            <span>Health &amp; Medical Records (${escapeHTML(hlth.total)})</span>
            <button type="button" class="btn btn-outline btn-sm no-print" id="btn-grand-add-health">+ Add Medical Visit</button>
          </div>
          ${hlth.list.length === 0
            ? `<p style="font-size:0.875rem; color:var(--text-muted);">No medical visits or health records logged for this student yet.</p>`
            : `<div class="history-list">
                ${hlth.list.map((hr) => `
                  <div class="health-visit-card" style="box-shadow:none;">
                    <div class="health-visit-header">
                      <span class="health-visit-dt">${escapeHTML(hr.visitDate || formatDateOnly(hr.createdAt))} &bull; ${escapeHTML(formatTimeOnly(hr.createdAt))}</span>
                      <span class="drill-pill">${escapeHTML(hr.doctorOrHospital)}</span>
                    </div>
                    <div class="health-disease-text" dir="auto">${escapeHTML(hr.disease)}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">
                      Supervisor: <strong>${escapeHTML(hr.supervisorTeacher)}</strong> (${escapeHTML(hr.supervisorPhone || '-')}) &bull; Recorded: ${escapeHTML(formatDateTime(hr.createdAt))}
                    </div>
                  </div>
                `).join('')}
              </div>`
          }
        </div>

      </div>
    `;

    const printBtn = document.getElementById('btn-print-grand-report');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }

    content.querySelectorAll('[data-grange]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.grandHwRange = btn.dataset.grange;
        refreshGrandReportModule();
      });
    });

    content.querySelectorAll('.btn-grand-resolve').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await window.AppStorage.resolvePendingTask(btn.dataset.hwid, s.id);
          showToast('Pending concept task cleared!', 'success');
          refreshGrandReportModule();
          updateHomeStats();
        } catch (err) {
          showToast(err.message || 'Unable to resolve task.', 'error');
        }
      });
    });

    const addViolBtn = document.getElementById('btn-grand-add-violation');
    if (addViolBtn) {
      addViolBtn.onclick = async () => {
        switchScreen('violations');
        switchViolationSubTab('form');
        document.getElementById('input-student-id').value = s.id;
        document.getElementById('input-student-name').value = s.name;
        document.getElementById('select-class').value = s.classId;
        await updateViolationMatchStatus();
        document.getElementById('textarea-complaint').focus();
      };
    }

    const addHealthBtn = document.getElementById('btn-grand-add-health');
    if (addHealthBtn) {
      addHealthBtn.onclick = async () => {
        state.healthClassId = s.classId;
        state.healthStudentId = s.id;
        switchScreen('health');
        await openHealthFormPage(s.id, s.classId);
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
    const fileInput = e.target;
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rawText = ev.target.result;
      fileInput.value = '';

      let json;
      try {
        json = JSON.parse(rawText);
      } catch (parseErr) {
        showToast('Invalid JSON syntax in backup file. Existing data unchanged.', 'error', 4500);
        return;
      }

      let validation;
      try {
        validation = await window.AppStorage.validateAndPreviewImportJSON(json);
      } catch (valErr) {
        showToast(valErr.message || 'Unsafe or invalid backup file. Existing data unchanged.', 'error', 5000);
        return;
      }

      const p = validation.preview;
      const detailsHtml = `
        <div class="confirm-details-row"><span>Schema Version</span><strong>v${escapeHTML(p.version)}</strong></div>
        <div class="confirm-details-row"><span>Exported</span><strong>${escapeHTML(p.exportedAt ? formatDateTime(p.exportedAt) : 'Unspecified')}</strong></div>
        <div class="confirm-details-row"><span>Violation Records</span><strong>${escapeHTML(p.complaintsCount)}</strong></div>
        <div class="confirm-details-row"><span>Homework Assignments</span><strong>${escapeHTML(p.homeworksCount)}</strong></div>
        <div class="confirm-details-row"><span>Classes Attendance Rolls</span><strong>${escapeHTML(p.classAttendanceCount || 0)}</strong></div>
        <div class="confirm-details-row"><span>Prep Attendance Rolls</span><strong>${escapeHTML(p.prepAttendanceCount || 0)}</strong></div>
        <div class="confirm-details-row"><span>Health / Medical Records</span><strong>${escapeHTML(p.healthRecordsCount || 0)}</strong></div>
        <div class="confirm-details-row"><span>Monthly Tests</span><strong>${escapeHTML(p.testsCount)}</strong></div>
        <div class="confirm-details-row"><span>Custom Students</span><strong>${escapeHTML(p.customStudentsCount)}</strong></div>
        <div class="confirm-details-row"><span>Custom Subjects</span><strong>${escapeHTML(p.customSubjectsCount)}</strong></div>
      `;

      openConfirmDialog({
        title: 'Restore Backup? (Replaces Current Data)',
        message: 'Validated backup ready. Restoring will replace all currently saved portal data in this browser (a temporary session recovery snapshot is saved automatically).',
        detailsHtml,
        confirmLabel: 'Replace & Restore',
        confirmBtnClass: 'btn-primary',
        onConfirm: async () => {
          try {
            const res = await window.AppStorage.importJSON(json);
            showToast(
              `Restored: ${res.complaintsCount} violations, ${res.homeworksCount} homeworks, ${res.classAttendanceCount || 0} class att, ${res.prepAttendanceCount || 0} prep att, ${res.healthRecordsCount || 0} health, ${res.testsCount} tests.`,
              'success',
              4500
            );
            switchScreen(state.currentScreen, true);
            await updateHomeStats();
          } catch (impErr) {
            showToast(impErr.message || 'Backup import failed. Existing data preserved.', 'error', 5000);
          }
        }
      });
    };
    reader.onerror = () => {
      fileInput.value = '';
      showToast('Failed to read the selected backup file.', 'error');
    };
    reader.readAsText(file);
  }

  /* ========================================================================
     Bind All Event Listeners
     ======================================================================== */
  function bindEvents() {
    // Brand, Sidebar Brand & Back to Home
    const brand = document.getElementById('brand-home-link');
    const sideBrand = document.getElementById('sidebar-brand-link');
    [brand, sideBrand].forEach((el) => {
      if (!el) return;
      el.addEventListener('click', () => switchScreen('home'));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          switchScreen('home');
        }
      });
    });

    document.querySelectorAll('.btn-back-home').forEach((b) => {
      b.addEventListener('click', () => switchScreen('home'));
    });

    // Desktop Collapsible Sidebar Toggle
    const toggleSidebarBtn = document.getElementById('btn-toggle-sidebar');
    const sidebarEl = document.getElementById('app-sidebar');
    if (toggleSidebarBtn && sidebarEl) {
      toggleSidebarBtn.addEventListener('click', () => {
        const collapsed = sidebarEl.classList.toggle('collapsed');
        toggleSidebarBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        toggleSidebarBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation');
      });
    }

    // Home Module Cards & Quick Actions
    document.querySelectorAll('.curved-action-card').forEach((card) => {
      card.addEventListener('click', () => switchScreen(card.dataset.target));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchScreen(card.dataset.target); }
      });
    });

    const qaViol = document.getElementById('qa-log-violation');
    if (qaViol) {
      qaViol.addEventListener('click', () => {
        switchScreen('violations');
        switchViolationSubTab('form');
        setTimeout(() => document.getElementById('input-student-name').focus(), 40);
      });
    }
    const qaHw = document.getElementById('qa-add-homework');
    if (qaHw) {
      qaHw.addEventListener('click', () => {
        state.hwMode = 'browse';
        switchScreen('homework');
        setTimeout(() => toggleHwFormDrawer(true), 40);
      });
    }
    const qaClassAtt = document.getElementById('qa-class-attendance');
    if (qaClassAtt) {
      qaClassAtt.addEventListener('click', () => {
        state.caClassId = null;
        state.caSubject = null;
        state.caDirty = false;
        switchScreen('class-attendance');
      });
    }
    const qaPrepAtt = document.getElementById('qa-prep-attendance');
    if (qaPrepAtt) {
      qaPrepAtt.addEventListener('click', () => {
        state.paClassId = null;
        state.paPrepSlot = null;
        state.paDirty = false;
        switchScreen('prep-attendance');
      });
    }
    const qaHealth = document.getElementById('qa-health');
    if (qaHealth) {
      qaHealth.addEventListener('click', () => {
        state.healthClassId = null;
        state.healthStudentId = null;
        state.healthFormOpen = false;
        state.healthDirty = false;
        switchScreen('health');
      });
    }
    const qaTest = document.getElementById('qa-create-test');
    if (qaTest) {
      qaTest.addEventListener('click', () => {
        state.testId = null;
        state.testClassId = null;
        state.testSubject = null;
        switchScreen('tests');
        setTimeout(() => {
          const trigger = document.getElementById('btn-show-create-test');
          if (trigger) trigger.click();
        }, 40);
      });
    }
    const qaStuDetail = document.getElementById('qa-student-detail');
    if (qaStuDetail) {
      qaStuDetail.addEventListener('click', () => {
        state.stuFormOpen = false;
        state.stuFormDirty = false;
        switchScreen('student-details');
        setTimeout(() => {
          const inp = document.getElementById('stu-global-search');
          if (inp) inp.focus();
        }, 40);
      });
    }
    const qaGrand = document.getElementById('qa-find-student');
    if (qaGrand) {
      qaGrand.addEventListener('click', () => {
        switchScreen('grand-report');
        setTimeout(() => {
          const inp = document.getElementById('grand-student-search');
          if (inp) inp.focus();
        }, 40);
      });
    }

    // Desktop Sidebar Nav & Mobile Bottom Nav
    document.querySelectorAll('.sidebar-nav .nav-link, .bottom-nav .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
    });

    // Global Utility Menu (CSV, JSON Backup, Import, Recovery Snapshot)
    const utilityBtn = document.getElementById('btn-utility-menu');
    const utilityDropdown = document.getElementById('utility-menu-dropdown');
    const restoreRecoveryBtn = document.getElementById('btn-restore-recovery');

    if (utilityBtn && utilityDropdown) {
      utilityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = utilityDropdown.hidden;
        if (restoreRecoveryBtn) {
          restoreRecoveryBtn.hidden = !window.AppStorage.hasRecoverySnapshot();
        }
        utilityDropdown.hidden = !willOpen;
        utilityBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) {
          const firstItem = utilityDropdown.querySelector('.utility-item:not([hidden])');
          if (firstItem) setTimeout(() => firstItem.focus(), 10);
        }
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#utility-menu-wrap')) {
          closeUtilityMenu(false);
        }
      });
    }

    document.getElementById('btn-export-csv').addEventListener('click', () => {
      closeUtilityMenu(false);
      handleExportCsv();
    });
    document.getElementById('btn-export-backup').addEventListener('click', () => {
      closeUtilityMenu(false);
      handleExportBackup();
    });
    document.getElementById('btn-import-backup').addEventListener('click', () => {
      closeUtilityMenu(false);
      document.getElementById('file-import-input').click();
    });
    document.getElementById('file-import-input').addEventListener('change', handleFileImportSelected);

    if (restoreRecoveryBtn) {
      restoreRecoveryBtn.addEventListener('click', () => {
        closeUtilityMenu(false);
        openConfirmDialog({
          title: 'Restore Pre-Import Snapshot?',
          message: 'Revert portal data back to the automatic snapshot captured right before your last JSON import?',
          confirmLabel: 'Restore Snapshot',
          confirmBtnClass: 'btn-primary',
          onConfirm: async () => {
            try {
              await window.AppStorage.restoreRecoverySnapshot();
              showToast('Pre-import recovery snapshot restored!', 'success');
              switchScreen(state.currentScreen, true);
              await updateHomeStats();
            } catch (err) {
              showToast(err.message || 'No recovery snapshot available.', 'error');
            }
          }
        });
      });
    }

    // Delegated Enter / Space Keyboard Activation for Card Grids & Banners
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const target = e.target;
        if (!target || target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
          return;
        }
        const roleBtn = target.closest('[role="button"]');
        if (roleBtn && mainEl.contains(roleBtn)) {
          e.preventDefault();
          roleBtn.click();
        }
      });
    }

    // Violations Sub-Tabs & Form
    document.querySelectorAll('#screen-violations .subtab-btn').forEach((b) => {
      b.addEventListener('click', () => switchViolationSubTab(b.dataset.vtab));
    });
    document.getElementById('btn-empty-add').addEventListener('click', () => switchViolationSubTab('form'));
    document.getElementById('btn-master-empty-add').addEventListener('click', () => switchViolationSubTab('form'));

    document.getElementById('input-student-name').addEventListener('input', handleViolationNameInput);
    document.getElementById('autocomplete-list').addEventListener('click', handleViolationAutocompletePick);
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        document.getElementById('autocomplete-list').classList.remove('show');
        const healthDropdown = document.getElementById('health-autocomplete-list');
        if (healthDropdown) healthDropdown.classList.remove('show');
      }
    });

    document.getElementById('textarea-complaint').addEventListener('input', (e) => {
      document.getElementById('char-counter').textContent = `${e.target.value.length} chars`;
      document.getElementById('val-complaint').classList.remove('visible');
      e.target.classList.remove('is-invalid');
      clearViolationBanners();
    });
    document.getElementById('select-class').addEventListener('change', async (e) => {
      document.getElementById('val-class').classList.remove('visible');
      e.target.classList.remove('is-invalid');
      clearViolationBanners();
      await updateViolationMatchStatus();
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
        clearViolationBanners();
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
    document.getElementById('modal-close-btn').addEventListener('click', () => closeViolationDetailModal(true));
    document.getElementById('student-detail-modal').addEventListener('click', (e) => {
      if (e.target.id === 'student-detail-modal') closeViolationDetailModal(true);
    });

    // Homework Top Box & Form
    document.getElementById('hw-banner-toggle').addEventListener('click', () => toggleHwFormDrawer());
    document.getElementById('hw-btn-cancel-form').addEventListener('click', () => toggleHwFormDrawer(false));
    document.getElementById('hw-select-class').addEventListener('change', (e) => populateHwFormSubjects(e.target.value));
    document.getElementById('hw-create-form').addEventListener('submit', handleHwFormProceed);
    document.getElementById('hw-btn-back-edit').addEventListener('click', () => {
      if (state.hwEditingId) {
        state.hwEditingId = null;
        state.hwDraftMeta = null;
        state.hwDraftMarks = {};
        toggleHwFormDrawer(false);
      } else {
        document.getElementById('hw-marking-panel').style.display = 'none';
        document.getElementById('hw-create-form').style.display = 'block';
      }
    });
    document.getElementById('hw-mark-all-done').addEventListener('click', async () => {
      Object.keys(state.hwDraftMarks).forEach((sid) => state.hwDraftMarks[sid].hwDone = true);
      const stus = await window.AppStorage.getStudentsByClass(state.hwDraftMeta.classId);
      renderHwDraftRows(stus);
    });
    document.getElementById('hw-mark-all-clear').addEventListener('click', async () => {
      Object.keys(state.hwDraftMarks).forEach((sid) => {
        state.hwDraftMarks[sid].conceptClear = true;
        state.hwDraftMarks[sid].conceptResolved = false;
        state.hwDraftMarks[sid].resolvedAt = null;
      });
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
    document.getElementById('hw-modal-close-btn').addEventListener('click', closeHwStudentReportModal);
    document.getElementById('hw-student-report-modal').addEventListener('click', (e) => {
      if (e.target.id === 'hw-student-report-modal') closeHwStudentReportModal();
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
      const defTotalRaw = document.getElementById('input-new-test-total').value.trim();
      const defTotalNum = defTotalRaw === '' ? 100 : Number(defTotalRaw);
      if (!name) { showToast('Please enter a test name.', 'error'); return; }
      if (!Number.isFinite(defTotalNum) || defTotalNum <= 0) {
        showToast('Default Total Marks must be a finite number greater than 0.', 'error');
        return;
      }

      try {
        await window.AppStorage.createTest({ name, defaultTotalMarks: defTotalNum });
        document.getElementById('create-test-form').reset();
        document.getElementById('input-new-test-total').value = '100';
        document.getElementById('create-test-form').style.display = 'none';
        document.getElementById('btn-show-create-test').style.display = 'flex';
        showToast(`Test box "${name}" created!`, 'success');
        refreshTestsModule();
        updateHomeStats();
      } catch (err) {
        showToast(err.message || 'Unable to create test.', 'error');
      }
    });

    // Health & Medical Records Form Events
    document.getElementById('btn-health-open-form').addEventListener('click', () => openHealthFormPage());
    document.getElementById('btn-health-form-back').addEventListener('click', () => closeHealthFormPage());
    document.getElementById('btn-health-form-cancel').addEventListener('click', () => closeHealthFormPage());
    document.getElementById('health-input-student-name').addEventListener('input', handleHealthNameInput);
    document.getElementById('health-autocomplete-list').addEventListener('click', handleHealthAutocompletePick);

    const markHealthInputEdited = (inputEl, valId) => {
      if (valId) {
        const valEl = document.getElementById(valId);
        if (valEl) valEl.classList.remove('visible');
      }
      inputEl.classList.remove('is-invalid');
      const errBanner = document.getElementById('health-form-error-banner');
      if (errBanner) errBanner.classList.add('hidden');
      state.healthDirty = true;
    };

    document.getElementById('health-select-class').addEventListener('change', async (e) => {
      markHealthInputEdited(e.target, 'val-health-class');
      await updateHealthMatchStatus(true);
    });
    ['health-input-father-name', 'health-input-phone', 'health-input-supervisor-phone'].forEach((id) => {
      document.getElementById(id).addEventListener('input', (e) => {
        delete e.target.dataset.autofilled;
        state.healthDirty = true;
      });
    });
    document.getElementById('health-input-supervisor').addEventListener('input', (e) => {
      markHealthInputEdited(e.target, 'val-health-supervisor');
      const supName = window.AppStorage.normalizeText(e.target.value).toLowerCase();
      const supPhoneInp = document.getElementById('health-input-supervisor-phone');
      if (supPhoneInp) {
        const match = supName ? healthKnownSupervisors.find((s) => s.name.toLowerCase() === supName) : null;
        if (match && match.phone && (!supPhoneInp.value.trim() || supPhoneInp.dataset.autofilled === 'true')) {
          supPhoneInp.value = match.phone;
          supPhoneInp.dataset.autofilled = 'true';
        } else if ((!match || !supName) && supPhoneInp.dataset.autofilled === 'true') {
          supPhoneInp.value = '';
          delete supPhoneInp.dataset.autofilled;
        }
      }
    });
    [
      ['health-input-doctor', 'val-health-doctor'],
      ['health-textarea-disease', 'val-health-disease']
    ].forEach(([inputId, valId]) => {
      document.getElementById(inputId).addEventListener('input', (e) => markHealthInputEdited(e.target, valId));
    });
    document.getElementById('health-record-form').addEventListener('submit', handleHealthFormSubmit);

    // Student Detail & Directory Form Events
    const stuAddBtn = document.getElementById('btn-stu-detail-add');
    if (stuAddBtn) stuAddBtn.addEventListener('click', () => openStudentDetailForm(null));
    const stuBackBtn = document.getElementById('btn-stu-form-back');
    if (stuBackBtn) stuBackBtn.addEventListener('click', () => closeStudentDetailForm());
    const stuCancelBtn = document.getElementById('btn-stu-form-cancel');
    if (stuCancelBtn) stuCancelBtn.addEventListener('click', () => closeStudentDetailForm());
    const stuForm = document.getElementById('stu-detail-form');
    if (stuForm) {
      stuForm.addEventListener('submit', handleStudentDetailFormSubmit);
      stuForm.addEventListener('input', (e) => {
        state.stuFormDirty = true;
        if (e.target && e.target.id === 'stu-input-name') {
          e.target.classList.remove('is-invalid');
          const v = document.getElementById('val-stu-name');
          if (v) v.classList.remove('visible');
        }
      });
      stuForm.addEventListener('change', (e) => {
        state.stuFormDirty = true;
        if (e.target && e.target.id === 'stu-select-class') {
          e.target.classList.remove('is-invalid');
          const v = document.getElementById('val-stu-class');
          if (v) v.classList.remove('visible');
        }
      });
    }

    // Unsaved marks browser unload protection
    window.addEventListener('beforeunload', (e) => {
      if (hasUnsavedTestMarks() || hasUnsavedAttendance() || hasUnsavedHealthForm() || hasUnsavedStudentForm()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Confirmation Dialog
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => closeConfirmDialog(true));
    document.getElementById('btn-confirm-proceed').addEventListener('click', async () => {
      const cb = state.confirmCallback;
      closeConfirmDialog(false);
      if (cb) await cb();
    });
    document.getElementById('confirm-modal').addEventListener('click', (e) => {
      if (e.target.id === 'confirm-modal') closeConfirmDialog(true);
    });

    // Global Dialog Escape & Focus Containment
    document.addEventListener('keydown', (e) => {
      const confirmModal = document.getElementById('confirm-modal');
      const violModal = document.getElementById('student-detail-modal');
      const hwModal = document.getElementById('hw-student-report-modal');
      const activeDialog = confirmModal.classList.contains('open')
        ? confirmModal
        : violModal.classList.contains('open')
          ? violModal
          : hwModal.classList.contains('open')
            ? hwModal
            : null;

      if (e.key === 'Escape') {
        if (confirmModal.classList.contains('open')) {
          e.preventDefault();
          closeConfirmDialog(true);
        } else if (violModal.classList.contains('open')) {
          e.preventDefault();
          closeViolationDetailModal(true);
        } else if (hwModal.classList.contains('open')) {
          e.preventDefault();
          closeHwStudentReportModal();
        } else if (utilityDropdown && !utilityDropdown.hidden) {
          e.preventDefault();
          closeUtilityMenu(true);
        }
        return;
      }

      if (e.key === 'Tab' && activeDialog) {
        const focusable = getFocusableElements(activeDialog);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Service Worker Safe Update Helpers
    window.__hesHasUnsavedWork = () => hasUnsavedTestMarks() || hasUnsavedAttendance() || hasUnsavedHealthForm() || hasUnsavedStudentForm() || !!state.hwFormOpen;
    window.__hesConfirmAndApplyUpdate = (worker) => {
      openConfirmDialog({
        title: 'Apply Portal Update?',
        message: 'You have an open form or unsaved edits. Save your work first or confirm reloading to apply the updated portal assets.',
        confirmLabel: 'Reload Update',
        confirmBtnClass: 'btn-primary',
        onConfirm: () => {
          state.testsDirty = false;
          state.caDirty = false;
          state.paDirty = false;
          state.healthDirty = false;
          state.healthFormOpen = false;
          state.stuFormDirty = false;
          state.stuFormOpen = false;
          if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    };
  }

  /* ========================================================================
     Portal Bridge (Safe Public Surface for Assistant Module)
     ======================================================================== */
  window.PortalBridge = {
    showToast,
    switchScreen: (screenName, bypassDirtyCheck = false) => {
      if (!SCREEN_META[screenName]) return false;
      switchScreen(screenName, bypassDirtyCheck);
      return true;
    },
    getCurrentScreen: () => state.currentScreen,
    hasUnsavedWork: (area = null) => {
      if (area === 'tests') return hasUnsavedTestMarks();
      if (area === 'class-attendance') return hasUnsavedAttendance('class');
      if (area === 'prep-attendance') return hasUnsavedAttendance('prep');
      if (area === 'homework') return !!state.hwFormOpen;
      if (area === 'health') return hasUnsavedHealthForm();
      if (area === 'student-details') return hasUnsavedStudentForm();
      return hasUnsavedTestMarks() || hasUnsavedAttendance() || hasUnsavedHealthForm() || hasUnsavedStudentForm() || !!state.hwFormOpen;
    },
    getUnsavedState: () => ({
      any: hasUnsavedTestMarks() || hasUnsavedAttendance() || hasUnsavedHealthForm() || hasUnsavedStudentForm() || !!state.hwFormOpen,
      currentScreen: state.currentScreen,
      areas: {
        tests: hasUnsavedTestMarks()
          ? { testId: state.testId, classId: state.testClassId, subject: state.testSubject }
          : null,
        'class-attendance': hasUnsavedAttendance('class')
          ? { classId: state.caClassId, subject: state.caSubject, date: state.caDate }
          : null,
        'prep-attendance': hasUnsavedAttendance('prep')
          ? { classId: state.paClassId, prepSlot: state.paPrepSlot, date: state.paDate }
          : null,
        homework: state.hwFormOpen
          ? { editingId: state.hwEditingId, draftMeta: state.hwDraftMeta ? { ...state.hwDraftMeta } : null }
          : null,
        health: hasUnsavedHealthForm() ? { open: true } : null,
        'student-details': hasUnsavedStudentForm() ? { open: true } : null
      }
    }),
    refreshAll: async () => {
      await updateHomeStats();
      const scr = state.currentScreen;
      if (scr === 'violations') await refreshViolationsModule();
      else if (scr === 'homework') await refreshHomeworkModule();
      else if (scr === 'class-attendance' && !hasUnsavedAttendance('class')) await refreshAttendanceModule('class');
      else if (scr === 'prep-attendance' && !hasUnsavedAttendance('prep')) await refreshAttendanceModule('prep');
      else if (scr === 'health' && !hasUnsavedHealthForm()) await refreshHealthModule();
      else if (scr === 'student-details' && !hasUnsavedStudentForm()) await refreshStudentDetailModule();
      else if (scr === 'tests' && !hasUnsavedTestMarks()) await refreshTestsModule();
      else if (scr === 'grand-report') await refreshGrandReportModule();
    },
    openStudentDetail: async (studentId) => {
      const stu = studentId ? await window.AppStorage.getStudentById(studentId) : null;
      const apply = () => {
        if (stu) {
          state.stuDetailClassId = window.AppStorage.normalizeClassId(stu.classId || stu.className);
          state.stuDetailStudentId = stu.id;
        } else {
          state.stuDetailClassId = null;
          state.stuDetailStudentId = null;
        }
        state.stuFormOpen = false;
        state.stuFormDirty = false;
        switchScreen('student-details', true);
      };
      if (
        state.currentScreen !== 'student-details' &&
        (hasUnsavedTestMarks() || hasUnsavedAttendance() || hasUnsavedHealthForm() || hasUnsavedStudentForm())
      ) {
        guardUnsavedPortalEdits(apply);
        return { ok: true, pendingGuard: true };
      }
      apply();
      return { ok: true, studentId: stu ? stu.id : null };
    },
    openGrandReport: async (studentId) => {
      const stu = studentId ? await window.AppStorage.getStudentById(studentId) : null;
      const apply = () => {
        if (stu) {
          state.grandClassId = window.AppStorage.normalizeClassId(stu.classId || stu.className);
          state.grandStudentId = stu.id;
        } else {
          state.grandClassId = null;
          state.grandStudentId = null;
        }
        switchScreen('grand-report', true);
      };
      if (
        state.currentScreen !== 'grand-report' &&
        (hasUnsavedTestMarks() || hasUnsavedAttendance() || hasUnsavedHealthForm() || hasUnsavedStudentForm())
      ) {
        guardUnsavedPortalEdits(apply);
        return { ok: true, pendingGuard: true };
      }
      apply();
      return { ok: true, studentId: stu ? stu.id : null };
    },
    escapeHTML
  };

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

    // Load optional web fonts non-blocking after initial render
    if (navigator.onLine !== false) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap';
      document.head.appendChild(fontLink);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

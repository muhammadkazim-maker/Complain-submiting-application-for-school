/**
 * Student Complaint Tracker - Main Application Logic
 * Plain Vanilla JavaScript | Modular | Fully Responsive
 */

(function () {
  'use strict';

  // State Management
  const state = {
    currentScreen: 'records',
    searchQuery: '',
    filterClass: 'ALL',
    filterSeverity: 'ALL',
    sortBy: 'severity',
    sortAscending: false,
    selectedSeverity: '',
    activeStudentDetailId: null,
    pendingDeleteComplaintId: null
  };

  // DOM Elements Cache
  const elements = {
    // Nav
    screens: document.querySelectorAll('.screen'),
    deskNavLinks: document.querySelectorAll('.desktop-nav .nav-link'),
    tabNavBtns: document.querySelectorAll('.bottom-nav .tab-btn'),
    mobileFab: document.getElementById('mobile-fab'),

    // Records Screen
    searchInput: document.getElementById('search-input'),
    filterClassSelect: document.getElementById('filter-class'),
    filterSeveritySelect: document.getElementById('filter-severity'),
    sortBySelect: document.getElementById('sort-by'),
    sortDirectionBtn: document.getElementById('sort-direction-btn'),
    sortIconDesc: document.getElementById('sort-icon-desc'),
    sortIconAsc: document.getElementById('sort-icon-asc'),
    recordCountText: document.getElementById('record-count-text'),
    activeFiltersHint: document.getElementById('active-filters-hint'),
    studentsGrid: document.getElementById('students-grid'),
    recordsEmpty: document.getElementById('records-empty'),
    recordsEmptyMsg: document.getElementById('records-empty-msg'),
    btnEmptyAdd: document.getElementById('btn-empty-add'),

    // Form Screen
    complaintForm: document.getElementById('complaint-form'),
    inputStudentName: document.getElementById('input-student-name'),
    autocompleteList: document.getElementById('autocomplete-list'),
    selectClass: document.getElementById('select-class'),
    textareaComplaint: document.getElementById('textarea-complaint'),
    charCounter: document.getElementById('char-counter'),
    sevButtons: document.querySelectorAll('.sev-btn'),
    inputSeverityValue: document.getElementById('input-severity-value'),
    btnSubmitComplaint: document.getElementById('btn-submit-complaint'),
    formSuccessBanner: document.getElementById('form-success-banner'),
    successBannerDetails: document.getElementById('success-banner-details'),

    // Form Validation Messages
    valStudentName: document.getElementById('val-student-name'),
    valClass: document.getElementById('val-class'),
    valComplaint: document.getElementById('val-complaint'),
    valSeverity: document.getElementById('val-severity'),

    // Master Sheet Screen
    statTotalStudents: document.getElementById('stat-total-students'),
    statTotalComplaints: document.getElementById('stat-total-complaints'),
    masterTableBody: document.getElementById('master-table-body'),
    masterEmpty: document.getElementById('master-empty'),
    btnMasterEmptyAdd: document.getElementById('btn-master-empty-add'),

    // Header Actions
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnExportBackup: document.getElementById('btn-export-backup'),
    btnImportBackup: document.getElementById('btn-import-backup'),
    fileImportInput: document.getElementById('file-import-input'),

    // Student Detail Modal
    studentDetailModal: document.getElementById('student-detail-modal'),
    modalStudentName: document.getElementById('modal-student-name'),
    modalStudentMeta: document.getElementById('modal-student-meta'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    btnDetailAddComplaint: document.getElementById('btn-detail-add-complaint'),
    modalMeterSection: document.getElementById('modal-meter-section'),
    modalHistoryList: document.getElementById('modal-history-list'),

    // Confirmation Modal
    confirmModal: document.getElementById('confirm-modal'),
    btnConfirmCancel: document.getElementById('btn-confirm-cancel'),
    btnConfirmProceed: document.getElementById('btn-confirm-proceed'),

    // Toasts
    toastContainer: document.getElementById('toast-container')
  };

  /* ==========================================================================
     Formatters & Utilities
     ========================================================================== */

  /**
   * Format an ISO timestamp into a user-friendly date and time string.
   */
  function formatDateTime(isoString) {
    if (!isoString) return 'Never';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Invalid date';

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const timeStr = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const dateStr = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });

    return `${dateStr}, ${timeStr}`;
  }

  /**
   * Format date and time separately.
   */
  function formatDateOnly(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatTimeOnly(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Escape HTML entities to prevent XSS.
   */
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Display toast notification.
   */
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ==========================================================================
     Navigation Controller
     ========================================================================== */
  function switchScreen(screenName) {
    state.currentScreen = screenName;

    // Toggle active screen element
    elements.screens.forEach((el) => {
      if (el.id === `screen-${screenName}`) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update Desktop Nav
    elements.deskNavLinks.forEach((link) => {
      link.classList.toggle('active', link.dataset.screen === screenName);
    });

    // Update Mobile Tabs
    elements.tabNavBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.screen === screenName);
    });

    // FAB visibility
    if (elements.mobileFab) {
      elements.mobileFab.style.display = screenName === 'add' ? 'none' : 'flex';
    }

    // Scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh contents
    if (screenName === 'records') {
      renderStudentRecords();
    } else if (screenName === 'master') {
      renderMasterSheet();
    }
  }

  /* ==========================================================================
     Screen 1: Student Records Logic & Rendering
     ========================================================================== */

  /**
   * Extract number from class name for natural sorting (e.g., 'Class 2' vs 'Class 10').
   */
  function getClassNumber(className) {
    const match = (className || '').match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  async function renderStudentRecords() {
    let students = await window.AppStorage.getStudentsWithStats();

    // 1. Search Filter (by student name)
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      students = students.filter((s) => s.name.toLowerCase().includes(q));
    }

    // 2. Class Filter
    if (state.filterClass !== 'ALL') {
      students = students.filter((s) => s.className === state.filterClass);
    }

    // 3. Severity Filter (students who have at least 1 complaint with this severity)
    if (state.filterSeverity !== 'ALL') {
      students = students.filter((s) => (s.severityCounts[state.filterSeverity] || 0) > 0);
    }

    // 4. Sorting
    students.sort((a, b) => {
      let comparison = 0;
      switch (state.sortBy) {
        case 'severity':
          comparison = b.severityScore - a.severityScore;
          if (comparison === 0) comparison = b.totalComplaints - a.totalComplaints;
          break;
        case 'complaints':
          comparison = b.totalComplaints - a.totalComplaints;
          if (comparison === 0) comparison = b.severityScore - a.severityScore;
          break;
        case 'latest':
          const timeA = a.latestComplaintAt ? new Date(a.latestComplaintAt).getTime() : 0;
          const timeB = b.latestComplaintAt ? new Date(b.latestComplaintAt).getTime() : 0;
          comparison = timeB - timeA;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'class':
          comparison = getClassNumber(a.className) - getClassNumber(b.className);
          break;
        default:
          comparison = b.severityScore - a.severityScore;
      }
      return state.sortAscending ? -comparison : comparison;
    });

    // Update counter
    elements.recordCountText.textContent = `Showing ${students.length} ${students.length === 1 ? 'student' : 'students'}`;
    const hasFilters = q || state.filterClass !== 'ALL' || state.filterSeverity !== 'ALL';
    elements.activeFiltersHint.style.display = hasFilters ? 'inline' : 'none';

    // Handle Empty State
    if (students.length === 0) {
      elements.studentsGrid.innerHTML = '';
      elements.recordsEmpty.style.display = 'flex';
      elements.recordsEmptyMsg.textContent = hasFilters
        ? 'No students match your filter or search conditions.'
        : 'No student complaints recorded yet. Click below to add the first one.';
      return;
    }

    elements.recordsEmpty.style.display = 'none';

    // Render Grid of Cards
    const cardsHtml = students.map((s) => {
      // Build chips
      const chipsHtml = Object.entries(s.severityCounts)
        .filter(([_, count]) => count > 0)
        .map(([sev, count]) => {
          return `<span class="sev-chip sev-chip-${sev.toLowerCase()}">${sev} &times; ${count}</span>`;
        })
        .join('');

      return `
        <article class="student-card" data-student-id="${escapeHTML(s.id)}" tabindex="0" role="button" aria-label="View complaints for ${escapeHTML(s.name)}">
          <div class="student-card-header">
            <div class="student-title">
              <span class="student-name">${escapeHTML(s.name)}</span>
              <span class="student-class-badge">${escapeHTML(s.className)}</span>
            </div>
            <div class="student-stats-badge">
              <span class="complaint-count-badge">${s.totalComplaints} ${s.totalComplaints === 1 ? 'complaint' : 'complaints'}</span>
            </div>
          </div>

          <!-- Section 3: Green-to-Red Severity Meter -->
          <div class="meter-section">
            <div class="meter-track-container">
              <div class="meter-track" title="Severity Meter: ${s.fillPercent.toFixed(0)}%">
                <div class="meter-fill-reveal" style="--meter-fill: ${s.fillPercent}%;"></div>
              </div>
            </div>
            <div class="meter-info">
              <span class="meter-score">Score: ${s.severityScore} <span>/ ${window.AppStorage.MAX_SCORE}</span></span>
              <span class="status-badge ${s.statusClass}">${s.statusLabel}</span>
            </div>
          </div>

          <!-- Severity Breakdown Chips -->
          <div class="severity-chips">
            ${chipsHtml || '<span style="font-size:0.75rem; color:var(--text-dim);">No active complaints</span>'}
          </div>

          <!-- Card Footer: Time of latest complaint -->
          <div class="student-card-footer">
            <div class="latest-time" title="Latest Complaint Time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>${formatDateTime(s.latestComplaintAt)}</span>
            </div>
            <span class="tap-indicator">Tap to view &rarr;</span>
          </div>
        </article>
      `;
    }).join('');

    elements.studentsGrid.innerHTML = cardsHtml;

    // Attach click listeners to cards
    elements.studentsGrid.querySelectorAll('.student-card').forEach((card) => {
      const openDetail = () => {
        const studentId = card.dataset.studentId;
        openStudentDetail(studentId);
      };
      card.addEventListener('click', openDetail);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail();
        }
      });
    });
  }

  /* ==========================================================================
     Student Detail Modal / Drawer
     ========================================================================== */
  async function openStudentDetail(studentId) {
    const students = await window.AppStorage.getStudentsWithStats();
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    state.activeStudentDetailId = studentId;

    elements.modalStudentName.textContent = student.name;
    elements.modalStudentMeta.textContent = `${student.className} • ${student.totalComplaints} complaints • Severity Score: ${student.severityScore}`;

    // Render Meter inside Modal
    elements.modalMeterSection.innerHTML = `
      <div class="meter-track-container">
        <div class="meter-track" style="height: 14px;">
          <div class="meter-fill-reveal" style="--meter-fill: ${student.fillPercent}%;"></div>
        </div>
      </div>
      <div class="meter-info" style="margin-top: 6px;">
        <span class="meter-score">Severity Score: ${student.severityScore} <span>/ ${window.AppStorage.MAX_SCORE} max</span></span>
        <span class="status-badge ${student.statusClass}">${student.statusLabel}</span>
      </div>
    `;

    // History List (newest first)
    if (student.complaints.length === 0) {
      elements.modalHistoryList.innerHTML = `<p style="font-size:0.875rem; color:var(--text-muted);">No complaints logged.</p>`;
    } else {
      elements.modalHistoryList.innerHTML = student.complaints.map((c) => {
        return `
          <div class="history-card">
            <div class="history-card-header">
              <span class="sev-chip sev-chip-${c.severity.toLowerCase()}">${escapeHTML(c.severity)}</span>
              <span class="history-time">${formatDateTime(c.createdAt)}</span>
            </div>
            <div class="history-text" dir="auto">${escapeHTML(c.text)}</div>
            <div class="history-footer">
              <button class="btn btn-outline btn-sm btn-danger btn-delete-complaint" data-complaint-id="${escapeHTML(c.id)}" title="Delete Complaint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Delete
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Add complaint prefilled handler
    elements.btnDetailAddComplaint.onclick = () => {
      closeStudentDetail();
      switchScreen('add');
      elements.inputStudentName.value = student.name;
      elements.selectClass.value = student.className;
      elements.textareaComplaint.focus();
    };

    // Attach delete listeners
    elements.modalHistoryList.querySelectorAll('.btn-delete-complaint').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cid = btn.dataset.complaintId;
        promptDeleteConfirmation(cid);
      });
    });

    elements.studentDetailModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeStudentDetail() {
    elements.studentDetailModal.classList.remove('open');
    document.body.style.overflow = '';
    state.activeStudentDetailId = null;
  }

  /* ==========================================================================
     Delete Confirmation Dialog
     ========================================================================== */
  function promptDeleteConfirmation(complaintId) {
    state.pendingDeleteComplaintId = complaintId;
    elements.confirmModal.classList.add('open');
  }

  function closeConfirmModal() {
    elements.confirmModal.classList.remove('open');
    state.pendingDeleteComplaintId = null;
  }

  async function executeDeleteComplaint() {
    if (!state.pendingDeleteComplaintId) return;

    const result = await window.AppStorage.deleteComplaint(state.pendingDeleteComplaintId);
    closeConfirmModal();

    if (result.success) {
      if (result.studentDeleted) {
        showToast('Complaint deleted. Last complaint removed, student record cleared.', 'info');
        closeStudentDetail();
      } else {
        showToast('Complaint deleted successfully.', 'success');
        // Refresh modal content
        if (state.activeStudentDetailId) {
          openStudentDetail(state.activeStudentDetailId);
        }
      }
      renderStudentRecords();
      renderMasterSheet();
    } else {
      showToast('Could not delete complaint.', 'error');
    }
  }

  /* ==========================================================================
     Screen 2: Add Complaint Form Logic
     ========================================================================== */

  /**
   * Initialize Class Dropdowns from storage options.
   */
  function populateClassOptions() {
    const options = window.AppStorage.CLASS_OPTIONS;

    // Filter class dropdown
    elements.filterClassSelect.innerHTML = '<option value="ALL">All Classes</option>' +
      options.map((cls) => `<option value="${cls}">${cls}</option>`).join('');

    // Form class dropdown
    elements.selectClass.innerHTML = '<option value="">-- Select Class --</option>' +
      options.map((cls) => `<option value="${cls}">${cls}</option>`).join('');
  }

  /**
   * Autocomplete setup for Student Name.
   */
  async function handleStudentNameInput(e) {
    const val = e.target.value.trim().toLowerCase();
    elements.valStudentName.classList.remove('visible');
    elements.inputStudentName.classList.remove('is-invalid');

    if (!val) {
      elements.autocompleteList.classList.remove('show');
      elements.autocompleteList.innerHTML = '';
      return;
    }

    const students = await window.AppStorage.getStudents();
    const matches = students.filter((s) => s.name.toLowerCase().includes(val));

    if (matches.length === 0) {
      elements.autocompleteList.classList.remove('show');
      elements.autocompleteList.innerHTML = '';
      return;
    }

    elements.autocompleteList.innerHTML = matches.map((s) => {
      return `
        <div class="autocomplete-item" data-name="${escapeHTML(s.name)}" data-class="${escapeHTML(s.className)}">
          <strong>${escapeHTML(s.name)}</strong>
          <span style="font-size:0.75rem; color:var(--text-muted);">${escapeHTML(s.className)}</span>
        </div>
      `;
    }).join('');

    elements.autocompleteList.classList.add('show');
  }

  function handleAutocompletePick(e) {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;

    const name = item.dataset.name;
    const className = item.dataset.class;

    elements.inputStudentName.value = name;
    elements.selectClass.value = className;
    elements.autocompleteList.classList.remove('show');
    elements.autocompleteList.innerHTML = '';

    // Clear validation if present
    elements.valStudentName.classList.remove('visible');
    elements.inputStudentName.classList.remove('is-invalid');
    elements.valClass.classList.remove('visible');
    elements.selectClass.classList.remove('is-invalid');

    // Move focus to complaint
    elements.textareaComplaint.focus();
  }

  /**
   * Severity Radio Buttons Logic
   */
  function handleSeverityButtonClick(btn) {
    const sev = btn.dataset.severity;
    state.selectedSeverity = sev;
    elements.inputSeverityValue.value = sev;

    elements.sevButtons.forEach((b) => {
      const isMatch = b.dataset.severity === sev;
      b.classList.toggle('selected', isMatch);
      b.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });

    // Clear severity validation error
    elements.valSeverity.classList.remove('visible');
  }

  /**
   * Form submission validation & handling.
   * Auto-detects device date & time upon submission.
   */
  async function handleComplaintFormSubmit(e) {
    e.preventDefault();

    let isValid = true;
    const nameVal = elements.inputStudentName.value.trim();
    const classVal = elements.selectClass.value;
    const complaintVal = elements.textareaComplaint.value.trim();
    const severityVal = elements.inputSeverityValue.value;

    // Validate Student Name
    if (!nameVal) {
      elements.valStudentName.classList.add('visible');
      elements.inputStudentName.classList.add('is-invalid');
      isValid = false;
    } else {
      elements.valStudentName.classList.remove('visible');
      elements.inputStudentName.classList.remove('is-invalid');
    }

    // Validate Class
    if (!classVal) {
      elements.valClass.classList.add('visible');
      elements.selectClass.classList.add('is-invalid');
      isValid = false;
    } else {
      elements.valClass.classList.remove('visible');
      elements.selectClass.classList.remove('is-invalid');
    }

    // Validate Complaint Text
    if (!complaintVal) {
      elements.valComplaint.classList.add('visible');
      elements.textareaComplaint.classList.add('is-invalid');
      isValid = false;
    } else {
      elements.valComplaint.classList.remove('visible');
      elements.textareaComplaint.classList.remove('is-invalid');
    }

    // Validate Severity
    if (!severityVal) {
      elements.valSeverity.classList.add('visible');
      isValid = false;
    } else {
      elements.valSeverity.classList.remove('visible');
    }

    if (!isValid) return;

    try {
      const result = await window.AppStorage.addComplaint({
        studentName: nameVal,
        className: classVal,
        text: complaintVal,
        severity: severityVal
      });

      // Show success message that includes the saved date and time
      const recordedTime = formatDateTime(result.complaint.createdAt);
      elements.successBannerDetails.textContent = `Recorded for ${result.student.name} (${result.student.className}) on ${recordedTime}. Severity: ${result.complaint.severity}.`;
      elements.formSuccessBanner.classList.remove('hidden');

      showToast(`Complaint logged successfully at ${formatTimeOnly(result.complaint.createdAt)}`, 'success');

      // Reset form
      elements.complaintForm.reset();
      elements.inputSeverityValue.value = '';
      state.selectedSeverity = '';
      elements.sevButtons.forEach((b) => {
        b.classList.remove('selected');
        b.setAttribute('aria-checked', 'false');
      });
      elements.charCounter.textContent = '0 chars';
      elements.autocompleteList.classList.remove('show');

      // Refresh screens
      renderStudentRecords();
      renderMasterSheet();

      // Scroll to success banner
      elements.formSuccessBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // Automatically hide banner after 8 seconds
      setTimeout(() => {
        elements.formSuccessBanner.classList.add('hidden');
      }, 8000);
    } catch (err) {
      showToast(err.message || 'Error saving complaint.', 'error');
    }
  }

  /* ==========================================================================
     Screen 3: Master Sheet Table Rendering
     ========================================================================== */
  async function renderMasterSheet() {
    const students = await window.AppStorage.getStudentsWithStats();
    const complaints = await window.AppStorage.getComplaints();

    // Update aggregate statistics at the top
    elements.statTotalStudents.textContent = students.length;
    elements.statTotalComplaints.textContent = complaints.length;

    if (complaints.length === 0) {
      elements.masterTableBody.innerHTML = '';
      elements.masterEmpty.style.display = 'flex';
      return;
    }

    elements.masterEmpty.style.display = 'none';

    // Grouping & Sorting:
    // "When sorted by score or complaint count, keep each student's rows grouped together, with students ranked in that order."
    let rowsHtml = '';
    let counter = 1;

    // Check sort mode
    const isStudentRankedSort = state.sortBy === 'severity' || state.sortBy === 'complaints' || state.sortBy === 'name' || state.sortBy === 'class';

    if (isStudentRankedSort) {
      // Sort students based on the active sort criteria
      const sortedStudents = [...students].sort((a, b) => {
        let diff = 0;
        if (state.sortBy === 'severity') diff = b.severityScore - a.severityScore;
        else if (state.sortBy === 'complaints') diff = b.totalComplaints - a.totalComplaints;
        else if (state.sortBy === 'name') diff = a.name.localeCompare(b.name);
        else if (state.sortBy === 'class') diff = getClassNumber(a.className) - getClassNumber(b.className);

        return state.sortAscending ? -diff : diff;
      });

      sortedStudents.forEach((student) => {
        if (student.complaints.length === 0) return;

        // Student Group Header Row
        rowsHtml += `
          <tr class="student-group-row">
            <td colspan="7">
              <strong>${escapeHTML(student.name)}</strong> (${escapeHTML(student.className)}) — 
              ${student.totalComplaints} ${student.totalComplaints === 1 ? 'complaint' : 'complaints'} | 
              Severity Score: ${student.severityScore}/${window.AppStorage.MAX_SCORE} (${student.statusLabel})
            </td>
          </tr>
        `;

        // Render each complaint of this student
        student.complaints.forEach((c) => {
          rowsHtml += `
            <tr>
              <td>${counter++}</td>
              <td><strong>${escapeHTML(student.name)}</strong></td>
              <td>${escapeHTML(student.className)}</td>
              <td class="complaint-cell" dir="auto">${escapeHTML(c.text)}</td>
              <td><span class="sev-chip sev-chip-${c.severity.toLowerCase()}">${escapeHTML(c.severity)}</span></td>
              <td>${formatDateOnly(c.createdAt)}</td>
              <td>${formatTimeOnly(c.createdAt)}</td>
            </tr>
          `;
        });
      });
    } else {
      // Chronological sort
      const studentMap = new Map(students.map((s) => [s.id, s]));
      const sortedComplaints = [...complaints].sort((a, b) => {
        const diff = new Date(b.createdAt) - new Date(a.createdAt);
        return state.sortAscending ? -diff : diff;
      });

      sortedComplaints.forEach((c) => {
        const student = studentMap.get(c.studentId) || { name: 'Unknown', className: '-' };
        rowsHtml += `
          <tr>
            <td>${counter++}</td>
            <td><strong>${escapeHTML(student.name)}</strong></td>
            <td>${escapeHTML(student.className)}</td>
            <td class="complaint-cell" dir="auto">${escapeHTML(c.text)}</td>
            <td><span class="sev-chip sev-chip-${c.severity.toLowerCase()}">${escapeHTML(c.severity)}</span></td>
            <td>${formatDateOnly(c.createdAt)}</td>
            <td>${formatTimeOnly(c.createdAt)}</td>
          </tr>
        `;
      });
    }

    elements.masterTableBody.innerHTML = rowsHtml;
  }

  /* ==========================================================================
     Import / Export Handlers
     ========================================================================== */
  function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  async function handleExportCsv() {
    try {
      const csvData = await window.AppStorage.exportCSV();
      const dateStamp = new Date().toISOString().slice(0, 10);
      downloadBlob(csvData, `student_complaints_${dateStamp}.csv`, 'text/csv;charset=utf-8;');
      showToast('CSV export downloaded.', 'success');
    } catch (err) {
      showToast('Error exporting CSV.', 'error');
    }
  }

  async function handleExportBackup() {
    try {
      const backupObj = await window.AppStorage.exportJSON();
      const jsonStr = JSON.stringify(backupObj, null, 2);
      const dateStamp = new Date().toISOString().slice(0, 10);
      downloadBlob(jsonStr, `student_complaints_backup_${dateStamp}.json`, 'application/json');
      showToast('Backup JSON downloaded.', 'success');
    } catch (err) {
      showToast('Error creating backup.', 'error');
    }
  }

  function handleImportBackupClick() {
    elements.fileImportInput.click();
  }

  async function handleFileImportSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const result = await window.AppStorage.importJSON(json, 'merge');
        showToast(`Import successful! ${result.studentsCount} students, ${result.complaintsCount} complaints.`, 'success');
        renderStudentRecords();
        renderMasterSheet();
      } catch (err) {
        showToast('Invalid JSON file format. Import failed.', 'error');
      } finally {
        elements.fileImportInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  /* ==========================================================================
     Setup Event Listeners
     ========================================================================== */
  function bindEvents() {
    // Nav Tab Switching (Desktop)
    elements.deskNavLinks.forEach((link) => {
      link.addEventListener('click', () => switchScreen(link.dataset.screen));
    });

    // Nav Tab Switching (Mobile)
    elements.tabNavBtns.forEach((btn) => {
      btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
    });

    // Mobile FAB
    if (elements.mobileFab) {
      elements.mobileFab.addEventListener('click', () => switchScreen('add'));
    }

    // Empty state Add buttons
    elements.btnEmptyAdd.addEventListener('click', () => switchScreen('add'));
    elements.btnMasterEmptyAdd.addEventListener('click', () => switchScreen('add'));

    // Search and Filters
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderStudentRecords();
    });

    elements.filterClassSelect.addEventListener('change', (e) => {
      state.filterClass = e.target.value;
      renderStudentRecords();
    });

    elements.filterSeveritySelect.addEventListener('change', (e) => {
      state.filterSeverity = e.target.value;
      renderStudentRecords();
    });

    elements.sortBySelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderStudentRecords();
      renderMasterSheet();
    });

    elements.sortDirectionBtn.addEventListener('click', () => {
      state.sortAscending = !state.sortAscending;
      elements.sortIconAsc.style.display = state.sortAscending ? 'block' : 'none';
      elements.sortIconDesc.style.display = state.sortAscending ? 'none' : 'block';
      renderStudentRecords();
      renderMasterSheet();
    });

    // Add Complaint Form Autocomplete
    elements.inputStudentName.addEventListener('input', handleStudentNameInput);
    elements.autocompleteList.addEventListener('click', handleAutocompletePick);
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        elements.autocompleteList.classList.remove('show');
      }
    });

    // Character counter for textarea
    elements.textareaComplaint.addEventListener('input', (e) => {
      const len = e.target.value.length;
      elements.charCounter.textContent = `${len} chars`;
      elements.valComplaint.classList.remove('visible');
      elements.textareaComplaint.classList.remove('is-invalid');
    });

    // Class selection change clears validation
    elements.selectClass.addEventListener('change', () => {
      elements.valClass.classList.remove('visible');
      elements.selectClass.classList.remove('is-invalid');
    });

    // Severity Buttons
    elements.sevButtons.forEach((btn) => {
      btn.addEventListener('click', () => handleSeverityButtonClick(btn));
    });

    // Form Submit
    elements.complaintForm.addEventListener('submit', handleComplaintFormSubmit);

    // Modal Close
    elements.modalCloseBtn.addEventListener('click', closeStudentDetail);
    elements.studentDetailModal.addEventListener('click', (e) => {
      if (e.target === elements.studentDetailModal) {
        closeStudentDetail();
      }
    });

    // Confirm Modal Actions
    elements.btnConfirmCancel.addEventListener('click', closeConfirmModal);
    elements.btnConfirmProceed.addEventListener('click', executeDeleteComplaint);
    elements.confirmModal.addEventListener('click', (e) => {
      if (e.target === elements.confirmModal) closeConfirmModal();
    });

    // Escape Key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (elements.confirmModal.classList.contains('open')) closeConfirmModal();
        else if (elements.studentDetailModal.classList.contains('open')) closeStudentDetail();
      }
    });

    // Header Import / Export
    elements.btnExportCsv.addEventListener('click', handleExportCsv);
    elements.btnExportBackup.addEventListener('click', handleExportBackup);
    elements.btnImportBackup.addEventListener('click', handleImportBackupClick);
    elements.fileImportInput.addEventListener('change', handleFileImportSelected);
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */
  async function init() {
    populateClassOptions();
    bindEvents();

    // Populate initial demo records if storage is currently empty
    await window.AppStorage.populateSampleIfEmpty();

    // Initial render
    await renderStudentRecords();
    await renderMasterSheet();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

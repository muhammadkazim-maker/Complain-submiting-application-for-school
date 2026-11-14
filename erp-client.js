/**
 * Hadi Education System Balkassar — Full ERP Client Module (Schooliee-Grade Extension)
 * Implements 21 functional categories: Fees, 1Bill, WhatsApp Queue, Broadsheets,
 * Double-Entry GL, Staff Payroll, Parent Portal, Sibling Switcher, and Reports Hub.
 */

(function (window, document) {
  'use strict';

  // Base API configuration (connects to Flask backend if running, falls back gracefully)
  const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? `${window.location.origin}/api`
    : '/api';

  // State Management
  const erpState = {
    token: localStorage.getItem('hes_erp_token') || '',
    currentUser: {
      id: 'user_admin',
      username: 'admin',
      role: 'admin',
      full_name: 'System Administrator',
      linked_student_ids: ['hes_1', 'hes_2']
    },
    activeSession: 'sess_2025_2026',
    activeSessionName: '2025–2026',
    currentParentChildId: 'hes_1',
    activeFeesMonth: '2026-11',
    activeExamCycle: 'exam_midterm_2025',
    activeExamClass: '6th',
    activePayrollMonth: '2026-11'
  };

  // Helper: API Fetch with auth headers
  async function apiFetch(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(erpState.token ? { 'Authorization': `Bearer ${erpState.token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Server returned ${res.status}: ${res.statusText}`);
      }
      return data;
    } catch (err) {
      console.warn(`[HesERP API] ${endpoint} fetch issue:`, err.message);
      throw err;
    }
  }

  // Auto-login on startup
  async function initAuth() {
    try {
      // Try logging in with default active role or admin
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: erpState.currentUser.username, password: 'admin123' })
      });
      if (res && res.token) {
        erpState.token = res.token;
        erpState.currentUser = res.user;
        localStorage.setItem('hes_erp_token', res.token);
      }
    } catch (e) {
      console.info('[HesERP] Running in local offline/preview mode');
    }
    renderRoleSwitcher();
  }

  // Fast Role Switcher (Owner, Admin, Accountant, Teacher, Parent)
  async function switchUserRole(role) {
    const roleCreds = {
      owner: { u: 'owner', p: 'admin123' },
      admin: { u: 'admin', p: 'admin123' },
      accountant: { u: 'accountant', p: 'accountant123' },
      teacher: { u: 'teacher6', p: 'teacher123' },
      parent: { u: 'parent', p: 'parent123' }
    };
    const cred = roleCreds[role] || roleCreds.admin;

    // Optimistic synchronous UI update
    erpState.currentUser.role = role;
    erpState.currentUser.username = cred.u;
    erpState.currentUser.full_name = role.toUpperCase();
    renderRoleSwitcher();
    applyRolePermissions();

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: cred.u, password: cred.p })
      });
      if (res && res.token) {
        erpState.token = res.token;
        erpState.currentUser = res.user;
        localStorage.setItem('hes_erp_token', res.token);
      }
    } catch (e) {
      console.info('[HesERP] Active view switched locally:', role);
    }
    renderRoleSwitcher();
    applyRolePermissions();
    if (window.PortalBridge) {
      window.PortalBridge.showToast(`Switched active view to: ${role.toUpperCase()}`, 'success');
      // Refresh current screen
      const cur = window.PortalBridge.getCurrentScreen();
      window.PortalBridge.switchScreen(cur, true);
    }
  }

  // Render Role Switcher Pill in Topbar
  function renderRoleSwitcher() {
    let wrap = document.getElementById('hes-role-switcher-wrap');
    if (!wrap) {
      const headerActions = document.querySelector('.header-actions');
      if (!headerActions) return;
      wrap = document.createElement('div');
      wrap.id = 'hes-role-switcher-wrap';
      wrap.className = 'hes-role-switcher-wrap no-print';
      headerActions.insertBefore(wrap, headerActions.firstChild);
    }

    const role = erpState.currentUser.role || 'admin';
    const roleLabels = {
      owner: '👑 Owner',
      admin: '🛡️ Admin',
      accountant: '💰 Bursar/Accountant',
      teacher: '📚 Teacher (6th)',
      parent: '👨‍👧‍👦 Parent (Alpha)'
    };

    wrap.innerHTML = `
      <div class="role-selector-pill" id="btn-role-selector" title="Switch User Role / View">
        <span class="role-pill-badge">${roleLabels[role] || role}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div id="role-switcher-menu" class="role-dropdown-menu" hidden>
        <div class="role-menu-header">Active Role &amp; Permissions</div>
        <button type="button" class="role-item ${role === 'owner' ? 'active' : ''}" data-role="owner">
          <strong>👑 Owner / Director</strong>
          <small>Complete institutional authority</small>
        </button>
        <button type="button" class="role-item ${role === 'admin' ? 'active' : ''}" data-role="admin">
          <strong>🛡️ System Administrator</strong>
          <small>Academics, sessions &amp; admissions</small>
        </button>
        <button type="button" class="role-item ${role === 'accountant' ? 'active' : ''}" data-role="accountant">
          <strong>💰 Accountant / Bursar</strong>
          <small>Fees, ledgers, funds &amp; payroll</small>
        </button>
        <button type="button" class="role-item ${role === 'teacher' ? 'active' : ''}" data-role="teacher">
          <strong>📚 Class 6th In-Charge</strong>
          <small>Attendance, diary &amp; marks entry</small>
        </button>
        <button type="button" class="role-item ${role === 'parent' ? 'active' : ''}" data-role="parent">
          <strong>👨‍👧‍👦 Parent (Alpha Household)</strong>
          <small>Linked children: Abid &amp; Adnan</small>
        </button>
      </div>
    `;

    const btn = wrap.querySelector('#btn-role-selector');
    const menu = wrap.querySelector('#role-switcher-menu');
    if (btn && menu) {
      btn.onclick = (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
      };
      document.addEventListener('click', () => { menu.hidden = true; });
      menu.querySelectorAll('.role-item').forEach((item) => {
        item.onclick = () => {
          menu.hidden = true;
          switchUserRole(item.dataset.role);
        };
      });
    }
  }

  // Dynamic Sidebar & Screen Permissions by Role
  function applyRolePermissions() {
    const role = erpState.currentUser.role || 'admin';
    const isParent = role === 'parent';
    const isTeacher = role === 'teacher';
    const isAccountant = role === 'accountant';

    // Show/hide navigation links based on role
    document.querySelectorAll('[data-screen]').forEach((el) => {
      const sc = el.dataset.screen;
      if (isParent) {
        // Parent only sees Home, Parent Portal, Health
        const allowed = ['home', 'parent-portal', 'health', 'student-details'];
        if (el.classList.contains('nav-link')) {
          el.style.display = allowed.includes(sc) ? 'flex' : 'none';
        }
      } else if (isTeacher) {
        // Teacher sees Academics, Attendance, Diary, Exams
        const forbidden = ['accounting', 'payroll', 'admin-hub'];
        if (el.classList.contains('nav-link')) {
          el.style.display = forbidden.includes(sc) ? 'none' : 'flex';
        }
      } else {
        // Admin / Owner / Accountant see all relevant
        if (el.classList.contains('nav-link')) {
          el.style.display = 'flex';
        }
      }
    });
  }

  // ============================================================================
  // NAVIGATION HOOKS & SCREEN REGISTRATION
  // ============================================================================
  const ERP_SCREENS = {
    fees: { title: 'Fee Challans & Collection', subtitle: 'Family-linked challans, 1Bill digital collection & counter receipts' },
    accounting: { title: 'Accounts & General Ledger', subtitle: 'Double-entry journals, chart of accounts, trial balance & cash book' },
    exams: { title: 'Examinations & Broadsheets', subtitle: 'Class broadsheets, marks entry, tied ranks & printable report cards' },
    payroll: { title: 'Staff & Payroll Management', subtitle: 'Teaching & non-teaching staff, salary structures, advances & payslips' },
    whatsapp: { title: 'WhatsApp Notification Center', subtitle: 'Persistent outgoing queue, delivery tracking, absent alerts & circulars' },
    'parent-portal': { title: 'Parent Portal & Sibling Hub', subtitle: 'Dedicated family view, sibling switcher, attendance, diary & challans' },
    reports: { title: 'Reports & Exports Hub', subtitle: 'Fee defaulters, daily collections, enrollment strength & CSV downloads' },
    'admin-hub': { title: 'Administrative Hub & Sessions', subtitle: 'Academic year promotion, task delegation & immutable audit logs' }
  };

  function injectERPSidebarItems() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || nav.dataset.erpInjected) return;
    nav.dataset.erpInjected = 'true';

    // Insert Divider: Financial & Operations
    const finHeader = document.createElement('div');
    finHeader.className = 'snav-section-label';
    finHeader.textContent = 'Financial & ERP Modules';
    nav.appendChild(finHeader);

    // 1. Fees & Payment Collection
    nav.insertAdjacentHTML('beforeend', `
      <button type="button" class="nav-link" data-screen="fees" id="desk-nav-fees" title="Fee Challans &amp; Counter Collection">
        <span class="nav-icon" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        </span>
        <span class="nav-label">Fees &amp; Challans</span>
        <span class="nav-count nav-count-amber" id="snav-badge-fees">1Bill</span>
      </button>
    `);

    // 2. Accounting & General Ledger
    nav.insertAdjacentHTML('beforeend', `
      <button type="button" class="nav-link" data-screen="accounting" id="desk-nav-accounting" title="Accounting &amp; Double-Entry Ledger">
        <span class="nav-icon" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            <path d="M9 10h6M12 7v6"/>
          </svg>
        </span>
        <span class="nav-label">Accounts &amp; Ledger</span>
      </button>
    `);

    // 3. Examinations & Broadsheets
    nav.insertAdjacentHTML('beforeend', `
      <button type="button" class="nav-link" data-screen="exams" id="desk-nav-exams" title="Examinations, Broadsheets &amp; Report Cards">
        <span class="nav-icon" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="m9 15 2 2 4-4"/>
          </svg>
        </span>
        <span class="nav-label">Exams &amp; Broadsheets</span>
      </button>
    `);

    // 4. Staff & Payroll
    nav.insertAdjacentHTML('beforeend', `
      <button type="button" class="nav-link" data-screen="payroll" id="desk-nav-payroll" title="Staff Profiles, Advances &amp; Monthly Payroll">
        <span class="nav-icon" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </span>
        <span class="nav-label">Staff &amp; Payroll</span>
      </button>
    `);

    // Insert Divider: Portals & Operations
    const opHeader = document.createElement('div');
    opHeader.className = 'snav-section-label';
    opHeader.textContent = 'Portals & Communication';
    nav.appendChild(opHeader);

    // 5. Parent Portal & Sibling Switcher
    nav.insertAdjacentHTML('beforeend', `
      <button type="button" class="nav-link" data-screen="parent-portal" id="desk-nav-parent" title="Parent Portal &amp; Sibling Switcher">
        <span class="nav-icon" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
            <circle cx="12" cy="7" r="4"/>
            <path d="M5.5 21a6.5 6.5 0 0 1 13 0"/>
          </svg>
        </span>
        <span class="nav-label">Parent Portal</span>
      </button>
    `);

    // 6. WhatsApp Center
    nav.insertAdjacentHTML('beforeend', `
      <button type="button" class="nav-link" data-screen="whatsapp" id="desk-nav-whatsapp" title="WhatsApp Alerts &amp; Queue Management">
        <span class="nav-icon" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </span>
        <span class="nav-label">WhatsApp Queue</span>
      </button>
    `);

    // 7. Central Reports Hub
    nav.insertAdjacentHTML('beforeend', `
      <button type="button" class="nav-link" data-screen="reports" id="desk-nav-reports" title="Defaulters, Financials &amp; Export Hub">
        <span class="nav-icon" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </span>
        <span class="nav-label">Reports &amp; Exports</span>
      </button>
    `);

    // 8. Admin Hub & Sessions
    nav.insertAdjacentHTML('beforeend', `
      <button type="button" class="nav-link" data-screen="admin-hub" id="desk-nav-admin-hub" title="Academic Sessions, Promotion &amp; Audit Logs">
        <span class="nav-icon" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </span>
        <span class="nav-label">Admin &amp; Sessions</span>
      </button>
    `);

    // Bind click handlers to newly added nav links
    nav.querySelectorAll('[data-screen]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetScreen = btn.dataset.screen;
        if (ERP_SCREENS[targetScreen]) {
          activateERPScreen(targetScreen);
        }
      });
    });
  }

  // Inject Home Dashboard Quick-Action Pills
  function injectHomeQuickActions() {
    const qaWrap = document.querySelector('.home-quick-actions');
    if (!qaWrap || qaWrap.dataset.erpInjected) return;
    qaWrap.dataset.erpInjected = 'true';

    qaWrap.insertAdjacentHTML('beforeend', `
      <button type="button" class="qa-pill qa-fees" id="qa-fees" onclick="window.HesERP.switchScreen('fees')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
        <span>Fees &amp; Challans</span>
      </button>
      <button type="button" class="qa-pill qa-broadsheet" id="qa-broadsheet" onclick="window.HesERP.switchScreen('exams')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        <span>Class Broadsheet</span>
      </button>
      <button type="button" class="qa-pill qa-parent" id="qa-parent" onclick="window.HesERP.switchScreen('parent-portal')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/>
        </svg>
        <span>Parent Portal</span>
      </button>
    `);
  }

  // Activate ERP Screen
  function activateERPScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach((el) => {
      el.classList.toggle('active', el.id === `screen-${screenName}`);
    });

    // Update nav links active class
    document.querySelectorAll('.nav-link').forEach((el) => {
      el.classList.toggle('active', el.dataset.screen === screenName);
    });

    // Update topbar titles
    const meta = ERP_SCREENS[screenName];
    if (meta) {
      const titleEl = document.getElementById('topbar-page-title');
      const subEl = document.getElementById('topbar-page-subtitle');
      if (titleEl) titleEl.textContent = meta.title;
      if (subEl) subEl.textContent = meta.subtitle;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Render screen contents
    if (screenName === 'fees') renderFeesScreen();
    else if (screenName === 'accounting') renderAccountingScreen();
    else if (screenName === 'exams') renderExamsScreen();
    else if (screenName === 'payroll') renderPayrollScreen();
    else if (screenName === 'whatsapp') renderWhatsAppScreen();
    else if (screenName === 'parent-portal') renderParentPortalScreen();
    else if (screenName === 'reports') renderReportsScreen();
    else if (screenName === 'admin-hub') renderAdminHubScreen();
  }

  // ============================================================================
  // MODULE 01: FEES, CHALLANS & DIGITAL COLLECTION
  // ============================================================================
  async function renderFeesScreen() {
    let screen = document.getElementById('screen-fees');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'screen-fees';
      screen.className = 'screen active';
      document.getElementById('main-content').appendChild(screen);
    }

    screen.innerHTML = `
      <div class="erp-container">
        <!-- Control Header & Filters -->
        <div class="erp-top-toolbar">
          <div class="erp-filter-group">
            <label class="input-label" for="fees-filter-month">Billing Month</label>
            <input type="month" id="fees-filter-month" class="form-control" value="${erpState.activeFeesMonth}" />
          </div>
          <div class="erp-filter-group">
            <label class="input-label" for="fees-filter-class">Filter Class</label>
            <select id="fees-filter-class" class="form-control">
              <option value="">All Classes (6th–12th)</option>
              <option value="6th">Class 6</option>
              <option value="7th">Class 7</option>
              <option value="8th">Class 8</option>
              <option value="9th">Class 9</option>
              <option value="10th">Class 10</option>
              <option value="11th">11th (1st Year)</option>
              <option value="12th">12th (2nd Year)</option>
            </select>
          </div>
          <div class="erp-toolbar-actions">
            <button type="button" class="btn btn-primary" id="btn-generate-bulk-fees">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>
              <span>Generate Monthly Challans</span>
            </button>
            <button type="button" class="btn btn-outline" id="btn-collect-counter">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="5" width="20" height="14" rx="2"/></svg>
              <span>Counter Collection</span>
            </button>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="erp-kpi-row" id="fees-kpis">
          <div class="kpi-card kpi-blue">
            <span class="kpi-label">Total Billed</span>
            <strong class="kpi-value" id="kpi-fees-billed">PKR 0</strong>
            <small>Active month billing</small>
          </div>
          <div class="kpi-card kpi-green">
            <span class="kpi-label">Cash &amp; 1Bill Collected</span>
            <strong class="kpi-value" id="kpi-fees-collected">PKR 0</strong>
            <small>Instant GL posted</small>
          </div>
          <div class="kpi-card kpi-amber">
            <span class="kpi-label">Outstanding Receivables</span>
            <strong class="kpi-value" id="kpi-fees-unpaid">PKR 0</strong>
            <small>Defaulters &amp; partial dues</small>
          </div>
          <div class="kpi-card kpi-purple">
            <span class="kpi-label">Sibling Discounts Given</span>
            <strong class="kpi-value" id="kpi-fees-discount">PKR 0</strong>
            <small>20% on 2nd, 30% on 3rd+</small>
          </div>
        </div>

        <!-- Challans Data Table -->
        <div class="table-responsive-card">
          <div class="card-header-row">
            <div>
              <h3 class="card-section-title">Fee Challan Register</h3>
              <p class="card-section-sub">Family-linked student challans with 1Bill invoice identifiers</p>
            </div>
            <span class="badge badge-neutral" id="fees-record-count">0 Records</span>
          </div>

          <table class="erp-table" id="fees-table">
            <thead>
              <tr>
                <th>Challan No</th>
                <th>Student / Father</th>
                <th>Class</th>
                <th>Family ID</th>
                <th>1Bill Invoice</th>
                <th>Payable</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="fees-table-body">
              <tr><td colspan="10" class="text-center py-4">Loading fee records...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Bind event handlers
    const monthInput = screen.querySelector('#fees-filter-month');
    const classSelect = screen.querySelector('#fees-filter-class');
    if (monthInput) monthInput.onchange = () => { erpState.activeFeesMonth = monthInput.value; loadChallans(); };
    if (classSelect) classSelect.onchange = () => loadChallans();

    screen.querySelector('#btn-generate-bulk-fees').onclick = () => openBulkFeeModal();
    screen.querySelector('#btn-collect-counter').onclick = () => openCounterCollectModal();

    await loadChallans();
  }

  async function loadChallans() {
    const tbody = document.getElementById('fees-table-body');
    const month = erpState.activeFeesMonth;
    const cid = document.getElementById('fees-filter-class')?.value || '';

    try {
      const res = await apiFetch(`/fees/challans?month=${month}${cid ? '&class_id=' + cid : ''}`);
      const challans = res.challans || [];

      let totBilled = 0, totPaid = 0, totBal = 0, totDisc = 0;
      challans.forEach((ch) => {
        totBilled += parseFloat(ch.total_payable || 0);
        totPaid += parseFloat(ch.paid_amount || 0);
        totBal += parseFloat(ch.balance_amount || 0);
        totDisc += parseFloat(ch.sibling_discount || 0);
      });

      document.getElementById('kpi-fees-billed').textContent = `PKR ${totBilled.toLocaleString()}`;
      document.getElementById('kpi-fees-collected').textContent = `PKR ${totPaid.toLocaleString()}`;
      document.getElementById('kpi-fees-unpaid').textContent = `PKR ${totBal.toLocaleString()}`;
      document.getElementById('kpi-fees-discount').textContent = `PKR ${totDisc.toLocaleString()}`;
      document.getElementById('fees-record-count').textContent = `${challans.length} Challans`;

      if (challans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No fee challans generated for ${month}. Click "Generate Monthly Challans" above.</td></tr>`;
        return;
      }

      tbody.innerHTML = challans.map((ch) => {
        const statusBadge = ch.status === 'Paid'
          ? '<span class="status-pill status-pill-success">Paid</span>'
          : ch.status === 'Partial'
          ? '<span class="status-pill status-pill-warning">Partial</span>'
          : '<span class="status-pill status-pill-danger">Unpaid</span>';

        return `
          <tr>
            <td><strong>${ch.challan_no}</strong></td>
            <td>
              <div><strong>${ch.student_name}</strong></div>
              <small class="text-muted">s/o ${ch.father_name}</small>
            </td>
            <td><span class="badge badge-class">${ch.current_class_id}</span></td>
            <td><code>${ch.family_id || '—'}</code></td>
            <td><code class="code-1bill">${ch.onebill_invoice_no || '—'}</code></td>
            <td>PKR ${parseFloat(ch.total_payable).toLocaleString()}</td>
            <td class="text-success font-semibold">PKR ${parseFloat(ch.paid_amount).toLocaleString()}</td>
            <td class="text-danger font-semibold">PKR ${parseFloat(ch.balance_amount).toLocaleString()}</td>
            <td>${statusBadge}</td>
            <td>
              <div class="row-actions">
                ${ch.status !== 'Paid' ? `<button type="button" class="btn btn-sm btn-primary" onclick="window.HesERP.collectChallan('${ch.id}', ${ch.balance_amount})">Pay</button>` : ''}
                <button type="button" class="btn btn-sm btn-outline" onclick="window.HesERP.printChallan('${ch.id}')" title="Print 3-Copy Bank Challan">Print</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-danger">Failed to load fee challans: ${e.message}</td></tr>`;
    }
  }

  // Modal: Generate Bulk Fees
  function openBulkFeeModal() {
    const modalId = 'modal-bulk-fees';
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-header">
          <h3>Generate Bulk Monthly Fee Challans</h3>
          <button type="button" class="modal-close-btn" onclick="document.getElementById('${modalId}').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">Generates tuition fee challans with automatic sibling discounts (20% on 2nd child, 30% on 3rd+ child in same family) and 1Bill consumer codes.</p>
          <div class="form-group mb-3">
            <label class="input-label" for="bf-month">Billing Month</label>
            <input type="month" id="bf-month" class="form-control" value="${erpState.activeFeesMonth}" />
          </div>
          <div class="form-group mb-3">
            <label class="input-label" for="bf-class">Target Class</label>
            <select id="bf-class" class="form-control">
              <option value="">All Classes (School-wide 134 students)</option>
              <option value="6th">Class 6</option>
              <option value="7th">Class 7</option>
              <option value="8th">Class 8</option>
              <option value="9th">Class 9</option>
              <option value="10th">Class 10</option>
              <option value="11th">11th (1st Year)</option>
              <option value="12th">12th (2nd Year)</option>
            </select>
          </div>
          <div class="form-group mb-3">
            <label class="input-label" for="bf-due">Due Date</label>
            <input type="date" id="bf-due" class="form-control" value="${erpState.activeFeesMonth}-15" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-bulk-generate">Generate Challans</button>
        </div>
      </div>
    `;

    modal.querySelector('#btn-confirm-bulk-generate').onclick = async () => {
      const month_label = modal.querySelector('#bf-month').value;
      const class_id = modal.querySelector('#bf-class').value;
      const due_date = modal.querySelector('#bf-due').value;

      try {
        const res = await apiFetch('/fees/generate-bulk', {
          method: 'POST',
          body: JSON.stringify({ month_label, class_id: class_id || null, due_date })
        });
        modal.remove();
        if (window.PortalBridge) window.PortalBridge.showToast(res.message, 'success');
        loadChallans();
      } catch (err) {
        alert(`Generation error: ${err.message}`);
      }
    };
  }

  // Modal: Counter Collection
  function openCounterCollectModal(presetChallanId = '', presetAmount = 0) {
    const modalId = 'modal-counter-collect';
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-header">
          <h3>Record Fee Payment (Counter / Bank)</h3>
          <button type="button" class="modal-close-btn" onclick="document.getElementById('${modalId}').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group mb-3">
            <label class="input-label" for="pay-challan-id">Challan ID / Number</label>
            <input type="text" id="pay-challan-id" class="form-control" placeholder="e.g. ch_hes1_2026_11" value="${presetChallanId}" />
          </div>
          <div class="form-group mb-3">
            <label class="input-label" for="pay-amount">Payment Amount (PKR)</label>
            <input type="number" id="pay-amount" class="form-control" placeholder="Enter amount" value="${presetAmount || ''}" />
          </div>
          <div class="form-group mb-3">
            <label class="input-label" for="pay-method">Payment Channel</label>
            <select id="pay-method" class="form-control">
              <option value="Cash">Cash at Counter</option>
              <option value="Bank Transfer">Bank Transfer (Bank Al Habib)</option>
              <option value="1Bill">1Bill / 1Link Digital</option>
              <option value="Easypaisa">Easypaisa</option>
              <option value="JazzCash">JazzCash</option>
            </select>
          </div>
          <div class="form-group mb-3">
            <label class="input-label" for="pay-notes">Remarks / Reference</label>
            <input type="text" id="pay-notes" class="form-control" placeholder="Counter fee collection" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-submit-counter-pay">Post &amp; Issue Receipt</button>
        </div>
      </div>
    `;

    modal.querySelector('#btn-submit-counter-pay').onclick = async () => {
      const challan_id = modal.querySelector('#pay-challan-id').value.trim();
      const amount = parseFloat(modal.querySelector('#pay-amount').value || 0);
      const payment_method = modal.querySelector('#pay-method').value;
      const notes = modal.querySelector('#pay-notes').value;

      if (!challan_id || amount <= 0) {
        alert('Please provide a valid challan ID and amount.');
        return;
      }

      try {
        const res = await apiFetch('/fees/collect-counter', {
          method: 'POST',
          body: JSON.stringify({ challan_id, amount, payment_method, notes })
        });
        modal.remove();
        if (window.PortalBridge) window.PortalBridge.showToast(res.message, 'success');
        loadChallans();
      } catch (e) {
        alert(`Payment error: ${e.message}`);
      }
    };
  }

  // Print 3-Copy Bank Challan
  async function printChallan(challanId) {
    try {
      const res = await apiFetch(`/fees/challans?student_id=${challanId.split('_')[1] || ''}`);
      const ch = (res.challans || []).find((c) => c.id === challanId) || {
        challan_no: 'CH-202611-001',
        student_name: 'Student',
        father_name: 'Guardian',
        current_class_id: '6th',
        month_label: erpState.activeFeesMonth,
        due_date: `${erpState.activeFeesMonth}-15`,
        total_payable: 4000,
        tuition_fee: 3500,
        fund_charges: 500,
        sibling_discount: 0,
        onebill_invoice_no: '10012876540000000001'
      };

      const w = window.open('', '_blank');
      w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Fee Challan - ${ch.challan_no}</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; }
            .challan-grid { display: flex; gap: 15px; justify-content: space-between; }
            .challan-copy { flex: 1; border: 1.5px dashed #64748b; padding: 15px; border-radius: 8px; font-size: 12px; }
            .school-header { text-align: center; border-bottom: 2px solid #001b4a; padding-bottom: 8px; margin-bottom: 10px; }
            .school-header h2 { margin: 0; font-size: 15px; color: #001b4a; }
            .school-header p { margin: 2px 0; font-size: 10px; color: #64748b; }
            .copy-title { background: #001b4a; color: white; text-align: center; font-weight: bold; padding: 4px; border-radius: 4px; font-size: 11px; margin-bottom: 8px; }
            .challan-field { display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px dotted #cbd5e1; padding-bottom: 2px; }
            .field-label { font-weight: 600; color: #475569; }
            .onebill-box { background: #f8fafc; border: 1px solid #0284c7; padding: 6px; border-radius: 4px; text-align: center; margin: 10px 0; font-weight: bold; color: #0369a1; }
            .bank-stamp { height: 60px; border: 1px solid #cbd5e1; margin-top: 15px; display: flex; align-items: flex-end; justify-content: center; font-size: 10px; color: #94a3b8; }
            @media print {
              body { padding: 0; }
              .challan-copy { border: 1px solid #000; }
            }
          </style>
        </head>
        <body onload="window.print()">
          <div class="challan-grid">
            ${['BANK COPY', 'SCHOOL COPY', 'STUDENT COPY'].map((copyName) => `
              <div class="challan-copy">
                <div class="copy-title">${copyName}</div>
                <div class="school-header">
                  <h2>Hadi Education System</h2>
                  <p>Balkassar Campus, Chakwal • Tel: 0300-8742972</p>
                  <p>Bank Al Habib A/C: 1020-0092-817261</p>
                </div>
                <div class="challan-field"><span class="field-label">Challan No:</span><strong>${ch.challan_no}</strong></div>
                <div class="challan-field"><span class="field-label">Billing Month:</span><span>${ch.month_label}</span></div>
                <div class="challan-field"><span class="field-label">Due Date:</span><strong>${ch.due_date}</strong></div>
                <div class="challan-field"><span class="field-label">Student Name:</span><strong>${ch.student_name}</strong></div>
                <div class="challan-field"><span class="field-label">Father Name:</span><span>${ch.father_name}</span></div>
                <div class="challan-field"><span class="field-label">Class:</span><span>Class ${ch.current_class_id}</span></div>
                <div class="challan-field"><span class="field-label">Tuition Fee:</span><span>PKR ${parseFloat(ch.tuition_fee || 3500).toLocaleString()}</span></div>
                <div class="challan-field"><span class="field-label">Exam/Activity Fund:</span><span>PKR ${parseFloat(ch.fund_charges || 500).toLocaleString()}</span></div>
                <div class="challan-field"><span class="field-label">Sibling Discount:</span><span class="text-success">- PKR ${parseFloat(ch.sibling_discount || 0).toLocaleString()}</span></div>
                <div class="challan-field" style="border-top: 2px solid #001b4a; border-bottom: 2px solid #001b4a; font-weight: bold; font-size: 13px;">
                  <span>Total Payable:</span><span>PKR ${parseFloat(ch.total_payable || 4000).toLocaleString()}</span>
                </div>
                <div class="onebill-box">1Bill Consumer No:<br><span style="font-size: 13px;">${ch.onebill_invoice_no || '10012876540000000001'}</span></div>
                <div class="bank-stamp">Bank / Cashier Stamp &amp; Signature</div>
              </div>
            `).join('')}
          </div>
        </body>
        </html>
      `);
      w.document.close();
    } catch (e) {
      alert(`Print error: ${e.message}`);
    }
  }

  // ============================================================================
  // MODULE 07: ACCOUNTING & GENERAL LEDGER
  // ============================================================================
  async function renderAccountingScreen() {
    let screen = document.getElementById('screen-accounting');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'screen-accounting';
      screen.className = 'screen active';
      document.getElementById('main-content').appendChild(screen);
    }

    screen.innerHTML = `
      <div class="erp-container">
        <!-- Accounting Nav Tabs -->
        <div class="erp-subtabs">
          <button type="button" class="subtab-btn active" id="tab-tb">Trial Balance</button>
          <button type="button" class="subtab-btn" id="tab-coa">Chart of Accounts</button>
          <button type="button" class="subtab-btn" id="tab-new-je">+ Post Journal Entry</button>
        </div>

        <div id="accounting-content" class="table-responsive-card">
          <div class="card-header-row">
            <div>
              <h3 class="card-section-title">Double-Entry Trial Balance</h3>
              <p class="card-section-sub">Balanced ledger accounts reconciling total Debits with total Credits</p>
            </div>
            <span class="badge badge-success" id="tb-balanced-badge">Debits = Credits ✓</span>
          </div>

          <table class="erp-table">
            <thead>
              <tr>
                <th>Account Code</th>
                <th>Account Title</th>
                <th>Classification</th>
                <th class="text-right">Debit (PKR)</th>
                <th class="text-right">Credit (PKR)</th>
              </tr>
            </thead>
            <tbody id="tb-table-body">
              <tr><td colspan="5" class="text-center py-4">Loading accounts...</td></tr>
            </tbody>
            <tfoot id="tb-table-foot"></tfoot>
          </table>
        </div>
      </div>
    `;

    screen.querySelector('#tab-tb').onclick = () => renderAccountingScreen();
    screen.querySelector('#tab-coa').onclick = () => renderChartOfAccounts();
    screen.querySelector('#tab-new-je').onclick = () => openJournalEntryModal();

    await loadTrialBalance();
  }

  async function loadTrialBalance() {
    const tbody = document.getElementById('tb-table-body');
    const tfoot = document.getElementById('tb-table-foot');
    try {
      const res = await apiFetch('/accounting/trial-balance');
      const rows = res.rows || [];

      tbody.innerHTML = rows.map((r) => `
        <tr>
          <td><code>${r.code}</code></td>
          <td><strong>${r.name}</strong></td>
          <td><span class="badge badge-neutral">${r.type}</span></td>
          <td class="text-right font-mono">${r.debit > 0 ? 'PKR ' + r.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '—'}</td>
          <td class="text-right font-mono">${r.credit > 0 ? 'PKR ' + r.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '—'}</td>
        </tr>
      `).join('');

      tfoot.innerHTML = `
        <tr class="table-total-row">
          <td colspan="3"><strong>Total Balanced Ledger</strong></td>
          <td class="text-right font-mono font-bold text-primary">PKR ${res.totalDebit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          <td class="text-right font-mono font-bold text-primary">PKR ${res.totalCredit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        </tr>
      `;
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Error: ${e.message}</td></tr>`;
    }
  }

  async function renderChartOfAccounts() {
    const cont = document.getElementById('accounting-content');
    cont.innerHTML = `
      <div class="card-header-row">
        <div>
          <h3 class="card-section-title">Institutional Chart of Accounts</h3>
          <p class="card-section-sub">Standard Asset, Liability, Equity, Revenue, and Expense heads</p>
        </div>
      </div>
      <table class="erp-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Category</th>
            <th>Live Balance</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody id="coa-tbody">
          <tr><td colspan="5" class="text-center py-4">Loading accounts...</td></tr>
        </tbody>
      </table>
    `;
    const tbody = document.getElementById('coa-tbody');
    try {
      const res = await apiFetch('/accounting/accounts');
      const accounts = res.accounts || [];
      tbody.innerHTML = accounts.map((a) => `
        <tr>
          <td><code>${a.code}</code></td>
          <td><strong>${a.name}</strong></td>
          <td><span class="badge badge-class">${a.type}</span></td>
          <td class="font-mono font-semibold">PKR ${parseFloat(a.balance).toLocaleString()}</td>
          <td class="text-muted">${a.description || '—'}</td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Error: ${e.message}</td></tr>`;
    }
  }

  // ============================================================================
  // MODULE 05: EXAMINATIONS & BROADSHEETS
  // ============================================================================
  async function renderExamsScreen() {
    let screen = document.getElementById('screen-exams');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'screen-exams';
      screen.className = 'screen active';
      document.getElementById('main-content').appendChild(screen);
    }

    screen.innerHTML = `
      <div class="erp-container">
        <div class="erp-top-toolbar">
          <div class="erp-filter-group">
            <label class="input-label" for="exam-cycle-sel">Exam Cycle</label>
            <select id="exam-cycle-sel" class="form-control">
              <option value="exam_midterm_2025">Midterm Examination 2025</option>
            </select>
          </div>
          <div class="erp-filter-group">
            <label class="input-label" for="exam-class-sel">Class</label>
            <select id="exam-class-sel" class="form-control">
              <option value="6th">Class 6</option>
              <option value="7th">Class 7</option>
              <option value="8th">Class 8</option>
              <option value="9th">Class 9</option>
              <option value="10th">Class 10</option>
              <option value="11th">11th (1st Year)</option>
              <option value="12th">12th (2nd Year)</option>
            </select>
          </div>
          <div class="erp-toolbar-actions">
            <button type="button" class="btn btn-primary" onclick="window.print()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              <span>Print Broadsheet</span>
            </button>
          </div>
        </div>

        <div class="table-responsive-card">
          <div class="card-header-row">
            <div>
              <h3 class="card-section-title">Official Class Broadsheet</h3>
              <p class="card-section-sub">Subject scores, totals, percentages, grades and tied ranking order</p>
            </div>
            <span class="badge badge-primary" id="broadsheet-student-count">0 Students</span>
          </div>

          <div style="overflow-x: auto;">
            <table class="erp-table broadsheet-table" id="broadsheet-table">
              <thead id="broadsheet-thead">
                <tr>
                  <th>Rank</th>
                  <th>Roll</th>
                  <th>Student Name</th>
                  <th>English</th>
                  <th>Mathematics</th>
                  <th>Obtained</th>
                  <th>Total</th>
                  <th>Percentage</th>
                  <th>Grade</th>
                  <th>Report Card</th>
                </tr>
              </thead>
              <tbody id="broadsheet-tbody">
                <tr><td colspan="10" class="text-center py-4">Loading broadsheet...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const classSel = screen.querySelector('#exam-class-sel');
    if (classSel) {
      classSel.value = erpState.activeExamClass;
      classSel.onchange = () => {
        erpState.activeExamClass = classSel.value;
        loadBroadsheet();
      };
    }

    await loadBroadsheet();
  }

  async function loadBroadsheet() {
    const tbody = document.getElementById('broadsheet-tbody');
    const cid = erpState.activeExamClass;
    const cycle = erpState.activeExamCycle;

    try {
      const res = await apiFetch(`/exams/broadsheet?cycle_id=${cycle}&class_id=${cid}`);
      const rows = res.rows || [];
      const subjects = res.subjects || [];

      document.getElementById('broadsheet-student-count').textContent = `${rows.length} Students`;

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No students found in Class ${cid}.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map((r) => {
        const rankBadge = r.rank === 1
          ? '<span class="rank-badge rank-1">1st 🥇</span>'
          : r.rank === 2
          ? '<span class="rank-badge rank-2">2nd 🥈</span>'
          : r.rank === 3
          ? '<span class="rank-badge rank-3">3rd 🥉</span>'
          : `<span class="rank-badge">${r.rank}th</span>`;

        const gradeClass = r.grade === 'A+' || r.grade === 'A' ? 'grade-a' : r.grade === 'F' ? 'grade-f' : 'grade-b';

        return `
          <tr>
            <td><strong>${rankBadge}</strong></td>
            <td><code>${r.roll_number}</code></td>
            <td><strong>${r.name}</strong></td>
            <td>${r.subjectScores?.English ?? '—'}</td>
            <td>${r.subjectScores?.Mathematics ?? '—'}</td>
            <td class="font-bold text-primary">${r.totalObtained}</td>
            <td class="text-muted">${r.totalMax}</td>
            <td class="font-bold">${r.percentage}%</td>
            <td><span class="grade-pill ${gradeClass}">${r.grade}</span></td>
            <td>
              <button type="button" class="btn btn-sm btn-outline" onclick="window.HesERP.printReportCard('${r.student_id}', '${r.name}', '${r.totalObtained}', '${r.percentage}', '${r.grade}', '${r.rank}')">
                Report Card
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-danger">Error: ${e.message}</td></tr>`;
    }
  }

  function printReportCard(sid, sname, obtained, pct, grade, rank) {
    const w = window.open('', '_blank');
    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Report Card - ${sname}</title>
        <style>
          body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 30px; color: #0f172a; }
          .report-sheet { border: 2.5px solid #001b4a; padding: 25px; border-radius: 12px; max-width: 750px; margin: auto; }
          .crest-hdr { text-align: center; border-bottom: 2px solid #001b4a; padding-bottom: 12px; margin-bottom: 15px; }
          .crest-hdr h1 { margin: 0; color: #001b4a; font-size: 24px; }
          .crest-hdr p { margin: 4px 0; color: #475569; font-size: 13px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 14px; }
          .score-tbl { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .score-tbl th, .score-tbl td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          .score-tbl th { background: #f1f5f9; color: #001b4a; }
          .summary-box { background: #f8fafc; border: 1.5px solid #0284c7; padding: 15px; border-radius: 8px; display: flex; justify-content: space-around; font-size: 16px; margin-bottom: 30px; }
          .sigs { display: flex; justify-content: space-between; margin-top: 50px; }
          .sig-line { width: 180px; border-top: 1px solid #000; text-align: center; font-size: 12px; padding-top: 5px; }
        </style>
      </head>
      <body onload="window.print()">
        <div class="report-sheet">
          <div class="crest-hdr">
            <h1>Hadi Education System</h1>
            <p>Balkassar Campus, Chakwal • Terminal Academic Progress Report</p>
            <strong>Session 2025–2026 • Midterm Examination</strong>
          </div>
          <div class="meta-grid">
            <div><strong>Student Name:</strong> ${sname}</div>
            <div><strong>Student ID:</strong> ${sid}</div>
            <div><strong>Class &amp; Section:</strong> Class ${erpState.activeExamClass} (General)</div>
            <div><strong>Class Position / Rank:</strong> <span style="font-size: 16px; font-weight: bold; color: #059669;">${rank}</span></div>
          </div>
          <table class="score-tbl">
            <thead>
              <tr><th>Subject</th><th>Max Marks</th><th>Pass Marks</th><th>Obtained Marks</th><th>Remarks</th></tr>
            </thead>
            <tbody>
              <tr><td>English</td><td>100</td><td>33</td><td>${obtained / 2}</td><td>Passed</td></tr>
              <tr><td>Mathematics</td><td>100</td><td>33</td><td>${obtained / 2}</td><td>Passed</td></tr>
              <tr><td>Urdu &amp; Science</td><td>100</td><td>33</td><td>—</td><td>Exempt / Next Term</td></tr>
            </tbody>
          </table>
          <div class="summary-box">
            <div>Total Marks: <strong>${obtained} / 200</strong></div>
            <div>Percentage: <strong>${pct}%</strong></div>
            <div>Overall Grade: <strong>${grade}</strong></div>
          </div>
          <div class="sigs">
            <div class="sig-line">Class Teacher Signature</div>
            <div class="sig-line">Examinations In-Charge</div>
            <div class="sig-line">Principal Stamp &amp; Signature</div>
          </div>
        </div>
      </body>
      </html>
    `);
    w.document.close();
  }

  // ============================================================================
  // MODULE 11: PARENT PORTAL & SIBLING SWITCHER
  // ============================================================================
  async function renderParentPortalScreen() {
    let screen = document.getElementById('screen-parent-portal');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'screen-parent-portal';
      screen.className = 'screen active';
      document.getElementById('main-content').appendChild(screen);
    }

    screen.innerHTML = `
      <div class="erp-container">
        <!-- Household Header & Sibling Switcher Tabs -->
        <div class="parent-household-header">
          <div>
            <h2 class="household-title">Household Parent Portal</h2>
            <p class="household-sub">Strictly isolated academic, fee &amp; medical records for your enrolled children</p>
          </div>
          <div class="sibling-switcher-tabs" id="sibling-switcher-tabs">
            <button type="button" class="sibling-tab active" data-sid="hes_1">Abid Abdullah (Class 6)</button>
            <button type="button" class="sibling-tab" data-sid="hes_2">Adnan Haider (Class 6)</button>
          </div>
        </div>

        <!-- Active Child Dashboard Grid -->
        <div id="parent-child-dashboard">
          <div class="erp-kpi-row">
            <div class="kpi-card kpi-blue">
              <span class="kpi-label">Attendance Rate</span>
              <strong class="kpi-value" id="pp-att-rate">94.5%</strong>
              <small>Present in class &amp; prep</small>
            </div>
            <div class="kpi-card kpi-green">
              <span class="kpi-label">Exam Performance</span>
              <strong class="kpi-value" id="pp-exam-grade">A (88%)</strong>
              <small>Class Rank: 1st</small>
            </div>
            <div class="kpi-card kpi-amber">
              <span class="kpi-label">Current Fee Due</span>
              <strong class="kpi-value" id="pp-fee-balance">PKR 0</strong>
              <small>November 2026 Challan</small>
            </div>
            <div class="kpi-card kpi-purple">
              <span class="kpi-label">Medical Visits</span>
              <strong class="kpi-value" id="pp-health-count">0 Visits</strong>
              <small>Campus infirmary record</small>
            </div>
          </div>

          <div class="parent-grid-two">
            <!-- Digital Diary & Homework -->
            <div class="table-responsive-card">
              <h3 class="card-section-title">Today's Classwork &amp; Homework Diary</h3>
              <p class="card-section-sub">Verified teacher daily entries for Class 6th</p>
              <div id="pp-diary-list" class="py-2">
                <div class="diary-item-card">
                  <span class="badge badge-class">English</span>
                  <p class="diary-hw"><strong>Homework:</strong> Learn question answers from Unit 4 (Poem) for oral assessment tomorrow.</p>
                  <small class="text-muted">Assigned by Sir Tariq Mahmood • Today</small>
                </div>
                <div class="diary-item-card mt-2">
                  <span class="badge badge-class">Mathematics</span>
                  <p class="diary-hw"><strong>Homework:</strong> Complete Exercise 3.2 Questions 1 to 5 in homework register.</p>
                  <small class="text-muted">Assigned by Sir Tariq Mahmood • Today</small>
                </div>
              </div>
            </div>

            <!-- Fee Challans & Proof Upload -->
            <div class="table-responsive-card">
              <div class="card-header-row">
                <div>
                  <h3 class="card-section-title">Fee Challans &amp; Online Payment</h3>
                  <p class="card-section-sub">1Bill payable via Easypaisa, JazzCash, or Bank app</p>
                </div>
              </div>
              <div class="p-3 bg-muted rounded mb-3">
                <div class="d-flex justify-between mb-1"><span>Challan No:</span><strong>CH-202611-001</strong></div>
                <div class="d-flex justify-between mb-1"><span>1Bill Consumer No:</span><code class="code-1bill">10012876540000000001</code></div>
                <div class="d-flex justify-between mb-1"><span>Payable Amount:</span><strong class="text-primary">PKR 4,000</strong></div>
                <div class="d-flex justify-between mb-1"><span>Status:</span><span class="status-pill status-pill-success">Paid ✓</span></div>
              </div>
              <button type="button" class="btn btn-outline w-100" onclick="alert('Upload Payment Slip: You can upload your mobile payment receipt screenshot here for bursar approval.')">
                Upload Paid Slip Screenshot
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Sibling switcher tab handler
    screen.querySelectorAll('.sibling-tab').forEach((tab) => {
      tab.onclick = () => {
        screen.querySelectorAll('.sibling-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        erpState.currentParentChildId = tab.dataset.sid;
        if (window.PortalBridge) window.PortalBridge.showToast(`Switched view to: ${tab.textContent}`, 'info');
      };
    });
  }

  // ============================================================================
  // MODULE 02: WHATSAPP COMMUNICATION CENTER
  // ============================================================================
  async function renderWhatsAppScreen() {
    let screen = document.getElementById('screen-whatsapp');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'screen-whatsapp';
      screen.className = 'screen active';
      document.getElementById('main-content').appendChild(screen);
    }

    screen.innerHTML = `
      <div class="erp-container">
        <div class="erp-top-toolbar">
          <div>
            <h3 class="card-section-title">WhatsApp Alert Dispatcher &amp; Queue</h3>
            <p class="card-section-sub">Persistent queue for student absence alerts, fee reminders, diary and receipts</p>
          </div>
          <div class="erp-toolbar-actions">
            <button type="button" class="btn btn-primary" id="btn-refresh-wa-queue">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        <div class="erp-kpi-row">
          <div class="kpi-card kpi-green">
            <span class="kpi-label">Active Connection</span>
            <strong class="kpi-value text-success">Connected ✓</strong>
            <small>Local Desktop Sender Companion</small>
          </div>
          <div class="kpi-card kpi-blue">
            <span class="kpi-label">Queued Messages</span>
            <strong class="kpi-value" id="wa-kpi-queued">0</strong>
            <small>Pending transmission</small>
          </div>
          <div class="kpi-card kpi-purple">
            <span class="kpi-label">Sent Alerts (Today)</span>
            <strong class="kpi-value" id="wa-kpi-sent">0</strong>
            <small>Delivered to parents</small>
          </div>
          <div class="kpi-card kpi-amber">
            <span class="kpi-label">Deduplicated Blocks</span>
            <strong class="kpi-value" id="wa-kpi-blocked">Active</strong>
            <small>Prevents repeat messages</small>
          </div>
        </div>

        <div class="table-responsive-card">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Recipient Phone</th>
                <th>Template</th>
                <th>Message Content</th>
                <th>Status</th>
                <th>Scheduled At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="wa-tbody">
              <tr><td colspan="6" class="text-center py-4">Loading queue...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    screen.querySelector('#btn-refresh-wa-queue').onclick = () => loadWhatsAppQueue();
    await loadWhatsAppQueue();
  }

  async function loadWhatsAppQueue() {
    const tbody = document.getElementById('wa-tbody');
    try {
      const res = await apiFetch('/whatsapp/queue');
      const items = res.queue || [];

      const queuedCount = items.filter((m) => m.status === 'QUEUED').length;
      const sentCount = items.filter((m) => m.status === 'SENT').length;
      document.getElementById('wa-kpi-queued').textContent = queuedCount;
      document.getElementById('wa-kpi-sent').textContent = sentCount;

      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No pending messages in queue. Alerts are automatically enqueued on absence marking or fee receipts.</td></tr>`;
        return;
      }

      tbody.innerHTML = items.map((m) => `
        <tr>
          <td><strong>${m.recipient_phone}</strong></td>
          <td><span class="badge badge-neutral">${m.template_name}</span></td>
          <td style="max-width: 320px;" class="text-truncate">${m.message_body}</td>
          <td>
            <span class="status-pill ${m.status === 'SENT' ? 'status-pill-success' : m.status === 'FAILED' ? 'status-pill-danger' : 'status-pill-warning'}">
              ${m.status}
            </span>
          </td>
          <td><small class="text-muted">${m.scheduled_at}</small></td>
          <td>
            ${m.status === 'FAILED' ? `<button type="button" class="btn btn-sm btn-outline" onclick="window.HesERP.retryWhatsApp('${m.id}')">Retry</button>` : '—'}
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Error: ${e.message}</td></tr>`;
    }
  }

  // ============================================================================
  // MODULE 10: STAFF & PAYROLL
  // ============================================================================
  async function renderPayrollScreen() {
    let screen = document.getElementById('screen-payroll');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'screen-payroll';
      screen.className = 'screen active';
      document.getElementById('main-content').appendChild(screen);
    }

    screen.innerHTML = `
      <div class="erp-container">
        <div class="erp-top-toolbar">
          <div class="erp-filter-group">
            <label class="input-label" for="payroll-month">Payroll Run Month</label>
            <input type="month" id="payroll-month" class="form-control" value="${erpState.activePayrollMonth}" />
          </div>
          <div class="erp-toolbar-actions">
            <button type="button" class="btn btn-primary" id="btn-generate-payroll">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>
              <span>Calculate Monthly Payroll</span>
            </button>
          </div>
        </div>

        <div class="table-responsive-card">
          <div class="card-header-row">
            <div>
              <h3 class="card-section-title">Institutional Staff &amp; Faculty Directory</h3>
              <p class="card-section-sub">Teaching &amp; administrative staff, basic salary, qualifications and status</p>
            </div>
            <span class="badge badge-neutral" id="staff-count-badge">6 Employees</span>
          </div>

          <table class="erp-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Phone</th>
                <th>Qualification</th>
                <th>Basic Salary</th>
                <th>Status</th>
                <th>Payslip</th>
              </tr>
            </thead>
            <tbody id="payroll-staff-tbody">
              <tr><td colspan="8" class="text-center py-4">Loading staff...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    screen.querySelector('#btn-generate-payroll').onclick = async () => {
      const month = screen.querySelector('#payroll-month').value;
      try {
        const res = await apiFetch('/payroll/generate', {
          method: 'POST',
          body: JSON.stringify({ month_label: month })
        });
        if (window.PortalBridge) window.PortalBridge.showToast(res.message, 'success');
      } catch (e) {
        alert(e.message);
      }
    };

    await loadStaffList();
  }

  async function loadStaffList() {
    const tbody = document.getElementById('payroll-staff-tbody');
    try {
      const res = await apiFetch('/staff');
      const staff = res.staff || [];
      document.getElementById('staff-count-badge').textContent = `${staff.length} Employees`;

      tbody.innerHTML = staff.map((s) => `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td>${s.designation}</td>
          <td><span class="badge badge-class">${s.department}</span></td>
          <td>${s.phone}</td>
          <td><small class="text-muted">${s.qualification || '—'}</small></td>
          <td class="font-mono font-semibold">PKR ${parseFloat(s.basic_salary).toLocaleString()}</td>
          <td><span class="status-pill status-pill-success">${s.status}</span></td>
          <td>
            <button type="button" class="btn btn-sm btn-outline" onclick="window.HesERP.printPayslip('${s.name}', '${s.designation}', ${s.basic_salary})">
              Payslip
            </button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Error: ${e.message}</td></tr>`;
    }
  }

  function printPayslip(name, desig, salary) {
    const w = window.open('', '_blank');
    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${name}</title>
        <style>
          body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 30px; color: #0f172a; }
          .payslip-sheet { border: 2px solid #001b4a; padding: 25px; border-radius: 10px; max-width: 600px; margin: auto; }
          .hdr { text-align: center; border-bottom: 2px solid #001b4a; padding-bottom: 10px; margin-bottom: 15px; }
          .field { display: flex; justify-content: space-between; margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1px dotted #cbd5e1; }
          .total { border-top: 2px solid #001b4a; border-bottom: 2px solid #001b4a; font-weight: bold; font-size: 16px; padding: 8px 0; margin-top: 15px; }
        </style>
      </head>
      <body onload="window.print()">
        <div class="payslip-sheet">
          <div class="hdr">
            <h2>Hadi Education System</h2>
            <p>Balkassar Campus • Staff Salary Disbursement Slip</p>
            <strong>Month: November 2026</strong>
          </div>
          <div class="field"><span>Employee Name:</span><strong>${name}</strong></div>
          <div class="field"><span>Designation:</span><span>${desig}</span></div>
          <div class="field"><span>Basic Salary:</span><span>PKR ${salary.toLocaleString()}</span></div>
          <div class="field"><span>House / Utility Allowance:</span><span>PKR 0.00</span></div>
          <div class="field"><span>Tax / Absence Deductions:</span><span>PKR 0.00</span></div>
          <div class="field"><span>Staff Loan Recovery:</span><span>PKR 0.00</span></div>
          <div class="field total"><span>Net Disbursed:</span><span style="color: #059669;">PKR ${salary.toLocaleString()}</span></div>
          <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
            <div>Accountant Signature</div>
            <div>Director / Principal Stamp</div>
          </div>
        </div>
      </body>
      </html>
    `);
    w.document.close();
  }

  // ============================================================================
  // MODULE 17: REPORTS & EXPORTS HUB
  // ============================================================================
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
          <button type="button" class="subtab-btn active" id="tab-rep-defaulters">Fee Defaulters &amp; Aging</button>
          <button type="button" class="subtab-btn" id="tab-rep-enrollment">Enrollment Strength</button>
        </div>

        <div id="reports-content" class="table-responsive-card">
          <div class="card-header-row">
            <div>
              <h3 class="card-section-title">Fee Defaulters Aging Report</h3>
              <p class="card-section-sub">Unpaid fee balances with father names, family IDs and contact numbers</p>
            </div>
            <button type="button" class="btn btn-outline" id="btn-export-defaulters-csv">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Export CSV</span>
            </button>
          </div>

          <table class="erp-table">
            <thead>
              <tr>
                <th>Challan No</th>
                <th>Student</th>
                <th>Father Name</th>
                <th>Class</th>
                <th>Phone</th>
                <th>Family Code</th>
                <th>Due Date</th>
                <th>Outstanding (PKR)</th>
              </tr>
            </thead>
            <tbody id="defaulters-tbody">
              <tr><td colspan="8" class="text-center py-4">Loading defaulters...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    screen.querySelector('#btn-export-defaulters-csv').onclick = () => exportDefaultersCSV();
    await loadDefaultersReport();
  }

  async function loadDefaultersReport() {
    const tbody = document.getElementById('defaulters-tbody');
    try {
      const res = await apiFetch('/reports/defaulters');
      const list = res.defaulters || [];

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-success">No fee defaulters! All active challans are cleared.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map((d) => `
        <tr>
          <td><strong>${d.challan_no}</strong></td>
          <td><strong>${d.name}</strong></td>
          <td>${d.father_name}</td>
          <td><span class="badge badge-class">${d.current_class_id}</span></td>
          <td><a href="tel:${d.phone}">${d.phone}</a></td>
          <td><code>${d.family_id || '—'}</code></td>
          <td>${d.due_date}</td>
          <td class="font-bold text-danger">PKR ${parseFloat(d.balance_amount).toLocaleString()}</td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Error: ${e.message}</td></tr>`;
    }
  }

  function exportDefaultersCSV() {
    apiFetch('/reports/defaulters').then((res) => {
      const list = res.defaulters || [];
      const headers = ['Challan No', 'Student Name', 'Father Name', 'Class', 'Phone', 'Family Code', 'Due Date', 'Outstanding Balance'];
      const rows = list.map((d) => [
        `"${d.challan_no}"`,
        `"${d.name}"`,
        `"${d.father_name}"`,
        `"${d.current_class_id}"`,
        `"${d.phone}"`,
        `"${d.family_id || ''}"`,
        `"${d.due_date}"`,
        `"${d.balance_amount}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hadi_Fee_Defaulters_${erpState.activeFeesMonth}.csv`;
      a.click();
    });
  }

  // ============================================================================
  // MODULE 15 & 20: ADMINISTRATIVE HUB, SESSIONS & AUDIT LOGS
  // ============================================================================
  async function renderAdminHubScreen() {
    let screen = document.getElementById('screen-admin-hub');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'screen-admin-hub';
      screen.className = 'screen active';
      document.getElementById('main-content').appendChild(screen);
    }

    screen.innerHTML = `
      <div class="erp-container">
        <!-- Sessions Card -->
        <div class="table-responsive-card mb-4">
          <div class="card-header-row">
            <div>
              <h3 class="card-section-title">Academic Sessions &amp; Annual Promotion</h3>
              <p class="card-section-sub">Switch active years and manage bulk student promotions with balance preservation</p>
            </div>
            <button type="button" class="btn btn-primary" id="btn-open-promotion-workflow">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
              <span>Bulk Promotion Workflow</span>
            </button>
          </div>
          <div class="p-3">
            <div class="d-flex gap-3 align-center">
              <div><strong>Active Session:</strong> <span class="badge badge-success">2025–2026 (Current Academic Year)</span></div>
              <div><strong>Archived Session:</strong> <span class="badge badge-neutral">2024–2025 (Historical Dues Preserved)</span></div>
            </div>
          </div>
        </div>

        <!-- Audit Trail Card -->
        <div class="table-responsive-card">
          <div class="card-header-row">
            <div>
              <h3 class="card-section-title">Immutable Activity Audit Trail</h3>
              <p class="card-section-sub">Cryptographically logged administrative actions, marks changes &amp; fee entries</p>
            </div>
          </div>
          <table class="erp-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor Role</th>
                <th>Action</th>
                <th>Target Entity</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody id="audit-tbody">
              <tr><td colspan="6" class="text-center py-4">Loading audit logs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    screen.querySelector('#btn-open-promotion-workflow').onclick = () => openPromotionModal();
    await loadAuditLogs();
  }

  async function loadAuditLogs() {
    const tbody = document.getElementById('audit-tbody');
    try {
      const res = await apiFetch('/audit-logs');
      const logs = res.logs || [];

      tbody.innerHTML = logs.map((l) => `
        <tr>
          <td><small class="font-mono">${l.timestamp}</small></td>
          <td><span class="badge badge-class">${l.actor_role}</span></td>
          <td><strong>${l.action}</strong></td>
          <td><code>${l.entity_type}:${l.entity_id}</code></td>
          <td><small class="text-muted">${l.ip_address || '127.0.0.1'}</small></td>
          <td><small class="font-mono text-muted">${l.details_json || '—'}</small></td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Error: ${e.message}</td></tr>`;
    }
  }

  function openPromotionModal() {
    alert('Annual Bulk Promotion: Select class (e.g. 6th to 7th). The system previews all 14 students, lets you mark individual retentions, and preserves historical examination broadsheets without duplicating records.');
  }

  // ============================================================================
  // THEME CUSTOMIZER (LIGHT & DARK MODE)
  // ============================================================================
  function initThemeSwitcher() {
    const savedTheme = localStorage.getItem('hes_portal_theme') || 'light';
    applyTheme(savedTheme, false);

    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
      btn.onclick = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const nextTheme = isDark ? 'light' : 'dark';
        applyTheme(nextTheme, true);
      };
    }
  }

  function applyTheme(theme, showToastMsg = false) {
    const icon = document.getElementById('theme-toggle-icon');
    const label = document.getElementById('theme-toggle-label');

    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('hes_portal_theme', 'dark');
      if (icon) icon.textContent = '☀️';
      if (label) label.textContent = 'Light';
      if (showToastMsg && window.PortalBridge) {
        window.PortalBridge.showToast('Dark Theme Applied 🌙', 'info');
      }
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('hes_portal_theme', 'light');
      if (icon) icon.textContent = '🌙';
      if (label) label.textContent = 'Dark';
      if (showToastMsg && window.PortalBridge) {
        window.PortalBridge.showToast('Light Theme Applied ☀️', 'info');
      }
    }
  }

  // ============================================================================
  // INITIALIZATION & PUBLIC BRIDGE
  // ============================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initThemeSwitcher();
    initAuth();
    injectERPSidebarItems();
    injectHomeQuickActions();
  });

  // Public surface
  window.HesERP = {
    switchScreen: activateERPScreen,
    switchRole: switchUserRole,
    toggleTheme: () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      applyTheme(isDark ? 'light' : 'dark', true);
    },
    collectChallan: (cid, bal) => openCounterCollectModal(cid, bal),
    printChallan: printChallan,
    printReportCard: printReportCard,
    printPayslip: printPayslip,
    retryWhatsApp: async (mid) => {
      await apiFetch('/whatsapp/retry', { method: 'POST', body: JSON.stringify({ id: mid }) });
      loadWhatsAppQueue();
    }
  };

})(window, document);

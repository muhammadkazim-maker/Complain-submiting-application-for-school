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

    // Update topbar titles & breadcrumbs
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
  function initAll() {
    initThemeSwitcher();
    initAuth();
    injectERPSidebarItems();
    injectHomeQuickActions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

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

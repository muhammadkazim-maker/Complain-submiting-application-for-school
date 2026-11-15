# -*- coding: utf-8 -*-
"""
Update index.html with the redesigned:
1. Grouped Sidebar Navigation (Overview, Academics, Students & Discipline, Finance & HR, Communication & System)
2. Premium Top Bar (Mobile Toggle, Breadcrumbs, Live Search Input with / kbd, Session Badge, Quick Actions, Theme Toggle)
3. Executive Dashboard (#screen-home): Welcome Panel, 4 Hero KPIs, Dual SVG Trend Charts, 6 Workflow Tiles, Attention Watchlist, Recent Activity
"""

import os
import re

WORKSPACE = r"c:\Hadi education system student record management"

def run():
    print("Reading index.html...")
    with open(os.path.join(WORKSPACE, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()

    # 1. NEW SIDEBAR MARKUP
    new_sidebar = """    <!-- ====================================================================
         DESKTOP COLLAPSIBLE SIDEBAR (Hidden on < 1024px)
         ==================================================================== -->
    <aside id="app-sidebar" class="app-sidebar no-print" aria-label="Primary Navigation">
      <div class="sidebar-top">
        <div class="sidebar-brand" id="sidebar-brand-link" role="button" tabindex="0" aria-label="Go to Home Dashboard">
          <div class="brand-crest" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <div class="sidebar-brand-text">
            <strong>Hadi Education</strong>
            <span>Balkassar Campus</span>
          </div>
        </div>

        <button
          type="button"
          id="btn-toggle-sidebar"
          class="sidebar-collapse-btn"
          aria-expanded="true"
          aria-controls="app-sidebar"
          aria-label="Collapse sidebar navigation"
          title="Collapse / Expand Sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      <nav class="sidebar-nav" aria-label="Main Navigation">
        <!-- 1. OVERVIEW -->
        <div class="snav-section-label">OVERVIEW</div>
        <button type="button" class="nav-link active" data-screen="home" id="desk-nav-home" title="Home Dashboard">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </span>
          <span class="nav-label">Home Dashboard</span>
        </button>

        <!-- 2. ACADEMICS -->
        <div class="snav-section-label">ACADEMICS</div>
        <button type="button" class="nav-link" data-screen="class-attendance" id="desk-nav-class-attendance" title="Classes Attendance">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <path d="m9 16 2 2 4-4"/>
            </svg>
          </span>
          <span class="nav-label">Classes Attendance</span>
          <span class="nav-count nav-count-sky" id="snav-badge-class-att">0</span>
        </button>

        <button type="button" class="nav-link" data-screen="prep-attendance" id="desk-nav-prep-attendance" title="Prep Attendance">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="9"/>
              <polyline points="12 7 12 12 15 15"/>
            </svg>
          </span>
          <span class="nav-label">Prep Attendance</span>
          <span class="nav-count nav-count-violet" id="snav-badge-prep-att">0</span>
        </button>

        <button type="button" class="nav-link" data-screen="homework" id="desk-nav-homework" title="Homework &amp; Tasks">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
              <path d="M8 7h6"/>
              <path d="M8 11h8"/>
            </svg>
          </span>
          <span class="nav-label">Homework &amp; Tasks</span>
          <span class="nav-count nav-count-amber" id="snav-badge-pending">0</span>
        </button>

        <button type="button" class="nav-link" data-screen="tests" id="desk-nav-tests" title="Monthly Tests">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="m9 15 2 2 4-4"/>
            </svg>
          </span>
          <span class="nav-label">Monthly Tests</span>
          <span class="nav-count" id="snav-badge-tests">0</span>
        </button>

        <button type="button" class="nav-link" data-screen="exams" id="desk-nav-exams" title="Examinations &amp; Broadsheets">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </span>
          <span class="nav-label">Exams Broadsheet</span>
        </button>

        <!-- 3. STUDENTS & DISCIPLINE -->
        <div class="snav-section-label">STUDENTS &amp; DISCIPLINE</div>
        <button type="button" class="nav-link" data-screen="student-details" id="desk-nav-student-details" title="Student Directory">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="16" rx="2"/>
              <circle cx="9" cy="10" r="2.2"/>
              <path d="M6.2 16c.5-1.5 1.6-2.3 2.8-2.3s2.3.8 2.8 2.3"/>
              <line x1="14" y1="9" x2="18.5" y2="9"/>
              <line x1="14" y1="13" x2="18.5" y2="13"/>
            </svg>
          </span>
          <span class="nav-label">Student Directory</span>
          <span class="nav-count nav-count-teal" id="snav-badge-student-details">134</span>
        </button>

        <button type="button" class="nav-link" data-screen="grand-report" id="desk-nav-grand-report" title="Grand Student Report">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18"/>
              <path d="m19 9-5 5-4-4-3 3"/>
            </svg>
          </span>
          <span class="nav-label">Grand Student Report</span>
        </button>

        <button type="button" class="nav-link" data-screen="violations" id="desk-nav-violations" title="Violation Record">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </span>
          <span class="nav-label">Violations &amp; Discipline</span>
          <span class="nav-count" id="snav-badge-violations">0</span>
        </button>

        <button type="button" class="nav-link" data-screen="health" id="desk-nav-health" title="Health &amp; Medical">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 21s-7-4.5-9-9.5C1.5 7.5 4.2 4 8 4c2.1 0 3.5 1.1 4 2.2C12.5 5.1 13.9 4 16 4c3.8 0 6.5 3.5 5 7.5-2 5-9 9.5-9 9.5z"/>
              <path d="M9.5 11.5h5"/>
              <path d="M12 9v5"/>
            </svg>
          </span>
          <span class="nav-label">Health &amp; Medical</span>
          <span class="nav-count nav-count-rose" id="snav-badge-health">0</span>
        </button>

        <!-- 4. FINANCE & HR -->
        <div class="snav-section-label">FINANCE &amp; HR</div>
        <button type="button" class="nav-link" data-screen="fees" id="desk-nav-fees" title="Fee Challans &amp; Collection">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </span>
          <span class="nav-label">Fees &amp; Challans</span>
          <span class="nav-count nav-count-amber" id="snav-badge-fees">1Bill</span>
        </button>

        <button type="button" class="nav-link" data-screen="accounting" id="desk-nav-accounting" title="Accounts &amp; General Ledger">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
              <path d="M9 10h6M12 7v6"/>
            </svg>
          </span>
          <span class="nav-label">Accounts &amp; Ledger</span>
        </button>

        <button type="button" class="nav-link" data-screen="payroll" id="desk-nav-payroll" title="Staff Profiles &amp; Monthly Payroll">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            </svg>
          </span>
          <span class="nav-label">Staff &amp; Payroll</span>
        </button>

        <!-- 5. COMMUNICATION & SYSTEM -->
        <div class="snav-section-label">COMMUNICATION &amp; ADMIN</div>
        <button type="button" class="nav-link" data-screen="whatsapp" id="desk-nav-whatsapp" title="WhatsApp Alerts &amp; Queue">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </span>
          <span class="nav-label">WhatsApp Queue</span>
        </button>

        <button type="button" class="nav-link" data-screen="parent-portal" id="desk-nav-parent" title="Parent Portal &amp; Sibling Switcher">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="7" r="4"/>
              <path d="M5.5 21a6.5 6.5 0 0 1 13 0"/>
            </svg>
          </span>
          <span class="nav-label">Parent Portal</span>
        </button>

        <button type="button" class="nav-link" data-screen="reports" id="desk-nav-reports" title="Defaulters, Financials &amp; Export Hub">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </span>
          <span class="nav-label">Reports &amp; Exports</span>
        </button>

        <button type="button" class="nav-link" data-screen="admin-hub" id="desk-nav-admin-hub" title="Academic Sessions &amp; System Hub">
          <span class="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
          <span class="nav-label">Admin &amp; Sessions</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-session-pill">
          <span class="pulse-indicator"></span>
          <span>Session 2026–2027 Active</span>
        </div>
        <div class="sidebar-user-card" id="sidebar-user-trigger" role="button" tabindex="0" title="Switch User Role">
          <div class="user-avatar-circle">K</div>
          <div class="user-info-text">
            <strong id="sidebar-user-name">Kazim Raza</strong>
            <span id="sidebar-user-role">Administrator</span>
          </div>
          <div class="user-switch-badge">Switch</div>
        </div>
      </div>
    </aside>"""

    # 2. NEW HEADER MARKUP
    new_header = """      <!-- Premium Top Bar -->
      <header class="app-header no-print">
        <div class="header-container">
          <!-- Mobile Menu Button -->
          <button type="button" class="mobile-menu-btn" id="btn-mobile-sidebar-toggle" aria-label="Open Navigation Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          <!-- Breadcrumbs and Context -->
          <div class="topbar-breadcrumbs" id="topbar-breadcrumbs">
            <span class="crumb-section" id="topbar-crumb-section">Overview</span>
            <span class="crumb-separator">/</span>
            <span class="crumb-active" id="topbar-crumb-active">Home Dashboard</span>
          </div>

          <!-- Working Live Search Bar with keyboard shortcut -->
          <div class="topbar-search-wrap">
            <div class="search-input-box">
              <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="topbar-search-input" class="search-input" placeholder="Search students, roll #, modules..." autocomplete="off" />
              <kbd class="search-kbd">/</kbd>
            </div>
            <div id="topbar-search-dropdown" class="search-dropdown" hidden></div>
          </div>

          <!-- Active Session Pill -->
          <div class="topbar-session-badge hide-tablet">
            <span class="pulse-indicator"></span>
            <span>Session 2026–2027</span>
          </div>

          <!-- Quick Action Buttons -->
          <div class="topbar-quick-actions hide-mobile">
            <button type="button" class="btn btn-outline btn-xs" id="tb-action-attendance" title="Quick Roll Call">Roll Call</button>
            <button type="button" class="btn btn-outline btn-xs" id="tb-action-fees" title="Fee Collection">Fee Pay</button>
          </div>

          <!-- Header Utility Actions -->
          <div class="header-actions">
            <!-- Theme Toggle -->
            <button type="button" class="btn-theme-toggle" id="btn-theme-toggle" title="Toggle Light / Dark Mode" aria-label="Toggle Theme">
              <span class="theme-icon" id="theme-toggle-icon">🌙</span>
              <span class="theme-label hide-compact" id="theme-toggle-label">Dark</span>
            </button>

            <!-- AI Assistant Button -->
            <button type="button" class="btn-ai-assistant" id="btn-ai-assistant" title="Open AI Assistant" aria-label="Open AI Assistant">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L14.8 8.6L22 9.2L16.5 13.8L18.2 21L12 17.2L5.8 21L7.5 13.8L2 9.2L9.2 8.6L12 2Z"/></svg>
              <span class="hide-compact">AI Assistant</span>
            </button>

            <!-- Data & Backup Utility Dropdown -->
            <div class="utility-menu-wrap" id="utility-menu-wrap">
              <button
                type="button"
                class="btn-utility"
                id="btn-utility-menu"
                aria-haspopup="menu"
                aria-expanded="false"
                aria-controls="utility-menu-dropdown"
                aria-label="Data, Backup &amp; Export"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
                  <path d="M3 12a9 3 0 0 0 18 0"/>
                </svg>
                <span class="hide-compact">Data</span>
              </button>

              <div id="utility-menu-dropdown" class="utility-dropdown" role="menu" aria-labelledby="btn-utility-menu" hidden>
                <div class="utility-dropdown-header">Portal Data &amp; Backups</div>

                <button type="button" role="menuitem" class="utility-item" id="btn-export-csv">
                  <span class="utility-item-text">
                    <strong>Export Violations (CSV)</strong>
                    <small>Spreadsheet-safe discipline log</small>
                  </span>
                </button>

                <button type="button" role="menuitem" class="utility-item" id="btn-export-backup">
                  <span class="utility-item-text">
                    <strong>Download Full JSON Backup</strong>
                    <small>Save violations, homework &amp; tests</small>
                  </span>
                </button>

                <button type="button" role="menuitem" class="utility-item" id="btn-import-backup">
                  <span class="utility-item-text">
                    <strong>Restore from JSON Backup</strong>
                    <small>Preview counts &amp; confirm before replace</small>
                  </span>
                </button>

                <button type="button" role="menuitem" class="utility-item" id="btn-restore-recovery" hidden>
                  <span class="utility-item-text">
                    <strong>Restore Pre-Import Snapshot</strong>
                    <small>Undo last backup replacement</small>
                  </span>
                </button>

                <input type="file" id="file-import-input" accept=".json" hidden />
              </div>
            </div>
          </div>
        </div>
      </header>"""

    # 3. NEW EXECUTIVE DASHBOARD MARKUP
    new_home = """        <!-- ==================================================================
             SCREEN 0: EXECUTIVE DASHBOARD
             ================================================================== -->
        <section id="screen-home" class="screen active" aria-labelledby="home-hero-heading">

          <!-- Executive Welcome Panel -->
          <div class="welcome-panel">
            <div class="welcome-content">
              <div class="welcome-meta-row">
                <span class="welcome-school-pill">Hadi Education System &bull; Balkassar Campus</span>
                <span class="welcome-date-pill" id="home-current-date">Today</span>
              </div>
              <h2 id="home-hero-heading" class="welcome-title">Academic Control Center &amp; Executive Overview</h2>
              <p class="welcome-subtitle">
                Unified operations for Classes 6th–12th: live attendance monitoring, fee challan collection, student discipline scoring, and verified academic broadsheets.
              </p>
            </div>
            <div class="welcome-art hide-mobile">
              <div class="brand-crest" style="width:68px; height:68px; border-radius:18px;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
              </div>
            </div>
          </div>

          <!-- 4 HERO KPI METRIC CARDS -->
          <div class="kpi-grid" aria-label="Key Performance Indicators">
            <!-- Card 1: Students Roster -->
            <div class="kpi-card">
              <div class="kpi-top">
                <span class="kpi-label">Enrolled Students</span>
                <div class="kpi-icon-wrap icon-teal">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
              </div>
              <div class="kpi-val" id="home-stat-students">134</div>
              <div class="kpi-sub">
                <span class="kpi-badge badge-teal">Classes 6th–12th</span>
                <span>100% Active Profiles</span>
              </div>
            </div>

            <!-- Card 2: Today's Attendance -->
            <div class="kpi-card">
              <div class="kpi-top">
                <span class="kpi-label">Today's Attendance</span>
                <div class="kpi-icon-wrap icon-green">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
              </div>
              <div class="kpi-val" id="home-kpi-att-rate">96.3%</div>
              <div class="kpi-sub">
                <span class="kpi-badge badge-green">129 Present</span>
                <span>4 Absent &bull; 1 Leave</span>
              </div>
            </div>

            <!-- Card 3: Monthly Fee Collection -->
            <div class="kpi-card">
              <div class="kpi-top">
                <span class="kpi-label">Monthly Collection</span>
                <div class="kpi-icon-wrap icon-amber">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                </div>
              </div>
              <div class="kpi-val" id="home-kpi-fees">Rs. 465,000</div>
              <div class="kpi-sub">
                <span class="kpi-badge badge-amber">86.6% Paid</span>
                <span>Rs. 72k Due &bull; 15 Defaulters</span>
              </div>
            </div>

            <!-- Card 4: Academic & Discipline Health -->
            <div class="kpi-card">
              <div class="kpi-top">
                <span class="kpi-label">Academic Health</span>
                <div class="kpi-icon-wrap icon-indigo">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
              </div>
              <div class="kpi-val" id="home-kpi-health">100% Clean</div>
              <div class="kpi-sub">
                <span class="kpi-badge badge-teal">0 Critical</span>
                <span>Discipline Index: Optimal</span>
              </div>
            </div>
          </div>

          <!-- DUAL VISUAL TREND CHARTS -->
          <div class="dashboard-charts-grid">
            <!-- Chart 1: 7-Day Attendance Trend -->
            <div class="chart-card">
              <div class="chart-header">
                <div class="chart-title-wrap">
                  <h3>Weekly Attendance Trend</h3>
                  <p>Daily student presence rate across all 7 grade levels</p>
                </div>
                <span class="chart-tag">Avg 95.8%</span>
              </div>
              <div class="chart-body" id="chart-attendance-container">
                <svg viewBox="0 0 450 180" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#087F8C" stop-opacity="0.25"/>
                      <stop offset="100%" stop-color="#087F8C" stop-opacity="0.0"/>
                    </linearGradient>
                  </defs>
                  <!-- Background grid lines -->
                  <line x1="40" y1="30" x2="430" y2="30" stroke="var(--border-color)" stroke-dasharray="3 3"/>
                  <line x1="40" y1="75" x2="430" y2="75" stroke="var(--border-color)" stroke-dasharray="3 3"/>
                  <line x1="40" y1="120" x2="430" y2="120" stroke="var(--border-color)" stroke-dasharray="3 3"/>
                  <!-- Shaded area -->
                  <polygon points="50,150 50,60 115,50 180,68 245,38 310,65 375,42 420,45 420,150" fill="url(#attGrad)"/>
                  <!-- Data curve -->
                  <polyline points="50,60 115,50 180,68 245,38 310,65 375,42 420,45" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                  <!-- Points -->
                  <circle cx="50" cy="60" r="4.5" fill="var(--bg-card)" stroke="var(--primary)" stroke-width="2.5"/>
                  <circle cx="115" cy="50" r="4.5" fill="var(--bg-card)" stroke="var(--primary)" stroke-width="2.5"/>
                  <circle cx="180" cy="68" r="4.5" fill="var(--bg-card)" stroke="var(--primary)" stroke-width="2.5"/>
                  <circle cx="245" cy="38" r="4.5" fill="var(--bg-card)" stroke="var(--primary)" stroke-width="2.5"/>
                  <circle cx="310" cy="65" r="4.5" fill="var(--bg-card)" stroke="var(--primary)" stroke-width="2.5"/>
                  <circle cx="375" cy="42" r="4.5" fill="var(--bg-card)" stroke="var(--primary)" stroke-width="2.5"/>
                  <!-- X-Axis Labels -->
                  <text x="50" y="168" font-size="11" fill="var(--text-muted)" text-anchor="middle">Mon</text>
                  <text x="115" y="168" font-size="11" fill="var(--text-muted)" text-anchor="middle">Tue</text>
                  <text x="180" y="168" font-size="11" fill="var(--text-muted)" text-anchor="middle">Wed</text>
                  <text x="245" y="168" font-size="11" fill="var(--text-muted)" text-anchor="middle">Thu</text>
                  <text x="310" y="168" font-size="11" fill="var(--text-muted)" text-anchor="middle">Fri</text>
                  <text x="375" y="168" font-size="11" fill="var(--text-muted)" text-anchor="middle">Sat</text>
                  <!-- Y-Axis Labels -->
                  <text x="30" y="34" font-size="10" fill="var(--text-muted)" text-anchor="end">100%</text>
                  <text x="30" y="79" font-size="10" fill="var(--text-muted)" text-anchor="end">95%</text>
                  <text x="30" y="124" font-size="10" fill="var(--text-muted)" text-anchor="end">90%</text>
                </svg>
              </div>
              <div class="chart-footer">
                <span>Target: 95.0% Benchmark</span>
                <strong style="color:var(--success);">&uarr; +1.3% vs Prior Week</strong>
              </div>
            </div>

            <!-- Chart 2: Fee Collections by Stream -->
            <div class="chart-card">
              <div class="chart-header">
                <div class="chart-title-wrap">
                  <h3>Monthly Revenue &amp; Collections</h3>
                  <p>Collected revenue vs projected targets by category</p>
                </div>
                <span class="chart-tag">November 2026</span>
              </div>
              <div class="chart-body" id="chart-fees-container">
                <svg viewBox="0 0 450 180" preserveAspectRatio="none">
                  <!-- Tuition Bar -->
                  <rect x="55" y="25" width="22" height="125" rx="4" fill="var(--border-color)"/>
                  <rect x="80" y="42" width="22" height="108" rx="4" fill="var(--primary)"/>
                  <text x="78" y="168" font-size="11" fill="var(--text-muted)" text-anchor="middle">Tuition</text>
                  
                  <!-- Prep Bar -->
                  <rect x="150" y="55" width="22" height="95" rx="4" fill="var(--border-color)"/>
                  <rect x="175" y="70" width="22" height="80" rx="4" fill="var(--primary)"/>
                  <text x="173" y="168" font-size="11" fill="var(--text-muted)" text-anchor="middle">Prep Class</text>
                  
                  <!-- Lab Bar -->
                  <rect x="245" y="85" width="22" height="65" rx="4" fill="var(--border-color)"/>
                  <rect x="270" y="95" width="22" height="55" rx="4" fill="var(--primary)"/>
                  <text x="268" y="168" font-size="11" fill="var(--text-muted)" text-anchor="middle">Science Lab</text>
                  
                  <!-- Exam & Misc -->
                  <rect x="340" y="95" width="22" height="55" rx="4" fill="var(--border-color)"/>
                  <rect x="365" y="105" width="22" height="45" rx="4" fill="var(--primary)"/>
                  <text x="363" y="168" font-size="11" fill="var(--text-muted)" text-anchor="middle">Exams</text>
                </svg>
              </div>
              <div class="chart-footer">
                <div style="display:flex; gap:14px;">
                  <span><span style="display:inline-block; width:10px; height:10px; background:var(--border-color); border-radius:2px; margin-right:4px;"></span>Target</span>
                  <span><span style="display:inline-block; width:10px; height:10px; background:var(--primary); border-radius:2px; margin-right:4px;"></span>Collected</span>
                </div>
                <strong>Rs. 465,000 / Rs. 537,000</strong>
              </div>
            </div>
          </div>

          <!-- PRIMARY OPERATIONS LAUNCHPAD -->
          <div class="workflow-section-title">Primary Workflows &amp; Operations</div>
          <div class="quick-workflow-grid">
            <div class="wf-tile" id="qa-class-attendance" role="button" tabindex="0">
              <div class="wf-tile-icon icon-teal">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
              </div>
              <strong>Classes Roll Call</strong>
              <span>Classes 6th–12th</span>
            </div>

            <div class="wf-tile" id="qa-prep-attendance" role="button" tabindex="0">
              <div class="wf-tile-icon icon-indigo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
              </div>
              <strong>Prep Attendance</strong>
              <span>Prep 1 &bull; 2 &bull; 3</span>
            </div>

            <div class="wf-tile" id="qa-add-homework" role="button" tabindex="0">
              <div class="wf-tile-icon icon-green">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>
              </div>
              <strong>Assign Homework</strong>
              <span>Concept Clarity</span>
            </div>

            <div class="wf-tile" id="qa-log-violation" role="button" tabindex="0">
              <div class="wf-tile-icon icon-amber">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <strong>Log Incident</strong>
              <span>Discipline Scoring</span>
            </div>

            <div class="wf-tile" id="qa-fees" role="button" tabindex="0">
              <div class="wf-tile-icon icon-teal">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <strong>Fee Collection</strong>
              <span>1Bill &amp; Counter</span>
            </div>

            <div class="wf-tile" id="qa-broadsheet" role="button" tabindex="0">
              <div class="wf-tile-icon icon-indigo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <strong>Broadsheets</strong>
              <span>Exam Marksheets</span>
            </div>
          </div>

          <!-- ATTENTION WATCHLIST & URGENT TASKS -->
          <div class="watchlist-grid">
            <!-- Left: Fee Defaulter Watchlist -->
            <div class="watchlist-card">
              <div class="watchlist-header">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  Fee Defaulter Watchlist
                </h3>
                <span class="watchlist-count-badge" id="defaulter-count-badge">15 Defaulters</span>
              </div>
              <table class="watchlist-table">
                <thead>
                  <tr>
                    <th>Roll #</th>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Overdue</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="watchlist-defaulters-body">
                  <tr>
                    <td><strong>#104</strong></td>
                    <td>Ali Hamza</td>
                    <td>Class 9th</td>
                    <td class="tabular-nums font-mono" style="color:var(--danger); font-weight:700;">Rs. 5,500</td>
                    <td>
                      <a href="https://wa.me/923001234567?text=Assalam-o-Alaikum%20Dear%20Parent,%20fee%20challan%20for%20Ali%20Hamza%20is%20pending." target="_blank" class="watchlist-action-btn" title="Send WhatsApp Fee Notice">
                        WhatsApp
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>#208</strong></td>
                    <td>Usman Tariq</td>
                    <td>Class 10th</td>
                    <td class="tabular-nums font-mono" style="color:var(--danger); font-weight:700;">Rs. 4,800</td>
                    <td>
                      <a href="https://wa.me/923001234567?text=Assalam-o-Alaikum%20Dear%20Parent,%20fee%20challan%20for%20Usman%20Tariq%20is%20pending." target="_blank" class="watchlist-action-btn" title="Send WhatsApp Fee Notice">
                        WhatsApp
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>#312</strong></td>
                    <td>Fatima Zahra</td>
                    <td>Class 8th</td>
                    <td class="tabular-nums font-mono" style="color:var(--danger); font-weight:700;">Rs. 4,200</td>
                    <td>
                      <a href="https://wa.me/923001234567?text=Assalam-o-Alaikum%20Dear%20Parent,%20fee%20challan%20for%20Fatima%20Zahra%20is%20pending." target="_blank" class="watchlist-action-btn" title="Send WhatsApp Fee Notice">
                        WhatsApp
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Right: Academic & Discipline Alerts -->
            <div class="watchlist-card">
              <div class="watchlist-header">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Academic &amp; Discipline Attention
                </h3>
                <span class="watchlist-count-badge" style="background:var(--primary-soft); color:var(--primary);">3 Needing Review</span>
              </div>
              <table class="watchlist-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Student / Class</th>
                    <th>Issue</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="watchlist-academic-body">
                  <tr>
                    <td><span class="status-pill status-leave">Homework</span></td>
                    <td><strong>Bilal Ahmed</strong> (Class 9th)</td>
                    <td>Physics Ch. 4 Concept Unclear</td>
                    <td><span class="status-pill status-absent">Pending</span></td>
                  </tr>
                  <tr>
                    <td><span class="status-pill status-absent">Attendance</span></td>
                    <td><strong>Hamza Malik</strong> (Class 10th)</td>
                    <td>3 Consecutive Days Absent</td>
                    <td><span class="status-pill status-leave">Follow Up</span></td>
                  </tr>
                  <tr>
                    <td><span class="status-pill status-present">Test</span></td>
                    <td><strong>Class 7th</strong> (Mathematics)</td>
                    <td>October Test Marks Verified</td>
                    <td><span class="status-pill status-present">Complete</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </section>"""

    # Apply replacement for Sidebar:
    # From `<aside id="app-sidebar"` to `</aside>`
    sidebar_regex = r'<aside id="app-sidebar".*?</aside>'
    html = re.sub(sidebar_regex, new_sidebar.strip(), html, flags=re.DOTALL)
    print("Sidebar replaced successfully!")

    # Apply replacement for Header:
    # From `<header class="app-header no-print">` to `</header>`
    header_regex = r'<header class="app-header no-print">.*?</header>'
    html = re.sub(header_regex, new_header.strip(), html, flags=re.DOTALL)
    print("Header replaced successfully!")

    # Apply replacement for Screen Home:
    # From `<section id="screen-home"` to before `<section id="screen-violations"`
    home_regex = r'<section id="screen-home".*?(?=\s*<section id="screen-violations")'
    html = re.sub(home_regex, new_home.strip() + "\n\n", html, flags=re.DOTALL)
    print("Home screen replaced successfully!")

    with open(os.path.join(WORKSPACE, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("index.html successfully updated!")

if __name__ == "__main__":
    run()

import re

DARK_THEME_CSS = """/* ==========================================================================
   COMPREHENSIVE DARK THEME REVAMP (Modern Slate & Obsidian with Glow)
   ========================================================================== */
[data-theme="dark"] {
  --bg-app: #070C18;
  --bg-card: #111827;
  --bg-subtle: #162032;
  --bg-muted-surface: #0F172A;
  --border-color: #243247;
  --border-strong: #374151;

  --navy: #F8FAFC;
  --navy-mid: #E2E8F0;
  --text-main: #F8FAFC;
  --text-muted: #94A3B8;

  --accent: #818CF8;
  --accent-hover: #A5B4FC;
  --accent-soft: rgba(99, 102, 241, 0.2);
  --accent-border: #6366F1;
  --accent-focus: rgba(99, 102, 241, 0.35);

  --success: #34D399;
  --success-hover: #10B981;
  --success-soft: rgba(16, 185, 129, 0.2);
  --success-border: #10B981;

  --attention: #FBBF24;
  --attention-soft: rgba(245, 158, 11, 0.2);
  --attention-border: #F59E0B;

  --danger: #F87171;
  --danger-hover: #EF4444;
  --danger-soft: rgba(239, 68, 68, 0.2);
  --danger-border: #EF4444;

  --viol-accent: #FB923C;
  --viol-soft: rgba(234, 88, 12, 0.2);
  --viol-border: #EA580C;

  --hw-teal: #2DD4BF;
  --hw-teal-hover: #14B8A6;
  --hw-teal-soft: rgba(20, 184, 166, 0.2);
  --hw-teal-border: #0D9488;

  --test-indigo: #818CF8;
  --test-indigo-hover: #6366F1;
  --test-indigo-soft: rgba(99, 102, 241, 0.2);
  --test-indigo-border: #4F46E5;

  --att-sky: #38BDF8;
  --att-sky-hover: #0EA5E9;
  --att-sky-soft: rgba(14, 165, 233, 0.2);
  --att-sky-border: #0284C7;

  --prep-violet: #A78BFA;
  --prep-violet-hover: #8B5CF6;
  --prep-violet-soft: rgba(139, 92, 246, 0.2);
  --prep-violet-border: #7C3AED;

  --health-rose: #FB7185;
  --health-rose-hover: #F43F5E;
  --health-rose-soft: rgba(244, 63, 94, 0.2);
  --health-rose-border: #E11D48;

  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.5);
  --shadow-md: 0 4px 14px rgba(0, 0, 0, 0.6);
  --shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.7);
}

/* Base Body & Layout in Dark Mode */
[data-theme="dark"] body {
  background-color: #070C18 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .app-header {
  background: #0F172A !important;
  border-bottom: 1px solid #1E293B !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
}

[data-theme="dark"] .app-sidebar {
  background: #0A0F1D !important;
  border-right: 1px solid #1E293B !important;
}

[data-theme="dark"] .nav-item {
  color: #94A3B8 !important;
}

[data-theme="dark"] .nav-item:hover {
  background: rgba(255, 255, 255, 0.05) !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .nav-item.active {
  background: rgba(99, 102, 241, 0.18) !important;
  color: #818CF8 !important;
  border-color: #6366F1 !important;
}

[data-theme="dark"] .welcome-panel {
  background: linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%) !important;
  border: 1px solid #243247 !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
}

/* Drill-Down Cards & Breadcrumbs (Fixes Class 6..12 Cards) */
[data-theme="dark"] .drill-breadcrumb {
  background-color: #0F172A !important;
  border: 1.5px solid #243247 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
}

[data-theme="dark"] .crumb-btn {
  color: #818CF8 !important;
}

[data-theme="dark"] .crumb-btn:hover {
  background-color: rgba(99, 102, 241, 0.15) !important;
  color: #C7D2FE !important;
}

[data-theme="dark"] .crumb-sep {
  color: #475569 !important;
}

[data-theme="dark"] .crumb-current {
  color: #F8FAFC !important;
}

[data-theme="dark"] .drill-box {
  background-color: #111827 !important;
  border: 1.5px solid #243247 !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease !important;
}

[data-theme="dark"] .drill-box:hover {
  background-color: #162238 !important;
  border-color: #6366F1 !important;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99, 102, 241, 0.45) !important;
  transform: translateY(-2px);
}

[data-theme="dark"] .drill-box-title {
  color: #F8FAFC !important;
  font-weight: 800 !important;
}

[data-theme="dark"] .drill-box-sub {
  color: #94A3B8 !important;
}

[data-theme="dark"] .drill-box-footer {
  border-top: 1px solid #1E293B !important;
  color: #818CF8 !important;
}

[data-theme="dark"] .drill-pill {
  background-color: #1E293B !important;
  color: #CBD5E1 !important;
  border: 1px solid #334155 !important;
}

[data-theme="dark"] .drill-pill-blue {
  background-color: rgba(99, 102, 241, 0.22) !important;
  color: #A5B4FC !important;
  border-color: rgba(99, 102, 241, 0.45) !important;
}

[data-theme="dark"] .drill-pill-green {
  background-color: rgba(16, 185, 129, 0.22) !important;
  color: #6EE7B7 !important;
  border-color: rgba(16, 185, 129, 0.45) !important;
}

[data-theme="dark"] .drill-pill-amber {
  background-color: rgba(245, 158, 11, 0.22) !important;
  color: #FCD34D !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
}

[data-theme="dark"] .drill-pill-red {
  background-color: rgba(239, 68, 68, 0.22) !important;
  color: #FCA5A5 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

/* Subtabs Bar & Active State */
[data-theme="dark"] .subtabs-bar {
  background-color: #0F172A !important;
  border: 1.5px solid #243247 !important;
}

[data-theme="dark"] .subtab-btn {
  color: #94A3B8 !important;
}

[data-theme="dark"] .subtab-btn:hover {
  color: #F8FAFC !important;
  background-color: rgba(255, 255, 255, 0.04) !important;
}

[data-theme="dark"] .subtab-btn.active {
  background-color: #1E293B !important;
  color: #818CF8 !important;
  border-color: #4F46E5 !important;
  box-shadow: 0 2px 10px rgba(79, 70, 229, 0.3) !important;
}

/* Homework Module Styling */
[data-theme="dark"] .hw-add-banner-box {
  background: linear-gradient(135deg, #064E3B 0%, #0F172A 100%) !important;
  border: 1.5px solid #065F46 !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5) !important;
}

[data-theme="dark"] .hw-banner-left h3 {
  color: #FFFFFF !important;
}

[data-theme="dark"] .hw-banner-left p {
  color: #A7F3D0 !important;
}

[data-theme="dark"] .hw-auto-datetime {
  color: #6EE7B7 !important;
  border-color: rgba(16, 185, 129, 0.3) !important;
  background: rgba(16, 185, 129, 0.1) !important;
}

[data-theme="dark"] .hw-toggle-pill {
  background-color: rgba(0, 0, 0, 0.4) !important;
  color: #FFFFFF !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}

[data-theme="dark"] .hw-toggle-pill:hover {
  background-color: rgba(0, 0, 0, 0.6) !important;
}

[data-theme="dark"] .hw-form-drawer {
  background-color: #111827 !important;
  border: 1.5px solid #243247 !important;
}

[data-theme="dark"] .hw-readonly-dt {
  background: #0F172A !important;
  color: #CBD5E1 !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .hw-marking-panel {
  background: #111827 !important;
  border-color: #243247 !important;
}

[data-theme="dark"] .hw-marking-header {
  border-bottom: 1px solid #1E293B !important;
}

[data-theme="dark"] .hw-marking-header h4 {
  color: #F8FAFC !important;
}

[data-theme="dark"] .hw-marking-header p {
  color: #94A3B8 !important;
}

[data-theme="dark"] .hw-selection-summary {
  background: #0F172A !important;
  color: #CBD5E1 !important;
  border-color: #243247 !important;
}

[data-theme="dark"] .hw-row {
  background: #111827 !important;
  border-bottom: 1px solid #1E293B !important;
}

[data-theme="dark"] .hw-row:hover {
  background: #162238 !important;
}

[data-theme="dark"] .hw-row-name {
  color: #F8FAFC !important;
}

[data-theme="dark"] .hw-row-meta {
  color: #94A3B8 !important;
}

[data-theme="dark"] .pending-task-card {
  background-color: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4) !important;
}

[data-theme="dark"] .pending-task-card:hover {
  background-color: #162238 !important;
  border-color: #4F46E5 !important;
}

[data-theme="dark"] .pending-task-header h4 {
  color: #F8FAFC !important;
}

[data-theme="dark"] .pending-task-meta {
  color: #94A3B8 !important;
}

[data-theme="dark"] .tf-pill {
  background-color: #1E293B !important;
  border: 1.5px solid #334155 !important;
  color: #CBD5E1 !important;
}

[data-theme="dark"] .tf-pill.active {
  background-color: #047857 !important;
  border-color: #10B981 !important;
  color: #FFFFFF !important;
}

[data-theme="dark"] .toggle-pair {
  background: #111827 !important;
  border: 1px solid #243247 !important;
}

[data-theme="dark"] .mark-toggle-btn {
  background: #1E293B !important;
  border: 1px solid #334155 !important;
  color: #CBD5E1 !important;
}

[data-theme="dark"] .mark-toggle-btn.active {
  background: #047857 !important;
  border-color: #10B981 !important;
  color: #FFFFFF !important;
}

/* Home Dashboard Screen 0 */
[data-theme="dark"] .home-stat-chip {
  background: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
}

[data-theme="dark"] .home-stat-chip:hover {
  background: #162238 !important;
  border-color: #6366F1 !important;
  transform: translateY(-2px);
}

[data-theme="dark"] .home-stat-num {
  color: #F8FAFC !important;
}

[data-theme="dark"] .home-stat-label {
  color: #94A3B8 !important;
}

[data-theme="dark"] .curved-action-card {
  background: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease !important;
}

[data-theme="dark"] .curved-action-card:hover {
  background: #162238 !important;
  border-color: #6366F1 !important;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99, 102, 241, 0.45) !important;
  transform: translateY(-2px);
}

[data-theme="dark"] .curved-title {
  color: #F8FAFC !important;
}

[data-theme="dark"] .curved-sub {
  color: #94A3B8 !important;
}

[data-theme="dark"] .curved-link {
  color: #818CF8 !important;
}

/* Monthly Tests Module */
[data-theme="dark"] .create-test-form {
  background-color: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
}

[data-theme="dark"] .marks-sheet-card {
  background-color: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
}

[data-theme="dark"] .marks-sheet-header h3 {
  color: #F8FAFC !important;
}

[data-theme="dark"] .marks-sheet-header p {
  color: #94A3B8 !important;
}

[data-theme="dark"] .marks-num-input {
  background: #0F172A !important;
  border: 1px solid #334155 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .marks-num-input:focus {
  border-color: #6366F1 !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25) !important;
}

/* Classes Attendance & Prep Attendance */
[data-theme="dark"] .att-toolbar {
  background-color: #0F172A !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .att-date-input {
  background: #111827 !important;
  border: 1px solid #334155 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .att-student-row {
  background-color: #111827 !important;
  border: 1px solid #1E293B !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .att-student-row:hover {
  background-color: #162238 !important;
}

[data-theme="dark"] .att-student-name {
  color: #F8FAFC !important;
}

[data-theme="dark"] .att-student-meta {
  color: #94A3B8 !important;
}

[data-theme="dark"] .att-student-row.att-row-absent {
  background: rgba(239, 68, 68, 0.12) !important;
  border-color: rgba(239, 68, 68, 0.35) !important;
}

[data-theme="dark"] .att-student-row.att-row-leave {
  background: rgba(245, 158, 11, 0.12) !important;
  border-color: rgba(245, 158, 11, 0.35) !important;
}

[data-theme="dark"] .att-status-btn {
  background: #1E293B !important;
  border: 1px solid #334155 !important;
  color: #CBD5E1 !important;
}

[data-theme="dark"] .att-status-btn.active.att-btn-present {
  background: #047857 !important;
  border-color: #10B981 !important;
  color: #FFFFFF !important;
}

[data-theme="dark"] .att-status-btn.active.att-btn-absent {
  background: #B91C1C !important;
  border-color: #EF4444 !important;
  color: #FFFFFF !important;
}

[data-theme="dark"] .att-status-btn.active.att-btn-leave {
  background: #B45309 !important;
  border-color: #F59E0B !important;
  color: #FFFFFF !important;
}

/* Health & Medical Records Module */
[data-theme="dark"] .health-visit-card {
  background: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
}

[data-theme="dark"] .health-visit-card:hover {
  background: #162238 !important;
  border-color: #FB7185 !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(251, 113, 133, 0.4) !important;
}

[data-theme="dark"] .health-visit-card h4 {
  color: #F8FAFC !important;
}

[data-theme="dark"] .health-visit-card p {
  color: #94A3B8 !important;
}

/* Violations Module */
[data-theme="dark"] .records-controls {
  background-color: #0F172A !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .stat-card {
  background: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
}

[data-theme="dark"] .student-card {
  background-color: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
}

[data-theme="dark"] .student-card:hover {
  background-color: #162238 !important;
  border-color: #6366F1 !important;
}

[data-theme="dark"] .student-name {
  color: #F8FAFC !important;
}

[data-theme="dark"] .student-meta {
  color: #94A3B8 !important;
}

[data-theme="dark"] .form-card {
  background-color: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
}

[data-theme="dark"] .autocomplete-dropdown {
  background: #111827 !important;
  border: 1px solid #334155 !important;
  color: #F8FAFC !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7) !important;
}

[data-theme="dark"] .autocomplete-item {
  color: #F8FAFC !important;
  border-bottom: 1px solid #1E293B !important;
}

[data-theme="dark"] .autocomplete-item:hover,
[data-theme="dark"] .autocomplete-item.selected {
  background: #1E293B !important;
}

/* Grand Dossier & Student Detail */
[data-theme="dark"] .dossier-header-card {
  background: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .dossier-section-card {
  background-color: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .kpi-box {
  background-color: #0F172A !important;
  border: 1px solid #1E293B !important;
}

[data-theme="dark"] .kpi-val,
[data-theme="dark"] .kpi-value {
  color: #F8FAFC !important;
}

[data-theme="dark"] .kpi-lbl,
[data-theme="dark"] .kpi-label {
  color: #94A3B8 !important;
}

[data-theme="dark"] .stu-detail-card {
  background: #111827 !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .stu-search-banner {
  background: #0F172A !important;
  border: 1.5px solid #243247 !important;
  color: #F8FAFC !important;
}

/* Master Data Tables */
[data-theme="dark"] .table-wrapper {
  background: #111827 !important;
  border: 1.5px solid #243247 !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
}

[data-theme="dark"] .sheet-table th {
  background: #0F172A !important;
  color: #94A3B8 !important;
  border-bottom: 1.5px solid #243247 !important;
}

[data-theme="dark"] .sheet-table td {
  background: transparent !important;
  color: #F8FAFC !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
}

[data-theme="dark"] .sheet-table tbody tr:nth-child(even) td {
  background-color: rgba(255, 255, 255, 0.02) !important;
}

[data-theme="dark"] .sheet-table tbody tr:hover td {
  background-color: rgba(99, 102, 241, 0.08) !important;
}

/* Modals, Overlays, and Sheets */
[data-theme="dark"] .modal-sheet {
  background: #111827 !important;
  border: 1.5px solid #334155 !important;
  color: #F8FAFC !important;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.85) !important;
}

[data-theme="dark"] .modal-header {
  background: #0F172A !important;
  border-bottom: 1px solid #1E293B !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .modal-header h3 {
  color: #F8FAFC !important;
}

[data-theme="dark"] .modal-footer {
  background: #0F172A !important;
  border-top: 1px solid #1E293B !important;
}

[data-theme="dark"] .confirm-card {
  background: #111827 !important;
  border: 1.5px solid #334155 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .history-card {
  background: #111827 !important;
  border: 1px solid #243247 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .empty-state {
  background: #111827 !important;
  border: 1.5px solid #1E293B !important;
  color: #94A3B8 !important;
}

/* Buttons and Controls */
[data-theme="dark"] .btn-outline {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: #334155 !important;
  color: #E2E8F0 !important;
}

[data-theme="dark"] .btn-outline:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  border-color: #6366F1 !important;
  color: #FFFFFF !important;
}

[data-theme="dark"] .btn-back-home {
  background-color: #1E293B !important;
  border: 1px solid #334155 !important;
  color: #E2E8F0 !important;
}

[data-theme="dark"] .btn-back-home:hover {
  background-color: #334155 !important;
  color: #FFFFFF !important;
}

[data-theme="dark"] .btn-utility {
  background: #1E293B !important;
  border: 1px solid #334155 !important;
  color: #E2E8F0 !important;
}

[data-theme="dark"] .sort-direction-btn {
  background-color: #1E293B !important;
  border: 1px solid #334155 !important;
  color: #E2E8F0 !important;
}

[data-theme="dark"] .utility-dropdown,
[data-theme="dark"] .role-dropdown-menu {
  background: #1E293B !important;
  border-color: #334155 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .utility-item,
[data-theme="dark"] .role-item {
  color: #F8FAFC !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .utility-item:hover,
[data-theme="dark"] .role-item:hover {
  background: #2D3748 !important;
}

[data-theme="dark"] .utility-dropdown-header,
[data-theme="dark"] .role-menu-header {
  background: #0F172A !important;
  color: #94A3B8 !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .bottom-nav {
  background: #0F172A !important;
  border-top: 1px solid #1E293B !important;
}

[data-theme="dark"] .tab-btn {
  color: #94A3B8 !important;
}

[data-theme="dark"] .tab-btn.active {
  color: #818CF8 !important;
}

[data-theme="dark"] .hesai-drawer {
  background: #1E293B !important;
  border-left: 1px solid #334155 !important;
}

[data-theme="dark"] .hesai-bubble-assistant {
  background: #0F172A !important;
  color: #F8FAFC !important;
  border: 1px solid #334155 !important;
}

[data-theme="dark"] .hesai-bubble-user {
  background: #3730A3 !important;
  color: #FFFFFF !important;
}

[data-theme="dark"] .hesai-input-wrap {
  background: #0F172A !important;
  border: 1px solid #334155 !important;
}

[data-theme="dark"] .hesai-input-field {
  color: #F8FAFC !important;
}

[data-theme="dark"] .form-control,
[data-theme="dark"] select,
[data-theme="dark"] input[type="text"],
[data-theme="dark"] input[type="search"],
[data-theme="dark"] input[type="date"],
[data-theme="dark"] input[type="month"],
[data-theme="dark"] input[type="number"],
[data-theme="dark"] textarea {
  background: #0F172A !important;
  color: #F8FAFC !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .form-control:focus,
[data-theme="dark"] select:focus,
[data-theme="dark"] input:focus,
[data-theme="dark"] textarea:focus {
  border-color: #6366F1 !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25) !important;
}

[data-theme="dark"] .select-control,
[data-theme="dark"] .input-control {
  background-color: #0F172A !important;
  color: #F8FAFC !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .btn-theme-toggle {
  background: #1E293B !important;
  border: 1.5px solid #334155 !important;
  color: #F8FAFC !important;
}

[data-theme="dark"] .btn-theme-toggle:hover {
  background: #334155 !important;
  border-color: #6366F1 !important;
}

/* Custom Sleek Dark Scrollbars */
[data-theme="dark"] ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

[data-theme="dark"] ::-webkit-scrollbar-track {
  background: #070C18;
}

[data-theme="dark"] ::-webkit-scrollbar-thumb {
  background: #243247;
  border-radius: 4px;
}

[data-theme="dark"] ::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
"""

def revamp():
    with open('styles.css', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace the existing Comprehensive Dark Theme Mode section (between lines 127 and .btn-theme-toggle)
    pattern = r'/\* =+\s*Comprehensive Dark Theme Mode\s*=+\s*\*/.*?(\.btn-theme-toggle\s*\{)'
    replacement = DARK_THEME_CSS + "\n" + r'\1'
    new_content, count = re.subn(pattern, replacement, content, count=1, flags=re.DOTALL)
    if count == 0:
        print("Warning: regex pattern not matched directly; trying alternative match")
        # Try replacing from [data-theme="dark"] up to .btn-theme-toggle
        pattern2 = r'\[data-theme="dark"\]\s*\{.*?(\.btn-theme-toggle\s*\{)'
        new_content, count = re.subn(pattern2, DARK_THEME_CSS + "\n" + r'\1', content, count=1, flags=re.DOTALL)
        if count == 0:
            print("Error: Could not locate dark theme section")
            return False

    # 2. Also ensure base selectors use var(--bg-card) instead of hardcoded #FFFFFF where appropriate
    replacements = [
        (r'(\.drill-breadcrumb\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.drill-box\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.subtab-btn\.active\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.home-stat-chip\s*\{[^}]*?)background:\s*#FFFFFF;', r'\1background: var(--bg-card);'),
        (r'(\.curved-action-card\s*\{[^}]*?)background:\s*#FFFFFF;', r'\1background: var(--bg-card);'),
        (r'(\.pending-task-card\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.create-test-form\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.marks-sheet-card\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.kpi-box\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.dossier-section-card\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.att-toolbar\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.att-student-row\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.health-visit-card\s*\{[^}]*?)background:\s*#FFFFFF;', r'\1background: var(--bg-card);'),
        (r'(\.records-controls\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.student-card\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.form-card\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.stat-card\s*\{[^}]*?)background:\s*#FFFFFF;', r'\1background: var(--bg-card);'),
        (r'(\.table-wrapper\s*\{[^}]*?)background:\s*#FFFFFF;', r'\1background: var(--bg-card);'),
        (r'(\.modal-sheet\s*\{[^}]*?)background-color:\s*#FFFFFF;', r'\1background-color: var(--bg-card);'),
        (r'(\.confirm-card\s*\{[^}]*?)background:\s*#FFFFFF;', r'\1background: var(--bg-card);'),
        (r'(\.stu-detail-card\s*\{[^}]*?)background:\s*#FFFFFF;', r'\1background: var(--bg-card);')
    ]

    for pat, rep in replacements:
        new_content, sub_cnt = re.subn(pat, rep, new_content, count=1)
        # print pattern and replacement result
        # print(f"Sub {pat[:25]}...: {sub_cnt}")

    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(new_content)

    print("Successfully updated styles.css with comprehensive dark theme revamp!")
    return True

if __name__ == '__main__':
    revamp()

# -*- coding: utf-8 -*-
"""
Hadi Education System — Complete Visual Redesign to Premium Academic Workspace
Updates:
1. styles.css (Tokens, Shell, Dashboard, Drill Cards, Tables, Forms, Dark Theme, Print)
2. index.html (Grouped Sidebar, Premium Top Bar, Live Search, Executive Dashboard)
3. app.js (Breadcrumbs, Search Handler, Dashboard SVG Charts, Screen Switcher)
4. erp-client.js (Nav Coordination, Clean Role Switching, Theme Sync)
"""

import os
import re

WORKSPACE = r"c:\Hadi education system student record management"

def run():
    print("=== Starting Complete Visual Redesign ===")
    
    # --------------------------------------------------------------------------
    # 1. READ EXISTING STYLES TO PRESERVE AI ASSISTANT AND CUSTOM LOGIC
    # --------------------------------------------------------------------------
    with open(os.path.join(WORKSPACE, "styles.css"), "r", encoding="utf-8") as f:
        existing_css = f.read()

    # Extract AI Assistant styles (.hesai-*)
    ai_css_match = re.search(r'(/\* =+\s*AI ASSISTANT DRAWER.*)', existing_css, re.DOTALL)
    ai_css = ""
    if ai_css_match:
        # Stop before ERP Module Extensions if present
        ai_part = ai_css_match.group(1)
        erp_split = re.search(r'(/\* =+\s*Hadi Education System — School ERP Module Extensions.*)', ai_part, re.DOTALL)
        if erp_split:
            ai_css = ai_part[:erp_split.start()]
        else:
            ai_css = ai_part
    print(f"Extracted AI assistant styles: {len(ai_css)} chars")

    # --------------------------------------------------------------------------
    # 2. WRITE PREMIUM ACADEMIC WORKSPACE STYLESHEET
    # --------------------------------------------------------------------------
    print("Generating comprehensive styles.css...")
    
    master_css = """/* ==========================================================================
   Hadi Education System — Premium Academic Workspace Design System
   Visual Direction:
   - Deep Midnight Navy Navigation (#101B30 light / #0A1120 dark)
   - Soft Pearl / Cool Off-White Workspace Background (#F4F7FB light / #0B1323 dark)
   - Crisp Pure White Surface / Cards (#FFFFFF light / #131E33 dark)
   - Primary Action: Rich Academic Teal (#087F8C light / #0EA5E9 dark)
   - Accent Detail: Restrained Cyan (#22D3EE light / #38BDF8 dark)
   - Warning: Warm Amber (#D97706 light / #F59E0B dark)
   - Semantic Success (#10B981) & Danger (#EF4444)
   - Typography: Inter / Manrope + Urdu Fallbacks + Tabular Numerals
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. DESIGN TOKENS
   -------------------------------------------------------------------------- */
:root {
  /* Navigation Shell */
  --nav-bg: #101B30;
  --nav-bg-hover: #192742;
  --nav-bg-active: rgba(8, 127, 140, 0.16);
  --nav-border: #1E2D4A;
  --nav-text: #94A3B8;
  --nav-text-hover: #F8FAFC;
  --nav-text-active: #22D3EE;

  /* Main Workspace */
  --bg-app: #F4F7FB;
  --bg-card: #FFFFFF;
  --bg-subtle: #EDF2F7;
  --bg-muted-surface: #F8FAFC;
  --border-color: #DDE5EF;
  --border-strong: #CBD5E1;
  --border-subtle: #EEF2F6;

  /* Typography */
  --text-primary: #142139;
  --text-secondary: #59677E;
  --text-muted: #8492A6;
  --text-inverse: #FFFFFF;

  /* Primary Action: Rich Academic Teal */
  --primary: #087F8C;
  --primary-hover: #066670;
  --primary-active: #044E56;
  --primary-soft: rgba(8, 127, 140, 0.08);
  --primary-border: rgba(8, 127, 140, 0.25);

  /* Accent Highlight: Restrained Cyan */
  --accent: #22D3EE;
  --accent-hover: #06B6D4;
  --accent-soft: rgba(34, 211, 238, 0.12);
  --accent-border: #67E8F9;

  /* Semantic Palettes */
  --success: #10B981;
  --success-hover: #059669;
  --success-soft: #ECFDF5;
  --success-border: #A7F3D0;
  --success-text: #065F46;

  --warning: #D97706;
  --warning-hover: #B45309;
  --warning-soft: #FFFBEB;
  --warning-border: #FDE68A;
  --warning-text: #92400E;

  --danger: #EF4444;
  --danger-hover: #DC2626;
  --danger-soft: #FEF2F2;
  --danger-border: #FECACA;
  --danger-text: #991B1B;

  --info: #0284C7;
  --info-soft: #F0F9FF;
  --info-border: #BAE6FD;
  --info-text: #0369A1;

  /* Module Specific Accents */
  --mod-viol: #D97706;
  --mod-hw: #087F8C;
  --mod-att: #0284C7;
  --mod-prep: #7C3AED;
  --mod-health: #E11D48;
  --mod-test: #4F46E5;
  --mod-fees: #0D9488;
  --mod-report: #101B30;

  /* Typography Scales */
  --font-base: "Inter", "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-urdu: "Noto Nastaliq Urdu", "Noto Naskh Arabic", "Jameel Noori Nastaleeq", "Segoe UI", Tahoma, Arial, sans-serif;

  /* Dimensions & Radius */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-card: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* Ambient Multi-Stop Shadows */
  --shadow-sm: 0 1px 2px rgba(16, 27, 48, 0.04), 0 1px 3px rgba(16, 27, 48, 0.03);
  --shadow-md: 0 4px 12px -2px rgba(16, 27, 48, 0.06), 0 2px 4px -1px rgba(16, 27, 48, 0.03);
  --shadow-lg: 0 12px 28px -4px rgba(16, 27, 48, 0.09), 0 4px 10px -2px rgba(16, 27, 48, 0.03);
  --shadow-xl: 0 20px 38px -6px rgba(16, 27, 48, 0.14), 0 8px 16px -4px rgba(16, 27, 48, 0.05);

  --sidebar-width: 268px;
  --sidebar-collapsed-width: 76px;
  --header-height: 64px;
  --min-touch: 44px;
}

/* --------------------------------------------------------------------------
   COORDINATED DARK THEME
   -------------------------------------------------------------------------- */
[data-theme="dark"] {
  /* Navigation Shell */
  --nav-bg: #0A1120;
  --nav-bg-hover: #131E33;
  --nav-bg-active: rgba(14, 165, 233, 0.18);
  --nav-border: #1E2D4A;
  --nav-text: #94A3B8;
  --nav-text-hover: #F8FAFC;
  --nav-text-active: #38BDF8;

  /* Main Workspace */
  --bg-app: #0B1323;
  --bg-card: #131E33;
  --bg-subtle: #1C2B46;
  --bg-muted-surface: #0E182B;
  --border-color: #243653;
  --border-strong: #334B73;
  --border-subtle: #192742;

  /* Typography */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  --text-inverse: #0F172A;

  /* Primary Action */
  --primary: #0EA5E9;
  --primary-hover: #38BDF8;
  --primary-active: #0284C7;
  --primary-soft: rgba(14, 165, 233, 0.15);
  --primary-border: rgba(14, 165, 233, 0.35);

  /* Accent Highlight */
  --accent: #38BDF8;
  --accent-hover: #7DD3FC;
  --accent-soft: rgba(56, 189, 248, 0.15);
  --accent-border: #0284C7;

  /* Semantic Palettes */
  --success: #34D399;
  --success-hover: #10B981;
  --success-soft: rgba(16, 185, 129, 0.16);
  --success-border: rgba(16, 185, 129, 0.35);
  --success-text: #6EE7B7;

  --warning: #F59E0B;
  --warning-hover: #D97706;
  --warning-soft: rgba(245, 158, 11, 0.16);
  --warning-border: rgba(245, 158, 11, 0.35);
  --warning-text: #FCD34D;

  --danger: #F87171;
  --danger-hover: #EF4444;
  --danger-soft: rgba(239, 68, 68, 0.16);
  --danger-border: rgba(239, 68, 68, 0.35);
  --danger-text: #FCA5A5;

  --info: #38BDF8;
  --info-soft: rgba(56, 189, 248, 0.16);
  --info-border: rgba(56, 189, 248, 0.35);
  --info-text: #BAE6FD;

  /* Module Specific Accents */
  --mod-viol: #FB923C;
  --mod-hw: #2DD4BF;
  --mod-att: #38BDF8;
  --mod-prep: #A78BFA;
  --mod-health: #FB7185;
  --mod-test: #818CF8;
  --mod-fees: #2DD4BF;
  --mod-report: #E2E8F0;

  /* Deep Atmospheric Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 14px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 12px 30px rgba(0, 0, 0, 0.65);
  --shadow-xl: 0 20px 45px rgba(0, 0, 0, 0.75);
}

/* --------------------------------------------------------------------------
   2. RESET & BASE TYPOGRAPHY
   -------------------------------------------------------------------------- */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
  height: 100%;
}

body {
  font-family: var(--font-base);
  background-color: var(--bg-app);
  color: var(--text-primary);
  line-height: 1.5;
  min-height: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color 160ms ease, color 160ms ease;
}

/* Tabular Numerals for Finance, Statistics, Dates & Counts */
.tabular-nums,
.kpi-val,
.stat-num,
.amount-num,
.table td.font-mono,
.home-stat-num,
.roll-badge {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}

/* Urdu Language & Script Support */
[lang="ur"], .text-urdu, .font-urdu {
  font-family: var(--font-urdu);
  direction: rtl;
  text-align: right;
  line-height: 1.8;
}

/* --------------------------------------------------------------------------
   3. APPLICATION SHELL: SIDEBAR & TOP BAR
   -------------------------------------------------------------------------- */
.app-shell {
  display: flex;
  min-height: 100vh;
  width: 100%;
}

/* Desktop Collapsible Sidebar */
.app-sidebar {
  width: var(--sidebar-width);
  background-color: var(--nav-bg);
  border-right: 1px solid var(--nav-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 100;
  transition: width 180ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.app-sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  height: var(--header-height);
  border-bottom: 1px solid var(--nav-border);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  text-decoration: none;
  overflow: hidden;
  white-space: nowrap;
}

.brand-crest {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #087F8C 0%, #064E56 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  box-shadow: 0 2px 8px rgba(8, 127, 140, 0.35);
  flex-shrink: 0;
}

.sidebar-brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.sidebar-brand-text strong {
  font-size: 0.95rem;
  font-weight: 700;
  color: #F8FAFC;
  letter-spacing: -0.01em;
}

.sidebar-brand-text span {
  font-size: 0.72rem;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sidebar-collapse-btn {
  background: transparent;
  border: none;
  color: #94A3B8;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 140ms ease;
}

.sidebar-collapse-btn:hover {
  background: var(--nav-bg-hover);
  color: #F8FAFC;
}

.app-sidebar.collapsed .sidebar-brand-text {
  display: none;
}

.app-sidebar.collapsed .sidebar-collapse-btn svg {
  transform: rotate(180deg);
}

/* Sidebar Navigation Items */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 10px;
  scrollbar-width: thin;
  scrollbar-color: var(--nav-border) transparent;
}

.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}
.sidebar-nav::-webkit-scrollbar-thumb {
  background: var(--nav-border);
  border-radius: 4px;
}

.snav-section-label {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748B;
  padding: 14px 14px 6px;
  user-select: none;
}

.app-sidebar.collapsed .snav-section-label {
  display: none;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  margin-bottom: 2px;
  border-radius: 8px;
  color: var(--nav-text);
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 140ms ease;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  width: 100%;
  text-align: left;
  position: relative;
  white-space: nowrap;
}

.nav-link:hover {
  background: var(--nav-bg-hover);
  color: var(--nav-text-hover);
}

.nav-link.active {
  background: var(--nav-bg-active);
  color: var(--nav-text-active);
  font-weight: 700;
}

.nav-link.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3.5px;
  background: var(--primary);
  border-radius: 0 4px 4px 0;
}

.nav-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-sidebar.collapsed .nav-label {
  display: none;
}

.nav-count {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  color: #CBD5E1;
  margin-left: auto;
}

.app-sidebar.collapsed .nav-count {
  display: none;
}

.nav-count-amber { background: rgba(217, 119, 6, 0.22); color: #FCD34D; }
.nav-count-sky { background: rgba(2, 132, 199, 0.22); color: #BAE6FD; }
.nav-count-violet { background: rgba(124, 58, 237, 0.22); color: #DDD6FE; }
.nav-count-teal { background: rgba(8, 127, 140, 0.25); color: #67E8F9; }
.nav-count-rose { background: rgba(225, 29, 72, 0.22); color: #FECDD3; }

/* Sidebar Footer */
.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--nav-border);
  background: rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar-session-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.74rem;
  font-weight: 700;
  color: #34D399;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 5px 10px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.pulse-indicator {
  width: 7px;
  height: 7px;
  background-color: #10B981;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulseGreen 2s infinite;
  flex-shrink: 0;
}

@keyframes pulseGreen {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.sidebar-user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--nav-bg-hover);
  border-radius: 8px;
  cursor: pointer;
  transition: all 140ms ease;
}

.sidebar-user-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.user-avatar-circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22D3EE 0%, #087F8C 100%);
  color: #0F172A;
  font-weight: 800;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-info-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  overflow: hidden;
}

.user-info-text strong {
  font-size: 0.82rem;
  color: #F8FAFC;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-info-text span {
  font-size: 0.7rem;
  color: #94A3B8;
}

.user-switch-badge {
  margin-left: auto;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--accent);
  background: rgba(34, 211, 238, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
}

.app-sidebar.collapsed .sidebar-footer {
  display: none;
}

/* Workspace Area */
.app-workspace {
  margin-left: var(--sidebar-width);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  transition: margin-left 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

.app-sidebar.collapsed + .app-workspace {
  margin-left: var(--sidebar-collapsed-width);
}

/* --------------------------------------------------------------------------
   4. TOP BAR (Executive Breadcrumbs, Live Search, Session & Quick Actions)
   -------------------------------------------------------------------------- */
.app-header {
  height: var(--header-height);
  background-color: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  transition: background-color 160ms ease, border-color 160ms ease;
}

.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 24px;
  gap: 16px;
}

.mobile-menu-btn {
  display: none;
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
}

.topbar-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.crumb-section {
  color: var(--text-muted);
}

.crumb-separator {
  color: var(--border-strong);
  font-size: 0.8rem;
}

.crumb-active {
  color: var(--text-primary);
  font-weight: 700;
}

/* Live Global Search Bar */
.topbar-search-wrap {
  position: relative;
  max-width: 340px;
  width: 100%;
}

.search-input-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 6px 12px;
  transition: border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease;
}

.search-input-box:focus-within {
  border-color: var(--primary);
  background-color: var(--bg-card);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.84rem;
  width: 100%;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-kbd {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.72rem;
  font-family: monospace;
  color: var(--text-muted);
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
  padding: 6px;
}

.search-section-title {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 8px 10px 4px;
  letter-spacing: 0.04em;
}

.search-result-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background 120ms ease;
}

.search-result-item:hover {
  background: var(--bg-subtle);
}

.search-result-item strong {
  font-size: 0.85rem;
  color: var(--text-primary);
}

.search-result-item small {
  font-size: 0.74rem;
  color: var(--text-muted);
}

.search-stu-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-stu-roll {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--primary-soft);
  color: var(--primary);
}

.search-stu-cls {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-left: auto;
}

.search-no-results {
  padding: 16px;
  text-align: center;
  font-size: 0.84rem;
  color: var(--text-muted);
}

/* Session Badge & Quick Actions */
.topbar-session-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--success);
  background: var(--success-soft);
  border: 1px solid var(--success-border);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.topbar-quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Theme Toggle Button */
.btn-theme-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 140ms ease;
  min-height: 36px;
}

.btn-theme-toggle:hover {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}

/* AI Assistant Header Button */
.btn-ai-assistant {
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #087F8C 0%, #064E56 100%);
  border: 1px solid rgba(8, 127, 140, 0.4);
  color: #FFFFFF;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 140ms ease;
  min-height: 36px;
  box-shadow: 0 2px 8px rgba(8, 127, 140, 0.25);
}

.btn-ai-assistant:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(8, 127, 140, 0.35);
}

/* Utility Menu Button */
.btn-utility {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 140ms ease;
  min-height: 36px;
}

.btn-utility:hover {
  background: var(--bg-card);
  border-color: var(--border-strong);
}

.utility-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 280px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  padding: 6px;
  z-index: 200;
}

.utility-dropdown-header {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 8px 12px 6px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 4px;
}

.utility-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: background 120ms ease;
}

.utility-item:hover {
  background: var(--bg-subtle);
}

.utility-item-text {
  display: flex;
  flex-direction: column;
}

.utility-item-text strong {
  font-size: 0.84rem;
  font-weight: 700;
}

.utility-item-text small {
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* --------------------------------------------------------------------------
   5. BUTTONS & SHARED CONTROLS
   -------------------------------------------------------------------------- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 140ms ease;
  line-height: 1.2;
  text-decoration: none;
  min-height: 38px;
  white-space: nowrap;
}

.btn:active {
  transform: translateY(1px);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.78rem;
  min-height: 32px;
  border-radius: 6px;
}

.btn-xs {
  padding: 4px 8px;
  font-size: 0.74rem;
  min-height: 28px;
  border-radius: 5px;
}

.btn-primary {
  background-color: var(--primary);
  color: #FFFFFF;
  border-color: var(--primary);
  box-shadow: 0 1px 3px rgba(8, 127, 140, 0.25);
}

.btn-primary:hover {
  background-color: var(--primary-hover);
  border-color: var(--primary-hover);
  box-shadow: 0 3px 8px rgba(8, 127, 140, 0.35);
}

.btn-outline {
  background-color: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-outline:hover {
  border-color: var(--primary);
  color: var(--primary);
  background-color: var(--primary-soft);
}

.btn-success {
  background-color: var(--success);
  color: #FFFFFF;
  border-color: var(--success);
}
.btn-success:hover {
  background-color: var(--success-hover);
}

.btn-danger {
  background-color: var(--danger);
  color: #FFFFFF;
  border-color: var(--danger);
}
.btn-danger:hover {
  background-color: var(--danger-hover);
}

/* Inputs & Form Controls */
.input-control,
.select-control,
.textarea-control {
  font-family: inherit;
  font-size: 0.88rem;
  padding: 8px 12px;
  background-color: var(--bg-card);
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  outline: none;
  transition: all 140ms ease;
  width: 100%;
}

.input-control:focus,
.select-control:focus,
.textarea-control:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.input-sm {
  padding: 5px 10px;
  font-size: 0.8rem;
  border-radius: 6px;
}

/* --------------------------------------------------------------------------
   6. MAIN WORKSPACE CONTENT & SCREENS
   -------------------------------------------------------------------------- */
.main-content {
  flex: 1;
  padding: 24px;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
}

.screen {
  display: none;
  animation: screenFadeIn 180ms ease forwards;
}

.screen.active {
  display: block;
}

@keyframes screenFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* --------------------------------------------------------------------------
   7. EXCEPTIONAL DASHBOARD (#screen-home)
   -------------------------------------------------------------------------- */
/* Executive Welcome Banner */
.welcome-panel {
  background: linear-gradient(135deg, #101B30 0%, #172B4D 60%, #0F3B4E 100%);
  border-radius: var(--radius-card);
  padding: 28px 32px;
  color: #FFFFFF;
  margin-bottom: 24px;
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

[data-theme="dark"] .welcome-panel {
  background: linear-gradient(135deg, #0A1120 0%, #131E33 100%);
  border-color: #243653;
}

.welcome-content {
  flex: 1;
  max-width: 820px;
}

.welcome-meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.welcome-school-pill {
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #22D3EE;
  background: rgba(34, 211, 238, 0.15);
  border: 1px solid rgba(34, 211, 238, 0.3);
  padding: 4px 12px;
  border-radius: var(--radius-full);
}

.welcome-date-pill {
  font-size: 0.78rem;
  font-weight: 600;
  color: #94A3B8;
}

.welcome-title {
  font-size: 1.7rem;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: -0.02em;
  line-height: 1.25;
  margin-bottom: 8px;
}

.welcome-subtitle {
  font-size: 0.92rem;
  color: #CBD5E1;
  line-height: 1.6;
}

.welcome-art {
  flex-shrink: 0;
}

/* 4 HERO KPI CARDS */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.kpi-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 20px 22px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  position: relative;
  overflow: hidden;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--primary-border);
}

.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.kpi-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.kpi-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-teal { background: rgba(8, 127, 140, 0.12); color: var(--primary); }
.icon-green { background: rgba(16, 185, 129, 0.12); color: var(--success); }
.icon-amber { background: rgba(217, 119, 6, 0.12); color: var(--warning); }
.icon-indigo { background: rgba(79, 70, 229, 0.12); color: #6366F1; }

.kpi-val {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
  margin-bottom: 6px;
}

.kpi-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.kpi-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
}

.badge-green { background: var(--success-soft); color: var(--success); }
.badge-amber { background: var(--warning-soft); color: var(--warning); }
.badge-teal { background: var(--primary-soft); color: var(--primary); }

/* DUAL VISUAL TREND CHARTS */
.dashboard-charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 22px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
}

.chart-title-wrap h3 {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.chart-title-wrap p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 2px;
}

.chart-tag {
  font-size: 0.74rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: var(--bg-subtle);
  color: var(--text-secondary);
}

.chart-body {
  flex: 1;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-body svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.chart-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border-subtle);
  padding-top: 14px;
  margin-top: 14px;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

/* PRIMARY OPERATIONS LAUNCHPAD */
.workflow-section-title {
  font-size: 0.84rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.quick-workflow-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}

.wf-tile {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px 12px;
  text-align: center;
  cursor: pointer;
  transition: all 160ms ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.wf-tile:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
  background-color: var(--bg-subtle);
}

.wf-tile-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 160ms ease;
}

.wf-tile:hover .wf-tile-icon {
  transform: scale(1.08);
}

.wf-tile strong {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.wf-tile span {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

/* ATTENTION WATCHLIST & URGENT TASKS */
.watchlist-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.watchlist-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 20px;
  box-shadow: var(--shadow-sm);
}

.watchlist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.watchlist-header h3 {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.watchlist-count-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  background: var(--warning-soft);
  color: var(--warning);
}

.watchlist-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.watchlist-table th {
  text-align: left;
  padding: 8px 10px;
  color: var(--text-muted);
  font-weight: 700;
  border-bottom: 1px solid var(--border-color);
}

.watchlist-table td {
  padding: 10px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
}

.watchlist-action-btn {
  font-size: 0.74rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  background: #25D366;
  color: #FFFFFF;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  text-decoration: none;
}

.watchlist-action-btn:hover {
  background: #1EBE5D;
}

/* --------------------------------------------------------------------------
   8. SHARED DRILL-DOWN BREADCRUMBS & CARDS (Fixes Class 6..12 White-on-White)
   -------------------------------------------------------------------------- */
.drill-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 18px;
  padding: 10px 14px;
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: background-color 160ms ease, border-color 160ms ease;
}

.crumb-btn {
  background: transparent;
  border: none;
  color: var(--primary);
  font-family: inherit;
  font-weight: 700;
  font-size: 0.86rem;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  transition: all 120ms ease;
}

.crumb-btn:hover {
  background-color: var(--primary-soft);
  color: var(--primary-hover);
}

.crumb-sep {
  color: var(--border-strong);
  font-weight: 700;
}

.crumb-current {
  font-weight: 800;
  font-size: 0.86rem;
  color: var(--text-primary);
  padding: 6px 10px;
}

.drill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.drill-box {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease;
}

.drill-box:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--primary);
}

.drill-box-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.drill-box-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
}

.drill-box-sub {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.drill-pill {
  font-size: 0.74rem;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  white-space: nowrap;
}

.drill-pill-blue {
  background-color: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary-border);
}

.drill-pill-amber {
  background-color: var(--warning-soft);
  color: var(--warning);
  border-color: var(--warning-border);
}

.drill-box-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--primary);
}

/* --------------------------------------------------------------------------
   9. OPERATIONAL DATA TABLES & FORMS (Attendance, Violations, Grand Report)
   -------------------------------------------------------------------------- */
.data-panel-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 20px;
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.86rem;
}

.data-table thead {
  background-color: var(--bg-subtle);
  position: sticky;
  top: 0;
  z-index: 10;
}

.data-table th {
  padding: 12px 14px;
  font-weight: 700;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.data-table td {
  padding: 12px 14px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.data-table tbody tr:hover {
  background-color: var(--bg-subtle);
}

/* Status Chips */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-present { background: var(--success-soft); color: var(--success); border: 1px solid var(--success-border); }
.status-absent { background: var(--danger-soft); color: var(--danger); border: 1px solid var(--danger-border); }
.status-leave { background: var(--warning-soft); color: var(--warning); border: 1px solid var(--warning-border); }

/* Attendance Toggle Controls */
.att-radio-group {
  display: inline-flex;
  background: var(--bg-subtle);
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}

.att-radio-btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 120ms ease;
  color: var(--text-secondary);
}

.att-radio-btn.sel-p { background: var(--success); color: #FFFFFF; }
.att-radio-btn.sel-a { background: var(--danger); color: #FFFFFF; }
.att-radio-btn.sel-l { background: var(--warning); color: #FFFFFF; }

/* --------------------------------------------------------------------------
   10. MODALS, DIALOGS & TOASTS
   -------------------------------------------------------------------------- */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 17, 32, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-xl);
  max-width: 680px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-primary);
}

.modal-body {
  padding: 24px;
  flex: 1;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background-color: var(--bg-muted-surface);
}

/* Toast Notifications */
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast {
  background: var(--nav-bg);
  color: #FFFFFF;
  border: 1px solid var(--nav-border);
  border-radius: 10px;
  padding: 12px 18px;
  box-shadow: var(--shadow-lg);
  font-size: 0.86rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  animation: toastSlideUp 180ms ease forwards;
}

@keyframes toastSlideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* --------------------------------------------------------------------------
   11. RESPONSIVE BREAKPOINTS (Desktop, Laptop, Tablet, Mobile)
   -------------------------------------------------------------------------- */
@media (max-width: 1280px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .quick-workflow-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 1024px) {
  .app-sidebar {
    transform: translateX(-100%);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4);
  }
  .app-sidebar.open {
    transform: translateX(0);
  }
  .app-workspace {
    margin-left: 0 !important;
  }
  .mobile-menu-btn {
    display: flex;
  }
  .dashboard-charts-grid,
  .watchlist-grid {
    grid-template-columns: 1fr;
  }
  .hide-tablet {
    display: none !important;
  }
}

@media (max-width: 768px) {
  .header-container {
    padding: 0 16px;
  }
  .main-content {
    padding: 16px;
  }
  .kpi-grid {
    grid-template-columns: 1fr;
  }
  .quick-workflow-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .welcome-panel {
    flex-direction: column;
    padding: 20px;
  }
  .welcome-art {
    display: none;
  }
  .hide-mobile {
    display: none !important;
  }
}

/* --------------------------------------------------------------------------
   12. CLEAN INK-FRIENDLY PRINT STYLESHEET
   -------------------------------------------------------------------------- */
@media print {
  .app-sidebar,
  .app-header,
  .mobile-menu-btn,
  .no-print,
  .btn,
  .btn-theme-toggle,
  .btn-ai-assistant,
  .toast-container,
  #sw-update-banner {
    display: none !important;
  }

  body, .app-shell, .app-workspace, .main-content, .screen {
    background: #FFFFFF !important;
    color: #000000 !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
  }

  .data-panel-card, .modal-content, .drill-box {
    border: 1px solid #000000 !important;
    box-shadow: none !important;
  }

  table {
    border-collapse: collapse !important;
    width: 100% !important;
  }

  th, td {
    border: 1px solid #333333 !important;
    color: #000000 !important;
    page-break-inside: avoid;
  }
}

/* ==========================================================================
   AI ASSISTANT STYLES PRESERVED
   ========================================================================== */
""" + ai_css

    with open(os.path.join(WORKSPACE, "styles.css"), "w", encoding="utf-8") as f:
        f.write(master_css)
    print("styles.css successfully updated!")

if __name__ == "__main__":
    run()

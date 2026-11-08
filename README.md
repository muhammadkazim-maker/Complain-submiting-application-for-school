# Student Complaint Tracker (PWA)

A responsive, offline-capable Progressive Web Application (PWA) built for **Hadi Education System** to track, manage, and monitor student complaints with automated device timestamps, severity scoring, and a visual Green-to-Red meter.

---

## 🌟 Key Features

- **📱 Fully Responsive & Touch Optimized**: Designed mobile-first with large touch targets ($\ge 44\text{px}$), bottom tab navigation on mobile, floating action button (`+`), and top navigation on desktop.
- **⚡ Zero Build Step**: 100% plain HTML5, CSS3, and modern vanilla JavaScript. Deployable on any static hosting provider.
- **📶 Offline-Ready Progressive Web App (PWA)**: Includes `manifest.json` and `sw.js` cache-first Service Worker. Installable directly on Android (Chrome), iOS (Safari), or desktop.
- **🌐 Bilingual & Multilingual Input**: Full support for Urdu script (Nastaliq), Roman Urdu, and English with automatic text direction (`dir="auto"`).
- **📊 Green-to-Red Severity Meter**:
  - Track with fixed gradient from Green $\to$ Yellow $\to$ Orange $\to$ Red $\to$ Maroon.
  - Dynamically reveals gradient fill based on severity score ($MAX\_SCORE = 20$).
  - Status tiers: **Normal** (0–4), **Watch** (5–9), **Warning** (10–15), **Critical** (16–20+).
- **⚖️ 5-Level Severity System**:
  - Low (1 pt, Green)
  - Medium (2 pts, Yellow)
  - High (3 pts, Orange)
  - Extreme (4 pts, Red)
  - Ultra (5 pts, Maroon)
- **🕒 Automatic Device Date & Time**: Detects and logs device timestamp when complaint is submitted (no manual date/time input required).
- **📋 Master Sheet Register**:
  - Spreadsheet view with sticky header and sticky `#` column.
  - Keeps complaints grouped by student when sorted by score or count.
- **🔄 Local Storage & Data Portability**:
  - Browser storage accessed exclusively through an abstracted `storage.js` layer.
  - One-click **Export to CSV**.
  - One-click **JSON Backup & Restore** with schema validation.
- **🗑️ Smart Student Lifecycle**: Deleting a student's last remaining complaint automatically prunes the student record.

---

## 📁 Project Structure

```text
├── index.html       # Semantic HTML5 app shell & screens
├── styles.css       # Responsive light theme styles & animations
├── app.js           # UI logic, navigation, and validation
├── storage.js       # Abstracted storage layer & metrics calculation
├── manifest.json    # PWA configuration manifest
├── sw.js            # Offline caching Service Worker
└── icons/           # App icons (SVG, 192px PNG, 512px PNG)
```

---

## 🚀 Running Locally

1. Open a terminal in the project folder:
   ```bash
   python -m http.server 8080
   ```
2. Open `http://localhost:8080` in your web browser.

---

## 📲 How to Install on Android Phone

1. Deploy to any free static host (Netlify, GitHub Pages, or Vercel).
2. Open your HTTPS URL in Google Chrome on your Android device.
3. Tap the browser menu ($\vdots$) $\to$ **Install app** (or **Add to Home screen**).
4. Launch the app directly from your home screen. It will work completely offline.

/**
 * Hadi Education System Balkassar — Unified Storage Layer
 * Manages Violations, Homework & Pending Tasks, Monthly Tests, and Grand Reports
 * All browser storage operations pass exclusively through AppStorage.
 */

(function (window) {
  'use strict';

  const KEYS = {
    CUSTOM_STUDENTS: 'hes_custom_students_v2',
    COMPLAINTS: 'sct_complaints_v1',
    HOMEWORKS: 'hes_homeworks_v2',
    TESTS: 'hes_monthly_tests_v2',
    SUBJECTS: 'hes_custom_subjects_v2',
    CLASS_ATTENDANCE: 'hes_class_attendance_v1',
    PREP_ATTENDANCE: 'hes_prep_attendance_v1'
  };

  const PREP_SLOTS = ['Prep 1', 'Prep 2', 'Prep 3'];
  const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Leave'];
  const ATTENDANCE_STATUS_SET = new Set(ATTENDANCE_STATUSES);

  function getLocalTodayDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function isValidYmdDate(str) {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
    const [y, m, d] = trimmed.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function cleanAttendanceRecordsMap(records, validStudentIds = null) {
    if (!isPlainObject(records)) {
      throw new Error('Attendance records must be a student-keyed object.');
    }
    const clean = {};
    for (const [sid, status] of Object.entries(records)) {
      if (validStudentIds && (!isValidId(sid) || !validStudentIds.has(sid))) {
        throw new Error(`Attendance references unknown student ID "${sid}".`);
      }
      if (status === undefined || status === null || status === '') continue;
      if (typeof status !== 'string' || !ATTENDANCE_STATUS_SET.has(status)) {
        throw new Error(`Invalid attendance status "${String(status)}" for student "${sid}". Expected Present, Absent, or Leave.`);
      }
      clean[sid] = status;
    }
    return clean;
  }

  function summarizeStudentAttendanceEntries(entries, studentId, getItemLabel) {
    let total = 0;
    let present = 0;
    let absent = 0;
    let leave = 0;
    const recent = [];

    entries.forEach((entry) => {
      const status = entry.records && entry.records[studentId];
      if (!status || !ATTENDANCE_STATUS_SET.has(status)) return;
      total++;
      if (status === 'Present') present++;
      else if (status === 'Absent') absent++;
      else if (status === 'Leave') leave++;
      recent.push({
        id: entry.id,
        date: entry.date,
        label: getItemLabel(entry),
        status
      });
    });

    recent.sort((a, b) => b.date.localeCompare(a.date));
    return {
      total,
      present,
      absent,
      leave,
      percent: total > 0 ? Math.round((present / total) * 100) : null,
      recent: recent.slice(0, 12)
    };
  }

  function validateAttendanceImportEntries(rawList, opts, validClasses, validStudentIds) {
    const seenIds = new Set();
    return (rawList || []).map((entry, idx) => {
      if (!isPlainObject(entry)) {
        throw new Error(`Invalid ${opts.label} entry at index ${idx}.`);
      }
      if (!isValidId(entry.id) || seenIds.has(entry.id.trim())) {
        throw new Error(`Invalid or duplicate ${opts.label} ID at index ${idx}.`);
      }
      const id = entry.id.trim();
      seenIds.add(id);

      const cid = normalizeClassId(entry.classId);
      if (!validClasses.has(cid)) {
        throw new Error(`${opts.label} "${id}" has unrecognized class "${String(entry.classId)}".`);
      }

      const dateStr = typeof entry.date === 'string' ? entry.date.trim() : '';
      if (!isValidYmdDate(dateStr)) {
        throw new Error(`${opts.label} "${id}" has an invalid date "${String(entry.date)}". Expected YYYY-MM-DD.`);
      }

      let itemVal = normalizeText(entry[opts.itemField]);
      if (opts.allowedItems) {
        const canonical = opts.allowedItems.find((x) => x.toLowerCase() === itemVal.toLowerCase());
        if (!canonical) {
          throw new Error(`${opts.label} "${id}" has unsupported slot "${String(entry[opts.itemField])}".`);
        }
        itemVal = canonical;
      } else if (!itemVal || itemVal.length > 100) {
        throw new Error(`${opts.label} "${id}" is missing a valid ${opts.itemField}.`);
      }

      if (entry.createdAt !== undefined && !isValidDateString(entry.createdAt)) {
        throw new Error(`${opts.label} "${id}" has invalid createdAt timestamp.`);
      }
      if (entry.updatedAt !== undefined && !isValidDateString(entry.updatedAt)) {
        throw new Error(`${opts.label} "${id}" has invalid updatedAt timestamp.`);
      }

      const cleanRecords = cleanAttendanceRecordsMap(entry.records || {}, validStudentIds);
      const nowIso = new Date().toISOString();
      return {
        id,
        classId: cid,
        [opts.itemField]: itemVal,
        date: dateStr,
        records: cleanRecords,
        createdAt: entry.createdAt || nowIso,
        updatedAt: entry.updatedAt || entry.createdAt || nowIso
      };
    });
  }

  const SEVERITY_CONFIG = {
    Low: { points: 1, label: 'Low', badgeClass: 'severity-low' },
    Medium: { points: 2, label: 'Medium', badgeClass: 'severity-medium' },
    High: { points: 3, label: 'High', badgeClass: 'severity-high' },
    Extreme: { points: 4, label: 'Extreme', badgeClass: 'severity-extreme' },
    Ultra: { points: 5, label: 'Ultra', badgeClass: 'severity-ultra' }
  };

  const MAX_SCORE = 20;

  // Helpers
  function normalizeText(text) {
    return (text || '').toString().trim().replace(/\s+/g, ' ');
  }

  function normalizeClassId(cls) {
    const c = normalizeText(cls).toLowerCase();
    if (c === '6' || c === '6th' || c === 'class 6') return '6th';
    if (c === '7' || c === '7th' || c === 'class 7') return '7th';
    if (c === '8' || c === '8th' || c === 'class 8') return '8th';
    if (c === '9' || c === '9th' || c === 'class 9') return '9th';
    if (c === '10' || c === '10th' || c === 'class 10') return '10th';
    if (c === '11' || c === '11th' || c === 'class 11' || c.includes('1st year')) return '11th';
    if (c === '12' || c === '12th' || c === 'class 12' || c.includes('2nd year') || c.includes('second year')) return '12th';
    return normalizeText(cls);
  }

  function getStudentKey(name, className) {
    return `${normalizeText(name).toLowerCase()}|||${normalizeClassId(className).toLowerCase()}`;
  }

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Storage read error:', key, e);
      return fallback;
    }
  }

  function isQuotaError(e) {
    if (!e) return false;
    return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014;
  }

  let lastSaveError = null;

  function save(key, val) {
    lastSaveError = null;
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      lastSaveError = e;
      console.error('Storage write error:', key, e);
      return false;
    }
  }

  function saveOrThrow(key, val, actionLabel = 'data') {
    if (!save(key, val)) {
      if (isQuotaError(lastSaveError)) {
        throw new Error(`Unable to save ${actionLabel}: browser storage is full. Please export a JSON backup and clear old data.`);
      }
      throw new Error(`Unable to save ${actionLabel}: browser storage write failed or is restricted.`);
    }
  }

  function snapshotStorageKeys() {
    const snap = {};
    Object.values(KEYS).forEach((k) => {
      try {
        snap[k] = localStorage.getItem(k);
      } catch (e) {
        snap[k] = null;
      }
    });
    return snap;
  }

  function restoreStorageSnapshot(snap) {
    if (!snap || typeof snap !== 'object') return;
    Object.entries(snap).forEach(([k, raw]) => {
      try {
        if (raw === null || raw === undefined) {
          localStorage.removeItem(k);
        } else {
          localStorage.setItem(k, raw);
        }
      } catch (e) {
        console.error('Storage rollback error:', k, e);
      }
    });
  }

  function isPlainObject(val) {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  function hasUnsafePrototypeKeys(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (Array.isArray(obj)) {
      return obj.some((item) => hasUnsafePrototypeKeys(item));
    }
    for (const key of Object.keys(obj)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return true;
      }
      if (hasUnsafePrototypeKeys(obj[key])) {
        return true;
      }
    }
    return false;
  }

  function isValidId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(id.trim());
  }

  function isValidDateString(val) {
    if (typeof val !== 'string' || !val.trim()) return false;
    return !Number.isNaN(Date.parse(val));
  }

  function sanitizeCsvCell(val) {
    const raw = (val === undefined || val === null ? '' : String(val));
    const safe = (/^[=+\-@\t\r\n]/.test(raw) || /^[\s\u0000-\u0020]+[=+\-@\t\r]/.test(raw))
      ? "'" + raw
      : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  function getStatusLabel(score) {
    if (score <= 4) return { label: 'Normal', statusClass: 'status-normal' };
    if (score <= 9) return { label: 'Watch', statusClass: 'status-watch' };
    if (score <= 15) return { label: 'Warning', statusClass: 'status-warning' };
    return { label: 'Critical', statusClass: 'status-critical' };
  }

  function getTimeframeStart(range, customStart) {
    const now = new Date();
    if (range === '1d') {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    if (range === '7d') {
      return now.getTime() - 7 * 86400000;
    }
    if (range === '30d') {
      return now.getTime() - 30 * 86400000;
    }
    if (range === 'custom' && customStart) {
      const d = new Date(customStart);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    return 0; // 'all'
  }

  function getTimeframeEnd(range, customEnd) {
    if (range === 'custom' && customEnd) {
      const d = new Date(customEnd);
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    }
    return Infinity;
  }

  const Storage = {
    MAX_SCORE,
    SEVERITY_CONFIG,
    PREP_SLOTS,
    ATTENDANCE_STATUSES,
    getLocalTodayDate,
    isValidYmdDate,
    normalizeText,
    normalizeClassId,
    getStudentKey,
    getStatusLabel,

    getClasses() {
      return (window.SchoolDirectory && window.SchoolDirectory.CLASSES_CONFIG) || [
        { id: '6th', label: 'Class 6', shortLabel: '6th' },
        { id: '7th', label: 'Class 7', shortLabel: '7th' },
        { id: '8th', label: 'Class 8', shortLabel: '8th' },
        { id: '9th', label: 'Class 9', shortLabel: '9th' },
        { id: '10th', label: 'Class 10', shortLabel: '10th' },
        { id: '11th', label: '11th (1st Year)', shortLabel: '11th / 1st Yr' },
        { id: '12th', label: '12th (2nd Year)', shortLabel: '12th / 2nd Yr' }
      ];
    },

    getClassLabel(classId) {
      const cid = normalizeClassId(classId);
      const found = this.getClasses().find((c) => c.id === cid);
      return found ? found.label : classId;
    },

    /* ========================================================================
       Students Roster (Official 134 + Custom)
       ======================================================================== */
    async getAllRosterStudents() {
      const official = (window.SchoolDirectory && window.SchoolDirectory.OFFICIAL_STUDENTS) || [];
      const custom = load(KEYS.CUSTOM_STUDENTS, []);
      return [...official, ...custom];
    },

    async getStudentsByClass(classId) {
      const cid = normalizeClassId(classId);
      const all = await this.getAllRosterStudents();
      return all.filter((s) => normalizeClassId(s.classId || s.className) === cid);
    },

    async getStudentById(studentId) {
      const all = await this.getAllRosterStudents();
      return all.find((s) => s.id === studentId) || null;
    },

    /* ========================================================================
       Subjects Manager (Editable per Class)
       ======================================================================== */
    async getSubjects(classId) {
      const cid = normalizeClassId(classId);
      const customMap = load(KEYS.SUBJECTS, {});
      if (Array.isArray(customMap[cid])) {
        return customMap[cid];
      }
      const defaults = (window.SchoolDirectory && window.SchoolDirectory.DEFAULT_SUBJECTS_BY_CLASS) || {};
      return defaults[cid] ? [...defaults[cid]] : ['English', 'Urdu', 'Mathematics', 'Science'];
    },

    async addSubject(classId, subjectName) {
      const cid = normalizeClassId(classId);
      const clean = normalizeText(subjectName);
      if (!clean) throw new Error('Subject name is required.');
      const current = await this.getSubjects(cid);
      if (current.some((s) => s.toLowerCase() === clean.toLowerCase())) {
        throw new Error('This subject already exists in this class.');
      }
      const customMap = load(KEYS.SUBJECTS, {});
      customMap[cid] = [...current, clean];
      saveOrThrow(KEYS.SUBJECTS, customMap, 'subject');
      this._notifyChange();
      return customMap[cid];
    },

    /* ========================================================================
       MODULE 1: Violations / Complaints
       ======================================================================== */
    async getComplaints() {
      return load(KEYS.COMPLAINTS, []);
    },

    async getStudentsWithStats() {
      const roster = await this.getAllRosterStudents();
      const complaints = await this.getComplaints();

      const complaintsByStudent = new Map();
      complaints.forEach((c) => {
        if (!complaintsByStudent.has(c.studentId)) {
          complaintsByStudent.set(c.studentId, []);
        }
        complaintsByStudent.get(c.studentId).push(c);
      });

      // Only include students who actually have at least 1 violation
      const activeStudents = roster.filter((s) => complaintsByStudent.has(s.id));

      return activeStudents.map((student) => {
        const list = complaintsByStudent.get(student.id) || [];
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const severityCounts = { Low: 0, Medium: 0, High: 0, Extreme: 0, Ultra: 0 };
        let score = 0;

        list.forEach((c) => {
          const cfg = SEVERITY_CONFIG[c.severity] || { points: 1 };
          score += cfg.points;
          if (severityCounts[c.severity] !== undefined) severityCounts[c.severity] += 1;
        });

        const fillPercent = Math.min((score / MAX_SCORE) * 100, 100);
        const status = getStatusLabel(score);

        return {
          ...student,
          className: this.getClassLabel(student.classId || student.className),
          complaints: list,
          totalComplaints: list.length,
          severityScore: score,
          fillPercent,
          statusLabel: status.label,
          statusClass: status.statusClass,
          severityCounts,
          latestComplaintAt: list[0] ? list[0].createdAt : null
        };
      });
    },

    async addComplaint({ studentId = null, studentName, className, classId, text, severity, allowCreateCustom = false }) {
      const cleanName = normalizeText(studentName);
      const cid = normalizeClassId(className || classId);
      const cleanText = (text || '').trim();

      if (!cid) throw new Error('Class is required.');
      if (!cleanText) throw new Error('Violation details are required.');
      if (!SEVERITY_CONFIG[severity]) throw new Error('Invalid severity level.');

      const roster = await this.getAllRosterStudents();
      let student = null;

      if (studentId) {
        student = roster.find((s) => s.id === studentId) || null;
        if (!student) {
          throw new Error('Selected student was not found in the roster. Please re-select the student.');
        }
        if (normalizeClassId(student.classId || student.className) !== cid) {
          throw new Error(`Selected student belongs to ${this.getClassLabel(student.classId || student.className)}, not ${this.getClassLabel(cid)}. Please re-select the student.`);
        }
      } else {
        if (!cleanName) throw new Error('Student name is required.');
        const targetKey = getStudentKey(cleanName, cid);
        const matches = roster.filter((s) => getStudentKey(s.name, s.classId || s.className) === targetKey);
        if (matches.length > 1) {
          throw new Error('Multiple students share this name in the selected class. Please select the exact student from the suggestions list.');
        }
        if (matches.length === 1) {
          student = matches[0];
        }
      }

      const prevCustomRaw = (() => {
        try { return localStorage.getItem(KEYS.CUSTOM_STUDENTS); } catch (e) { return null; }
      })();
      let createdCustomStudent = false;

      if (!student) {
        if (!allowCreateCustom) {
          throw new Error('Student not matched in roster. Please pick a suggested student or confirm creating a new student record.');
        }
        if (!cleanName) throw new Error('Student name is required.');
        const customStudents = load(KEYS.CUSTOM_STUDENTS, []);
        student = {
          id: generateId('std'),
          name: cleanName,
          rollNumber: '-',
          classId: cid,
          className: cid,
          section: 'Custom',
          family: '-',
          phone: '-',
          whatsapp: '-',
          isOfficial: false,
          createdAt: new Date().toISOString()
        };
        customStudents.push(student);
        saveOrThrow(KEYS.CUSTOM_STUDENTS, customStudents, 'custom student');
        createdCustomStudent = true;
      }

      const complaints = await this.getComplaints();
      const newComplaint = {
        id: generateId('cmp'),
        studentId: student.id,
        text: cleanText,
        severity,
        createdAt: new Date().toISOString()
      };
      complaints.push(newComplaint);

      try {
        saveOrThrow(KEYS.COMPLAINTS, complaints, 'violation record');
      } catch (err) {
        if (createdCustomStudent) {
          restoreStorageSnapshot({ [KEYS.CUSTOM_STUDENTS]: prevCustomRaw });
        }
        throw err;
      }

      this._notifyChange();
      return { student, complaint: newComplaint };
    },

    async deleteComplaint(complaintId) {
      const snap = {
        [KEYS.COMPLAINTS]: (() => { try { return localStorage.getItem(KEYS.COMPLAINTS); } catch (e) { return null; } })(),
        [KEYS.CUSTOM_STUDENTS]: (() => { try { return localStorage.getItem(KEYS.CUSTOM_STUDENTS); } catch (e) { return null; } })()
      };

      let complaints = await this.getComplaints();
      const target = complaints.find((c) => c.id === complaintId);
      if (!target) return { success: false, notFound: true };

      const studentId = target.studentId;
      complaints = complaints.filter((c) => c.id !== complaintId);
      saveOrThrow(KEYS.COMPLAINTS, complaints, 'violation deletion');

      const remaining = complaints.filter((c) => c.studentId === studentId);
      let studentDeleted = false;

      if (remaining.length === 0) {
        // Remove ad-hoc custom students if last complaint deleted; keep official roster students
        let customStudents = load(KEYS.CUSTOM_STUDENTS, []);
        const wasCustom = customStudents.some((s) => s.id === studentId);
        if (wasCustom) {
          customStudents = customStudents.filter((s) => s.id !== studentId);
          try {
            saveOrThrow(KEYS.CUSTOM_STUDENTS, customStudents, 'custom student cleanup');
          } catch (err) {
            restoreStorageSnapshot(snap);
            throw err;
          }
        }
        studentDeleted = true; // removed from active violation records list
      }

      this._notifyChange();
      return { success: true, complaintId, studentId, studentDeleted };
    },

    /* ========================================================================
       MODULE 2: Homework & Pending Tasks
       ======================================================================== */
    async getHomeworks(filters = {}) {
      let list = load(KEYS.HOMEWORKS, []);
      if (filters.classId) {
        const cid = normalizeClassId(filters.classId);
        list = list.filter((h) => normalizeClassId(h.classId) === cid);
      }
      if (filters.subject) {
        list = list.filter((h) => h.subject === filters.subject);
      }
      if (filters.range && filters.range !== 'all') {
        const startMs = getTimeframeStart(filters.range, filters.customStart);
        const endMs = getTimeframeEnd(filters.range, filters.customEnd);
        list = list.filter((h) => {
          const t = new Date(h.createdAt).getTime();
          return t >= startMs && t <= endMs;
        });
      }
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async getKnownTeachers() {
      const hws = load(KEYS.HOMEWORKS, []);
      const set = new Set();
      hws.forEach((h) => {
        if (h.teacherName) set.add(normalizeText(h.teacherName));
      });
      return Array.from(set);
    },

    async addHomework({ classId, subject, teacherName, description, records }) {
      const cid = normalizeClassId(classId);
      const cleanSubj = normalizeText(subject);
      const cleanTeacher = normalizeText(teacherName);
      const cleanDesc = (description || '').trim();

      if (!cid) throw new Error('Class is required.');
      if (!cleanSubj) throw new Error('Subject is required.');
      if (!cleanTeacher) throw new Error('Teacher name is required.');
      if (!cleanDesc) throw new Error('Homework / lesson description is required.');

      const now = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      const hw = {
        id: generateId('hw'),
        classId: cid,
        subject: cleanSubj,
        teacherName: cleanTeacher,
        description: cleanDesc,
        dayName: dayNames[now.getDay()],
        createdAt: now.toISOString(),
        records: records || {}
      };

      const all = load(KEYS.HOMEWORKS, []);
      all.push(hw);
      saveOrThrow(KEYS.HOMEWORKS, all, 'homework assignment');
      this._notifyChange();
      return hw;
    },

    async updateHomeworkRecords(homeworkId, updatedRecords, metaUpdate = null) {
      if (!homeworkId) throw new Error('Homework ID is required.');
      if (!isPlainObject(updatedRecords)) throw new Error('Invalid homework records payload.');

      const all = load(KEYS.HOMEWORKS, []);
      const idx = all.findIndex((h) => h.id === homeworkId);
      if (idx === -1) throw new Error('Homework record not found.');

      const existing = all[idx];
      const existingRecords = isPlainObject(existing.records) ? existing.records : {};
      const nextRecords = { ...existingRecords };

      Object.entries(updatedRecords).forEach(([sid, rec]) => {
        if (!isPlainObject(rec)) return;
        const prev = isPlainObject(existingRecords[sid]) ? existingRecords[sid] : {};
        const hwDone = !!rec.hwDone;
        const conceptClear = !!rec.conceptClear;
        const nextEntry = { hwDone, conceptClear };

        if (!conceptClear) {
          if (rec.conceptResolved === true) {
            nextEntry.conceptResolved = true;
            nextEntry.resolvedAt = isValidDateString(rec.resolvedAt)
              ? rec.resolvedAt
              : (isValidDateString(prev.resolvedAt) ? prev.resolvedAt : new Date().toISOString());
          } else if (rec.conceptResolved === false) {
            nextEntry.conceptResolved = false;
          } else if (prev.conceptResolved === true) {
            nextEntry.conceptResolved = true;
            if (isValidDateString(prev.resolvedAt)) {
              nextEntry.resolvedAt = prev.resolvedAt;
            }
          }
        }

        nextRecords[sid] = nextEntry;
      });

      all[idx] = {
        ...existing,
        id: existing.id,
        classId: existing.classId,
        subject: existing.subject,
        createdAt: existing.createdAt,
        dayName: existing.dayName,
        teacherName: metaUpdate && normalizeText(metaUpdate.teacherName)
          ? normalizeText(metaUpdate.teacherName)
          : existing.teacherName,
        description: metaUpdate && typeof metaUpdate.description === 'string' && metaUpdate.description.trim()
          ? metaUpdate.description.trim()
          : existing.description,
        records: nextRecords,
        updatedAt: new Date().toISOString()
      };

      saveOrThrow(KEYS.HOMEWORKS, all, 'homework checklist update');
      this._notifyChange();
      return all[idx];
    },

    async deleteHomework(homeworkId) {
      let all = load(KEYS.HOMEWORKS, []);
      const before = all.length;
      all = all.filter((h) => h.id !== homeworkId);
      if (all.length === before) return { success: false, notFound: true };
      saveOrThrow(KEYS.HOMEWORKS, all, 'homework deletion');
      this._notifyChange();
      return { success: true };
    },

    async resolvePendingTask(homeworkId, studentId) {
      const all = load(KEYS.HOMEWORKS, []);
      const hw = all.find((h) => h.id === homeworkId);
      if (!hw || !hw.records || !hw.records[studentId]) return false;
      hw.records[studentId].conceptResolved = true;
      hw.records[studentId].resolvedAt = new Date().toISOString();
      saveOrThrow(KEYS.HOMEWORKS, all, 'pending task resolution');
      this._notifyChange();
      return true;
    },

    async reopenPendingTask(homeworkId, studentId) {
      const all = load(KEYS.HOMEWORKS, []);
      const hw = all.find((h) => h.id === homeworkId);
      if (!hw || !hw.records || !hw.records[studentId]) return false;
      hw.records[studentId].conceptResolved = false;
      delete hw.records[studentId].resolvedAt;
      saveOrThrow(KEYS.HOMEWORKS, all, 'pending task reopen');
      this._notifyChange();
      return true;
    },

    async getStudentHomeworkReport(studentId, subject = null, timeframe = { range: '30d' }) {
      const student = await this.getStudentById(studentId);
      if (!student) return null;

      const hws = await this.getHomeworks({
        classId: student.classId,
        subject: subject || undefined,
        range: timeframe.range || 'all',
        customStart: timeframe.customStart,
        customEnd: timeframe.customEnd
      });

      const entries = [];
      let doneCount = 0;
      let missedCount = 0;
      let conceptClearCount = 0;
      let conceptUnclearActive = 0;
      let conceptResolvedCount = 0;

      hws.forEach((hw) => {
        const rec = hw.records && hw.records[studentId];
        if (!rec) return;

        if (rec.hwDone) doneCount++;
        else missedCount++;

        if (rec.conceptClear) {
          conceptClearCount++;
        } else if (rec.conceptResolved) {
          conceptResolvedCount++;
        } else {
          conceptUnclearActive++;
        }

        entries.push({
          homeworkId: hw.id,
          subject: hw.subject,
          teacherName: hw.teacherName,
          description: hw.description,
          createdAt: hw.createdAt,
          dayName: hw.dayName,
          hwDone: !!rec.hwDone,
          conceptClear: !!rec.conceptClear,
          conceptResolved: !!rec.conceptResolved,
          resolvedAt: rec.resolvedAt || null
        });
      });

      const totalMarked = entries.length;
      const percentage = totalMarked > 0 ? Math.round((doneCount / totalMarked) * 100) : null;
      const markingScore10 = totalMarked > 0 ? Number(((doneCount / totalMarked) * 10).toFixed(1)) : null;

      return {
        student,
        totalMarked,
        doneCount,
        missedCount,
        percentage,
        markingScore10,
        conceptClearCount,
        conceptUnclearActive,
        conceptResolvedCount,
        entries
      };
    },

    async getPendingTasks({ classId, subject, studentId, includeResolved = false } = {}) {
      const hws = load(KEYS.HOMEWORKS, []);
      const roster = await this.getAllRosterStudents();
      const studentMap = new Map(roster.map((s) => [s.id, s]));

      const tasks = [];
      hws.forEach((hw) => {
        if (classId && normalizeClassId(hw.classId) !== normalizeClassId(classId)) return;
        if (subject && hw.subject !== subject) return;
        if (!hw.records) return;

        Object.entries(hw.records).forEach(([sid, rec]) => {
          if (studentId && sid !== studentId) return;
          if (rec.conceptClear === false) {
            if (!includeResolved && rec.conceptResolved) return;
            const stu = studentMap.get(sid);
            if (!stu) return;
            tasks.push({
              homeworkId: hw.id,
              studentId: sid,
              studentName: stu.name,
              rollNumber: stu.rollNumber,
              classId: hw.classId,
              section: stu.section,
              subject: hw.subject,
              teacherName: hw.teacherName,
              description: hw.description,
              createdAt: hw.createdAt,
              dayName: hw.dayName,
              hwDone: !!rec.hwDone,
              conceptResolved: !!rec.conceptResolved,
              resolvedAt: rec.resolvedAt || null
            });
          }
        });
      });

      return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    /* ========================================================================
       MODULE 3: Monthly Tests
       ======================================================================== */
    async getTests() {
      const list = load(KEYS.TESTS, []);
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async createTest({ name, defaultTotalMarks = 100 }) {
      const cleanName = normalizeText(name);
      if (!cleanName) throw new Error('Test name is required.');

      const parsedDefault = defaultTotalMarks === undefined || defaultTotalMarks === null || String(defaultTotalMarks).trim() === ''
        ? 100
        : Number(defaultTotalMarks);
      if (!Number.isFinite(parsedDefault) || parsedDefault <= 0) {
        throw new Error('Default Total Marks must be a finite positive number greater than 0.');
      }

      const tests = load(KEYS.TESTS, []);
      const newTest = {
        id: generateId('tst'),
        name: cleanName,
        defaultTotalMarks: parsedDefault,
        createdAt: new Date().toISOString(),
        subjectTotals: {},
        subjectDates: {},
        marks: {} // key: `${classId}|${subject}` -> { [studentId]: number }
      };
      tests.push(newTest);
      saveOrThrow(KEYS.TESTS, tests, 'monthly test');
      this._notifyChange();
      return newTest;
    },

    async deleteTest(testId) {
      let tests = load(KEYS.TESTS, []);
      tests = tests.filter((t) => t.id !== testId);
      saveOrThrow(KEYS.TESTS, tests, 'monthly test deletion');
      this._notifyChange();
      return { success: true };
    },

    async saveSubjectTestMarks(testId, classId, subject, totalMarks, marksByStudentId, testDate = null) {
      const tests = load(KEYS.TESTS, []);
      const test = tests.find((t) => t.id === testId);
      if (!test) throw new Error('Monthly test not found.');

      const parsedTotal = Number(totalMarks);
      if (totalMarks === '' || totalMarks === null || totalMarks === undefined || !Number.isFinite(parsedTotal) || parsedTotal <= 0) {
        throw new Error('Total Marks must be a finite number greater than 0.');
      }

      const cleanDate = testDate ? String(testDate).trim() : '';
      if (cleanDate && !isValidDateString(cleanDate)) {
        throw new Error('Please enter a valid Test Date.');
      }

      if (!isPlainObject(marksByStudentId)) {
        throw new Error('Invalid marks submission.');
      }

      const validatedMarks = {};
      for (const [sid, rawVal] of Object.entries(marksByStudentId)) {
        if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
          continue; // Keep blank marks distinct from 0 (omitted from saved scores)
        }
        const m = Number(rawVal);
        if (!Number.isFinite(m) || m < 0 || m > parsedTotal) {
          throw new Error(`Invalid marks (${rawVal}) for student ID ${sid}. Obtained marks must be between 0 and ${parsedTotal}.`);
        }
        validatedMarks[sid] = m;
      }

      const cid = normalizeClassId(classId);
      const key = `${cid}|${subject}`;

      if (!test.subjectTotals) test.subjectTotals = {};
      if (!test.subjectDates) test.subjectDates = {};
      if (!test.marks) test.marks = {};

      test.subjectTotals[key] = parsedTotal;
      if (cleanDate) {
        test.subjectDates[key] = cleanDate;
      } else {
        delete test.subjectDates[key];
      }
      test.marks[key] = validatedMarks;

      saveOrThrow(KEYS.TESTS, tests, 'test marks');
      this._notifyChange();
      return test;
    },

    async getStudentTestResults(studentId) {
      const student = await this.getStudentById(studentId);
      if (!student) return { tests: [], overallObtained: 0, overallTotal: 0, overallPercent: null };

      const tests = await this.getTests();
      const cid = normalizeClassId(student.classId);

      const testReports = [];
      let overallObtained = 0;
      let overallTotal = 0;

      tests.forEach((t) => {
        const subjectScores = [];
        let testObtained = 0;
        let testTotal = 0;

        if (t.marks) {
          Object.entries(t.marks).forEach(([key, stuMarks]) => {
            const [kClass, kSubject] = key.split('|');
            if (kClass !== cid) return;
            const rawVal = stuMarks[studentId];
            if (rawVal === undefined || rawVal === null || rawVal === '') return;

            const obtained = Number(rawVal);
            const total = (t.subjectTotals && t.subjectTotals[key]) || t.defaultTotalMarks || 100;
            const percent = total > 0 ? Math.round((obtained / total) * 100) : 0;

            subjectScores.push({
              subject: kSubject,
              obtained,
              total,
              percent,
              date: (t.subjectDates && t.subjectDates[key]) || null
            });

            testObtained += obtained;
            testTotal += total;
          });
        }

        if (subjectScores.length > 0) {
          overallObtained += testObtained;
          overallTotal += testTotal;
          testReports.push({
            testId: t.id,
            testName: t.name,
            createdAt: t.createdAt,
            subjectScores,
            testObtained,
            testTotal,
            testPercent: testTotal > 0 ? Math.round((testObtained / testTotal) * 100) : 0
          });
        }
      });

      return {
        tests: testReports,
        overallObtained,
        overallTotal,
        overallPercent: overallTotal > 0 ? Math.round((overallObtained / overallTotal) * 100) : null
      };
    },

    /* ========================================================================
       MODULE 4: Grand Report (Everything for a Student)
       ======================================================================== */
    async getStudentGrandReport(studentId, hwTimeframe = { range: 'all' }) {
      const student = await this.getStudentById(studentId);
      if (!student) return null;

      // 1. Violations
      const allComplaints = await this.getComplaints();
      const studentViolations = allComplaints
        .filter((c) => c.studentId === studentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      let violationScore = 0;
      const severityCounts = { Low: 0, Medium: 0, High: 0, Extreme: 0, Ultra: 0 };
      studentViolations.forEach((c) => {
        const cfg = SEVERITY_CONFIG[c.severity] || { points: 1 };
        violationScore += cfg.points;
        if (severityCounts[c.severity] !== undefined) severityCounts[c.severity]++;
      });
      const violationFill = Math.min((violationScore / MAX_SCORE) * 100, 100);
      const violationStatus = getStatusLabel(violationScore);

      // 2. Homework & Pending Tasks
      const hwReport = await this.getStudentHomeworkReport(studentId, null, hwTimeframe);
      const subjects = await this.getSubjects(student.classId);
      const subjectBreakdown = [];
      for (const subj of subjects) {
        const sr = await this.getStudentHomeworkReport(studentId, subj, hwTimeframe);
        if (sr && sr.totalMarked > 0) {
          subjectBreakdown.push({
            subject: subj,
            doneCount: sr.doneCount,
            totalMarked: sr.totalMarked,
            percentage: sr.percentage,
            pendingCount: sr.conceptUnclearActive
          });
        }
      }

      const activePendingTasks = await this.getPendingTasks({ studentId, includeResolved: false });
      const resolvedTasks = (await this.getPendingTasks({ studentId, includeResolved: true })).filter(
        (t) => t.conceptResolved
      );

      // 3. Monthly Tests
      const testResults = await this.getStudentTestResults(studentId);

      // 4. Classes Attendance & Prep Attendance
      const attendance = await this.getStudentAttendanceSummary(studentId);

      return {
        student: {
          ...student,
          classLabel: this.getClassLabel(student.classId)
        },
        violations: {
          list: studentViolations,
          total: studentViolations.length,
          score: violationScore,
          fillPercent: violationFill,
          statusLabel: violationStatus.label,
          statusClass: violationStatus.statusClass,
          severityCounts
        },
        homework: {
          overall: hwReport,
          subjectBreakdown,
          activePendingTasks,
          resolvedTasks
        },
        tests: testResults,
        attendance
      };
    },

    /* ========================================================================
       Classes Attendance & Prep Attendance (Shared Session Engine)
       ======================================================================== */
    _getAttendanceList(storageKey, filter = {}, itemField = 'subject') {
      const all = load(storageKey, []);
      if (!Array.isArray(all)) return [];
      const cid = filter.classId ? normalizeClassId(filter.classId) : '';
      const itemTarget = filter[itemField] ? normalizeText(filter[itemField]).toLowerCase() : '';
      const dateTarget = filter.date ? normalizeText(filter.date) : '';

      return all
        .filter((entry) => {
          if (cid && normalizeClassId(entry.classId) !== cid) return false;
          if (itemTarget && normalizeText(entry[itemField]).toLowerCase() !== itemTarget) return false;
          if (dateTarget && entry.date !== dateTarget) return false;
          return true;
        })
        .sort((a, b) => {
          const dCmp = String(b.date || '').localeCompare(String(a.date || ''));
          if (dCmp !== 0) return dCmp;
          return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
        });
    },

    async _saveAttendanceSession({ storageKey, idPrefix, itemField, allowedItems, actionLabel }, payload) {
      if (!isPlainObject(payload)) {
        throw new Error(`Invalid ${actionLabel} submission.`);
      }
      const cid = normalizeClassId(payload.classId);
      const validClasses = new Set(this.getClasses().map((c) => normalizeClassId(c.id)));
      if (!cid || !validClasses.has(cid)) {
        throw new Error('Please choose a valid class before saving attendance.');
      }

      let itemVal = normalizeText(payload[itemField]);
      if (allowedItems) {
        const canonical = allowedItems.find((slot) => slot.toLowerCase() === itemVal.toLowerCase());
        if (!canonical) {
          throw new Error(`Please choose a valid slot (${allowedItems.join(', ')}).`);
        }
        itemVal = canonical;
      } else if (!itemVal || itemVal.length > 100) {
        throw new Error('Please choose a valid subject before saving attendance.');
      }

      const dateStr = normalizeText(payload.date) || getLocalTodayDate();
      if (!isValidYmdDate(dateStr)) {
        throw new Error('Please choose a valid attendance date (YYYY-MM-DD).');
      }

      const roster = await this.getAllRosterStudents();
      const validStudentIds = new Set(roster.map((s) => s.id));
      const cleanRecords = cleanAttendanceRecordsMap(payload.records || {}, validStudentIds);
      if (Object.keys(cleanRecords).length === 0) {
        throw new Error('Mark Present, Absent, or Leave for at least one student before saving.');
      }

      const list = load(storageKey, []);
      const nextList = Array.isArray(list) ? [...list] : [];
      const itemKey = itemVal.toLowerCase();
      const existingIdx = nextList.findIndex(
        (entry) =>
          normalizeClassId(entry.classId) === cid &&
          normalizeText(entry[itemField]).toLowerCase() === itemKey &&
          entry.date === dateStr
      );

      const nowIso = new Date().toISOString();
      let savedEntry;
      if (existingIdx >= 0) {
        savedEntry = {
          ...nextList[existingIdx],
          classId: cid,
          [itemField]: itemVal,
          date: dateStr,
          records: cleanRecords,
          updatedAt: nowIso
        };
        nextList[existingIdx] = savedEntry;
      } else {
        savedEntry = {
          id: generateId(idPrefix),
          classId: cid,
          [itemField]: itemVal,
          date: dateStr,
          records: cleanRecords,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        nextList.unshift(savedEntry);
      }

      saveOrThrow(storageKey, nextList, actionLabel);
      this._notifyChange();
      return savedEntry;
    },

    _deleteAttendanceSession(storageKey, id, actionLabel) {
      const all = load(storageKey, []);
      const filtered = (Array.isArray(all) ? all : []).filter((entry) => entry.id !== id);
      saveOrThrow(storageKey, filtered, actionLabel);
      this._notifyChange();
      return true;
    },

    async getClassAttendance(filter = {}) {
      return this._getAttendanceList(KEYS.CLASS_ATTENDANCE, filter, 'subject');
    },

    async saveClassAttendance(payload) {
      return this._saveAttendanceSession(
        {
          storageKey: KEYS.CLASS_ATTENDANCE,
          idPrefix: 'catt',
          itemField: 'subject',
          allowedItems: null,
          actionLabel: 'classes attendance'
        },
        payload
      );
    },

    async deleteClassAttendance(id) {
      return this._deleteAttendanceSession(KEYS.CLASS_ATTENDANCE, id, 'classes attendance delete');
    },

    async getPrepAttendance(filter = {}) {
      return this._getAttendanceList(KEYS.PREP_ATTENDANCE, filter, 'prepSlot');
    },

    async savePrepAttendance(payload) {
      return this._saveAttendanceSession(
        {
          storageKey: KEYS.PREP_ATTENDANCE,
          idPrefix: 'patt',
          itemField: 'prepSlot',
          allowedItems: PREP_SLOTS,
          actionLabel: 'prep attendance'
        },
        payload
      );
    },

    async deletePrepAttendance(id) {
      return this._deleteAttendanceSession(KEYS.PREP_ATTENDANCE, id, 'prep attendance delete');
    },

    async getStudentAttendanceSummary(studentId) {
      const classEntries = this._getAttendanceList(KEYS.CLASS_ATTENDANCE, {}, 'subject');
      const prepEntries = this._getAttendanceList(KEYS.PREP_ATTENDANCE, {}, 'prepSlot');

      const classAtt = summarizeStudentAttendanceEntries(classEntries, studentId, (e) => e.subject);
      const prepAtt = summarizeStudentAttendanceEntries(prepEntries, studentId, (e) => e.prepSlot);

      const total = classAtt.total + prepAtt.total;
      const present = classAtt.present + prepAtt.present;
      const absent = classAtt.absent + prepAtt.absent;
      const leave = classAtt.leave + prepAtt.leave;

      return {
        classAttendance: classAtt,
        prepAttendance: prepAtt,
        combined: {
          total,
          present,
          absent,
          leave,
          percent: total > 0 ? Math.round((present / total) * 100) : null
        }
      };
    },

    /* ========================================================================
       Export CSV & Full JSON Backup / Restore
       ======================================================================== */
    async exportCSV() {
      const roster = await this.getAllRosterStudents();
      const complaints = await this.getComplaints();
      const studentMap = new Map(roster.map((s) => [s.id, s]));

      const sorted = [...complaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const headers = ['#', 'Student Name', 'Roll No', 'Class', 'Violation', 'Severity', 'Date', 'Time', 'ISO Timestamp'];

      const rows = sorted.map((c, idx) => {
        const s = studentMap.get(c.studentId) || { name: 'Unknown', rollNumber: '-', classId: 'N/A' };
        const d = new Date(c.createdAt);
        return [
          idx + 1,
          sanitizeCsvCell(s.name),
          sanitizeCsvCell(s.rollNumber || '-'),
          sanitizeCsvCell(this.getClassLabel(s.classId || s.className)),
          sanitizeCsvCell(c.text),
          sanitizeCsvCell(c.severity),
          sanitizeCsvCell(d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })),
          sanitizeCsvCell(d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
          sanitizeCsvCell(c.createdAt)
        ].join(',');
      });

      return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    },

    async exportJSON() {
      return {
        app: 'Hadi Education System Portal',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        customStudents: load(KEYS.CUSTOM_STUDENTS, []),
        complaints: load(KEYS.COMPLAINTS, []),
        homeworks: load(KEYS.HOMEWORKS, []),
        tests: load(KEYS.TESTS, []),
        customSubjects: load(KEYS.SUBJECTS, {}),
        classAttendance: load(KEYS.CLASS_ATTENDANCE, []),
        prepAttendance: load(KEYS.PREP_ATTENDANCE, [])
      };
    },

    async validateAndPreviewImportJSON(data) {
      if (!isPlainObject(data)) {
        throw new Error('Invalid backup file: top-level JSON value must be an object.');
      }
      if (hasUnsafePrototypeKeys(data)) {
        throw new Error('Unsafe keys detected in backup JSON.');
      }

      const supportedVersions = new Set(['1.0', '2.0']);
      if (typeof data.version !== 'string' || !supportedVersions.has(data.version.trim())) {
        throw new Error(`Unsupported or missing backup schema version (${String(data.version || 'missing')}). Expected "2.0".`);
      }

      if (data.app !== undefined) {
        if (typeof data.app !== 'string' || !data.app.toLowerCase().includes('hadi')) {
          throw new Error('Unrecognized backup source: missing Hadi Education System Portal identifier.');
        }
      }

      if (data.exportedAt !== undefined && !isValidDateString(data.exportedAt)) {
        throw new Error('Invalid backup exportedAt timestamp.');
      }

      const hasAnySection = [
        'customStudents',
        'complaints',
        'homeworks',
        'tests',
        'customSubjects',
        'classAttendance',
        'prepAttendance'
      ].some((k) => Object.prototype.hasOwnProperty.call(data, k));
      if (!hasAnySection) {
        throw new Error('Empty or invalid backup: no recognized portal data sections found.');
      }

      if (data.customStudents !== undefined && !Array.isArray(data.customStudents)) {
        throw new Error('Invalid backup: "customStudents" must be an array.');
      }
      if (data.complaints !== undefined && !Array.isArray(data.complaints)) {
        throw new Error('Invalid backup: "complaints" must be an array.');
      }
      if (data.homeworks !== undefined && !Array.isArray(data.homeworks)) {
        throw new Error('Invalid backup: "homeworks" must be an array.');
      }
      if (data.tests !== undefined && !Array.isArray(data.tests)) {
        throw new Error('Invalid backup: "tests" must be an array.');
      }
      if (data.customSubjects !== undefined && !isPlainObject(data.customSubjects)) {
        throw new Error('Invalid backup: "customSubjects" must be an object.');
      }
      if (data.classAttendance !== undefined && !Array.isArray(data.classAttendance)) {
        throw new Error('Invalid backup: "classAttendance" must be an array.');
      }
      if (data.prepAttendance !== undefined && !Array.isArray(data.prepAttendance)) {
        throw new Error('Invalid backup: "prepAttendance" must be an array.');
      }

      const validClasses = new Set(this.getClasses().map((c) => normalizeClassId(c.id)));
      const official = (window.SchoolDirectory && window.SchoolDirectory.OFFICIAL_STUDENTS) || [];
      const officialIds = new Set(official.map((s) => s.id));
      const customIds = new Set();

      const rawCustomStudents = data.customStudents || [];
      const cleanCustomStudents = rawCustomStudents.map((s, idx) => {
        if (!isPlainObject(s)) throw new Error(`Invalid custom student at index ${idx}.`);
        if (!isValidId(s.id)) throw new Error(`Invalid custom student ID at index ${idx}.`);
        if (officialIds.has(s.id) || customIds.has(s.id)) {
          throw new Error(`Duplicate or conflicting student ID "${s.id}" in backup.`);
        }
        customIds.add(s.id);

        const cleanName = normalizeText(s.name);
        if (!cleanName) throw new Error(`Custom student "${s.id}" is missing a valid name.`);
        const cid = normalizeClassId(s.classId || s.className);
        if (!validClasses.has(cid)) {
          throw new Error(`Custom student "${s.id}" has unrecognized class "${String(s.classId || s.className)}".`);
        }
        if (s.createdAt !== undefined && !isValidDateString(s.createdAt)) {
          throw new Error(`Custom student "${s.id}" has an invalid createdAt timestamp.`);
        }

        return {
          id: s.id.trim(),
          name: cleanName,
          rollNumber: typeof s.rollNumber === 'string' && s.rollNumber.trim() ? normalizeText(s.rollNumber) : '-',
          classId: cid,
          className: cid,
          section: typeof s.section === 'string' && s.section.trim() ? normalizeText(s.section) : 'Custom',
          family: typeof s.family === 'string' ? normalizeText(s.family) : '-',
          phone: typeof s.phone === 'string' ? normalizeText(s.phone) : '-',
          whatsapp: typeof s.whatsapp === 'string' ? normalizeText(s.whatsapp) : '-',
          isOfficial: false,
          createdAt: s.createdAt || new Date().toISOString()
        };
      });

      const validStudentIds = new Set([...officialIds, ...customIds]);
      const seenComplaintIds = new Set();
      const rawComplaints = data.complaints || [];
      const cleanComplaints = rawComplaints.map((c, idx) => {
        if (!isPlainObject(c)) throw new Error(`Invalid violation entry at index ${idx}.`);
        if (!isValidId(c.id) || seenComplaintIds.has(c.id)) {
          throw new Error(`Invalid or duplicate violation ID at index ${idx}.`);
        }
        seenComplaintIds.add(c.id);

        if (!isValidId(c.studentId) || !validStudentIds.has(c.studentId)) {
          throw new Error(`Violation "${c.id}" references missing student ID "${String(c.studentId)}".`);
        }
        if (typeof c.text !== 'string' || !c.text.trim()) {
          throw new Error(`Violation "${c.id}" has empty description text.`);
        }
        if (typeof c.severity !== 'string' || !SEVERITY_CONFIG[c.severity]) {
          throw new Error(`Violation "${c.id}" has unsupported severity "${String(c.severity)}".`);
        }
        if (!isValidDateString(c.createdAt)) {
          throw new Error(`Violation "${c.id}" has invalid createdAt date.`);
        }

        return {
          id: c.id.trim(),
          studentId: c.studentId.trim(),
          text: normalizeText(c.text),
          severity: c.severity,
          createdAt: c.createdAt
        };
      });

      const validDays = new Set(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
      const seenHwIds = new Set();
      const rawHomeworks = data.homeworks || [];
      const cleanHomeworks = rawHomeworks.map((h, idx) => {
        if (!isPlainObject(h)) throw new Error(`Invalid homework entry at index ${idx}.`);
        if (!isValidId(h.id) || seenHwIds.has(h.id)) {
          throw new Error(`Invalid or duplicate homework ID at index ${idx}.`);
        }
        seenHwIds.add(h.id);

        const cid = normalizeClassId(h.classId);
        if (!validClasses.has(cid)) {
          throw new Error(`Homework "${h.id}" references unrecognized class "${String(h.classId)}".`);
        }
        if (typeof h.subject !== 'string' || !normalizeText(h.subject)) {
          throw new Error(`Homework "${h.id}" is missing subject name.`);
        }
        if (typeof h.teacherName !== 'string' || !normalizeText(h.teacherName)) {
          throw new Error(`Homework "${h.id}" is missing teacher name.`);
        }
        if (typeof h.description !== 'string' || !h.description.trim()) {
          throw new Error(`Homework "${h.id}" is missing description.`);
        }
        if (typeof h.dayName !== 'string' || !validDays.has(h.dayName.trim())) {
          throw new Error(`Homework "${h.id}" has invalid dayName "${String(h.dayName)}".`);
        }
        if (!isValidDateString(h.createdAt)) {
          throw new Error(`Homework "${h.id}" has invalid createdAt date.`);
        }
        if (!isPlainObject(h.records)) {
          throw new Error(`Homework "${h.id}" records must be a student-keyed object.`);
        }

        const cleanRecords = {};
        for (const [sid, rec] of Object.entries(h.records)) {
          if (!isValidId(sid) || !validStudentIds.has(sid)) {
            throw new Error(`Homework "${h.id}" references unknown student ID "${sid}".`);
          }
          if (!isPlainObject(rec)) {
            throw new Error(`Homework "${h.id}" has invalid record object for student "${sid}".`);
          }
          if (typeof rec.hwDone !== 'boolean' || typeof rec.conceptClear !== 'boolean') {
            throw new Error(`Homework "${h.id}" flags for student "${sid}" must be booleans.`);
          }
          if (rec.conceptResolved !== undefined && typeof rec.conceptResolved !== 'boolean') {
            throw new Error(`Homework "${h.id}" conceptResolved flag for student "${sid}" must be boolean.`);
          }
          if (rec.resolvedAt !== undefined && rec.resolvedAt !== null && !isValidDateString(rec.resolvedAt)) {
            throw new Error(`Homework "${h.id}" resolvedAt timestamp for student "${sid}" is invalid.`);
          }
          const recOut = { hwDone: rec.hwDone, conceptClear: rec.conceptClear };
          if (rec.conceptResolved !== undefined) recOut.conceptResolved = rec.conceptResolved;
          if (rec.resolvedAt) recOut.resolvedAt = rec.resolvedAt;
          cleanRecords[sid] = recOut;
        }

        const hwOut = {
          id: h.id.trim(),
          classId: cid,
          subject: normalizeText(h.subject),
          teacherName: normalizeText(h.teacherName),
          description: h.description.trim(),
          dayName: h.dayName.trim(),
          createdAt: h.createdAt,
          records: cleanRecords
        };
        if (h.updatedAt && isValidDateString(h.updatedAt)) hwOut.updatedAt = h.updatedAt;
        return hwOut;
      });

      const seenTestIds = new Set();
      const rawTests = data.tests || [];
      const cleanTests = rawTests.map((t, idx) => {
        if (!isPlainObject(t)) throw new Error(`Invalid test entry at index ${idx}.`);
        if (!isValidId(t.id) || seenTestIds.has(t.id)) {
          throw new Error(`Invalid or duplicate test ID at index ${idx}.`);
        }
        seenTestIds.add(t.id);

        if (typeof t.name !== 'string' || !normalizeText(t.name)) {
          throw new Error(`Test "${t.id}" is missing a valid name.`);
        }
        if (typeof t.defaultTotalMarks !== 'number' || !Number.isFinite(t.defaultTotalMarks) || t.defaultTotalMarks <= 0) {
          throw new Error(`Test "${t.id}" defaultTotalMarks must be a finite positive number.`);
        }
        if (!isValidDateString(t.createdAt)) {
          throw new Error(`Test "${t.id}" has invalid createdAt date.`);
        }

        const cleanTotals = {};
        if (t.subjectTotals !== undefined) {
          if (!isPlainObject(t.subjectTotals)) throw new Error(`Test "${t.id}" subjectTotals must be an object.`);
          for (const [k, v] of Object.entries(t.subjectTotals)) {
            const parts = k.split('|');
            if (parts.length !== 2 || !validClasses.has(normalizeClassId(parts[0])) || !parts[1].trim()) {
              throw new Error(`Test "${t.id}" has invalid subjectTotals key "${k}".`);
            }
            if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
              throw new Error(`Test "${t.id}" subject total for "${k}" must be a positive number.`);
            }
            cleanTotals[`${normalizeClassId(parts[0])}|${normalizeText(parts[1])}`] = v;
          }
        }

        const cleanDates = {};
        if (t.subjectDates !== undefined) {
          if (!isPlainObject(t.subjectDates)) throw new Error(`Test "${t.id}" subjectDates must be an object.`);
          for (const [k, dVal] of Object.entries(t.subjectDates)) {
            const parts = k.split('|');
            if (parts.length !== 2 || !validClasses.has(normalizeClassId(parts[0])) || !parts[1].trim()) {
              throw new Error(`Test "${t.id}" has invalid subjectDates key "${k}".`);
            }
            if (dVal !== null && dVal !== '' && !isValidDateString(String(dVal))) {
              throw new Error(`Test "${t.id}" has invalid date "${String(dVal)}" for "${k}".`);
            }
            if (dVal) {
              cleanDates[`${normalizeClassId(parts[0])}|${normalizeText(parts[1])}`] = String(dVal).trim();
            }
          }
        }

        const cleanMarks = {};
        if (t.marks !== undefined) {
          if (!isPlainObject(t.marks)) throw new Error(`Test "${t.id}" marks must be an object.`);
          for (const [k, stuMarks] of Object.entries(t.marks)) {
            const parts = k.split('|');
            if (parts.length !== 2 || !validClasses.has(normalizeClassId(parts[0])) || !parts[1].trim()) {
              throw new Error(`Test "${t.id}" has invalid marks key "${k}".`);
            }
            if (!isPlainObject(stuMarks)) {
              throw new Error(`Test "${t.id}" marks entry for "${k}" must be an object.`);
            }
            const canonicalKey = `${normalizeClassId(parts[0])}|${normalizeText(parts[1])}`;
            const subjTotal = cleanTotals[canonicalKey] || t.defaultTotalMarks;
            const outSubjMarks = {};

            for (const [sid, mVal] of Object.entries(stuMarks)) {
              if (!isValidId(sid) || !validStudentIds.has(sid)) {
                throw new Error(`Test "${t.id}" marks for "${k}" reference unknown student ID "${sid}".`);
              }
              if (mVal === null || mVal === undefined || mVal === '') continue;
              if (typeof mVal !== 'number' || !Number.isFinite(mVal) || mVal < 0 || mVal > subjTotal) {
                throw new Error(`Test "${t.id}" marks (${String(mVal)}) for student "${sid}" in "${k}" must be between 0 and ${subjTotal}.`);
              }
              outSubjMarks[sid] = mVal;
            }
            cleanMarks[canonicalKey] = outSubjMarks;
          }
        }

        return {
          id: t.id.trim(),
          name: normalizeText(t.name),
          defaultTotalMarks: t.defaultTotalMarks,
          createdAt: t.createdAt,
          subjectTotals: cleanTotals,
          subjectDates: cleanDates,
          marks: cleanMarks
        };
      });

      const cleanSubjects = {};
      if (data.customSubjects !== undefined) {
        for (const [clsKey, subjArr] of Object.entries(data.customSubjects)) {
          const cid = normalizeClassId(clsKey);
          if (!validClasses.has(cid)) {
            throw new Error(`customSubjects references unrecognized class "${clsKey}".`);
          }
          if (!Array.isArray(subjArr)) {
            throw new Error(`customSubjects["${clsKey}"] must be an array.`);
          }
          const seenSubj = new Set();
          const cleanedList = [];
          subjArr.forEach((s, idx) => {
            if (typeof s !== 'string' || !normalizeText(s)) {
              throw new Error(`Invalid subject name at customSubjects["${clsKey}"][${idx}].`);
            }
            const norm = normalizeText(s);
            if (!seenSubj.has(norm.toLowerCase())) {
              seenSubj.add(norm.toLowerCase());
              cleanedList.push(norm);
            }
          });
          cleanSubjects[cid] = cleanedList;
        }
      }

      const cleanClassAttendance = validateAttendanceImportEntries(
        data.classAttendance || [],
        { label: 'class attendance', itemField: 'subject', allowedItems: null },
        validClasses,
        validStudentIds
      );

      const cleanPrepAttendance = validateAttendanceImportEntries(
        data.prepAttendance || [],
        { label: 'prep attendance', itemField: 'prepSlot', allowedItems: PREP_SLOTS },
        validClasses,
        validStudentIds
      );

      const subjClassesCount = Object.keys(cleanSubjects).length;
      const totalItems =
        cleanCustomStudents.length +
        cleanComplaints.length +
        cleanHomeworks.length +
        cleanTests.length +
        subjClassesCount +
        cleanClassAttendance.length +
        cleanPrepAttendance.length;
      if (totalItems === 0) {
        throw new Error('Backup contains 0 records. Empty backups are rejected to protect existing data.');
      }

      return {
        valid: true,
        preview: {
          version: data.version.trim(),
          exportedAt: data.exportedAt || null,
          customStudentsCount: cleanCustomStudents.length,
          complaintsCount: cleanComplaints.length,
          homeworksCount: cleanHomeworks.length,
          testsCount: cleanTests.length,
          customSubjectsCount: Object.values(cleanSubjects).reduce((acc, arr) => acc + arr.length, 0),
          classAttendanceCount: cleanClassAttendance.length,
          prepAttendanceCount: cleanPrepAttendance.length
        },
        sanitizedData: {
          customStudents: cleanCustomStudents,
          complaints: cleanComplaints,
          homeworks: cleanHomeworks,
          tests: cleanTests,
          customSubjects: cleanSubjects,
          classAttendance: cleanClassAttendance,
          prepAttendance: cleanPrepAttendance
        }
      };
    },

    _lastRecoverySnapshot: null,

    hasRecoverySnapshot() {
      if (this._lastRecoverySnapshot) return true;
      try {
        return !!sessionStorage.getItem('hes_pre_import_recovery_v1');
      } catch (e) {
        return false;
      }
    },

    async restoreRecoverySnapshot() {
      let snap = this._lastRecoverySnapshot;
      if (!snap) {
        try {
          const raw = sessionStorage.getItem('hes_pre_import_recovery_v1');
          if (raw) snap = JSON.parse(raw);
        } catch (e) {
          snap = null;
        }
      }
      if (!snap || !isPlainObject(snap.snapshot)) {
        throw new Error('No pre-import recovery snapshot is available.');
      }
      const currentSnap = snapshotStorageKeys();
      try {
        Object.entries(snap.snapshot).forEach(([k, valRaw]) => {
          if (valRaw === null || valRaw === undefined) {
            localStorage.removeItem(k);
          } else {
            localStorage.setItem(k, valRaw);
          }
        });
      } catch (err) {
        restoreStorageSnapshot(currentSnap);
        throw new Error('Unable to restore recovery snapshot: browser storage write failed.');
      }
      this._notifyChange();
      return { restoredAt: snap.capturedAt };
    },

    async importJSON(data) {
      const validated = await this.validateAndPreviewImportJSON(data);
      const clean = validated.sanitizedData;
      const preImportSnapshot = snapshotStorageKeys();
      const recoveryRecord = {
        capturedAt: new Date().toISOString(),
        snapshot: preImportSnapshot
      };

      this._lastRecoverySnapshot = recoveryRecord;
      try {
        sessionStorage.setItem('hes_pre_import_recovery_v1', JSON.stringify(recoveryRecord));
      } catch (e) {
        // Non-fatal: in-memory recovery snapshot remains intact for rollback
      }

      try {
        saveOrThrow(KEYS.CUSTOM_STUDENTS, clean.customStudents, 'custom students backup');
        saveOrThrow(KEYS.COMPLAINTS, clean.complaints, 'violations backup');
        saveOrThrow(KEYS.HOMEWORKS, clean.homeworks, 'homeworks backup');
        saveOrThrow(KEYS.TESTS, clean.tests, 'monthly tests backup');
        saveOrThrow(KEYS.SUBJECTS, clean.customSubjects, 'custom subjects backup');
        saveOrThrow(KEYS.CLASS_ATTENDANCE, clean.classAttendance, 'classes attendance backup');
        saveOrThrow(KEYS.PREP_ATTENDANCE, clean.prepAttendance, 'prep attendance backup');
      } catch (err) {
        restoreStorageSnapshot(preImportSnapshot);
        throw new Error(`Backup import aborted and rolled back cleanly (${err.message})`);
      }

      this._notifyChange();
      return {
        customStudentsCount: clean.customStudents.length,
        complaintsCount: clean.complaints.length,
        homeworksCount: clean.homeworks.length,
        testsCount: clean.tests.length,
        classAttendanceCount: clean.classAttendance.length,
        prepAttendanceCount: clean.prepAttendance.length,
        recoverySaved: true
      };
    },

    // Clean up old demo violations if they reference non-existent demo students, keep real data
    async migrateIfNeeded() {
      const complaints = load(KEYS.COMPLAINTS, []);
      if (complaints.length > 0 && complaints.some((c) => c.id && c.id.startsWith('cmp_demo_'))) {
        // Remove old synthetic demo complaints so only real school records/user entries remain
        const cleaned = complaints.filter((c) => !c.id.startsWith('cmp_demo_'));
        saveOrThrow(KEYS.COMPLAINTS, cleaned, 'migration cleanup');
      }
      // Clear legacy demo students list
      try {
        localStorage.removeItem('sct_students_v1');
      } catch (e) {
        console.error('Legacy cleanup error:', e);
      }
    },

    _listeners: [],
    subscribe(cb) {
      if (typeof cb === 'function') this._listeners.push(cb);
    },
    _notifyChange() {
      this._listeners.forEach((cb) => {
        try { cb(); } catch (e) { console.error(e); }
      });
      window.dispatchEvent(new CustomEvent('hes-data-changed'));
    }
  };

  window.AppStorage = Storage;
})(window);

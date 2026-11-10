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
    SUBJECTS: 'hes_custom_subjects_v2'
  };

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

  function save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.error('Storage write error:', key, e);
      return false;
    }
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
      save(KEYS.SUBJECTS, customMap);
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

    async addComplaint({ studentId, studentName, className, text, severity }) {
      const cleanName = normalizeText(studentName);
      const cid = normalizeClassId(className);
      const cleanText = (text || '').trim();

      if (!cleanName) throw new Error('Student name is required.');
      if (!cid) throw new Error('Class is required.');
      if (!cleanText) throw new Error('Violation details are required.');
      if (!SEVERITY_CONFIG[severity]) throw new Error('Invalid severity level.');

      const roster = await this.getAllRosterStudents();
      let student = studentId ? roster.find((s) => s.id === studentId) : null;

      if (!student) {
        const targetKey = getStudentKey(cleanName, cid);
        student = roster.find((s) => getStudentKey(s.name, s.classId || s.className) === targetKey);
      }

      if (!student) {
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
        save(KEYS.CUSTOM_STUDENTS, customStudents);
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
      save(KEYS.COMPLAINTS, complaints);

      this._notifyChange();
      return { student, complaint: newComplaint };
    },

    async deleteComplaint(complaintId) {
      let complaints = await this.getComplaints();
      const target = complaints.find((c) => c.id === complaintId);
      if (!target) return { success: false, notFound: true };

      const studentId = target.studentId;
      complaints = complaints.filter((c) => c.id !== complaintId);
      save(KEYS.COMPLAINTS, complaints);

      const remaining = complaints.filter((c) => c.studentId === studentId);
      let studentDeleted = false;

      if (remaining.length === 0) {
        // Remove ad-hoc custom students if last complaint deleted; keep official roster students
        let customStudents = load(KEYS.CUSTOM_STUDENTS, []);
        const wasCustom = customStudents.some((s) => s.id === studentId);
        if (wasCustom) {
          customStudents = customStudents.filter((s) => s.id !== studentId);
          save(KEYS.CUSTOM_STUDENTS, customStudents);
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
      save(KEYS.HOMEWORKS, all);
      this._notifyChange();
      return hw;
    },

    async updateHomeworkRecords(homeworkId, updatedRecords) {
      const all = load(KEYS.HOMEWORKS, []);
      const idx = all.findIndex((h) => h.id === homeworkId);
      if (idx === -1) throw new Error('Homework record not found.');
      all[idx].records = { ...all[idx].records, ...updatedRecords };
      save(KEYS.HOMEWORKS, all);
      this._notifyChange();
      return all[idx];
    },

    async deleteHomework(homeworkId) {
      let all = load(KEYS.HOMEWORKS, []);
      all = all.filter((h) => h.id !== homeworkId);
      save(KEYS.HOMEWORKS, all);
      this._notifyChange();
      return { success: true };
    },

    async resolvePendingTask(homeworkId, studentId) {
      const all = load(KEYS.HOMEWORKS, []);
      const hw = all.find((h) => h.id === homeworkId);
      if (!hw || !hw.records || !hw.records[studentId]) return false;
      hw.records[studentId].conceptResolved = true;
      hw.records[studentId].resolvedAt = new Date().toISOString();
      save(KEYS.HOMEWORKS, all);
      this._notifyChange();
      return true;
    },

    async reopenPendingTask(homeworkId, studentId) {
      const all = load(KEYS.HOMEWORKS, []);
      const hw = all.find((h) => h.id === homeworkId);
      if (!hw || !hw.records || !hw.records[studentId]) return false;
      hw.records[studentId].conceptResolved = false;
      delete hw.records[studentId].resolvedAt;
      save(KEYS.HOMEWORKS, all);
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

      const tests = load(KEYS.TESTS, []);
      const newTest = {
        id: generateId('tst'),
        name: cleanName,
        defaultTotalMarks: Number(defaultTotalMarks) > 0 ? Number(defaultTotalMarks) : 100,
        createdAt: new Date().toISOString(),
        subjectTotals: {},
        subjectDates: {},
        marks: {} // key: `${classId}|${subject}` -> { [studentId]: number }
      };
      tests.push(newTest);
      save(KEYS.TESTS, tests);
      this._notifyChange();
      return newTest;
    },

    async deleteTest(testId) {
      let tests = load(KEYS.TESTS, []);
      tests = tests.filter((t) => t.id !== testId);
      save(KEYS.TESTS, tests);
      this._notifyChange();
      return { success: true };
    },

    async saveSubjectTestMarks(testId, classId, subject, totalMarks, marksByStudentId, testDate = null) {
      const tests = load(KEYS.TESTS, []);
      const test = tests.find((t) => t.id === testId);
      if (!test) throw new Error('Monthly test not found.');

      const cid = normalizeClassId(classId);
      const key = `${cid}|${subject}`;

      if (!test.subjectTotals) test.subjectTotals = {};
      if (!test.subjectDates) test.subjectDates = {};
      if (!test.marks) test.marks = {};

      test.subjectTotals[key] = Number(totalMarks) > 0 ? Number(totalMarks) : (test.defaultTotalMarks || 100);
      if (testDate) test.subjectDates[key] = testDate;
      test.marks[key] = marksByStudentId;

      save(KEYS.TESTS, tests);
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
        tests: testResults
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
      const esc = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;

      const rows = sorted.map((c, idx) => {
        const s = studentMap.get(c.studentId) || { name: 'Unknown', rollNumber: '-', classId: 'N/A' };
        const d = new Date(c.createdAt);
        return [
          idx + 1,
          esc(s.name),
          esc(s.rollNumber || '-'),
          esc(this.getClassLabel(s.classId || s.className)),
          esc(c.text),
          esc(c.severity),
          esc(d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })),
          esc(d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
          esc(c.createdAt)
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
        customSubjects: load(KEYS.SUBJECTS, {})
      };
    },

    async importJSON(data) {
      if (!data || typeof data !== 'object') throw new Error('Invalid backup file.');
      if (Array.isArray(data.customStudents)) save(KEYS.CUSTOM_STUDENTS, data.customStudents);
      if (Array.isArray(data.complaints)) save(KEYS.COMPLAINTS, data.complaints);
      if (Array.isArray(data.homeworks)) save(KEYS.HOMEWORKS, data.homeworks);
      if (Array.isArray(data.tests)) save(KEYS.TESTS, data.tests);
      if (data.customSubjects && typeof data.customSubjects === 'object') save(KEYS.SUBJECTS, data.customSubjects);
      this._notifyChange();
      return {
        complaintsCount: (data.complaints || []).length,
        homeworksCount: (data.homeworks || []).length,
        testsCount: (data.tests || []).length
      };
    },

    // Clean up old demo violations if they reference non-existent demo students, keep real data
    async migrateIfNeeded() {
      const complaints = load(KEYS.COMPLAINTS, []);
      if (complaints.length > 0 && complaints.some((c) => c.id && c.id.startsWith('cmp_demo_'))) {
        // Remove old synthetic demo complaints so only real school records/user entries remain
        const cleaned = complaints.filter((c) => !c.id.startsWith('cmp_demo_'));
        save(KEYS.COMPLAINTS, cleaned);
      }
      // Clear legacy demo students list
      localStorage.removeItem('sct_students_v1');
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

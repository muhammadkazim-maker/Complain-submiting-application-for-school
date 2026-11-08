/**
 * Student Complaint Tracker - Storage Layer
 * Abstracted browser storage interface (localStorage / IndexedDB capable)
 * All UI operations interact with data exclusively through this module.
 */

(function (window) {
  'use strict';

  const STORAGE_KEY_STUDENTS = 'sct_students_v1';
  const STORAGE_KEY_COMPLAINTS = 'sct_complaints_v1';

  // Configurable severity definition and point values
  const SEVERITY_CONFIG = {
    Low: { points: 1, label: 'Low', badgeClass: 'severity-low' },
    Medium: { points: 2, label: 'Medium', badgeClass: 'severity-medium' },
    High: { points: 3, label: 'High', badgeClass: 'severity-high' },
    Extreme: { points: 4, label: 'Extreme', badgeClass: 'severity-extreme' },
    Ultra: { points: 5, label: 'Ultra', badgeClass: 'severity-ultra' }
  };

  // Severity meter max score cap (easy to configure in one place)
  const MAX_SCORE = 20;

  // Class options 1 to 12
  const CLASS_OPTIONS = [
    'Class 1', 'Class 2', 'Class 3', 'Class 4',
    'Class 5', 'Class 6', 'Class 7', 'Class 8',
    'Class 9', 'Class 10', 'Class 11', 'Class 12'
  ];

  /**
   * Normalize user input: trim whitespace and collapse internal duplicate spaces.
   */
  function normalizeText(text) {
    return (text || '').toString().trim().replace(/\s+/g, ' ');
  }

  /**
   * Deterministic unique key for a student: case-insensitive name + class.
   */
  function getStudentKey(name, className) {
    const cleanName = normalizeText(name).toLowerCase();
    const cleanClass = normalizeText(className).toLowerCase();
    return `${cleanName}|||${cleanClass}`;
  }

  /**
   * Safely load JSON data from localStorage.
   */
  function loadFromStorage(key, defaultValue) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (err) {
      console.error(`Error reading ${key} from localStorage:`, err);
      return defaultValue;
    }
  }

  /**
   * Safely save JSON data to localStorage.
   */
  function saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Error writing ${key} to localStorage:`, err);
      return false;
    }
  }

  /**
   * Generate an ID with timestamp and random salt.
   */
  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Determine status label from severity score.
   */
  function getStatusLabel(score) {
    if (score <= 4) return { label: 'Normal', statusClass: 'status-normal' };
    if (score <= 9) return { label: 'Watch', statusClass: 'status-watch' };
    if (score <= 15) return { label: 'Warning', statusClass: 'status-warning' };
    return { label: 'Critical', statusClass: 'status-critical' };
  }

  const Storage = {
    MAX_SCORE,
    SEVERITY_CONFIG,
    CLASS_OPTIONS,

    normalizeText,
    getStudentKey,

    /**
     * Get all raw student records.
     */
    async getStudents() {
      return loadFromStorage(STORAGE_KEY_STUDENTS, []);
    },

    /**
     * Get all raw complaint records.
     */
    async getComplaints() {
      return loadFromStorage(STORAGE_KEY_COMPLAINTS, []);
    },

    /**
     * Get combined student records with calculated severity metrics.
     */
    async getStudentsWithStats() {
      const students = await this.getStudents();
      const complaints = await this.getComplaints();

      // Group complaints by studentId
      const complaintsByStudent = new Map();
      complaints.forEach((cmp) => {
        if (!complaintsByStudent.has(cmp.studentId)) {
          complaintsByStudent.set(cmp.studentId, []);
        }
        complaintsByStudent.get(cmp.studentId).push(cmp);
      });

      return students.map((student) => {
        const studentComplaints = complaintsByStudent.get(student.id) || [];
        
        // Sort newest first
        studentComplaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const severityCounts = { Low: 0, Medium: 0, High: 0, Extreme: 0, Ultra: 0 };
        let score = 0;

        studentComplaints.forEach((c) => {
          const cfg = SEVERITY_CONFIG[c.severity] || { points: 1 };
          score += cfg.points;
          if (severityCounts[c.severity] !== undefined) {
            severityCounts[c.severity] += 1;
          }
        });

        const fillPercent = Math.min((score / MAX_SCORE) * 100, 100);
        const status = getStatusLabel(score);
        const latestComplaint = studentComplaints[0] || null;

        return {
          ...student,
          complaints: studentComplaints,
          totalComplaints: studentComplaints.length,
          severityScore: score,
          fillPercent,
          statusLabel: status.label,
          statusClass: status.statusClass,
          severityCounts,
          latestComplaintAt: latestComplaint ? latestComplaint.createdAt : null
        };
      });
    },

    /**
     * Add a complaint. Automatically matches or creates a student record.
     * Records exact device ISO timestamp at submission.
     */
    async addComplaint({ studentName, className, text, severity }) {
      const cleanName = normalizeText(studentName);
      const cleanClass = normalizeText(className);
      const cleanText = (text || '').trim();

      if (!cleanName) throw new Error('Student name is required.');
      if (!cleanClass) throw new Error('Class is required.');
      if (!cleanText) throw new Error('Complaint text is required.');
      if (!SEVERITY_CONFIG[severity]) throw new Error('Invalid severity level.');

      const students = await this.getStudents();
      const complaints = await this.getComplaints();

      const targetKey = getStudentKey(cleanName, cleanClass);
      let student = students.find((s) => getStudentKey(s.name, s.className) === targetKey);

      if (!student) {
        student = {
          id: generateId('std'),
          name: cleanName,
          className: cleanClass,
          createdAt: new Date().toISOString()
        };
        students.push(student);
        saveToStorage(STORAGE_KEY_STUDENTS, students);
      }

      // Capture device ISO timestamp
      const complaintTimestamp = new Date().toISOString();
      const newComplaint = {
        id: generateId('cmp'),
        studentId: student.id,
        text: cleanText,
        severity,
        createdAt: complaintTimestamp
      };

      complaints.push(newComplaint);
      saveToStorage(STORAGE_KEY_COMPLAINTS, complaints);

      this._notifyChange();
      return { student, complaint: newComplaint };
    },

    /**
     * Delete a complaint by ID.
     * If the student has no remaining complaints, the student record is also deleted.
     */
    async deleteComplaint(complaintId) {
      let complaints = await this.getComplaints();
      const target = complaints.find((c) => c.id === complaintId);
      if (!target) return { success: false, notFound: true };

      const studentId = target.studentId;
      complaints = complaints.filter((c) => c.id !== complaintId);
      saveToStorage(STORAGE_KEY_COMPLAINTS, complaints);

      // Check remaining complaints for student
      const remainingForStudent = complaints.filter((c) => c.studentId === studentId);
      let studentDeleted = false;

      if (remainingForStudent.length === 0) {
        let students = await this.getStudents();
        students = students.filter((s) => s.id !== studentId);
        saveToStorage(STORAGE_KEY_STUDENTS, students);
        studentDeleted = true;
      }

      this._notifyChange();
      return { success: true, complaintId, studentId, studentDeleted };
    },

    /**
     * Export all complaints as CSV format.
     */
    async exportCSV() {
      const students = await this.getStudents();
      const complaints = await this.getComplaints();
      const studentMap = new Map(students.map((s) => [s.id, s]));

      // Newest first
      const sortedComplaints = [...complaints].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      const headers = ['#', 'Student Name', 'Class', 'Complaint', 'Severity', 'Date', 'Time', 'ISO Timestamp'];
      const escapeCsv = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;

      const rows = sortedComplaints.map((c, index) => {
        const student = studentMap.get(c.studentId) || { name: 'Unknown', className: 'N/A' };
        const d = new Date(c.createdAt);
        const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        return [
          index + 1,
          escapeCsv(student.name),
          escapeCsv(student.className),
          escapeCsv(c.text),
          escapeCsv(c.severity),
          escapeCsv(dateStr),
          escapeCsv(timeStr),
          escapeCsv(c.createdAt)
        ].join(',');
      });

      return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    },

    /**
     * Export full database as JSON object.
     */
    async exportJSON() {
      const students = await this.getStudents();
      const complaints = await this.getComplaints();
      return {
        app: 'Student Complaint Tracker',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        students,
        complaints
      };
    },

    /**
     * Import JSON backup. Validates data structure and merges/replaces.
     */
    async importJSON(parsedData, mode = 'replace') {
      if (!parsedData || !Array.isArray(parsedData.students) || !Array.isArray(parsedData.complaints)) {
        throw new Error('Invalid backup file. Must contain students and complaints arrays.');
      }

      if (mode === 'replace') {
        saveToStorage(STORAGE_KEY_STUDENTS, parsedData.students);
        saveToStorage(STORAGE_KEY_COMPLAINTS, parsedData.complaints);
      } else {
        // Merge mode: deduplicate students by normalized key
        const existingStudents = await this.getStudents();
        const existingComplaints = await this.getComplaints();

        const studentKeyMap = new Map();
        existingStudents.forEach((s) => studentKeyMap.set(getStudentKey(s.name, s.className), s.id));

        const idRemap = new Map();

        parsedData.students.forEach((s) => {
          const key = getStudentKey(s.name, s.className);
          if (studentKeyMap.has(key)) {
            idRemap.set(s.id, studentKeyMap.get(key));
          } else {
            const newId = generateId('std');
            idRemap.set(s.id, newId);
            studentKeyMap.set(key, newId);
            existingStudents.push({ ...s, id: newId });
          }
        });

        parsedData.complaints.forEach((c) => {
          const resolvedStudentId = idRemap.get(c.studentId) || c.studentId;
          const exists = existingComplaints.some((ec) => ec.id === c.id);
          if (!exists) {
            existingComplaints.push({ ...c, studentId: resolvedStudentId });
          }
        });

        saveToStorage(STORAGE_KEY_STUDENTS, existingStudents);
        saveToStorage(STORAGE_KEY_COMPLAINTS, existingComplaints);
      }

      this._notifyChange();
      return {
        studentsCount: (await this.getStudents()).length,
        complaintsCount: (await this.getComplaints()).length
      };
    },

    /**
     * Populate with initial sample data if storage is completely empty.
     */
    async populateSampleIfEmpty() {
      const existing = await this.getStudents();
      if (existing && existing.length > 0) return false;

      const sampleStudents = [
        { id: 'std_demo_1', name: 'Zainab Ahmed', className: 'Class 9', createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
        { id: 'std_demo_2', name: 'Muhammad Ali', className: 'Class 10', createdAt: new Date(Date.now() - 86400000 * 4).toISOString() },
        { id: 'std_demo_3', name: 'Fatima Noor', className: 'Class 8', createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
        { id: 'std_demo_4', name: 'Hamza Tariq', className: 'Class 11', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() }
      ];

      const sampleComplaints = [
        {
          id: 'cmp_demo_1',
          studentId: 'std_demo_1',
          text: 'Repeatedly forgets laboratory safety goggles during chemistry practicals.',
          severity: 'Medium',
          createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
        },
        {
          id: 'cmp_demo_2',
          studentId: 'std_demo_1',
          text: 'کلاس روم میں مسلسل دیگر طلبہ کو تنگ کرنا اور شور مچانا۔',
          severity: 'High',
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
        },
        {
          id: 'cmp_demo_3',
          studentId: 'std_demo_2',
          text: 'Broke library computer monitor cable during lunch break. Very careless attitude.',
          severity: 'Extreme',
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
        },
        {
          id: 'cmp_demo_4',
          studentId: 'std_demo_2',
          text: 'Fought with school bus monitor on the way home.',
          severity: 'Ultra',
          createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
        },
        {
          id: 'cmp_demo_5',
          studentId: 'std_demo_2',
          text: 'Homework not submitted for 3 consecutive days.',
          severity: 'Low',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        {
          id: 'cmp_demo_6',
          studentId: 'std_demo_3',
          text: 'Arrived 25 minutes late for morning assembly.',
          severity: 'Low',
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
        },
        {
          id: 'cmp_demo_7',
          studentId: 'std_demo_4',
          text: 'استاد کے ساتھ بدتمیزی اور بحث و تکرار۔',
          severity: 'High',
          createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
        }
      ];

      saveToStorage(STORAGE_KEY_STUDENTS, sampleStudents);
      saveToStorage(STORAGE_KEY_COMPLAINTS, sampleComplaints);
      this._notifyChange();
      return true;
    },

    /**
     * Clear all storage (useful for resets or testing).
     */
    async clearAll() {
      localStorage.removeItem(STORAGE_KEY_STUDENTS);
      localStorage.removeItem(STORAGE_KEY_COMPLAINTS);
      this._notifyChange();
    },

    _listeners: [],
    subscribe(callback) {
      if (typeof callback === 'function') {
        this._listeners.push(callback);
      }
    },
    _notifyChange() {
      this._listeners.forEach((cb) => {
        try { cb(); } catch (e) { console.error(e); }
      });
      window.dispatchEvent(new CustomEvent('sct-data-changed'));
    }
  };

  window.AppStorage = Storage;
})(window);

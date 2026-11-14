/**
 * Hadi Education System Portal — Assistant Tools & Student Matcher
 * Deterministic student name resolution, data-minimised read tools,
 * and strict confirmation-gated write tools with read-back verification.
 */
(function (window) {
  'use strict';

  const MAX_READ_ROWS = 50;

  const CANONICAL_TOKEN_MAP = {
    mohammad: 'muhammad',
    mohammed: 'muhammad',
    muhammed: 'muhammad',
    muhmmad: 'muhammad',
    mohd: 'muhammad',
    muhamad: 'muhammad',
    sayed: 'syed',
    saiyed: 'syed',
    sayyad: 'syed',
    syef: 'syed',
    syyed: 'syed',
    hussein: 'hussain',
    husain: 'hussain',
    hussian: 'hussain',
    husayn: 'hussain',
    hussayn: 'hussain',
    hyder: 'haider',
    haidar: 'haider',
    hydar: 'haider',
    abbass: 'abbas',
    abas: 'abbas',
    mahdi: 'mehdi',
    mahedi: 'mehdi',
    zeshan: 'zeeshan',
    zishan: 'zeeshan',
    iqabal: 'iqbal',
    ahmed: 'ahmad',
    hasan: 'hassan',
    reza: 'raza',
    kausar: 'kauthar',
    kowsar: 'kauthar',
    jafar: 'jaffar',
    jaffer: 'jaffar',
    tawasul: 'tawasal',
    tawassul: 'tawasal',
    qazim: 'kazim',
    taqqi: 'taqi',
    taki: 'taqi',
    komail: 'kumail',
    komeil: 'kumail',
    kasim: 'qasim',
    alee: 'ali',
    aly: 'ali',
    ramdan: 'ramzan',
    ramadan: 'ramzan',
    zane: 'zain',
    aboozar: 'abuzar',
    muntazar: 'muntazir',
    hamdaani: 'hamdani',
    bokhari: 'bukhari',
    nakvi: 'naqvi',
    qazmi: 'kazmi',
    sabtain: 'sibtain',
    ishfaq: 'ashfaq',
    daanish: 'danish',
    uwais: 'awais',
    shanwar: 'shanawar',
    shahnawar: 'shanawar',
    ashaf: 'ashaf'
  };

  function tokenizeName(raw) {
    return String(raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => CANONICAL_TOKEN_MAP[t] || t);
  }

  function editDistance(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[n];
  }

  function scoreNameMatch(queryTokens, stuTokens) {
    if (queryTokens.length === 0 || stuTokens.length === 0) return 0;

    const qJoined = queryTokens.join(' ');
    const sJoined = stuTokens.join(' ');
    if (qJoined === sJoined) return 100;

    const qSorted = [...queryTokens].sort().join(' ');
    const sSorted = [...stuTokens].sort().join(' ');
    if (qSorted === sSorted) return 96;

    // Match each query token greedily against student tokens
    const used = new Set();
    let minMatchTier = 4; // 4: exact, 3: prefix, 2: edit<=1 (len>=5)

    for (const qTok of queryTokens) {
      let bestIdx = -1;
      let bestTier = 0;

      for (let j = 0; j < stuTokens.length; j++) {
        if (used.has(j)) continue;
        const sTok = stuTokens[j];
        if (sTok === qTok) {
          bestIdx = j;
          bestTier = 4;
          break;
        }
        if (qTok.length >= 2 && sTok.startsWith(qTok) && bestTier < 3) {
          bestIdx = j;
          bestTier = 3;
        } else if (qTok.length >= 5 && sTok.length >= 5 && bestTier < 2 && editDistance(qTok, sTok) <= 1) {
          bestIdx = j;
          bestTier = 2;
        }
      }

      if (bestIdx === -1) return 0;
      used.add(bestIdx);
      if (bestTier < minMatchTier) minMatchTier = bestTier;
    }

    if (minMatchTier === 4) {
      // All tokens matched exactly; shorter extra-token penalty gives crisp ordering
      return 85 - Math.min(10, (stuTokens.length - queryTokens.length) * 2);
    }
    if (minMatchTier === 3) {
      return 68 - Math.min(10, stuTokens.length - queryTokens.length);
    }
    return 50 - Math.min(10, stuTokens.length - queryTokens.length);
  }

  function normalizeClassSafe(raw) {
    const clean = window.AppStorage.normalizeClassId(raw);
    const valid = new Set(window.AppStorage.getClasses().map((c) => c.id));
    return valid.has(clean) ? clean : '';
  }

  async function resolveSubjectForClass(classId, subjectInput) {
    const subjects = await window.AppStorage.getSubjects(classId);
    const raw = window.AppStorage.normalizeText(subjectInput);
    if (!raw) return null;
    const low = raw.toLowerCase();

    const exact = subjects.find((s) => s.toLowerCase() === low);
    if (exact) return exact;

    const aliases = {
      math: 'Mathematics',
      maths: 'Mathematics',
      bio: 'Biology',
      chem: 'Chemistry',
      phys: 'Physics',
      eng: 'English',
      cs: 'Computer Science',
      comp: 'Computer Science',
      computer: 'Computer Science',
      science: 'General Science',
      'gen science': 'General Science',
      'pak study': 'Pakistan Studies',
      'pak studies': 'Pakistan Studies',
      pst: 'Pakistan Studies',
      islamiyat: 'Islamiat',
      tarjuma: 'Tarjuma-tul-Quran',
      quran: 'Tarjuma-tul-Quran'
    };

    const aliasTarget = aliases[low];
    if (aliasTarget) {
      const found = subjects.find((s) => s.toLowerCase() === aliasTarget.toLowerCase());
      if (found) return found;
    }

    const prefixMatches = subjects.filter((s) => s.toLowerCase().startsWith(low));
    if (prefixMatches.length === 1) return prefixMatches[0];
    return null;
  }

  function summarizeAttendanceSessionCounts(studentsInClass, recordsMap) {
    let present = 0;
    let absent = 0;
    let leave = 0;
    const absentStudents = [];
    const leaveStudents = [];
    const byId = new Map(studentsInClass.map((s) => [s.id, s]));

    Object.entries(recordsMap || {}).forEach(([sid, status]) => {
      const stu = byId.get(sid);
      const stuCompact = stu
        ? { id: stu.id, name: stu.name, rollNumber: stu.rollNumber || '-', section: stu.section || '-' }
        : { id: sid, name: sid, rollNumber: '-', section: '-' };
      if (status === 'Present') present += 1;
      else if (status === 'Absent') {
        absent += 1;
        absentStudents.push(stuCompact);
      } else if (status === 'Leave') {
        leave += 1;
        leaveStudents.push(stuCompact);
      }
    });

    return {
      totalInClass: studentsInClass.length,
      markedCount: present + absent + leave,
      presentCount: present,
      absentCount: absent,
      leaveCount: leave,
      absentStudents: absentStudents.slice(0, MAX_READ_ROWS),
      leaveStudents: leaveStudents.slice(0, MAX_READ_ROWS)
    };
  }

  function compactStudentRef(s) {
    if (!s) return null;
    return {
      id: s.id,
      name: s.name,
      rollNumber: s.rollNumber || '-',
      classId: window.AppStorage.normalizeClassId(s.classId || s.className),
      classLabel: window.AppStorage.getClassLabel(s.classId || s.className),
      section: s.section || 'General',
      family: s.family || '-'
    };
  }

  function capList(arr, max = MAX_READ_ROWS) {
    const items = arr.slice(0, max);
    return {
      total: arr.length,
      returned: items.length,
      truncated: arr.length > max,
      items
    };
  }

  function isSameSession(unsavedAreaInfo, target) {
    if (!unsavedAreaInfo) return false;
    if (unsavedAreaInfo.classId && target.classId && unsavedAreaInfo.classId !== target.classId) {
      return false;
    }
    return true;
  }

  function ensureNoUnsavedConflict(area, targetDesc) {
    if (!window.PortalBridge || typeof window.PortalBridge.hasUnsavedWork !== 'function') return null;
    const unsaved = typeof window.PortalBridge.getUnsavedState === 'function'
      ? window.PortalBridge.getUnsavedState()
      : null;

    if (window.PortalBridge.hasUnsavedWork(area)) {
      const info = unsaved && unsaved.areas ? unsaved.areas[area] : null;
      if (area === 'class-attendance' || area === 'prep-attendance' || area === 'tests') {
        if (!targetDesc || isSameSession(info, targetDesc)) {
          return `You currently have unsaved edits open on the ${area.replace('-', ' ')} screen${info && info.classId ? ` (${info.classId})` : ''}. Save or discard those changes on screen first before applying assistant changes.`;
        }
      }
      return `You currently have an unsaved draft or open form in ${area}. Please save or cancel it on screen first before applying changes there.`;
    }
    return null;
  }

  /* ========================================================================
     Deterministic Student Matcher (find_students)
     ======================================================================== */
  async function findStudentsTool(args = {}) {
    const rawName = String(args.name || '').trim();
    const altList = Array.isArray(args.alternateSpellings) ? args.alternateSpellings : [];
    const rollFilter = args.rollNumber ? String(args.rollNumber).trim().toLowerCase() : '';
    const fatherFilter = args.fatherName ? String(args.fatherName).trim() : '';
    const sectionFilter = args.section ? String(args.section).trim().toLowerCase() : '';

    let classId = '';
    if (args.classId) {
      classId = normalizeClassSafe(args.classId);
      if (!classId) {
        return { ok: false, error: `Unrecognized class "${String(args.classId)}". Valid classes: 6th..12th.` };
      }
    }

    let pool = await window.AppStorage.getAllRosterStudents();
    if (classId) {
      pool = pool.filter((s) => window.AppStorage.normalizeClassId(s.classId || s.className) === classId);
    }
    if (sectionFilter) {
      pool = pool.filter((s) => String(s.section || '').toLowerCase().includes(sectionFilter));
    }
    if (rollFilter) {
      pool = pool.filter((s) => String(s.rollNumber || '').trim().toLowerCase() === rollFilter);
    }

    const queries = [rawName, ...altList]
      .map((q) => tokenizeName(q))
      .filter((toks) => toks.length > 0);

    if (queries.length === 0 && !rollFilter && !fatherFilter) {
      return { ok: false, error: 'Please provide a student name, roll number, or father name to search.' };
    }

    const fatherTokens = tokenizeName(fatherFilter);
    const scored = [];

    for (const stu of pool) {
      const stuTokens = tokenizeName(stu.name);
      let bestScore = queries.length === 0 ? 70 : 0;
      for (const qToks of queries) {
        const sc = scoreNameMatch(qToks, stuTokens);
        if (sc > bestScore) bestScore = sc;
      }
      if (bestScore <= 0) continue;

      if (fatherTokens.length > 0) {
        const famScore = scoreNameMatch(fatherTokens, tokenizeName(stu.family));
        if (famScore > 0) bestScore += 8;
        else if (queries.length === 0) continue;
        else bestScore -= 15;
      }

      if (bestScore > 0) {
        scored.push({ stu, score: bestScore });
      }
    }

    scored.sort((a, b) => b.score - a.score || a.stu.name.localeCompare(b.stu.name));
    const top = scored.slice(0, 8).map((item) => ({
      ...compactStudentRef(item.stu),
      _score: item.score
    }));

    const exactTop = top.filter((c) => c._score >= 96);
    const cleanCandidates = top.map(({ _score, ...rest }) => rest);

    if (cleanCandidates.length === 0) {
      // Build nearest names fallback from same pool (or whole roster if class filter gave 0)
      const nearPool = pool.length > 0 ? pool : await window.AppStorage.getAllRosterStudents();
      const firstQ = queries[0] || [];
      const near = nearPool
        .map((stu) => {
          const sToks = tokenizeName(stu.name);
          let bestDist = 99;
          for (const q of firstQ) {
            for (const s of sToks) {
              const d = editDistance(q, s);
              if (d < bestDist) bestDist = d;
            }
          }
          return { stu, bestDist };
        })
        .sort((a, b) => a.bestDist - b.bestDist || a.stu.name.localeCompare(b.stu.name))
        .slice(0, 5)
        .map((x) => compactStudentRef(x.stu));

      return {
        ok: true,
        exactMatch: false,
        ambiguous: false,
        candidates: [],
        nearestNames: near,
        message: 'No matching student found.'
      };
    }

    const isExactSingle = exactTop.length === 1;
    const isSinglePlausible = !isExactSingle && cleanCandidates.length === 1;
    const isAmbiguous = exactTop.length > 1 || (exactTop.length === 0 && cleanCandidates.length > 1);

    return {
      ok: true,
      exactMatch: isExactSingle,
      ambiguous: isAmbiguous,
      matchedStudent: (isExactSingle || isSinglePlausible) ? cleanCandidates[0] : null,
      candidates: cleanCandidates
    };
  }

  /* ========================================================================
     Tool Declarations (Gemini OpenAPI 3.03 Schema Subset)
     ======================================================================== */
  const FUNCTION_DECLARATIONS = [
    // READ TOOLS
    {
      name: 'find_students',
      description: 'Search students deterministically by Latin/English transliterated name (handling common spelling variants and token order), optional alternate spellings, classId, section, rollNumber, or fatherName. Always call before referencing or acting on any student.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Student name transliterated to Latin/English script.' },
          alternateSpellings: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional alternative Roman spellings of the student name.'
          },
          classId: {
            type: 'string',
            enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'],
            description: 'Optional class filter.'
          },
          section: { type: 'string', description: 'Optional section filter e.g. Bio A, Computer A, A.' },
          rollNumber: { type: 'string', description: 'Optional roll number.' },
          fatherName: { type: 'string', description: 'Optional father name for disambiguation.' }
        },
        required: ['name']
      }
    },
    {
      name: 'get_school_overview',
      description: 'Get live summary counts across the entire portal: total roster per class, violations, active pending homework tasks, today attendance rolls, monthly tests, and medical health visits.',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'list_classes_subjects',
      description: 'List classes (6th-12th), student counts, configured subjects per class, and Prep slots.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] }
        }
      }
    },
    {
      name: 'get_attendance',
      description: 'Read saved Classes Attendance and/or Prep Attendance sessions with Present/Absent/Leave counts and lists of Absent and Leave students.',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['class', 'prep', 'both'] },
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          subject: { type: 'string', description: 'Subject name when kind is class.' },
          prepSlot: { type: 'string', enum: ['Prep 1', 'Prep 2', 'Prep 3'] },
          date: { type: 'string', description: 'Exact YYYY-MM-DD local date.' },
          dateFrom: { type: 'string', description: 'Start date YYYY-MM-DD inclusive.' },
          dateTo: { type: 'string', description: 'End date YYYY-MM-DD inclusive.' },
          limit: { type: 'integer', description: 'Max sessions to return (default 25, max 50).' }
        },
        required: ['kind']
      }
    },
    {
      name: 'get_student_profile',
      description: 'Get student basic profile. Only set includeContact=true if user explicitly asked for guardian phone or WhatsApp number.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string' },
          includeContact: { type: 'boolean', description: 'Set true only when user asks for contact/phone info.' }
        },
        required: ['studentId']
      }
    },
    {
      name: 'get_student_grand_report',
      description: 'Get full unified Grand Report for one student: attendance, violations, homework, active pending tasks, monthly test scores, and medical visits.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string' },
          hwRange: { type: 'string', enum: ['7d', '30d', 'all'] },
          includeContact: { type: 'boolean', description: 'Set true only when user asks for phone/WhatsApp.' }
        },
        required: ['studentId']
      }
    },
    {
      name: 'get_student_attendance',
      description: 'Get detailed Classes and Prep attendance summary and recent marked sessions for one student.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string' }
        },
        required: ['studentId']
      }
    },
    {
      name: 'get_violations',
      description: 'Query violation records and per-student violation score/status tiers, filtered optionally by student, class, severity, status tier, or date range.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string' },
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Extreme', 'Ultra'] },
          status: { type: 'string', enum: ['Normal', 'Watch', 'Warning', 'Critical'] },
          dateFrom: { type: 'string', description: 'Start date YYYY-MM-DD inclusive.' },
          dateTo: { type: 'string', description: 'End date YYYY-MM-DD inclusive.' },
          limit: { type: 'integer' }
        }
      }
    },
    {
      name: 'get_homework',
      description: 'List saved homework assignments with done/not-done and unclear concept counts.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          subject: { type: 'string' },
          range: { type: 'string', enum: ['1d', '7d', '30d', 'all'] },
          limit: { type: 'integer' }
        }
      }
    },
    {
      name: 'get_pending_tasks',
      description: 'List pending unclear concept tasks (and optionally incomplete homework summary) filtered by class, subject, or student, including class-wise counts.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          subject: { type: 'string' },
          studentId: { type: 'string' },
          includeResolved: { type: 'boolean' },
          includeHwNotDone: { type: 'boolean', description: 'Set true to also summarize students whose homework was marked Not Done.' },
          limit: { type: 'integer' }
        }
      }
    },
    {
      name: 'get_tests',
      description: 'List all Monthly Tests with id, name, defaultTotalMarks, created date, and graded subject count.',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'get_test_marks',
      description: 'Get saved marksheet for a specific test, classId, and subject, including totalMarks, testDate, per-student obtained/percentage/grade, and class average.',
      parameters: {
        type: 'object',
        properties: {
          testId: { type: 'string' },
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          subject: { type: 'string' }
        },
        required: ['testId', 'classId', 'subject']
      }
    },
    {
      name: 'get_student_test_results',
      description: 'Get all Monthly Test results and overall percentage/grade for one student.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string' }
        },
        required: ['studentId']
      }
    },
    {
      name: 'rank_students',
      description: 'Compute deterministic student rankings inside a class by marks, attendance, violations, or homework completion.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          metric: { type: 'string', enum: ['marks', 'attendance', 'violations', 'homework'] },
          testId: { type: 'string', description: 'Optional testId when metric is marks.' },
          limit: { type: 'integer' }
        },
        required: ['classId', 'metric']
      }
    },
    {
      name: 'get_health_records',
      description: 'List Health & Medical Records filtered by student or class.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string' },
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          includeContact: { type: 'boolean', description: 'Set true only when user asks for parent or supervisor phone numbers.' },
          limit: { type: 'integer' }
        }
      }
    },

    // NAVIGATION TOOL (No confirmation)
    {
      name: 'open_screen',
      description: 'Navigate the portal UI to a screen (and optionally open a specific student Grand Report or Student Detail profile).',
      parameters: {
        type: 'object',
        properties: {
          screen: {
            type: 'string',
            enum: ['home', 'violations', 'homework', 'class-attendance', 'prep-attendance', 'health', 'student-details', 'tests', 'grand-report']
          },
          studentId: { type: 'string', description: 'Optional studentId when opening grand-report or student-details.' }
        },
        required: ['screen']
      }
    },

    // WRITE TOOLS (Confirmation-gated via Write Safety Protocol)
    {
      name: 'set_class_attendance',
      description: 'Mark or update Classes Attendance (subject roll call) for a class and date. If defaultStatus is set, applies to ALL students in the class and changes override it. If defaultStatus is omitted, updates ONLY the listed students while preserving everyone else in that session.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          subject: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD local date (defaults to today; cannot be future).' },
          defaultStatus: { type: 'string', enum: ['Present', 'Absent', 'Leave'] },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                studentId: { type: 'string' },
                status: { type: 'string', enum: ['Present', 'Absent', 'Leave'] }
              },
              required: ['studentId', 'status']
            }
          }
        },
        required: ['classId', 'subject']
      }
    },
    {
      name: 'set_prep_attendance',
      description: 'Mark or update Prep Attendance (Prep 1, Prep 2, Prep 3) for a class and date. If defaultStatus is set, applies to ALL students in the class and changes override it; otherwise updates ONLY listed students while preserving existing session marks.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          prepSlot: { type: 'string', enum: ['Prep 1', 'Prep 2', 'Prep 3'] },
          date: { type: 'string', description: 'YYYY-MM-DD local date (defaults to today; cannot be future).' },
          defaultStatus: { type: 'string', enum: ['Present', 'Absent', 'Leave'] },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                studentId: { type: 'string' },
                status: { type: 'string', enum: ['Present', 'Absent', 'Leave'] }
              },
              required: ['studentId', 'status']
            }
          }
        },
        required: ['classId', 'prepSlot']
      }
    },
    {
      name: 'delete_attendance_session',
      description: 'Delete an entire saved Classes Attendance or Prep Attendance session for a class, subject/prepSlot, and date.',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['class', 'prep'] },
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          subject: { type: 'string', description: 'Required when kind is class.' },
          prepSlot: { type: 'string', enum: ['Prep 1', 'Prep 2', 'Prep 3'], description: 'Required when kind is prep.' },
          date: { type: 'string', description: 'YYYY-MM-DD date of the session to delete.' }
        },
        required: ['kind', 'classId', 'date']
      }
    },
    {
      name: 'add_violation',
      description: 'Log a violation record for a resolved roster student. Require explicit severity from user; never guess severity.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string' },
          text: { type: 'string' },
          severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Extreme', 'Ultra'] }
        },
        required: ['studentId', 'text', 'severity']
      }
    },
    {
      name: 'delete_violation',
      description: 'Delete a saved violation record by its complaintId.',
      parameters: {
        type: 'object',
        properties: {
          complaintId: { type: 'string' }
        },
        required: ['complaintId']
      }
    },
    {
      name: 'add_homework',
      description: 'Add a daily homework assignment for a class & subject with teacherName and description, marking all students in the class (defaulting to hwDone=true, conceptClear=true unless specified) with optional per-student overrides.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          subject: { type: 'string' },
          teacherName: { type: 'string' },
          description: { type: 'string' },
          defaultHwDone: { type: 'boolean' },
          defaultConceptClear: { type: 'boolean' },
          studentOverrides: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                studentId: { type: 'string' },
                hwDone: { type: 'boolean' },
                conceptClear: { type: 'boolean' }
              },
              required: ['studentId']
            }
          }
        },
        required: ['classId', 'subject', 'teacherName', 'description']
      }
    },
    {
      name: 'update_homework_records',
      description: 'Update saved student homework checklist flags (hwDone and/or conceptClear) for specific students on an existing homework assignment while safely preserving untouched flags and unrelated students.',
      parameters: {
        type: 'object',
        properties: {
          homeworkId: { type: 'string' },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                studentId: { type: 'string' },
                hwDone: { type: 'boolean' },
                conceptClear: { type: 'boolean' }
              },
              required: ['studentId']
            }
          }
        },
        required: ['homeworkId', 'changes']
      }
    },
    {
      name: 'resolve_pending_task',
      description: 'Mark an unclear concept pending task as Cleared/Resolved for a specific student and homework.',
      parameters: {
        type: 'object',
        properties: {
          homeworkId: { type: 'string' },
          studentId: { type: 'string' }
        },
        required: ['homeworkId', 'studentId']
      }
    },
    {
      name: 'reopen_pending_task',
      description: 'Undo clearance and move a previously cleared concept task back to Active Pending.',
      parameters: {
        type: 'object',
        properties: {
          homeworkId: { type: 'string' },
          studentId: { type: 'string' }
        },
        required: ['homeworkId', 'studentId']
      }
    },
    {
      name: 'delete_homework',
      description: 'Delete an entire saved homework assignment and its checklist.',
      parameters: {
        type: 'object',
        properties: {
          homeworkId: { type: 'string' }
        },
        required: ['homeworkId']
      }
    },
    {
      name: 'create_test',
      description: 'Create a new Monthly Test assessment box.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          defaultTotalMarks: { type: 'number' }
        },
        required: ['name']
      }
    },
    {
      name: 'delete_test',
      description: 'Delete an entire Monthly Test box and all marks stored inside it.',
      parameters: {
        type: 'object',
        properties: {
          testId: { type: 'string' }
        },
        required: ['testId']
      }
    },
    {
      name: 'set_test_marks',
      description: 'Enter or update obtained marks for students in an existing test, classId, and subject. Safely merges changes with existing marks, reuses saved totalMarks and testDate unless changed, and validates 0 <= obtained <= totalMarks (pass null for obtained to clear a mark).',
      parameters: {
        type: 'object',
        properties: {
          testId: { type: 'string' },
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          subject: { type: 'string' },
          totalMarks: { type: 'number', description: 'Optional positive max marks; defaults to saved subject total or test default.' },
          testDate: { type: 'string', description: 'Optional YYYY-MM-DD test date; defaults to previously saved date.' },
          marks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                studentId: { type: 'string' },
                obtained: { type: 'number', description: 'Numeric obtained marks between 0 and totalMarks, or omit/null? Send numeric 0..total.' },
                clearMark: { type: 'boolean', description: 'Set true to clear this student mark back to blank.' }
              },
              required: ['studentId']
            }
          }
        },
        required: ['testId', 'classId', 'subject', 'marks']
      }
    },
    {
      name: 'add_subject',
      description: 'Add a custom subject to a class.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string', enum: ['6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
          subjectName: { type: 'string' }
        },
        required: ['classId', 'subjectName']
      }
    },
    {
      name: 'add_health_record',
      description: 'Log a medical/health visit record for an existing student. Father name & phone are automatically pulled from school records.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string' },
          supervisorTeacher: { type: 'string' },
          supervisorPhone: { type: 'string' },
          doctorOrHospital: { type: 'string' },
          disease: { type: 'string' }
        },
        required: ['studentId', 'supervisorTeacher', 'doctorOrHospital', 'disease']
      }
    },
    {
      name: 'delete_health_record',
      description: 'Delete a saved health/medical visit record by recordId.',
      parameters: {
        type: 'object',
        properties: {
          recordId: { type: 'string' }
        },
        required: ['recordId']
      }
    }
  ];

  /* ========================================================================
     READ TOOL EXECUTORS
     ======================================================================== */
  async function execGetSchoolOverview() {
    const [roster, complaints, pending, homeworks, tests, classAtt, prepAtt, healthList] = await Promise.all([
      window.AppStorage.getAllRosterStudents(),
      window.AppStorage.getComplaints(),
      window.AppStorage.getPendingTasks({ includeResolved: false }),
      window.AppStorage.getHomeworks(),
      window.AppStorage.getTests(),
      window.AppStorage.getClassAttendance(),
      window.AppStorage.getPrepAttendance(),
      window.AppStorage.getHealthRecords()
    ]);

    const today = window.AppStorage.getLocalTodayDate();
    const classCounts = {};
    window.AppStorage.getClasses().forEach((c) => { classCounts[c.id] = 0; });
    roster.forEach((s) => {
      const cid = window.AppStorage.normalizeClassId(s.classId || s.className);
      classCounts[cid] = (classCounts[cid] || 0) + 1;
    });

    return {
      ok: true,
      todayDate: today,
      totalStudents: roster.length,
      studentsPerClass: classCounts,
      totalViolations: complaints.length,
      activePendingTasks: pending.length,
      totalHomeworks: homeworks.length,
      totalMonthlyTests: tests.length,
      classAttendanceSessionsTotal: classAtt.length,
      classAttendanceSessionsToday: classAtt.filter((s) => s.date === today).length,
      prepAttendanceSessionsTotal: prepAtt.length,
      prepAttendanceSessionsToday: prepAtt.filter((s) => s.date === today).length,
      healthRecordsTotal: healthList.length
    };
  }

  async function execListClassesSubjects(args = {}) {
    const classes = window.AppStorage.getClasses();
    const roster = await window.AppStorage.getAllRosterStudents();
    const filterCid = args.classId ? normalizeClassSafe(args.classId) : '';
    if (args.classId && !filterCid) {
      return { ok: false, error: `Invalid class "${String(args.classId)}".` };
    }

    const out = [];
    for (const c of classes) {
      if (filterCid && c.id !== filterCid) continue;
      const stus = roster.filter((s) => window.AppStorage.normalizeClassId(s.classId || s.className) === c.id);
      const subjects = await window.AppStorage.getSubjects(c.id);
      const sections = Array.from(new Set(stus.map((s) => s.section).filter(Boolean)));
      out.push({
        classId: c.id,
        label: c.label,
        studentCount: stus.length,
        sections,
        subjects
      });
    }
    return {
      ok: true,
      classes: out,
      prepSlots: [...window.AppStorage.PREP_SLOTS]
    };
  }

  async function execGetAttendance(args = {}) {
    const kind = args.kind || 'both';
    if (!['class', 'prep', 'both'].includes(kind)) {
      return { ok: false, error: 'kind must be class, prep, or both.' };
    }
    let cid = '';
    if (args.classId) {
      cid = normalizeClassSafe(args.classId);
      if (!cid) return { ok: false, error: `Invalid class "${String(args.classId)}".` };
    }
    if (args.date && !window.AppStorage.isValidYmdDate(args.date)) {
      return { ok: false, error: `Invalid date "${args.date}". Use YYYY-MM-DD.` };
    }
    if (args.dateFrom && !window.AppStorage.isValidYmdDate(args.dateFrom)) {
      return { ok: false, error: `Invalid dateFrom "${args.dateFrom}". Use YYYY-MM-DD.` };
    }
    if (args.dateTo && !window.AppStorage.isValidYmdDate(args.dateTo)) {
      return { ok: false, error: `Invalid dateTo "${args.dateTo}". Use YYYY-MM-DD.` };
    }

    const roster = await window.AppStorage.getAllRosterStudents();
    const studentsByClass = new Map();
    roster.forEach((s) => {
      const k = window.AppStorage.normalizeClassId(s.classId || s.className);
      if (!studentsByClass.has(k)) studentsByClass.set(k, []);
      studentsByClass.get(k).push(s);
    });

    const filterFn = (entry) => {
      if (args.dateFrom && entry.date < args.dateFrom) return false;
      if (args.dateTo && entry.date > args.dateTo) return false;
      return true;
    };

    const sessions = [];
    if (kind === 'class' || kind === 'both') {
      let subjectFilter = args.subject || '';
      if (cid && subjectFilter) {
        const resolvedSubj = await resolveSubjectForClass(cid, subjectFilter);
        if (resolvedSubj) subjectFilter = resolvedSubj;
      }
      const list = await window.AppStorage.getClassAttendance({
        classId: cid || undefined,
        subject: subjectFilter || undefined,
        date: args.date || undefined
      });
      list.filter(filterFn).forEach((entry) => {
        const stus = studentsByClass.get(entry.classId) || [];
        const stats = summarizeAttendanceSessionCounts(stus, entry.records);
        sessions.push({
          kind: 'class',
          id: entry.id,
          classId: entry.classId,
          classLabel: window.AppStorage.getClassLabel(entry.classId),
          subject: entry.subject,
          date: entry.date,
          ...stats
        });
      });
    }

    if (kind === 'prep' || kind === 'both') {
      const list = await window.AppStorage.getPrepAttendance({
        classId: cid || undefined,
        prepSlot: args.prepSlot || undefined,
        date: args.date || undefined
      });
      list.filter(filterFn).forEach((entry) => {
        const stus = studentsByClass.get(entry.classId) || [];
        const stats = summarizeAttendanceSessionCounts(stus, entry.records);
        sessions.push({
          kind: 'prep',
          id: entry.id,
          classId: entry.classId,
          classLabel: window.AppStorage.getClassLabel(entry.classId),
          prepSlot: entry.prepSlot,
          date: entry.date,
          ...stats
        });
      });
    }

    sessions.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const lim = Math.min(Math.max(Number(args.limit) || 25, 1), MAX_READ_ROWS);
    return {
      ok: true,
      ...capList(sessions, lim)
    };
  }

  async function execGetStudentProfile(args = {}) {
    const stu = await window.AppStorage.getStudentById(args.studentId);
    if (!stu) return { ok: false, error: 'Student not found for that studentId.' };
    const profile = {
      ...compactStudentRef(stu),
      familyNumber: stu.familyNumber || '',
      admitted: stu.admitted || '-',
      status: stu.status || 'Active',
      notes: stu.notes || ''
    };
    if (args.includeContact === true) {
      profile.phone = stu.phone || '-';
      profile.whatsapp = stu.whatsapp || stu.phone || '-';
    }
    return { ok: true, student: profile };
  }

  async function execGetStudentGrandReport(args = {}) {
    const hwRange = ['7d', '30d', 'all'].includes(args.hwRange) ? args.hwRange : 'all';
    const report = await window.AppStorage.getStudentGrandReport(args.studentId, { range: hwRange });
    if (!report) return { ok: false, error: 'Student not found for that studentId.' };

    const studentOut = {
      ...compactStudentRef(report.student),
      admitted: report.student.admitted || '-'
    };
    if (args.includeContact === true) {
      studentOut.phone = report.student.phone || '-';
      studentOut.whatsapp = report.student.whatsapp || report.student.phone || '-';
    }

    return {
      ok: true,
      hwRange,
      student: studentOut,
      attendance: report.attendance,
      violations: {
        total: report.violations.total,
        score: report.violations.score,
        maxScore: window.AppStorage.MAX_SCORE,
        statusLabel: report.violations.statusLabel,
        severityCounts: report.violations.severityCounts,
        recent: report.violations.list.slice(0, 15).map((v) => ({
          id: v.id,
          text: v.text,
          severity: v.severity,
          createdAt: v.createdAt
        }))
      },
      homework: {
        overall: report.homework.overall
          ? {
              doneCount: report.homework.overall.doneCount,
              missedCount: report.homework.overall.missedCount,
              totalMarked: report.homework.overall.totalMarked,
              percentage: report.homework.overall.percentage,
              markingScore10: report.homework.overall.markingScore10,
              conceptClearCount: report.homework.overall.conceptClearCount,
              conceptUnclearActive: report.homework.overall.conceptUnclearActive,
              conceptResolvedCount: report.homework.overall.conceptResolvedCount
            }
          : null,
        subjectBreakdown: report.homework.subjectBreakdown,
        activePendingTasks: report.homework.activePendingTasks.slice(0, 20).map((t) => ({
          homeworkId: t.homeworkId,
          subject: t.subject,
          teacherName: t.teacherName,
          description: t.description,
          createdAt: t.createdAt,
          hwDone: t.hwDone
        }))
      },
      tests: report.tests,
      health: {
        total: report.health ? report.health.total : 0,
        latest: report.health && report.health.latest
          ? {
              id: report.health.latest.id,
              visitDate: report.health.latest.visitDate,
              supervisorTeacher: report.health.latest.supervisorTeacher,
              doctorOrHospital: report.health.latest.doctorOrHospital,
              disease: report.health.latest.disease
            }
          : null,
        visits: (report.health && report.health.list ? report.health.list : []).slice(0, 10).map((h) => ({
          id: h.id,
          visitDate: h.visitDate,
          supervisorTeacher: h.supervisorTeacher,
          doctorOrHospital: h.doctorOrHospital,
          disease: h.disease,
          createdAt: h.createdAt
        }))
      }
    };
  }

  async function execGetStudentAttendance(args = {}) {
    const stu = await window.AppStorage.getStudentById(args.studentId);
    if (!stu) return { ok: false, error: 'Student not found for that studentId.' };
    const summary = await window.AppStorage.getStudentAttendanceSummary(stu.id);
    return {
      ok: true,
      student: compactStudentRef(stu),
      attendance: summary
    };
  }

  async function execGetViolations(args = {}) {
    let cid = '';
    if (args.classId) {
      cid = normalizeClassSafe(args.classId);
      if (!cid) return { ok: false, error: `Invalid class "${String(args.classId)}".` };
    }
    if (args.dateFrom && !window.AppStorage.isValidYmdDate(args.dateFrom)) {
      return { ok: false, error: `Invalid dateFrom "${args.dateFrom}".` };
    }
    if (args.dateTo && !window.AppStorage.isValidYmdDate(args.dateTo)) {
      return { ok: false, error: `Invalid dateTo "${args.dateTo}".` };
    }

    const roster = await window.AppStorage.getAllRosterStudents();
    const stuMap = new Map(roster.map((s) => [s.id, s]));
    const statsList = await window.AppStorage.getStudentsWithStats();

    const matchesStudentScope = (stuId) => {
      if (args.studentId && stuId !== args.studentId) return false;
      const stu = stuMap.get(stuId);
      if (cid && (!stu || window.AppStorage.normalizeClassId(stu.classId || stu.className) !== cid)) return false;
      return true;
    };

    const rawComplaints = await window.AppStorage.getComplaints();
    const toLocalYmd = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const filteredComplaints = rawComplaints
      .filter((c) => {
        if (!matchesStudentScope(c.studentId)) return false;
        if (args.severity && c.severity !== args.severity) return false;
        const ymd = toLocalYmd(c.createdAt);
        if (args.dateFrom && ymd < args.dateFrom) return false;
        if (args.dateTo && ymd > args.dateTo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const studentSummaries = statsList
      .filter((st) => {
        if (!matchesStudentScope(st.id)) return false;
        if (args.status && st.statusLabel !== args.status) return false;
        if (args.severity && (st.severityCounts[args.severity] || 0) === 0) return false;
        return true;
      })
      .sort((a, b) => b.severityScore - a.severityScore)
      .map((st) => ({
        studentId: st.id,
        name: st.name,
        rollNumber: st.rollNumber || '-',
        classId: window.AppStorage.normalizeClassId(st.classId),
        classLabel: st.className,
        totalViolations: st.totalComplaints,
        severityScore: st.severityScore,
        statusLabel: st.statusLabel,
        severityCounts: st.severityCounts
      }));

    // Keep complaints aligned if status filter was given
    const allowedStatusIds = args.status ? new Set(studentSummaries.map((s) => s.studentId)) : null;
    const finalComplaints = allowedStatusIds
      ? filteredComplaints.filter((c) => allowedStatusIds.has(c.studentId))
      : filteredComplaints;

    const lim = Math.min(Math.max(Number(args.limit) || 25, 1), MAX_READ_ROWS);
    const recordsCapped = capList(
      finalComplaints.map((c) => {
        const s = stuMap.get(c.studentId);
        return {
          complaintId: c.id,
          studentId: c.studentId,
          studentName: s ? s.name : 'Unknown',
          rollNumber: s ? (s.rollNumber || '-') : '-',
          classId: s ? window.AppStorage.normalizeClassId(s.classId || s.className) : '-',
          severity: c.severity,
          points: (window.AppStorage.SEVERITY_CONFIG[c.severity] || { points: 1 }).points,
          text: c.text,
          date: toLocalYmd(c.createdAt),
          createdAt: c.createdAt
        };
      }),
      lim
    );

    return {
      ok: true,
      studentsMatchedCount: studentSummaries.length,
      studentSummaries: studentSummaries.slice(0, lim),
      violations: recordsCapped
    };
  }

  async function execGetHomework(args = {}) {
    let cid = '';
    if (args.classId) {
      cid = normalizeClassSafe(args.classId);
      if (!cid) return { ok: false, error: `Invalid class "${String(args.classId)}".` };
    }
    let subj = args.subject || '';
    if (cid && subj) {
      subj = (await resolveSubjectForClass(cid, subj)) || subj;
    }

    const list = await window.AppStorage.getHomeworks({
      classId: cid || undefined,
      subject: subj || undefined,
      range: ['1d', '7d', '30d', 'all'].includes(args.range) ? args.range : 'all'
    });

    const lim = Math.min(Math.max(Number(args.limit) || 20, 1), MAX_READ_ROWS);
    const mapped = list.map((h) => {
      const recs = Object.values(h.records || {});
      const done = recs.filter((r) => r.hwDone).length;
      const notDone = recs.filter((r) => !r.hwDone).length;
      const activeUnclear = recs.filter((r) => !r.conceptClear && !r.conceptResolved).length;
      return {
        homeworkId: h.id,
        classId: h.classId,
        classLabel: window.AppStorage.getClassLabel(h.classId),
        subject: h.subject,
        teacherName: h.teacherName,
        description: h.description,
        dayName: h.dayName,
        createdAt: h.createdAt,
        totalStudentsMarked: recs.length,
        doneCount: done,
        notDoneCount: notDone,
        activeUnclearCount: activeUnclear
      };
    });

    return { ok: true, ...capList(mapped, lim) };
  }

  async function execGetPendingTasks(args = {}) {
    let cid = '';
    if (args.classId) {
      cid = normalizeClassSafe(args.classId);
      if (!cid) return { ok: false, error: `Invalid class "${String(args.classId)}".` };
    }
    let subj = args.subject || '';
    if (cid && subj) {
      subj = (await resolveSubjectForClass(cid, subj)) || subj;
    }

    const tasks = await window.AppStorage.getPendingTasks({
      classId: cid || undefined,
      subject: subj || undefined,
      studentId: args.studentId || undefined,
      includeResolved: !!args.includeResolved
    });

    const countsByClass = {};
    tasks.forEach((t) => {
      const k = window.AppStorage.normalizeClassId(t.classId);
      countsByClass[k] = (countsByClass[k] || 0) + 1;
    });

    const lim = Math.min(Math.max(Number(args.limit) || 35, 1), MAX_READ_ROWS);
    const out = {
      ok: true,
      countsByClass,
      ...capList(tasks, lim)
    };

    if (args.includeHwNotDone) {
      const hws = await window.AppStorage.getHomeworks({ classId: cid || undefined, subject: subj || undefined });
      const roster = await window.AppStorage.getAllRosterStudents();
      const stuMap = new Map(roster.map((s) => [s.id, s]));
      const notDoneItems = [];
      hws.forEach((hw) => {
        Object.entries(hw.records || {}).forEach(([sid, rec]) => {
          if (args.studentId && sid !== args.studentId) return;
          if (!rec.hwDone) {
            const stu = stuMap.get(sid);
            if (!stu) return;
            notDoneItems.push({
              homeworkId: hw.id,
              studentId: sid,
              studentName: stu.name,
              rollNumber: stu.rollNumber || '-',
              classId: hw.classId,
              subject: hw.subject,
              createdAt: hw.createdAt,
              description: hw.description
            });
          }
        });
      });
      out.hwNotDone = capList(notDoneItems, lim);
    }

    return out;
  }

  async function execGetTests() {
    const tests = await window.AppStorage.getTests();
    return {
      ok: true,
      ...capList(
        tests.map((t) => ({
          testId: t.id,
          name: t.name,
          defaultTotalMarks: t.defaultTotalMarks,
          createdAt: t.createdAt,
          gradedClassSubjects: t.marks ? Object.keys(t.marks) : []
        })),
        MAX_READ_ROWS
      )
    };
  }

  async function execGetTestMarks(args = {}) {
    const tests = await window.AppStorage.getTests();
    const test = tests.find((t) => t.id === args.testId);
    if (!test) return { ok: false, error: 'Monthly test not found.' };

    const cid = normalizeClassSafe(args.classId);
    if (!cid) return { ok: false, error: `Invalid class "${String(args.classId)}".` };
    const resolvedSubj = (await resolveSubjectForClass(cid, args.subject)) || window.AppStorage.normalizeText(args.subject);
    if (!resolvedSubj) return { ok: false, error: 'Subject is required.' };

    const key = `${cid}|${resolvedSubj}`;
    const marksMap = (test.marks && test.marks[key]) || {};
    const totalMarks = (test.subjectTotals && test.subjectTotals[key]) || test.defaultTotalMarks || 100;
    const testDate = (test.subjectDates && test.subjectDates[key]) || null;

    const students = await window.AppStorage.getStudentsByClass(cid);
    const rows = [];
    let sumPct = 0;
    let graded = 0;

    students.forEach((s) => {
      const val = marksMap[s.id];
      const hasMark = val !== undefined && val !== null && val !== '';
      const obtained = hasMark ? Number(val) : null;
      const percent = hasMark && totalMarks > 0 ? Math.round((obtained / totalMarks) * 100) : null;
      if (hasMark) {
        graded += 1;
        sumPct += percent;
      }
      rows.push({
        studentId: s.id,
        name: s.name,
        rollNumber: s.rollNumber || '-',
        obtained,
        totalMarks,
        percent
      });
    });

    return {
      ok: true,
      testId: test.id,
      testName: test.name,
      classId: cid,
      classLabel: window.AppStorage.getClassLabel(cid),
      subject: resolvedSubj,
      totalMarks,
      testDate,
      gradedCount: graded,
      totalStudentsInClass: students.length,
      averagePercent: graded > 0 ? Math.round(sumPct / graded) : null,
      students: capList(rows, MAX_READ_ROWS)
    };
  }

  async function execGetStudentTestResults(args = {}) {
    const stu = await window.AppStorage.getStudentById(args.studentId);
    if (!stu) return { ok: false, error: 'Student not found for that studentId.' };
    const results = await window.AppStorage.getStudentTestResults(stu.id);
    return {
      ok: true,
      student: compactStudentRef(stu),
      results
    };
  }

  async function execRankStudents(args = {}) {
    const cid = normalizeClassSafe(args.classId);
    if (!cid) return { ok: false, error: `Invalid class "${String(args.classId)}".` };
    const metric = args.metric;
    if (!['marks', 'attendance', 'violations', 'homework'].includes(metric)) {
      return { ok: false, error: 'metric must be marks, attendance, violations, or homework.' };
    }

    const students = await window.AppStorage.getStudentsByClass(cid);
    const lim = Math.min(Math.max(Number(args.limit) || 15, 1), MAX_READ_ROWS);
    const ranked = [];

    if (metric === 'marks') {
      const tests = await window.AppStorage.getTests();
      const filterTest = args.testId ? tests.find((t) => t.id === args.testId) : null;
      if (args.testId && !filterTest) return { ok: false, error: 'Specified testId not found.' };

      for (const s of students) {
        const res = await window.AppStorage.getStudentTestResults(s.id);
        let obtained = 0;
        let total = 0;
        let pct = null;
        if (filterTest) {
          const match = res.tests.find((t) => t.testId === filterTest.id);
          if (match) {
            obtained = match.testObtained;
            total = match.testTotal;
            pct = match.testPercent;
          }
        } else {
          obtained = res.overallObtained;
          total = res.overallTotal;
          pct = res.overallPercent;
        }
        if (pct !== null) {
          ranked.push({
            ...compactStudentRef(s),
            obtained,
            total,
            percent: pct
          });
        }
      }
      ranked.sort((a, b) => b.percent - a.percent || b.obtained - a.obtained || a.name.localeCompare(b.name));
    } else if (metric === 'attendance') {
      for (const s of students) {
        const summary = await window.AppStorage.getStudentAttendanceSummary(s.id);
        if (summary.combined.total > 0) {
          ranked.push({
            ...compactStudentRef(s),
            present: summary.combined.present,
            absent: summary.combined.absent,
            leave: summary.combined.leave,
            totalSessions: summary.combined.total,
            percent: summary.combined.percent
          });
        }
      }
      ranked.sort((a, b) => b.percent - a.percent || b.present - a.present || a.name.localeCompare(b.name));
    } else if (metric === 'violations') {
      const statsList = await window.AppStorage.getStudentsWithStats();
      statsList
        .filter((st) => window.AppStorage.normalizeClassId(st.classId) === cid)
        .forEach((st) => {
          ranked.push({
            ...compactStudentRef(st),
            severityScore: st.severityScore,
            statusLabel: st.statusLabel,
            totalViolations: st.totalComplaints
          });
        });
      ranked.sort((a, b) => b.severityScore - a.severityScore || b.totalViolations - a.totalViolations);
    } else if (metric === 'homework') {
      for (const s of students) {
        const rep = await window.AppStorage.getStudentHomeworkReport(s.id, null, { range: 'all' });
        if (rep && rep.totalMarked > 0) {
          ranked.push({
            ...compactStudentRef(s),
            doneCount: rep.doneCount,
            totalMarked: rep.totalMarked,
            percent: rep.percentage,
            pendingUnclear: rep.conceptUnclearActive
          });
        }
      }
      ranked.sort((a, b) => b.percent - a.percent || b.doneCount - a.doneCount || a.name.localeCompare(b.name));
    }

    return {
      ok: true,
      classId: cid,
      classLabel: window.AppStorage.getClassLabel(cid),
      metric,
      totalStudentsInClass: students.length,
      rankedCount: ranked.length,
      ...capList(ranked.map((item, idx) => ({ rank: idx + 1, ...item })), lim)
    };
  }

  async function execGetHealthRecords(args = {}) {
    let cid = '';
    if (args.classId) {
      cid = normalizeClassSafe(args.classId);
      if (!cid) return { ok: false, error: `Invalid class "${String(args.classId)}".` };
    }
    const list = await window.AppStorage.getHealthRecords({
      classId: cid || undefined,
      studentId: args.studentId || undefined
    });
    const lim = Math.min(Math.max(Number(args.limit) || 25, 1), MAX_READ_ROWS);
    const mapped = list.map((r) => {
      const item = {
        recordId: r.id,
        studentId: r.studentId,
        studentName: r.studentName,
        classId: r.classId,
        classLabel: window.AppStorage.getClassLabel(r.classId),
        fatherName: r.fatherName || '-',
        supervisorTeacher: r.supervisorTeacher,
        doctorOrHospital: r.doctorOrHospital,
        disease: r.disease,
        visitDate: r.visitDate,
        createdAt: r.createdAt
      };
      if (args.includeContact === true) {
        item.phone = r.phone || '-';
        item.supervisorPhone = r.supervisorPhone || '-';
      }
      return item;
    });
    return { ok: true, ...capList(mapped, lim) };
  }

  /* ========================================================================
     WRITE SAFETY PROTOCOL HELPERS & WRITE HANDLERS REGISTRY
     ======================================================================== */

  async function prepareSetAttendance(kind, args) {
    const area = kind === 'prep' ? 'prep-attendance' : 'class-attendance';
    const cid = normalizeClassSafe(args.classId);
    if (!cid) return { ok: false, error: `Invalid class "${String(args.classId)}".` };

    const today = window.AppStorage.getLocalTodayDate();
    const dateStr = args.date ? String(args.date).trim() : today;
    if (!window.AppStorage.isValidYmdDate(dateStr)) {
      return { ok: false, error: `Invalid attendance date "${dateStr}". Expected YYYY-MM-DD.` };
    }
    if (dateStr > today) {
      return {
        ok: false,
        error: `Cannot mark future attendance for ${dateStr} (today is ${today}). Ask the user to confirm today or a past date.`
      };
    }

    let itemVal = '';
    if (kind === 'prep') {
      const slotRaw = String(args.prepSlot || '').trim();
      const canonical = window.AppStorage.PREP_SLOTS.find((s) => s.toLowerCase() === slotRaw.toLowerCase());
      if (!canonical) {
        return { ok: false, error: `Invalid prepSlot "${slotRaw}". Must be Prep 1, Prep 2, or Prep 3.` };
      }
      itemVal = canonical;
    } else {
      const resolvedSubj = await resolveSubjectForClass(cid, args.subject);
      if (!resolvedSubj) {
        const subs = await window.AppStorage.getSubjects(cid);
        return {
          ok: false,
          error: `Subject "${String(args.subject)}" does not exist in ${window.AppStorage.getClassLabel(cid)}. Available: ${subs.join(', ')}.`
        };
      }
      itemVal = resolvedSubj;
    }

    const unsavedErr = ensureNoUnsavedConflict(area, { classId: cid });
    if (unsavedErr) return { ok: false, error: unsavedErr };

    const students = await window.AppStorage.getStudentsByClass(cid);
    if (students.length === 0) {
      return { ok: false, error: `No students enrolled in ${window.AppStorage.getClassLabel(cid)}.` };
    }
    const stuMap = new Map(students.map((s) => [s.id, s]));

    const validStatuses = new Set(window.AppStorage.ATTENDANCE_STATUSES);
    let defaultStatus = null;
    if (args.defaultStatus !== undefined && args.defaultStatus !== null && args.defaultStatus !== '') {
      if (!validStatuses.has(args.defaultStatus)) {
        return { ok: false, error: `Invalid defaultStatus "${String(args.defaultStatus)}". Expected Present, Absent, or Leave.` };
      }
      defaultStatus = args.defaultStatus;
    }

    const changes = Array.isArray(args.changes) ? args.changes : [];
    for (const ch of changes) {
      if (!ch || !ch.studentId || !validStatuses.has(ch.status)) {
        return { ok: false, error: 'Each attendance change requires a valid studentId and status (Present, Absent, or Leave).' };
      }
      const stu = stuMap.get(ch.studentId);
      if (!stu) {
        const realStu = await window.AppStorage.getStudentById(ch.studentId);
        if (realStu) {
          return {
            ok: false,
            error: `Student "${realStu.name}" belongs to ${window.AppStorage.getClassLabel(realStu.classId)}, not ${window.AppStorage.getClassLabel(cid)}.`
          };
        }
        return { ok: false, error: `Student ID "${ch.studentId}" not found in ${window.AppStorage.getClassLabel(cid)}.` };
      }
    }

    if (!defaultStatus && changes.length === 0) {
      return { ok: false, error: 'Provide either defaultStatus or at least one student status change.' };
    }

    const loadSessions = () => (kind === 'prep'
      ? window.AppStorage.getPrepAttendance({ classId: cid, prepSlot: itemVal, date: dateStr })
      : window.AppStorage.getClassAttendance({ classId: cid, subject: itemVal, date: dateStr }));

    const computeMerged = (existingSession) => {
      const oldRecords = (existingSession && existingSession.records) ? { ...existingSession.records } : {};
      const nextRecords = { ...oldRecords };
      if (defaultStatus) {
        students.forEach((s) => { nextRecords[s.id] = defaultStatus; });
      }
      changes.forEach((ch) => {
        nextRecords[ch.studentId] = ch.status;
      });
      const changedIds = [];
      const allIds = new Set([...Object.keys(oldRecords), ...Object.keys(nextRecords)]);
      allIds.forEach((sid) => {
        if ((oldRecords[sid] || null) !== (nextRecords[sid] || null)) changedIds.push(sid);
      });
      return { oldRecords, nextRecords, changedIds };
    };

    const existingList = await loadSessions();
    const existing = existingList[0] || null;
    const baseFingerprint = JSON.stringify({
      id: existing ? existing.id : null,
      updatedAt: existing ? existing.updatedAt : null,
      records: existing ? existing.records : {}
    });

    const merged = computeMerged(existing);
    if (merged.changedIds.length === 0) {
      return {
        ok: true,
        noChange: true,
        message: `Attendance for ${window.AppStorage.getClassLabel(cid)} (${itemVal} on ${dateStr}) already has these exact marks.`
      };
    }

    const nextCounts = summarizeAttendanceSessionCounts(students, merged.nextRecords);
    const classLabel = window.AppStorage.getClassLabel(cid);
    const diffRows = [];

    if (defaultStatus) {
      diffRows.push({
        label: `All ${students.length} students in ${classLabel}`,
        before: existing ? `${Object.keys(merged.oldRecords).length} previously marked` : 'Unmarked',
        after: `Default: ${defaultStatus}`
      });
      changes.forEach((ch) => {
        const st = stuMap.get(ch.studentId);
        diffRows.push({
          label: `${st.name} (#${st.rollNumber || '-'})`,
          before: merged.oldRecords[st.id] || 'Unmarked',
          after: `${ch.status} (override)`
        });
      });
    } else {
      merged.changedIds.forEach((sid) => {
        const st = stuMap.get(sid);
        diffRows.push({
          label: st ? `${st.name} (#${st.rollNumber || '-'})` : sid,
          before: merged.oldRecords[sid] || 'Unmarked',
          after: merged.nextRecords[sid]
        });
      });
    }

    const preview = {
      variant: 'write',
      title: kind === 'prep' ? 'Confirm Prep Attendance Save' : 'Confirm Classes Attendance Save',
      subtitle: `${classLabel} • ${itemVal} • ${dateStr}`,
      summaryLines: [
        defaultStatus
          ? `Applies ${defaultStatus} to ALL ${students.length} students of ${classLabel}${changes.length > 0 ? `, with ${changes.length} exception override(s)` : ''}.`
          : `Updates ${merged.changedIds.length} student(s) in ${classLabel} (all other students remain preserved).`,
        `Result totals: Present ${nextCounts.presentCount}, Absent ${nextCounts.absentCount}, Leave ${nextCounts.leaveCount} (${nextCounts.markedCount}/${students.length} marked)`
      ],
      rows: diffRows.slice(0, 20),
      extraRowsCount: Math.max(0, diffRows.length - 20),
      confirmLabel: 'Confirm & Save Attendance'
    };

    return {
      ok: true,
      baseFingerprint,
      cid,
      itemVal,
      dateStr,
      defaultStatus,
      students,
      preview
    };
  }

  async function commitSetAttendance(kind, prep) {
    const loadSessions = () => (kind === 'prep'
      ? window.AppStorage.getPrepAttendance({ classId: prep.cid, prepSlot: prep.itemVal, date: prep.dateStr })
      : window.AppStorage.getClassAttendance({ classId: prep.cid, subject: prep.itemVal, date: prep.dateStr }));

    const currentList = await loadSessions();
    const current = currentList[0] || null;
    const currentFp = JSON.stringify({
      id: current ? current.id : null,
      updatedAt: current ? current.updatedAt : null,
      records: current ? current.records : {}
    });
    if (currentFp !== prep.baseFingerprint) {
      return {
        ok: false,
        staleData: true,
        error: 'Attendance data changed before confirmation. Please retry your request.'
      };
    }

    // Recompute merged records cleanly against current storage
    const mergedRecords = current && current.records ? { ...current.records } : {};
    if (prep.defaultStatus) {
      prep.students.forEach((s) => { mergedRecords[s.id] = prep.defaultStatus; });
    }
    (prep.changes || []).forEach((ch) => {
      mergedRecords[ch.studentId] = ch.status;
    });

    const payload = kind === 'prep'
      ? { classId: prep.cid, prepSlot: prep.itemVal, date: prep.dateStr, records: mergedRecords }
      : { classId: prep.cid, subject: prep.itemVal, date: prep.dateStr, records: mergedRecords };

    const saved = kind === 'prep'
      ? await window.AppStorage.savePrepAttendance(payload)
      : await window.AppStorage.saveClassAttendance(payload);

    // Read-back verify
    const readBack = (await loadSessions())[0];
    if (!readBack || readBack.id !== saved.id) {
      return { ok: false, error: 'Storage read-back verification failed after saving attendance.' };
    }
    for (const [sid, expected] of Object.entries(mergedRecords)) {
      if (readBack.records[sid] !== expected) {
        return { ok: false, error: 'Saved attendance record verification mismatch.' };
      }
    }

    const finalCounts = summarizeAttendanceSessionCounts(prep.students, readBack.records);
    return {
      ok: true,
      verified: true,
      sessionId: readBack.id,
      classId: prep.cid,
      classLabel: window.AppStorage.getClassLabel(prep.cid),
      [kind === 'prep' ? 'prepSlot' : 'subject']: prep.itemVal,
      date: prep.dateStr,
      ...finalCounts,
      toastMessage: `${kind === 'prep' ? 'Prep' : 'Class'} attendance saved for ${window.AppStorage.getClassLabel(prep.cid)} (${prep.itemVal}).`
    };
  }

  function buildWriteSpec(toolName, args) {
    if (toolName === 'set_class_attendance' || toolName === 'set_prep_attendance') {
      const kind = toolName === 'set_prep_attendance' ? 'prep' : 'class';
      return {
        prepare: async () => {
          const p = await prepareSetAttendance(kind, args || {});
          if (p && p.ok && !p.noChange) {
            p.changes = Array.isArray(args && args.changes) ? args.changes : [];
          }
          return p;
        },
        commit: (p) => commitSetAttendance(kind, p)
      };
    }

    if (toolName === 'delete_attendance_session') {
      return {
        prepare: async () => {
          const kind = args && args.kind;
          if (!['class', 'prep'].includes(kind)) return { ok: false, error: 'kind must be class or prep.' };
          const cid = normalizeClassSafe(args.classId);
          if (!cid) return { ok: false, error: 'Invalid classId.' };
          const dateStr = String(args.date || '').trim();
          if (!window.AppStorage.isValidYmdDate(dateStr)) return { ok: false, error: 'Invalid date. Expected YYYY-MM-DD.' };

          const area = kind === 'prep' ? 'prep-attendance' : 'class-attendance';
          const unsavedErr = ensureNoUnsavedConflict(area, { classId: cid });
          if (unsavedErr) return { ok: false, error: unsavedErr };

          let itemVal = '';
          if (kind === 'prep') {
            const canonical = window.AppStorage.PREP_SLOTS.find((s) => s.toLowerCase() === String(args.prepSlot || '').trim().toLowerCase());
            if (!canonical) return { ok: false, error: 'prepSlot must be Prep 1, Prep 2, or Prep 3.' };
            itemVal = canonical;
          } else {
            itemVal = (await resolveSubjectForClass(cid, args.subject)) || window.AppStorage.normalizeText(args.subject);
            if (!itemVal) return { ok: false, error: 'subject is required when kind is class.' };
          }

          const loadTarget = () => (kind === 'prep'
            ? window.AppStorage.getPrepAttendance({ classId: cid, prepSlot: itemVal, date: dateStr })
            : window.AppStorage.getClassAttendance({ classId: cid, subject: itemVal, date: dateStr }));

          const list = await loadTarget();
          const found = list[0];
          if (!found) {
            return { ok: false, error: `No ${kind} attendance session found for ${window.AppStorage.getClassLabel(cid)} (${itemVal}) on ${dateStr}.` };
          }
          const markedCount = Object.keys(found.records || {}).length;
          return {
            ok: true,
            kind,
            cid,
            itemVal,
            dateStr,
            targetId: found.id,
            baseFingerprint: JSON.stringify({ id: found.id, updatedAt: found.updatedAt }),
            preview: {
              variant: 'danger',
              title: 'Delete Attendance Session?',
              subtitle: `${window.AppStorage.getClassLabel(cid)} • ${itemVal} • ${dateStr}`,
              summaryLines: [
                `WARNING: Permanently deletes this saved ${kind} attendance roll (${markedCount} student marks). This cannot be undone.`
              ],
              rows: [{ label: 'Saved Roll', before: `${markedCount} marks`, after: 'DELETED' }],
              confirmLabel: 'Delete Session'
            }
          };
        },
        commit: async (prep) => {
          const loadTarget = () => (prep.kind === 'prep'
            ? window.AppStorage.getPrepAttendance({ classId: prep.cid, prepSlot: prep.itemVal, date: prep.dateStr })
            : window.AppStorage.getClassAttendance({ classId: prep.cid, subject: prep.itemVal, date: prep.dateStr }));
          const cur = (await loadTarget())[0];
          if (!cur || JSON.stringify({ id: cur.id, updatedAt: cur.updatedAt }) !== prep.baseFingerprint) {
            return { ok: false, staleData: true, error: 'Session changed or missing before confirmation. Please retry.' };
          }
          if (prep.kind === 'prep') await window.AppStorage.deletePrepAttendance(prep.targetId);
          else await window.AppStorage.deleteClassAttendance(prep.targetId);
          const after = (await loadTarget())[0];
          if (after) return { ok: false, error: 'Read-back check found session still exists after deletion.' };
          return {
            ok: true,
            verified: true,
            deletedId: prep.targetId,
            toastMessage: `Deleted ${prep.itemVal} attendance (${prep.dateStr}).`
          };
        }
      };
    }

    if (toolName === 'add_violation') {
      return {
        prepare: async () => {
          const stu = await window.AppStorage.getStudentById(args && args.studentId);
          if (!stu) return { ok: false, error: 'Student not found. Resolve student with find_students first.' };
          const sev = args && args.severity;
          if (!window.AppStorage.SEVERITY_CONFIG[sev]) {
            return { ok: false, error: 'Severity must be one of Low, Medium, High, Extreme, or Ultra.' };
          }
          const cleanText = String((args && args.text) || '').trim();
          if (!cleanText) return { ok: false, error: 'Violation description text is required.' };

          const cid = window.AppStorage.normalizeClassId(stu.classId || stu.className);
          const stats = (await window.AppStorage.getStudentsWithStats()).find((x) => x.id === stu.id);
          const oldScore = stats ? stats.severityScore : 0;
          const pts = window.AppStorage.SEVERITY_CONFIG[sev].points;
          const newScore = oldScore + pts;
          const nextTier = window.AppStorage.getStatusLabel(newScore).label;

          return {
            ok: true,
            stu,
            cid,
            cleanText,
            sev,
            baseFingerprint: String(stats ? stats.totalComplaints : 0),
            preview: {
              variant: 'write',
              title: 'Confirm Violation Record',
              subtitle: `${stu.name} (${window.AppStorage.getClassLabel(cid)} • Roll #${stu.rollNumber || '-'})`,
              summaryLines: [
                `Severity: ${sev} (+${pts} pts) — Score changes ${oldScore} → ${newScore} (${nextTier})`
              ],
              rows: [
                { label: 'Student', before: '-', after: `${stu.name} (${window.AppStorage.getClassLabel(cid)} #${stu.rollNumber || '-'})` },
                { label: 'Details', before: '-', after: cleanText },
                { label: 'Severity / Score', before: `${oldScore} pts`, after: `${sev} → ${newScore} pts (${nextTier})` }
              ],
              confirmLabel: 'Confirm & Log Violation'
            }
          };
        },
        commit: async (prep) => {
          const statsNow = (await window.AppStorage.getStudentsWithStats()).find((x) => x.id === prep.stu.id);
          if (String(statsNow ? statsNow.totalComplaints : 0) !== prep.baseFingerprint) {
            return { ok: false, staleData: true, error: 'Student violation history changed before confirmation. Please retry.' };
          }
          const res = await window.AppStorage.addComplaint({
            studentId: prep.stu.id,
            studentName: prep.stu.name,
            classId: prep.cid,
            className: prep.cid,
            text: prep.cleanText,
            severity: prep.sev,
            allowCreateCustom: false
          });
          const afterStats = (await window.AppStorage.getStudentsWithStats()).find((x) => x.id === prep.stu.id);
          const verifiedRecord = afterStats && afterStats.complaints.find((c) => c.id === res.complaint.id);
          if (!verifiedRecord) {
            return { ok: false, error: 'Read-back verification failed after logging violation.' };
          }
          return {
            ok: true,
            verified: true,
            complaintId: res.complaint.id,
            student: compactStudentRef(res.student),
            severity: res.complaint.severity,
            newScore: afterStats.severityScore,
            newStatus: afterStats.statusLabel,
            toastMessage: `Violation logged for ${res.student.name} (${res.complaint.severity}).`
          };
        }
      };
    }

    if (toolName === 'delete_violation') {
      return {
        prepare: async () => {
          const cid = String((args && args.complaintId) || '').trim();
          const all = await window.AppStorage.getComplaints();
          const target = all.find((c) => c.id === cid);
          if (!target) return { ok: false, error: `Violation "${cid}" not found.` };
          const stu = await window.AppStorage.getStudentById(target.studentId);
          return {
            ok: true,
            cid,
            target,
            preview: {
              variant: 'danger',
              title: 'Delete Violation Record?',
              subtitle: stu ? `${stu.name} (${window.AppStorage.getClassLabel(stu.classId)} #${stu.rollNumber || '-'})` : cid,
              summaryLines: ['WARNING: Permanently deletes this violation entry and recalculates the student score.'],
              rows: [
                { label: `${target.severity} Violation`, before: target.text, after: 'DELETED' }
              ],
              confirmLabel: 'Delete Violation'
            }
          };
        },
        commit: async (prep) => {
          const allNow = await window.AppStorage.getComplaints();
          if (!allNow.some((c) => c.id === prep.cid)) {
            return { ok: false, staleData: true, error: 'Violation already removed before confirmation.' };
          }
          const res = await window.AppStorage.deleteComplaint(prep.cid);
          if (!res || !res.success) return { ok: false, error: 'Failed to delete violation.' };
          const checkAfter = (await window.AppStorage.getComplaints()).some((c) => c.id === prep.cid);
          if (checkAfter) return { ok: false, error: 'Verification failed: violation still exists.' };
          return {
            ok: true,
            verified: true,
            deletedComplaintId: prep.cid,
            toastMessage: 'Violation deleted.'
          };
        }
      };
    }

    if (toolName === 'add_homework') {
      return {
        prepare: async () => {
          const unsavedErr = ensureNoUnsavedConflict('homework');
          if (unsavedErr) return { ok: false, error: unsavedErr };

          const cid = normalizeClassSafe(args && args.classId);
          if (!cid) return { ok: false, error: `Invalid class "${String(args && args.classId)}".` };
          const subj = await resolveSubjectForClass(cid, args && args.subject);
          if (!subj) {
            const subs = await window.AppStorage.getSubjects(cid);
            return { ok: false, error: `Subject "${String(args && args.subject)}" not found in ${window.AppStorage.getClassLabel(cid)}. Available: ${subs.join(', ')}.` };
          }
          const teacher = window.AppStorage.normalizeText(args && args.teacherName);
          const desc = String((args && args.description) || '').trim();
          if (!teacher) return { ok: false, error: 'Teacher name is required.' };
          if (!desc) return { ok: false, error: 'Homework description is required.' };

          const students = await window.AppStorage.getStudentsByClass(cid);
          if (students.length === 0) return { ok: false, error: 'No students enrolled in this class.' };
          const stuMap = new Map(students.map((s) => [s.id, s]));

          const defDone = args.defaultHwDone !== undefined ? !!args.defaultHwDone : true;
          const defClear = args.defaultConceptClear !== undefined ? !!args.defaultConceptClear : true;
          const records = {};
          students.forEach((s) => {
            records[s.id] = { hwDone: defDone, conceptClear: defClear, conceptResolved: false };
          });

          const overrides = Array.isArray(args.studentOverrides) ? args.studentOverrides : [];
          const overrideRows = [];
          for (const ov of overrides) {
            const stu = ov && ov.studentId ? stuMap.get(ov.studentId) : null;
            if (!stu) return { ok: false, error: `Student "${ov && ov.studentId}" does not belong to ${window.AppStorage.getClassLabel(cid)}.` };
            const hwDone = ov.hwDone !== undefined ? !!ov.hwDone : records[stu.id].hwDone;
            const conceptClear = ov.conceptClear !== undefined ? !!ov.conceptClear : records[stu.id].conceptClear;
            records[stu.id] = { hwDone, conceptClear, conceptResolved: false };
            overrideRows.push({
              label: `${stu.name} (#${stu.rollNumber || '-'})`,
              before: 'Default',
              after: `${hwDone ? 'Done' : 'Not Done'} • ${conceptClear ? 'Clear' : 'Unclear (Pending)'}`
            });
          }

          const unclearCnt = Object.values(records).filter((r) => !r.conceptClear).length;
          const notDoneCnt = Object.values(records).filter((r) => !r.hwDone).length;

          return {
            ok: true,
            cid,
            subj,
            teacher,
            desc,
            records,
            preview: {
              variant: 'write',
              title: 'Confirm New Homework & Checklist',
              subtitle: `${window.AppStorage.getClassLabel(cid)} • ${subj} • Teacher: ${teacher}`,
              summaryLines: [
                `Assigns homework to all ${students.length} students (Default: ${defDone ? 'Done' : 'Not Done'} / ${defClear ? 'Clear' : 'Unclear'}).`,
                `Not Done: ${notDoneCnt} • Unclear Concepts (Pending Tasks): ${unclearCnt}`
              ],
              rows: [
                { label: 'Homework / Lesson', before: '-', after: desc },
                ...overrideRows.slice(0, 15)
              ],
              confirmLabel: 'Save Homework'
            }
          };
        },
        commit: async (prep) => {
          const hw = await window.AppStorage.addHomework({
            classId: prep.cid,
            subject: prep.subj,
            teacherName: prep.teacher,
            description: prep.desc,
            records: prep.records
          });
          const allAfter = await window.AppStorage.getHomeworks({ classId: prep.cid, subject: prep.subj });
          const readBack = allAfter.find((h) => h.id === hw.id);
          if (!readBack) return { ok: false, error: 'Read-back verification failed after saving homework.' };
          return {
            ok: true,
            verified: true,
            homeworkId: readBack.id,
            classId: readBack.classId,
            subject: readBack.subject,
            toastMessage: `Homework saved for ${window.AppStorage.getClassLabel(prep.cid)} (${prep.subj}).`
          };
        }
      };
    }

    if (toolName === 'update_homework_records') {
      return {
        prepare: async () => {
          const unsavedErr = ensureNoUnsavedConflict('homework');
          if (unsavedErr) return { ok: false, error: unsavedErr };

          const hwId = String((args && args.homeworkId) || '').trim();
          const changes = Array.isArray(args && args.changes) ? args.changes : [];
          if (!hwId || changes.length === 0) return { ok: false, error: 'homeworkId and at least one student change are required.' };

          const all = await window.AppStorage.getHomeworks();
          const hw = all.find((h) => h.id === hwId);
          if (!hw) return { ok: false, error: `Homework "${hwId}" not found.` };

          const students = await window.AppStorage.getStudentsByClass(hw.classId);
          const stuMap = new Map(students.map((s) => [s.id, s]));

          const payload = {};
          const diffRows = [];
          for (const ch of changes) {
            const stu = ch && ch.studentId ? stuMap.get(ch.studentId) : null;
            if (!stu) return { ok: false, error: `Student "${ch && ch.studentId}" does not belong to ${window.AppStorage.getClassLabel(hw.classId)}.` };
            const prev = (hw.records && hw.records[stu.id]) || { hwDone: false, conceptClear: false, conceptResolved: false };
            const nextHwDone = ch.hwDone !== undefined ? !!ch.hwDone : !!prev.hwDone;
            const nextClear = ch.conceptClear !== undefined ? !!ch.conceptClear : !!prev.conceptClear;
            if (nextHwDone === !!prev.hwDone && nextClear === !!prev.conceptClear && hw.records && hw.records[stu.id]) {
              continue;
            }
            const entry = { hwDone: nextHwDone, conceptClear: nextClear };
            if (!nextClear && !prev.conceptClear && prev.conceptResolved) {
              entry.conceptResolved = true;
              if (prev.resolvedAt) entry.resolvedAt = prev.resolvedAt;
            } else if (!nextClear) {
              entry.conceptResolved = false;
            }
            payload[stu.id] = entry;

            const fmt = (hd, cc, cr) => `${hd ? 'Done' : 'Not Done'} / ${cc ? 'Clear' : cr ? 'Cleared Later' : 'Unclear'}`;
            diffRows.push({
              label: `${stu.name} (#${stu.rollNumber || '-'})`,
              before: hw.records && hw.records[stu.id] ? fmt(prev.hwDone, prev.conceptClear, prev.conceptResolved) : 'Unmarked',
              after: fmt(nextHwDone, nextClear, entry.conceptResolved)
            });
          }

          if (Object.keys(payload).length === 0) {
            return { ok: true, noChange: true, message: 'All specified student homework statuses already match.' };
          }

          return {
            ok: true,
            hwId,
            payload,
            baseFingerprint: String(hw.updatedAt || hw.createdAt),
            preview: {
              variant: 'write',
              title: 'Confirm Homework Checklist Update',
              subtitle: `${window.AppStorage.getClassLabel(hw.classId)} • ${hw.subject}`,
              summaryLines: [
                `Homework: "${hw.description}"`,
                `Updates ${diffRows.length} student(s) while preserving untouched flags and unrelated students.`
              ],
              rows: diffRows.slice(0, 20),
              confirmLabel: 'Update Checklist'
            }
          };
        },
        commit: async (prep) => {
          const current = (await window.AppStorage.getHomeworks()).find((h) => h.id === prep.hwId);
          if (!current || String(current.updatedAt || current.createdAt) !== prep.baseFingerprint) {
            return { ok: false, staleData: true, error: 'Homework changed before confirmation. Please retry.' };
          }
          await window.AppStorage.updateHomeworkRecords(prep.hwId, prep.payload);
          const after = (await window.AppStorage.getHomeworks()).find((h) => h.id === prep.hwId);
          if (!after) return { ok: false, error: 'Homework missing on read-back.' };
          for (const [sid, expected] of Object.entries(prep.payload)) {
            const actual = after.records && after.records[sid];
            if (!actual || !!actual.hwDone !== !!expected.hwDone || !!actual.conceptClear !== !!expected.conceptClear) {
              return { ok: false, error: 'Homework checklist verification failed after save.' };
            }
          }
          return {
            ok: true,
            verified: true,
            homeworkId: after.id,
            updatedCount: Object.keys(prep.payload).length,
            toastMessage: 'Homework checklist updated.'
          };
        }
      };
    }

    if (toolName === 'resolve_pending_task' || toolName === 'reopen_pending_task') {
      const resolving = toolName === 'resolve_pending_task';
      return {
        prepare: async () => {
          const hwId = String((args && args.homeworkId) || '').trim();
          const sid = String((args && args.studentId) || '').trim();
          const hw = (await window.AppStorage.getHomeworks()).find((h) => h.id === hwId);
          if (!hw || !hw.records || !hw.records[sid]) {
            return { ok: false, error: 'Pending task entry not found for that homework and student.' };
          }
          const stu = await window.AppStorage.getStudentById(sid);
          const rec = hw.records[sid];
          if (rec.conceptClear) {
            return { ok: false, error: `${stu ? stu.name : sid}'s concept for this homework is already marked Clear.` };
          }
          if (resolving && rec.conceptResolved) {
            return { ok: true, noChange: true, message: 'This pending task is already marked Cleared.' };
          }
          if (!resolving && !rec.conceptResolved) {
            return { ok: true, noChange: true, message: 'This pending task is already Active Pending.' };
          }
          return {
            ok: true,
            hwId,
            sid,
            stu,
            hw,
            prevResolved: !!rec.conceptResolved,
            preview: {
              variant: 'write',
              title: resolving ? 'Confirm Clear Pending Task' : 'Confirm Reopen Pending Task',
              subtitle: `${stu ? stu.name : sid} (${window.AppStorage.getClassLabel(hw.classId)}) • ${hw.subject}`,
              summaryLines: [`Homework: "${hw.description}"`],
              rows: [{
                label: 'Concept Status',
                before: rec.conceptResolved ? 'Cleared Later' : 'Unclear (Active Pending)',
                after: resolving ? 'Cleared Later' : 'Unclear (Active Pending)'
              }],
              confirmLabel: resolving ? 'Mark Cleared' : 'Reopen Task'
            }
          };
        },
        commit: async (prep) => {
          const cur = (await window.AppStorage.getHomeworks()).find((h) => h.id === prep.hwId);
          const curRec = cur && cur.records && cur.records[prep.sid];
          if (!curRec || curRec.conceptClear || !!curRec.conceptResolved !== prep.prevResolved) {
            return { ok: false, staleData: true, error: 'Task state changed before confirmation. Please retry.' };
          }
          const ok = resolving
            ? await window.AppStorage.resolvePendingTask(prep.hwId, prep.sid)
            : await window.AppStorage.reopenPendingTask(prep.hwId, prep.sid);
          if (!ok) {
            return { ok: false, error: 'Task update failed: record not found in storage.' };
          }
          const after = (await window.AppStorage.getHomeworks()).find((h) => h.id === prep.hwId);
          const afterRec = after && after.records && after.records[prep.sid];
          if (!afterRec || !!afterRec.conceptResolved !== resolving) {
            return { ok: false, error: 'Read-back verification failed after updating pending task.' };
          }
          return {
            ok: true,
            verified: true,
            homeworkId: prep.hwId,
            studentId: prep.sid,
            conceptResolved: resolving,
            toastMessage: resolving ? 'Pending concept task cleared!' : 'Task moved back to Active Pending.'
          };
        }
      };
    }

    if (toolName === 'delete_homework') {
      return {
        prepare: async () => {
          const unsavedErr = ensureNoUnsavedConflict('homework');
          if (unsavedErr) return { ok: false, error: unsavedErr };
          const hwId = String((args && args.homeworkId) || '').trim();
          const hw = (await window.AppStorage.getHomeworks()).find((h) => h.id === hwId);
          if (!hw) return { ok: false, error: `Homework "${hwId}" not found.` };
          return {
            ok: true,
            hwId,
            baseFingerprint: String(hw.updatedAt || hw.createdAt || ''),
            preview: {
              variant: 'danger',
              title: 'Delete Homework Assignment?',
              subtitle: `${window.AppStorage.getClassLabel(hw.classId)} • ${hw.subject}`,
              summaryLines: ['WARNING: Permanently deletes this homework and its student checklist records.'],
              rows: [{ label: hw.subject, before: hw.description, after: 'DELETED' }],
              confirmLabel: 'Delete Homework'
            }
          };
        },
        commit: async (prep) => {
          const cur = (await window.AppStorage.getHomeworks()).find((h) => h.id === prep.hwId);
          if (!cur || String(cur.updatedAt || cur.createdAt || '') !== prep.baseFingerprint) {
            return { ok: false, staleData: true, error: 'Homework changed or already removed before confirmation. Please retry.' };
          }
          const res = await window.AppStorage.deleteHomework(prep.hwId);
          if (!res || !res.success) return { ok: false, error: 'Homework not found or delete failed.' };
          const exists = (await window.AppStorage.getHomeworks()).some((h) => h.id === prep.hwId);
          if (exists) return { ok: false, error: 'Homework still present on read-back check.' };
          return { ok: true, verified: true, deletedHomeworkId: prep.hwId, toastMessage: 'Homework deleted.' };
        }
      };
    }

    if (toolName === 'create_test') {
      return {
        prepare: async () => {
          const name = window.AppStorage.normalizeText(args && args.name);
          if (!name) return { ok: false, error: 'Test name is required.' };
          const defTot = (args && args.defaultTotalMarks !== undefined && args.defaultTotalMarks !== null)
            ? Number(args.defaultTotalMarks)
            : 100;
          if (!Number.isFinite(defTot) || defTot <= 0) {
            return { ok: false, error: 'defaultTotalMarks must be a finite number greater than 0.' };
          }
          return {
            ok: true,
            name,
            defTot,
            preview: {
              variant: 'write',
              title: 'Confirm Create Monthly Test',
              subtitle: name,
              summaryLines: [`Creates a new Monthly Test box with default max marks = ${defTot}.`],
              rows: [{ label: 'New Test Box', before: '-', after: `${name} (Max ${defTot})` }],
              confirmLabel: 'Create Test'
            }
          };
        },
        commit: async (prep) => {
          const test = await window.AppStorage.createTest({ name: prep.name, defaultTotalMarks: prep.defTot });
          const readBack = (await window.AppStorage.getTests()).find((t) => t.id === test.id);
          if (!readBack) return { ok: false, error: 'Created test not found during read-back.' };
          return {
            ok: true,
            verified: true,
            testId: readBack.id,
            name: readBack.name,
            defaultTotalMarks: readBack.defaultTotalMarks,
            toastMessage: `Monthly test "${readBack.name}" created!`
          };
        }
      };
    }

    if (toolName === 'delete_test') {
      return {
        prepare: async () => {
          const unsavedErr = ensureNoUnsavedConflict('tests');
          if (unsavedErr) return { ok: false, error: unsavedErr };
          const tid = String((args && args.testId) || '').trim();
          const test = (await window.AppStorage.getTests()).find((t) => t.id === tid);
          if (!test) return { ok: false, error: `Test "${tid}" not found.` };
          const subjCount = test.marks ? Object.keys(test.marks).length : 0;
          return {
            ok: true,
            tid,
            preview: {
              variant: 'danger',
              title: 'Delete Monthly Test?',
              subtitle: test.name,
              summaryLines: [`WARNING: Permanently deletes "${test.name}" and marks across ${subjCount} subject(s).`],
              rows: [{ label: test.name, before: `${subjCount} graded subject(s)`, after: 'DELETED' }],
              confirmLabel: 'Delete Test'
            }
          };
        },
        commit: async (prep) => {
          const existsBefore = (await window.AppStorage.getTests()).some((t) => t.id === prep.tid);
          if (!existsBefore) return { ok: false, staleData: true, error: 'Test already missing before confirmation.' };
          await window.AppStorage.deleteTest(prep.tid);
          const existsAfter = (await window.AppStorage.getTests()).some((t) => t.id === prep.tid);
          if (existsAfter) return { ok: false, error: 'Test still exists after delete.' };
          return { ok: true, verified: true, deletedTestId: prep.tid, toastMessage: 'Monthly test deleted.' };
        }
      };
    }

    if (toolName === 'set_test_marks') {
      return {
        prepare: async () => {
          const cid = normalizeClassSafe(args && args.classId);
          if (!cid) return { ok: false, error: `Invalid class "${String(args && args.classId)}".` };
          const unsavedErr = ensureNoUnsavedConflict('tests', { classId: cid });
          if (unsavedErr) return { ok: false, error: unsavedErr };

          const tid = String((args && args.testId) || '').trim();
          const test = (await window.AppStorage.getTests()).find((t) => t.id === tid);
          if (!test) return { ok: false, error: `Monthly test "${tid}" not found.` };

          const resolvedSubj = await resolveSubjectForClass(cid, args && args.subject);
          if (!resolvedSubj) {
            const subs = await window.AppStorage.getSubjects(cid);
            return { ok: false, error: `Subject "${String(args && args.subject)}" not found in ${window.AppStorage.getClassLabel(cid)}. Available: ${subs.join(', ')}.` };
          }

          const key = `${cid}|${resolvedSubj}`;
          const oldMarks = (test.marks && test.marks[key]) ? { ...test.marks[key] } : {};
          const oldTotal = (test.subjectTotals && test.subjectTotals[key]) || test.defaultTotalMarks || 100;
          const oldDate = (test.subjectDates && test.subjectDates[key]) || null;

          const nextTotal = (args.totalMarks !== undefined && args.totalMarks !== null && String(args.totalMarks).trim() !== '')
            ? Number(args.totalMarks)
            : oldTotal;
          if (!Number.isFinite(nextTotal) || nextTotal <= 0) {
            return { ok: false, error: 'totalMarks must be a finite number greater than 0.' };
          }

          let nextDate = oldDate;
          if (args.testDate !== undefined && args.testDate !== null && String(args.testDate).trim() !== '') {
            const dtStr = String(args.testDate).trim();
            if (!window.AppStorage.isValidYmdDate(dtStr)) {
              return { ok: false, error: `Invalid testDate "${dtStr}". Use YYYY-MM-DD.` };
            }
            nextDate = dtStr;
          }

          const entries = Array.isArray(args.marks) ? args.marks : [];
          if (entries.length === 0) return { ok: false, error: 'At least one student mark entry is required.' };

          const students = await window.AppStorage.getStudentsByClass(cid);
          const stuMap = new Map(students.map((s) => [s.id, s]));
          const mergedMarks = { ...oldMarks };
          const diffRows = [];

          for (const mItem of entries) {
            const stu = mItem && mItem.studentId ? stuMap.get(mItem.studentId) : null;
            if (!stu) {
              return { ok: false, error: `Student "${mItem && mItem.studentId}" does not belong to ${window.AppStorage.getClassLabel(cid)}.` };
            }
            const oldVal = oldMarks[stu.id] !== undefined ? oldMarks[stu.id] : 'Blank';
            if (mItem.clearMark === true || mItem.obtained === null || mItem.obtained === undefined || mItem.obtained === '') {
              delete mergedMarks[stu.id];
              if (oldVal !== 'Blank') {
                diffRows.push({ label: `${stu.name} (#${stu.rollNumber || '-'})`, before: String(oldVal), after: 'Blank' });
              }
            } else {
              const num = Number(mItem.obtained);
              if (!Number.isFinite(num) || num < 0 || num > nextTotal) {
                return {
                  ok: false,
                  error: `Invalid marks (${mItem.obtained}) for ${stu.name}. Obtained marks must be between 0 and ${nextTotal}.`
                };
              }
              mergedMarks[stu.id] = num;
              diffRows.push({
                label: `${stu.name} (#${stu.rollNumber || '-'})`,
                before: oldVal === 'Blank' ? 'Blank' : `${oldVal}/${oldTotal}`,
                after: `${num}/${nextTotal}`
              });
            }
          }

          for (const [sid, val] of Object.entries(mergedMarks)) {
            if (Number(val) > nextTotal) {
              const st = stuMap.get(sid);
              return {
                ok: false,
                error: `Cannot set totalMarks to ${nextTotal}: existing score for ${st ? st.name : sid} is ${val}.`
              };
            }
          }

          if (diffRows.length === 0 && nextTotal === oldTotal && nextDate === oldDate) {
            return { ok: true, noChange: true, message: 'Test marks already match saved values.' };
          }

          return {
            ok: true,
            tid,
            cid,
            resolvedSubj,
            key,
            nextTotal,
            nextDate,
            entries,
            baseFingerprint: JSON.stringify({ total: oldTotal, date: oldDate, marks: oldMarks }),
            preview: {
              variant: 'write',
              title: 'Confirm Monthly Test Marks',
              subtitle: `${test.name} • ${window.AppStorage.getClassLabel(cid)} • ${resolvedSubj}`,
              summaryLines: [
                `Total Marks: ${nextTotal}${nextDate ? ` • Test Date: ${nextDate}` : ''}`,
                `Updates ${diffRows.length} student(s) while preserving all other saved scores, total, and date.`
              ],
              rows: diffRows.slice(0, 20),
              confirmLabel: 'Save Marks'
            }
          };
        },
        commit: async (prep) => {
          const curTest = (await window.AppStorage.getTests()).find((t) => t.id === prep.tid);
          if (!curTest) return { ok: false, staleData: true, error: 'Test missing before confirmation.' };
          const curMarks = (curTest.marks && curTest.marks[prep.key]) ? { ...curTest.marks[prep.key] } : {};
          const curTotal = (curTest.subjectTotals && curTest.subjectTotals[prep.key]) || curTest.defaultTotalMarks || 100;
          const curDate = (curTest.subjectDates && curTest.subjectDates[prep.key]) || null;
          if (JSON.stringify({ total: curTotal, date: curDate, marks: curMarks }) !== prep.baseFingerprint) {
            return { ok: false, staleData: true, error: 'Marks changed before confirmation. Please retry.' };
          }

          const recomputed = { ...curMarks };
          prep.entries.forEach((mItem) => {
            if (mItem.clearMark === true || mItem.obtained === null || mItem.obtained === undefined || mItem.obtained === '') {
              delete recomputed[mItem.studentId];
            } else {
              recomputed[mItem.studentId] = Number(mItem.obtained);
            }
          });

          await window.AppStorage.saveSubjectTestMarks(
            prep.tid,
            prep.cid,
            prep.resolvedSubj,
            prep.nextTotal,
            recomputed,
            prep.nextDate
          );

          const afterTest = (await window.AppStorage.getTests()).find((t) => t.id === prep.tid);
          const afterMarks = afterTest && afterTest.marks && afterTest.marks[prep.key];
          const afterTotal = afterTest && afterTest.subjectTotals && afterTest.subjectTotals[prep.key];
          const afterDate = (afterTest && afterTest.subjectDates && afterTest.subjectDates[prep.key]) || null;
          if (!afterTest || afterTotal !== prep.nextTotal || afterDate !== (prep.nextDate || null)) {
            return { ok: false, error: 'Test marks verification mismatch on total or date.' };
          }
          for (const [sid, val] of Object.entries(recomputed)) {
            if (!afterMarks || afterMarks[sid] !== val) {
              return { ok: false, error: 'Test marks read-back verification mismatch.' };
            }
          }

          return {
            ok: true,
            verified: true,
            testId: prep.tid,
            classId: prep.cid,
            subject: prep.resolvedSubj,
            totalMarks: afterTotal,
            testDate: afterDate,
            updatedCount: prep.entries.length,
            totalGradedInSubject: Object.keys(afterMarks || {}).length,
            toastMessage: `Marks saved for ${prep.resolvedSubj} (${window.AppStorage.getClassLabel(prep.cid)}).`
          };
        }
      };
    }

    if (toolName === 'add_subject') {
      return {
        prepare: async () => {
          const cid = normalizeClassSafe(args && args.classId);
          if (!cid) return { ok: false, error: `Invalid class "${String(args && args.classId)}".` };
          const clean = window.AppStorage.normalizeText(args && args.subjectName);
          if (!clean) return { ok: false, error: 'Subject name is required.' };
          const current = await window.AppStorage.getSubjects(cid);
          if (current.some((s) => s.toLowerCase() === clean.toLowerCase())) {
            return { ok: true, noChange: true, message: `"${clean}" already exists in ${window.AppStorage.getClassLabel(cid)}.` };
          }
          return {
            ok: true,
            cid,
            clean,
            preview: {
              variant: 'write',
              title: 'Confirm Add Subject',
              subtitle: `${window.AppStorage.getClassLabel(cid)}`,
              summaryLines: [`Adds "${clean}" to ${window.AppStorage.getClassLabel(cid)} subject list.`],
              rows: [{ label: 'New Subject', before: '-', after: clean }],
              confirmLabel: 'Add Subject'
            }
          };
        },
        commit: async (prep) => {
          const updated = await window.AppStorage.addSubject(prep.cid, prep.clean);
          if (!updated.includes(prep.clean)) return { ok: false, error: 'Subject read-back failed.' };
          return {
            ok: true,
            verified: true,
            classId: prep.cid,
            subjects: updated,
            toastMessage: `Added subject "${prep.clean}" to ${window.AppStorage.getClassLabel(prep.cid)}.`
          };
        }
      };
    }

    if (toolName === 'add_health_record') {
      return {
        prepare: async () => {
          const unsavedErr = ensureNoUnsavedConflict('health');
          if (unsavedErr) return { ok: false, error: unsavedErr };
          const stu = await window.AppStorage.getStudentById(args && args.studentId);
          if (!stu) return { ok: false, error: 'Student not found. Resolve student with find_students first.' };
          const sup = window.AppStorage.normalizeText(args && args.supervisorTeacher);
          const doc = window.AppStorage.normalizeText(args && args.doctorOrHospital);
          const disease = String((args && args.disease) || '').trim();
          if (!sup || !doc || !disease) {
            return { ok: false, error: 'supervisorTeacher, doctorOrHospital, and disease are required.' };
          }
          const cid = window.AppStorage.normalizeClassId(stu.classId || stu.className);
          return {
            ok: true,
            stu,
            cid,
            sup,
            supPhone: window.AppStorage.normalizeText(args && args.supervisorPhone),
            doc,
            disease,
            preview: {
              variant: 'write',
              title: 'Confirm Medical / Health Visit',
              subtitle: `${stu.name} (${window.AppStorage.getClassLabel(cid)} • Roll #${stu.rollNumber || '-'})`,
              summaryLines: [`Father: ${stu.family || '-'} • Date: ${window.AppStorage.getLocalTodayDate()}`],
              rows: [
                { label: 'Disease / Issue', before: '-', after: disease },
                { label: 'Doctor / Hospital', before: '-', after: doc },
                { label: 'Supervisor Teacher', before: '-', after: sup }
              ],
              confirmLabel: 'Save Medical Record'
            }
          };
        },
        commit: async (prep) => {
          const res = await window.AppStorage.addHealthRecord({
            studentId: prep.stu.id,
            studentName: prep.stu.name,
            classId: prep.cid,
            fatherName: prep.stu.family && prep.stu.family !== '-' ? prep.stu.family : '',
            phone: prep.stu.phone && prep.stu.phone !== '-' ? prep.stu.phone : (prep.stu.whatsapp || ''),
            supervisorTeacher: prep.sup,
            supervisorPhone: prep.supPhone,
            doctorOrHospital: prep.doc,
            disease: prep.disease,
            allowCreateCustom: false
          });
          const list = await window.AppStorage.getHealthRecords({ studentId: prep.stu.id });
          const verified = list.find((r) => r.id === res.record.id);
          if (!verified) return { ok: false, error: 'Health record verification failed on read-back.' };
          return {
            ok: true,
            verified: true,
            recordId: verified.id,
            student: compactStudentRef(prep.stu),
            visitDate: verified.visitDate,
            toastMessage: `Medical record saved for ${prep.stu.name}.`
          };
        }
      };
    }

    if (toolName === 'delete_health_record') {
      return {
        prepare: async () => {
          const rid = String((args && args.recordId) || '').trim();
          const list = await window.AppStorage.getHealthRecords();
          const rec = list.find((r) => r.id === rid);
          if (!rec) return { ok: false, error: `Health record "${rid}" not found.` };
          return {
            ok: true,
            rid,
            preview: {
              variant: 'danger',
              title: 'Delete Medical Record?',
              subtitle: `${rec.studentName} (${window.AppStorage.getClassLabel(rec.classId)}) • ${rec.visitDate}`,
              summaryLines: ['WARNING: Permanently deletes this medical visit record.'],
              rows: [{ label: rec.doctorOrHospital, before: rec.disease, after: 'DELETED' }],
              confirmLabel: 'Delete Record'
            }
          };
        },
        commit: async (prep) => {
          const stillPresentBefore = (await window.AppStorage.getHealthRecords()).some((r) => r.id === prep.rid);
          if (!stillPresentBefore) {
            return { ok: false, staleData: true, error: 'Medical record already removed before confirmation.' };
          }
          await window.AppStorage.deleteHealthRecord(prep.rid);
          const stillThere = (await window.AppStorage.getHealthRecords()).some((r) => r.id === prep.rid);
          if (stillThere) return { ok: false, error: 'Health record still exists after delete.' };
          return { ok: true, verified: true, deletedRecordId: prep.rid, toastMessage: 'Medical record deleted.' };
        }
      };
    }

    return null;
  }

  const WRITE_TOOL_NAMES = new Set([
    'set_class_attendance',
    'set_prep_attendance',
    'delete_attendance_session',
    'add_violation',
    'delete_violation',
    'add_homework',
    'update_homework_records',
    'resolve_pending_task',
    'reopen_pending_task',
    'delete_homework',
    'create_test',
    'delete_test',
    'set_test_marks',
    'add_subject',
    'add_health_record',
    'delete_health_record'
  ]);

  function isWriteTool(name) {
    return WRITE_TOOL_NAMES.has(name);
  }

  function buildCombinedPreview(pendingItems) {
    if (pendingItems.length === 1) {
      return pendingItems[0].prep.preview;
    }
    const anyDanger = pendingItems.some((p) => p.prep.preview && p.prep.preview.variant === 'danger');
    const summaryLines = [];
    const combinedRows = [];
    let hiddenExtra = 0;

    pendingItems.forEach((p, idx) => {
      const pv = p.prep.preview || {};
      summaryLines.push(`${idx + 1}. ${pv.title || p.call.name}${pv.subtitle ? ` (${pv.subtitle})` : ''}`);
      hiddenExtra += Number(pv.extraRowsCount || 0);
      const itemRows = Array.isArray(pv.rows) ? pv.rows : [];
      itemRows.forEach((r) => {
        combinedRows.push({
          label: `#${idx + 1} ${r.label}`,
          before: r.before,
          after: r.after
        });
      });
    });

    const cappedRows = combinedRows.slice(0, 25);
    const extraRowsCount = hiddenExtra + Math.max(0, combinedRows.length - 25);
    return {
      variant: anyDanger ? 'danger' : 'write',
      title: anyDanger ? `Confirm ${pendingItems.length} Actions (Includes Delete)` : `Confirm ${pendingItems.length} Changes`,
      subtitle: 'Review all queued changes before saving to storage',
      summaryLines,
      rows: cappedRows,
      extraRowsCount,
      confirmLabel: anyDanger ? `Confirm All ${pendingItems.length} Actions` : `Confirm All (${pendingItems.length})`
    };
  }

  async function executeWriteBatch(calls, requestConfirmation) {
    const list = Array.isArray(calls) ? calls : [];
    const results = new Array(list.length);
    const pending = [];

    for (let i = 0; i < list.length; i++) {
      const call = list[i] || {};
      const spec = buildWriteSpec(call.name, call.args || {});
      if (!spec) {
        results[i] = { ok: false, error: `Unknown write tool "${String(call.name)}".` };
        continue;
      }
      let prep;
      try {
        prep = await spec.prepare();
      } catch (err) {
        results[i] = { ok: false, error: err && err.message ? err.message : 'Prepare failed.' };
        continue;
      }
      if (!prep || prep.ok === false) {
        results[i] = prep || { ok: false, error: 'Validation failed.' };
        continue;
      }
      if (prep.noChange) {
        results[i] = { ok: true, noChange: true, message: prep.message || 'No changes required; stored data already matches.' };
        continue;
      }
      pending.push({ index: i, call, spec, prep });
    }

    if (pending.length === 0) {
      return list.map((c, idx) => ({ callId: c.callId, name: c.name, result: results[idx] }));
    }

    if (typeof requestConfirmation !== 'function') {
      pending.forEach((p) => {
        results[p.index] = { ok: false, error: 'Confirmation handler unavailable.' };
      });
      return list.map((c, idx) => ({ callId: c.callId, name: c.name, result: results[idx] }));
    }

    const preview = buildCombinedPreview(pending);
    let approved = false;
    try {
      approved = !!(await requestConfirmation(preview));
    } catch {
      approved = false;
    }

    if (!approved) {
      pending.forEach((p) => {
        results[p.index] = { ok: false, cancelledByUser: true };
      });
      return list.map((c, idx) => ({ callId: c.callId, name: c.name, result: results[idx] }));
    }

    const successToasts = [];
    let failedCount = 0;
    for (const p of pending) {
      let res;
      try {
        res = await p.spec.commit(p.prep);
      } catch (err) {
        res = {
          ok: false,
          error: err && err.message ? err.message : 'Unable to save changes to browser storage.'
        };
      }
      if (!res || res.ok === false) {
        failedCount++;
        results[p.index] = res || { ok: false, error: 'Write operation failed.' };
      } else {
        if (res.toastMessage) successToasts.push(res.toastMessage);
        const { toastMessage, ...cleanResult } = res;
        results[p.index] = cleanResult;
      }
    }

    if (successToasts.length > 0 && window.PortalBridge && typeof window.PortalBridge.refreshAll === 'function') {
      await window.PortalBridge.refreshAll();
    }
    if (window.PortalBridge && typeof window.PortalBridge.showToast === 'function') {
      if (successToasts.length > 0 && failedCount === 0) {
        const msg = successToasts.length === 1 ? successToasts[0] : `Saved ${successToasts.length} changes.`;
        window.PortalBridge.showToast(msg, 'success');
      } else if (successToasts.length > 0 && failedCount > 0) {
        window.PortalBridge.showToast(`${successToasts.length} saved, ${failedCount} failed.`, 'warning');
      }
    }

    return list.map((c, idx) => ({ callId: c.callId, name: c.name, result: results[idx] }));
  }

  async function executeWriteTool(toolName, args, requestConfirmation) {
    const out = await executeWriteBatch([{ callId: null, name: toolName, args: args || {} }], requestConfirmation);
    return (out[0] && out[0].result) || { ok: false, error: 'Operation failed.' };
  }

  /* ========================================================================
     Unified Dispatch
     ======================================================================== */
  async function executeTool(name, rawArgs, hooks = {}) {
    const args = rawArgs && typeof rawArgs === 'object' ? rawArgs : {};
    try {
      switch (name) {
        case 'find_students': return await findStudentsTool(args);
        case 'get_school_overview': return await execGetSchoolOverview();
        case 'list_classes_subjects': return await execListClassesSubjects(args);
        case 'get_attendance': return await execGetAttendance(args);
        case 'get_student_profile': return await execGetStudentProfile(args);
        case 'get_student_grand_report': return await execGetStudentGrandReport(args);
        case 'get_student_attendance': return await execGetStudentAttendance(args);
        case 'get_violations': return await execGetViolations(args);
        case 'get_homework': return await execGetHomework(args);
        case 'get_pending_tasks': return await execGetPendingTasks(args);
        case 'get_tests': return await execGetTests();
        case 'get_test_marks': return await execGetTestMarks(args);
        case 'get_student_test_results': return await execGetStudentTestResults(args);
        case 'rank_students': return await execRankStudents(args);
        case 'get_health_records': return await execGetHealthRecords(args);

        case 'open_screen': {
          const validScreens = new Set([
            'home', 'violations', 'homework', 'class-attendance',
            'prep-attendance', 'health', 'student-details', 'tests', 'grand-report'
          ]);
          if (!validScreens.has(args.screen)) {
            return { ok: false, error: `Unknown screen "${String(args.screen)}".` };
          }
          if (!window.PortalBridge) {
            return { ok: false, error: 'Portal navigation bridge unavailable.' };
          }
          if (args.screen === 'grand-report' && args.studentId) {
            const stu = await window.AppStorage.getStudentById(args.studentId);
            if (!stu) return { ok: false, error: 'Student not found for Grand Report.' };
            await window.PortalBridge.openGrandReport(stu.id);
            return { ok: true, navigatedTo: 'grand-report', student: compactStudentRef(stu) };
          }
          if (args.screen === 'student-details' && args.studentId) {
            const stu = await window.AppStorage.getStudentById(args.studentId);
            if (!stu) return { ok: false, error: 'Student not found for Student Detail.' };
            await window.PortalBridge.openStudentDetail(stu.id);
            return { ok: true, navigatedTo: 'student-details', student: compactStudentRef(stu) };
          }
          window.PortalBridge.switchScreen(args.screen);
          return { ok: true, navigatedTo: args.screen };
        }

        case 'set_class_attendance':
        case 'set_prep_attendance':
        case 'delete_attendance_session':
        case 'add_violation':
        case 'delete_violation':
        case 'add_homework':
        case 'update_homework_records':
        case 'resolve_pending_task':
        case 'reopen_pending_task':
        case 'delete_homework':
        case 'create_test':
        case 'delete_test':
        case 'set_test_marks':
        case 'add_subject':
        case 'add_health_record':
        case 'delete_health_record':
          return await executeWriteTool(name, args, hooks.requestConfirmation);

        default:
          return { ok: false, error: `Unknown tool "${String(name)}".` };
      }
    } catch (err) {
      return {
        ok: false,
        error: err && err.message ? err.message : 'Unexpected tool execution failure.'
      };
    }
  }

  window.AssistantTools = {
    FUNCTION_DECLARATIONS,
    findStudents: findStudentsTool,
    isWriteTool,
    executeTool,
    executeWriteBatch
  };
})(window);

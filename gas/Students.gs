/**
 * Students.gs — Student CRUD Operations
 */

// ─── ID GENERATION ────────────────────────────────────────────────────────
function generateStudentId() {
  var sheet = getSheet(SHEETS.STUDENTS);
  var data = sheet.getDataRange().getValues();

  if (data.length < 2) return 'ST0001';

  var ids = data.slice(1)
    .map(function(r) { return r[0]; })
    .filter(function(id) { return /^ST\d+$/.test(id); })
    .map(function(id) { return parseInt(id.replace('ST', ''), 10); });

  var max = ids.length > 0 ? Math.max.apply(null, ids) : 0;
  return 'ST' + String(max + 1).padStart(4, '0');
}

// ─── GET STUDENTS ─────────────────────────────────────────────────────────
function getStudents(params) {
  var sheet = getSheet(SHEETS.STUDENTS);
  var rows = sheetToObjects(sheet);

  // Remove passwords from response
  rows = rows.map(function(r) {
    var safe = Object.assign({}, r);
    delete safe['Password'];
    return safe;
  });

  // Search
  var search = (params.search || '').toLowerCase();
  if (search) {
    rows = rows.filter(function(r) {
      return (r['Student ID'] || '').toLowerCase().includes(search) ||
             (r['Full Name'] || '').toLowerCase().includes(search) ||
             (r['Email'] || '').toLowerCase().includes(search) ||
             (r['Mobile'] || '').toString().includes(search) ||
             (r['Class'] || '').toLowerCase().includes(search);
    });
  }

  // Filter by status
  if (params.status && params.status !== 'all') {
    rows = rows.filter(function(r) { return r['Status'] === params.status; });
  }

  // Filter by class
  if (params.class && params.class !== 'all') {
    rows = rows.filter(function(r) { return r['Class'] === params.class; });
  }

  // Filter by gender
  if (params.gender && params.gender !== 'all') {
    rows = rows.filter(function(r) { return r['Gender'] === params.gender; });
  }

  // Pagination
  var page = parseInt(params.page || '1');
  var limit = parseInt(params.limit || '20');
  var total = rows.length;
  var start = (page - 1) * limit;
  var paged = rows.slice(start, start + limit);

  return success({
    students: paged,
    total: total,
    page: page,
    limit: limit,
    pages: Math.ceil(total / limit)
  });
}

function getStudent(studentId) {
  if (!studentId) return error('Student ID required');

  var sheet = getSheet(SHEETS.STUDENTS);
  var rows = sheetToObjects(sheet);
  var student = rows.find(function(r) { return r['Student ID'] === studentId; });

  if (!student) return error('Student not found', 404);

  var safe = Object.assign({}, student);
  delete safe['Password'];
  return success(safe);
}

// ─── ADD STUDENT ──────────────────────────────────────────────────────────
function addStudent(studentData) {
  if (!studentData) return error('Student data required');
  if (!studentData['Full Name']) return error('Full Name is required');

  var sheet = getSheet(SHEETS.STUDENTS);
  var studentId = generateStudentId();
  var plainPassword = generatePassword();
  var hashedPassword = hashPassword(plainPassword);
  var now = new Date();

  var row = [
    studentId,
    studentData['Full Name'] || '',
    studentData['Class'] || '',
    studentData['Section'] || '',
    studentData['Roll Number'] || '',
    studentData['Gender'] || '',
    studentData['Date of Birth'] || '',
    studentData['Parent Name'] || '',
    studentData['Mobile'] || '',
    studentData['Email'] || '',
    hashedPassword,
    studentData['Admission Date'] || Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    'Active',
    '',   // Last Login
    now,  // Created Date
    now,  // Updated Date
    studentData['Remarks'] || ''
  ];

  sheet.appendRow(row);

  // Send welcome email
  if (studentData['Email']) {
    sendWelcomeEmail(
      studentData['Email'],
      studentData['Full Name'],
      studentId,
      plainPassword
    );
  }

  return success({
    studentId: studentId,
    password: plainPassword,
    name: studentData['Full Name']
  }, 'Student added successfully');
}

// ─── UPDATE STUDENT ───────────────────────────────────────────────────────
function updateStudent(studentData) {
  if (!studentData || !studentData['Student ID']) return error('Student ID required');

  var sheet = getSheet(SHEETS.STUDENTS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === studentData['Student ID']) {
      var row = i + 1;
      var now = new Date();

      // Update only non-sensitive fields
      if (studentData['Full Name'] !== undefined) sheet.getRange(row, 2).setValue(studentData['Full Name']);
      if (studentData['Class'] !== undefined) sheet.getRange(row, 3).setValue(studentData['Class']);
      if (studentData['Section'] !== undefined) sheet.getRange(row, 4).setValue(studentData['Section']);
      if (studentData['Roll Number'] !== undefined) sheet.getRange(row, 5).setValue(studentData['Roll Number']);
      if (studentData['Gender'] !== undefined) sheet.getRange(row, 6).setValue(studentData['Gender']);
      if (studentData['Date of Birth'] !== undefined) sheet.getRange(row, 7).setValue(studentData['Date of Birth']);
      if (studentData['Parent Name'] !== undefined) sheet.getRange(row, 8).setValue(studentData['Parent Name']);
      if (studentData['Mobile'] !== undefined) sheet.getRange(row, 9).setValue(studentData['Mobile']);
      if (studentData['Email'] !== undefined) sheet.getRange(row, 10).setValue(studentData['Email']);
      if (studentData['Admission Date'] !== undefined) sheet.getRange(row, 12).setValue(studentData['Admission Date']);
      if (studentData['Status'] !== undefined) sheet.getRange(row, 13).setValue(studentData['Status']);
      if (studentData['Remarks'] !== undefined) sheet.getRange(row, 17).setValue(studentData['Remarks']);

      sheet.getRange(row, 16).setValue(now); // Updated Date
      return success(null, 'Student updated successfully');
    }
  }
  return error('Student not found', 404);
}

function updateStudentProfile(studentId, profile) {
  if (!studentId || !profile) return error('Student ID and profile data required');

  var allowedFields = ['Full Name', 'Mobile', 'Parent Name', 'Remarks'];
  var filtered = {};
  allowedFields.forEach(function(f) {
    if (profile[f] !== undefined) filtered[f] = profile[f];
  });
  filtered['Student ID'] = studentId;
  return updateStudent(filtered);
}

// ─── DELETE STUDENT ───────────────────────────────────────────────────────
function deleteStudent(studentId) {
  if (!studentId) return error('Student ID required');

  var sheet = getSheet(SHEETS.STUDENTS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === studentId) {
      sheet.deleteRow(i + 1);
      return success(null, 'Student deleted successfully');
    }
  }
  return error('Student not found', 404);
}

// ─── TOGGLE STATUS ────────────────────────────────────────────────────────
function toggleStudentStatus(studentId) {
  if (!studentId) return error('Student ID required');

  var sheet = getSheet(SHEETS.STUDENTS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === studentId) {
      var current = data[i][12];
      var next = current === 'Active' ? 'Inactive' : 'Active';
      sheet.getRange(i + 1, 13).setValue(next);
      sheet.getRange(i + 1, 16).setValue(new Date());
      return success({ status: next }, 'Status updated to ' + next);
    }
  }
  return error('Student not found', 404);
}

// ─── IMPORT / EXPORT ──────────────────────────────────────────────────────
function importStudents(students) {
  if (!Array.isArray(students) || students.length === 0) {
    return error('No students to import');
  }

  var results = { added: 0, skipped: 0, errors: [] };

  students.forEach(function(s, idx) {
    try {
      if (!s['Full Name']) {
        results.errors.push('Row ' + (idx + 1) + ': Full Name missing');
        results.skipped++;
        return;
      }
      addStudent(s);
      results.added++;
    } catch (err) {
      results.errors.push('Row ' + (idx + 1) + ': ' + err.message);
      results.skipped++;
    }
  });

  return success(results, 'Import complete');
}

function exportStudentsCSV() {
  var sheet = getSheet(SHEETS.STUDENTS);
  var rows = sheetToObjects(sheet);

  var safeRows = rows.map(function(r) {
    var s = Object.assign({}, r);
    delete s['Password'];
    return s;
  });

  return success({ students: safeRows, count: safeRows.length });
}

// ─── STUDENT PROGRESS ─────────────────────────────────────────────────────
function getStudentProgress(studentId) {
  if (!studentId) return error('Student ID required');

  var answersSheet = getSheet(SHEETS.ANSWERS);
  var questionsSheet = getSheet(SHEETS.QUESTIONS);
  var studentSheet = getSheet(SHEETS.STUDENTS);

  var allAnswers = sheetToObjects(answersSheet);
  var allQuestions = sheetToObjects(questionsSheet);
  var students = sheetToObjects(studentSheet);

  // If admin request (no specific student), return all progress
  if (studentId === 'all') {
    return getAllStudentsProgress(students, allAnswers, allQuestions);
  }

  var studentAnswers = allAnswers.filter(function(a) {
    return a['Student ID'] === studentId;
  });

  var student = students.find(function(s) { return s['Student ID'] === studentId; });
  if (!student) return error('Student not found', 404);

  var totalQuestions = allQuestions.filter(function(q) {
    return q['Status'] === 'Published';
  }).length;

  var attempted = studentAnswers.length;
  var correct = studentAnswers.filter(function(a) {
    return a['Correct/Incorrect'] === 'Correct';
  }).length;
  var wrong = attempted - correct;
  var totalMarks = studentAnswers.reduce(function(sum, a) {
    return sum + (parseFloat(a['Marks']) || 0);
  }, 0);
  var maxMarks = allQuestions.reduce(function(sum, q) {
    return sum + (parseFloat(q['Marks']) || 0);
  }, 0);

  var percentage = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;

  // Subject-wise breakdown
  var subjectMap = {};
  studentAnswers.forEach(function(a) {
    var q = allQuestions.find(function(qq) { return qq['Question ID'] === a['Question ID']; });
    if (!q) return;
    var sub = q['Subject'] || 'Other';
    if (!subjectMap[sub]) subjectMap[sub] = { attempted: 0, correct: 0, marks: 0 };
    subjectMap[sub].attempted++;
    if (a['Correct/Incorrect'] === 'Correct') subjectMap[sub].correct++;
    subjectMap[sub].marks += parseFloat(a['Marks']) || 0;
  });

  // Monthly breakdown
  var monthMap = {};
  studentAnswers.forEach(function(a) {
    var d = new Date(a['Submission Time']);
    if (isNaN(d)) return;
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!monthMap[key]) monthMap[key] = { attempted: 0, correct: 0 };
    monthMap[key].attempted++;
    if (a['Correct/Incorrect'] === 'Correct') monthMap[key].correct++;
  });

  // Recent answers with question details
  var recent = studentAnswers.slice(-10).reverse().map(function(a) {
    var q = allQuestions.find(function(qq) { return qq['Question ID'] === a['Question ID']; });
    return {
      answerId: a['Answer ID'],
      questionId: a['Question ID'],
      question: q ? q['Question'] : '',
      subject: q ? q['Subject'] : '',
      date: q ? q['Date'] : '',
      submittedAnswer: a['Submitted Answer'],
      correctAnswer: q ? q['Correct Answer'] : '',
      result: a['Correct/Incorrect'],
      marks: a['Marks'],
      submittedAt: a['Submission Time']
    };
  });

  return success({
    studentId: studentId,
    name: student['Full Name'],
    class: student['Class'],
    section: student['Section'],
    totalQuestions: totalQuestions,
    attempted: attempted,
    correct: correct,
    wrong: wrong,
    percentage: percentage,
    totalMarks: totalMarks,
    maxMarks: maxMarks,
    subjectBreakdown: subjectMap,
    monthlyBreakdown: monthMap,
    recentAnswers: recent
  });
}

function getAllStudentsProgress(students, allAnswers, allQuestions) {
  var totalQ = allQuestions.filter(function(q) { return q['Status'] === 'Published'; }).length;

  var progress = students.map(function(s, idx) {
    var sa = allAnswers.filter(function(a) { return a['Student ID'] === s['Student ID']; });
    var correct = sa.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; }).length;
    var marks = sa.reduce(function(sum, a) { return sum + (parseFloat(a['Marks']) || 0); }, 0);
    var pct = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;
    return {
      studentId: s['Student ID'],
      name: s['Full Name'],
      class: s['Class'],
      section: s['Section'],
      attempted: sa.length,
      correct: correct,
      wrong: sa.length - correct,
      percentage: pct,
      marks: marks,
      rank: 0
    };
  });

  // Assign rank
  progress.sort(function(a, b) { return b.percentage - a.percentage || b.marks - a.marks; });
  progress.forEach(function(p, i) { p.rank = i + 1; });

  return success({ students: progress, totalQuestions: totalQ });
}

/**
 * Student Daily Q&A Management System
 * Main Entry Point — Google Apps Script Web App
 *
 * Deploy as: Execute as "Me", Access: "Anyone"
 *
 * All requests come in as GET because GAS redirects POST and loses the body.
 * Write payloads are JSON-encoded in the ?payload= URL parameter.
 */

// ─── SPREADSHEET CONFIG ────────────────────────────────────────────────────
var SPREADSHEET_ID = ''; // Replace with your Google Sheet ID
var BLOGGER_BLOG_ID = ''; // Replace with your Blogger Blog ID

var SHEETS = {
  STUDENTS: 'Student_Master',
  QUESTIONS: 'Daily_Questions',
  ANSWERS: 'Student_Answers',
  SESSIONS: 'Sessions',
  SETTINGS: 'Settings',
  REPORTS: 'Reports'
};

// ─── RESPONSE HELPERS ─────────────────────────────────────────────────────
function makeResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function success(data, message) {
  return makeResponse({ success: true, data: data, message: message || 'OK' });
}

function error(message, code) {
  return makeResponse({ success: false, error: message, code: code || 400 });
}

// ─── UNIFIED ROUTER (GET only) ────────────────────────────────────────────
function doGet(e) {
  var action = e.parameter.action || '';
  var token  = e.parameter.token  || '';

  // Parse optional write payload
  var p = {};
  try {
    if (e.parameter.payload) p = JSON.parse(e.parameter.payload);
  } catch (err) { /* malformed payload — p stays {} */ }

  try {
    switch (action) {

      // ── System ──────────────────────────────────────────────────────────
      case 'ping':
        return success({ timestamp: new Date().toISOString() }, 'System online');

      // ── Auth ─────────────────────────────────────────────────────────────
      case 'adminLogin':
        return adminLogin(p.username, p.password);

      case 'studentLogin':
        return studentLogin(p.identifier, p.password);

      case 'logout':
        return logout(token);

      case 'changePassword':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return changePassword(p.studentId, p.oldPassword, p.newPassword);

      case 'resetPassword':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return resetStudentPassword(p.studentId);

      // ── Dashboard ─────────────────────────────────────────────────────────
      case 'dashboard':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getDashboardData();

      // ── Students ─────────────────────────────────────────────────────────
      case 'students':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getStudents(e.parameter);

      case 'student':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getStudent(e.parameter.id);

      case 'addStudent':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return addStudent(p.student);

      case 'updateStudent':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return updateStudent(p.student);

      case 'deleteStudent':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return deleteStudent(p.studentId);

      case 'toggleStudentStatus':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return toggleStudentStatus(p.studentId);

      case 'importStudents':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return importStudents(p.students);

      case 'updateProfile':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return updateStudentProfile(p.studentId, p.profile);

      case 'progress':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getStudentProgress(e.parameter.studentId);

      case 'exportStudents':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return exportStudentsCSV();

      // ── Questions ─────────────────────────────────────────────────────────
      case 'questions':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getQuestions(e.parameter);

      case 'todayQuestion':
        return getTodayQuestion(e.parameter.studentId);

      case 'addQuestion':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return addQuestion(p.question);

      case 'updateQuestion':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return updateQuestion(p.question);

      case 'deleteQuestion':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return deleteQuestion(p.questionId);

      case 'publishToBlogger':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return publishQuestionToBlogger(p.questionId);

      // ── Answers ───────────────────────────────────────────────────────────
      case 'submitAnswer':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return submitAnswer(p.answer);

      case 'studentAnswers':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getStudentAnswers(e.parameter.studentId);

      // ── Reports ───────────────────────────────────────────────────────────
      case 'reports':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return generateReport(e.parameter);

      // ── Settings ──────────────────────────────────────────────────────────
      case 'settings':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return getSettings();

      case 'updateSettings':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return updateSettings(p.settings);

      case 'sendTestEmail':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return sendTestEmail(p.email);

      case 'createBackup':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return createBackup();

      default:
        return error('Unknown action: ' + action, 404);
    }
  } catch (err) {
    logError('doGet', err);
    return error('Server error: ' + err.message, 500);
  }
}

// Keep doPost as a no-op stub (GAS requires it to be defined for POST deploys)
function doPost(e) {
  return doGet(e);
}

// ─── SPREADSHEET HELPERS ──────────────────────────────────────────────────
function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = createSheet(name);
  return sheet;
}

function createSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.insertSheet(name);
  var headers = getSheetHeaders(name);
  if (headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#1a73e8')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheetHeaders(sheetName) {
  var headers = {
    Student_Master: [
      'Student ID', 'Full Name', 'Class', 'Section', 'Roll Number',
      'Gender', 'Date of Birth', 'Parent Name', 'Mobile', 'Email',
      'Password', 'Admission Date', 'Status', 'Last Login',
      'Created Date', 'Updated Date', 'Remarks'
    ],
    Daily_Questions: [
      'Question ID', 'Date', 'Subject', 'Chapter', 'Question',
      'Correct Answer', 'Explanation', 'Difficulty', 'Marks',
      'Status', 'Blogger URL', 'Created Date'
    ],
    Student_Answers: [
      'Answer ID', 'Student ID', 'Question ID', 'Submitted Answer',
      'Correct/Incorrect', 'Marks', 'Submission Time', 'Remarks'
    ],
    Sessions: ['Token', 'User ID', 'Role', 'Created', 'Expires'],
    Settings: ['Key', 'Value', 'Updated'],
    Reports: ['Report ID', 'Type', 'Date', 'Generated By', 'Data', 'Created Date']
  };
  return headers[sheetName] || [];
}

function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function logError(context, err) {
  try { Logger.log('[ERROR][' + context + '] ' + err.message); } catch (e) {}
}

// ─── INITIALIZATION ───────────────────────────────────────────────────────
function initializeSystem() {
  Object.keys(SHEETS).forEach(function(key) { getSheet(SHEETS[key]); });

  var settingsSheet = getSheet(SHEETS.SETTINGS);
  var existing = sheetToObjects(settingsSheet);
  var keys = existing.map(function(r) { return r['Key']; });

  var defaults = [
    ['ADMIN_USERNAME', 'admin'],
    ['ADMIN_PASSWORD', hashPassword('Admin@1234')],
    ['ADMIN_EMAIL', 'admin@school.edu'],
    ['SCHOOL_NAME', 'My School'],
    ['EMAIL_NOTIFICATIONS', 'true'],
    ['BLOGGER_ENABLED', 'false'],
    ['SESSION_HOURS', '8'],
    ['QUESTIONS_PER_PAGE', '10'],
    ['STUDENTS_PER_PAGE', '20']
  ];

  defaults.forEach(function(pair) {
    if (keys.indexOf(pair[0]) === -1) {
      settingsSheet.appendRow([pair[0], pair[1], new Date()]);
    }
  });

  return success(null, 'System initialized successfully');
}

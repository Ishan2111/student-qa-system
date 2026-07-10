/**
 * Student Daily Q&A Management System
 * Main Entry Point — Google Apps Script Web App
 *
 * Deploy as: Execute as "Me", Access: "Anyone"
 */

// ─── SPREADSHEET CONFIG ────────────────────────────────────────────────────
var SPREADSHEET_ID = ''; // TODO: Replace with your Google Sheet ID
var BLOGGER_BLOG_ID = ''; // TODO: Replace with your Blogger Blog ID

var SHEETS = {
  STUDENTS: 'Student_Master',
  QUESTIONS: 'Daily_Questions',
  ANSWERS: 'Student_Answers',
  SESSIONS: 'Sessions',
  SETTINGS: 'Settings',
  REPORTS: 'Reports'
};

// ─── CORS HEADERS ──────────────────────────────────────────────────────────
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function makeResponse(data, statusCode) {
  statusCode = statusCode || 200;
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

// ─── MAIN ROUTER ──────────────────────────────────────────────────────────
function doGet(e) {
  var action = e.parameter.action || '';
  var token = e.parameter.token || '';

  try {
    switch (action) {
      case 'ping':
        return success({ timestamp: new Date().toISOString() }, 'System online');

      case 'dashboard':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getDashboardData();

      case 'students':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getStudents(e.parameter);

      case 'student':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getStudent(e.parameter.id);

      case 'questions':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getQuestions(e.parameter);

      case 'todayQuestion':
        return getTodayQuestion(e.parameter.studentId);

      case 'studentAnswers':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getStudentAnswers(e.parameter.studentId);

      case 'progress':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return getStudentProgress(e.parameter.studentId);

      case 'reports':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return generateReport(e.parameter);

      case 'settings':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return getSettings();

      case 'exportStudents':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return exportStudentsCSV();

      default:
        return error('Unknown action: ' + action, 404);
    }
  } catch (err) {
    logError('doGet', err);
    return error('Server error: ' + err.message, 500);
  }
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return error('Invalid JSON body');
  }

  var action = body.action || '';
  var token = body.token || '';

  try {
    switch (action) {

      // ── Auth ──
      case 'adminLogin':
        return adminLogin(body.username, body.password);

      case 'studentLogin':
        return studentLogin(body.identifier, body.password);

      case 'logout':
        return logout(token);

      case 'changePassword':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return changePassword(body.studentId, body.oldPassword, body.newPassword);

      case 'resetPassword':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return resetStudentPassword(body.studentId);

      // ── Students ──
      case 'addStudent':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return addStudent(body.student);

      case 'updateStudent':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return updateStudent(body.student);

      case 'deleteStudent':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return deleteStudent(body.studentId);

      case 'toggleStudentStatus':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return toggleStudentStatus(body.studentId);

      case 'importStudents':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return importStudents(body.students);

      case 'updateProfile':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return updateStudentProfile(body.studentId, body.profile);

      // ── Questions ──
      case 'addQuestion':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return addQuestion(body.question);

      case 'updateQuestion':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return updateQuestion(body.question);

      case 'deleteQuestion':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return deleteQuestion(body.questionId);

      case 'publishToBlogger':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return publishQuestionToBlogger(body.questionId);

      // ── Answers ──
      case 'submitAnswer':
        if (!validateToken(token)) return error('Unauthorized', 401);
        return submitAnswer(body.answer);

      // ── Settings ──
      case 'updateSettings':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return updateSettings(body.settings);

      case 'sendTestEmail':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return sendTestEmail(body.email);

      case 'createBackup':
        if (!validateAdminToken(token)) return error('Unauthorized', 401);
        return createBackup();

      default:
        return error('Unknown action: ' + action, 404);
    }
  } catch (err) {
    logError('doPost', err);
    return error('Server error: ' + err.message, 500);
  }
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
  if (!sheet) {
    sheet = createSheet(name);
  }
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
    headers.forEach(function(h, i) {
      obj[h] = row[i];
    });
    return obj;
  });
}

function logError(context, err) {
  try {
    Logger.log('[ERROR][' + context + '] ' + err.message + '\n' + err.stack);
  } catch (e) {}
}

// ─── INITIALIZATION ───────────────────────────────────────────────────────
function initializeSystem() {
  Object.keys(SHEETS).forEach(function(key) {
    getSheet(SHEETS[key]);
  });

  // Default settings
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

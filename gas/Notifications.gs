/**
 * Notifications.gs — Email Notifications
 */

function getSettingsMap() {
  var sheet = getSheet(SHEETS.SETTINGS);
  var rows = sheetToObjects(sheet);
  var map = {};
  rows.forEach(function(r) {
    map[r['Key']] = r['Value'];
  });
  return map;
}

function updateSettings(settings) {
  if (!settings) return error('Settings data required');
  var sheet = getSheet(SHEETS.SETTINGS);
  var data = sheet.getDataRange().getValues();
  var existingKeys = data.slice(1).map(function(r) { return r[0]; });

  Object.keys(settings).forEach(function(key) {
    var value = key === 'ADMIN_PASSWORD' ? hashPassword(settings[key]) : settings[key];
    var idx = existingKeys.indexOf(key);
    if (idx >= 0) {
      sheet.getRange(idx + 2, 2).setValue(value);
      sheet.getRange(idx + 2, 3).setValue(new Date());
    } else {
      sheet.appendRow([key, value, new Date()]);
    }
  });

  return success(null, 'Settings updated');
}

function getSettings() {
  var map = getSettingsMap();
  // Don't expose hashed password
  delete map['ADMIN_PASSWORD'];
  return success(map);
}

// ─── EMAIL HELPERS ────────────────────────────────────────────────────────
function canSendEmail() {
  var settings = getSettingsMap();
  return settings['EMAIL_NOTIFICATIONS'] === 'true';
}

function sendEmail(to, subject, body) {
  if (!to || !canSendEmail()) return false;
  try {
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: body });
    return true;
  } catch (err) {
    logError('sendEmail', err);
    return false;
  }
}

function emailTemplate(title, body, schoolName) {
  schoolName = schoolName || 'School';
  return '<!DOCTYPE html><html><head><style>' +
    'body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}' +
    '.container{max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden}' +
    '.header{background:linear-gradient(135deg,#1a73e8,#0d47a1);color:white;padding:30px;text-align:center}' +
    '.header h1{margin:0;font-size:24px}' +
    '.body{padding:30px;color:#333}' +
    '.footer{background:#f8f9fa;padding:15px;text-align:center;color:#999;font-size:12px}' +
    '.btn{display:inline-block;background:#1a73e8;color:white;padding:12px 24px;border-radius:5px;text-decoration:none;margin-top:15px}' +
    '.info-box{background:#e3f2fd;border-left:4px solid #1a73e8;padding:15px;border-radius:0 5px 5px 0;margin:15px 0}' +
    '</style></head><body>' +
    '<div class="container">' +
    '<div class="header"><h1>' + schoolName + '</h1><p style="margin:5px 0 0;opacity:0.8">' + title + '</p></div>' +
    '<div class="body">' + body + '</div>' +
    '<div class="footer">This is an automated message from ' + schoolName + ' Q&A System. Do not reply.</div>' +
    '</div></body></html>';
}

// ─── SPECIFIC EMAILS ──────────────────────────────────────────────────────
function sendWelcomeEmail(email, name, studentId, password) {
  var settings = getSettingsMap();
  var schoolName = settings['SCHOOL_NAME'] || 'School';

  var body = '<p>Dear <strong>' + name + '</strong>,</p>' +
    '<p>Welcome to ' + schoolName + ' Daily Q&A System! Your account has been created.</p>' +
    '<div class="info-box">' +
      '<p style="margin:0"><strong>Student ID:</strong> ' + studentId + '</p>' +
      '<p style="margin:5px 0 0"><strong>Temporary Password:</strong> <code style="background:#fff;padding:3px 8px;border-radius:4px">' + password + '</code></p>' +
    '</div>' +
    '<p>Please login and change your password immediately.</p>' +
    '<p style="color:#999;font-size:13px">Keep your credentials confidential.</p>';

  sendEmail(email, 'Welcome to ' + schoolName + ' — Account Created', emailTemplate('Account Created', body, schoolName));
}

function sendPasswordResetEmail(email, name, studentId, newPassword) {
  var settings = getSettingsMap();
  var schoolName = settings['SCHOOL_NAME'] || 'School';

  var body = '<p>Dear <strong>' + name + '</strong>,</p>' +
    '<p>Your password has been reset by the administrator.</p>' +
    '<div class="info-box">' +
      '<p style="margin:0"><strong>Student ID:</strong> ' + studentId + '</p>' +
      '<p style="margin:5px 0 0"><strong>New Password:</strong> <code style="background:#fff;padding:3px 8px;border-radius:4px">' + newPassword + '</code></p>' +
    '</div>' +
    '<p>Please login and change your password immediately.</p>' +
    '<p style="color:#e53935;font-size:13px">If you did not request this reset, contact your administrator.</p>';

  sendEmail(email, schoolName + ' — Password Reset', emailTemplate('Password Reset', body, schoolName));
}

function sendQuestionNotification(questionId) {
  var settings = getSettingsMap();
  if (!canSendEmail()) return;

  var qSheet = getSheet(SHEETS.QUESTIONS);
  var questions = sheetToObjects(qSheet);
  var question = questions.find(function(q) { return q['Question ID'] === questionId; });
  if (!question) return;

  var students = sheetToObjects(getSheet(SHEETS.STUDENTS))
    .filter(function(s) { return s['Status'] === 'Active' && s['Email']; });

  var schoolName = settings['SCHOOL_NAME'] || 'School';

  students.forEach(function(s) {
    var body = '<p>Dear <strong>' + s['Full Name'] + '</strong>,</p>' +
      '<p>A new question has been posted for today!</p>' +
      '<div class="info-box">' +
        '<p style="margin:0"><strong>Subject:</strong> ' + (question['Subject'] || '') + '</p>' +
        '<p style="margin:5px 0 0"><strong>Chapter:</strong> ' + (question['Chapter'] || '') + '</p>' +
        '<p style="margin:5px 0 0"><strong>Marks:</strong> ' + (question['Marks'] || '1') + '</p>' +
        '<p style="margin:5px 0 0"><strong>Difficulty:</strong> ' + (question['Difficulty'] || 'Medium') + '</p>' +
      '</div>' +
      '<p>Login to your account to answer today\'s question.</p>';

    sendEmail(s['Email'], schoolName + ' — New Question Posted', emailTemplate('New Question Available', body, schoolName));
  });
}

function sendTestEmail(email) {
  var settings = getSettingsMap();
  var schoolName = settings['SCHOOL_NAME'] || 'School';
  var body = '<p>This is a test email from your ' + schoolName + ' Q&A System.</p>' +
    '<p>If you received this email, your email notification system is working correctly.</p>';
  var sent = sendEmail(email, 'Test Email — ' + schoolName + ' Q&A System', emailTemplate('Test Email', body, schoolName));
  return sent ? success(null, 'Test email sent') : error('Failed to send email');
}

function sendWeeklyReport() {
  var settings = getSettingsMap();
  var adminEmail = settings['ADMIN_EMAIL'];
  if (!adminEmail || !canSendEmail()) return;

  var schoolName = settings['SCHOOL_NAME'] || 'School';
  var reportData = JSON.parse(generateReport({ type: 'weekly' }).getContent());
  var d = reportData.data || {};

  var body = '<h2>Weekly Report</h2>' +
    '<div class="info-box">' +
      '<p><strong>Total Submissions:</strong> ' + (d.totalSubmissions || 0) + '</p>' +
      '<p><strong>Correct Answers:</strong> ' + (d.correctAnswers || 0) + '</p>' +
      '<p><strong>Participation Rate:</strong> ' + (d.participationRate || 0) + '%</p>' +
      '<p><strong>Questions Published:</strong> ' + (d.totalQuestions || 0) + '</p>' +
    '</div>';

  sendEmail(adminEmail, schoolName + ' — Weekly Report', emailTemplate('Weekly Summary', body, schoolName));
}

function createBackup() {
  try {
    var ss = getSpreadsheet();
    var copy = ss.copy('Backup_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss'));
    return success({ backupUrl: 'https://docs.google.com/spreadsheets/d/' + copy.getId() }, 'Backup created');
  } catch (err) {
    logError('createBackup', err);
    return error('Backup failed: ' + err.message);
  }
}

// ─── TRIGGERS ─────────────────────────────────────────────────────────────
function setupTriggers() {
  // Remove existing triggers
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // Weekly report every Monday at 8am
  ScriptApp.newTrigger('sendWeeklyReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  // Clean sessions daily
  ScriptApp.newTrigger('cleanExpiredSessions')
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();

  return 'Triggers set up successfully';
}

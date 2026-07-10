/**
 * Auth.gs — Authentication & Session Management
 */

// ─── PASSWORD HASHING ─────────────────────────────────────────────────────
function hashPassword(password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function generatePassword() {
  var upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  var lower = 'abcdefghjkmnpqrstuvwxyz';
  var digits = '23456789';
  var special = '@#$!';
  var all = upper + lower + digits + special;

  var pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)]
  ];

  for (var i = 4; i < 8; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Shuffle
  for (var j = pwd.length - 1; j > 0; j--) {
    var k = Math.floor(Math.random() * (j + 1));
    var temp = pwd[j]; pwd[j] = pwd[k]; pwd[k] = temp;
  }
  return pwd.join('');
}

function generateToken() {
  return Utilities.getUuid() + '-' + Date.now().toString(36);
}

// ─── SESSION MANAGEMENT ───────────────────────────────────────────────────
function createSession(userId, role) {
  var token = generateToken();
  var sheet = getSheet(SHEETS.SESSIONS);
  var settings = getSettingsMap();
  var hours = parseInt(settings['SESSION_HOURS'] || '8');
  var expires = new Date(Date.now() + hours * 3600 * 1000);

  sheet.appendRow([token, userId, role, new Date(), expires]);
  cleanExpiredSessions();
  return token;
}

function validateToken(token) {
  if (!token) return false;
  var sheet = getSheet(SHEETS.SESSIONS);
  var rows = sheetToObjects(sheet);
  var now = new Date();

  return rows.some(function(r) {
    return r['Token'] === token && new Date(r['Expires']) > now;
  });
}

function validateAdminToken(token) {
  if (!token) return false;
  var sheet = getSheet(SHEETS.SESSIONS);
  var rows = sheetToObjects(sheet);
  var now = new Date();

  return rows.some(function(r) {
    return r['Token'] === token &&
           r['Role'] === 'admin' &&
           new Date(r['Expires']) > now;
  });
}

function getTokenUser(token) {
  var sheet = getSheet(SHEETS.SESSIONS);
  var rows = sheetToObjects(sheet);
  var now = new Date();
  var session = rows.find(function(r) {
    return r['Token'] === token && new Date(r['Expires']) > now;
  });
  return session ? { userId: session['User ID'], role: session['Role'] } : null;
}

function cleanExpiredSessions() {
  var sheet = getSheet(SHEETS.SESSIONS);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  var now = new Date();
  var toDelete = [];

  for (var i = data.length - 1; i >= 1; i--) {
    if (new Date(data[i][4]) <= now) {
      toDelete.push(i + 1);
    }
  }

  toDelete.forEach(function(row) {
    sheet.deleteRow(row);
  });
}

function logout(token) {
  if (!token) return error('No token');
  var sheet = getSheet(SHEETS.SESSIONS);
  var data = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === token) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return success(null, 'Logged out');
}

// ─── ADMIN LOGIN ──────────────────────────────────────────────────────────
function adminLogin(username, password) {
  if (!username || !password) return error('Username and password required');

  var settings = getSettingsMap();
  var storedUser = settings['ADMIN_USERNAME'] || 'admin';
  var storedHash = settings['ADMIN_PASSWORD'] || hashPassword('Admin@1234');

  if (username !== storedUser || hashPassword(password) !== storedHash) {
    return error('Invalid credentials', 401);
  }

  var token = createSession('admin', 'admin');
  return success({
    token: token,
    role: 'admin',
    name: 'Administrator',
    username: username
  }, 'Login successful');
}

// ─── STUDENT LOGIN ────────────────────────────────────────────────────────
function studentLogin(identifier, password) {
  if (!identifier || !password) return error('Identifier and password required');

  var sheet = getSheet(SHEETS.STUDENTS);
  var rows = sheetToObjects(sheet);
  var hashedPwd = hashPassword(password);

  var student = rows.find(function(r) {
    return (r['Student ID'] === identifier || r['Email'] === identifier) &&
           r['Password'] === hashedPwd;
  });

  if (!student) return error('Invalid credentials', 401);

  if (student['Status'] !== 'Active') {
    return error('Account is ' + student['Status'] + '. Contact admin.', 403);
  }

  // Update last login
  updateLastLogin(student['Student ID']);

  var token = createSession(student['Student ID'], 'student');
  return success({
    token: token,
    role: 'student',
    studentId: student['Student ID'],
    name: student['Full Name'],
    class: student['Class'],
    section: student['Section'],
    email: student['Email']
  }, 'Login successful');
}

function updateLastLogin(studentId) {
  var sheet = getSheet(SHEETS.STUDENTS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === studentId) {
      sheet.getRange(i + 1, 14).setValue(new Date()); // Column N = Last Login
      break;
    }
  }
}

// ─── PASSWORD MANAGEMENT ──────────────────────────────────────────────────
function changePassword(studentId, oldPassword, newPassword) {
  if (!studentId || !oldPassword || !newPassword) {
    return error('All fields required');
  }
  if (newPassword.length < 6) return error('Password must be at least 6 characters');

  var sheet = getSheet(SHEETS.STUDENTS);
  var data = sheet.getDataRange().getValues();
  var hashedOld = hashPassword(oldPassword);

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === studentId) {
      if (data[i][10] !== hashedOld) return error('Current password incorrect', 401);
      sheet.getRange(i + 1, 11).setValue(hashPassword(newPassword));
      sheet.getRange(i + 1, 16).setValue(new Date());
      return success(null, 'Password changed successfully');
    }
  }
  return error('Student not found', 404);
}

function resetStudentPassword(studentId) {
  if (!studentId) return error('Student ID required');

  var newPassword = generatePassword();
  var sheet = getSheet(SHEETS.STUDENTS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === studentId) {
      sheet.getRange(i + 1, 11).setValue(hashPassword(newPassword));
      sheet.getRange(i + 1, 16).setValue(new Date());

      // Send email notification
      var email = data[i][9];
      var name = data[i][1];
      if (email) {
        sendPasswordResetEmail(email, name, studentId, newPassword);
      }

      return success({ newPassword: newPassword }, 'Password reset successfully');
    }
  }
  return error('Student not found', 404);
}

/**
 * Questions.gs — Daily Question Management
 */

// ─── QUESTION ID GENERATION ───────────────────────────────────────────────
function generateQuestionId() {
  var sheet = getSheet(SHEETS.QUESTIONS);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return 'Q0001';

  var ids = data.slice(1)
    .map(function(r) { return r[0]; })
    .filter(function(id) { return /^Q\d+$/.test(id); })
    .map(function(id) { return parseInt(id.replace('Q', ''), 10); });

  var max = ids.length > 0 ? Math.max.apply(null, ids) : 0;
  return 'Q' + String(max + 1).padStart(4, '0');
}

// ─── GET QUESTIONS ────────────────────────────────────────────────────────
function getQuestions(params) {
  var sheet = getSheet(SHEETS.QUESTIONS);
  var rows = sheetToObjects(sheet);

  // Search
  var search = (params.search || '').toLowerCase();
  if (search) {
    rows = rows.filter(function(r) {
      return (r['Question ID'] || '').toLowerCase().includes(search) ||
             (r['Question'] || '').toLowerCase().includes(search) ||
             (r['Subject'] || '').toLowerCase().includes(search) ||
             (r['Chapter'] || '').toLowerCase().includes(search);
    });
  }

  // Filter by subject
  if (params.subject && params.subject !== 'all') {
    rows = rows.filter(function(r) { return r['Subject'] === params.subject; });
  }

  // Filter by status
  if (params.status && params.status !== 'all') {
    rows = rows.filter(function(r) { return r['Status'] === params.status; });
  }

  // Filter by difficulty
  if (params.difficulty && params.difficulty !== 'all') {
    rows = rows.filter(function(r) { return r['Difficulty'] === params.difficulty; });
  }

  // Filter by date range
  if (params.dateFrom) {
    var from = new Date(params.dateFrom);
    rows = rows.filter(function(r) {
      return r['Date'] && new Date(r['Date']) >= from;
    });
  }
  if (params.dateTo) {
    var to = new Date(params.dateTo);
    rows = rows.filter(function(r) {
      return r['Date'] && new Date(r['Date']) <= to;
    });
  }

  // Sort by date descending by default
  rows.sort(function(a, b) {
    return new Date(b['Date'] || 0) - new Date(a['Date'] || 0);
  });

  // Pagination
  var page = parseInt(params.page || '1');
  var limit = parseInt(params.limit || '10');
  var total = rows.length;
  var start = (page - 1) * limit;
  var paged = rows.slice(start, start + limit);

  return success({
    questions: paged,
    total: total,
    page: page,
    limit: limit,
    pages: Math.ceil(total / limit)
  });
}

// ─── TODAY'S QUESTION ─────────────────────────────────────────────────────
function getTodayQuestion(studentId) {
  var sheet = getSheet(SHEETS.QUESTIONS);
  var rows = sheetToObjects(sheet);
  var tz = Session.getScriptTimeZone();
  var todayStr = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');

  // Find today's published question
  var todayQ = rows.find(function(r) {
    var qDate = '';
    try {
      qDate = r['Date'] instanceof Date
        ? Utilities.formatDate(r['Date'], tz, 'dd/MM/yyyy')
        : r['Date'].toString();
    } catch (e) {}
    return qDate === todayStr && r['Status'] === 'Published';
  });

  if (!todayQ) {
    // Try to find the most recent published question
    var published = rows.filter(function(r) { return r['Status'] === 'Published'; });
    published.sort(function(a, b) { return new Date(b['Date']) - new Date(a['Date']); });
    todayQ = published[0];
  }

  if (!todayQ) return success(null, 'No question available today');

  var hasSubmitted = false;
  var studentAnswer = null;

  if (studentId) {
    var answersSheet = getSheet(SHEETS.ANSWERS);
    var answers = sheetToObjects(answersSheet);
    var existing = answers.find(function(a) {
      return a['Student ID'] === studentId && a['Question ID'] === todayQ['Question ID'];
    });
    if (existing) {
      hasSubmitted = true;
      studentAnswer = {
        submittedAnswer: existing['Submitted Answer'],
        result: existing['Correct/Incorrect'],
        marks: existing['Marks'],
        submittedAt: existing['Submission Time']
      };
    }
  }

  var responseData = {
    questionId: todayQ['Question ID'],
    date: todayQ['Date'],
    subject: todayQ['Subject'],
    chapter: todayQ['Chapter'],
    question: todayQ['Question'],
    difficulty: todayQ['Difficulty'],
    marks: todayQ['Marks'],
    bloggerUrl: todayQ['Blogger URL'] || '',
    hasSubmitted: hasSubmitted,
    studentAnswer: studentAnswer
  };

  // Include answer/explanation only if submitted
  if (hasSubmitted) {
    responseData.correctAnswer = todayQ['Correct Answer'];
    responseData.explanation = todayQ['Explanation'];
  }

  return success(responseData);
}

// ─── ADD QUESTION ─────────────────────────────────────────────────────────
function addQuestion(qData) {
  if (!qData) return error('Question data required');
  if (!qData['Question']) return error('Question text is required');
  if (!qData['Correct Answer']) return error('Correct Answer is required');

  var sheet = getSheet(SHEETS.QUESTIONS);
  var questionId = generateQuestionId();
  var now = new Date();

  var row = [
    questionId,
    qData['Date'] || Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    qData['Subject'] || '',
    qData['Chapter'] || '',
    qData['Question'],
    qData['Correct Answer'],
    qData['Explanation'] || '',
    qData['Difficulty'] || 'Medium',
    qData['Marks'] || 1,
    qData['Status'] || 'Draft',
    '',  // Blogger URL
    now  // Created Date
  ];

  sheet.appendRow(row);

  // Auto-publish to Blogger if settings say so
  var settings = getSettingsMap();
  if (settings['BLOGGER_ENABLED'] === 'true' && qData['Status'] === 'Published') {
    try {
      publishQuestionToBlogger(questionId);
    } catch (e) {
      logError('addQuestion.blogger', e);
    }
  }

  // Send notification to students
  if (qData['Status'] === 'Published') {
    try {
      sendQuestionNotification(questionId);
    } catch (e) {
      logError('addQuestion.notify', e);
    }
  }

  return success({ questionId: questionId }, 'Question added successfully');
}

// ─── UPDATE QUESTION ──────────────────────────────────────────────────────
function updateQuestion(qData) {
  if (!qData || !qData['Question ID']) return error('Question ID required');

  var sheet = getSheet(SHEETS.QUESTIONS);
  var data = sheet.getDataRange().getValues();
  var prevStatus = '';

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === qData['Question ID']) {
      var row = i + 1;
      prevStatus = data[i][9];

      if (qData['Date'] !== undefined) sheet.getRange(row, 2).setValue(qData['Date']);
      if (qData['Subject'] !== undefined) sheet.getRange(row, 3).setValue(qData['Subject']);
      if (qData['Chapter'] !== undefined) sheet.getRange(row, 4).setValue(qData['Chapter']);
      if (qData['Question'] !== undefined) sheet.getRange(row, 5).setValue(qData['Question']);
      if (qData['Correct Answer'] !== undefined) sheet.getRange(row, 6).setValue(qData['Correct Answer']);
      if (qData['Explanation'] !== undefined) sheet.getRange(row, 7).setValue(qData['Explanation']);
      if (qData['Difficulty'] !== undefined) sheet.getRange(row, 8).setValue(qData['Difficulty']);
      if (qData['Marks'] !== undefined) sheet.getRange(row, 9).setValue(qData['Marks']);
      if (qData['Status'] !== undefined) sheet.getRange(row, 10).setValue(qData['Status']);

      // If newly published, send notification
      if (prevStatus !== 'Published' && qData['Status'] === 'Published') {
        try { sendQuestionNotification(qData['Question ID']); } catch(e) {}
      }

      return success(null, 'Question updated successfully');
    }
  }
  return error('Question not found', 404);
}

// ─── DELETE QUESTION ──────────────────────────────────────────────────────
function deleteQuestion(questionId) {
  if (!questionId) return error('Question ID required');

  var sheet = getSheet(SHEETS.QUESTIONS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === questionId) {
      sheet.deleteRow(i + 1);
      return success(null, 'Question deleted');
    }
  }
  return error('Question not found', 404);
}

// ─── ANSWER SUBMISSION ────────────────────────────────────────────────────
function submitAnswer(answerData) {
  if (!answerData) return error('Answer data required');
  if (!answerData.studentId) return error('Student ID required');
  if (!answerData.questionId) return error('Question ID required');
  if (!answerData.answer) return error('Answer required');

  // Check for duplicate submission
  var answersSheet = getSheet(SHEETS.ANSWERS);
  var existing = sheetToObjects(answersSheet);
  var dup = existing.find(function(a) {
    return a['Student ID'] === answerData.studentId &&
           a['Question ID'] === answerData.questionId;
  });
  if (dup) return error('Answer already submitted for this question');

  // Get question
  var qSheet = getSheet(SHEETS.QUESTIONS);
  var questions = sheetToObjects(qSheet);
  var question = questions.find(function(q) { return q['Question ID'] === answerData.questionId; });
  if (!question) return error('Question not found', 404);

  // Grade answer
  var submittedClean = (answerData.answer || '').trim().toLowerCase();
  var correctClean = (question['Correct Answer'] || '').trim().toLowerCase();
  var isCorrect = submittedClean === correctClean;
  var marks = isCorrect ? (parseFloat(question['Marks']) || 1) : 0;

  // Generate Answer ID
  var answerId = 'ANS' + String(existing.length + 1).padStart(5, '0');

  answersSheet.appendRow([
    answerId,
    answerData.studentId,
    answerData.questionId,
    answerData.answer,
    isCorrect ? 'Correct' : 'Incorrect',
    marks,
    new Date(),
    ''
  ]);

  return success({
    answerId: answerId,
    result: isCorrect ? 'Correct' : 'Incorrect',
    marks: marks,
    correctAnswer: question['Correct Answer'],
    explanation: question['Explanation']
  }, isCorrect ? 'Correct! Well done.' : 'Incorrect. Better luck next time!');
}

// ─── DASHBOARD DATA ───────────────────────────────────────────────────────
function getDashboardData() {
  var students = sheetToObjects(getSheet(SHEETS.STUDENTS));
  var questions = sheetToObjects(getSheet(SHEETS.QUESTIONS));
  var answers = sheetToObjects(getSheet(SHEETS.ANSWERS));

  var activeStudents = students.filter(function(s) { return s['Status'] === 'Active'; });
  var inactiveStudents = students.filter(function(s) { return s['Status'] === 'Inactive'; });
  var publishedQ = questions.filter(function(q) { return q['Status'] === 'Published'; });

  var correctAnswers = answers.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; });
  var wrongAnswers = answers.filter(function(a) { return a['Correct/Incorrect'] === 'Incorrect'; });

  var tz = Session.getScriptTimeZone();
  var todayStr = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');
  var todayQ = questions.find(function(q) {
    var d = q['Date'] instanceof Date
      ? Utilities.formatDate(q['Date'], tz, 'dd/MM/yyyy')
      : (q['Date'] || '').toString();
    return d === todayStr && q['Status'] === 'Published';
  });

  var todayAnswers = answers.filter(function(a) {
    var t = new Date(a['Submission Time']);
    if (isNaN(t)) return false;
    return Utilities.formatDate(t, tz, 'dd/MM/yyyy') === todayStr;
  });

  // Top performers
  var progressMap = {};
  activeStudents.forEach(function(s) {
    var sa = answers.filter(function(a) { return a['Student ID'] === s['Student ID']; });
    var correct = sa.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; }).length;
    var pct = publishedQ.length > 0 ? Math.round((correct / publishedQ.length) * 100) : 0;
    progressMap[s['Student ID']] = {
      studentId: s['Student ID'],
      name: s['Full Name'],
      class: s['Class'],
      attempted: sa.length,
      correct: correct,
      percentage: pct
    };
  });

  var topStudents = Object.values(progressMap)
    .sort(function(a, b) { return b.percentage - a.percentage; })
    .slice(0, 5);

  // Monthly stats (last 6 months)
  var monthlyStats = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date();
    d.setMonth(d.getMonth() - i);
    var yearMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    var monthAnswers = answers.filter(function(a) {
      var t = new Date(a['Submission Time']);
      if (isNaN(t)) return false;
      var ym = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
      return ym === yearMonth;
    });
    monthlyStats.push({
      month: yearMonth,
      label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
      submissions: monthAnswers.length,
      correct: monthAnswers.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; }).length
    });
  }

  // Subject-wise stats
  var subjectStats = {};
  questions.forEach(function(q) {
    var sub = q['Subject'] || 'Other';
    if (!subjectStats[sub]) subjectStats[sub] = { questions: 0, answers: 0, correct: 0 };
    subjectStats[sub].questions++;
    var qa = answers.filter(function(a) { return a['Question ID'] === q['Question ID']; });
    subjectStats[sub].answers += qa.length;
    subjectStats[sub].correct += qa.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; }).length;
  });

  var avgScore = answers.length > 0
    ? Math.round((correctAnswers.length / answers.length) * 100)
    : 0;

  return success({
    totalStudents: students.length,
    activeStudents: activeStudents.length,
    inactiveStudents: inactiveStudents.length,
    totalQuestions: questions.length,
    publishedQuestions: publishedQ.length,
    totalAnswers: answers.length,
    correctAnswers: correctAnswers.length,
    wrongAnswers: wrongAnswers.length,
    averageScore: avgScore,
    todayQuestion: todayQ ? {
      questionId: todayQ['Question ID'],
      question: todayQ['Question'],
      subject: todayQ['Subject']
    } : null,
    todaySubmissions: todayAnswers.length,
    topStudents: topStudents,
    monthlyStats: monthlyStats,
    subjectStats: subjectStats
  });
}

/**
 * Answers.gs — Answer management & retrieval
 */

function getStudentAnswers(studentId) {
  if (!studentId) return error('Student ID required');

  var answersSheet = getSheet(SHEETS.ANSWERS);
  var questionsSheet = getSheet(SHEETS.QUESTIONS);

  var answers = sheetToObjects(answersSheet).filter(function(a) {
    return a['Student ID'] === studentId;
  });

  var questions = sheetToObjects(questionsSheet);

  var enriched = answers.map(function(a) {
    var q = questions.find(function(qq) { return qq['Question ID'] === a['Question ID']; });
    return {
      answerId: a['Answer ID'],
      questionId: a['Question ID'],
      question: q ? q['Question'] : '',
      subject: q ? q['Subject'] : '',
      chapter: q ? q['Chapter'] : '',
      date: q ? q['Date'] : '',
      difficulty: q ? q['Difficulty'] : '',
      submittedAnswer: a['Submitted Answer'],
      correctAnswer: q ? q['Correct Answer'] : '',
      explanation: q ? q['Explanation'] : '',
      result: a['Correct/Incorrect'],
      marks: a['Marks'],
      maxMarks: q ? q['Marks'] : '',
      submittedAt: a['Submission Time']
    };
  });

  // Sort by submission time descending
  enriched.sort(function(a, b) {
    return new Date(b.submittedAt) - new Date(a.submittedAt);
  });

  return success({ answers: enriched, total: enriched.length });
}

function generateReport(params) {
  var type = params.type || 'daily';
  var questions = sheetToObjects(getSheet(SHEETS.QUESTIONS));
  var answers = sheetToObjects(getSheet(SHEETS.ANSWERS));
  var students = sheetToObjects(getSheet(SHEETS.STUDENTS));
  var tz = Session.getScriptTimeZone();

  switch (type) {
    case 'daily':
      return generateDailyReport(params.date, questions, answers, students, tz);
    case 'weekly':
      return generateWeeklyReport(questions, answers, students, tz);
    case 'monthly':
      return generateMonthlyReport(params.month, questions, answers, students, tz);
    case 'subject':
      return generateSubjectReport(params.subject, questions, answers, students);
    case 'question':
      return generateQuestionReport(params.questionId, questions, answers, students);
    case 'top':
      return generateTopStudentsReport(questions, answers, students);
    case 'low':
      return generateLowStudentsReport(questions, answers, students);
    default:
      return error('Unknown report type: ' + type);
  }
}

function generateDailyReport(date, questions, answers, students, tz) {
  var targetDate = date
    ? Utilities.formatDate(new Date(date), tz, 'dd/MM/yyyy')
    : Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');

  var dayQ = questions.filter(function(q) {
    var d = q['Date'] instanceof Date
      ? Utilities.formatDate(q['Date'], tz, 'dd/MM/yyyy')
      : (q['Date'] || '').toString();
    return d === targetDate;
  });

  var dayAnswers = answers.filter(function(a) {
    var t = new Date(a['Submission Time']);
    if (isNaN(t)) return false;
    return Utilities.formatDate(t, tz, 'dd/MM/yyyy') === targetDate;
  });

  var activeStudents = students.filter(function(s) { return s['Status'] === 'Active'; });
  var responded = [...new Set(dayAnswers.map(function(a) { return a['Student ID']; }))];
  var pending = activeStudents.filter(function(s) {
    return !responded.includes(s['Student ID']);
  });

  return success({
    date: targetDate,
    questions: dayQ,
    totalStudents: activeStudents.length,
    submitted: responded.length,
    pending: pending.length,
    pendingStudents: pending.map(function(s) {
      return { studentId: s['Student ID'], name: s['Full Name'], class: s['Class'] };
    }),
    correctAnswers: dayAnswers.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; }).length,
    wrongAnswers: dayAnswers.filter(function(a) { return a['Correct/Incorrect'] === 'Incorrect'; }).length,
    submissions: dayAnswers.length
  });
}

function generateWeeklyReport(questions, answers, students, tz) {
  var now = new Date();
  var weekAgo = new Date(now - 7 * 24 * 3600 * 1000);

  var weekAnswers = answers.filter(function(a) {
    var t = new Date(a['Submission Time']);
    return !isNaN(t) && t >= weekAgo && t <= now;
  });

  var weekQuestions = questions.filter(function(q) {
    var d = q['Date'] instanceof Date ? q['Date'] : new Date(q['Date']);
    return !isNaN(d) && d >= weekAgo && d <= now;
  });

  var activeStudents = students.filter(function(s) { return s['Status'] === 'Active'; });

  // Per-day breakdown
  var days = {};
  for (var i = 6; i >= 0; i--) {
    var d = new Date(now - i * 24 * 3600 * 1000);
    var key = Utilities.formatDate(d, tz, 'dd/MM/yyyy');
    days[key] = { submissions: 0, correct: 0 };
  }

  weekAnswers.forEach(function(a) {
    var t = new Date(a['Submission Time']);
    var key = Utilities.formatDate(t, tz, 'dd/MM/yyyy');
    if (days[key]) {
      days[key].submissions++;
      if (a['Correct/Incorrect'] === 'Correct') days[key].correct++;
    }
  });

  return success({
    period: { from: weekAgo.toDateString(), to: now.toDateString() },
    totalQuestions: weekQuestions.length,
    totalSubmissions: weekAnswers.length,
    correctAnswers: weekAnswers.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; }).length,
    activeStudents: activeStudents.length,
    participationRate: activeStudents.length > 0
      ? Math.round(([...new Set(weekAnswers.map(function(a) { return a['Student ID']; }))].length / activeStudents.length) * 100)
      : 0,
    dailyBreakdown: days
  });
}

function generateMonthlyReport(month, questions, answers, students, tz) {
  var target = month ? new Date(month + '-01') : new Date();
  var year = target.getFullYear();
  var mon = target.getMonth();

  var monthAnswers = answers.filter(function(a) {
    var t = new Date(a['Submission Time']);
    return !isNaN(t) && t.getFullYear() === year && t.getMonth() === mon;
  });

  var monthQuestions = questions.filter(function(q) {
    var d = q['Date'] instanceof Date ? q['Date'] : new Date(q['Date']);
    return !isNaN(d) && d.getFullYear() === year && d.getMonth() === mon;
  });

  var activeStudents = students.filter(function(s) { return s['Status'] === 'Active'; });

  // Student leaderboard for the month
  var leaderboard = activeStudents.map(function(s) {
    var sa = monthAnswers.filter(function(a) { return a['Student ID'] === s['Student ID']; });
    var correct = sa.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; }).length;
    return {
      studentId: s['Student ID'],
      name: s['Full Name'],
      class: s['Class'],
      submitted: sa.length,
      correct: correct,
      score: sa.reduce(function(sum, a) { return sum + (parseFloat(a['Marks']) || 0); }, 0)
    };
  }).sort(function(a, b) { return b.score - a.score; });

  leaderboard.forEach(function(s, i) { s.rank = i + 1; });

  return success({
    month: target.toLocaleString('default', { month: 'long', year: 'numeric' }),
    totalQuestions: monthQuestions.length,
    totalSubmissions: monthAnswers.length,
    correctAnswers: monthAnswers.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; }).length,
    activeStudents: activeStudents.length,
    leaderboard: leaderboard
  });
}

function generateSubjectReport(subject, questions, answers, students) {
  var subQ = subject ? questions.filter(function(q) { return q['Subject'] === subject; }) : questions;

  var report = subQ.map(function(q) {
    var qa = answers.filter(function(a) { return a['Question ID'] === q['Question ID']; });
    var correct = qa.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; }).length;
    return {
      questionId: q['Question ID'],
      date: q['Date'],
      subject: q['Subject'],
      chapter: q['Chapter'],
      question: q['Question'],
      difficulty: q['Difficulty'],
      totalSubmissions: qa.length,
      correct: correct,
      wrong: qa.length - correct,
      accuracy: qa.length > 0 ? Math.round((correct / qa.length) * 100) : 0
    };
  });

  var subjects = [...new Set(questions.map(function(q) { return q['Subject']; }))];

  return success({
    subject: subject || 'All Subjects',
    subjects: subjects,
    questions: report,
    totalQuestions: report.length
  });
}

function generateQuestionReport(questionId, questions, answers, students) {
  if (!questionId) return error('Question ID required');

  var question = questions.find(function(q) { return q['Question ID'] === questionId; });
  if (!question) return error('Question not found', 404);

  var qa = answers.filter(function(a) { return a['Question ID'] === questionId; });
  var correct = qa.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; });
  var wrong = qa.filter(function(a) { return a['Correct/Incorrect'] === 'Incorrect'; });

  var details = qa.map(function(a) {
    var s = students.find(function(st) { return st['Student ID'] === a['Student ID']; });
    return {
      studentId: a['Student ID'],
      name: s ? s['Full Name'] : 'Unknown',
      class: s ? s['Class'] : '',
      submittedAnswer: a['Submitted Answer'],
      result: a['Correct/Incorrect'],
      marks: a['Marks'],
      submittedAt: a['Submission Time']
    };
  });

  // Count of each submitted answer
  var answerCounts = {};
  qa.forEach(function(a) {
    var ans = a['Submitted Answer'] || '';
    answerCounts[ans] = (answerCounts[ans] || 0) + 1;
  });

  return success({
    question: question,
    totalSubmissions: qa.length,
    correct: correct.length,
    wrong: wrong.length,
    accuracy: qa.length > 0 ? Math.round((correct.length / qa.length) * 100) : 0,
    answerDistribution: answerCounts,
    studentDetails: details
  });
}

function generateTopStudentsReport(questions, answers, students) {
  var publishedQ = questions.filter(function(q) { return q['Status'] === 'Published'; });
  var activeStudents = students.filter(function(s) { return s['Status'] === 'Active'; });

  var ranked = activeStudents.map(function(s) {
    var sa = answers.filter(function(a) { return a['Student ID'] === s['Student ID']; });
    var correct = sa.filter(function(a) { return a['Correct/Incorrect'] === 'Correct'; }).length;
    var marks = sa.reduce(function(sum, a) { return sum + (parseFloat(a['Marks']) || 0); }, 0);
    var pct = publishedQ.length > 0 ? Math.round((correct / publishedQ.length) * 100) : 0;
    return {
      studentId: s['Student ID'],
      name: s['Full Name'],
      class: s['Class'],
      section: s['Section'],
      attempted: sa.length,
      correct: correct,
      wrong: sa.length - correct,
      marks: marks,
      percentage: pct
    };
  }).sort(function(a, b) {
    return b.percentage - a.percentage || b.marks - a.marks;
  });

  ranked.forEach(function(s, i) { s.rank = i + 1; });
  return success({ students: ranked.slice(0, 20), totalQuestions: publishedQ.length });
}

function generateLowStudentsReport(questions, answers, students) {
  var result = generateTopStudentsReport(questions, answers, students);
  var data = JSON.parse(ContentService.createTextOutput(result.getContent()).getContent()).data;
  data.students.reverse();
  data.students.forEach(function(s, i) { s.rank = i + 1; });
  return success(data);
}

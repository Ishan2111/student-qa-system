/**
 * Blogger.gs — Blogger API Integration
 */

function publishQuestionToBlogger(questionId) {
  var settings = getSettingsMap();
  var blogId = BLOGGER_BLOG_ID || settings['BLOGGER_BLOG_ID'] || '';

  if (!blogId) return error('Blogger Blog ID not configured');

  var qSheet = getSheet(SHEETS.QUESTIONS);
  var questions = sheetToObjects(qSheet);
  var question = questions.find(function(q) { return q['Question ID'] === questionId; });

  if (!question) return error('Question not found', 404);

  var schoolName = settings['SCHOOL_NAME'] || 'School';
  var title = schoolName + ' | ' + question['Subject'] + ' | ' + question['Date'] + ' | ' + question['Question ID'];

  var content = buildBloggerContent(question, schoolName);
  var labels = [
    question['Subject'] || '',
    question['Chapter'] || '',
    question['Difficulty'] || '',
    'Daily Question',
    schoolName
  ].filter(Boolean);

  try {
    var postBody = {
      kind: 'blogger#post',
      title: title,
      content: content,
      labels: labels
    };

    var options = {
      method: 'POST',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify(postBody),
      muteHttpExceptions: true
    };

    var url = 'https://www.googleapis.com/blogger/v3/blogs/' + blogId + '/posts/';
    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());

    if (result.error) {
      return error('Blogger API error: ' + result.error.message);
    }

    // Save Blogger URL back to sheet
    var data = qSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === questionId) {
        qSheet.getRange(i + 1, 11).setValue(result.url || result.selfLink || '');
        break;
      }
    }

    return success({ bloggerUrl: result.url, postId: result.id }, 'Published to Blogger');
  } catch (err) {
    logError('publishToBlogger', err);
    return error('Failed to publish: ' + err.message);
  }
}

function buildBloggerContent(question, schoolName) {
  return '<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">' +
    '<div style="background: linear-gradient(135deg, #1a73e8, #0d47a1); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">' +
      '<h1 style="margin: 0; font-size: 24px;">' + escapeHtml(schoolName) + '</h1>' +
      '<p style="margin: 5px 0 0; opacity: 0.8;">Daily Question — ' + escapeHtml(String(question['Date'])) + '</p>' +
    '</div>' +

    '<div style="background: #f8f9fa; border-left: 4px solid #1a73e8; padding: 15px 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">' +
      '<p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Subject: ' + escapeHtml(String(question['Subject'] || '')) + ' | Chapter: ' + escapeHtml(String(question['Chapter'] || '')) + '</p>' +
      '<p style="margin: 8px 0 0; font-size: 12px; color: #666;">Difficulty: <strong>' + escapeHtml(String(question['Difficulty'] || 'Medium')) + '</strong> | Marks: <strong>' + escapeHtml(String(question['Marks'] || '1')) + '</strong></p>' +
    '</div>' +

    '<div style="background: white; border: 2px solid #1a73e8; border-radius: 10px; padding: 25px; margin-bottom: 20px;">' +
      '<h2 style="color: #1a73e8; margin-top: 0; font-size: 18px;">Question ' + escapeHtml(String(question['Question ID'])) + '</h2>' +
      '<p style="font-size: 18px; line-height: 1.6; color: #333;">' + escapeHtml(String(question['Question'] || '')) + '</p>' +
    '</div>' +

    '<details style="background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 10px; padding: 15px; margin-bottom: 15px;">' +
      '<summary style="cursor: pointer; font-weight: bold; color: #2e7d32; font-size: 16px;">View Answer</summary>' +
      '<div style="margin-top: 15px;">' +
        '<p style="color: #2e7d32; font-size: 16px;"><strong>Answer:</strong> ' + escapeHtml(String(question['Correct Answer'] || '')) + '</p>' +
        (question['Explanation'] ? '<p style="color: #555; border-top: 1px solid #a5d6a7; padding-top: 10px; margin-top: 10px;"><strong>Explanation:</strong> ' + escapeHtml(String(question['Explanation'])) + '</p>' : '') +
      '</div>' +
    '</details>' +

    '<p style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">Published by ' + escapeHtml(schoolName) + ' Daily Q&A System</p>' +
  '</div>';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

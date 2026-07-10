/**
 * config.js — Global configuration
 * Update SCRIPT_URL after deploying your Google Apps Script
 */

const CONFIG = {
  // TODO: Replace with your deployed Apps Script Web App URL
  SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',

  SCHOOL_NAME: 'My School',
  VERSION: '1.0.0',

  SESSION_KEY: 'qa_session',
  THEME_KEY: 'qa_theme',

  SUBJECTS: ['Science', 'Mathematics', 'English', 'History', 'Geography', 'Computer', 'Hindi', 'Sanskrit', 'Other'],
  DIFFICULTIES: ['Easy', 'Medium', 'Hard'],
  GENDERS: ['Male', 'Female', 'Other'],
  CLASSES: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  SECTIONS: ['A', 'B', 'C', 'D', 'E'],
  STATUSES: ['Active', 'Inactive', 'Suspended'],

  TOAST_DURATION: 4000,
  DEFAULT_PAGE_SIZE: 20,
  DEBOUNCE_MS: 400,

  AVATAR_COLORS: [
    '#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#9c27b0',
    '#00bcd4', '#ff5722', '#607d8b', '#795548', '#e91e63'
  ]
};

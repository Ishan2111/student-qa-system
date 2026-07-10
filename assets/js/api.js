/**
 * api.js — API communication layer
 */

const API = {
  // ── Core request ──────────────────────────────────────────────────────
  async get(action, params = {}) {
    const token = Auth.getToken();
    const url = new URL(CONFIG.SCRIPT_URL);
    url.searchParams.set('action', action);
    if (token) url.searchParams.set('token', token);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'API error');
    return data.data;
  },

  async post(action, body = {}) {
    const token = Auth.getToken();
    const payload = { action, token, ...body };

    // No Content-Type header — keeps it a "simple request" so the browser
    // skips the CORS preflight that GAS cannot respond to.
    // GAS reads the body via e.postData.contents regardless of Content-Type.
    const response = await fetch(CONFIG.SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'API error');
    return data;
  },

  // ── Auth ──────────────────────────────────────────────────────────────
  adminLogin: (username, password) => API.post('adminLogin', { username, password }),
  studentLogin: (identifier, password) => API.post('studentLogin', { identifier, password }),
  logout: () => API.post('logout'),
  changePassword: (studentId, oldPassword, newPassword) =>
    API.post('changePassword', { studentId, oldPassword, newPassword }),
  resetPassword: (studentId) => API.post('resetPassword', { studentId }),

  // ── Dashboard ─────────────────────────────────────────────────────────
  getDashboard: () => API.get('dashboard'),

  // ── Students ──────────────────────────────────────────────────────────
  getStudents: (params) => API.get('students', params),
  getStudent: (id) => API.get('student', { id }),
  addStudent: (student) => API.post('addStudent', { student }),
  updateStudent: (student) => API.post('updateStudent', { student }),
  deleteStudent: (studentId) => API.post('deleteStudent', { studentId }),
  toggleStudentStatus: (studentId) => API.post('toggleStudentStatus', { studentId }),
  importStudents: (students) => API.post('importStudents', { students }),
  exportStudents: () => API.get('exportStudents'),
  updateProfile: (studentId, profile) => API.post('updateProfile', { studentId, profile }),
  getProgress: (studentId) => API.get('progress', { studentId }),

  // ── Questions ─────────────────────────────────────────────────────────
  getQuestions: (params) => API.get('questions', params),
  getTodayQuestion: (studentId) => API.get('todayQuestion', { studentId }),
  addQuestion: (question) => API.post('addQuestion', { question }),
  updateQuestion: (question) => API.post('updateQuestion', { question }),
  deleteQuestion: (questionId) => API.post('deleteQuestion', { questionId }),
  publishToBlogger: (questionId) => API.post('publishToBlogger', { questionId }),

  // ── Answers ───────────────────────────────────────────────────────────
  submitAnswer: (answer) => API.post('submitAnswer', { answer }),
  getStudentAnswers: (studentId) => API.get('studentAnswers', { studentId }),

  // ── Reports ───────────────────────────────────────────────────────────
  getReport: (params) => API.get('reports', params),

  // ── Settings ──────────────────────────────────────────────────────────
  getSettings: () => API.get('settings'),
  updateSettings: (settings) => API.post('updateSettings', { settings }),
  sendTestEmail: (email) => API.post('sendTestEmail', { email }),
  createBackup: () => API.post('createBackup'),
};

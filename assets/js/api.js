/**
 * api.js — API communication layer
 */

const API = {
  // ── Core request ──────────────────────────────────────────────────────
  // All requests use GET — GAS redirects POST and loses the body,
  // making it impossible to read in doPost. GET params are safe over HTTPS
  // and avoid all CORS preflight issues with GAS Web Apps.
  async _fetch(action, params = {}, writePayload = null) {
    const token = Auth.getToken();
    const url = new URL(CONFIG.SCRIPT_URL);
    url.searchParams.set('action', action);
    if (token) url.searchParams.set('token', token);

    // Read params go directly as individual query params
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });

    // Write payload is JSON-encoded in a single 'payload' param
    if (writePayload && Object.keys(writePayload).length > 0) {
      url.searchParams.set('payload', JSON.stringify(writePayload));
    }

    const response = await fetch(url.toString(), { redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'API error');
    return data;
  },

  async get(action, params = {}) {
    const result = await this._fetch(action, params);
    return result.data;
  },

  async post(action, body = {}) {
    return this._fetch(action, {}, body);
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

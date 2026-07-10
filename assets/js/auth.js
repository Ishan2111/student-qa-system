/**
 * auth.js — Authentication helpers (client-side)
 */

const Auth = {
  getSession() {
    try {
      const raw = localStorage.getItem(CONFIG.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  setSession(data) {
    localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify({
      ...data,
      savedAt: Date.now()
    }));
  },

  clearSession() {
    localStorage.removeItem(CONFIG.SESSION_KEY);
  },

  getToken() {
    return this.getSession()?.token || null;
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  getRole() {
    return this.getSession()?.role || null;
  },

  requireAdmin() {
    const session = this.getSession();
    if (!session || session.role !== 'admin') {
      window.location.href = '/admin/login.html';
      return false;
    }
    return true;
  },

  requireStudent() {
    const session = this.getSession();
    if (!session || session.role !== 'student') {
      window.location.href = '/student/login.html';
      return false;
    }
    return true;
  },

  async logout(redirectUrl) {
    try { await API.logout(); } catch {}
    this.clearSession();
    window.location.href = redirectUrl || '/';
  }
};

// ── Theme ────────────────────────────────────────────────────────────────
const Theme = {
  get() { return localStorage.getItem(CONFIG.THEME_KEY) || 'light'; },
  set(t) {
    localStorage.setItem(CONFIG.THEME_KEY, t);
    document.documentElement.setAttribute('data-theme', t);
  },
  toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
  apply() { document.documentElement.setAttribute('data-theme', this.get()); }
};

// Apply theme immediately to avoid flash
Theme.apply();

// ── Toast notifications ───────────────────────────────────────────────────
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
    this.init();
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span>${message}</span>
      <div class="toast-progress" style="animation-duration:${duration}ms"></div>
    `;
    this.container.appendChild(toast);

    const remove = () => {
      toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
      setTimeout(() => toast.remove(), 300);
    };
    toast.addEventListener('click', remove);
    setTimeout(remove, duration);
  },

  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error'),
  warning: (msg) => Toast.show(msg, 'warning'),
  info:    (msg) => Toast.show(msg, 'info')
};

// ── Loading overlay ────────────────────────────────────────────────────────
const Loading = {
  overlay: null,

  show(text) {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'loading-overlay';
      this.overlay.innerHTML = `
        <div style="text-align:center;color:white">
          <div class="spinner" style="margin:0 auto 16px"></div>
          <div id="loading-text" style="font-size:14px">${text || 'Loading...'}</div>
        </div>`;
      document.body.appendChild(this.overlay);
    } else {
      document.getElementById('loading-text').textContent = text || 'Loading...';
      this.overlay.style.display = 'flex';
    }
  },

  hide() {
    if (this.overlay) this.overlay.style.display = 'none';
  }
};

// ── Utility functions ──────────────────────────────────────────────────────
const Utils = {
  debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  },

  formatDate(val, locale = 'en-IN') {
    if (!val) return '—';
    try {
      const d = val instanceof Date ? val : new Date(val);
      if (isNaN(d)) return String(val);
      return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return String(val); }
  },

  formatDateTime(val, locale = 'en-IN') {
    if (!val) return '—';
    try {
      const d = val instanceof Date ? val : new Date(val);
      if (isNaN(d)) return String(val);
      return d.toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return String(val); }
  },

  timeAgo(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d)) return '';
    const seconds = Math.floor((Date.now() - d) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  },

  avatarColor(str) {
    if (!str) return CONFIG.AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return CONFIG.AVATAR_COLORS[Math.abs(hash) % CONFIG.AVATAR_COLORS.length];
  },

  initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  },

  avatar(name, size = 36) {
    const bg = this.avatarColor(name);
    return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px;background:${bg}">${this.initials(name)}</div>`;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  badge(text, type = 'secondary') {
    return `<span class="badge badge-${type}">${this.escapeHtml(text)}</span>`;
  },

  statusBadge(status) {
    const map = { Active: 'success', Inactive: 'danger', Suspended: 'warning', Draft: 'secondary', Published: 'success', Archived: 'info' };
    return this.badge(status, map[status] || 'secondary');
  },

  difficultyBadge(d) {
    const map = { Easy: 'success', Medium: 'warning', Hard: 'danger' };
    return this.badge(d, map[d] || 'secondary');
  },

  resultBadge(r) {
    return this.badge(r, r === 'Correct' ? 'success' : 'danger');
  },

  // CSV export helper
  exportCSV(filename, rows, headers) {
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(escape).join(',')];
    rows.forEach(r => lines.push(headers.map(h => escape(r[h] ?? r[h.toLowerCase()] ?? '')).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename + '.csv';
    a.click();
  },

  // Parse CSV file
  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    return lines.slice(1).map(line => {
      const vals = line.match(/("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g) || [];
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (vals[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
      });
      return obj;
    });
  },

  // Confirm dialog
  confirm(message, title = 'Confirm') {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-box" style="max-width:420px">
          <div class="modal-header">
            <div class="modal-title">⚠️ ${Utils.escapeHtml(title)}</div>
          </div>
          <div class="modal-body" style="padding:20px 24px">
            <p>${Utils.escapeHtml(message)}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="confirm-no">Cancel</button>
            <button class="btn btn-danger" id="confirm-yes">Confirm</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#confirm-yes').onclick = () => { modal.remove(); resolve(true); };
      modal.querySelector('#confirm-no').onclick  = () => { modal.remove(); resolve(false); };
    });
  },

  // Sidebar toggle for mobile
  setupSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));

    document.addEventListener('click', e => {
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
};

// ── Session info in UI ──────────────────────────────────────────────────────
function populateUserInfo() {
  const session = Auth.getSession();
  if (!session) return;

  const nameEls = document.querySelectorAll('[data-user-name]');
  const idEls = document.querySelectorAll('[data-user-id]');
  const roleEls = document.querySelectorAll('[data-user-role]');
  const avatarEls = document.querySelectorAll('[data-user-avatar]');

  nameEls.forEach(el => el.textContent = session.name || session.username || '');
  idEls.forEach(el => el.textContent = session.studentId || session.username || '');
  roleEls.forEach(el => el.textContent = session.role || '');
  avatarEls.forEach(el => {
    el.style.background = Utils.avatarColor(session.name);
    el.textContent = Utils.initials(session.name || session.username || '?');
  });
}

// ── Theme toggle setup ──────────────────────────────────────────────────────
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const update = () => {
    const isDark = Theme.get() === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  };
  update();
  btn.addEventListener('click', () => { Theme.toggle(); update(); });
}

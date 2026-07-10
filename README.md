# Student Daily Q&A Management System

A complete web-based system for managing daily questions and student answers, built with Google Apps Script, Google Sheets, HTML/CSS/JS, and Bootstrap 5.

---

## Features

| Feature | Description |
|---------|-------------|
| 👥 Student Management | Add, edit, delete, activate/deactivate students |
| 🆔 Auto ID Generation | ST0001, ST0002… auto-generated |
| 🔑 Password Management | Auto-generate, reset, change password |
| ❓ Daily Questions | Create, publish, archive questions |
| ✅ Answer Submission | Students answer once per question |
| 📊 Auto Grading | Instant correct/incorrect checking |
| 📝 Blogger Integration | Auto-publish questions to Blogger |
| 📧 Email Notifications | Welcome, password reset, new question alerts |
| 📈 Reports | Daily, weekly, monthly, subject-wise |
| 💾 Backup | One-click Google Drive backup |
| 🌙 Dark Mode | System-wide dark/light theme |
| 📱 Responsive | Works on mobile and desktop |

---

## Installation Guide

### Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it: **Student Q&A System**
4. Copy the Spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**SPREADSHEET_ID**/edit`

### Step 2 — Set Up Google Apps Script

1. In your Google Sheet, click **Extensions → Apps Script**
2. Delete the default `Code.gs` content
3. Create files and copy the content from the `gas/` folder:
   - `Code.gs`
   - `Auth.gs`
   - `Students.gs`
   - `Questions.gs`
   - `Answers.gs`
   - `Blogger.gs`
   - `Notifications.gs`
4. In `Code.gs`, set your Spreadsheet ID:
   ```javascript
   var SPREADSHEET_ID = 'your-spreadsheet-id-here';
   ```

### Step 3 — Initialize the System

1. In Apps Script, open `Code.gs`
2. Click the **Run** button on the `initializeSystem` function
3. Authorize the script when prompted
4. This creates all required sheets with proper headers

### Step 4 — Deploy as Web App

1. Click **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Click **Deploy**
6. Copy the Web App URL

### Step 5 — Configure the Frontend

1. Open `assets/js/config.js`
2. Replace `YOUR_SCRIPT_ID` with your actual deployment URL:
   ```javascript
   SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'
   ```

### Step 6 — Deploy Frontend

**Option A — GitHub Pages (Free)**
1. Push the `student-qa-system/` folder to a GitHub repository
2. Enable GitHub Pages in Settings → Pages
3. Your site will be at `https://username.github.io/repo-name/`

**Option B — Netlify (Free)**
1. Drag the folder to [netlify.com/drop](https://app.netlify.com/drop)
2. Get instant HTTPS deployment

**Option C — Local Testing**
```bash
# Python 3
cd student-qa-system
python3 -m http.server 8080
# Open http://localhost:8080
```

---

## Default Login Credentials

| Role | Username/ID | Password |
|------|-------------|----------|
| Admin | `admin` | `Admin@1234` |
| Student | (auto-generated ID) | (auto-generated password) |

**Important:** Change the admin password immediately after first login via Settings → Admin Account.

---

## Blogger Integration Setup

1. Go to [blogger.com](https://blogger.com) and create a blog
2. Go to Settings → Basic → Blog ID (copy it)
3. In Apps Script: **Services → Add Service → Blogger API v3**
4. In Admin Settings → Blogger: enter the Blog ID and enable
5. Questions can now be published to Blogger with one click

---

## Email Notifications Setup

Email uses Gmail via `MailApp` (built-in to Apps Script):

1. Go to Admin Settings → Email
2. Enable Email Notifications
3. Authorize when prompted
4. Test with the "Send Test Email" button

---

## File Structure

```
student-qa-system/
├── index.html              — Landing page (auto-redirects)
├── assets/
│   ├── css/main.css        — All styles + dark mode
│   └── js/
│       ├── config.js       — Configuration (update SCRIPT_URL here)
│       ├── api.js          — API communication layer
│       └── auth.js         — Auth, Toast, Loading, Utils helpers
├── admin/
│   ├── login.html          — Admin login
│   ├── dashboard.html      — Analytics dashboard
│   ├── students.html       — Student management (CRUD + import/export)
│   ├── questions.html      — Question management
│   ├── answers.html        — Answer management
│   ├── reports.html        — Daily/weekly/monthly/subject reports
│   └── settings.html       — System settings
├── student/
│   ├── login.html          — Student login
│   ├── dashboard.html      — Student home
│   ├── question.html       — Today's question + answer submission
│   ├── history.html        — Answer history
│   ├── progress.html       — Progress charts
│   └── profile.html        — Profile + change password
└── gas/
    ├── Code.gs             — Main router (doGet/doPost)
    ├── Auth.gs             — Authentication + sessions
    ├── Students.gs         — Student CRUD + progress
    ├── Questions.gs        — Question management + grading
    ├── Answers.gs          — Answer retrieval + reports
    ├── Blogger.gs          — Blogger API integration
    └── Notifications.gs    — Email + settings + backup
```

---

## Google Sheets Structure

| Sheet | Purpose |
|-------|---------|
| `Student_Master` | All student records |
| `Daily_Questions` | Questions with answers |
| `Student_Answers` | All submitted answers |
| `Sessions` | Login sessions (auto-cleaned) |
| `Settings` | System configuration |

---

## Security Notes

- Passwords are hashed using SHA-256 before storage
- Sessions expire automatically (configurable 1–24 hours)
- Admin and student tokens are stored separately
- Role-based access control on every API endpoint
- Input validation on both frontend and backend
- Sessions are automatically cleaned up daily

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Unauthorized" errors | Check your SCRIPT_URL in config.js |
| Emails not sending | Enable Email Notifications in Settings; re-authorize |
| Blogger publish fails | Add Blogger API v3 in Apps Script Services |
| Sheets not created | Run `initializeSystem()` in Apps Script |
| CORS errors | Make sure deploy access is set to "Anyone" |
| Session expired | Log out and log back in |

---

## Tech Stack

- **Backend:** Google Apps Script (serverless)
- **Database:** Google Sheets
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Charts:** Chart.js 4.4
- **Email:** Gmail via MailApp (Apps Script)
- **Blog:** Blogger API v3
- **Hosting:** Any static host (GitHub Pages, Netlify, etc.)

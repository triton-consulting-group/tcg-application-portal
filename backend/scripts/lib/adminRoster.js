const fs = require('fs');
const path = require('path');

// Admin rosters (real member names and emails) live in a gitignored file, not in the public repo.
// Copy admin-roster.example.json to admin-roster.local.json and fill it in, or point ADMIN_ROSTER at another file.
const ROSTER_PATH = process.env.ADMIN_ROSTER || path.join(__dirname, '..', 'admin-roster.local.json');

const loadAdminRoster = () => {
  if (!fs.existsSync(ROSTER_PATH)) {
    console.error(`❌ Admin roster not found at ${ROSTER_PATH}.`);
    console.error('   Copy backend/scripts/admin-roster.example.json to backend/scripts/admin-roster.local.json and fill it in.');
    process.exit(1);
  }
  const roster = JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8'));
  const list = (key) => (Array.isArray(roster[key]) ? roster[key] : []);
  return {
    keepEmails: list('keepEmails'),
    board: list('board'),
    otherSuperAdmins: list('otherSuperAdmins'),
    associates: list('associates'),
    admins: list('admins'),
    superAdmins: list('superAdmins'),
  };
};

module.exports = { loadAdminRoster, ROSTER_PATH };

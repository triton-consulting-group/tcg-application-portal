const path = require('path');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { loadAdminRoster } = require('./lib/adminRoster');

// Rebuilds the admin list from scratch:
//   1. Deletes every admin except KEEP_EMAILS.
//   2. Makes everyone in BOARD and OTHER_SUPER_ADMIN a super admin (all permissions).
//   3. Makes everyone in ASSOCIATES (and not a super admin) a basic admin
//      (view applications, view analytics, comment).
//
// Usage (dry run by default, nothing is written):
//   node scripts/resetAdminPermissions.js
// Write the changes:
//   node scripts/resetAdminPermissions.js --apply
// Use a specific env file (defaults to .env):
//   node scripts/resetAdminPermissions.js --env production.env --apply

// Rosters come from the gitignored admin-roster.local.json (see admin-roster.example.json)
const { keepEmails: KEEP_EMAILS, board: BOARD, otherSuperAdmins: OTHER_SUPER_ADMIN, associates: ASSOCIATES } = loadAdminRoster();

// Each person gets one name: the super admin entry if they are a super admin.

// Super admins who are not on the board

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const envIndex = args.indexOf('--env');
const envFile = envIndex !== -1 ? args[envIndex + 1] : '.env';

require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

const basicPermissions = {
  canViewApplications: true,
  canEditApplications: false,
  canDeleteApplications: false,
  canManageAdmins: false,
  canViewAnalytics: true,
  canChangeStatus: false,
  canAddComments: true,
  canDeleteComments: true,
  canDragDrop: false
};

const superAdminPermissions = {
  canViewApplications: true,
  canEditApplications: true,
  canDeleteApplications: true,
  canManageAdmins: true,
  canViewAnalytics: true,
  canChangeStatus: true,
  canAddComments: true,
  canDeleteComments: true,
  canDragDrop: true
};

// Dedupe by email (first entry wins), normalizing email case and name whitespace
const normalize = people => {
  const byEmail = new Map();
  for (const { email, name } of people) {
    const key = email.trim().toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, { email: key, name: name.trim() });
  }
  return [...byEmail.values()];
};

const resetAdminPermissions = async () => {
  if (!process.env.MONGO_URI) {
    console.error(`❌ MONGO_URI not found (looked in ${envFile}).`);
    process.exit(1);
  }

  const keep = new Set(KEEP_EMAILS.map(email => email.trim().toLowerCase()));
  const superAdmins = normalize([...BOARD, ...OTHER_SUPER_ADMIN]);
  const superAdminSet = new Set(superAdmins.map(person => person.email));
  const associates = normalize(ASSOCIATES).filter(person => !superAdminSet.has(person.email));

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ Connected to MongoDB (${envFile})`);
    console.log(apply ? '⚠️  APPLY mode: changes will be written\n' : '🔍 DRY RUN: no changes will be written (add --apply)\n');

    // 1. Delete every admin not in KEEP_EMAILS
    const existing = await Admin.find({});
    const toDelete = existing.filter(admin => !keep.has(admin.email.toLowerCase()));

    console.log(`🗑️  Deleting ${toDelete.length} of ${existing.length} existing admins:`);
    toDelete.forEach(admin => console.log(`   - ${admin.email} (${admin.role})`));
    if (apply && toDelete.length > 0) {
      await Admin.deleteMany({ _id: { $in: toDelete.map(admin => admin._id) } });
    }

    // 2 & 3. Upsert board + other super admins as super admins, associates as basic admins
    const upsertAdmin = async ({ email, name }, role, permissions) => {
      console.log(`   ${role === 'super_admin' ? '⭐' : '👤'} ${name} <${email}>`);
      if (!apply) return;

      await Admin.findOneAndUpdate(
        { email },
        { $set: { name, role, permissions, isActive: true }, $setOnInsert: { email, createdBy: 'system' } },
        { upsert: true, new: true }
      );
      await User.findOneAndUpdate(
        { email },
        { $setOnInsert: { email, name, role: 'associate' } },
        { upsert: true, new: true }
      );
    };

    console.log(`\n⭐ Setting ${superAdmins.length} super admins (board + other):`);
    for (const person of superAdmins) await upsertAdmin(person, 'super_admin', superAdminPermissions);

    console.log(`\n👤 Setting ${associates.length} basic admins (associates who are not super admins):`);
    for (const person of associates) await upsertAdmin(person, 'admin', basicPermissions);

    console.log(`\n📊 Result: ${superAdmins.length} super admins, ${associates.length} basic admins`);
    if (!apply) console.log('ℹ️  Dry run only. Rerun with --apply to save.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

resetAdminPermissions();

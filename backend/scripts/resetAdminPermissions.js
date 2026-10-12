const path = require('path');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const User = require('../models/User');

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

const KEEP_EMAILS = [
  'sbhatnagar@ucsd.edu',
  'nkerudi@ucsd.edu',
  'mihwang@ucsd.edu'
];

// Each person gets one name: the super admin entry if they are a super admin.
const BOARD = [
  { email: 'aparthan@ucsd.edu', name: 'Aditi Parthan' },
  { email: 'htakken@ucsd.edu', name: 'Harrison Takken' },
  { email: 'jgajiwala@ucsd.edu', name: 'Jessica Gajiwala' },
  { email: 'jjukita@ucsd.edu', name: 'Josephine (Josie) Jukita' },
  { email: 'lphamnguyen@ucsd.edu', name: 'Lana Pham-Nguyen' },
  { email: 'l5herrera@ucsd.edu', name: 'Leslie Herrera' },
  { email: 'l6lau@ucsd.edu', name: 'Lianna Lau' },
  { email: 'miz051@ucsd.edu', name: 'Mia Zhang' },
  { email: 'nkerudi@ucsd.edu', name: 'Nikitha Kerudi' },
  { email: 'satadepalli@ucsd.edu', name: 'Sadhana Tadepalli' },
  { email: 'schaurasiya@ucsd.edu', name: 'Suhani Chaurasiya' },
  { email: 'sbhatnagar@ucsd.edu', name: 'Sweekrit Bhatnagar' },
  { email: 'was002@ucsd.edu', name: 'Wanhan Sun' },
  { email: 'wisong@ucsd.edu', name: 'Wilson Song' },
  { email: 'mihwang@ucsd.edu', name: 'Mirabelle Hwang' }
];

// Super admins who are not on the board
const OTHER_SUPER_ADMIN = [
  { email: 'amuthu@ucsd.edu', name: 'Aathi Muthu' }
];

const ASSOCIATES = [
  { email: 'schaurasiya@ucsd.edu', name: 'Suhani Chaurasiya' },
  { email: 's2bui@ucsd.edu', name: 'Sarah Bui' },
  { email: 'spjha@ucsd.edu', name: 'Sparsh Jha' },
  { email: 'aphuang@ucsd.edu', name: 'April Huang' },
  { email: 'jol171@ucsd.edu', name: 'Joanne Liang' },
  { email: 'm2dao@ucsd.edu', name: 'Mattie Dao' },
  { email: 'mihwang@ucsd.edu', name: 'Mirabelle Hwang' },
  { email: 'ngolder@ucsd.edu', name: 'Noah Golder' },
  { email: 'tbalamurugan@ucsd.edu', name: 'Tanisha Bala' },
  { email: 'dramu@ucsd.edu', name: 'Dhruv Ramu' },
  { email: 'fyurkov@ucsd.edu', name: 'Feodor Yurkov' },
  { email: 'miz051@ucsd.edu', name: 'Mia Zhang' },
  { email: 'ery002@ucsd.edu', name: 'Erika Yu' },
  { email: 'tmalpeddi@ucsd.edu', name: 'Tejal Malpeddi' },
  { email: 'jjukita@ucsd.edu', name: 'Josephine (Josie) Jukita' },
  { email: 'r4ravi@ucsd.edu', name: 'Rishvik Ravi' },
  { email: 'l6lau@ucsd.edu', name: 'Lianna Lau' },
  { email: 'nkerudi@ucsd.edu', name: 'Nikitha Kerudi' },
  { email: 'lphamnguyen@ucsd.edu', name: 'Lana Pham-Nguyen' },
  { email: 'lrothe@ucsd.edu', name: 'Logan Rothe' },
  { email: 'tjoehren@ucsd.edu', name: 'Toshiyuki Joehren' },
  { email: 'nsuri@ucsd.edu', name: 'Nikhil Suri' },
  { email: 'brcan@ucsd.edu', name: 'Brian Can' },
  { email: 'mel070@ucsd.edu', name: 'Melody Liu' },
  { email: 'mih045@ucsd.edu', name: 'Mei Huang' },
  { email: 'a1gong@ucsd.edu', name: 'Alyssa Gong' },
  { email: 'wisong@ucsd.edu', name: 'Wilson Song' },
  { email: 'soqin@ucsd.edu', name: 'Sophia Qin' },
  { email: 'a3wan@ucsd.edu', name: 'Angel Wan' },
  { email: 'ceqian@ucsd.edu', name: 'Cecilia Qian' },
  { email: 'gema@ucsd.edu', name: 'George Ma' },
  { email: 'aanarayanan@ucsd.edu', name: 'Aarush Narayanan' },
  { email: 'ksameer@ucsd.edu', name: 'Krish Sameer' },
  { email: 'satadepalli@ucsd.edu', name: 'Sadhana Tadepalli' },
  { email: 'akanyal@ucsd.edu', name: 'Arav Kanyal' },
  { email: 'artyagi@ucsd.edu', name: 'Aryav Tyagi' },
  { email: 'ntandon@ucsd.edu', name: 'Namrata Tandon' },
  { email: 'vkaranth@ucsd.edu', name: 'Veyna Karanth' },
  { email: 'dtparekh@ucsd.edu', name: 'Devam Parekh' },
  { email: 'was002@ucsd.edu', name: 'Wanhan Sun' },
  { email: 'mdasgupta@ucsd.edu', name: 'Mallika Dasgupta' },
  { email: 'rpp003@ucsd.edu', name: 'Rushi Patel' },
  { email: 'kag040@ucsd.edu', name: 'Kabeer Gupta' },
  { email: 'h4gupta@ucsd.edu', name: 'Himansi Gupta' },
  { email: 'mdmello@ucsd.edu', name: "Matthew D'Mello" },
  { email: 'amuthu@ucsd.edu', name: 'Aathi Muthu' },
  { email: 'msaari@ucsd.edu', name: 'Max Saari' },
  { email: 'dsw001@ucsd.edu', name: 'Deiter Williams' },
  { email: 'jgajiwala@ucsd.edu', name: 'Jessica Gajiwala' },
  { email: 'r1malhotra@ucsd.edu', name: 'Riyana Malhotra' },
  { email: 'tlendler@ucsd.edu', name: 'Theo Lendler' },
  { email: 'lucorona@ucsd.edu', name: 'Luis Corona' },
  { email: 'jzlu@ucsd.edu', name: 'Justin Lu' },
  { email: 'htakken@ucsd.edu', name: 'Harrison Takken' },
  { email: 'mdreben@ucsd.edu', name: 'Max Dreben' },
  { email: 'vchowdhary@ucsd.edu', name: 'Varun Chowdhary' },
  { email: 'sbhatnagar@ucsd.edu', name: 'Sweekrit Bhatnagar' },
  { email: 'jmfernando@ucsd.edu', name: 'Jamera Mellyn Fernando' },
  { email: 'adhole@ucsd.edu', name: 'Arnav Dhole' },
  { email: 'fiwanaka@ucsd.edu', name: 'Faith Iwanaka' },
  { email: 'smahadkar@ucsd.edu', name: 'Saaz Mahadkar' },
  { email: 'sosahu@ucsd.edu', name: 'Sonia Sahu' },
  { email: 's1dhawan@ucsd.edu', name: 'Sidhant Dhawan' },
  { email: 'i6wu@ucsd.edu', name: 'Isabelle Wu' }
];

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

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Application = require('../models/Application');
const CASE_NIGHT_CONFIG = require('../config/caseNightConfig');
const { parseCaseNightPreferences } = require('../utils/caseNightPreferences');

// One-time cleanup for applications whose case night preferences were saved as one
// comma-joined entry (["A,B,C"]) instead of separate slots (["A", "B", "C"]).
//
// Safety:
//   - Never deletes anything. The only write is $set on caseNightPreferences, one application at a time.
//   - Nothing else on the application changes, not even updatedAt.
//   - Each write only matches if the stored value is still exactly what was read, so an
//     applicant editing at the same moment is never overwritten (that application is skipped).
//   - Before writing, every old value is saved to a backup JSON file; if the backup fails, nothing is written.
//   - Applications that would end up with no slots are skipped and reported, never emptied.
//
// Usage (dry run by default, nothing is written):
//   node scripts/fixCaseNightPreferences.js
// Write the changes:
//   node scripts/fixCaseNightPreferences.js --apply
// Use a specific env file (defaults to .env):
//   node scripts/fixCaseNightPreferences.js --env production.env --apply

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const envIndex = args.indexOf('--env');
const envFile = envIndex !== -1 ? args[envIndex + 1] : '.env';

require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

const validSlots = Object.keys(CASE_NIGHT_CONFIG.slots);
const sameList = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
const show = list => JSON.stringify(list);

const fixCaseNightPreferences = async () => {
  if (!process.env.MONGO_URI) {
    console.error(`❌ MONGO_URI not found (looked in ${envFile}).`);
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ Connected to MongoDB (${envFile})`);
    console.log(apply ? '⚠️  APPLY mode: changes will be written\n' : '🔍 DRY RUN: no changes will be written (add --apply)\n');

    const applications = await Application.find(
      { 'caseNightPreferences.0': { $exists: true } },
      { email: 1, fullName: 1, caseNightPreferences: 1 }
    ).lean();

    const toFix = [];
    const skipped = [];
    const unknownSlots = [];

    for (const app of applications) {
      const before = app.caseNightPreferences;
      const after = parseCaseNightPreferences(before);

      if (sameList(before, after)) continue;

      if (after.length === 0) {
        skipped.push({ app, reason: `would become empty (was ${show(before)})` });
        continue;
      }

      const unknown = after.filter(slot => !validSlots.includes(slot));
      if (unknown.length > 0) unknownSlots.push({ app, unknown });

      toFix.push({ _id: app._id, email: app.email, fullName: app.fullName, before, after });
    }

    console.log(`📋 Checked ${applications.length} applications with case night preferences`);
    console.log(`🔧 ${toFix.length} need fixing:\n`);
    toFix.forEach(fix => console.log(`   ${fix.fullName} <${fix.email}>  ${show(fix.before)} → ${show(fix.after)}`));

    if (skipped.length > 0) {
      console.log(`\n⏭️  ${skipped.length} skipped (left untouched):`);
      skipped.forEach(({ app, reason }) => console.log(`   ${app.fullName} <${app.email}>  ${reason}`));
    }
    if (unknownSlots.length > 0) {
      console.log(`\n⚠️  ${unknownSlots.length} contain values that are not slots (${validSlots.join(', ')}); kept as-is:`);
      unknownSlots.forEach(({ app, unknown }) => console.log(`   ${app.fullName} <${app.email}>  ${show(unknown)}`));
    }

    if (!apply) {
      console.log('\nℹ️  Dry run only. Rerun with --apply to save.');
      return;
    }
    if (toFix.length === 0) {
      console.log('\n✅ Nothing to fix.');
      return;
    }

    // Back up every old value before any write
    const backupDir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `caseNightPreferences-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(toFix, null, 2));
    console.log(`\n💾 Backed up ${toFix.length} old values to ${backupPath}`);

    let updated = 0;
    const conflicts = [];

    for (const fix of toFix) {
      const result = await Application.updateOne(
        { _id: fix._id, caseNightPreferences: fix.before },
        { $set: { caseNightPreferences: fix.after } },
        { timestamps: false }
      );
      if (result.modifiedCount === 1) {
        updated++;
      } else {
        conflicts.push(fix);
      }
    }

    console.log(`\n✅ Updated ${updated} of ${toFix.length} applications`);
    if (conflicts.length > 0) {
      console.log(`⚠️  ${conflicts.length} changed since they were read and were left untouched; rerun to pick them up:`);
      conflicts.forEach(fix => console.log(`   ${fix.fullName} <${fix.email}>`));
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

fixCaseNightPreferences();

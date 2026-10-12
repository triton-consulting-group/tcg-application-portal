/**
 * Builds case night groups for "Case Night - Yes" applicants.
 * Same logic as the "Build Case Groups" button on the consultant page (services/caseGroupBuilder.js):
 * Tech and Non-Tech grouped separately, groups of 4 preferred and 3 allowed.
 * Add --by-year to keep the same year together inside each time slot (the website does this by default).
 *
 * Usage (dry run by default, nothing is written):
 *   node scripts/assignCaseGroups.js                 # uses .env
 *   node scripts/assignCaseGroups.js --production    # uses production.env
 * Replace all current assignments (the old ones are backed up first):
 *   node scripts/assignCaseGroups.js --production --apply
 * Keep years together:
 *   node scripts/assignCaseGroups.js --production --by-year --apply
 */

const path = require("path");
const mongoose = require("mongoose");

const envFile = process.argv.includes("--production") ? "production.env" : ".env";
require("dotenv").config({ path: path.join(__dirname, "..", envFile) });

const Application = require("../models/Application");
const CASE_NIGHT_CONFIG = require("../config/caseNightConfig");
const { ELIGIBLE_STATUS, buildCaseGroupPlan, toAssignmentDocs } = require("../services/caseGroupBuilder");
const { replaceAssignments, getExistingStatus } = require("../services/caseGroupStore");

const apply = process.argv.includes("--apply");
const groupByYear = process.argv.includes("--by-year");

const printPlan = (plan) => {
  for (const [track, { placed, groupsOf4, groupsOf3, slots }] of Object.entries(plan.tracks)) {
    console.log(`\n${track}: ${placed} placed in ${groupsOf4} groups of 4 and ${groupsOf3} groups of 3`);
    for (const [slot, { label, count, groups }] of Object.entries(slots)) {
      console.log(`  Slot ${slot} (${label}): ${count} people`);
      for (const group of groups) {
        console.log(`    ${group.groupId}: ${group.members.map((m) => (m.studentYear ? `${m.fullName} (${m.studentYear})` : m.fullName)).join(", ")}`);
      }
    }
  }

  if (plan.excluded.length > 0) {
    console.log(`\n⚠️  Not placed (${plan.excluded.length}):`);
    for (const person of plan.excluded) {
      console.log(`   ${person.fullName} <${person.email}> — ${person.reason}`);
    }
  }
};

const assignCaseGroups = async () => {
  if (!process.env.MONGO_URI) {
    console.error(`❌ MONGO_URI not found (looked in ${envFile}).`);
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ Connected to MongoDB (${envFile})`);
    console.log(apply ? "⚠️  APPLY mode: assignments will be replaced\n" : "🔍 DRY RUN: nothing will be written (add --apply)\n");

    const applications = await Application.find({ status: ELIGIBLE_STATUS })
      .select("fullName email candidateType caseNightPreferences studentYear createdAt status")
      .lean();
    const plan = buildCaseGroupPlan(applications, CASE_NIGHT_CONFIG, { groupByYear });

    console.log(`📊 ${plan.summary.eligible} "${ELIGIBLE_STATUS}" applicants, ${plan.summary.placed} placed`);
    console.log(`🎓 Keep years together: ${groupByYear ? "on" : "off (add --by-year)"}; ${plan.summary.mixedYearGroups} groups mix years`);
    printPlan(plan);

    const existing = await getExistingStatus();
    if (existing.count > 0) {
      console.log(`\n⚠️  ${existing.count} current assignments will be replaced (backed up first).`);
      if (existing.emailsSent > 0) console.log(`⚠️  ${existing.emailsSent} of them were already emailed.`);
      if (existing.handEditsSinceBuild > 0) console.log(`⚠️  ${existing.handEditsSinceBuild} hand edits since the last build will be discarded.`);
    }

    if (!apply) {
      console.log("\nℹ️  Dry run only. Rerun with --apply to save.");
      return;
    }

    const created = await replaceAssignments(toAssignmentDocs(plan, CASE_NIGHT_CONFIG, "script"), "script");
    console.log(`\n✅ Created ${created} case group assignments`);
  } catch (error) {
    console.error("❌ Error assigning case groups:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

assignCaseGroups();

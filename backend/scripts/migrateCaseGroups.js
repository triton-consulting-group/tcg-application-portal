const mongoose = require("mongoose");
const CaseGroupAssignment = require("../models/CaseGroupAssignment");
const CaseGroupBackup = require("../models/CaseGroupBackup");
const CaseGroupEditLog = require("../models/CaseGroupEditLog");
const RecruitmentRound = require("../models/RecruitmentRound");
const Group = require("../models/Group");
const Application = require("../models/Application");
const { groupsFromAssignments } = require("../services/caseGroupStore");
const { LEGACY_CYCLE } = require("../config/cycleConfig");

const validateMigration = async (assignments, round, session = null) => {
  const groups = groupsFromAssignments(assignments, round);
  for (const group of groups) await new Group(group).validate();
  const ids = assignments.map((row) => row.applicationId);
  const applications = await Application.find({ _id: { $in: ids }, cycle: LEGACY_CYCLE }).session(session).select("_id").lean();
  if (applications.length !== ids.length) throw new Error("Run the application-cycle migration first. Every legacy assignment must reference an application in 2026-fall.");
  return groups;
};

const migrateCaseGroups = async ({ apply = false, actor = "migration" } = {}) => {
  const existing = await RecruitmentRound.findOne({ cycle: LEGACY_CYCLE, kind: "case-night" });
  if (existing?.legacyMigratedAt) return { alreadyMigrated: true };
  if (existing && await Group.exists({ roundId: existing._id })) throw new Error("The legacy round already has groups. Review them before migrating; nothing was replaced.");
  const round = existing || new RecruitmentRound({ cycle: LEGACY_CYCLE, kind: "case-night", name: "Case Night" });
  const assignments = await CaseGroupAssignment.find().lean();
  const groups = await validateMigration(assignments, round);
  if (!apply) return { dryRun: true, assignments: assignments.length, groups: groups.length };
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await RecruitmentRound.findOne({ cycle: LEGACY_CYCLE, kind: "case-night" }).session(session);
      if (current?.legacyMigratedAt) return;
      if (current && (current.status === "finalized" || await Group.exists({ roundId: current._id }).session(session))) throw new Error("The round changed during migration. Nothing was replaced.");
      const target = current || round;
      const snapshot = await CaseGroupAssignment.find().session(session).lean();
      const docs = await validateMigration(snapshot, target, session);
      // Old backups and edits have no cycle field in MongoDB; schema defaults do not backfill them.
      const legacyScope = { $or: [{ cycle: { $exists: false } }, { cycle: null }, { cycle: LEGACY_CYCLE, roundId: { $exists: false } }] };
      const scopeUpdate = { $set: { cycle: LEGACY_CYCLE, roundId: target._id } };
      await CaseGroupBackup.updateMany(legacyScope, scopeUpdate, { session });
      await CaseGroupEditLog.updateMany(legacyScope, scopeUpdate, { session });
      await CaseGroupBackup.create([{ cycle: LEGACY_CYCLE, roundId: target._id, assignments: snapshot, replacedBy: actor }], { session });
      target.legacyMigratedAt = new Date();
      target.revision += 1;
      await target.save({ session });
      if (docs.length) await Group.insertMany(docs, { session });
      await CaseGroupEditLog.create([{ cycle: LEGACY_CYCLE, roundId: target._id, action: "migrate", to: `${snapshot.length} legacy assignments`, by: actor }], { session });
    });
  } finally { await session.endSession(); }
  return { migrated: true, assignments: assignments.length, groups: groups.length };
};

if (require.main === module) {
  require("dotenv").config();
  (async () => {
    try {
      if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
      await mongoose.connect(process.env.MONGO_URI);
      console.log(JSON.stringify(await migrateCaseGroups({ apply: process.argv.includes("--apply") })));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
    finally { await mongoose.disconnect(); }
  })();
}
module.exports = { migrateCaseGroups, validateMigration };

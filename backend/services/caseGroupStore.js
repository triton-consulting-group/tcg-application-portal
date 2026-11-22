const mongoose = require("mongoose");
const Group = require("../models/Group");
const Application = require("../models/Application");
const CaseGroupBackup = require("../models/CaseGroupBackup");
const CaseGroupEditLog = require("../models/CaseGroupEditLog");
const Evaluation = require("../models/Evaluation");
const CaseGroupAssignment = require("../models/CaseGroupAssignment");
const { findRound, ensureRound, withRoundTransaction, httpError } = require("./recruitmentRounds");
const { getActiveCycle, LEGACY_CYCLE } = require("../config/cycleConfig");
const { TRACKS, makeGroupId } = require("./caseGroupBuilder");
const { checkEditWarnings } = require("./caseGroupEdits");
const config = require("../config/caseNightConfig");

const flattenGroups = (groups) => groups.flatMap((group) => group.members.map((member) => ({
  ...(member.toObject ? member.toObject() : member),
  cycle: group.cycle, roundId: group.roundId, recruitmentGroupId: group._id,
  candidateType: group.candidateType, timeSlot: group.timeSlot,
  timeSlotDisplay: group.timeSlotDisplay, groupNumber: group.groupNumber, groupId: group.groupId
})));

const groupsFromAssignments = (assignments, round) => {
  const groups = new Map();
  const applicationIds = new Set();
  for (const row of assignments) {
    const applicationId = String(row.applicationId?._id || row.applicationId);
    if (applicationIds.has(applicationId)) throw httpError(400, "An applicant appears in more than one assignment.");
    applicationIds.add(applicationId);
    const key = makeGroupId(row.candidateType, row.timeSlot, row.groupNumber);
    if (!groups.has(key)) groups.set(key, {
      cycle: round.cycle, roundId: round._id, groupId: key, candidateType: row.candidateType,
      timeSlot: row.timeSlot, timeSlotDisplay: row.timeSlotDisplay, groupNumber: row.groupNumber, members: []
    });
    // Preserve legacy assignment IDs and delivery/edit metadata for existing board links and backups.
    groups.get(key).members.push({ ...row, _id: row._id || new mongoose.Types.ObjectId(), applicationId });
  }
  return [...groups.values()];
};

const listAssignments = async (cycle = getActiveCycle(), populate = true) => {
  const round = await findRound(cycle);
  if (!round) {
    if (cycle === LEGACY_CYCLE && await CaseGroupAssignment.exists({})) throw httpError(409, "Migrate the existing case groups before opening this round.");
    return [];
  }
  let query = Group.find({ roundId: round._id, cycle }).sort({ candidateType: 1, timeSlot: 1, groupNumber: 1 });
  if (populate) query = query.populate("members.applicationId");
  return flattenGroups(await query.lean());
};

const replaceAssignments = async (assignments, adminEmail, cycle = getActiveCycle()) => {
  if (!assignments.length) throw httpError(400, "An empty build cannot replace the current groups.");
  const round = await ensureRound(cycle);
  const docs = groupsFromAssignments(assignments, round).map((fields) => new Group(fields));
  for (const doc of docs) await doc.validate();
  return withRoundTransaction(round._id, async (locked, session) => {
    const eligibleCount = await Application.countDocuments({ _id: { $in: assignments.map((a) => a.applicationId) }, cycle, status: "Case Night - Yes" }).session(session);
    if (eligibleCount !== assignments.length) throw httpError(409, "Applicants changed or belong to another cycle. Preview the groups again.");
    if (await Evaluation.exists({ roundId: round._id }).session(session)) {
      throw httpError(409, "This round already has grades. Keep the groups or remove the grades through the grading workflow before rebuilding.");
    }
    const previous = await Group.find({ roundId: round._id }).session(session).lean();
    await CaseGroupBackup.create([{ cycle, roundId: round._id, assignments: flattenGroups(previous), groups: previous, replacedBy: adminEmail }], { session });
    await Group.deleteMany({ roundId: round._id }, { session });
    if (docs.length) await Group.insertMany(docs, { session });
    await CaseGroupEditLog.create([{ cycle, roundId: round._id, action: "build", to: `${assignments.length} assignments`, by: adminEmail }], { session });
    return assignments.length;
  });
};

const getExistingStatus = async (cycle = getActiveCycle()) => {
  const assignments = await listAssignments(cycle, false);
  const lastBuild = await CaseGroupEditLog.findOne({ cycle, action: "build" }).sort({ at: -1 }).lean();
  const handEditsSinceBuild = await CaseGroupEditLog.countDocuments({ cycle, action: { $in: ["add", "move", "remove"] }, ...(lastBuild ? { at: { $gt: lastBuild.at } } : {}) });
  return { count: assignments.length, emailsSent: assignments.filter((a) => a.emailSent).length, handEditsSinceBuild };
};

const editAssignment = async ({ cycle, action, assignmentId, applicationId, track, slot, groupNumber, confirmWarnings, adminEmail }) => {
  const round = await ensureRound(cycle);
  return withRoundTransaction(round._id, async (locked, session) => {
    const groups = await Group.find({ roundId: round._id, cycle }).session(session);
    const source = groups.find((group) => group.members.some((m) => String(m._id) === assignmentId));
    const member = source?.members.find((m) => String(m._id) === assignmentId);
    if (action !== "add" && !member) throw httpError(404, "Assignment not found.");
    const id = action === "add" ? applicationId : member.applicationId;
    if (!mongoose.isValidObjectId(id)) throw httpError(404, "Application not found.");
    const application = await Application.findOne({ _id: id, cycle }).session(session).lean();
    if (!application) throw httpError(404, "Application not found in this cycle.");
    if (action === "add" && application.status !== "Case Night - Yes") throw httpError(400, "Only Case Night - Yes applicants can be assigned.");
    if (action === "add" && groups.some((g) => g.members.some((m) => String(m.applicationId) === String(id)))) throw httpError(409, "This applicant already has a group.");
    if (await Evaluation.exists({ roundId: round._id, applicationId: id }).session(session)) throw httpError(409, "This applicant already has grades. Their group cannot be changed.");
    let target;
    if (action !== "remove") {
      if (!TRACKS.includes(track) || !config.slots[slot]) throw httpError(400, "Pick a valid track and time slot.");
      const number = groupNumber === "new" ? Math.max(0, ...groups.filter((g) => g.candidateType === track && g.timeSlot === slot).map((g) => g.groupNumber)) + 1 : Number(groupNumber);
      if (!Number.isInteger(number) || number < 1) throw httpError(400, "Pick a valid group number.");
      target = groups.find((g) => g.candidateType === track && g.timeSlot === slot && g.groupNumber === number);
      if (!target && groupNumber !== "new") throw httpError(404, "That group doesn't exist.");
      if (!target) target = new Group({ cycle, roundId: round._id, candidateType: track, timeSlot: slot, timeSlotDisplay: config.slots[slot], groupNumber: number, groupId: makeGroupId(track, slot, number) });
      if (source && String(source._id) === String(target._id)) throw httpError(400, "Already in that group.");
    }
    const warnings = checkEditWarnings({ application, target: target ? { track, slot } : null, source: source ? { groupId: source.groupId, remaining: source.members.length - 1 } : null, emailsSent: Boolean(member?.emailSent) || Boolean(target?.members.some((m) => m.emailSent)), config });
    if (warnings.length && confirmWarnings !== true) throw Object.assign(httpError(409, "Please confirm these warnings."), { warnings });
    if (source) {
      source.members.pull(member._id);
      // Save the removal first so the unique membership index also protects moves between groups.
      await source.save({ session });
    }
    if (target) {
      target.members.push({ ...(member ? member.toObject() : { applicationId: id, applicantName: application.fullName, applicantEmail: application.email, assignedBy: adminEmail }), lastEditedBy: adminEmail, lastEditedAt: new Date() });
      await target.save({ session });
    }
    await CaseGroupEditLog.create([{ cycle, roundId: round._id, action, applicationId: id, applicantName: application.fullName, from: source?.groupId, to: target?.groupId, by: adminEmail }], { session });
    return action === "remove" ? { removed: true } : { groupId: target.groupId };
  });
};
module.exports = { flattenGroups, groupsFromAssignments, listAssignments, replaceAssignments, getExistingStatus, editAssignment };

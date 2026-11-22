const crypto = require("crypto");
const mongoose = require("mongoose");
const Group = require("../models/Group");
const Evaluation = require("../models/Evaluation");
const Application = require("../models/Application");
const RecruitmentRound = require("../models/RecruitmentRound");
const CaseGroupEditLog = require("../models/CaseGroupEditLog");
const { withRoundTransaction, httpError } = require("./recruitmentRounds");

const nextStatus = (kind, result) => kind === "case-night"
  ? (result === "Pass" ? "Final Interview - Yes" : "Final Interview - No")
  : (result === "Pass" ? "Accepted" : "Rejected");

const buildPreview = (round, groups, applications, evaluations, decisions = []) => {
  if (!Array.isArray(decisions)) throw httpError(400, "Decisions must be a list.");
  const picks = new Map();
  for (const decision of decisions) {
    if (!decision || typeof decision.applicationId !== "string" || !["Pass", "Fail"].includes(decision.result) || picks.has(decision.applicationId)) {
      throw httpError(400, "Supply one Pass or Fail decision per applicant.");
    }
    picks.set(decision.applicationId, decision.result);
  }
  const members = groups.flatMap((g) => g.members.filter((m) => m.status !== "Cancelled").map((m) => ({ ...m, groupId: String(g._id) })));
  const ids = new Set(members.map((m) => String(m.applicationId)));
  if ([...picks.keys()].some((id) => !ids.has(id))) throw httpError(400, "A decision refers to someone outside this round.");
  const blockers = [];
  if (round.status === "finalized") blockers.push("This round is already finalized.");
  if (!members.length) blockers.push("This round has no assigned applicants.");
  if (ids.size !== members.length) blockers.push("An applicant appears in more than one group.");
  const changes = members.map((m) => {
    const id = String(m.applicationId);
    const app = applications.find((a) => String(a._id) === id);
    const votes = evaluations.filter((e) => String(e.applicationId) === id && String(e.groupId) === m.groupId)
      .map((e) => ({ evaluator: e.evaluator, result: e.result, notes: e.notes || "", updatedAt: e.updatedAt }))
      .sort((a, b) => a.evaluator.localeCompare(b.evaluator));
    const name = app?.fullName || m.applicantName;
    if (!app) blockers.push(`${name}: application is missing from this cycle.`);
    const eligible = round.kind === "case-night" ? "Case Night - Yes" : "Final Interview - Yes";
    if (app && app.status !== eligible) blockers.push(`${name}: current status must be ${eligible}.`);
    if (!votes.length) blockers.push(`${name}: no evaluations recorded.`);
    const result = picks.get(id);
    if (!result) blockers.push(`${name}: choose the board's Pass or Fail decision.`);
    return { applicationId: id, name, from: app?.status, to: result ? nextStatus(round.kind, result) : null, result: result || null, evaluations: votes };
  }).sort((a, b) => a.applicationId.localeCompare(b.applicationId));
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ roundId: String(round._id), kind: round.kind, cycle: round.cycle, status: round.status, changes, blockers })).digest("hex");
  return { roundId: String(round._id), fingerprint, changes, blockers };
};

const loadPreview = async (round, decisions, session = null) => {
  const groups = await Group.find({ roundId: round._id, cycle: round.cycle }).session(session).lean();
  const ids = groups.flatMap((g) => g.members.map((m) => m.applicationId));
  const [applications, evaluations] = await Promise.all([
    Application.find({ _id: { $in: ids }, cycle: round.cycle }).session(session).lean(),
    Evaluation.find({ roundId: round._id, cycle: round.cycle }).session(session).lean()
  ]);
  return buildPreview(round, groups, applications, evaluations, decisions);
};

const finalizeRound = async (round, decisions, fingerprint, adminEmail) => {
  if (typeof fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(fingerprint)) throw httpError(400, "Preview the decisions before finalizing.");
  return withRoundTransaction(round._id, async (locked, session) => {
    const preview = await loadPreview(locked, decisions, session);
    if (preview.fingerprint !== fingerprint) throw httpError(409, "The round changed after the preview. Review it again.");
    if (preview.blockers.length) throw httpError(409, preview.blockers.join(" "));
    const now = new Date();
    const result = await Application.bulkWrite(preview.changes.map((change) => ({ updateOne: {
      filter: { _id: change.applicationId, cycle: locked.cycle, status: change.from },
      update: { $set: { status: change.to }, $push: { statusHistory: { status: change.to, changedBy: adminEmail, changedAt: now, notes: `${locked.name} finalized: board decision ${change.result}.` } } }
    } })), { session });
    if (result.matchedCount !== preview.changes.length) throw httpError(409, "Applicant statuses changed. Preview again.");
    await Evaluation.updateMany({ roundId: locked._id, cycle: locked.cycle }, { $set: { locked: true } }, { session });
    await RecruitmentRound.updateOne({ _id: locked._id }, { $set: { status: "finalized", finalizedAt: now, finalizedBy: adminEmail } }, { session });
    await CaseGroupEditLog.create([{ cycle: locked.cycle, roundId: locked._id, action: "finalize", to: `${preview.changes.length} decisions`, by: adminEmail }], { session });
    return { finalized: true, updated: preview.changes.length };
  });
};

// Other grading surfaces must call this function so a concurrent finalization cannot be bypassed.
const saveEvaluation = async (round, { applicationId, result, notes = "" }, evaluator) => {
  if (!mongoose.isValidObjectId(applicationId) || !["Pass", "Fail"].includes(result) || typeof notes !== "string" || notes.length > 10000) throw httpError(400, "Provide an applicant, Pass or Fail, and notes of at most 10,000 characters.");
  return withRoundTransaction(round._id, async (locked, session) => {
    const group = await Group.findOne({ roundId: locked._id, cycle: locked.cycle, "members.applicationId": applicationId }).session(session);
    if (!group || group.members.find((m) => String(m.applicationId) === String(applicationId))?.status === "Cancelled") throw httpError(404, "Applicant is not assigned to this round.");
    const app = await Application.exists({ _id: applicationId, cycle: locked.cycle }).session(session);
    if (!app) throw httpError(404, "Applicant is not in this cycle.");
    return Evaluation.findOneAndUpdate({ roundId: locked._id, applicationId, evaluator, locked: false }, { $set: { cycle: locked.cycle, groupId: group._id, result, notes } }, { session, upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  });
};
module.exports = { buildPreview, loadPreview, finalizeRound, saveEvaluation };

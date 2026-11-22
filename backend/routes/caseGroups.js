const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const { requireAdminAuth, requireSuperAdmin } = require("../middleware/adminPermissions");
const { selectCycle } = require("../config/cycleConfig");
const config = require("../config/caseNightConfig");
const { ELIGIBLE_STATUS, buildCaseGroupPlan, planFingerprint, toAssignmentDocs } = require("../services/caseGroupBuilder");
const { listAssignments, replaceAssignments, getExistingStatus, editAssignment } = require("../services/caseGroupStore");
const { findRound, httpError } = require("../services/recruitmentRounds");
const { loadPreview, finalizeRound, saveEvaluation } = require("../services/roundFinalization");

router.use(requireAdminAuth, selectCycle);
const handle = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (error) {
    if (!error.status) console.error("Case group request failed:", error);
    res.status(error.status || 500).json({ error: error.status ? error.message : "Could not save or load case groups.", ...(error.warnings ? { warnings: error.warnings } : {}) });
  }
};
const planFromRequest = async (req) => buildCaseGroupPlan(
  await Application.find({ cycle: req.cycle, status: ELIGIBLE_STATUS }).select("fullName email candidateType caseNightPreferences studentYear createdAt status").lean(),
  config, { groupByYear: req.body?.groupByYear !== false }
);
const requestedRound = async (req) => {
  const kind = req.query.kind || "case-night";
  if (!["case-night", "final-interview"].includes(kind)) throw httpError(400, "Unknown round kind.");
  return findRound(req.cycle, kind);
};
const requireRound = async (req) => {
  const round = await requestedRound(req);
  if (!round) throw httpError(404, "This round has not been created yet.");
  return round;
};

router.get("/round", handle(async (req, res) => res.json({ round: await requestedRound(req) })));
router.get("/round/finalization", requireSuperAdmin, handle(async (req, res) => {
  const round = await requireRound(req);
  const preview = await loadPreview(round, []);
  res.json({ round, applicants: preview.changes.map((c) => ({ applicationId: c.applicationId, name: c.name, currentStatus: c.from, evaluations: c.evaluations, decision: null })) });
}));
router.post("/round/finalization/preview", requireSuperAdmin, handle(async (req, res) => res.json(await loadPreview(await requireRound(req), req.body.decisions))));
router.post("/round/finalize", requireSuperAdmin, handle(async (req, res) => res.json(await finalizeRound(await requireRound(req), req.body.decisions, req.body.fingerprint, req.admin.email))));
// Super-admin access is the existing board permission; Dev 2 can extend this with canGrade.
router.put("/round/evaluations", requireSuperAdmin, handle(async (req, res) => res.json(await saveEvaluation(await requireRound(req), req.body, req.admin.email))));

router.get("/assignments", handle(async (req, res) => res.json(await listAssignments(req.cycle))));
router.get("/summary", handle(async (req, res) => {
  const buckets = new Map();
  for (const a of await listAssignments(req.cycle, false)) {
    const key = `${a.candidateType}-${a.timeSlot}`;
    if (!buckets.has(key)) buckets.set(key, { _id: { candidateType: a.candidateType, timeSlot: a.timeSlot }, count: 0, groups: new Set() });
    const bucket = buckets.get(key); bucket.count++; bucket.groups.add(a.groupNumber);
  }
  res.json([...buckets.values()].map((b) => ({ ...b, groups: [...b.groups].sort((a, b) => a - b) })));
}));
router.get("/groups/:candidateType/:timeSlot/:groupNumber", handle(async (req, res) => {
  const { candidateType, timeSlot, groupNumber } = req.params;
  res.json((await listAssignments(req.cycle)).filter((a) => a.candidateType === candidateType && a.timeSlot === timeSlot && a.groupNumber === Number(groupNumber)));
}));
const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
};
router.get("/export", handle(async (req, res) => {
  const assignments = await listAssignments(req.cycle);
  if (!assignments.length) throw httpError(404, "No assignments found.");
  const rows = [["Candidate Type", "Time Slot", "Group Number", "Group ID", "Applicant Name", "Email", "Major", "Student Year", "Applied Before", "Status", "Assigned At"]];
  for (const a of assignments) rows.push([a.candidateType, a.timeSlotDisplay, a.groupNumber, a.groupId, a.applicantName, a.applicantEmail, a.applicationId?.major, a.applicationId?.studentYear, a.applicationId?.appliedBefore, a.status, a.assignedAt]);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="case-groups-${req.cycle}.csv"`);
  res.send(rows.map((row) => row.map(csvCell).join(",")).join("\n"));
}));
router.get("/unassigned", handle(async (req, res) => {
  const assignments = await listAssignments(req.cycle, false);
  res.json(await Application.find({ cycle: req.cycle, _id: { $nin: assignments.map((a) => a.applicationId) }, status: ELIGIBLE_STATUS }).select("email fullName candidateType caseNightPreferences studentYear"));
}));
router.post("/preview", requireSuperAdmin, handle(async (req, res) => {
  const round = await findRound(req.cycle);
  if (round?.status === "finalized") throw httpError(409, "This round is finalized.");
  const plan = await planFromRequest(req);
  res.json({ plan, fingerprint: planFingerprint(plan), existing: await getExistingStatus(req.cycle) });
}));
router.post("/build", requireSuperAdmin, handle(async (req, res) => {
  const plan = await planFromRequest(req);
  if (!req.body.fingerprint || req.body.fingerprint !== planFingerprint(plan)) throw httpError(409, "Applicants changed since the preview. Preview again before building.");
  if (plan.summary.placed === 0) throw httpError(400, "Nobody would be placed in a group, so the current groups were left alone.");
  const created = await replaceAssignments(toAssignmentDocs(plan, config, req.admin.email), req.admin.email, req.cycle);
  res.json({ created, summary: plan.summary });
}));
const edit = (action) => handle(async (req, res) => {
  const { applicationId, track, slot, groupNumber, confirmWarnings } = req.body || {};
  const result = await editAssignment({ cycle: req.cycle, action, assignmentId: req.params.id, applicationId, track, slot, groupNumber, confirmWarnings, adminEmail: req.admin.email });
  res.status(action === "add" ? 201 : 200).json(result);
});
router.post("/assignments", requireSuperAdmin, edit("add"));
router.patch("/assignments/:id", requireSuperAdmin, edit("move"));
router.delete("/assignments/:id", requireSuperAdmin, edit("remove"));
module.exports = router;

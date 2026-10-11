const express = require("express");
const router = express.Router();
const CaseGroupAssignment = require("../models/CaseGroupAssignment");
const Application = require("../models/Application");
const { requireAdminAuth, requireSuperAdmin } = require("../middleware/adminPermissions");
const CASE_NIGHT_CONFIG = require("../config/caseNightConfig");
const {
  ELIGIBLE_STATUS,
  TRACKS,
  makeGroupId,
  buildCaseGroupPlan,
  planFingerprint,
  toAssignmentDocs
} = require("../services/caseGroupBuilder");
const { replaceAssignments, getExistingStatus } = require("../services/caseGroupStore");
const { checkEditWarnings } = require("../services/caseGroupEdits");
const CaseGroupEditLog = require("../models/CaseGroupEditLog");
const mongoose = require("mongoose");

const loadEligibleApplications = () =>
  Application.find({ status: ELIGIBLE_STATUS })
    .select("fullName email candidateType caseNightPreferences createdAt status")
    .lean();

// Every case-group route exposes applicant data — admins only
router.use(requireAdminAuth);

// 🟢 Get all case group assignments
router.get("/assignments", async (req, res) => {
  try {
    const assignments = await CaseGroupAssignment.find()
      .populate('applicationId')
      .sort({ candidateType: 1, timeSlot: 1, groupNumber: 1 });

    res.json(assignments);
  } catch (error) {
    console.error("Error fetching case group assignments:", error);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

// 🟢 Get case group assignments summary
router.get("/summary", async (req, res) => {
  try {
    const summary = await CaseGroupAssignment.aggregate([
      {
        $group: {
          _id: {
            candidateType: "$candidateType",
            timeSlot: "$timeSlot"
          },
          count: { $sum: 1 },
          groups: { $addToSet: "$groupNumber" }
        }
      },
      {
        $sort: { "_id.candidateType": 1, "_id.timeSlot": 1 }
      }
    ]);

    res.json(summary);
  } catch (error) {
    console.error("Error fetching case group summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// 🟢 Get assignments by group
router.get("/groups/:candidateType/:timeSlot/:groupNumber", async (req, res) => {
  try {
    const { candidateType, timeSlot, groupNumber } = req.params;
    
    const groupMembers = await CaseGroupAssignment.find({
      candidateType,
      timeSlot,
      groupNumber: parseInt(groupNumber)
    }).populate('applicationId');

    res.json(groupMembers);
  } catch (error) {
    console.error("Error fetching group members:", error);
    res.status(500).json({ error: "Failed to fetch group members" });
  }
});

// 🟢 Export case groups to CSV
router.get("/export", async (req, res) => {
  try {
    const assignments = await CaseGroupAssignment.find()
      .populate('applicationId')
      .sort({ candidateType: 1, timeSlot: 1, groupNumber: 1 });

    if (assignments.length === 0) {
      return res.status(404).json({ error: "No assignments found" });
    }

    // Create CSV content
    const csvHeaders = [
      'Candidate Type',
      'Time Slot',
      'Group Number',
      'Group ID',
      'Applicant Name',
      'Email',
      'Major',
      'Student Year',
      'Applied Before',
      'Status',
      'Assigned At'
    ];

    const csvRows = [csvHeaders.join(',')];

    assignments.forEach(assignment => {
      const row = [
        assignment.candidateType,
        assignment.timeSlotDisplay,
        assignment.groupNumber,
        assignment.groupId,
        `"${assignment.applicantName}"`, // Wrap in quotes to handle commas in names
        assignment.applicantEmail,
        `"${assignment.applicationId?.major || ''}"`,
        assignment.applicationId?.studentYear || '',
        assignment.applicationId?.appliedBefore || '',
        assignment.status,
        new Date(assignment.assignedAt).toLocaleString()
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="case-group-assignments-${new Date().toISOString().split('T')[0]}.csv"`);
    
    res.send(csvContent);

  } catch (error) {
    console.error("Error exporting case groups:", error);
    res.status(500).json({ error: "Failed to export case groups" });
  }
});

// 🟢 Get unassigned applications (for reference)
router.get("/unassigned", async (req, res) => {
  try {
    const unassigned = await Application.find({
      _id: { $nin: await CaseGroupAssignment.distinct('applicationId') },
      status: ELIGIBLE_STATUS
    }).select('email fullName candidateType caseNightPreferences');

    res.json(unassigned);
  } catch (error) {
    console.error("Error fetching unassigned applications:", error);
    res.status(500).json({ error: "Failed to fetch unassigned applications" });
  }
});

// 🟢 Preview automatic case groups (super admins; writes nothing)
router.post("/preview", requireSuperAdmin, async (req, res) => {
  try {
    const plan = buildCaseGroupPlan(await loadEligibleApplications(), CASE_NIGHT_CONFIG);
    res.json({ plan, fingerprint: planFingerprint(plan), existing: await getExistingStatus() });
  } catch (error) {
    console.error("Error previewing case groups:", error);
    res.status(500).json({ error: "Failed to preview case groups" });
  }
});

// 🟢 Build case groups, replacing all current assignments (super admins)
router.post("/build", requireSuperAdmin, async (req, res) => {
  try {
    const plan = buildCaseGroupPlan(await loadEligibleApplications(), CASE_NIGHT_CONFIG);
    if (!req.body?.fingerprint || req.body.fingerprint !== planFingerprint(plan)) {
      return res.status(409).json({ error: "Applicants changed since the preview. Preview again before building." });
    }
    if (plan.summary.placed === 0) {
      return res.status(400).json({ error: "Nobody would be placed in a group, so the current groups were left alone." });
    }

    const created = await replaceAssignments(toAssignmentDocs(plan, CASE_NIGHT_CONFIG, req.admin.email), req.admin.email);
    res.json({ created, summary: plan.summary });
  } catch (error) {
    console.error("Error building case groups:", error);
    res.status(error.status || 500).json({ error: error.status ? error.message : "Failed to build case groups" });
  }
});

/* =========================
   Hand edits (super admins)
   ========================= */

const httpError = (status, message) => Object.assign(new Error(message), { status });

const sendError = (res, error, fallback) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(`${fallback}:`, error);
  res.status(500).json({ error: fallback });
};

// A group is identified by track + slot + number (older assignments have groupIds without the track)
const groupFilter = ({ candidateType, timeSlot, groupNumber }) => ({ candidateType, timeSlot, groupNumber });

const groupFields = (target) => ({
  candidateType: target.track,
  timeSlot: target.slot,
  timeSlotDisplay: CASE_NIGHT_CONFIG.slots[target.slot],
  groupNumber: target.groupNumber,
  groupId: target.groupId
});

const loadApplication = (id) =>
  Application.findById(id).select("fullName email candidateType caseNightPreferences").lean();

const loadAssignment = async (id) => {
  const assignment = mongoose.isValidObjectId(id) ? await CaseGroupAssignment.findById(id).lean() : null;
  if (!assignment) throw httpError(404, "Assignment not found.");
  return assignment;
};

// The group an admin picked, or the next free group number for "new"
const resolveTargetGroup = async ({ track, slot, groupNumber }) => {
  if (!TRACKS.includes(track) || !CASE_NIGHT_CONFIG.slots[slot]) {
    throw httpError(400, "Pick a valid track and time slot.");
  }

  if (groupNumber === "new") {
    const last = await CaseGroupAssignment.findOne({ candidateType: track, timeSlot: slot }).sort({ groupNumber: -1 }).lean();
    const number = (last?.groupNumber || 0) + 1;
    return { track, slot, groupNumber: number, groupId: makeGroupId(track, slot, number), members: [] };
  }

  const number = Number(groupNumber);
  const members = await CaseGroupAssignment.find({ candidateType: track, timeSlot: slot, groupNumber: number }).lean();
  if (members.length === 0) throw httpError(404, "That group doesn't exist.");
  return { track, slot, groupNumber: number, groupId: members[0].groupId, members };
};

// Sends the warnings back (409) unless the admin already confirmed them; returns true if it did
const needsConfirmation = (res, warnings, confirmWarnings) => {
  if (warnings.length === 0 || confirmWarnings === true) return false;
  res.status(409).json({ error: "Please confirm these warnings.", warnings });
  return true;
};

// 🟢 Add an unassigned applicant to a group
router.post("/assignments", requireSuperAdmin, async (req, res) => {
  try {
    const { applicationId, track, slot, groupNumber, confirmWarnings } = req.body || {};
    const application = mongoose.isValidObjectId(applicationId) ? await loadApplication(applicationId) : null;
    if (!application) throw httpError(404, "Application not found.");

    const existing = await CaseGroupAssignment.findOne({ applicationId }).lean();
    if (existing) throw httpError(409, `${application.fullName} is already in ${existing.groupId}.`);

    const target = await resolveTargetGroup({ track, slot, groupNumber });
    const warnings = checkEditWarnings({
      application,
      target,
      source: null,
      emailsSent: target.members.some((m) => m.emailSent),
      config: CASE_NIGHT_CONFIG
    });
    if (needsConfirmation(res, warnings, confirmWarnings)) return;

    // Upsert keyed on the application, so two admins can't put the same person in two groups
    const now = new Date();
    const result = await CaseGroupAssignment.updateOne(
      { applicationId },
      {
        $setOnInsert: {
          applicationId,
          applicantName: application.fullName,
          applicantEmail: application.email,
          ...groupFields(target),
          assignedBy: req.admin.email,
          assignedAt: now,
          status: "Assigned",
          lastEditedBy: req.admin.email,
          lastEditedAt: now
        }
      },
      { upsert: true }
    );
    if (!result.upsertedCount) {
      throw httpError(409, `${application.fullName} was just added to a group by someone else. Refresh to see it.`);
    }

    // Two simultaneous adds can both insert (there's no unique index on applicationId).
    // Every racer keeps the lowest id, so exactly one assignment survives.
    const ids = (await CaseGroupAssignment.distinct("_id", { applicationId })).map(String).sort();
    if (ids.length > 1 && ids[0] !== String(result.upsertedId)) {
      await CaseGroupAssignment.deleteOne({ _id: result.upsertedId });
      throw httpError(409, `${application.fullName} was just added to a group by someone else. Refresh to see it.`);
    }

    await CaseGroupEditLog.create({
      action: "add",
      applicationId,
      applicantName: application.fullName,
      to: target.groupId,
      by: req.admin.email
    });
    res.status(201).json({ groupId: target.groupId });
  } catch (error) {
    sendError(res, error, "Failed to add to case group");
  }
});

// 🟢 Move someone to another group
router.patch("/assignments/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { track, slot, groupNumber, confirmWarnings } = req.body || {};
    const assignment = await loadAssignment(req.params.id);
    const target = await resolveTargetGroup({ track, slot, groupNumber });
    if (
      target.track === assignment.candidateType &&
      target.slot === assignment.timeSlot &&
      target.groupNumber === assignment.groupNumber
    ) {
      throw httpError(400, `Already in ${assignment.groupId}.`);
    }

    const [application, sourceSize] = await Promise.all([
      loadApplication(assignment.applicationId),
      CaseGroupAssignment.countDocuments(groupFilter(assignment))
    ]);
    const warnings = checkEditWarnings({
      application: application || { fullName: assignment.applicantName },
      target: application ? target : null,
      source: { groupId: assignment.groupId, remaining: sourceSize - 1 },
      emailsSent: Boolean(assignment.emailSent) || target.members.some((m) => m.emailSent),
      config: CASE_NIGHT_CONFIG
    });
    if (needsConfirmation(res, warnings, confirmWarnings)) return;

    // Only matches if they're still in the group we read, so a concurrent edit isn't overwritten
    const result = await CaseGroupAssignment.updateOne(
      { _id: assignment._id, ...groupFilter(assignment) },
      { $set: { ...groupFields(target), lastEditedBy: req.admin.email, lastEditedAt: new Date() } }
    );
    if (!result.modifiedCount) throw httpError(409, "This person was just changed by someone else. Refresh and try again.");

    await CaseGroupEditLog.create({
      action: "move",
      applicationId: assignment.applicationId,
      applicantName: assignment.applicantName,
      from: assignment.groupId,
      to: target.groupId,
      by: req.admin.email
    });
    res.json({ groupId: target.groupId });
  } catch (error) {
    sendError(res, error, "Failed to move case group member");
  }
});

// 🟢 Take someone out of their group. Only the group assignment is deleted; the application is untouched.
router.delete("/assignments/:id", requireSuperAdmin, async (req, res) => {
  try {
    const assignment = await loadAssignment(req.params.id);
    const sourceSize = await CaseGroupAssignment.countDocuments(groupFilter(assignment));
    const warnings = checkEditWarnings({
      application: { fullName: assignment.applicantName },
      target: null,
      source: { groupId: assignment.groupId, remaining: sourceSize - 1 },
      emailsSent: Boolean(assignment.emailSent),
      config: CASE_NIGHT_CONFIG
    });
    if (needsConfirmation(res, warnings, req.body?.confirmWarnings)) return;

    const result = await CaseGroupAssignment.deleteOne({ _id: assignment._id, ...groupFilter(assignment) });
    if (!result.deletedCount) throw httpError(409, "This person was just changed by someone else. Refresh and try again.");

    await CaseGroupEditLog.create({
      action: "remove",
      applicationId: assignment.applicationId,
      applicantName: assignment.applicantName,
      from: assignment.groupId,
      by: req.admin.email
    });
    res.json({ removed: true });
  } catch (error) {
    sendError(res, error, "Failed to remove case group member");
  }
});

module.exports = router;

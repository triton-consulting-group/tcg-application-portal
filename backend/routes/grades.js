const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Grade = require("../models/Grade");
const Application = require("../models/Application");
const { requireAdminAuth } = require("../middleware/adminPermissions");
const { generalApiLimiter } = require("../middleware/rateLimiter");
const {
  ROUNDS,
  GRADED_STATUSES,
  DECISIONS,
  REQUIRED_GRADES,
  roundForStatus,
  summarizeGrades
} = require("../services/gradeProgress");

// Grading is for active admins only; the limiter is keyed by the verified email requireAdminAuth sets
router.use(requireAdminAuth, generalApiLimiter);

const reviewerEmail = (req) => req.verifiedEmail.toLowerCase();

const loadStatus = async (id) =>
  mongoose.isValidObjectId(id) ? Application.findById(id).select("status").lean() : null;

// Live progress board: every applicant in a graded round, with blind-grading redaction per viewer
router.get("/progress", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const viewerEmail = reviewerEmail(req);
    const canSeeAll = req.admin.role === "super_admin";

    const applications = await Application.find({ status: { $in: GRADED_STATUSES } })
      .select("fullName candidateType status")
      .sort({ fullName: 1 })
      .lean();
    const grades = await Grade.find({ applicationId: { $in: applications.map((a) => a._id) } })
      .select("applicationId round adminEmail decision")
      .lean();

    const gradesByKey = new Map();
    grades.forEach((g) => {
      const key = `${g.applicationId}:${g.round}`;
      if (!gradesByKey.has(key)) gradesByKey.set(key, []);
      gradesByKey.get(key).push(g);
    });

    const applicants = applications.map((app) => {
      const round = roundForStatus(app.status);
      return {
        applicationId: app._id,
        fullName: app.fullName,
        candidateType: app.candidateType,
        status: app.status,
        round,
        ...summarizeGrades(gradesByKey.get(`${app._id}:${round}`) || [], { viewerEmail, canSeeAll })
      };
    });

    // Totals only count splits this viewer is allowed to see
    const rounds = Object.fromEntries(
      ROUNDS.map((round) => {
        const inRound = applicants.filter((a) => a.round === round);
        return [round, {
          total: inRound.length,
          graded: inRound.filter((a) => !a.ungraded).length,
          ungraded: inRound.filter((a) => a.ungraded).length,
          split: inRound.filter((a) => a.split === true).length
        }];
      })
    );

    res.json({ requiredGrades: REQUIRED_GRADES, canSeeAll, rounds, applicants });
  } catch (error) {
    console.error("Error loading grading progress:", error);
    res.status(500).json({ error: "❌ Failed to load grading progress." });
  }
});

// The signed-in reviewer's own grade for an applicant's current round (never anyone else's)
router.get("/:applicationId/mine", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const application = await loadStatus(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ error: "❌ Application not found." });
    }
    const round = roundForStatus(application.status);
    if (!round) {
      return res.json({ round: null, decision: null });
    }
    const grade = await Grade.findOne({ applicationId: application._id, round, adminEmail: reviewerEmail(req) })
      .select("decision")
      .lean();
    res.json({ round, decision: grade ? grade.decision : null });
  } catch (error) {
    console.error("Error loading grade:", error);
    res.status(500).json({ error: "❌ Failed to load your grade." });
  }
});

// Set or change the signed-in reviewer's grade for the applicant's current round.
// Body: { decision, round } where round is the round the reviewer is looking at; it must match the
// applicant's current round, so a stale page or an unsaved status change can't grade the wrong round.
router.put("/:applicationId", async (req, res) => {
  try {
    const decision = req.body?.decision;
    if (!DECISIONS.includes(decision)) {
      return res.status(400).json({ error: "❌ Grade must be Yes, No, or Maybe." });
    }
    const expectedRound = req.body?.round;
    if (!ROUNDS.includes(expectedRound)) {
      return res.status(400).json({ error: "❌ Grade must say which round it's for." });
    }
    const application = await loadStatus(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ error: "❌ Application not found." });
    }
    // The round comes from the applicant's status, never the request
    const round = roundForStatus(application.status);
    if (!round) {
      return res.status(409).json({
        error: "❌ Only applicants in Case Night - Yes or Final Interview - Yes can be graded."
      });
    }
    if (round !== expectedRound) {
      return res.status(409).json({
        error: "❌ This applicant's status changed, so they're in a different round now. Reopen them and grade again."
      });
    }

    // The reviewer comes from the verified token, never the request body
    const filter = { applicationId: application._id, round, adminEmail: reviewerEmail(req) };
    const save = () =>
      Grade.findOneAndUpdate(
        filter,
        { $set: { decision, adminName: req.admin.name || "" } },
        { upsert: true, new: true, runValidators: true }
      ).lean();

    let grade;
    try {
      grade = await save();
    } catch (error) {
      // Two simultaneous first grades from the same reviewer race on the unique index; the retry updates
      if (error.code !== 11000) throw error;
      grade = await save();
    }
    res.json({ round, decision: grade.decision });
  } catch (error) {
    console.error("Error saving grade:", error);
    res.status(500).json({ error: "❌ Failed to save grade." });
  }
});

module.exports = router;

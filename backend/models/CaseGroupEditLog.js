const mongoose = require("mongoose");

// One entry per case group change: a full build, or a hand edit (add / move / remove)
const CaseGroupEditLogSchema = new mongoose.Schema({
  cycle: { type: String, default: "2026-fall", index: true },
  roundId: { type: mongoose.Schema.Types.ObjectId, ref: "RecruitmentRound" },
  action: { type: String, enum: ["build", "add", "move", "remove", "migrate", "finalize"], required: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application" },
  applicantName: { type: String },
  from: { type: String }, // groupId before the change
  to: { type: String }, // groupId after the change (or, for a build, how many assignments it made)
  by: { type: String, required: true }, // Admin email
  at: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("CaseGroupEditLog", CaseGroupEditLogSchema);

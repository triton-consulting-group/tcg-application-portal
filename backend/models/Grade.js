const mongoose = require("mongoose");
const { ROUNDS, DECISIONS } = require("../services/gradeProgress");

// One reviewer's grade for one applicant in one round. Kept out of the Application document so
// applicant-facing routes, which return that document, can never expose how reviewers voted.
const GradeSchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true, index: true },
    round: { type: String, enum: ROUNDS, required: true },
    adminEmail: { type: String, required: true, lowercase: true, trim: true },
    adminName: { type: String, default: "" },
    decision: { type: String, enum: DECISIONS, required: true }
  },
  { timestamps: true }
);

// One grade per reviewer per applicant per round; grading again replaces it
GradeSchema.index({ applicationId: 1, round: 1, adminEmail: 1 }, { unique: true });

module.exports = mongoose.model("Grade", GradeSchema);

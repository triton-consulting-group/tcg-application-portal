const mongoose = require("mongoose");
const EvaluationSchema = new mongoose.Schema({
  cycle: { type: String, required: true },
  roundId: { type: mongoose.Schema.Types.ObjectId, ref: "RecruitmentRound", required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
  evaluator: { type: String, required: true, lowercase: true, trim: true },
  result: { type: String, enum: ["Pass", "Fail"], required: true },
  notes: { type: String, default: "" },
  locked: { type: Boolean, default: false }
}, { timestamps: true });
EvaluationSchema.index({ roundId: 1, applicationId: 1, evaluator: 1 }, { unique: true });
EvaluationSchema.index({ cycle: 1, roundId: 1, groupId: 1 });
module.exports = mongoose.model("Evaluation", EvaluationSchema);

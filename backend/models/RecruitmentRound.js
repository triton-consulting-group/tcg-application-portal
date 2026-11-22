const mongoose = require("mongoose");
const RecruitmentRoundSchema = new mongoose.Schema({
  cycle: { type: String, required: true },
  kind: { type: String, enum: ["case-night", "final-interview"], required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ["draft", "published", "finalized"], default: "draft" },
  revision: { type: Number, default: 0 },
  finalizedAt: Date,
  finalizedBy: String,
  legacyMigratedAt: Date
}, { timestamps: true });
RecruitmentRoundSchema.index({ cycle: 1, kind: 1 }, { unique: true });
module.exports = mongoose.model("RecruitmentRound", RecruitmentRoundSchema);

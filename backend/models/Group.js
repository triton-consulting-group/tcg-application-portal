const mongoose = require("mongoose");
const MemberSchema = new mongoose.Schema({
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
  applicantName: { type: String, required: true },
  applicantEmail: { type: String, required: true },
  assignedAt: { type: Date, default: Date.now },
  assignedBy: { type: String, required: true },
  emailSent: { type: Boolean, default: false },
  emailSentAt: Date,
  emailError: String,
  status: { type: String, enum: ["Assigned", "Confirmed", "Cancelled"], default: "Assigned" },
  lastEditedBy: String,
  lastEditedAt: Date,
  notes: String
});
const GroupSchema = new mongoose.Schema({
  cycle: { type: String, required: true },
  roundId: { type: mongoose.Schema.Types.ObjectId, ref: "RecruitmentRound", required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
  groupId: { type: String, required: true },
  candidateType: { type: String, enum: ["Tech", "Non-Tech"], required: true },
  timeSlot: { type: String, required: true },
  timeSlotDisplay: { type: String, required: true },
  groupNumber: { type: Number, min: 1, required: true },
  members: { type: [MemberSchema], default: [] },
  notes: { type: String, default: "" }
}, { timestamps: true });
GroupSchema.index({ roundId: 1, candidateType: 1, timeSlot: 1, groupNumber: 1 }, { unique: true });
GroupSchema.index({ roundId: 1, "members.applicationId": 1 }, { unique: true, partialFilterExpression: { "members.applicationId": { $exists: true } } });
GroupSchema.index({ cycle: 1, roundId: 1 });
GroupSchema.pre("validate", function(next) {
  const ids = this.members.map((member) => String(member.applicationId));
  if (new Set(ids).size !== ids.length) this.invalidate("members", "An applicant can only appear once in a group.");
  next();
});
module.exports = mongoose.model("Group", GroupSchema);

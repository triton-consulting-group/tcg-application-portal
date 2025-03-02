const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    fullName: { type: String, required: true },
    studentYear: { type: String, required: true },
    major: { type: String, required: true },
    appliedBefore: { type: String, required: true }, 
    candidateType: { type: String, required: true },
    reason: { type: String, required: true },
    resume: { type: String, default: null },
    transcript: { type: String, default: null },
    image: { type: String, default: null },
    status: { 
      type: String, 
      enum: ["Under Review", "Maybe", "Accepted", "Rejected"], 
      default: "Under Review" // ✅ Default status when an application is submitted
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", ApplicationSchema);

const mongoose = require("mongoose");
const { getActiveCycle, CYCLE_PATTERN } = require("../config/cycleConfig");
const { PHONE_PATTERN } = require("../utils/phone");

const ApplicationSchema = new mongoose.Schema(
  {
    cycle: { type: String, required: true, default: getActiveCycle, match: CYCLE_PATTERN },
    email: { type: String, required: true, lowercase: true, trim: true },
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true, trim: true, match: PHONE_PATTERN }, // E.164, normalized by the routes
    studentYear: { type: String, required: true },
    major: { type: String, required: true },
    appliedBefore: { type: String, required: true }, 
    candidateType: { type: String, required: true },
    reason: { type: String, required: true },
    // Optional additional applicant-provided fields
    zombieAnswer: { type: String, default: "" },
    additionalInfo: { type: String, default: "" },
    caseNightPreferences: { 
      type: [String], 
      default: [] 
    },
    resume: { type: String, default: null },
    transcript: { type: String, default: null },
    image: { type: String, default: null },
    status: { 
      type: String, 
      enum: ["Under Review", "Case Night - Yes", "Case Night - No", "Final Interview - Yes", "Final Interview - No", "Final Interview - Maybe", "Accepted", "Rejected"], 
      default: "Under Review", // ✅ Default status when a new application is submitted
      index: true // Index for status filtering
    },
    statusHistory: [{
      status: { 
        type: String, 
        enum: ["Under Review", "Case Night - Yes", "Case Night - No", "Final Interview - Yes", "Final Interview - No", "Final Interview - Maybe", "Accepted", "Rejected"]
      },
      changedBy: { type: String, required: true }, // Admin email
      changedAt: { type: Date, default: Date.now },
      notes: { type: String } // Optional notes for the status change
    }],
    comments: [{
      comment: { type: String, required: true },
      commentedBy: { type: String, required: true }, // Admin email
      commentedAt: { type: Date, default: Date.now },
      adminName: { type: String, required: true } // Admin name for display
    }],
  },
  { timestamps: true }
);

ApplicationSchema.index({ cycle: 1, email: 1 }, { unique: true });
ApplicationSchema.index({ cycle: 1, status: 1, createdAt: -1 });
ApplicationSchema.index({ cycle: 1, major: 1, status: 1 });

module.exports = mongoose.model("Application", ApplicationSchema);

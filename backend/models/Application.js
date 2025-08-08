const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true }, // Index for email lookups
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
  },
  { 
    timestamps: true,
    // Compound index for common queries
    indexes: [
      { email: 1, status: 1 }, // For filtering by email and status
      { status: 1, createdAt: -1 }, // For status-based queries with date sorting
      { major: 1, status: 1 }, // For filtering by major and status
    ]
  }
);

module.exports = mongoose.model("Application", ApplicationSchema);

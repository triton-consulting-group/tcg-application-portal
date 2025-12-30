const mongoose = require("mongoose");

const CaseGroupAssignmentSchema = new mongoose.Schema(
  {
    // Application reference
    applicationId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Application", 
      required: true,
      index: true 
    },
    
    // Applicant details (for easy export and email)
    applicantName: { type: String, required: true },
    applicantEmail: { type: String, required: true, index: true },
    candidateType: { type: String, enum: ["Tech", "Non-Tech"], required: true },
    
    // Case night assignment details
    timeSlot: { 
      type: String, 
      enum: ["A", "B", "C"], 
      required: true,
      index: true 
    },
    timeSlotDisplay: { type: String, required: true }, // e.g., "6:00 PM-7:00 PM"
    
    // Group assignment
    groupNumber: { type: Number, required: true },
    groupId: { type: String, required: true, index: true }, // e.g., "A-1", "B-3", "C-2"
    
    // Assignment metadata
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: String, required: true }, // Admin email who made the assignment
    
    // Email notification status
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    emailError: { type: String }, // If email failed
    
    // Status tracking
    status: { 
      type: String, 
      enum: ["Assigned", "Confirmed", "Cancelled"], 
      default: "Assigned",
      index: true 
    },
    
    // Notes for admin use
    notes: { type: String }
  },
  { 
    timestamps: true,
    indexes: [
      { timeSlot: 1, groupNumber: 1 }, // For group queries
      { candidateType: 1, timeSlot: 1 }, // For capacity tracking
      { emailSent: 1, status: 1 }, // For email processing
    ]
  }
);

// Index for group queries (not unique - multiple people can be in same group)
CaseGroupAssignmentSchema.index({ timeSlot: 1, groupNumber: 1, candidateType: 1 });

// Virtual for full group identifier
CaseGroupAssignmentSchema.virtual('fullGroupId').get(function() {
  return `${this.timeSlot}-${this.groupNumber}`;
});

// Method to get group members
CaseGroupAssignmentSchema.methods.getGroupMembers = async function() {
  return await this.model('CaseGroupAssignment').find({
    timeSlot: this.timeSlot,
    groupNumber: this.groupNumber,
    candidateType: this.candidateType
  }).populate('applicationId');
};

module.exports = mongoose.model("CaseGroupAssignment", CaseGroupAssignmentSchema);

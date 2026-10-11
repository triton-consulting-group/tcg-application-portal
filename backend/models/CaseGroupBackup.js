const mongoose = require("mongoose");

// A full copy of the case group assignments that a build replaced, so a rebuild can be undone by hand
const CaseGroupBackupSchema = new mongoose.Schema({
  assignments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  replacedAt: { type: Date, default: Date.now },
  replacedBy: { type: String, required: true } // Admin email
});

module.exports = mongoose.model("CaseGroupBackup", CaseGroupBackupSchema);

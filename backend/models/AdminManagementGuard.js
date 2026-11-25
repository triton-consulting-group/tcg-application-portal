const mongoose = require("mongoose");

// All directory writes touch this document inside their transaction. Concurrent
// requests then conflict and retry before reading roles or counting super admins.
const schema = new mongoose.Schema({
  _id: String,
  revision: { type: Number, default: 0 }
}, { versionKey: false });

module.exports = mongoose.model("AdminManagementGuard", schema);

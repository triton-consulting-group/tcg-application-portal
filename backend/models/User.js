const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String },
  role: { type: String, enum: ["associate", "applicant"], default: "applicant" }, // Default: applicant
});

module.exports = mongoose.model("User", UserSchema);

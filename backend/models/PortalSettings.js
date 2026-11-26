const mongoose = require("mongoose");

// Portal-wide presentation/configuration; intentionally independent of cycle IDs.
module.exports = mongoose.model("PortalSettings", new mongoose.Schema({
  _id: { type: String, default: "portal" },
  revision: { type: Number, required: true },
  values: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedBy: String
}, { timestamps: true, versionKey: false }));

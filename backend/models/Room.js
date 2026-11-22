const mongoose = require("mongoose");
const RoomSchema = new mongoose.Schema({
  cycle: { type: String, required: true },
  roundId: { type: mongoose.Schema.Types.ObjectId, ref: "RecruitmentRound", required: true },
  name: { type: String, required: true },
  location: { type: String, default: "" },
  timeSlot: { type: String, required: true },
  capacity: { type: Number, min: 1, required: true },
  notes: { type: String, default: "" },
  casers: [{ type: String, lowercase: true, trim: true }]
}, { timestamps: true });
RoomSchema.index({ roundId: 1, name: 1, timeSlot: 1 }, { unique: true });
RoomSchema.index({ cycle: 1, roundId: 1 });
module.exports = mongoose.model("Room", RoomSchema);

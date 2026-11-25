const Admin = require("../models/Admin");
const Guard = require("../models/AdminManagementGuard");

module.exports = async function adminManagementWrite(email, operation) {
  // Create the singleton outside the transaction; its unique _id handles races.
  try {
    await Guard.updateOne({ _id: "directory" }, { $setOnInsert: { revision: 0 } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  // This project's MongoDB driver returns commit metadata, not callback data.
  let result;
  await Admin.db.transaction(async session => {
    await Guard.updateOne({ _id: "directory" }, { $inc: { revision: 1 } }, { session });
    // Middleware's authorization may have become stale while this request waited.
    const actor = await Admin.findOne({ email, isActive: true }, null, { session });
    if (!actor || (actor.role !== "super_admin" && !actor.permissions?.canManageAdmins)) {
      result = { status: 403, body: { error: "Insufficient permissions" } };
      return;
    }
    // Callbacks must return response data, never send a response: MongoDB may retry.
    result = await operation(actor, session);
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
  return result;
};

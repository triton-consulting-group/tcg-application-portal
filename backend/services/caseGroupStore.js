const mongoose = require("mongoose");
const CaseGroupAssignment = require("../models/CaseGroupAssignment");
const CaseGroupBackup = require("../models/CaseGroupBackup");
const CaseGroupEditLog = require("../models/CaseGroupEditLog");

// Standalone MongoDB (not a replica set) can't run transactions. Match the exact error code only,
// so an outage error that merely mentions a replica set never takes the non-transactional path.
const isTransactionUnsupported = (error) => error?.code === 20 || error?.codeName === "IllegalOperation";

// Without a transaction: delete then insert, and put the old assignments back if the insert fails
const swapWithoutTransaction = async (docs, previous) => {
  await CaseGroupAssignment.deleteMany({});
  try {
    await CaseGroupAssignment.insertMany(docs);
  } catch (error) {
    await CaseGroupAssignment.deleteMany({});
    if (previous.length > 0) await CaseGroupAssignment.insertMany(previous);
    throw error;
  }
};

// Replaces every case group assignment with newAssignments (plain objects).
// Validates all of them first, backs up the current set, then swaps in one transaction,
// so a failure at any step leaves the old assignments in place.
const replaceAssignments = async (newAssignments, adminEmail) => {
  const docs = newAssignments.map((fields) => new CaseGroupAssignment(fields));
  for (const doc of docs) {
    const invalid = doc.validateSync();
    if (invalid) {
      const error = new Error(`Invalid assignment for ${doc.applicantEmail}: ${invalid.message}`);
      error.status = 400;
      throw error;
    }
  }

  const previous = await CaseGroupAssignment.find().lean();
  await CaseGroupBackup.create({ assignments: previous, replacedBy: adminEmail });

  let session;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await CaseGroupAssignment.deleteMany({}, { session });
      await CaseGroupAssignment.insertMany(docs, { session });
    });
  } catch (error) {
    if (!isTransactionUnsupported(error)) throw error;
    await swapWithoutTransaction(docs, previous);
  } finally {
    await session?.endSession();
  }

  await CaseGroupEditLog.create({ action: "build", to: `${docs.length} assignments`, by: adminEmail });
  return docs.length;
};

// What the build preview warns about: existing assignments, sent emails, and hand edits a rebuild would discard
const getExistingStatus = async () => {
  const [count, emailsSent, lastBuild] = await Promise.all([
    CaseGroupAssignment.countDocuments(),
    CaseGroupAssignment.countDocuments({ emailSent: true }),
    CaseGroupEditLog.findOne({ action: "build" }).sort({ at: -1 }).lean()
  ]);
  const handEditsSinceBuild = await CaseGroupEditLog.countDocuments({
    action: { $ne: "build" },
    ...(lastBuild ? { at: { $gt: lastBuild.at } } : {})
  });
  return { count, emailsSent, handEditsSinceBuild };
};

module.exports = { replaceAssignments, getExistingStatus };

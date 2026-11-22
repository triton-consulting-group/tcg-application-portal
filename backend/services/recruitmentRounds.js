const mongoose = require("mongoose");
const RecruitmentRound = require("../models/RecruitmentRound");
const CaseGroupAssignment = require("../models/CaseGroupAssignment");
const { getActiveCycle, LEGACY_CYCLE } = require("../config/cycleConfig");
const httpError = (status, message) => Object.assign(new Error(message), { status });

const findRound = (cycle = getActiveCycle(), kind = "case-night") => RecruitmentRound.findOne({ cycle, kind });

// Legacy records remain untouched until the explicit, backed-up migration is run.
const ensureRound = async (cycle = getActiveCycle(), kind = "case-night") => {
  const existing = await findRound(cycle, kind);
  if (existing) return existing;
  if (cycle === LEGACY_CYCLE && kind === "case-night" && await CaseGroupAssignment.exists({})) {
    throw httpError(409, "Migrate the existing case groups before opening this round.");
  }
  return RecruitmentRound.findOneAndUpdate({ cycle, kind }, { $setOnInsert: {
    cycle, kind, name: kind === "case-night" ? "Case Night" : "Final Interview"
  } }, { upsert: true, new: true, setDefaultsOnInsert: true });
};

// Every writer takes the same round write lock, including grading and finalization.
const withRoundTransaction = async (roundId, work) => {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const round = await RecruitmentRound.findOneAndUpdate(
        { _id: roundId, status: { $ne: "finalized" } },
        { $inc: { revision: 1 } }, { new: true, session }
      );
      if (!round) throw httpError(409, "This round is finalized. Its groups and grades are locked.");
      result = await work(round, session);
    });
    return result;
  } catch (error) {
    if (error.code === 20 || error.codeName === "IllegalOperation") {
      throw httpError(503, "Round changes require a MongoDB replica set so groups, grades and history save together.");
    }
    throw error;
  } finally {
    await session.endSession();
  }
};
module.exports = { findRound, ensureRound, withRoundTransaction, httpError };

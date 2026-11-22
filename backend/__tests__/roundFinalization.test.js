const mongoose = require("mongoose");
const { buildPreview, finalizeRound, saveEvaluation } = require("../services/roundFinalization");
const RecruitmentRound = require("../models/RecruitmentRound");
const Group = require("../models/Group");
const Application = require("../models/Application");
const Evaluation = require("../models/Evaluation");
const CaseGroupEditLog = require("../models/CaseGroupEditLog");
const rid = new mongoose.Types.ObjectId();
const gid = new mongoose.Types.ObjectId();
const aid = new mongoose.Types.ObjectId();
const round = { _id: rid, cycle: "2026-fall", kind: "case-night", name: "Case Night", status: "draft" };
const groups = [{ _id: gid, members: [{ applicationId: aid, applicantName: "A", status: "Assigned" }] }];
const apps = [{ _id: aid, fullName: "A", status: "Case Night - Yes" }];
const votes = [{ applicationId: aid, groupId: gid, evaluator: "first@example.test", result: "Pass", notes: "ok" }, { applicationId: aid, groupId: gid, evaluator: "second@example.test", result: "Fail" }];
const decisions = [{ applicationId: String(aid), result: "Pass" }];
const query = (v) => ({ session: () => query(v), lean: async () => v, then: (resolve, reject) => Promise.resolve(v).then(resolve, reject) });

test("split grades need an explicit board decision; no majority policy is inferred", () => {
  const missing = buildPreview(round, groups, apps, votes, []);
  expect(missing.blockers.join(" ")).toMatch(/choose the board/);
  const preview = buildPreview(round, groups, apps, votes, decisions);
  expect(preview.blockers).toEqual([]);
  expect(preview.changes[0]).toMatchObject({ from: "Case Night - Yes", to: "Final Interview - Yes", result: "Pass" });
  expect(preview.changes[0].evaluations).toHaveLength(2);
});
test("final interview decisions lead to Accepted or Rejected", () => {
  expect(buildPreview({ ...round, kind: "final-interview" }, groups, [{ ...apps[0], status: "Final Interview - Yes" }], votes, [{ ...decisions[0], result: "Fail" }]).changes[0].to).toBe("Rejected");
});
test("missing grades, missing apps, wrong statuses, duplicate members and finalized rounds block commit", () => {
  expect(buildPreview(round, groups, apps, [], decisions).blockers.join()).toMatch(/no evaluations/);
  expect(buildPreview(round, groups, [], votes, decisions).blockers.join()).toMatch(/missing/);
  expect(buildPreview(round, groups, [{ ...apps[0], status: "Accepted" }], votes, decisions).blockers.join()).toMatch(/current status/);
  expect(buildPreview(round, [...groups, ...groups], apps, votes, decisions).blockers.join()).toMatch(/more than one/);
  expect(buildPreview({ ...round, status: "finalized" }, groups, apps, votes, decisions).blockers.join()).toMatch(/already finalized/);
});
test("unknown/duplicate decisions are rejected and grade changes invalidate previews", () => {
  expect(() => buildPreview(round, groups, apps, votes, [{ applicationId: String(new mongoose.Types.ObjectId()), result: "Pass" }])).toThrow(/outside/);
  expect(() => buildPreview(round, groups, apps, votes, [...decisions, ...decisions])).toThrow(/one Pass/);
  const before = buildPreview(round, groups, apps, votes, decisions);
  expect(buildPreview(round, groups, apps, [{ ...votes[0], notes: "changed" }], decisions).fingerprint).not.toBe(before.fingerprint);
});

describe("atomic finalization", () => {
  let session;
  beforeEach(() => {
    session = { withTransaction: jest.fn(async (fn) => fn()), endSession: jest.fn() };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
    jest.spyOn(RecruitmentRound, "findOneAndUpdate").mockResolvedValue(round);
    jest.spyOn(RecruitmentRound, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(Group, "find").mockReturnValue(query(groups));
    jest.spyOn(Application, "find").mockReturnValue(query(apps));
    jest.spyOn(Application, "bulkWrite").mockResolvedValue({ matchedCount: 1 });
    jest.spyOn(Evaluation, "find").mockReturnValue(query(votes));
    jest.spyOn(Evaluation, "updateMany").mockResolvedValue({ modifiedCount: 2 });
    jest.spyOn(CaseGroupEditLog, "create").mockResolvedValue([]);
  });
  afterEach(() => jest.restoreAllMocks());
  test("writes status history, locks evaluations, finalizes and logs in one transaction", async () => {
    const { fingerprint } = buildPreview(round, groups, apps, votes, decisions);
    await expect(finalizeRound(round, decisions, fingerprint, "board@example.test")).resolves.toEqual({ finalized: true, updated: 1 });
    const [writes, options] = Application.bulkWrite.mock.calls[0];
    expect(options.session).toBe(session);
    expect(writes[0].updateOne.filter).toMatchObject({ cycle: "2026-fall", status: "Case Night - Yes" });
    expect(writes[0].updateOne.update.$push.statusHistory).toMatchObject({ status: "Final Interview - Yes", changedBy: "board@example.test" });
    expect(Evaluation.updateMany).toHaveBeenCalledWith({ roundId: rid, cycle: round.cycle }, { $set: { locked: true } }, { session });
    expect(RecruitmentRound.updateOne.mock.calls[0][1].$set.status).toBe("finalized");
    expect(CaseGroupEditLog.create.mock.calls[0][1].session).toBe(session);
  });
  test("stale preview writes no status and repeat finalization is rejected", async () => {
    await expect(finalizeRound(round, decisions, "a".repeat(64), "board@example.test")).rejects.toMatchObject({ status: 409 });
    expect(Application.bulkWrite).not.toHaveBeenCalled();
    RecruitmentRound.findOneAndUpdate.mockResolvedValue(null);
    await expect(finalizeRound(round, decisions, "a".repeat(64), "board@example.test")).rejects.toMatchObject({ status: 409 });
  });
  test("a status race aborts before locks are committed", async () => {
    Application.bulkWrite.mockResolvedValue({ matchedCount: 0 });
    const { fingerprint } = buildPreview(round, groups, apps, votes, decisions);
    await expect(finalizeRound(round, decisions, fingerprint, "board@example.test")).rejects.toMatchObject({ status: 409 });
    expect(Evaluation.updateMany).not.toHaveBeenCalled();
  });
  test("evaluation edits acquire the same lock and finalized rounds reject them", async () => {
    RecruitmentRound.findOneAndUpdate.mockResolvedValue(null);
    await expect(saveEvaluation(round, { applicationId: String(aid), result: "Pass" }, "board@example.test")).rejects.toMatchObject({ status: 409 });
  });
});

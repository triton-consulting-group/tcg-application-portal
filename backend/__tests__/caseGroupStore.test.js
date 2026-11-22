const mongoose = require("mongoose");
const Group = require("../models/Group");
const CaseGroupBackup = require("../models/CaseGroupBackup");
const CaseGroupEditLog = require("../models/CaseGroupEditLog");
const Evaluation = require("../models/Evaluation");
const RecruitmentRound = require("../models/RecruitmentRound");
const Application = require("../models/Application");
const { groupsFromAssignments, flattenGroups, replaceAssignments, editAssignment } = require("../services/caseGroupStore");
const { withRoundTransaction } = require("../services/recruitmentRounds");
const id = () => new mongoose.Types.ObjectId();
const round = { _id: id(), cycle: "2026-fall", kind: "case-night", status: "draft", revision: 0 };
const row = (overrides = {}) => ({ _id: id(), applicationId: id(), applicantName: "Test Person", applicantEmail: "person@example.test", candidateType: "Tech", timeSlot: "A", timeSlotDisplay: "6 PM", groupNumber: 1, groupId: "A-1", assignedBy: "board@example.test", emailSent: true, notes: "Preserve", ...overrides });
const query = (value) => ({ session: () => query(value), lean: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
let session;
beforeEach(() => {
  session = { withTransaction: jest.fn(async (fn) => fn()), endSession: jest.fn() };
  jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
  jest.spyOn(RecruitmentRound, "findOne").mockResolvedValue(round);
  jest.spyOn(RecruitmentRound, "findOneAndUpdate").mockResolvedValue(round);
  jest.spyOn(Application, "countDocuments").mockReturnValue(query(1));
  jest.spyOn(Group, "find").mockReturnValue(query([]));
  jest.spyOn(Group, "deleteMany").mockResolvedValue({ deletedCount: 0 });
  jest.spyOn(Group, "insertMany").mockResolvedValue([]);
  jest.spyOn(Evaluation, "exists").mockReturnValue(query(null));
  jest.spyOn(CaseGroupBackup, "create").mockResolvedValue([]);
  jest.spyOn(CaseGroupEditLog, "create").mockResolvedValue([]);
});
afterEach(() => jest.restoreAllMocks());

test("migration normalizes group identity and preserves assignment IDs and metadata", () => {
  const first = row();
  const groups = groupsFromAssignments([first, row()], round);
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({ cycle: round.cycle, roundId: round._id, groupId: "Tech-A-1" });
  const flattened = flattenGroups(groups);
  expect(flattened[0]).toMatchObject({ _id: first._id, applicationId: String(first.applicationId), emailSent: true, notes: "Preserve", groupId: "Tech-A-1" });
});
test("rejects duplicate applicants before any storage writes", () => {
  const first = row();
  expect(() => groupsFromAssignments([first, { ...first, groupNumber: 2 }], round)).toThrow(/more than one/);
});
test("build backs up and swaps only this round inside the transaction", async () => {
  await expect(replaceAssignments([row()], "board@example.test")).resolves.toBe(1);
  expect(Group.deleteMany).toHaveBeenCalledWith({ roundId: round._id }, { session });
  expect(Group.insertMany.mock.calls[0][1]).toEqual({ session });
  expect(CaseGroupBackup.create.mock.calls[0][0][0]).toMatchObject({ roundId: round._id, cycle: round.cycle, replacedBy: "board@example.test" });
  expect(CaseGroupEditLog.create.mock.calls[0][1]).toEqual({ session });
  expect(session.endSession).toHaveBeenCalled();
});
test("validation failure cannot delete existing groups", async () => {
  await expect(replaceAssignments([row({ candidateType: "invalid" })], "board@example.test")).rejects.toThrow();
  expect(Group.deleteMany).not.toHaveBeenCalled();
});
test("graded rounds cannot be rebuilt", async () => {
  Evaluation.exists.mockReturnValue(query({ _id: id() }));
  await expect(replaceAssignments([row()], "board@example.test")).rejects.toMatchObject({ status: 409 });
  expect(Group.deleteMany).not.toHaveBeenCalled();
});
test("transaction failure propagates; no unsafe standalone fallback", async () => {
  session.withTransaction.mockRejectedValue({ code: 20 });
  await expect(replaceAssignments([row()], "board@example.test")).rejects.toMatchObject({ status: 503 });
  expect(Group.deleteMany).not.toHaveBeenCalled();
  expect(session.endSession).toHaveBeenCalled();
});
test("finalized round stops every writer before work begins", async () => {
  RecruitmentRound.findOneAndUpdate.mockResolvedValue(null);
  const work = jest.fn();
  await expect(withRoundTransaction(round._id, work)).rejects.toMatchObject({ status: 409 });
  expect(work).not.toHaveBeenCalled();
});
test("add rejects an applicant from another cycle", async () => {
  jest.spyOn(Application, "findOne").mockReturnValue(query(null));
  await expect(editAssignment({ cycle: "2027-winter", action: "add", applicationId: String(id()), track: "Tech", slot: "A", groupNumber: "new", adminEmail: "board@example.test" })).rejects.toMatchObject({ status: 404 });
  expect(Application.findOne.mock.calls[0][0].cycle).toBe("2027-winter");
});

test("build revalidates cycle and eligibility inside the transaction", async () => {
  Application.countDocuments.mockReturnValue(query(0));
  await expect(replaceAssignments([row()], "board@example.test")).rejects.toMatchObject({ status: 409 });
  expect(Group.deleteMany).not.toHaveBeenCalled();
});

const mockSession = { withTransaction: jest.fn(), endSession: jest.fn() };
jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  actual.startSession = jest.fn(async () => mockSession);
  return actual;
});

const CaseGroupAssignment = require("../models/CaseGroupAssignment");
const CaseGroupBackup = require("../models/CaseGroupBackup");
const CaseGroupEditLog = require("../models/CaseGroupEditLog");
const { replaceAssignments, getExistingStatus } = require("../services/caseGroupStore");

const valid = (n) => ({
  applicationId: "64b00000000000000000000" + n,
  applicantName: `Person ${n}`,
  applicantEmail: `p${n}@ucsd.edu`,
  candidateType: "Tech",
  timeSlot: "A",
  timeSlotDisplay: "6:00 PM – 7:00 PM",
  groupNumber: 1,
  groupId: "Tech-A-1",
  assignedBy: "boss@ucsd.edu",
  status: "Assigned"
});
const previous = [{ _id: "old1", applicantEmail: "old@ucsd.edu" }];

beforeEach(() => {
  jest.restoreAllMocks();
  mockSession.withTransaction.mockReset().mockImplementation(async (fn) => fn());
  mockSession.endSession.mockReset();
  jest.spyOn(CaseGroupAssignment, "find").mockReturnValue({ lean: async () => previous });
  jest.spyOn(CaseGroupAssignment, "deleteMany").mockResolvedValue({});
  jest.spyOn(CaseGroupAssignment, "insertMany").mockResolvedValue([]);
  jest.spyOn(CaseGroupBackup, "create").mockResolvedValue({});
  jest.spyOn(CaseGroupEditLog, "create").mockResolvedValue({});
});

test("backs up the old assignments, then swaps inside a transaction", async () => {
  const count = await replaceAssignments([valid(1), valid(2)], "boss@ucsd.edu");
  expect(count).toBe(2);
  expect(CaseGroupBackup.create).toHaveBeenCalledWith({ assignments: previous, replacedBy: "boss@ucsd.edu" });
  expect(CaseGroupAssignment.deleteMany).toHaveBeenCalledWith({}, { session: mockSession });
  expect(CaseGroupAssignment.insertMany.mock.calls[0][1]).toEqual({ session: mockSession });
  expect(CaseGroupEditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: "build", by: "boss@ucsd.edu" }));
  expect(mockSession.endSession).toHaveBeenCalled();
});

test("an invalid assignment stops everything before any backup or delete", async () => {
  const bad = { ...valid(1), timeSlot: "Z" };
  await expect(replaceAssignments([valid(2), bad], "boss@ucsd.edu")).rejects.toMatchObject({ status: 400 });
  expect(CaseGroupBackup.create).not.toHaveBeenCalled();
  expect(CaseGroupAssignment.deleteMany).not.toHaveBeenCalled();
});

test("a failed transaction is reported and the fallback is not used", async () => {
  mockSession.withTransaction.mockRejectedValue(new Error("insert failed"));
  await expect(replaceAssignments([valid(1)], "boss@ucsd.edu")).rejects.toThrow("insert failed");
  expect(CaseGroupAssignment.deleteMany).not.toHaveBeenCalledWith({});
  expect(CaseGroupEditLog.create).not.toHaveBeenCalled();
});

test("without replica-set support, swaps without a transaction", async () => {
  mockSession.withTransaction.mockRejectedValue(
    Object.assign(new Error("Transaction numbers are only allowed on a replica set member"), { code: 20 })
  );
  await replaceAssignments([valid(1)], "boss@ucsd.edu");
  expect(CaseGroupAssignment.deleteMany).toHaveBeenCalledWith({});
  expect(CaseGroupAssignment.insertMany).toHaveBeenCalledTimes(1);
});

test("an outage error that mentions a replica set does not take the non-transactional path", async () => {
  mockSession.withTransaction.mockRejectedValue(
    Object.assign(new Error("Server selection timed out: No replica set members available"), { code: 13436 })
  );
  await expect(replaceAssignments([valid(1)], "boss@ucsd.edu")).rejects.toThrow("No replica set members");
  expect(CaseGroupAssignment.deleteMany).not.toHaveBeenCalledWith({});
});

test("without a transaction, a failed insert puts the old assignments back", async () => {
  mockSession.withTransaction.mockRejectedValue(Object.assign(new Error("no replica set"), { code: 20 }));
  CaseGroupAssignment.insertMany.mockRejectedValueOnce(new Error("insert failed")).mockResolvedValueOnce([]);
  await expect(replaceAssignments([valid(1)], "boss@ucsd.edu")).rejects.toThrow("insert failed");
  expect(CaseGroupAssignment.insertMany).toHaveBeenLastCalledWith(previous);
});

test("getExistingStatus counts hand edits since the last build", async () => {
  const lastBuildAt = new Date("2026-10-01");
  jest.spyOn(CaseGroupAssignment, "countDocuments").mockResolvedValueOnce(12).mockResolvedValueOnce(4);
  jest.spyOn(CaseGroupEditLog, "findOne").mockReturnValue({ sort: () => ({ lean: async () => ({ at: lastBuildAt }) }) });
  jest.spyOn(CaseGroupEditLog, "countDocuments").mockResolvedValue(3);

  expect(await getExistingStatus()).toEqual({ count: 12, emailsSent: 4, handEditsSinceBuild: 3 });
  expect(CaseGroupEditLog.countDocuments).toHaveBeenCalledWith({ action: { $ne: "build" }, at: { $gt: lastBuildAt } });
});

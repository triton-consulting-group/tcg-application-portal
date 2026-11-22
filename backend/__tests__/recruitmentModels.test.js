const mongoose = require("mongoose");
const RecruitmentRound = require("../models/RecruitmentRound");
const Room = require("../models/Room");
const Group = require("../models/Group");
const Evaluation = require("../models/Evaluation");
const id = () => new mongoose.Types.ObjectId();
const scope = { cycle: "2026-fall", roundId: id() };
const member = { applicationId: id(), applicantName: "Test", applicantEmail: "test@example.test", assignedBy: "board@example.test" };
const group = { ...scope, groupId: "Tech-A-1", candidateType: "Tech", timeSlot: "A", timeSlotDisplay: "6 PM", groupNumber: 1, members: [member] };

test.each([
  [RecruitmentRound, { cycle: "2026-fall", kind: "case-night", name: "Case Night" }],
  [Room, { ...scope, name: "A", timeSlot: "A", capacity: 10 }],
  [Group, group],
  [Evaluation, { ...scope, groupId: id(), applicationId: id(), evaluator: "Board@Example.Test", result: "Pass" }]
])("%p validates the cycle-owned record", async (Model, fields) => {
  await expect(new Model(fields).validate()).resolves.toBeUndefined();
  await expect(new Model({ ...fields, cycle: undefined }).validate()).rejects.toThrow(/cycle/);
});
test("group cannot contain an applicant twice", async () => {
  await expect(new Group({ ...group, members: [member, member] }).validate()).rejects.toThrow(/only appear once/);
});
test("evaluation accepts only Pass/Fail and normalizes evaluator identity", async () => {
  const evaluation = new Evaluation({ ...scope, groupId: id(), applicationId: id(), evaluator: "Board@Example.Test", result: "Maybe" });
  expect(evaluation.evaluator).toBe("board@example.test");
  await expect(evaluation.validate()).rejects.toThrow(/result/);
});
test("indexes isolate rounds, groups and graders", () => {
  expect(RecruitmentRound.schema.indexes()).toContainEqual([expect.objectContaining({ cycle: 1, kind: 1 }), expect.objectContaining({ unique: true })]);
  expect(Group.schema.indexes()).toContainEqual([expect.objectContaining({ roundId: 1, candidateType: 1, timeSlot: 1, groupNumber: 1 }), expect.objectContaining({ unique: true })]);
  expect(Evaluation.schema.indexes()).toContainEqual([expect.objectContaining({ roundId: 1, applicationId: 1, evaluator: 1 }), expect.objectContaining({ unique: true })]);
});

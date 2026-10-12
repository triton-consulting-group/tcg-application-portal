const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/Application", () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock("../models/CaseGroupAssignment", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
  distinct: jest.fn()
}));
jest.mock("../models/CaseGroupEditLog", () => ({ create: jest.fn() }));

const express = require("express");
const Admin = require("../models/Admin");
const Application = require("../models/Application");
const CaseGroupAssignment = require("../models/CaseGroupAssignment");
const CaseGroupEditLog = require("../models/CaseGroupEditLog");
const caseGroups = require("../routes/caseGroups");

let server;
let base;

beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use("/api/case-groups", caseGroups);
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${server.address().port}/api/case-groups`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

const APP_ID = "64b000000000000000000001";
const ASSIGNMENT_ID = "64b0000000000000000000a1";
const ada = { _id: APP_ID, fullName: "Ada", email: "ada@ucsd.edu", candidateType: "Tech", caseNightPreferences: ["A"] };
const member = (n, extra = {}) => ({
  _id: `64b0000000000000000000b${n}`,
  candidateType: "Tech",
  timeSlot: "A",
  groupNumber: 1,
  groupId: "Tech-A-1",
  emailSent: false,
  ...extra
});
const adaAssignment = { ...member(9), _id: ASSIGNMENT_ID, applicationId: APP_ID, applicantName: "Ada" };

// Mongoose-style query chains that resolve to `value`
const lean = (value) => ({ lean: async () => value });
const leanOrSorted = (value) => ({ lean: async () => value, sort: () => lean(value) });

const signInAs = (role) => {
  mockVerifyIdToken.mockResolvedValue({ email: "boss@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue({ email: "boss@ucsd.edu", role });
};

const send = (method, path, body) =>
  fetch(base + path, {
    method,
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });

const writes = () => [CaseGroupAssignment.updateOne, CaseGroupAssignment.deleteOne, CaseGroupEditLog.create];

beforeEach(() => {
  jest.clearAllMocks();
  signInAs("super_admin");
  Application.findById.mockReturnValue({ select: () => lean(ada) });
  CaseGroupAssignment.findOne.mockReturnValue(leanOrSorted(null));
  CaseGroupAssignment.find.mockReturnValue(lean([member(1), member(2), member(3)]));
  CaseGroupAssignment.findById.mockReturnValue(lean(adaAssignment));
  CaseGroupAssignment.countDocuments.mockResolvedValue(4);
  CaseGroupAssignment.updateOne.mockResolvedValue({ upsertedCount: 1, modifiedCount: 1 });
  CaseGroupAssignment.deleteOne.mockResolvedValue({ deletedCount: 1 });
  CaseGroupAssignment.distinct.mockResolvedValue([]); // no other assignment for this applicant
});

test.each([
  ["POST", "/assignments"],
  ["PATCH", `/assignments/${ASSIGNMENT_ID}`],
  ["DELETE", `/assignments/${ASSIGNMENT_ID}`]
])("%s %s as a regular admin is 403 and writes nothing", async (method, path) => {
  signInAs("admin");
  const res = await send(method, path, { applicationId: APP_ID, track: "Tech", slot: "A", groupNumber: 1 });
  expect(res.status).toBe(403);
  for (const write of writes()) expect(write).not.toHaveBeenCalled();
});

describe("add", () => {
  const add = (body) => send("POST", "/assignments", { applicationId: APP_ID, track: "Tech", slot: "A", groupNumber: 1, ...body });

  test("adds to an existing group, even past 4 people, and logs it", async () => {
    CaseGroupAssignment.find.mockReturnValue(lean([member(1), member(2), member(3), member(4)]));
    const res = await add();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ groupId: "Tech-A-1" });
    const [filter, update, options] = CaseGroupAssignment.updateOne.mock.calls[0];
    expect(filter).toEqual({ applicationId: APP_ID });
    expect(update.$setOnInsert).toMatchObject({ candidateType: "Tech", timeSlot: "A", groupNumber: 1, groupId: "Tech-A-1", lastEditedBy: "boss@ucsd.edu" });
    expect(options).toEqual({ upsert: true });
    expect(CaseGroupEditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: "add", to: "Tech-A-1" }));
  });

  test("\"new\" gets the next group number in that track and slot", async () => {
    CaseGroupAssignment.findOne
      .mockReturnValueOnce(leanOrSorted(null)) // not already assigned
      .mockReturnValueOnce(leanOrSorted({ groupNumber: 6 })); // highest existing group
    const res = await add({ groupNumber: "new" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ groupId: "Tech-A-7" });
  });

  test("someone already in a group is refused", async () => {
    CaseGroupAssignment.findOne.mockReturnValue(leanOrSorted({ groupId: "Tech-B-2" }));
    const res = await add();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Ada is already in Tech-B-2.");
    expect(CaseGroupAssignment.updateOne).not.toHaveBeenCalled();
  });

  test("warnings need confirmation; nothing is written until then", async () => {
    const res = await add({ slot: "C", track: "Non-Tech", groupNumber: 1 });
    expect(res.status).toBe(409);
    expect((await res.json()).warnings.map((w) => w.code)).toEqual(["slot-unavailable", "track-mismatch"]);
    expect(CaseGroupAssignment.updateOne).not.toHaveBeenCalled();

    const confirmed = await add({ slot: "C", track: "Non-Tech", groupNumber: 1, confirmWarnings: true });
    expect(confirmed.status).toBe(201);
  });

  test("a group that doesn't exist is 404", async () => {
    CaseGroupAssignment.find.mockReturnValue(lean([]));
    const res = await add({ groupNumber: 99 });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("That group doesn't exist.");
  });

  test("an unknown application is 404", async () => {
    const res = await add({ applicationId: "not-an-id" });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Application not found.");
  });

  test("two simultaneous adds keep only one assignment", async () => {
    const ours = "64b0000000000000000000f2";
    CaseGroupAssignment.updateOne.mockResolvedValue({ upsertedCount: 1, upsertedId: ours });
    CaseGroupAssignment.distinct.mockResolvedValue([ours, "64b0000000000000000000f1"]); // the other admin's insert sorts first
    const res = await add();
    expect(res.status).toBe(409);
    expect(CaseGroupAssignment.deleteOne).toHaveBeenCalledWith({ _id: ours });
    expect(CaseGroupEditLog.create).not.toHaveBeenCalled();
  });

  test("the surviving insert of a simultaneous pair is kept", async () => {
    const ours = "64b0000000000000000000f1";
    CaseGroupAssignment.updateOne.mockResolvedValue({ upsertedCount: 1, upsertedId: ours });
    CaseGroupAssignment.distinct.mockResolvedValue(["64b0000000000000000000f2", ours]);
    expect((await add()).status).toBe(201);
    expect(CaseGroupAssignment.deleteOne).not.toHaveBeenCalled();
  });

  test("losing a race to another admin is 409", async () => {
    CaseGroupAssignment.updateOne.mockResolvedValue({ upsertedCount: 0 });
    expect((await add()).status).toBe(409);
    expect(CaseGroupEditLog.create).not.toHaveBeenCalled();
  });
});

describe("move", () => {
  const move = (body) => send("PATCH", `/assignments/${ASSIGNMENT_ID}`, { track: "Tech", slot: "A", groupNumber: 2, ...body });

  test("moves to another group and logs from/to", async () => {
    CaseGroupAssignment.find.mockReturnValue(lean([member(5, { groupNumber: 2, groupId: "Tech-A-2" })]));
    const res = await move();
    expect(res.status).toBe(200);
    const [filter, update] = CaseGroupAssignment.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: ASSIGNMENT_ID, candidateType: "Tech", timeSlot: "A", groupNumber: 1 });
    expect(update.$set).toMatchObject({ groupNumber: 2, groupId: "Tech-A-2" });
    expect(CaseGroupEditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: "move", from: "Tech-A-1", to: "Tech-A-2" }));
  });

  test("leaving a group with fewer than 3 needs confirmation", async () => {
    CaseGroupAssignment.countDocuments.mockResolvedValue(3);
    CaseGroupAssignment.find.mockReturnValue(lean([member(5, { groupNumber: 2, groupId: "Tech-A-2" })]));
    const res = await move();
    expect(res.status).toBe(409);
    expect((await res.json()).warnings.map((w) => w.code)).toEqual(["small-group"]);
    expect(CaseGroupAssignment.updateOne).not.toHaveBeenCalled();
  });

  test("works on an older assignment whose groupId has no track", async () => {
    CaseGroupAssignment.findById.mockReturnValue(lean({ ...adaAssignment, groupId: "A-1" }));
    CaseGroupAssignment.find.mockReturnValue(lean([member(5, { groupNumber: 2, groupId: "Tech-A-2" })]));
    const res = await move();
    expect(res.status).toBe(200);
    expect(CaseGroupAssignment.countDocuments).toHaveBeenCalledWith({ candidateType: "Tech", timeSlot: "A", groupNumber: 1 });
    expect(CaseGroupEditLog.create).toHaveBeenCalledWith(expect.objectContaining({ from: "A-1", to: "Tech-A-2" }));
  });

  test("still works if the application was deleted after grouping", async () => {
    Application.findById.mockReturnValue({ select: () => lean(null) });
    CaseGroupAssignment.find.mockReturnValue(lean([member(5, { groupNumber: 2, groupId: "Tech-A-2" })]));
    expect((await move()).status).toBe(200);
  });

  test("moving into the same group is 400", async () => {
    expect((await move({ groupNumber: 1 })).status).toBe(400);
  });
});

describe("remove", () => {
  test("deletes only the assignment and logs it", async () => {
    const res = await send("DELETE", `/assignments/${ASSIGNMENT_ID}`);
    expect(res.status).toBe(200);
    expect(CaseGroupAssignment.deleteOne).toHaveBeenCalledWith({ _id: ASSIGNMENT_ID, candidateType: "Tech", timeSlot: "A", groupNumber: 1 });
    expect(Application.findById).not.toHaveBeenCalled();
    expect(CaseGroupEditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: "remove", from: "Tech-A-1" }));
  });

  test("emails already sent needs confirmation", async () => {
    CaseGroupAssignment.findById.mockReturnValue(lean({ ...adaAssignment, emailSent: true }));
    const res = await send("DELETE", `/assignments/${ASSIGNMENT_ID}`);
    expect(res.status).toBe(409);
    expect(CaseGroupAssignment.deleteOne).not.toHaveBeenCalled();
    expect((await send("DELETE", `/assignments/${ASSIGNMENT_ID}`, { confirmWarnings: true })).status).toBe(200);
  });

  test("an unknown assignment is 404", async () => {
    CaseGroupAssignment.findById.mockReturnValue(lean(null));
    const res = await send("DELETE", `/assignments/${ASSIGNMENT_ID}`);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Assignment not found.");
  });
});

test("unassigned lists only Case Night - Yes applicants without a group", async () => {
  CaseGroupAssignment.distinct.mockResolvedValue(["x"]);
  const select = jest.fn(async () => [ada]);
  Application.find.mockReturnValue({ select });
  const res = await fetch(base + "/unassigned", { headers: { Authorization: "Bearer t" } });
  expect(res.status).toBe(200);
  expect(Application.find).toHaveBeenCalledWith({ _id: { $nin: ["x"] }, status: "Case Night - Yes" });
  expect(select.mock.calls[0][0]).toContain("studentYear"); // year tags on the board
});

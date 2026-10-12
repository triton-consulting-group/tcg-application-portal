const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/Application", () => ({ find: jest.fn() }));
jest.mock("../services/caseGroupStore", () => ({
  replaceAssignments: jest.fn(),
  getExistingStatus: jest.fn()
}));

const express = require("express");
const Admin = require("../models/Admin");
const Application = require("../models/Application");
const { replaceAssignments, getExistingStatus } = require("../services/caseGroupStore");
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

const applications = Array.from({ length: 4 }, (_, i) => ({
  _id: `64b00000000000000000000${i}`,
  fullName: `Person ${i}`,
  email: `p${i}@ucsd.edu`,
  candidateType: "Tech",
  caseNightPreferences: ["A"],
  status: "Case Night - Yes",
  createdAt: new Date(2026, 0, 1, 0, i)
}));

const signInAs = (role) => {
  mockVerifyIdToken.mockResolvedValue({ email: "boss@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue({ email: "boss@ucsd.edu", role });
};

const post = (path, body) =>
  fetch(base + path, {
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });

beforeEach(() => {
  jest.clearAllMocks();
  Application.find.mockReturnValue({ select: () => ({ lean: async () => applications }) });
  getExistingStatus.mockResolvedValue({ count: 0, emailsSent: 0, handEditsSinceBuild: 0 });
  replaceAssignments.mockResolvedValue(4);
});

test.each(["/preview", "/build"])("POST %s as a regular admin is 403 and touches nothing", async (path) => {
  signInAs("admin");
  const res = await post(path, { fingerprint: "x" });
  expect(res.status).toBe(403);
  expect(Application.find).not.toHaveBeenCalled();
  expect(replaceAssignments).not.toHaveBeenCalled();
});

test("preview returns the plan, a fingerprint and existing status, and writes nothing", async () => {
  signInAs("super_admin");
  const res = await post("/preview");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Application.find).toHaveBeenCalledWith({ status: "Case Night - Yes" });
  expect(body.plan.tracks.Tech.slots.A.count).toBe(4);
  expect(body.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(body.existing).toEqual({ count: 0, emailsSent: 0, handEditsSinceBuild: 0 });
  expect(replaceAssignments).not.toHaveBeenCalled();
});

test("build with a stale fingerprint is 409 and writes nothing", async () => {
  signInAs("super_admin");
  const res = await post("/build", { fingerprint: "stale" });
  expect(res.status).toBe(409);
  expect(replaceAssignments).not.toHaveBeenCalled();
});

test("build with the preview's fingerprint replaces the assignments", async () => {
  signInAs("super_admin");
  const { fingerprint } = await (await post("/preview")).json();
  const res = await post("/build", { fingerprint });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ created: 4, summary: { eligible: 4, placed: 4, excluded: 0, mixedYearGroups: 0 } });
  const [docs, by] = replaceAssignments.mock.calls[0];
  expect(by).toBe("boss@ucsd.edu");
  expect(docs).toHaveLength(4);
  expect(docs[0]).toMatchObject({ candidateType: "Tech", timeSlot: "A", groupId: "Tech-A-1", assignedBy: "boss@ucsd.edu" });
});

test("build passes a validation failure through as 400", async () => {
  signInAs("super_admin");
  replaceAssignments.mockRejectedValue(Object.assign(new Error("Invalid assignment for p1@ucsd.edu"), { status: 400 }));
  const { fingerprint } = await (await post("/preview")).json();
  const res = await post("/build", { fingerprint });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toMatch(/Invalid assignment/);
});

test("build refuses a plan that places nobody, so existing groups aren't wiped", async () => {
  signInAs("super_admin");
  Application.find.mockReturnValue({ select: () => ({ lean: async () => [] }) });
  const { fingerprint } = await (await post("/preview")).json();
  const res = await post("/build", { fingerprint });
  expect(res.status).toBe(400);
  expect(replaceAssignments).not.toHaveBeenCalled();
});

describe("keep years together", () => {
  // Seven people in one slot whose years alternate, so grouping by year changes the groups
  const mixed = ["2nd", "1st", "2nd", "1st", "2nd", "1st", "2nd"].map((studentYear, i) => ({
    ...applications[0],
    _id: `64b00000000000000000001${i}`,
    studentYear,
    createdAt: new Date(2026, 0, 2, 0, i)
  }));
  let select;
  beforeEach(() => {
    select = jest.fn(() => ({ lean: async () => mixed }));
    Application.find.mockReturnValue({ select });
  });

  test("the query fetches each applicant's year", async () => {
    signInAs("super_admin");
    await post("/preview");
    expect(select.mock.calls[0][0]).toContain("studentYear");
  });

  test("is on by default and changes the groups", async () => {
    signInAs("super_admin");
    const byDefault = await (await post("/preview")).json();
    const on = await (await post("/preview", { groupByYear: true })).json();
    const off = await (await post("/preview", { groupByYear: false })).json();
    expect(byDefault.fingerprint).toBe(on.fingerprint);
    expect(off.fingerprint).not.toBe(on.fingerprint);
    expect(on.plan.summary.mixedYearGroups).toBe(0);
    expect(off.plan.summary.mixedYearGroups).toBe(2);
  });

  test("build uses the option that was previewed", async () => {
    signInAs("super_admin");
    const { fingerprint } = await (await post("/preview", { groupByYear: false })).json();
    expect((await post("/build", { fingerprint })).status).toBe(409); // default (on) gives different groups
    expect((await post("/build", { fingerprint, groupByYear: false })).status).toBe(200);
  });
});

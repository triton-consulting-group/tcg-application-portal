const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/CaseGroupAssignment", () => ({
  find: jest.fn(), aggregate: jest.fn(), distinct: jest.fn()
}));
jest.mock("../models/Application", () => ({ find: jest.fn() }));

const express = require("express");
const Admin = require("../models/Admin");
const CaseGroupAssignment = require("../models/CaseGroupAssignment");
const Application = require("../models/Application");
const caseGroups = require("../routes/caseGroups");

let server;
let base;

beforeAll((done) => {
  const app = express();
  app.use("/api/case-groups", caseGroups);
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${server.address().port}/api/case-groups`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockRejectedValue(new Error("invalid token"));
});

const paths = ["/assignments", "/summary", "/export", "/unassigned", "/groups/Tech/slot1/1"];
const bearer = { headers: { Authorization: "Bearer t" } };

const expectNoDbAccess = () => {
  expect(CaseGroupAssignment.find).not.toHaveBeenCalled();
  expect(CaseGroupAssignment.aggregate).not.toHaveBeenCalled();
  expect(CaseGroupAssignment.distinct).not.toHaveBeenCalled();
  expect(Application.find).not.toHaveBeenCalled();
};

test.each(paths)("GET %s without credentials is 401 and never queries the DB", async (path) => {
  const res = await fetch(base + path);
  expect(res.status).toBe(401);
  expectNoDbAccess();
});

test.each(paths)("GET %s with an invalid bearer token is 401", async (path) => {
  const res = await fetch(base + path, bearer);
  expect(res.status).toBe(401);
  expectNoDbAccess();
});

test.each(paths)("GET %s as a signed-in non-admin is 403", async (path) => {
  mockVerifyIdToken.mockResolvedValue({ email: "applicant@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue(null);
  const res = await fetch(base + path, bearer);
  expect(res.status).toBe(403);
  expectNoDbAccess();
});

test("GET /summary as an active admin reaches the handler", async () => {
  mockVerifyIdToken.mockResolvedValue({ email: "member@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue({ email: "member@ucsd.edu", role: "admin" });
  CaseGroupAssignment.aggregate.mockResolvedValue([{ _id: { candidateType: "Tech" }, count: 3 }]);
  const res = await fetch(base + "/summary", bearer);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual([{ _id: { candidateType: "Tech" }, count: 3 }]);
});

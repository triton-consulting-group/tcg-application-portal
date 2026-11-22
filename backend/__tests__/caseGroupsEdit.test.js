const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({ getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken }) }));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../services/caseGroupStore", () => ({ listAssignments: jest.fn(), replaceAssignments: jest.fn(), getExistingStatus: jest.fn(), editAssignment: jest.fn() }));
jest.mock("../services/recruitmentRounds", () => ({ findRound: jest.fn(), httpError: (status, message) => Object.assign(new Error(message), { status }) }));
const express = require("express");
const Admin = require("../models/Admin");
const { editAssignment } = require("../services/caseGroupStore");
const { findRound } = require("../services/recruitmentRounds");
const caseGroups = require("../routes/caseGroups");
let server, base;
beforeAll((done) => {
  const app = express(); app.use(express.json()); app.use("/case-groups", caseGroups);
  server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}/case-groups`; done(); });
});
afterAll((done) => { server.close(done); });
beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockResolvedValue({ email: "board@example.test", email_verified: true });
  Admin.findOne.mockResolvedValue({ email: "board@example.test", role: "super_admin" });
  editAssignment.mockResolvedValue({ groupId: "Tech-A-2" });
});
const request = (method, path, body = {}) => fetch(base + path, { method, headers: { Authorization: "Bearer t", "Content-Type": "application/json" }, body: JSON.stringify(body) });

test.each([["POST", "/assignments", "add"], ["PATCH", "/assignments/member", "move"], ["DELETE", "/assignments/member", "remove"]])("%s %s forwards editable fields, authorized actor and selected cycle", async (method, path, action) => {
  const res = await request(method, path + "?cycle=2027-winter", { applicationId: "a", track: "Tech", slot: "A", groupNumber: 2, confirmWarnings: true, adminEmail: "spoof@example.test", cycle: "other" });
  expect(res.status).toBe(action === "add" ? 201 : 200);
  expect(editAssignment).toHaveBeenCalledWith(expect.objectContaining({ action, cycle: "2027-winter", adminEmail: "board@example.test", track: "Tech", confirmWarnings: true }));
});
test.each([["POST", "/assignments"], ["PATCH", "/assignments/a"], ["DELETE", "/assignments/a"]])("regular admins cannot mutate via %s %s", async (method, path) => {
  Admin.findOne.mockResolvedValue({ email: "board@example.test", role: "admin" });
  expect((await request(method, path)).status).toBe(403);
  expect(editAssignment).not.toHaveBeenCalled();
});
test("warning confirmation is returned intact", async () => {
  editAssignment.mockRejectedValue(Object.assign(new Error("Please confirm"), { status: 409, warnings: [{ code: "emails-sent", message: "Email sent" }] }));
  const res = await request("PATCH", "/assignments/a");
  expect(res.status).toBe(409);
  expect((await res.json()).warnings).toHaveLength(1);
});

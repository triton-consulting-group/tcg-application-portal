const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/Application", () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../config/s3Config", () => ({
  s3: {}, S3_CONFIG: { uploadSettings: { maxFileSize: 1024, allowedMimeTypes: [] } }, getFileTypeAndPath: jest.fn(), getFileUrl: jest.fn(),
  getSignedUrl: jest.fn(), isS3Configured: () => false
}));
// Window check off, so these tests reach the lock no matter today's date (the gap B-10 closes)
jest.mock("../config/deadlineConfig", () => ({ isActive: false }));

const express = require("express");
const Application = require("../models/Application");
const applications = require("../routes/applications");
const { LOCKED_STATUSES, isApplicationLocked } = require("../utils/applicationStatus");

let server;
let base;

beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use("/api/applications", applications);
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${server.address().port}/api/applications`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

const EMAIL = "applicant@ucsd.edu";
const path = `/email/${EMAIL}`;

const edit = (body = { fullName: "New Name" }) =>
  fetch(base + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
    body: JSON.stringify(body)
  });

const storedWithStatus = (status) =>
  Application.findOne.mockResolvedValue(status ? { email: EMAIL, status } : null);

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockResolvedValue({ email: EMAIL, email_verified: true });
  Application.findOneAndUpdate.mockImplementation(async (filter, update) => ({ email: EMAIL, ...update }));
});

test.each(LOCKED_STATUSES)("editing an application with status %s is 403 and saves nothing", async (status) => {
  storedWithStatus(status);
  const res = await edit();
  expect(res.status).toBe(403);
  expect((await res.json()).error).toMatch(/decision/i);
  expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
});

test.each(["Under Review", "Case Night - Yes", "Final Interview - Maybe"])(
  "editing an application with status %s still saves",
  async (status) => {
    storedWithStatus(status);
    const res = await edit();
    expect(res.status).toBe(200);
    expect((await res.json()).application.fullName).toBe("New Name");
  }
);

test("the save only matches an unlocked application", async () => {
  storedWithStatus("Under Review");
  await edit();
  const [filter] = Application.findOneAndUpdate.mock.calls[0];
  expect(filter).toEqual({ email: EMAIL, status: { $nin: LOCKED_STATUSES } });
});

test("a decision made between the check and the save is 403", async () => {
  storedWithStatus("Under Review");
  Application.findOneAndUpdate.mockResolvedValue(null); // locked while the request was in flight
  const res = await edit();
  expect(res.status).toBe(403);
  expect((await res.json()).error).toMatch(/decision/i);
});

test("a missing application is still 404", async () => {
  storedWithStatus(null);
  const res = await edit();
  expect(res.status).toBe(404);
  expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
});

test("someone else's application is 403 before the lock check runs", async () => {
  mockVerifyIdToken.mockResolvedValue({ email: "other@ucsd.edu", email_verified: true });
  const res = await edit();
  expect(res.status).toBe(403);
  expect(Application.findOne).not.toHaveBeenCalled();
});

test("isApplicationLocked only locks decided statuses", () => {
  expect(LOCKED_STATUSES.every(isApplicationLocked)).toBe(true);
  expect(isApplicationLocked("Under Review")).toBe(false);
  expect(isApplicationLocked(undefined)).toBe(false);
});

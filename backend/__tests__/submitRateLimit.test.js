// Submissions are rate-limited per signed-in account, not per IP
const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../config/deadlineConfig", () => ({ isActive: false }));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/Application", () => {
  const Application = jest.fn(function (fields) {
    Object.assign(this, fields, { _id: "64b000000000000000000004" });
    this.save = jest.fn().mockResolvedValue();
  });
  return Application;
});
jest.mock("../config/s3Config", () => ({
  s3: {}, S3_CONFIG: { uploadSettings: { maxFileSize: 1024, allowedMimeTypes: [] } }, getFileTypeAndPath: jest.fn(), getFileUrl: jest.fn(),
  getSignedUrl: jest.fn(), isS3Configured: () => false
}));

const express = require("express");
const scalingConfig = require("../config/scalingConfig");
const applications = require("../routes/applications");

const LIMIT = scalingConfig.rateLimits.applicationSubmission.max;
let server;
let base;

beforeAll((done) => {
  const app = express();
  app.set("trust proxy", true); // same as server.js
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

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  // Token "t:<email>" verifies as that email
  mockVerifyIdToken.mockImplementation(async (token) => ({ email: token.slice(2), email_verified: true }));
});

afterEach(() => {
  console.log.mockRestore();
});

const submit = (email, ip) =>
  fetch(`${base}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer t:${email}`, "X-Forwarded-For": ip },
    body: JSON.stringify({ fullName: "Test", phoneNumber: "8585550123", studentYear: "2nd", major: "Econ", appliedBefore: "No", candidateType: "Tech", reason: "x" }),
  });

test("allows up to the limit per account, then returns 429 with a clear message", async () => {
  const email = "retry-heavy@ucsd.edu";
  for (let i = 0; i < LIMIT; i++) {
    expect((await submit(email, `10.0.0.${i + 1}`)).status).toBe(201); // changing IPs doesn't reset it
  }
  const res = await submit(email, "10.0.0.99");
  expect(res.status).toBe(429);
  expect((await res.json()).error).toMatch(/too many submission attempts/i);
});

test("many different accounts behind one shared IP are not limited", async () => {
  const statuses = [];
  for (let i = 0; i < LIMIT * 3; i++) {
    statuses.push((await submit(`student${i}@ucsd.edu`, "10.9.9.9")).status);
  }
  expect(statuses.every((s) => s === 201)).toBe(true);
});

test("unauthenticated requests are rejected before the limiter counts anything", async () => {
  const res = await fetch(`${base}/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  expect(res.status).toBe(401);
});

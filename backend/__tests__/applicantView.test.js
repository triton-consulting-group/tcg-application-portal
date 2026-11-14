// S-1: the applicant-facing routes return only applicant-owned fields, never board comments or status history
const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../config/deadlineConfig", () => ({ isActive: false }));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));

const mockSave = jest.fn();
jest.mock("../models/Application", () => {
  // Like a Mongoose document: array defaults are present on a new application
  const Application = jest.fn(function (fields) {
    Object.assign(this, { comments: [], statusHistory: [] }, fields, { _id: "64b000000000000000000002" });
    this.save = mockSave;
  });
  Application.findOne = jest.fn();
  Application.findOneAndUpdate = jest.fn();
  return Application;
});
jest.mock("../config/s3Config", () => ({
  s3: {}, S3_CONFIG: { uploadSettings: { maxFileSize: 1024, allowedMimeTypes: [] } }, getFileTypeAndPath: jest.fn(), getFileUrl: jest.fn(),
  getSignedUrl: jest.fn(), isS3Configured: () => false
}));

const express = require("express");
const Application = require("../models/Application");
const applications = require("../routes/applications");

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
const signedIn = { Authorization: "Bearer applicant-token" };

const send = (method, path, body) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...signedIn },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

const BOARD_ONLY_FIELDS = ["comments", "statusHistory"];

// A stored application as the database returns it, including board-only data
const storedApplication = () => ({
  _id: "64b000000000000000000001",
  email: EMAIL,
  fullName: "Test Applicant",
  phoneNumber: "+18585550123",
  studentYear: "2nd",
  major: "Economics",
  appliedBefore: "No",
  candidateType: "Tech",
  reason: "Because",
  zombieAnswer: "Run",
  additionalInfo: "",
  caseNightPreferences: ["A"],
  resume: "/uploads/resume.pdf",
  transcript: null,
  image: null,
  status: "Case Night - Yes",
  statusHistory: [{ status: "Case Night - Yes", changedBy: "board@ucsd.edu", notes: "strong reasoning" }],
  comments: [{ comment: "internal note", commentedBy: "board@ucsd.edu", adminName: "Board Member" }],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
  __v: 0
});

const expectApplicantView = (body) => {
  for (const field of BOARD_ONLY_FIELDS) {
    expect(body).not.toHaveProperty(field);
  }
  expect(body).not.toHaveProperty("__v");
  const text = JSON.stringify(body);
  expect(text).not.toContain("internal note");
  expect(text).not.toContain("strong reasoning");
  expect(text).not.toContain("board@ucsd.edu");
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockVerifyIdToken.mockResolvedValue({ email: EMAIL, email_verified: true });
  mockSave.mockResolvedValue();
});

afterEach(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

test("GET /email/:email returns the applicant's fields without comments or status history", async () => {
  Application.findOne.mockResolvedValue(storedApplication());
  const res = await send("GET", `/email/${EMAIL}`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expectApplicantView(body);
  expect(body).toEqual(expect.objectContaining({
    email: EMAIL, fullName: "Test Applicant", phoneNumber: "+18585550123", major: "Economics",
    reason: "Because", caseNightPreferences: ["A"], resume: "/uploads/resume.pdf", status: "Case Night - Yes"
  }));
});

test("GET /email/:email strips board-only fields from a Mongoose document too", async () => {
  const stored = storedApplication();
  Application.findOne.mockResolvedValue({ ...stored, toObject: () => stored });
  const res = await send("GET", `/email/${EMAIL}`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expectApplicantView(body);
  expect(body).not.toHaveProperty("toObject");
  expect(body.fullName).toBe("Test Applicant");
});

test("GET /email/:email does not pass through fields that are not on the allowlist", async () => {
  Application.findOne.mockResolvedValue({ ...storedApplication(), reviewerScore: 4 });
  const body = await (await send("GET", `/email/${EMAIL}`)).json();
  expect(body).not.toHaveProperty("reviewerScore");
});

test("PUT /email/:email returns the updated application without comments or status history", async () => {
  Application.findOne.mockResolvedValue(storedApplication());
  Application.findOneAndUpdate.mockResolvedValue({ ...storedApplication(), major: "Math" });
  const res = await send("PUT", `/email/${EMAIL}`, { major: "Math" });
  expect(res.status).toBe(200);
  const body = await res.json();
  expectApplicantView(body.application);
  expect(body.application.major).toBe("Math");
});

test("POST / returns the new application without comments or status history", async () => {
  const res = await send("POST", "/", {
    fullName: "Test Applicant", phoneNumber: "8585550123", studentYear: "2nd", major: "Economics",
    appliedBefore: "No", candidateType: "Tech", reason: "Because"
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expectApplicantView(body.application);
  expect(body.application).not.toHaveProperty("save");
  expect(body.application).toEqual(expect.objectContaining({ email: EMAIL, fullName: "Test Applicant", status: "Under Review" }));
});

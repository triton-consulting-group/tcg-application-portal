const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
// Mutable window config so each test can open or close it
jest.mock("../config/deadlineConfig", () => ({ isActive: true }));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));

const mockSave = jest.fn();
jest.mock("../models/Application", () => {
  const Application = jest.fn(function (fields) {
    Object.assign(this, fields, { _id: "64b000000000000000000003" });
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
const DEADLINE_CONFIG = require("../config/deadlineConfig");
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

const HOUR = 3600 * 1000;
const openWindow = () => {
  DEADLINE_CONFIG.applicationStart = new Date(Date.now() - HOUR).toISOString();
  DEADLINE_CONFIG.applicationDeadline = new Date(Date.now() + HOUR).toISOString();
};
const notYetOpen = () => {
  DEADLINE_CONFIG.applicationStart = new Date(Date.now() + HOUR).toISOString();
  DEADLINE_CONFIG.applicationDeadline = new Date(Date.now() + 2 * HOUR).toISOString();
};
const closed = () => {
  DEADLINE_CONFIG.applicationStart = new Date(Date.now() - 2 * HOUR).toISOString();
  DEADLINE_CONFIG.applicationDeadline = new Date(Date.now() - HOUR).toISOString();
};

const send = (method, path, body, headers = {}) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

const APPLICANT = "applicant@ucsd.edu";
const signedIn = { Authorization: "Bearer applicant-token" };
const submission = {
  email: APPLICANT, fullName: "Test Applicant", phoneNumber: "858-555-0123", studentYear: "1st",
  major: "Economics", appliedBefore: "No", candidateType: "Tech", reason: "A distinctive essay sentence"
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  openWindow();
  mockVerifyIdToken.mockResolvedValue({ email: APPLICANT, email_verified: true });
  mockSave.mockResolvedValue();
  Application.findOne.mockResolvedValue({ email: APPLICANT });
  Application.findOneAndUpdate.mockImplementation(async (filter, update) => ({ ...filter, ...update }));
});

afterEach(() => {
  console.log.mockRestore();
  console.warn.mockRestore();
  console.error.mockRestore();
});

describe("submitting requires a verified sign-in", () => {
  test("401 without a token, and nothing is saved", async () => {
    const res = await send("POST", "/", submission);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/sign in/i);
    expect(Application).not.toHaveBeenCalled();
  });

  test("401 when the token's email isn't verified", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: APPLICANT, email_verified: false });
    const res = await send("POST", "/", submission, signedIn);
    expect(res.status).toBe(401);
    expect(Application).not.toHaveBeenCalled();
  });

  test("401 when the token is invalid", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("bad token"));
    const res = await send("POST", "/", submission, signedIn);
    expect(res.status).toBe(401);
  });

  test("uses the signed-in email, not the email in the form", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "Applicant@UCSD.edu", email_verified: true });
    const res = await send("POST", "/", { ...submission, email: "someone-else@ucsd.edu" }, signedIn);
    expect(res.status).toBe(201);
    expect(Application).toHaveBeenCalledWith(expect.objectContaining({ email: APPLICANT }));
  });
});

describe("application window", () => {
  test("submissions before the window opens are rejected", async () => {
    notYetOpen();
    const res = await send("POST", "/", submission, signedIn);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not open yet/i);
    expect(Application).not.toHaveBeenCalled();
  });

  test("submissions after the deadline are rejected", async () => {
    closed();
    const res = await send("POST", "/", submission, signedIn);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/deadline has passed/i);
    expect(Application).not.toHaveBeenCalled();
  });

  test("edits after the deadline are rejected without writing", async () => {
    closed();
    const res = await send("PUT", `/email/${APPLICANT}`, { fullName: "Changed" }, signedIn);
    expect(res.status).toBe(400);
    expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("edits while the window is open go through", async () => {
    const res = await send("PUT", `/email/${APPLICANT}`, { fullName: "Changed" }, signedIn);
    expect(res.status).toBe(200);
    expect(Application.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  test("the window is ignored when isActive is false", async () => {
    closed();
    DEADLINE_CONFIG.isActive = false;
    try {
      const res = await send("POST", "/", submission, signedIn);
      expect(res.status).toBe(201);
    } finally {
      DEADLINE_CONFIG.isActive = true;
    }
  });
});

describe("removed and quieter endpoints", () => {
  test("POST /debug-s3 no longer exists", async () => {
    const res = await send("POST", "/debug-s3", {});
    expect(res.status).toBe(404);
  });

  test("a submission doesn't write the applicant's answers or phone to the logs", async () => {
    await send("POST", "/", submission, signedIn);
    const logged = [...console.log.mock.calls, ...console.warn.mock.calls, ...console.error.mock.calls]
      .flat().map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join("\n");
    expect(logged).not.toContain("A distinctive essay sentence");
    expect(logged).not.toContain("555");
  });

  test("a duplicate submission is logged without the applicant's email", async () => {
    mockSave.mockRejectedValue(Object.assign(new Error(`E11000 duplicate key { email: "${APPLICANT}" }`), { code: 11000 }));
    const res = await send("POST", "/", submission, signedIn);
    expect(res.status).toBe(409);
    const logged = [...console.warn.mock.calls, ...console.error.mock.calls].flat().map(String).join("\n");
    expect(logged).not.toContain(APPLICANT);
  });
});

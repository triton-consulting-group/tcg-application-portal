// SOW S-1: the applicant-facing routes return only applicant-owned fields, never board comments or
// status history, while admin routes keep returning everything. Uses the real Application model;
// only its database calls are stubbed.
const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../config/deadlineConfig", () => ({ isActive: false }));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../config/s3Config", () => ({
  s3: {}, S3_CONFIG: { uploadSettings: { maxFileSize: 1024, allowedMimeTypes: [] } }, getFileTypeAndPath: jest.fn(), getFileUrl: jest.fn(),
  getSignedUrl: jest.fn(), isS3Configured: () => false
}));

const express = require("express");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const Application = require("../models/Application");
const applications = require("../routes/applications");
const { APPLICANT_VISIBLE_FIELDS } = require("../utils/applicantView");

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
const APP_ID = "64b000000000000000000001";
const AUTH = { Authorization: "Bearer token" };

const send = (method, path, body, headers = AUTH) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

const signInAs = (email, emailVerified = true) =>
  mockVerifyIdToken.mockResolvedValue({ email, email_verified: emailVerified });

const applicantFields = (email = EMAIL) => ({
  email,
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
});

// The stored application as Mongoose returns it from a query, including board-only data
const storedDocument = (overrides = {}) => Application.hydrate({
  _id: new mongoose.Types.ObjectId(APP_ID),
  ...applicantFields(),
  status: "Case Night - Yes",
  statusHistory: [{ status: "Case Night - Yes", changedBy: "board@ucsd.edu", changedAt: new Date("2026-10-03"), notes: "strong reasoning" }],
  comments: [{ _id: new mongoose.Types.ObjectId(), comment: "internal note", commentedBy: "board@ucsd.edu", commentedAt: new Date("2026-10-03"), adminName: "Board Member" }],
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-02T00:00:00.000Z"),
  __v: 2,
  ...overrides,
});

const expectApplicantView = (body) => {
  expect(body).not.toHaveProperty("comments");
  expect(body).not.toHaveProperty("statusHistory");
  expect(body).not.toHaveProperty("__v");
  for (const key of Object.keys(body)) expect(APPLICANT_VISIBLE_FIELDS).toContain(key);
  const text = JSON.stringify(body);
  expect(text).not.toContain("internal note");
  expect(text).not.toContain("strong reasoning");
  expect(text).not.toContain("board@ucsd.edu");
  expect(text).not.toContain("Board Member");
};

const expectNoDatabaseAccess = () => {
  expect(Application.findOne).not.toHaveBeenCalled();
  expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(Application, "findOne").mockResolvedValue(storedDocument());
  // Like Mongoose, fields left undefined in the update keep their stored value
  jest.spyOn(Application, "findOneAndUpdate").mockImplementation(async (filter, update) =>
    storedDocument(Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined))));
  // Runs the real schema validation, then "saves"
  jest.spyOn(Application.prototype, "save").mockImplementation(async function () {
    await this.validate();
    return this;
  });
  mockVerifyIdToken.mockRejectedValue(new Error("invalid token"));
  signInAs(EMAIL);
});

describe("GET /email/:email (applicant reads their application)", () => {
  test("returns every applicant-visible field and nothing else", async () => {
    const res = await send("GET", `/email/${EMAIL}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expectApplicantView(body);
    expect(Object.keys(body).sort()).toEqual([...APPLICANT_VISIBLE_FIELDS].sort());
    expect(body).toEqual({
      ...applicantFields(),
      _id: APP_ID,
      status: "Case Night - Yes",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    });
  });

  test("is still filtered when the email in the URL has different casing", async () => {
    const res = await send("GET", `/email/${EMAIL.toUpperCase()}`);
    expect(res.status).toBe(200);
    expectApplicantView(await res.json());
    expect(Application.findOne).toHaveBeenCalledWith({ email: EMAIL });
  });

  test("works for an application with no comments or history yet", async () => {
    Application.findOne.mockResolvedValue(storedDocument({ comments: [], statusHistory: [], status: "Under Review" }));
    const res = await send("GET", `/email/${EMAIL}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expectApplicantView(body);
    expect(body.status).toBe("Under Review");
  });

  test("is 404 when there is no application", async () => {
    Application.findOne.mockResolvedValue(null);
    const res = await send("GET", `/email/${EMAIL}`);
    expect(res.status).toBe(404);
    expect(Object.keys(await res.json())).toEqual(["error"]);
  });

  test("is 500 without leaking data when the database fails", async () => {
    Application.findOne.mockRejectedValue(new Error("db down"));
    const res = await send("GET", `/email/${EMAIL}`);
    expect(res.status).toBe(500);
    expect(Object.keys(await res.json())).toEqual(["error"]);
  });

  test("without a token is 401 and never queries the database", async () => {
    const res = await send("GET", `/email/${EMAIL}`, undefined, {});
    expect(res.status).toBe(401);
    expectNoDatabaseAccess();
  });

  test("with an invalid token is 401 and never queries the database", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("invalid token"));
    const res = await send("GET", `/email/${EMAIL}`);
    expect(res.status).toBe(401);
    expectNoDatabaseAccess();
  });

  test("for someone else's email is 403 and never queries the database", async () => {
    signInAs("other@ucsd.edu");
    const res = await send("GET", `/email/${EMAIL}`);
    expect(res.status).toBe(403);
    expectNoDatabaseAccess();
  });

  test("with an unverified email is 403 and never queries the database", async () => {
    signInAs(EMAIL, false);
    const res = await send("GET", `/email/${EMAIL}`);
    expect(res.status).toBe(403);
    expectNoDatabaseAccess();
  });
});

describe("PUT /email/:email (applicant edits their application)", () => {
  const edit = { fullName: "Renamed Applicant", major: "Math", phoneNumber: "(858) 555-0199" };

  test("returns the updated application without board-only data", async () => {
    const res = await send("PUT", `/email/${EMAIL}`, edit);
    expect(res.status).toBe(200);
    const body = await res.json();
    expectApplicantView(body.application);
    expect(body.application).toEqual(expect.objectContaining({
      fullName: "Renamed Applicant", major: "Math", phoneNumber: "+18585550199", status: "Case Night - Yes"
    }));
  });

  test("is filtered for a multipart edit, which is how the frontend sends it", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries(edit)) form.append(key, value);
    form.append("caseNightPreferences", JSON.stringify(["B"]));
    const res = await fetch(`${base}/email/${EMAIL}`, { method: "PUT", headers: AUTH, body: form });
    expect(res.status).toBe(200);
    const body = await res.json();
    expectApplicantView(body.application);
    expect(body.application.major).toBe("Math");
  });

  test("ignores attempts to write comments, status history or status", async () => {
    const res = await send("PUT", `/email/${EMAIL}`, {
      ...edit,
      status: "Accepted",
      comments: [{ comment: "planted", commentedBy: EMAIL, adminName: "Me" }],
      statusHistory: [{ status: "Accepted", changedBy: EMAIL }],
    });
    expect(res.status).toBe(200);
    const [filter, update] = Application.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ email: EMAIL });
    expect(update).not.toHaveProperty("status");
    expect(update).not.toHaveProperty("comments");
    expect(update).not.toHaveProperty("statusHistory");
    expect((await res.json()).application.status).toBe("Case Night - Yes");
  });

  test("is 404 when there is no application, without updating", async () => {
    Application.findOne.mockResolvedValue(null);
    const res = await send("PUT", `/email/${EMAIL}`, edit);
    expect(res.status).toBe(404);
    expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("without a token is 401 and touches nothing", async () => {
    const res = await send("PUT", `/email/${EMAIL}`, edit, {});
    expect(res.status).toBe(401);
    expectNoDatabaseAccess();
  });

  test("for someone else's email is 403 and touches nothing", async () => {
    signInAs("other@ucsd.edu");
    const res = await send("PUT", `/email/${EMAIL}`, edit);
    expect(res.status).toBe(403);
    expectNoDatabaseAccess();
  });
});

describe("POST / (applicant submits)", () => {
  // Each test signs in as a different applicant so the per-account submit limit never trips
  let count = 0;
  const submit = (body) => {
    const email = `submitter${++count}@ucsd.edu`;
    signInAs(email);
    return { email, res: send("POST", "/", body) };
  };
  const form = { ...applicantFields("ignored@ucsd.edu"), phoneNumber: "8585550123", caseNightPreferences: ["A"] };

  test("returns the new application without board-only data", async () => {
    const { email, res } = submit(form);
    const response = await res;
    expect(response.status).toBe(201);
    const body = await response.json();
    expectApplicantView(body.application);
    expect(body.application).toEqual(expect.objectContaining({
      email, fullName: "Test Applicant", phoneNumber: "+18585550123", status: "Under Review"
    }));
    expect(body.application._id).toMatch(/^[0-9a-f]{24}$/);
  });

  test("ignores status, comments and history sent in the form", async () => {
    const { res } = submit({
      ...form,
      status: "Accepted",
      comments: [{ comment: "planted", commentedBy: "x@ucsd.edu", adminName: "X" }],
      statusHistory: [{ status: "Accepted", changedBy: "x@ucsd.edu" }],
    });
    expect((await res).status).toBe(201);
    const saved = Application.prototype.save.mock.instances[0];
    expect(saved.status).toBe("Under Review");
    expect(saved.comments).toHaveLength(0);
    expect(saved.statusHistory).toHaveLength(0);
  });

  test("a duplicate submission is 409 with only an error message", async () => {
    Application.prototype.save.mockRejectedValue(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }));
    const { res } = submit(form);
    const response = await res;
    expect(response.status).toBe(409);
    expect(Object.keys(await response.json())).toEqual(["error"]);
  });
});

describe("admin routes still return board data", () => {
  const admin = {
    email: "board@ucsd.edu", name: "Board Member", role: "admin", isActive: true,
    permissions: { canChangeStatus: true, canAddComments: true }
  };

  beforeEach(() => {
    signInAs(admin.email);
    Admin.findOne.mockResolvedValue(admin);
  });

  test("GET /:id includes comments and status history", async () => {
    jest.spyOn(Application, "findById").mockResolvedValue(storedDocument());
    const res = await send("GET", `/${APP_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comments[0].comment).toBe("internal note");
    expect(body.statusHistory[0].notes).toBe("strong reasoning");
  });

  test("GET /all includes comments and status history", async () => {
    const lean = jest.fn().mockResolvedValue([storedDocument().toObject()]);
    jest.spyOn(Application, "find").mockReturnValue({ sort: () => ({ lean }) });
    const res = await send("GET", "/all");
    expect(res.status).toBe(200);
    const [body] = await res.json();
    expect(body.comments[0].comment).toBe("internal note");
    expect(body.statusHistory[0].notes).toBe("strong reasoning");
  });

  test("an admin cannot use the applicant route to read someone's application", async () => {
    const res = await send("GET", `/email/${EMAIL}`);
    expect(res.status).toBe(403);
    expectNoDatabaseAccess();
  });
});

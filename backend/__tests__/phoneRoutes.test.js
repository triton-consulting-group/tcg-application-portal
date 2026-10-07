const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../config/deadlineConfig", () => ({ isActive: false }));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));

const mockSave = jest.fn();
jest.mock("../models/Application", () => {
  const Application = jest.fn(function (fields) {
    Object.assign(this, fields, { _id: "64b000000000000000000002" });
    this.save = mockSave;
  });
  Application.findOne = jest.fn();
  Application.findOneAndUpdate = jest.fn();
  Application.find = jest.fn();
  return Application;
});
jest.mock("../config/s3Config", () => ({
  s3: {}, S3_CONFIG: { uploadSettings: { maxFileSize: 1024, allowedMimeTypes: [] } }, getFileTypeAndPath: jest.fn(), getFileUrl: jest.fn(),
  getSignedUrl: jest.fn(), isS3Configured: () => false
}));

const express = require("express");
const Admin = require("../models/Admin");
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

const send = (method, path, body, headers = {}) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

const submission = {
  email: "applicant@ucsd.edu", fullName: "Test Applicant", studentYear: "2nd", major: "Economics",
  appliedBefore: "No", candidateType: "Tech", reason: "Because"
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockVerifyIdToken.mockRejectedValue(new Error("invalid token"));
  mockSave.mockResolvedValue();
});

afterEach(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

describe("POST /api/applications phone number", () => {
  test("rejects a submission with no phone number", async () => {
    const res = await send("POST", "/", submission);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/phone number/i);
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("rejects an invalid phone number", async () => {
    const res = await send("POST", "/", { ...submission, phoneNumber: "555-0123" });
    expect(res.status).toBe(400);
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("saves a valid phone number in E.164 form", async () => {
    const res = await send("POST", "/", { ...submission, phoneNumber: "(858) 555-0123" });
    expect(res.status).toBe(201);
    expect(Application).toHaveBeenCalledWith(expect.objectContaining({ phoneNumber: "+18585550123" }));
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  test("returns 409 when the email has already applied", async () => {
    mockSave.mockRejectedValue(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }));
    const res = await send("POST", "/", { ...submission, phoneNumber: "8585550123" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already submitted/i);
  });
});

describe("PUT /api/applications/email/:email phone number", () => {
  const owner = "applicant@ucsd.edu";
  const asOwner = { Authorization: "Bearer owner-token" };

  beforeEach(() => {
    mockVerifyIdToken.mockResolvedValue({ email: owner, email_verified: true });
    Application.findOne.mockResolvedValue({ email: owner });
    Application.findOneAndUpdate.mockImplementation(async (filter, update) => ({ ...filter, ...update }));
  });

  test("normalizes and saves an updated phone number", async () => {
    const res = await send("PUT", `/email/${owner}`, { phoneNumber: "858-555-0199" }, asOwner);
    expect(res.status).toBe(200);
    const [filter, update, options] = Application.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ email: owner });
    expect(update.phoneNumber).toBe("+18585550199");
    expect(options).toMatchObject({ runValidators: true });
  });

  test("rejects an invalid phone number without writing", async () => {
    const res = await send("PUT", `/email/${owner}`, { phoneNumber: "abc" }, asOwner);
    expect(res.status).toBe(400);
    expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("leaves the phone number alone when it isn't sent", async () => {
    const res = await send("PUT", `/email/${owner}`, { fullName: "New Name" }, asOwner);
    expect(res.status).toBe(200);
    expect(Application.findOneAndUpdate.mock.calls[0][1].phoneNumber).toBeUndefined();
  });

  test("looks up the application by lowercased email", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "Applicant@UCSD.edu", email_verified: true });
    await send("PUT", "/email/Applicant@UCSD.edu", { fullName: "New Name" }, { Authorization: "Bearer t" });
    expect(Application.findOne).toHaveBeenCalledWith({ email: owner });
  });
});

describe("GET /api/applications/export-by-status", () => {
  test("includes a Phone column", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "member@ucsd.edu", email_verified: true });
    Admin.findOne.mockResolvedValue({ email: "member@ucsd.edu", role: "admin", permissions: {} });
    Application.find.mockReturnValue({
      sort: () => ({ lean: async () => [{ ...submission, phoneNumber: "+18585550123", status: "Under Review", createdAt: new Date(), updatedAt: new Date() }] })
    });

    const res = await fetch(`${base}/export-by-status?statuses=Under%20Review`, { headers: { Authorization: "Bearer t" } });
    expect(res.status).toBe(200);
    const [header, row] = (await res.text()).split("\n");
    expect(header.split(",").slice(0, 3)).toEqual(["Name", "Email", "Phone"]);
    expect(row).toContain("applicant@ucsd.edu,+18585550123,");
  });
});

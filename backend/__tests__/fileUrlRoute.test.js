const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/Application", () => ({ find: jest.fn() }));
jest.mock("../config/s3Config", () => ({
  s3: null,
  S3_CONFIG: {
    bucketName: "tcg-bucket",
    uploadSettings: { maxFileSize: 10 * 1024 * 1024, allowedMimeTypes: ["application/pdf"] }
  },
  getFileTypeAndPath: jest.fn(),
  getFileUrl: jest.fn(),
  getSignedUrl: jest.fn(() => "https://signed.example/url"),
  isS3Configured: jest.fn(() => false)
}));

const express = require("express");
const Admin = require("../models/Admin");
const Application = require("../models/Application");
const s3Config = require("../config/s3Config");
const applications = require("../routes/applications");

const MY_RESUME = "https://tcg-bucket.s3.us-west-1.amazonaws.com/resumes/1700000000000-Jane_Resume.pdf";
const OTHER_RESUME = "https://tcg-bucket.s3.us-west-1.amazonaws.com/resumes/1700000000002-Bob_Resume.pdf";

let server;
let base;

beforeAll((done) => {
  const app = express();
  app.use("/api/applications", applications);
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${server.address().port}/api/applications/file-url/`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  jest.clearAllMocks();
  s3Config.isS3Configured.mockReturnValue(true);
  mockVerifyIdToken.mockRejectedValue(new Error("invalid token"));
  Admin.findOne.mockResolvedValue(null);
  Application.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
});

const bearer = { headers: { Authorization: "Bearer t" } };
const get = (filePath, opts) => fetch(base + encodeURIComponent(filePath), opts);

test("no credentials is 401 and nothing is signed", async () => {
  const res = await get(MY_RESUME);
  expect(res.status).toBe(401);
  expect(s3Config.getSignedUrl).not.toHaveBeenCalled();
});

test("invalid token is 401 and nothing is signed", async () => {
  const res = await get(MY_RESUME, bearer);
  expect(res.status).toBe(401);
  expect(s3Config.getSignedUrl).not.toHaveBeenCalled();
});

test("non-owner gets 403 and nothing is signed", async () => {
  mockVerifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: true });
  Application.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ resume: MY_RESUME }]) });
  const res = await get(OTHER_RESUME, bearer);
  expect(res.status).toBe(403);
  expect(s3Config.getSignedUrl).not.toHaveBeenCalled();
});

test("owner gets a signed URL for exactly their key", async () => {
  mockVerifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: true });
  Application.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ resume: MY_RESUME }]) });
  const res = await get(MY_RESUME, bearer);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ url: "https://signed.example/url" });
  expect(s3Config.getSignedUrl).toHaveBeenCalledWith("resumes/1700000000000-Jane_Resume.pdf", 3600);
});

test("active admin gets a signed URL for any applicant's key", async () => {
  mockVerifyIdToken.mockResolvedValue({ email: "admin@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue({ email: "admin@ucsd.edu", role: "admin" });
  const res = await get(OTHER_RESUME, bearer);
  expect(res.status).toBe(200);
  expect(s3Config.getSignedUrl).toHaveBeenCalledWith("resumes/1700000000002-Bob_Resume.pdf", 3600);
});

test("local-storage mode returns a backend URL for the owner", async () => {
  s3Config.isS3Configured.mockReturnValue(false);
  mockVerifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: true });
  Application.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ resume: "/uploads/123-a.pdf" }]) });
  const res = await get("/uploads/123-a.pdf", bearer);
  expect(res.status).toBe(200);
  expect((await res.json()).url).toMatch(/\/uploads\/123-a\.pdf$/);
  expect(s3Config.getSignedUrl).not.toHaveBeenCalled();
});

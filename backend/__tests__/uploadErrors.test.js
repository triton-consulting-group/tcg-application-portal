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
  s3: {},
  S3_CONFIG: {
    bucketName: "bucket",
    uploadSettings: {
      maxFileSize: 1024 * 1024,
      allowedMimeTypes: ["application/pdf", "image/png"]
    }
  },
  getFileTypeAndPath: jest.fn(() => ({ fileType: "resume", s3Path: "resumes/" })),
  getFileUrl: jest.fn(),
  getSignedUrl: jest.fn(),
  isS3Configured: () => true
}));
let mockStorageOptions;
jest.mock("multer-s3", () => {
  const factory = (options) => {
    mockStorageOptions = options;
    return {
      _handleFile: (req, file, cb) => {
        file.stream.resume();
        cb(Object.assign(new Error("The request signature we calculated does not match"), { code: "SignatureDoesNotMatch" }));
      },
      _removeFile: (req, file, cb) => cb(null)
    };
  };
  factory.AUTO_CONTENT_TYPE = () => {};
  return factory;
});

const express = require("express");
const Application = require("../models/Application");
const applications = require("../routes/applications");

const UPLOAD_FAILED =
  "❌ We couldn't upload your files. Please try again in a few minutes. If it keeps failing, contact the TCG tech team.";

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

const owner = "applicant@ucsd.edu";
const auth = { Authorization: "Bearer token" };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockVerifyIdToken.mockResolvedValue({ email: owner, email_verified: true });
  Application.findOne.mockResolvedValue({ email: owner });
});

afterEach(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

const form = (fields, file) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append("resume", new Blob(["data"], { type: file.type }), file.name);
  return fd;
};

describe("S3 storage options used by the routes", () => {
  const asMulterSees = (name) => Buffer.from(name, "utf8").toString("latin1");
  const call = (fn, file) => new Promise((resolve, reject) => fn({}, file, (err, value) => (err ? reject(err) : resolve(value))));

  test.each(["résumé.pdf", "Hồ sơ.pdf", "简历.pdf"])("key and metadata for %s are ASCII-only", async (name) => {
    const file = { fieldname: "resume", mimetype: "application/pdf", originalname: asMulterSees(name) };
    const key = await call(mockStorageOptions.key, file);
    const metadata = await call(mockStorageOptions.metadata, file);
    expect(key).toMatch(/^resumes\/\d+-[A-Za-z0-9._-]+\.pdf$/);
    for (const value of Object.values(metadata)) expect(value).toMatch(/^[\x20-\x7E]*$/);
    expect(decodeURIComponent(metadata.originalName)).toBe(name.normalize("NFC"));
  });
});

describe("upload failures", () => {
  test("POST / reports an honest 500 when S3 rejects the upload", async () => {
    const res = await fetch(`${base}/`, {
      method: "POST",
      headers: auth,
      body: form({ email: owner, fullName: "Test" }, { name: "résumé.pdf", type: "application/pdf" })
    });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe(UPLOAD_FAILED);
    expect(body.error).not.toMatch(/rename|special characters/i);
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("PUT /email/:email reports the same message and stops before the handler", async () => {
    const res = await fetch(`${base}/email/${owner}`, {
      method: "PUT",
      headers: auth,
      body: form({ fullName: "New" }, { name: "résumé.pdf", type: "application/pdf" })
    });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe(UPLOAD_FAILED);
    expect(body.error).not.toMatch(/rename|special characters/i);
    expect(Application.findOne).not.toHaveBeenCalled();
    expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("PUT /email/:email rejects a disallowed file type with a 400", async () => {
    const res = await fetch(`${base}/email/${owner}`, {
      method: "PUT",
      headers: auth,
      body: form({}, { name: "setup.exe", type: "application/x-msdownload" })
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/File type/);
    expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

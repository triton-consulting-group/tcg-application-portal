jest.mock("../config/firebaseAdmin", () => ({ getFirebaseAuth: jest.fn() }));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/Application", () => ({ find: jest.fn() }));

const { getFirebaseAuth } = require("../config/firebaseAdmin");
const Admin = require("../models/Admin");
const Application = require("../models/Application");
const { toFileKey, requireFileAccess } = require("../middleware/fileAccess");

const BUCKET = "https://tcg-bucket.s3.us-west-1.amazonaws.com/";
const MY_RESUME = `${BUCKET}resumes/1700000000000-Jane_Resume.pdf`;
const MY_IMAGE = `${BUCKET}images/1700000000001-profile.png`;
const OTHER_RESUME = `${BUCKET}resumes/1700000000002-Bob_Resume.pdf`;

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const reqFor = (filePath, authorization = "Bearer t") => ({
  headers: authorization ? { authorization } : {},
  params: { 0: filePath }
});

const applicationsReturn = (apps) => {
  Application.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(apps) });
};

let verifyIdToken;

beforeEach(() => {
  jest.clearAllMocks();
  verifyIdToken = jest.fn();
  getFirebaseAuth.mockReturnValue({ verifyIdToken });
  Admin.findOne.mockResolvedValue(null);
  applicationsReturn([]);
});

describe("toFileKey", () => {
  test("strips the S3 host from a full URL", () => {
    expect(toFileKey(MY_RESUME)).toBe("resumes/1700000000000-Jane_Resume.pdf");
  });
  test("leaves a bare key alone", () => {
    expect(toFileKey("resumes/a.pdf")).toBe("resumes/a.pdf");
  });
  test("strips leading slashes from local paths", () => {
    expect(toFileKey("/uploads/123-a.pdf")).toBe("uploads/123-a.pdf");
  });
  test("returns empty string for empty or non-string input", () => {
    expect(toFileKey("")).toBe("");
    expect(toFileKey(undefined)).toBe("");
    expect(toFileKey(null)).toBe("");
  });
});

describe("requireFileAccess", () => {
  test("rejects a request with no token", async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireFileAccess(reqFor(MY_RESUME, null), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a token Firebase cannot verify", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad"));
    const res = mockRes();
    const next = jest.fn();
    await requireFileAccess(reqFor(MY_RESUME), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a token whose email is not verified", async () => {
    verifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: false });
    const res = mockRes();
    const next = jest.fn();
    await requireFileAccess(reqFor(MY_RESUME), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(Application.find).not.toHaveBeenCalled();
  });

  test("rejects an empty key", async () => {
    verifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: true });
    const res = mockRes();
    const next = jest.fn();
    await requireFileAccess(reqFor(""), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test("lets an active admin fetch any file", async () => {
    const adminDoc = { email: "admin@ucsd.edu", role: "admin" };
    verifyIdToken.mockResolvedValue({ email: "admin@ucsd.edu", email_verified: true });
    Admin.findOne.mockResolvedValue(adminDoc);
    const req = reqFor(OTHER_RESUME);
    const next = jest.fn();
    await requireFileAccess(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.fileKey).toBe("resumes/1700000000002-Bob_Resume.pdf");
    expect(req.admin).toBe(adminDoc);
    expect(req.isAdmin).toBe(true);
    expect(Application.find).not.toHaveBeenCalled();
  });

  test("looks up only active admins", async () => {
    verifyIdToken.mockResolvedValue({ email: "admin@ucsd.edu", email_verified: true });
    await requireFileAccess(reqFor(MY_RESUME), mockRes(), jest.fn());
    expect(Admin.findOne).toHaveBeenCalledWith({ email: "admin@ucsd.edu", isActive: true });
  });

  test("lets the owner fetch their own resume", async () => {
    verifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: true });
    applicationsReturn([{ resume: MY_RESUME, transcript: null, image: MY_IMAGE }]);
    const req = reqFor(MY_RESUME);
    const next = jest.fn();
    await requireFileAccess(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.fileKey).toBe("resumes/1700000000000-Jane_Resume.pdf");
    expect(req.isAdmin).toBeUndefined();
  });

  test("lets the owner fetch their own image", async () => {
    verifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: true });
    applicationsReturn([{ resume: MY_RESUME, transcript: null, image: MY_IMAGE }]);
    const next = jest.fn();
    await requireFileAccess(reqFor(MY_IMAGE), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test("accepts a bare key for a file the caller owns", async () => {
    verifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: true });
    applicationsReturn([{ resume: MY_RESUME, transcript: null, image: null }]);
    const next = jest.fn();
    await requireFileAccess(reqFor("resumes/1700000000000-Jane_Resume.pdf"), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test("matches the applicant's email case-insensitively", async () => {
    verifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: true });
    applicationsReturn([{ resume: MY_RESUME, transcript: null, image: null }]);
    await requireFileAccess(reqFor(MY_RESUME), mockRes(), jest.fn());
    const [filter, projection] = Application.find.mock.calls[0];
    expect(filter.email).toBeInstanceOf(RegExp);
    expect(filter.email.test("Jane@UCSD.edu")).toBe(true);
    expect(filter.email.test("xjane@ucsd.edu")).toBe(false);
    expect(filter.email.test("jane@ucsdXedu")).toBe(false); // "." is escaped
    expect(projection).toBe("resume transcript image");
  });

  test("rejects another applicant's file with 403", async () => {
    verifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: true });
    applicationsReturn([{ resume: MY_RESUME, transcript: null, image: MY_IMAGE }]);
    const res = mockRes();
    const next = jest.fn();
    await requireFileAccess(reqFor(OTHER_RESUME), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a key no longer on the caller's application", async () => {
    verifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: true });
    applicationsReturn([{ resume: `${BUCKET}resumes/1800000000000-New.pdf`, transcript: null, image: null }]);
    const res = mockRes();
    await requireFileAccess(reqFor(MY_RESUME), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("rejects a signed-in user with no application with the same 403", async () => {
    verifyIdToken.mockResolvedValue({ email: "nobody@ucsd.edu", email_verified: true });
    const res = mockRes();
    await requireFileAccess(reqFor(MY_RESUME), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("returns 500 when the database fails", async () => {
    verifyIdToken.mockResolvedValue({ email: "jane@ucsd.edu", email_verified: true });
    Admin.findOne.mockRejectedValue(new Error("db down"));
    const res = mockRes();
    await requireFileAccess(reqFor(MY_RESUME), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

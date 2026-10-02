jest.mock("../config/firebaseAdmin", () => ({ getFirebaseAuth: jest.fn() }));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));

const { getFirebaseAuth } = require("../config/firebaseAdmin");
const Admin = require("../models/Admin");
const { requireAdminAuth } = require("../middleware/adminPermissions");

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const reqWith = (authorization) => ({ headers: authorization ? { authorization } : {} });

let verifyIdToken;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.ADMIN_API_TOKEN;
  verifyIdToken = jest.fn();
  getFirebaseAuth.mockReturnValue({ verifyIdToken });
});

test("rejects a request with no Authorization header", async () => {
  const res = mockRes();
  const next = jest.fn();
  await requireAdminAuth(reqWith(), res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test("rejects a header without the Bearer prefix", async () => {
  const res = mockRes();
  const next = jest.fn();
  await requireAdminAuth(reqWith("abc123"), res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(verifyIdToken).not.toHaveBeenCalled();
});

test("rejects a token Firebase cannot verify", async () => {
  verifyIdToken.mockRejectedValue(new Error("auth/id-token-expired"));
  const res = mockRes();
  const next = jest.fn();
  await requireAdminAuth(reqWith("Bearer expired"), res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test("rejects tokens without a verified email", async () => {
  verifyIdToken.mockResolvedValue({ email: "a@ucsd.edu", email_verified: false });
  const res = mockRes();
  const next = jest.fn();
  await requireAdminAuth(reqWith("Bearer t"), res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(Admin.findOne).not.toHaveBeenCalled();
});

test("rejects a verified user who is not an active admin", async () => {
  verifyIdToken.mockResolvedValue({ email: "student@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue(null);
  const res = mockRes();
  const next = jest.fn();
  await requireAdminAuth(reqWith("Bearer t"), res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

test("looks up only active admins", async () => {
  verifyIdToken.mockResolvedValue({ email: "admin@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue(null);
  await requireAdminAuth(reqWith("Bearer t"), mockRes(), jest.fn());
  expect(Admin.findOne).toHaveBeenCalledWith({ email: "admin@ucsd.edu", isActive: true });
});

test("accepts an active admin and attaches req.admin", async () => {
  const adminDoc = { email: "admin@ucsd.edu", role: "admin" };
  verifyIdToken.mockResolvedValue({ email: "admin@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue(adminDoc);
  const req = reqWith("Bearer good");
  const next = jest.fn();
  await requireAdminAuth(req, mockRes(), next);
  expect(next).toHaveBeenCalled();
  expect(req.admin).toBe(adminDoc);
  expect(req.isAdmin).toBe(true);
});

test("returns 500 when the admin lookup fails", async () => {
  verifyIdToken.mockResolvedValue({ email: "admin@ucsd.edu", email_verified: true });
  Admin.findOne.mockRejectedValue(new Error("db down"));
  const res = mockRes();
  await requireAdminAuth(reqWith("Bearer t"), res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(500);
});

// Transitional: removed in Task 4
test("still accepts the legacy shared token during rollout", async () => {
  process.env.ADMIN_API_TOKEN = "legacy-token";
  const next = jest.fn();
  await requireAdminAuth(reqWith("Bearer legacy-token"), mockRes(), next);
  expect(next).toHaveBeenCalled();
  expect(verifyIdToken).not.toHaveBeenCalled();
});

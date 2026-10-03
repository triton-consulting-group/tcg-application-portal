jest.mock("../config/firebaseAdmin", () => ({ getFirebaseAuth: jest.fn() }));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));

const { getFirebaseAuth } = require("../config/firebaseAdmin");
const Admin = require("../models/Admin");
const { checkAdminPermission } = require("../middleware/adminPermissions");

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const reqWith = (headers = {}) => ({ headers });

const requireStatus = checkAdminPermission("canChangeStatus");
let verifyIdToken;

beforeEach(() => {
  jest.clearAllMocks();
  verifyIdToken = jest.fn();
  getFirebaseAuth.mockReturnValue({ verifyIdToken });
});

test("rejects a request that only sends x-admin-email", async () => {
  const res = mockRes();
  const next = jest.fn();
  await requireStatus(reqWith({ "x-admin-email": "president@ucsd.edu" }), res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(Admin.findOne).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

test("rejects a token Firebase cannot verify", async () => {
  verifyIdToken.mockRejectedValue(new Error("auth/argument-error"));
  const res = mockRes();
  const next = jest.fn();
  await requireStatus(reqWith({ authorization: "Bearer forged" }), res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test("rejects a verified user who is not an active admin", async () => {
  verifyIdToken.mockResolvedValue({ email: "student@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue(null);
  const res = mockRes();
  const next = jest.fn();
  await requireStatus(reqWith({ authorization: "Bearer t" }), res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

test("ignores x-admin-email when a valid token is present", async () => {
  verifyIdToken.mockResolvedValue({ email: "member@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue({
    email: "member@ucsd.edu", role: "admin", permissions: { canChangeStatus: false }
  });
  const res = mockRes();
  const next = jest.fn();
  await requireStatus(
    reqWith({ authorization: "Bearer t", "x-admin-email": "president@ucsd.edu" }), res, next
  );
  expect(Admin.findOne).toHaveBeenCalledTimes(1);
  expect(Admin.findOne).toHaveBeenCalledWith({ email: "member@ucsd.edu", isActive: true });
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

test("rejects an admin without the permission and names it", async () => {
  verifyIdToken.mockResolvedValue({ email: "member@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue({
    email: "member@ucsd.edu", role: "admin", permissions: { canChangeStatus: false }
  });
  const res = mockRes();
  await requireStatus(reqWith({ authorization: "Bearer t" }), res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ requiredPermission: "canChangeStatus", adminRole: "admin" })
  );
});

test("treats a missing permissions object as no permission", async () => {
  verifyIdToken.mockResolvedValue({ email: "old@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue({ email: "old@ucsd.edu", role: "admin" });
  const res = mockRes();
  const next = jest.fn();
  await requireStatus(reqWith({ authorization: "Bearer t" }), res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

test("accepts an admin with the permission and attaches req.admin", async () => {
  const adminDoc = { email: "member@ucsd.edu", role: "admin", permissions: { canChangeStatus: true } };
  verifyIdToken.mockResolvedValue({ email: "member@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue(adminDoc);
  const req = reqWith({ authorization: "Bearer t" });
  const next = jest.fn();
  await requireStatus(req, mockRes(), next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.admin).toBe(adminDoc);
});

test("accepts a super admin without the explicit flag", async () => {
  verifyIdToken.mockResolvedValue({ email: "president@ucsd.edu", email_verified: true });
  Admin.findOne.mockResolvedValue({ email: "president@ucsd.edu", role: "super_admin", permissions: {} });
  const next = jest.fn();
  await requireStatus(reqWith({ authorization: "Bearer t" }), mockRes(), next);
  expect(next).toHaveBeenCalledTimes(1);
});

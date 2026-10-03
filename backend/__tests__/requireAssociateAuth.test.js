jest.mock("../config/firebaseAdmin", () => ({ getFirebaseAuth: jest.fn() }));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/User", () => ({ findOne: jest.fn() }));

const { getFirebaseAuth } = require("../config/firebaseAdmin");
const User = require("../models/User");
const { requireAssociateAuth } = require("../middleware/adminPermissions");

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
  verifyIdToken = jest.fn();
  getFirebaseAuth.mockReturnValue({ verifyIdToken });
});

test("rejects a request with no Authorization header", async () => {
  const res = mockRes();
  const next = jest.fn();
  await requireAssociateAuth(reqWith(), res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test("rejects a token Firebase cannot verify", async () => {
  verifyIdToken.mockRejectedValue(new Error("auth/id-token-expired"));
  const res = mockRes();
  const next = jest.fn();
  await requireAssociateAuth(reqWith("Bearer expired"), res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test("rejects tokens without a verified email", async () => {
  verifyIdToken.mockResolvedValue({ email: "a@ucsd.edu", email_verified: false });
  const res = mockRes();
  await requireAssociateAuth(reqWith("Bearer t"), res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(401);
  expect(User.findOne).not.toHaveBeenCalled();
});

test("rejects a verified user who is not an associate", async () => {
  verifyIdToken.mockResolvedValue({ email: "applicant@ucsd.edu", email_verified: true });
  User.findOne.mockResolvedValue(null);
  const res = mockRes();
  const next = jest.fn();
  await requireAssociateAuth(reqWith("Bearer t"), res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

test("looks up only users with the associate role", async () => {
  verifyIdToken.mockResolvedValue({ email: "member@ucsd.edu", email_verified: true });
  User.findOne.mockResolvedValue(null);
  await requireAssociateAuth(reqWith("Bearer t"), mockRes(), jest.fn());
  expect(User.findOne).toHaveBeenCalledWith({ email: "member@ucsd.edu", role: "associate" });
});

test("accepts an associate and attaches req.associate", async () => {
  const userDoc = { email: "member@ucsd.edu", role: "associate" };
  verifyIdToken.mockResolvedValue({ email: "member@ucsd.edu", email_verified: true });
  User.findOne.mockResolvedValue(userDoc);
  const req = reqWith("Bearer good");
  const next = jest.fn();
  await requireAssociateAuth(req, mockRes(), next);
  expect(next).toHaveBeenCalled();
  expect(req.associate).toBe(userDoc);
});

test("returns 500 when the user lookup fails", async () => {
  verifyIdToken.mockResolvedValue({ email: "member@ucsd.edu", email_verified: true });
  User.findOne.mockRejectedValue(new Error("db down"));
  const res = mockRes();
  await requireAssociateAuth(reqWith("Bearer t"), res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(500);
});

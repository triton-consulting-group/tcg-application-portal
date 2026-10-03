const mockVerifyIdToken = jest.fn();
const mockSave = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../models/Admin", () => {
  const MockAdmin = jest.fn(function (doc) { Object.assign(this, doc); this.save = mockSave; });
  MockAdmin.find = jest.fn();
  MockAdmin.findOne = jest.fn();
  MockAdmin.findOneAndUpdate = jest.fn();
  return MockAdmin;
});
jest.mock("../models/User", () => ({ findOneAndUpdate: jest.fn() }));

const http = require("http");
const express = require("express");
const Admin = require("../models/Admin");
const adminRoutes = require("../routes/admin");

const SUPER = { email: "super@ucsd.edu", name: "S", role: "super_admin", permissions: {}, isActive: true };
const MANAGER = { email: "mgr@ucsd.edu", name: "M", role: "admin", permissions: { canManageAdmins: true }, isActive: true };
const REGULAR = { email: "reg@ucsd.edu", name: "R", role: "admin", permissions: { canManageAdmins: false }, isActive: true };

let server;
let base;

beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${server.address().port}/api/admin`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockRejectedValue(new Error("invalid token"));
  mockSave.mockResolvedValue();
});

// Signs the request in as `caller`; Admin.findOne answers the auth lookup first, then `target` (if any)
const signInAs = (caller, target) => {
  mockVerifyIdToken.mockResolvedValue({ email: caller.email, email_verified: true });
  Admin.findOne.mockImplementation(async (q) => {
    if (q.isActive && q.email === caller.email) return { ...caller, save: mockSave };
    if (target && q.email === target.email) return target;
    return null;
  });
};

// Uses http directly: fetch refuses GET bodies, but curl/axios (and attackers) can send them
const call = (method, path, body, token = true) =>
  new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      "Content-Type": "application/json",
      ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      ...(token ? { Authorization: "Bearer t" } : {})
    };
    const req = http.request(base + path, { method, headers }, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, json: async () => JSON.parse(raw) }));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });

describe("the body-email exploit is closed", () => {
  test.each([
    ["GET", "/"],
    ["POST", "/"],
    ["PUT", "/victim@ucsd.edu"],
    ["DELETE", "/victim@ucsd.edu"]
  ])("%s %s with a super admin's email in the body but no token is 401", async (method, path) => {
    Admin.findOne.mockResolvedValue(SUPER); // the old isAdmin would have accepted this
    const res = await call(method, path, { email: SUPER.email, name: "x", role: "super_admin" }, false);
    expect(res.status).toBe(401);
    expect(Admin.find).not.toHaveBeenCalled();
    expect(Admin.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });
});

test("a regular admin without canManageAdmins cannot list admins", async () => {
  signInAs(REGULAR);
  const res = await call("GET", "/");
  expect(res.status).toBe(403);
});

test("a manager can list admins", async () => {
  signInAs(MANAGER);
  Admin.find.mockResolvedValue([REGULAR]);
  const res = await call("GET", "/");
  expect(res.status).toBe(200);
});

test("a manager cannot create a super admin", async () => {
  signInAs(MANAGER);
  const res = await call("POST", "/", { email: "new@ucsd.edu", name: "N", role: "super_admin" });
  expect(res.status).toBe(403);
  expect(mockSave).not.toHaveBeenCalled();
});

test("a manager cannot grant canManageAdmins", async () => {
  signInAs(MANAGER);
  const res = await call("POST", "/", { email: "new@ucsd.edu", name: "N", permissions: { canManageAdmins: true } });
  expect(res.status).toBe(403);
});

test("a super admin can create an admin; email is normalized and createdBy is the caller", async () => {
  signInAs(SUPER);
  const res = await call("POST", "/", { email: " New@UCSD.edu ", name: "N", role: "admin", permissions: { canAddComments: true, bogus: 1 } });
  expect(res.status).toBe(201);
  const created = Admin.mock.calls[0][0];
  expect(created).toMatchObject({ email: "new@ucsd.edu", name: "N", role: "admin", createdBy: SUPER.email });
  expect(created.permissions).toEqual({ canAddComments: true });
});

test("PUT applies only allowlisted fields and never renames the target", async () => {
  signInAs(SUPER, REGULAR);
  Admin.findOneAndUpdate.mockResolvedValue({ ...REGULAR, permissions: { canAddComments: true } });
  const res = await call("PUT", "/reg@ucsd.edu", {
    email: "attacker@ucsd.edu", createdBy: "x", permissions: { canAddComments: true }
  });
  expect(res.status).toBe(200);
  const [filter, update] = Admin.findOneAndUpdate.mock.calls[0];
  expect(filter).toEqual({ email: "reg@ucsd.edu" });
  expect(update).toEqual({ $set: { "permissions.canAddComments": true } });
});

test("a manager cannot promote anyone (including themselves) to super admin", async () => {
  signInAs(MANAGER, MANAGER);
  const res = await call("PUT", "/mgr@ucsd.edu", { role: "super_admin" });
  expect(res.status).toBe(403);
  expect(Admin.findOneAndUpdate).not.toHaveBeenCalled();
});

test("a manager cannot edit or deactivate a super admin", async () => {
  signInAs(MANAGER, SUPER);
  expect((await call("PUT", "/super@ucsd.edu", { name: "x" })).status).toBe(403);
  expect((await call("DELETE", "/super@ucsd.edu")).status).toBe(403);
  expect(Admin.findOneAndUpdate).not.toHaveBeenCalled();
});

test("an admin cannot deactivate themselves via PUT", async () => {
  signInAs(SUPER, SUPER);
  const res = await call("PUT", "/super@ucsd.edu", { isActive: false });
  expect(res.status).toBe(400);
});

describe("/check", () => {
  test("without a token is 401", async () => {
    const res = await call("POST", "/check", { email: SUPER.email }, false);
    expect(res.status).toBe(401);
  });

  test("uses the token's email, not the body's", async () => {
    signInAs(REGULAR);
    const res = await call("POST", "/check", { email: SUPER.email });
    expect(res.status).toBe(200);
    expect((await res.json()).admin.email).toBe(REGULAR.email);
  });
});

test("the unauthenticated /permissions/:email lookup is gone", async () => {
  const res = await call("GET", "/permissions/super@ucsd.edu", null, false);
  expect(res.status).toBe(404);
});

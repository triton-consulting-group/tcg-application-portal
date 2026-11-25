// Run using loadtest/test-admin-management.js; it supplies an isolated replica set.
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: async email => ({ email, email_verified: true }) })
}));

const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const Admin = require("../models/Admin");
const User = require("../models/User");
const Guard = require("../models/AdminManagementGuard");
const write = require("../services/adminManagementWrite");
const routes = require("../routes/admin");

const uri = process.env.ADMIN_TEST_MONGO_URI;
const integration = uri ? describe : describe.skip;

integration("admin management transactions (real MongoDB)", () => {
  let server;
  let base;
  const database = `admin_management_test_${process.pid}_${Date.now()}`;
  const a = "a@local.test";
  const b = "b@local.test";
  const call = (actor, method, target = "", body) => new Promise((resolve, reject) => {
    const request = http.request(base + target, {
      method,
      headers: { Authorization: `Bearer ${actor}`, "Content-Type": "application/json" }
    }, response => {
      let data = "";
      response.on("data", chunk => { data += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(data) }));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.end(body ? JSON.stringify(body) : undefined);
  });

  beforeAll(async () => {
    // Never accept a production connection or reuse the application's database.
    if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\//.test(uri)) throw new Error("Use an isolated local replica set");
    await mongoose.connect(uri, { dbName: database });
    await Promise.all([Admin.init(), User.init(), Guard.init()]);
    const app = express();
    app.use(express.json());
    app.use("/api/admin", routes);
    await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
    base = `http://127.0.0.1:${server.address().port}/api/admin/`;
  });

  beforeEach(async () => {
    await Admin.deleteMany({});
    await User.deleteMany({});
    await Guard.deleteMany({});
    await Admin.create([
      { email: a, name: "A", role: "super_admin" },
      { email: b, name: "B", role: "super_admin" }
    ]);
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test.each([
    ["PUT", { role: "admin" }],
    ["PUT", { isActive: false }],
    ["DELETE", undefined]
  ])("concurrent %s requests cannot remove both super admins (%j)", async (method, body) => {
    const responses = await Promise.all([call(a, method, b, body), call(b, method, a, body)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 403]);
    expect(await Admin.countDocuments({ role: "super_admin", isActive: true })).toBe(1);
  });

  test("a queued writer rechecks permissions after revocation commits", async () => {
    let release;
    let started;
    const holding = new Promise(resolve => { started = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const first = write(a, async (actor, session) => {
      started();
      await gate;
      await Admin.updateOne({ email: b }, { $set: { role: "admin", "permissions.canManageAdmins": false } }, { session });
      return { status: 200 };
    });
    await holding;
    const operation = jest.fn();
    const second = write(b, operation);
    release();
    await first;
    expect((await second).status).toBe(403);
    expect(operation).not.toHaveBeenCalled();
  });

  test("creation commits both records, editing and reactivation still work", async () => {
    const email = "new@local.test";
    expect((await call(a, "POST", "", { email, name: "New" })).status).toBe(201);
    expect(await User.findOne({ email })).toMatchObject({ role: "associate" });
    expect((await call(a, "PUT", email, { name: "Edited", permissions: { canAddComments: false } })).status).toBe(200);
    expect((await call(a, "DELETE", email)).status).toBe(200);
    expect((await call(a, "PUT", email, { isActive: true })).status).toBe(200);
    expect(await Admin.findOne({ email })).toMatchObject({ name: "Edited", isActive: true, permissions: { canAddComments: false } });
  });

  test("failed user creation rolls back the admin record", async () => {
    const failure = jest.spyOn(User, "findOneAndUpdate").mockRejectedValueOnce(new Error("simulated write failure"));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await call(a, "POST", "", { email: "failed@local.test", name: "Failed" })).status).toBe(500);
      expect(await Admin.findOne({ email: "failed@local.test" })).toBeNull();
    } finally {
      failure.mockRestore();
      log.mockRestore();
    }
  });
});

// Only token verification is simulated; authorization, routes and MongoDB are real.
jest.mock("../config/firebaseAdmin", () => ({ getFirebaseAuth: () => ({
  verifyIdToken: async token => {
    if (!token.endsWith("@local.test")) throw new Error("Invalid test token");
    return { email: token, email_verified: true };
  }
}) }));
jest.mock("../config/s3Config", () => ({
  s3: {}, S3_CONFIG: { uploadSettings: { maxFileSize: 1024, allowedMimeTypes: [] } },
  getFileTypeAndPath: jest.fn(), getFileUrl: jest.fn(), isS3Configured: () => false
}));
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const Settings = require("../models/PortalSettings");
const Admin = require("../models/Admin");
const defaults = require("../config/portalSettingsDefaults");
const uri = process.env.PORTAL_SETTINGS_TEST_URI;
const integration = uri ? describe : describe.skip;

integration("portal settings on standalone MongoDB", () => {
  const database = `portal_settings_test_${process.pid}_${Date.now()}`;
  let server, base;
  const call = (path, method = "GET", body, token = "super@local.test") => new Promise((resolve, reject) => {
    const request = http.request(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, response => {
      let data = ""; response.on("data", chunk => { data += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(data) }));
      response.on("error", reject);
    });
    request.on("error", reject); request.end(body ? JSON.stringify(body) : undefined);
  });
  const fresh = () => JSON.parse(JSON.stringify(defaults));
  const save = (values, revision = 0) => call("/settings", "PUT", { revision, values });
  beforeAll(async () => {
    if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\//.test(uri)) throw new Error("Use an isolated local test server");
    await mongoose.connect(uri, { dbName: database });
    await Promise.all([Settings.init(), Admin.init()]);
    await Admin.create([
      { email: "super@local.test", name: "Super", role: "super_admin" },
      { email: "manager@local.test", name: "Manager", role: "admin", permissions: { canManageAdmins: true } },
      { email: "inactive@local.test", name: "Inactive", role: "super_admin", isActive: false }
    ]);
    const app = express(); app.use(express.json());
    app.use("/settings", require("../routes/portalSettings"));
    app.use("/applications", require("../routes/applications"));
    await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(async () => { await Settings.deleteMany({}); });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  test.each([[null, 401], ["invalid", 401], ["manager@local.test", 403], ["inactive@local.test", 403]])("rejects unauthorized writer %s", async (token, expected) => {
    expect((await call("/settings", "PUT", { revision: 0, values: fresh() }, token)).status).toBe(expected);
    expect(await Settings.countDocuments()).toBe(0);
  });
  test("simultaneous first saves create exactly one settings document", async () => {
    const results = await Promise.all([save(fresh()), save(fresh())]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(await Settings.countDocuments()).toBe(1);
  });
  test("simultaneous updates accept one revision and preserve its values", async () => {
    await save(fresh());
    const results = await Promise.all([save({ ...fresh(), cycleName: "A" }, 1), save({ ...fresh(), cycleName: "B" }, 1)]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const stored = (await call("/settings")).body;
    expect(stored.revision).toBe(2);
    expect(stored.values.cycleName).toBe(results.find(result => result.status === 200).body.values.cycleName);
  });
  test("settings survive a fresh database connection and public reads omit editor metadata", async () => {
    expect((await save({ ...fresh(), cycleName: "Saved cycle" })).status).toBe(200);
    await mongoose.disconnect(); await mongoose.connect(uri, { dbName: database });
    const publicData = await call("/settings/public", "GET", undefined, null);
    expect(publicData.status).toBe(200);
    expect(publicData.body.cycleName).toBe("Saved cycle");
    expect(publicData.body).not.toHaveProperty("updatedBy");
    expect(publicData.body).not.toHaveProperty("revision");
  });
  test("invalid capacities do not overwrite stored settings", async () => {
    await save(fresh());
    const values = fresh(); values.caseNight.maxGroupsPerSlot.A = "";
    expect((await save(values, 1)).status).toBe(400);
    expect((await call("/settings")).body.revision).toBe(1);
  });
  test("saved future opening blocks submissions before file handling", async () => {
    const values = fresh(); values.window.applicationStart = new Date(Date.now() + 3600000).toISOString();
    values.window.applicationDeadline = new Date(Date.now() + 7200000).toISOString();
    await save(values);
    expect((await call("/applications/window-status")).body.isBeforeStart).toBe(true);
    const result = await call("/applications", "POST", { email: "super@local.test" });
    expect(result.status).toBe(400); expect(result.body.error).toMatch(/not open/i);
  });
  test("expired dates close submissions; disabling enforcement reopens status", async () => {
    const values = fresh(); values.window.applicationStart = "2020-01-01T00:00:00Z"; values.window.applicationDeadline = "2020-02-01T00:00:00Z";
    await save(values);
    expect((await call("/applications/deadline-status")).body.isDeadlinePassed).toBe(true);
    expect((await call("/applications", "POST", { email: "super@local.test" })).body.error).toMatch(/deadline/i);
    values.window.isActive = false; await save(values, 1);
    expect((await call("/applications/deadline-status")).body.isDeadlinePassed).toBe(false);
    expect((await call("/applications/window-status")).body.isActive).toBe(false);
  });
  test("saved slot labels and capacities reach the existing configuration endpoint", async () => {
    const values = fresh(); values.caseNight.slots.A = "5–6 PM"; values.caseNight.maxGroupsPerSlot.A = 12;
    await save(values);
    expect((await call("/applications/case-night-config")).body).toEqual(values.caseNight);
  });
});

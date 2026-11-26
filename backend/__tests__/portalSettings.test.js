jest.mock("../models/PortalSettings", () => ({ findById: jest.fn(), create: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../middleware/adminPermissions", () => ({ requireAdminAuth: (req, res, next) => {
  const role = req.headers.authorization;
  if (!role) return res.sendStatus(401);
  req.admin = { role, email: "admin@local.test" };
  next();
} }));
const http = require("http");
const express = require("express");
const Settings = require("../models/PortalSettings");
const defaults = require("../config/portalSettingsDefaults");
const { validate, readSettings, loadSettings } = require("../services/portalSettings");
const fresh = () => JSON.parse(JSON.stringify(defaults));
let server, base;
beforeAll(done => {
  const app = express(); app.use(express.json()); app.use("/settings", require("../routes/portalSettings"));
  server = app.listen(0, "127.0.0.1", () => { base = `http://127.0.0.1:${server.address().port}/settings`; done(); });
});
afterAll(done => { server.close(done); });
beforeEach(() => { jest.clearAllMocks(); Settings.findById.mockReturnValue({ lean: async () => null }); });
const call = (method, path, role, body) => new Promise((resolve, reject) => {
  const req = http.request(base + path, { method, headers: { "Content-Type": "application/json", ...(role ? { Authorization: role } : {}) } }, res => {
    let data = ""; res.on("data", chunk => { data += chunk; }); res.on("end", () => resolve({ status: res.statusCode, data }));
  }); req.on("error", reject); req.end(body ? JSON.stringify(body) : undefined);
});
test("missing settings preserve existing defaults without a write", async () => {
  expect(await readSettings()).toEqual({ revision: 0, values: defaults });
  expect(Settings.create).not.toHaveBeenCalled();
});
test("saved settings are read on each request", async () => {
  Settings.findById.mockReturnValue({ lean: async () => ({ revision: 2, values: { ...fresh(), cycleName: "Winter" } }) });
  const req = {}; const next = jest.fn();
  await loadSettings(req, {}, next);
  expect(req.portalSettings.cycleName).toBe("Winter"); expect(next).toHaveBeenCalled();
});
test("database errors fail closed instead of falling back to stale dates", async () => {
  Settings.findById.mockReturnValue({ lean: async () => { throw new Error("offline"); } });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }; const next = jest.fn();
  await loadSettings({}, res, next); expect(res.status).toHaveBeenCalledWith(503); expect(next).not.toHaveBeenCalled();
});
test.each([undefined, "admin"])("non-super-admin %s cannot update", async role => {
  expect((await call("PUT", "", role, { revision: 0, values: fresh() })).status).toBe(role ? 403 : 401);
  expect(Settings.create).not.toHaveBeenCalled();
});
test("public settings expose values without administrative metadata", async () => {
  const result = await call("GET", "/public"); expect(result.status).toBe(200);
  expect(JSON.parse(result.data)).toEqual(defaults);
});
test("a super admin can create the initial settings", async () => {
  Settings.create.mockImplementation(async doc => doc);
  expect((await call("PUT", "", "super_admin", { revision: 0, values: fresh() })).status).toBe(200);
  expect(Settings.create.mock.calls[0][0]).toMatchObject({ _id: "portal", revision: 1, updatedBy: "admin@local.test" });
});
test("concurrent initial saves report conflict", async () => {
  Settings.create.mockRejectedValue({ code: 11000 });
  expect((await call("PUT", "", "super_admin", { revision: 0, values: fresh() })).status).toBe(409);
});
test("updates match the revision and reject stale saves", async () => {
  Settings.findOneAndUpdate.mockResolvedValue(null);
  expect((await call("PUT", "", "super_admin", { revision: 4, values: fresh() })).status).toBe(409);
  expect(Settings.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: "portal", revision: 4 });
});
test.each([
  v => { v.cycleName = " "; },
  v => { v.window.applicationDeadline = v.window.applicationStart; },
  v => { v.window.applicationStart = "2026-10-08T23:59"; },
  v => { v.window.applicationStart = "2026-02-30T23:59:00Z"; },
  v => { v.window.isActive = "false"; },
  v => { v.caseNight.slots.D = "new"; },
  v => { v.caseNight.maxGroupsPerSlot.A = 0; },
  v => { v.caseNight.groupSize = 8; },
  v => { v.wording.reason = ""; },
  v => { v.activeCycle = "other"; }
])("rejects invalid settings %#", mutate => {
  const value = fresh(); mutate(value); expect(() => validate(value)).toThrow();
});
test("valid settings normalize instants and trim text without changing cycle IDs", () => {
  const value = fresh(); value.cycleName = " Winter 2027 ";
  const result = validate(value); expect(result.cycleName).toBe("Winter 2027");
  expect(result.window.applicationStart).toBe("2026-10-09T06:59:00.000Z");
  expect(result).not.toHaveProperty("activeCycle");
});

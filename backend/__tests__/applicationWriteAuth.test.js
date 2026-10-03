const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/Application", () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock("../config/s3Config", () => ({
  s3: {}, S3_CONFIG: { uploadSettings: { maxFileSize: 1024, allowedMimeTypes: [] } }, getFileTypeAndPath: jest.fn(), getFileUrl: jest.fn(),
  getSignedUrl: jest.fn(), isS3Configured: () => false
}));

const express = require("express");
const Admin = require("../models/Admin");
const Application = require("../models/Application");
const applications = require("../routes/applications");

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

const APP_ID = "64b000000000000000000001";
const member = {
  email: "member@ucsd.edu", name: "Real Member", role: "admin",
  permissions: { canChangeStatus: true, canAddComments: true }
};

const send = (method, path, body, headers = {}) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });

const signedInAs = (admin) => {
  mockVerifyIdToken.mockResolvedValue({ email: admin.email, email_verified: true });
  Admin.findOne.mockResolvedValue(admin);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockRejectedValue(new Error("invalid token"));
  Application.findById.mockResolvedValue({ _id: APP_ID });
  Application.findByIdAndUpdate.mockImplementation(async (id, update) => ({
    _id: id, comments: update.$push.comments ? [update.$push.comments] : []
  }));
});

const expectNoApplicationAccess = () => {
  expect(Application.findById).not.toHaveBeenCalled();
  expect(Application.findByIdAndUpdate).not.toHaveBeenCalled();
};

test("PUT /:id with only x-admin-email is 401 and touches nothing", async () => {
  const res = await send("PUT", `/${APP_ID}`, { status: "Accepted" }, { "x-admin-email": "president@ucsd.edu" });
  expect(res.status).toBe(401);
  expectNoApplicationAccess();
});

test("POST /:id/comment with only x-admin-email is 401 and touches nothing", async () => {
  const res = await send(
    "POST", `/${APP_ID}/comment`,
    { comment: "hi", adminEmail: "president@ucsd.edu", adminName: "President" },
    { "x-admin-email": "president@ucsd.edu" }
  );
  expect(res.status).toBe(401);
  expectNoApplicationAccess();
});

test("PUT /:id by an admin without canChangeStatus is 403", async () => {
  signedInAs({ ...member, permissions: { canChangeStatus: false } });
  const res = await send("PUT", `/${APP_ID}`, { status: "Rejected" }, { Authorization: "Bearer t" });
  expect(res.status).toBe(403);
  expectNoApplicationAccess();
});

test("PUT /:id records the verified admin as changedBy, not the body's claim", async () => {
  signedInAs(member);
  const res = await send(
    "PUT", `/${APP_ID}`,
    { status: "Accepted", changedBy: "president@ucsd.edu", notes: "via test" },
    { Authorization: "Bearer t" }
  );
  expect(res.status).toBe(200);
  const update = Application.findByIdAndUpdate.mock.calls[0][1];
  expect(update.status).toBe("Accepted");
  expect(update.$push.statusHistory).toEqual(
    expect.objectContaining({ status: "Accepted", changedBy: "member@ucsd.edu", notes: "via test" })
  );
});

test("POST /:id/comment records the verified admin, not the body's claim", async () => {
  signedInAs(member);
  const res = await send(
    "POST", `/${APP_ID}/comment`,
    { comment: "  strong case  ", adminEmail: "president@ucsd.edu", adminName: "President" },
    { Authorization: "Bearer t" }
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.comment).toEqual(
    expect.objectContaining({ comment: "strong case", commentedBy: "member@ucsd.edu", adminName: "Real Member" })
  );
});

test("POST /:id/comment works without adminEmail/adminName in the body", async () => {
  signedInAs(member);
  const res = await send("POST", `/${APP_ID}/comment`, { comment: "ok" }, { Authorization: "Bearer t" });
  expect(res.status).toBe(200);
});

test("POST /:id/comment still requires a comment", async () => {
  signedInAs(member);
  const res = await send("POST", `/${APP_ID}/comment`, {}, { Authorization: "Bearer t" });
  expect(res.status).toBe(400);
  expect(Application.findByIdAndUpdate).not.toHaveBeenCalled();
});

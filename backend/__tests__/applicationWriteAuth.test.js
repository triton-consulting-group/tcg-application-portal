const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/Application", () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn(), findOneAndUpdate: jest.fn() }));
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
  permissions: { canChangeStatus: true, canAddComments: true, canDeleteComments: true }
};
const COMMENT_ID = "64b0000000000000000000c1";

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
  // Delete route: a $pull that matched a comment resolves to the updated application
  Application.findOneAndUpdate.mockResolvedValue({ _id: APP_ID, comments: [] });
});

const expectNoApplicationAccess = () => {
  expect(Application.findById).not.toHaveBeenCalled();
  expect(Application.findByIdAndUpdate).not.toHaveBeenCalled();
  expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
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

test("POST /:id/comment stores the comment with an _id and returns that same _id", async () => {
  signedInAs(member);
  const res = await send("POST", `/${APP_ID}/comment`, { comment: "ok" }, { Authorization: "Bearer t" });
  expect(res.status).toBe(200);
  const pushed = Application.findByIdAndUpdate.mock.calls[0][1].$push.comments;
  expect(pushed._id).toBeDefined();
  expect(String(pushed._id)).toMatch(/^[0-9a-f]{24}$/);
  const body = await res.json();
  expect(body.comment._id).toBe(String(pushed._id));
});

describe("DELETE /:id/comments/:commentId", () => {
  const path = `/${APP_ID}/comments/${COMMENT_ID}`;
  const auth = { Authorization: "Bearer t" };

  test("with only x-admin-email is 401 and touches nothing", async () => {
    const res = await send("DELETE", path, undefined, { "x-admin-email": "president@ucsd.edu" });
    expect(res.status).toBe(401);
    expectNoApplicationAccess();
  });

  test("by an admin without canDeleteComments is 403", async () => {
    signedInAs({ ...member, permissions: { canAddComments: true, canDeleteComments: false } });
    const res = await send("DELETE", path, undefined, auth);
    expect(res.status).toBe(403);
    expectNoApplicationAccess();
  });

  test("canAddComments alone does not grant delete", async () => {
    signedInAs({ ...member, permissions: { canAddComments: true } });
    const res = await send("DELETE", path, undefined, auth);
    expect(res.status).toBe(403);
    expectNoApplicationAccess();
  });

  test("by a super admin without the flag is allowed", async () => {
    signedInAs({ email: "boss@ucsd.edu", name: "Boss", role: "super_admin", permissions: {} });
    const res = await send("DELETE", path, undefined, auth);
    expect(res.status).toBe(200);
  });

  test("with a malformed application id is 400 and touches nothing", async () => {
    signedInAs(member);
    const res = await send("DELETE", `/not-an-id/comments/${COMMENT_ID}`, undefined, auth);
    expect(res.status).toBe(400);
    expectNoApplicationAccess();
  });

  test("with a malformed comment id is 400 and touches nothing", async () => {
    signedInAs(member);
    const res = await send("DELETE", `/${APP_ID}/comments/not-an-id`, undefined, auth);
    expect(res.status).toBe(400);
    expectNoApplicationAccess();
  });

  test("for an unknown application is 404", async () => {
    signedInAs(member);
    Application.findOneAndUpdate.mockResolvedValue(null);
    Application.findById.mockResolvedValue(null);
    const res = await send("DELETE", path, undefined, auth);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/application/i);
  });

  test("for an unknown comment on a real application is 404", async () => {
    signedInAs(member);
    Application.findOneAndUpdate.mockResolvedValue(null);
    Application.findById.mockResolvedValue({ _id: APP_ID, comments: [] });
    const res = await send("DELETE", path, undefined, auth);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/comment/i);
  });

  test("removes the comment with a single atomic $pull and reports the remaining count", async () => {
    signedInAs(member);
    Application.findOneAndUpdate.mockResolvedValue({ _id: APP_ID, comments: [{ comment: "left" }] });
    const res = await send("DELETE", path, undefined, auth);
    expect(res.status).toBe(200);
    expect((await res.json()).totalComments).toBe(1);

    expect(Application.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update] = Application.findOneAndUpdate.mock.calls[0];
    expect(String(filter._id)).toBe(APP_ID);
    expect(String(filter["comments._id"])).toBe(COMMENT_ID);
    expect(Object.keys(update)).toEqual(["$pull"]);
    expect(String(update.$pull.comments._id)).toBe(COMMENT_ID);
  });

  test("logs who deleted which comment", async () => {
    signedInAs(member);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await send("DELETE", path, undefined, auth);
      const logged = JSON.stringify(log.mock.calls);
      expect(logged).toContain("member@ucsd.edu");
      expect(logged).toContain(COMMENT_ID);
      expect(logged).toContain(APP_ID);
    } finally {
      log.mockRestore();
    }
  });
});

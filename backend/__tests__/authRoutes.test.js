const mockVerifyIdToken = jest.fn();
const mockSave = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../models/User", () => {
  const MockUser = jest.fn(function (doc) { Object.assign(this, doc); this.save = mockSave; });
  MockUser.findOne = jest.fn();
  return MockUser;
});

const express = require("express");
const User = require("../models/User");
const authRoutes = require("../routes/auth");

let server;
let base;

beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${server.address().port}/api/auth`;
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

const signInAs = (email) => {
  mockVerifyIdToken.mockResolvedValue({ email, email_verified: true });
};

const call = (method, path, body, token = true) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer t" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });

describe("POST /register", () => {
  test("without a token is 401 and creates nothing", async () => {
    const res = await call("POST", "/register", { email: "victim@ucsd.edu", name: "V" }, false);
    expect(res.status).toBe(401);
    expect(User.findOne).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("with an invalid token is 401", async () => {
    const res = await call("POST", "/register", { email: "victim@ucsd.edu" });
    expect(res.status).toBe(401);
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("registers the token's email, not the body's", async () => {
    signInAs("me@ucsd.edu");
    User.findOne.mockResolvedValue(null);
    const res = await call("POST", "/register", { email: "victim@ucsd.edu", name: "Me" });
    expect(res.status).toBe(201);
    expect(User.findOne).toHaveBeenCalledWith({ email: "me@ucsd.edu" });
    expect(User.mock.calls[0][0]).toEqual({ email: "me@ucsd.edu", name: "Me", role: "applicant" });
  });

  test("updates only the name of an existing user and never their role", async () => {
    signInAs("me@ucsd.edu");
    const existing = { email: "me@ucsd.edu", name: "Old", role: "associate", save: mockSave };
    User.findOne.mockResolvedValue(existing);
    const res = await call("POST", "/register", { name: "New", role: "associate" });
    expect(res.status).toBe(200);
    expect(existing).toMatchObject({ name: "New", role: "associate" });
  });
});

describe("GET /role/:email", () => {
  test("without a token is 401 and never queries the DB", async () => {
    const res = await call("GET", "/role/someone@ucsd.edu", null, false);
    expect(res.status).toBe(401);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test("for someone else's email is 403", async () => {
    signInAs("me@ucsd.edu");
    const res = await call("GET", "/role/someone@ucsd.edu");
    expect(res.status).toBe(403);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test("for your own email returns your role", async () => {
    signInAs("me@ucsd.edu");
    User.findOne.mockResolvedValue({ email: "me@ucsd.edu", role: "associate" });
    const res = await call("GET", "/role/me@ucsd.edu");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: "associate" });
  });
});

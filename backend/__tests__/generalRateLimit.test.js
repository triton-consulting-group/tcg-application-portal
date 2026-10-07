// Signed-in API requests are rate-limited per verified user, not per IP
const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/Application", () => ({
  find: jest.fn(() => ({ sort: () => ({ lean: async () => [] }) })),
}));
jest.mock("../config/s3Config", () => ({
  s3: {}, S3_CONFIG: { uploadSettings: { maxFileSize: 1024, allowedMimeTypes: [] } }, getFileTypeAndPath: jest.fn(), getFileUrl: jest.fn(),
  getSignedUrl: jest.fn(), isS3Configured: () => false
}));

const express = require("express");
const Admin = require("../models/Admin");
const scalingConfig = require("../config/scalingConfig");
const applications = require("../routes/applications");

const LIMIT = scalingConfig.rateLimits.generalApi.max;
let server;
let base;

beforeAll((done) => {
  const app = express();
  app.set("trust proxy", true); // same as server.js
  app.use("/api/applications", applications);
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${server.address().port}/api/applications`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  // Token "t:<email>" verifies as that email; every caller is an active admin
  mockVerifyIdToken.mockImplementation(async (token) => ({ email: token.slice(2), email_verified: true }));
  Admin.findOne.mockImplementation(async ({ email }) => ({ email, name: email, role: "admin", permissions: {} }));
});

const listAll = (email, ip) =>
  fetch(`${base}/all`, { headers: { Authorization: `Bearer t:${email}`, "X-Forwarded-For": ip } });

// Sends n requests, 50 at a time, and returns the status codes
const burst = async (n, makeRequest) => {
  const statuses = [];
  for (let i = 0; i < n; i += 50) {
    const batch = await Promise.all(Array.from({ length: Math.min(50, n - i) }, (_, j) => makeRequest(i + j)));
    statuses.push(...batch.map((r) => r.status));
  }
  return statuses;
};

test("one admin is limited at the per-user cap, even when their IP changes", async () => {
  const statuses = await burst(LIMIT, (i) => listAll("busy-admin@ucsd.edu", `10.0.${i % 200}.1`));
  expect(statuses.every((s) => s === 200)).toBe(true);

  const res = await listAll("busy-admin@ucsd.edu", "10.99.99.99");
  expect(res.status).toBe(429);
  expect((await res.json()).error).toMatch(/too many requests from this account/i);
});

test("30 admins behind one shared IP each get their own budget", async () => {
  // 3600 requests from one IP in total: over the old 3000-per-IP limit, well under 1000 per admin
  const statuses = await burst(3600, (i) => listAll(`board-member-${i % 30}@ucsd.edu`, "10.9.9.9"));
  expect(statuses.filter((s) => s !== 200)).toEqual([]);
});

test("requests without a valid sign-in are rejected before the limiter counts them", async () => {
  const res = await fetch(`${base}/all`, { headers: { "X-Forwarded-For": "10.9.9.9" } });
  expect(res.status).toBe(401);
});

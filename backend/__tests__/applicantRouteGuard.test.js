// Guard for SOW S-1: every route in every router must be admin-only or reviewed here.
// A route an applicant can reach that returns their application gets a leak test automatically,
// so a new applicant route that forgets toApplicantView fails the build instead of leaking.
//
// If this test fails because you added a route:
//   - Admin-only: put requireAdminAuth (or a require*Permission check) on it.
//   - Reachable by applicants and returns application data: call toApplicantView on the response
//     and add the route to APPLICANT_APPLICATION_ROUTES with a request that exercises it.
//   - Anything else: add it to the matching reviewed list with a short reason.
const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../config/deadlineConfig", () => ({ isActive: false }));
jest.mock("../config/s3Config", () => ({
  s3: {}, S3_CONFIG: { uploadSettings: { maxFileSize: 1024, allowedMimeTypes: [] } }, getFileTypeAndPath: jest.fn(), getFileUrl: jest.fn(),
  getSignedUrl: jest.fn(), isS3Configured: () => false
}));

const fs = require("fs");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const Application = require("../models/Application");
const permissions = require("../middleware/adminPermissions");
const { verifyFirebaseOwner } = require("../middleware/firebaseAuth");
const { requireFileAccess } = require("../middleware/fileAccess");

const EMAIL = "applicant@ucsd.edu";

/* ---------- Reviewed lists ---------- */

// Routes an applicant can reach that return their application. Each one is leak-tested below.
const APPLICANT_APPLICATION_ROUTES = {
  "GET /api/applications/email/:email": {
    request: (send) => send("GET", `/email/${EMAIL}`),
    application: (body) => body,
  },
  "PUT /api/applications/email/:email": {
    request: (send) => send("PUT", `/email/${EMAIL}`, { major: "Math" }),
    application: (body) => body.application,
  },
  "POST /api/applications": {
    request: (send) => send("POST", "/", {
      fullName: "Test Applicant", phoneNumber: "8585550123", studentYear: "2nd", major: "Economics",
      appliedBefore: "No", candidateType: "Tech", reason: "Because",
    }),
    application: (body) => body.application,
  },
};

// Routes an applicant can reach that return no application data
const APPLICANT_ROUTES_WITHOUT_APPLICATION_DATA = {
  "GET /api/applications/file-url/*": "returns a signed URL for one of the caller's own files",
  "GET /api/auth/role/:email": "returns only the caller's role",
};

// Routes with no sign-in middleware at all
const ROUTES_WITHOUT_SIGN_IN_MIDDLEWARE = {
  "GET /api/applications/case-night-config": "public Case Night slots",
  "GET /api/applications/window-status": "public application dates",
  "GET /api/applications/deadline-status": "public application deadline",
  "POST /api/auth/register": "checks the token in the handler; returns only the caller's role",
  "POST /api/admin/check": "checks the token in the handler; returns only the caller's own admin record",
};

/* ---------- Route scanning ---------- */

// Middleware that let an applicant through. requireSignedInApplicant lives inside routes/applications.js,
// so it is matched by name; the others by identity.
const APPLICANT_SIGN_IN = new Set([verifyFirebaseOwner, requireFileAccess]);
const APPLICANT_SIGN_IN_NAMES = new Set(["requireSignedInApplicant"]);
// Middleware that admit active admins only (the permission checks run requireAdminAuth themselves)
const ADMIN_ONLY = new Set([
  permissions.requireAdminAuth,
  permissions.requireStatusChangePermission,
  permissions.requireCommentPermission,
  permissions.requireDeleteCommentPermission,
  permissions.requireDragDropPermission,
]);

const ROUTES_DIR = path.join(__dirname, "..", "routes");

// Router mounts, read from server.js so a newly mounted router is scanned automatically
const readMounts = () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const pattern = /app\.use\(\s*["'](\/api\/[^"']*)["']\s*,\s*require\(\s*["']\.\/routes\/([^"']+)["']\s*\)\s*\)/g;
  return [...server.matchAll(pattern)].map(([, prefix, file]) => ({ prefix, file: file.replace(/\.js$/, "") }));
};

// Every route as { id: "METHOD /full/path", handlers: [middleware..., handler] },
// including router-wide middleware (router.use) registered before the route
const listRoutes = (mounts = readMounts()) => mounts.flatMap(({ prefix, file }) => {
  const router = require(path.join(ROUTES_DIR, file));
  const routerWide = [];
  const routes = [];
  for (const layer of router.stack) {
    if (!layer.route) {
      routerWide.push(layer.handle);
      continue;
    }
    const handlers = [...routerWide, ...layer.route.stack.map((l) => l.handle)];
    const fullPath = layer.route.path === "/" ? prefix : prefix + layer.route.path;
    for (const method of Object.keys(layer.route.methods)) {
      routes.push({ id: `${method.toUpperCase()} ${fullPath}`, handlers });
    }
  }
  return routes;
});

const classify = ({ handlers }) => {
  if (handlers.some((fn) => APPLICANT_SIGN_IN.has(fn) || APPLICANT_SIGN_IN_NAMES.has(fn.name))) return "applicant";
  if (handlers.some((fn) => ADMIN_ONLY.has(fn))) return "admin";
  return "no sign-in middleware";
};

const routeIds = (kind) => listRoutes().filter((r) => classify(r) === kind).map((r) => r.id).sort();
const sorted = (obj) => Object.keys(obj).sort();

describe("route guard", () => {
  test("scans every router file in routes/", () => {
    const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".js")).map((f) => f.replace(/\.js$/, "")).sort();
    expect(readMounts().map((m) => m.file).sort()).toEqual(files);
  });

  test("every route an applicant can reach has been reviewed", () => {
    expect(routeIds("applicant")).toEqual(
      [...sorted(APPLICANT_APPLICATION_ROUTES), ...sorted(APPLICANT_ROUTES_WITHOUT_APPLICATION_DATA)].sort()
    );
  });

  test("every route without sign-in middleware has been reviewed", () => {
    expect(routeIds("no sign-in middleware")).toEqual(sorted(ROUTES_WITHOUT_SIGN_IN_MIDDLEWARE));
  });

  test("recognises admin-only routes, including router-wide and permission checks", () => {
    const admin = routeIds("admin");
    expect(admin).toEqual(expect.arrayContaining([
      "GET /api/applications/:id",                    // requireAdminAuth on the route
      "PUT /api/applications/:id",                    // requireStatusChangePermission
      "GET /api/case-groups/assignments",             // router.use(requireAdminAuth)
      "GET /api/admin",                               // requireAdminAuth + requireManageAdmins
    ]));
    expect(admin).not.toContain("GET /api/applications/email/:email");
  });

  test("fails when a new applicant route is added without being reviewed", () => {
    const router = require(path.join(ROUTES_DIR, "applications"));
    router.get("/email/:email/case-night", verifyFirebaseOwner, (req, res) => res.json({}));
    try {
      const reviewed = new Set([...sorted(APPLICANT_APPLICATION_ROUTES), ...sorted(APPLICANT_ROUTES_WITHOUT_APPLICATION_DATA)]);
      expect(routeIds("applicant").filter((id) => !reviewed.has(id))).toEqual(["GET /api/applications/email/:email/case-night"]);
    } finally {
      router.stack.pop();
    }
  });
});

/* ---------- Leak test for every applicant route that returns an application ---------- */

describe("applicant routes never return board-only data", () => {
  let server;
  let base;

  beforeAll((done) => {
    const app = express();
    app.use(express.json());
    app.use("/api/applications", require("../routes/applications"));
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}/api/applications`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  const send = (method, p, body) =>
    fetch(base + p, {
      method,
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  // A stored application carrying every kind of board-only data
  const storedDocument = () => Application.hydrate({
    _id: new mongoose.Types.ObjectId("64b000000000000000000001"),
    email: EMAIL, fullName: "Test Applicant", phoneNumber: "+18585550123", studentYear: "2nd", major: "Economics",
    appliedBefore: "No", candidateType: "Tech", reason: "Because", status: "Case Night - Yes",
    statusHistory: [{ status: "Case Night - Yes", changedBy: "board@ucsd.edu", notes: "strong reasoning" }],
    comments: [{ comment: "internal note", commentedBy: "board@ucsd.edu", adminName: "Board Member" }],
    __v: 1,
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockVerifyIdToken.mockResolvedValue({ email: EMAIL, email_verified: true });
    jest.spyOn(Application, "findOne").mockResolvedValue(storedDocument());
    jest.spyOn(Application, "findOneAndUpdate").mockResolvedValue(storedDocument());
    // A new application with board data already on it, in case a route ever copies it in
    jest.spyOn(Application.prototype, "save").mockImplementation(async function () {
      this.comments.push({ comment: "internal note", commentedBy: "board@ucsd.edu", adminName: "Board Member" });
      this.statusHistory.push({ status: "Under Review", changedBy: "board@ucsd.edu", notes: "strong reasoning" });
      return this;
    });
  });

  test.each(Object.entries(APPLICANT_APPLICATION_ROUTES))("%s", async (id, { request, application }) => {
    const res = await request(send);
    expect(res.status).toBeLessThan(300);
    const returned = application(await res.json());
    expect(returned).toEqual(expect.objectContaining({ email: EMAIL }));
    expect(returned).not.toHaveProperty("comments");
    expect(returned).not.toHaveProperty("statusHistory");
    expect(returned).not.toHaveProperty("__v");
    const text = JSON.stringify(returned);
    for (const secret of ["internal note", "strong reasoning", "board@ucsd.edu", "Board Member"]) {
      expect(text).not.toContain(secret);
    }
  });
});

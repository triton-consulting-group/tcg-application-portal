const mockVerifyIdToken = jest.fn();
jest.mock("../config/firebaseAdmin", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken })
}));
jest.mock("../models/Admin", () => ({ findOne: jest.fn() }));
jest.mock("../models/Application", () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock("../models/Grade", () => ({ find: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn() }));

const express = require("express");
const Admin = require("../models/Admin");
const Application = require("../models/Application");
const Grade = require("../models/Grade");
const grades = require("../routes/grades");

// Chainable stand-in for a Mongoose query: .select()/.sort() return it, .lean() resolves the result
const query = (result) => {
  const q = { select: () => q, sort: () => q, lean: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)) };
  return q;
};

const APP_A = "64b000000000000000000001";
const APP_B = "64b000000000000000000002";
const APP_C = "64b000000000000000000003";
const ME = "me@ucsd.edu";

let server;
let base;

beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use("/api/grades", grades);
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${server.address().port}/api/grades`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockRejectedValue(new Error("invalid token"));
});

const signInAs = (email, role = "admin") => {
  mockVerifyIdToken.mockResolvedValue({ email, email_verified: true });
  Admin.findOne.mockResolvedValue({ email, name: "Me Reviewer", role, permissions: {} });
};

const send = (method, path, body) =>
  fetch(base + path, {
    method,
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

const expectNoDbAccess = () => {
  expect(Application.find).not.toHaveBeenCalled();
  expect(Application.findById).not.toHaveBeenCalled();
  expect(Grade.find).not.toHaveBeenCalled();
  expect(Grade.findOne).not.toHaveBeenCalled();
  expect(Grade.findOneAndUpdate).not.toHaveBeenCalled();
};

describe("auth", () => {
  const routes = [["GET", "/progress"], ["GET", `/${APP_A}/mine`], ["PUT", `/${APP_A}`]];

  test.each(routes)("%s %s without credentials is 401", async (method, path) => {
    const res = await fetch(base + path, { method });
    expect(res.status).toBe(401);
    expectNoDbAccess();
  });

  test.each(routes)("%s %s as a signed-in non-admin is 403", async (method, path) => {
    mockVerifyIdToken.mockResolvedValue({ email: "applicant@ucsd.edu", email_verified: true });
    Admin.findOne.mockResolvedValue(null);
    const res = await send(method, path, method === "PUT" ? { decision: "Yes" } : undefined);
    expect(res.status).toBe(403);
    expectNoDbAccess();
  });

  test("only active admins are accepted", async () => {
    signInAs(ME);
    Application.find.mockReturnValue(query([]));
    Grade.find.mockReturnValue(query([]));
    await send("GET", "/progress");
    expect(Admin.findOne).toHaveBeenCalledWith({ email: ME, isActive: true });
  });
});

describe("PUT /:applicationId", () => {
  beforeEach(() => signInAs(ME));

  test.each(["", "yes", "Strong Yes", 5, null])("rejects decision %j with 400", async (decision) => {
    const res = await send("PUT", `/${APP_A}`, { decision });
    expect(res.status).toBe(400);
    expect(Grade.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each([undefined, "", "Case Study", "screening"])("rejects round %j with 400", async (round) => {
    const res = await send("PUT", `/${APP_A}`, { decision: "Yes", round });
    expect(res.status).toBe(400);
    expect(Application.findById).not.toHaveBeenCalled();
    expect(Grade.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("404 for an invalid or missing application", async () => {
    expect((await send("PUT", "/not-an-id", { decision: "Yes", round: "case_study" })).status).toBe(404);
    Application.findById.mockReturnValue(query(null));
    expect((await send("PUT", `/${APP_A}`, { decision: "Yes", round: "case_study" })).status).toBe(404);
    expect(Grade.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each(["Under Review", "Case Night - No", "Final Interview - Maybe", "Accepted", "Rejected"])(
    "409 when the applicant is %s",
    async (status) => {
      Application.findById.mockReturnValue(query({ _id: APP_A, status }));
      const res = await send("PUT", `/${APP_A}`, { decision: "Yes", round: "case_study" });
      expect(res.status).toBe(409);
      expect(Grade.findOneAndUpdate).not.toHaveBeenCalled();
    }
  );

  test("409 without writing when the applicant has moved to a different round", async () => {
    // e.g. the page still shows Case Study, but the applicant is now in Final Interview
    Application.findById.mockReturnValue(query({ _id: APP_A, status: "Final Interview - Yes" }));
    const res = await send("PUT", `/${APP_A}`, { decision: "Yes", round: "case_study" });
    expect(res.status).toBe(409);
    expect(Grade.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each([["Case Night - Yes", "case_study"], ["Final Interview - Yes", "final_interview"]])(
    "upserts one grade per reviewer for %s, taking the round from the status and the reviewer from the token",
    async (status, round) => {
      Application.findById.mockReturnValue(query({ _id: APP_A, status }));
      Grade.findOneAndUpdate.mockReturnValue(query({ decision: "Maybe" }));

      const res = await send("PUT", `/${APP_A}`, { decision: "Maybe", round, adminEmail: "someone-else@ucsd.edu" });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ round, decision: "Maybe" });
      expect(Grade.findOneAndUpdate).toHaveBeenCalledWith(
        { applicationId: APP_A, round, adminEmail: ME },
        { $set: { decision: "Maybe", adminName: "Me Reviewer" } },
        { upsert: true, new: true, runValidators: true }
      );
    }
  );

  test("lowercases the reviewer's email so re-grading always finds the same grade", async () => {
    signInAs("Me@UCSD.edu");
    Application.findById.mockReturnValue(query({ _id: APP_A, status: "Case Night - Yes" }));
    Grade.findOneAndUpdate.mockReturnValue(query({ decision: "No" }));
    await send("PUT", `/${APP_A}`, { decision: "No", round: "case_study" });
    expect(Grade.findOneAndUpdate.mock.calls[0][0].adminEmail).toBe(ME);
  });

  test("retries once when two first grades race on the unique index", async () => {
    Application.findById.mockReturnValue(query({ _id: APP_A, status: "Case Night - Yes" }));
    Grade.findOneAndUpdate
      .mockReturnValueOnce(query(Object.assign(new Error("dup"), { code: 11000 })))
      .mockReturnValueOnce(query({ decision: "Yes" }));
    const res = await send("PUT", `/${APP_A}`, { decision: "Yes", round: "case_study" });
    expect(res.status).toBe(200);
    expect(Grade.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  test("500 on other database errors", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    Application.findById.mockReturnValue(query({ _id: APP_A, status: "Case Night - Yes" }));
    Grade.findOneAndUpdate.mockReturnValue(query(new Error("db down")));
    const res = await send("PUT", `/${APP_A}`, { decision: "Yes", round: "case_study" });
    expect(res.status).toBe(500);
    expect(Grade.findOneAndUpdate).toHaveBeenCalledTimes(1);
    console.error.mockRestore();
  });
});

describe("GET /:applicationId/mine", () => {
  beforeEach(() => signInAs(ME));

  test("returns only the reviewer's own grade for the current round", async () => {
    Application.findById.mockReturnValue(query({ _id: APP_A, status: "Final Interview - Yes" }));
    Grade.findOne.mockReturnValue(query({ decision: "Yes" }));
    const res = await send("GET", `/${APP_A}/mine`);
    expect(await res.json()).toEqual({ round: "final_interview", decision: "Yes" });
    expect(Grade.findOne).toHaveBeenCalledWith({ applicationId: APP_A, round: "final_interview", adminEmail: ME });
  });

  test("null decision when the reviewer hasn't graded", async () => {
    Application.findById.mockReturnValue(query({ _id: APP_A, status: "Case Night - Yes" }));
    Grade.findOne.mockReturnValue(query(null));
    expect(await (await send("GET", `/${APP_A}/mine`)).json()).toEqual({ round: "case_study", decision: null });
  });

  test("no round outside the graded statuses", async () => {
    Application.findById.mockReturnValue(query({ _id: APP_A, status: "Under Review" }));
    expect(await (await send("GET", `/${APP_A}/mine`)).json()).toEqual({ round: null, decision: null });
    expect(Grade.findOne).not.toHaveBeenCalled();
  });

  test("404 for an unknown application", async () => {
    Application.findById.mockReturnValue(query(null));
    expect((await send("GET", `/${APP_A}/mine`)).status).toBe(404);
  });
});

describe("GET /progress", () => {
  const applications = [
    { _id: APP_A, fullName: "Ada", candidateType: "Tech", status: "Case Night - Yes" },
    { _id: APP_B, fullName: "Bo", candidateType: "Non-Tech", status: "Case Night - Yes" },
    { _id: APP_C, fullName: "Cy", candidateType: "Tech", status: "Final Interview - Yes" }
  ];
  const allGrades = [
    // Ada: split (Yes vs Maybe), and I graded her
    { applicationId: APP_A, round: "case_study", adminEmail: ME, decision: "Yes" },
    { applicationId: APP_A, round: "case_study", adminEmail: "other@ucsd.edu", decision: "Maybe" },
    // Bo: split (Yes vs No), but I haven't graded him
    { applicationId: APP_B, round: "case_study", adminEmail: "other@ucsd.edu", decision: "Yes" },
    { applicationId: APP_B, round: "case_study", adminEmail: "third@ucsd.edu", decision: "No" },
    // Cy: graded twice in the earlier round, ungraded in his current round
    { applicationId: APP_C, round: "case_study", adminEmail: "other@ucsd.edu", decision: "Yes" },
    { applicationId: APP_C, round: "case_study", adminEmail: "third@ucsd.edu", decision: "Yes" }
  ];

  beforeEach(() => {
    Application.find.mockReturnValue(query(applications));
    Grade.find.mockReturnValue(query(allGrades));
  });

  const load = async () => {
    const res = await send("GET", "/progress");
    expect(res.status).toBe(200);
    const body = await res.json();
    return { body, byName: Object.fromEntries(body.applicants.map((a) => [a.fullName, a])) };
  };

  test("only loads applicants in the two graded statuses", async () => {
    signInAs(ME);
    await load();
    expect(Application.find).toHaveBeenCalledWith({ status: { $in: ["Case Night - Yes", "Final Interview - Yes"] } });
    expect(Grade.find).toHaveBeenCalledWith({ applicationId: { $in: [APP_A, APP_B, APP_C] } });
  });

  test("a regular admin sees breakdowns only for applicants they graded", async () => {
    signInAs(ME);
    const { body, byName } = await load();

    expect(body.canSeeAll).toBe(false);
    expect(body.requiredGrades).toBe(2);
    expect(byName.Ada).toMatchObject({ round: "case_study", gradeCount: 2, ungraded: false, myDecision: "Yes", split: true, counts: { Yes: 1, No: 0, Maybe: 1 } });
    expect(byName.Bo).toEqual({ applicationId: APP_B, fullName: "Bo", candidateType: "Non-Tech", status: "Case Night - Yes", round: "case_study", gradeCount: 2, ungraded: false, myDecision: null });
    expect(byName.Bo).not.toHaveProperty("counts");
    expect(byName.Bo).not.toHaveProperty("split");
  });

  test("other rounds' grades don't count toward the current round", async () => {
    signInAs(ME);
    const { byName } = await load();
    expect(byName.Cy).toMatchObject({ round: "final_interview", gradeCount: 0, ungraded: true });
  });

  test("round totals only count splits the viewer can see", async () => {
    signInAs(ME);
    const { body } = await load();
    expect(body.rounds).toEqual({
      case_study: { total: 2, graded: 2, ungraded: 0, split: 1 },
      final_interview: { total: 1, graded: 0, ungraded: 1, split: 0 }
    });
  });

  test("a super admin sees every breakdown and split", async () => {
    signInAs("lead@ucsd.edu", "super_admin");
    const { body, byName } = await load();
    expect(body.canSeeAll).toBe(true);
    expect(byName.Bo).toMatchObject({ myDecision: null, split: true, counts: { Yes: 1, No: 1, Maybe: 0 } });
    expect(body.rounds.case_study.split).toBe(2);
  });

  test("never returns which reviewer gave which grade", async () => {
    signInAs("lead@ucsd.edu", "super_admin");
    const res = await send("GET", "/progress");
    const text = await res.text();
    expect(text).not.toContain("other@ucsd.edu");
    expect(text).not.toContain("third@ucsd.edu");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

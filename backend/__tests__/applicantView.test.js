// Unit tests for the applicant-facing field allowlist (SOW S-1), using the real Application model
const mongoose = require("mongoose");
const Application = require("../models/Application");
const { APPLICANT_VISIBLE_FIELDS, toApplicantView } = require("../utils/applicantView");

// Schema fields that only the board may read. Every schema field must be in exactly one of
// APPLICANT_VISIBLE_FIELDS or this list, so a new field forces a deliberate choice.
const BOARD_ONLY_FIELDS = ["comments", "statusHistory", "__v"];

const APP_ID = new mongoose.Types.ObjectId("64b000000000000000000001");
const COMMENT_ID = new mongoose.Types.ObjectId("64b0000000000000000000c1");

const applicantFields = () => ({
  email: "applicant@ucsd.edu",
  fullName: "Test Applicant",
  phoneNumber: "+18585550123",
  studentYear: "2nd",
  major: "Economics",
  appliedBefore: "No",
  candidateType: "Tech",
  reason: "Because",
  zombieAnswer: "Run",
  additionalInfo: "Extra",
  caseNightPreferences: ["A", "C"],
  resume: "/uploads/resume.pdf",
  transcript: null,
  image: null,
  status: "Case Night - Yes",
});

const boardFields = () => ({
  statusHistory: [{ status: "Case Night - Yes", changedBy: "board@ucsd.edu", changedAt: new Date("2026-10-03"), notes: "strong reasoning" }],
  comments: [{ _id: COMMENT_ID, comment: "internal note", commentedBy: "board@ucsd.edu", commentedAt: new Date("2026-10-03"), adminName: "Board Member" }],
});

// A document shaped exactly as Mongoose returns it from a query
const storedDocument = () => Application.hydrate({
  _id: APP_ID,
  ...applicantFields(),
  ...boardFields(),
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-02T00:00:00.000Z"),
  __v: 3,
});

const expectNoBoardData = (view) => {
  for (const field of BOARD_ONLY_FIELDS) expect(view).not.toHaveProperty(field);
  const text = JSON.stringify(view);
  expect(text).not.toContain("internal note");
  expect(text).not.toContain("strong reasoning");
  expect(text).not.toContain("board@ucsd.edu");
  expect(text).not.toContain("Board Member");
  expect(text).not.toContain(String(COMMENT_ID));
};

describe("allowlist", () => {
  test("covers every Application schema field as either applicant-visible or board-only", () => {
    const schemaFields = Object.keys(Application.schema.paths).filter((p) => !p.includes("."));
    const classified = [...APPLICANT_VISIBLE_FIELDS, ...BOARD_ONLY_FIELDS];
    expect(schemaFields.filter((f) => !classified.includes(f))).toEqual([]);
  });

  test("only names fields that exist on the schema", () => {
    for (const field of APPLICANT_VISIBLE_FIELDS) {
      expect(Application.schema.path(field)).toBeDefined();
    }
  });

  test("never includes board-only fields", () => {
    for (const field of BOARD_ONLY_FIELDS) {
      expect(APPLICANT_VISIBLE_FIELDS).not.toContain(field);
    }
  });

  test("cannot be changed at runtime", () => {
    expect(Object.isFrozen(APPLICANT_VISIBLE_FIELDS)).toBe(true);
  });
});

describe("toApplicantView", () => {
  test("returns exactly the applicant-visible fields of a stored document", () => {
    const view = toApplicantView(storedDocument());
    expect(Object.keys(view).sort()).toEqual([...APPLICANT_VISIBLE_FIELDS].sort());
    expectNoBoardData(view);
  });

  test("keeps the applicant's own values unchanged", () => {
    const view = toApplicantView(storedDocument());
    expect(view).toEqual(expect.objectContaining(applicantFields()));
    expect(String(view._id)).toBe(String(APP_ID));
    expect(view.createdAt).toEqual(new Date("2026-10-01T00:00:00.000Z"));
    expect(view.updatedAt).toEqual(new Date("2026-10-02T00:00:00.000Z"));
  });

  test("returns a plain object, not a Mongoose document", () => {
    const view = toApplicantView(storedDocument());
    expect(view).not.toBeInstanceOf(mongoose.Document);
    expect(typeof view.toObject).toBe("undefined");
    expect(typeof view.save).toBe("undefined");
    expect(Array.isArray(view.caseNightPreferences)).toBe(true);
  });

  test("serializes to the JSON the API sends, with string ids and ISO dates", () => {
    const json = JSON.parse(JSON.stringify(toApplicantView(storedDocument())));
    expect(json._id).toBe(String(APP_ID));
    expect(json.createdAt).toBe("2026-10-01T00:00:00.000Z");
    expect(json.caseNightPreferences).toEqual(["A", "C"]);
    expectNoBoardData(json);
  });

  test("filters a freshly created document, whose comment and history arrays are defaulted", () => {
    const fresh = new Application({ ...applicantFields(), status: "Under Review" });
    expect(fresh.toObject()).toHaveProperty("comments");
    const view = toApplicantView(fresh);
    expectNoBoardData(view);
    expect(view.status).toBe("Under Review");
  });

  test("filters a plain object such as a .lean() query result", () => {
    const view = toApplicantView({ _id: APP_ID, ...applicantFields(), ...boardFields(), __v: 0 });
    expect(view).toEqual(expect.objectContaining(applicantFields()));
    expectNoBoardData(view);
  });

  test("drops fields that are not on the allowlist", () => {
    const view = toApplicantView({ ...applicantFields(), reviewerScore: 4, internalFlag: true });
    expect(view).not.toHaveProperty("reviewerScore");
    expect(view).not.toHaveProperty("internalFlag");
  });

  test("keeps null file fields (the frontend checks them) and omits fields that are missing", () => {
    const view = toApplicantView({ email: "applicant@ucsd.edu", resume: null });
    expect(view).toEqual({ email: "applicant@ucsd.edu", resume: null });
  });

  test("does not modify the object it is given", () => {
    const original = { ...applicantFields(), ...boardFields() };
    const snapshot = JSON.stringify(original);
    toApplicantView(original);
    expect(JSON.stringify(original)).toBe(snapshot);

    const doc = storedDocument();
    toApplicantView(doc);
    expect(doc.comments).toHaveLength(1);
    expect(doc.statusHistory).toHaveLength(1);
  });

  test("passes null and undefined through", () => {
    expect(toApplicantView(null)).toBeNull();
    expect(toApplicantView(undefined)).toBeUndefined();
  });
});

const { checkEditWarnings } = require("../services/caseGroupEdits");

const config = { slots: { A: "6:00 PM – 7:00 PM", B: "7:00 PM – 8:00 PM", C: "8:00 PM – 9:00 PM" } };
const ada = { fullName: "Ada", candidateType: "Tech", caseNightPreferences: ["A", "B"] };
const codes = (args) => checkEditWarnings({ config, source: null, emailsSent: false, ...args }).map((w) => w.code);

test("no warnings for a matching track and slot", () => {
  expect(codes({ application: ada, target: { track: "Tech", slot: "A" } })).toEqual([]);
});

test("warns when the applicant didn't pick that slot", () => {
  const warnings = checkEditWarnings({ application: ada, target: { track: "Tech", slot: "C" }, source: null, emailsSent: false, config });
  expect(warnings).toEqual([{ code: "slot-unavailable", message: "Ada didn't mark 8:00 PM – 9:00 PM as available." }]);
});

test("reads comma-joined preferences", () => {
  const legacy = { ...ada, caseNightPreferences: ["A,B,C"] };
  expect(codes({ application: legacy, target: { track: "Tech", slot: "C" } })).toEqual([]);
});

test("warns when the group is the other track", () => {
  expect(codes({ application: ada, target: { track: "Non-Tech", slot: "A" } })).toEqual(["track-mismatch"]);
});

test.each([
  [1, ["small-group"]],
  [2, ["small-group"]],
  [0, []],
  [3, []]
])("leaving %p behind in the old group → %p", (remaining, expected) => {
  expect(codes({ application: ada, target: null, source: { groupId: "Tech-A-1", remaining } })).toEqual(expected);
});

test("warns when emails were already sent", () => {
  expect(codes({ application: ada, target: { track: "Tech", slot: "A" }, emailsSent: true })).toEqual(["emails-sent"]);
});

test("removing someone only checks the group they leave", () => {
  expect(codes({ application: { fullName: "Ada" }, target: null, source: { groupId: "Tech-A-1", remaining: 2 } })).toEqual([
    "small-group"
  ]);
});

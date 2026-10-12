import {
  getErrorMessage,
  parsePrefs,
  boardFromAssignments,
  boardFromPlan,
  mismatchReason,
  searchMatches,
  sizeTone
} from "./caseGroups";

describe("getErrorMessage", () => {
  test("reads the error from a JSON response", async () => {
    expect(await getErrorMessage({ response: { data: { error: "No assignments found" } } }, "fallback")).toBe("No assignments found");
  });

  test("reads the error from a blob response", async () => {
    const data = new Blob([JSON.stringify({ error: "No assignments found" })], { type: "application/json" });
    expect(await getErrorMessage({ response: { data } }, "fallback")).toBe("No assignments found");
  });

  test("falls back when there is no response or the blob isn't JSON", async () => {
    expect(await getErrorMessage(new Error("Network Error"), "fallback")).toBe("fallback");
    expect(await getErrorMessage({ response: { data: new Blob(["<html>"]) } }, "fallback")).toBe("fallback");
  });
});

test("parsePrefs splits comma-joined values, trims and dedupes", () => {
  expect(parsePrefs(["A,B", " C ", "A"])).toEqual(["A", "B", "C"]);
  expect(parsePrefs(undefined)).toEqual([]);
});

const assignment = (id, candidateType, timeSlot, groupNumber, name, application = {}) => ({
  _id: id,
  candidateType,
  timeSlot,
  groupNumber,
  groupId: `${candidateType}-${timeSlot}-${groupNumber}`,
  applicantName: name,
  emailSent: false,
  applicationId: { _id: `app-${id}`, candidateType, caseNightPreferences: ["A"], ...application }
});

describe("boardFromAssignments", () => {
  const board = boardFromAssignments(
    [
      assignment("a2", "Tech", "A", 2, "Zed"),
      assignment("a1", "Tech", "A", 1, "Bo", { caseNightPreferences: ["A,B"] }),
      assignment("a3", "Tech", "A", 1, "Al"),
      assignment("a4", "Non-Tech", "C", 1, "Cy"),
      { ...assignment("a5", "Tech", "B", 1, "Gone"), applicationId: null }
    ],
    [
      { _id: "u1", fullName: "Ada", candidateType: "Tech", caseNightPreferences: ["B"] },
      { _id: "u2", fullName: "Nobody", candidateType: "Unknown", caseNightPreferences: [] }
    ],
    ["A", "B", "C"]
  );

  test("nests groups by track and slot, sorted by number, members by name", () => {
    expect(board.Tech.slots.A.map((g) => g.groupNumber)).toEqual([1, 2]);
    expect(board.Tech.slots.A[0].members.map((m) => m.name)).toEqual(["Al", "Bo"]);
    expect(board.Tech.slots.C).toEqual([]);
    expect(board["Non-Tech"].slots.C[0].groupId).toBe("Non-Tech-C-1");
  });

  test("people carry what moving them needs", () => {
    expect(board.Tech.slots.A[0].members[1]).toEqual({
      id: "a1",
      assignmentId: "a1",
      applicationId: "app-a1",
      name: "Bo",
      track: "Tech",
      prefs: ["A", "B"],
      emailSent: false,
      reason: null
    });
  });

  test("a deleted application still shows, with unknown availability", () => {
    expect(board.Tech.slots.B[0].members[0]).toMatchObject({ name: "Gone", applicationId: null, prefs: null });
  });

  test("unassigned go to their track's tray; no-track people go in both", () => {
    expect(board.Tech.unassigned.map((p) => p.name)).toEqual(["Ada", "Nobody"]);
    expect(board["Non-Tech"].unassigned.map((p) => p.name)).toEqual(["Nobody"]);
    expect(board.Tech.unassigned[0]).toMatchObject({ id: "u1", assignmentId: null, applicationId: "u1", prefs: ["B"] });
  });
});

test("boardFromPlan shows proposed groups and who wasn't placed, with reasons", () => {
  const plan = {
    tracks: {
      "Non-Tech": { slots: { A: { groups: [] } } },
      Tech: {
        slots: { A: { groups: [{ groupNumber: 1, groupId: "Tech-A-1", members: [{ applicationId: "1", fullName: "Ada" }] }] } }
      }
    },
    excluded: [
      { applicationId: "9", fullName: "Zed", candidateType: "Tech", reason: "Could not be placed" },
      { applicationId: "8", fullName: "Yan", candidateType: "Unknown", reason: "No track" }
    ]
  };
  const board = boardFromPlan(plan);
  expect(board.Tech.slots.A[0].members[0]).toMatchObject({ id: "1", name: "Ada", prefs: null });
  expect(board.Tech.unassigned.map((p) => [p.name, p.reason])).toEqual([
    ["Zed", "Could not be placed"],
    ["Yan", "No track"]
  ]);
  expect(board["Non-Tech"].unassigned.map((p) => p.name)).toEqual(["Yan"]);
});

describe("mismatchReason", () => {
  const labels = { A: "6:00 PM – 7:00 PM", C: "8:00 PM – 9:00 PM" };
  const ada = { name: "Ada", track: "Tech", prefs: ["A"] };

  test("nothing when the slot and track match", () => {
    expect(mismatchReason(ada, "A", "Tech", labels)).toBeNull();
  });

  test("flags a slot they didn't pick", () => {
    expect(mismatchReason(ada, "C", "Tech", labels)).toBe("Didn't pick 8:00 PM – 9:00 PM");
  });

  test("flags the other track", () => {
    expect(mismatchReason(ada, "A", "Non-Tech", labels)).toBe("Ada is Tech");
  });

  test("unknown availability isn't flagged", () => {
    expect(mismatchReason({ ...ada, prefs: null }, "C", "Tech", labels)).toBeNull();
  });
});

test("searchMatches finds people by name across tracks, groups and trays", () => {
  const board = {
    Tech: { slots: { A: [{ members: [{ id: "1", name: "Sarah Bui" }] }] }, unassigned: [{ id: "2", name: "Sara Lee" }] },
    "Non-Tech": { slots: { A: [{ members: [{ id: "3", name: "Bo Sara" }] }] }, unassigned: [] }
  };
  expect(searchMatches(board, " sara ")).toEqual([
    { id: "3", track: "Non-Tech" },
    { id: "1", track: "Tech" },
    { id: "2", track: "Tech" }
  ]);
  expect(searchMatches(board, "")).toEqual([]);
});

test.each([
  [1, "small"],
  [2, "small"],
  [3, "three"],
  [4, "four"],
  [5, "big"]
])("sizeTone(%p) is %p", (n, tone) => {
  expect(sizeTone(n)).toBe(tone);
});
